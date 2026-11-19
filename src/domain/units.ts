/**
 * Einheiten und Formatierung.
 * Intern gilt: Distanz in Metern, Zeit in Sekunden. Umrechnung nur an der Oberfläche.
 */

export const SECONDS_PER_MINUTE = 60;
export const SECONDS_PER_HOUR = 3600;

const nf = (maxFractionDigits: number, minFractionDigits = 0) =>
  new Intl.NumberFormat('de-DE', {
    maximumFractionDigits: maxFractionDigits,
    minimumFractionDigits: minFractionDigits,
  });

export function hoursToSeconds(hours: number): number {
  return Math.round(hours * SECONDS_PER_HOUR);
}

export function minutesToSeconds(minutes: number): number {
  return Math.round(minutes * SECONDS_PER_MINUTE);
}

export function kmToMeters(km: number): number {
  // Rundung auf Meter vermeidet Gleitkomma-Reste wie 2399.9999999.
  return Math.round(km * 1000);
}

export function metersToKm(m: number): number {
  return m / 1000;
}

/** Zerlegt Sekunden in ganze Stunden und Minuten (auf Minuten gerundet). */
export function splitHoursMinutes(totalSeconds: number): { hours: number; minutes: number } {
  const totalMinutes = Math.round(Math.max(0, totalSeconds) / 60);
  return { hours: Math.floor(totalMinutes / 60), minutes: totalMinutes % 60 };
}

/** Kompakte Dauer: "6:30 h", "0:45 h". */
export function formatDurationShort(seconds: number): string {
  const sign = seconds < 0 ? '−' : '';
  const { hours, minutes } = splitHoursMinutes(Math.abs(seconds));
  return `${sign}${hours}:${String(minutes).padStart(2, '0')} h`;
}

/** Ausgeschriebene Dauer: "6 h 30 min", "45 min", "2 h". */
export function formatDurationLong(seconds: number): string {
  const sign = seconds < 0 ? '−' : '';
  const { hours, minutes } = splitHoursMinutes(Math.abs(seconds));
  if (hours === 0) return `${sign}${minutes} min`;
  if (minutes === 0) return `${sign}${hours} h`;
  return `${sign}${hours} h ${minutes} min`;
}

/** Distanz; Schwimmen in Metern bis 10 km lesbarer, sonst in Kilometern. */
export function formatDistance(meters: number, style: 'auto-swim' | 'km' = 'km'): string {
  if (style === 'auto-swim' && Math.abs(meters) < 10_000) {
    return `${nf(0).format(Math.round(meters))} m`;
  }
  return `${nf(1).format(meters / 1000)} km`;
}

/** Pace in Sekunden pro Kilometer. Null, wenn Distanz fehlt oder 0 ist. */
export function pacePerKm(durationSec: number, distanceM: number | undefined): number | null {
  if (!distanceM || distanceM <= 0 || durationSec <= 0) return null;
  return durationSec / (distanceM / 1000);
}

/** Pace in Sekunden pro 100 m (Schwimmen). */
export function pacePer100m(durationSec: number, distanceM: number | undefined): number | null {
  if (!distanceM || distanceM <= 0 || durationSec <= 0) return null;
  return durationSec / (distanceM / 100);
}

export function speedKmh(durationSec: number, distanceM: number | undefined): number | null {
  if (!distanceM || distanceM <= 0 || durationSec <= 0) return null;
  return distanceM / 1000 / (durationSec / 3600);
}

/** "4:35" aus 275 Sekunden; rundet korrekt (299,6 s → "5:00", nicht "4:60"). */
export function formatPace(secondsPerUnit: number): string {
  const total = Math.round(secondsPerUnit);
  const min = Math.floor(total / 60);
  const sec = total % 60;
  return `${min}:${String(sec).padStart(2, '0')}`;
}

/** Liest "4:35" oder "4.35" oder "4,35"(als min:sek) → Sekunden. Null bei ungültiger Eingabe. */
export function parsePace(input: string): number | null {
  const m = /^\s*(\d{1,2})[:.,](\d{1,2})\s*$/.exec(input);
  if (!m) return null;
  const min = Number(m[1]);
  const sec = Number(m[2]);
  if (sec >= 60) return null;
  return min * 60 + sec;
}

export function formatNumber(value: number, maxFractionDigits = 1): string {
  return nf(maxFractionDigits).format(value);
}

export function formatPercent(ratio: number): string {
  return `${nf(0).format(Math.round(ratio * 100))} %`;
}

/** Liest deutsche oder englische Dezimalzahl ("2,5" / "2.5"). Null bei ungültiger Eingabe. */
export function parseDecimal(input: string): number | null {
  const s = input.trim().replace(/\s/g, '').replace(',', '.');
  if (s === '' || !/^-?\d*\.?\d+$/.test(s)) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}
