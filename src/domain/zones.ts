/**
 * Intensitätszonen.
 *
 * Wichtig: Zonenzeit wird nie erfunden. Ist für eine Einheit keine (oder nur teilweise)
 * Zonenzeit erfasst, bleibt der Rest als "unbekannt" ausgewiesen.
 */
import { ZONES, type EnduranceSport, type Zone, type ZoneSeconds } from './sports';
import type { SportZoneConfiguration, ZoneMetric } from './schemas';

export function sumZoneSeconds(z: ZoneSeconds | undefined): number {
  if (!z) return 0;
  let s = 0;
  for (const zone of ZONES) s += z[zone] ?? 0;
  return s;
}

/** Bekannte (erfasste) Zonenzeit einer Einheit und der unbekannte Rest. */
export function splitKnownUnknown(
  durationSec: number,
  zoneSec: ZoneSeconds | undefined,
): { known: number; unknown: number } {
  const known = Math.min(sumZoneSeconds(zoneSec), durationSec);
  return { known, unknown: Math.max(0, durationSec - known) };
}

/** Addiert Zonenzeiten. Nur tatsächlich vorhandene Werte werden addiert. */
export function addZoneSeconds(a: ZoneSeconds, b: ZoneSeconds | undefined): ZoneSeconds {
  if (!b) return a;
  const out: ZoneSeconds = { ...a };
  for (const zone of ZONES) {
    const v = b[zone];
    if (v !== undefined) out[zone] = (out[zone] ?? 0) + v;
  }
  return out;
}

export function hasAnyZoneTime(z: ZoneSeconds | undefined): boolean {
  return !!z && ZONES.some((zone) => z[zone] !== undefined);
}

export const ZONE_METRIC_FOR_SPORT: Record<EnduranceSport, ZoneMetric> = {
  bike: 'power_w',
  run: 'pace_s_per_km',
  swim: 'pace_s_per_100m',
};

/** Steigen die Grenzwerte mit der Intensität? (Leistung, HF: ja; Pace: nein) */
export function boundsIncreaseWithIntensity(metric: ZoneMetric): boolean {
  return metric === 'power_w' || metric === 'heart_rate_bpm';
}

/** Prüft, ob die vier Grenzen (Untergrenzen Z2–Z5) streng monoton in der richtigen Richtung sind. */
export function validateZoneBounds(metric: ZoneMetric, bounds: readonly number[]): string | null {
  if (bounds.length !== 4) return 'Es werden genau vier Zonengrenzen benötigt.';
  if (bounds.some((b) => !Number.isFinite(b) || b <= 0)) return 'Alle Zonengrenzen müssen positive Zahlen sein.';
  const inc = boundsIncreaseWithIntensity(metric);
  for (let i = 1; i < bounds.length; i++) {
    const prev = bounds[i - 1] as number;
    const cur = bounds[i] as number;
    if (inc ? cur <= prev : cur >= prev) {
      return inc
        ? 'Die Grenzen müssen von Z2 nach Z5 ansteigen.'
        : 'Bei Pace-Zonen muss die Pace von Z2 nach Z5 schneller (kleiner) werden.';
    }
  }
  return null;
}

/**
 * Leistungszonen Rad aus FTP nach dem verbreiteten Schema von Coggan (Allen & Coggan,
 * "Training and Racing with a Power Meter"): L1 ≤55 %, L2 56–75 %, L3 76–90 %,
 * L4 91–105 %, L5 106–120 % FTP. Die Stufen L5–L7 werden hier zu Z5 zusammengefasst.
 *
 * Status: etablierte Praxis-Konvention, keine individuell validierte physiologische Schwelle.
 * Siehe docs/TRAINING_SCIENCE.md.
 */
export const COGGAN_LOWER_BOUNDS_PCT = [0.56, 0.76, 0.91, 1.06] as const;

export function deriveBikeZonesFromFtp(ftpW: number): [number, number, number, number] {
  if (!(ftpW > 0)) throw new Error('FTP muss größer als 0 sein.');
  const [a, b, c, d] = COGGAN_LOWER_BOUNDS_PCT;
  return [Math.round(ftpW * a), Math.round(ftpW * b), Math.round(ftpW * c), Math.round(ftpW * d)];
}

/**
 * Pace-Zonen Laufen aus der Schwellenpace, ausgelegt auf Langdistanz-Training (seit 0.15.1).
 * Grenzen als Vielfaches der Schwellenpace (Zeit pro km):
 *   Z1 langsamer als 150 %, Z2 Grundlage 150–128 %, Z3 Tempo 128–105 %, Z4 Schwelle 105–96 %, Z5 schneller.
 *
 * Begründung (Details in docs/TRAINING_SCIENCE.md 2.10):
 * - Grundlage darf nicht schneller sein als das realistische Ironman-Marathontempo. Das liegt für
 *   Altersklassen-Athleten grob bei 118–133 % der Schwellenpace (offener Marathon ≈ 106 % nach Daniels,
 *   Ironman-Marathon 20–45 min langsamer). Die schnelle Grenze 128 % liegt in dieser Spanne, das
 *   Wettkampftempo damit am Übergang Z2/Z3 – wie in der Praxis für die Langdistanz empfohlen.
 * - Daniels' lockeres Tempo (E) reicht je nach Tabelle bis etwa 120–150 % der Schwellenpace; die App nimmt
 *   bewusst nur den langsameren Teil als Grundlage.
 * - Friels allgemeines Schema (Z2 bis 114 %) ist für Läufer gedacht und war für die Langdistanz zu schnell
 *   (Nutzer-Rückmeldung, 18.11.2026).
 * - Z4/Z5 wie Friel (Z4 + Z5a um die Schwelle, Z5 ab 96 %).
 *
 * Status: Heuristik (H) aus Praxis-Konventionen (D). Nur Vorschlag, nicht individuell validiert.
 */
