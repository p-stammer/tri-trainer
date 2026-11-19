/**
 * Leistungstests (Version 2.0, Schritt 1): Testprotokolle mit Rechner, Verlauf der Ankerwerte, Erinnerung zum Nachtesten.
 *
 * Die Protokolle sind Praxis-Konventionen (Evidenzgrad D, TRAINING_SCIENCE 2.10 und 2.14); die Ergebnisse sind
 * Ankerwerte mit bekanntem Messfehler, keine physiologischen Schwellen.
 */
import { diffDays, type LocalDate } from './calendar';
import type { PerformanceMetric } from './schemas';
import type { EnduranceSport } from './sports';

export const METRIC_KIND_FOR: Record<EnduranceSport, PerformanceMetric['kind']> = {
  bike: 'bike_ftp_w',
  run: 'run_threshold_pace_s_per_km',
  swim: 'swim_css_s_per_100m',
};

/** Höher ist besser (Watt) oder niedriger ist besser (Pace). */
export const HIGHER_IS_BETTER: Record<EnduranceSport, boolean> = { bike: true, run: false, swim: false };

export type TestInput = { key: string; label: string; kind: 'watts' | 'duration' | 'meters' };

export interface TestProtocol {
  id: string;
  sport: EnduranceSport;
  name: string;
  /** Kurzbeschreibung des Ablaufs */
  steps: string[];
  inputs: TestInput[];
  /** Ergebnis (W, s/km, s/100 m) oder Fehlermeldung */
  compute: (v: Record<string, number | undefined>) => { value: number } | { error: string } | null;
  source: string;
}

const need = (v: Record<string, number | undefined>, ...keys: string[]) => keys.every((k) => v[k] !== undefined && v[k]! > 0);

export const TEST_PROTOCOLS: TestProtocol[] = [
  {
    id: 'bike_20min',
    sport: 'bike',
    name: '20-min-Test',
    steps: [
      '15–20 min einfahren, darin 3 kurze Steigerungen',
      '5 min zügig, danach 10 min locker',
      '20 min so gleichmäßig und hart wie möglich (Ergometer oder flache, ungestörte Strecke)',
      'Durchschnittsleistung der 20 min eintragen – FTP = 95 % davon',
    ],
    inputs: [{ key: 'p20', label: 'Ø Leistung 20 min', kind: 'watts' }],
    compute: (v) => (need(v, 'p20') ? (v.p20! < 50 || v.p20! > 700 ? { error: 'Bitte die Durchschnittsleistung in Watt prüfen.' } : { value: Math.round(v.p20! * 0.95) }) : null),
    source: 'Allen & Coggan (Fachbuch, Konvention)',
  },
  {
    id: 'run_30min',
    sport: 'run',
    name: '30-min-Lauf',
    steps: [
      '15 min einlaufen, darin 3 kurze Steigerungen',
      '30 min allein so schnell wie möglich gleichmäßig laufen (Bahn oder flache Strecke, kein Wettkampf)',
      'Gelaufene Strecke eintragen – Schwellenpace = Durchschnittspace',
    ],
    inputs: [{ key: 'd30', label: 'Strecke in 30 min', kind: 'meters' }],
    compute: (v) => {
      if (!need(v, 'd30')) return null;
      const pace = 1800 / (v.d30! / 1000);
      return pace < 150 || pace > 600 ? { error: 'Bitte die Strecke prüfen (in Metern bzw. km).' } : { value: Math.round(pace) };
    },
    source: 'Friel (Praxis-Konvention)',
  },
  {
    id: 'swim_css',
    sport: 'swim',
    name: '400/200-m-Test (CSS)',
    steps: [
      '10–15 min einschwimmen',
      '400 m maximal gleichmäßig, Zeit stoppen',
      '5–10 min locker',
      '200 m maximal, Zeit stoppen',
      'CSS = (Zeit 400 m − Zeit 200 m) ÷ 2 pro 100 m',
    ],
    inputs: [
      { key: 't400', label: 'Zeit 400 m', kind: 'duration' },
      { key: 't200', label: 'Zeit 200 m', kind: 'duration' },
    ],
    compute: (v) => {
      if (!need(v, 't400', 't200')) return null;
      if (v.t400! <= v.t200!) return { error: 'Die 400-m-Zeit muss länger sein als die 200-m-Zeit.' };
      const css = (v.t400! - v.t200!) / 2;
      return css < 50 || css > 300 ? { error: 'Bitte die Zeiten prüfen – das Ergebnis wäre unplausibel.' } : { value: Math.round(css) };
    },
    source: 'Wakayoshi et al. 1993 [Z3], Swim Smooth (Praxis)',
  },
];

export interface MetricHistoryEntry {
  metric: PerformanceMetric;
  /** relative Veränderung zum vorherigen Wert, positiv = besser */
  improvement: number | null;
}

/** Verlauf eines Ankerwerts, chronologisch; bei mehreren Werten am selben Tag zählt der zuletzt gespeicherte. */
export function metricHistory(metrics: readonly PerformanceMetric[], sport: EnduranceSport): MetricHistoryEntry[] {
  const kind = METRIC_KIND_FOR[sport];
  const list = metrics
    .filter((m) => m.kind === kind)
    .sort((a, b) => (a.date === b.date ? a.createdAt.localeCompare(b.createdAt) : a.date.localeCompare(b.date)));
  return list.map((m, i) => {
    const prev = list[i - 1];
    if (!prev) return { metric: m, improvement: null };
    const rel = HIGHER_IS_BETTER[sport] ? m.value / prev.value - 1 : prev.value / m.value - 1;
    return { metric: m, improvement: rel };
  });
}

/** Praxis: Nachtest alle 6–8 Wochen (H: Erinnerung nach 8 Wochen). Der Planer nennt Werte ab 12 Wochen „veraltet“. */
export const RETEST_AFTER_DAYS = 56;

export interface TestDue {
  sport: EnduranceSport;
  /** Tage seit dem letzten Wert, null = noch kein Wert */
  ageDays: number | null;
}

/** Fällige Tests. In Taper- und Rennwochen keine Erinnerung (dort wird nicht getestet). */
export function testsDue(metrics: readonly PerformanceMetric[], today: LocalDate, phase?: string): TestDue[] {
  if (phase === 'taper' || phase === 'race') return [];
  const out: TestDue[] = [];
  for (const sport of ['swim', 'bike', 'run'] as const) {
    const h = metricHistory(metrics, sport);
    const last = h[h.length - 1]?.metric;
    const age = last ? diffDays(last.date, today) : null;
    if (age === null || age >= RETEST_AFTER_DAYS) out.push({ sport, ageDays: age });
  }
  return out;
}

// ───────────── VO2max (M4.5) ─────────────

export const VO2_METHODS = ['Labor (Spiroergometrie)', 'Cooper-Test (12 min)', 'Sportuhr (Schätzung)', 'Sonstige'] as const;
export type Vo2Method = (typeof VO2_METHODS)[number];

/** Einordnung je Methode (TRAINING_SCIENCE 2.15). */
export const VO2_METHOD_NOTE: Record<Vo2Method, string> = {
  'Labor (Spiroergometrie)': 'Direkte Messung mit Atemgasanalyse – Referenzverfahren.',
  'Cooper-Test (12 min)': 'Schätzung aus der Laufstrecke in 12 min (Cooper 1968); hängt von Lauftechnik, Tempoeinteilung und Motivation ab.',
  'Sportuhr (Schätzung)':
    'Schätzung der Uhr. Im Mittel recht genau, im Einzelfall laut Metaanalyse bis etwa ± 10 ml/kg/min daneben (Schätzung aus Ruhedaten noch ungenauer) – nur Werte derselben Uhr vergleichen.',
  Sonstige: 'Methode und Quelle bitte angeben, damit sich Werte vergleichen lassen.',
};

/** Cooper-Test: VO2max = (Strecke in m − 504,9) / 44,73. */
export function cooperVo2max(distanceM: number): { value: number } | { error: string } {
  if (distanceM < 1000 || distanceM > 5000) return { error: 'Bitte die Strecke in 12 min prüfen (1–5 km).' };
  return { value: Math.round(((distanceM - 504.9) / 44.73) * 10) / 10 };
}

/** VO2max-Verlauf chronologisch mit Veränderung zum vorherigen Wert (höher = besser). */
export function vo2History(metrics: readonly PerformanceMetric[]): { metric: PerformanceMetric; improvement: number | null; sameMethod: boolean }[] {
  const list = metrics
    .filter((m) => m.kind === 'vo2max_ml_kg_min')
    .sort((a, b) => (a.date === b.date ? a.createdAt.localeCompare(b.createdAt) : a.date.localeCompare(b.date)));
  return list.map((m, i) => {
    const prev = list[i - 1];
    return { metric: m, improvement: prev ? m.value / prev.value - 1 : null, sameMethod: !prev || prev.method === m.method };
  });
}