export const RUN_PACE_FACTORS = [1.5, 1.28, 1.05, 0.96] as const;

export function deriveRunZonesFromThresholdPace(paceSecPerKm: number): [number, number, number, number] {
  if (!(paceSecPerKm > 0)) throw new Error('Schwellenpace muss größer als 0 sein.');
  const [a, b, c, d] = RUN_PACE_FACTORS;
  return [Math.round(paceSecPerKm * a), Math.round(paceSecPerKm * b), Math.round(paceSecPerKm * c), Math.round(paceSecPerKm * d)];
}

/**
 * Pace-Zonen Schwimmen aus der CSS als Sekunden-Abstand pro 100 m. Üblich ist die Schreibweise
 * „CSS + x s“ (Swim Smooth: locker ≈ CSS + 8–10 s, gleichmäßig ≈ CSS + 6 s, hart = CSS;
 * Friel: „T-Zeit ± wenige Sekunden“). Gewählt: Z2 ab CSS + 12 s, Z3 ab CSS + 5 s,
 * Z4 ab CSS + 2 s (bis CSS − 2 s), Z5 ab CSS − 3 s.
 *
 * Status: Konvention (D) mit festgelegten Abständen (H). Nur Vorschlag, nicht individuell validiert.
 */
export const CSS_OFFSETS_SEC = [12, 5, 2, -3] as const;

export function deriveSwimZonesFromCss(cssSecPer100m: number): [number, number, number, number] {
  if (!(cssSecPer100m > 10)) throw new Error('CSS muss größer als 10 s/100 m sein.');
  const [a, b, c, d] = CSS_OFFSETS_SEC;
  return [Math.round(cssSecPer100m + a), Math.round(cssSecPer100m + b), Math.round(cssSecPer100m + c), Math.round(cssSecPer100m + d)];
}

/** Zonengrenzen-Vorschlag aus dem Ankerwert der Sportart (FTP, Schwellenpace, CSS). */
export function deriveZonesFromReference(sport: EnduranceSport, value: number): [number, number, number, number] {
  return sport === 'bike' ? deriveBikeZonesFromFtp(value) : sport === 'run' ? deriveRunZonesFromThresholdPace(value) : deriveSwimZonesFromCss(value);
}

export const DERIVED_METHOD: Record<EnduranceSport, 'derived_coggan_ftp' | 'derived_run_pace' | 'derived_css_offset'> = {
  bike: 'derived_coggan_ftp',
  run: 'derived_run_pace',
  swim: 'derived_css_offset',
};

/**
 * Durchschnittspace einer Einheit und die Zone, in der sie liegt (Laufen s/km, Schwimmen s/100 m).
 * Nur Hinweis: Eine Durchschnittspace sagt nichts über die Verteilung (Intervalle!) und erzeugt keine Zonenzeit.
 * Rad: Geschwindigkeit lässt sich nicht in Leistungszonen übersetzen → null.
 */
export function averagePaceZone(
  sport: EnduranceSport,
  durationSec: number | undefined,
  distanceM: number | undefined,
  config: Pick<SportZoneConfiguration, 'metric' | 'bounds'> | undefined,
): { pace: number; zone: Zone | null } | null {
  if (sport === 'bike' || !durationSec || !distanceM || durationSec <= 0 || distanceM <= 0) return null;
  const pace = sport === 'run' ? durationSec / (distanceM / 1000) : durationSec / (distanceM / 100);
  // unplausible Werte (Tippfehler) nicht deuten
  if (sport === 'run' ? pace < 120 || pace > 1200 : pace < 40 || pace > 600) return null;
  const zone = config && config.metric === ZONE_METRIC_FOR_SPORT[sport] ? zoneForValue(config, pace) : null;
  return { pace, zone };
}

/** Ordnet einen Messwert einer Zone zu (z. B. zur Anzeige der Zonenbereiche). */
export function zoneForValue(config: Pick<SportZoneConfiguration, 'metric' | 'bounds'>, value: number): Zone {
  const inc = boundsIncreaseWithIntensity(config.metric);
  let zoneIndex = 0;
  config.bounds.forEach((b, i) => {
    if (inc ? value >= b : value <= b) zoneIndex = i + 1;
  });
  return ZONES[zoneIndex] as Zone;
}
