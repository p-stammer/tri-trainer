/**
 * Kalenderlogik.
 *
 * Grundsatz: Ein Trainingstag ist ein *lokaler Kalendertag* ("YYYY-MM-DD"), kein Zeitpunkt.
 * Alle Datumsrechnungen laufen deshalb auf reinen Tageszahlen (UTC-Mitternacht als neutrale
 * Rechenbasis). Dadurch können Sommer-/Winterzeitumstellungen keine Tage verschieben.
 * Nur die Frage "welcher Tag ist heute?" hängt von einer Zeitzone ab (Standard: Europe/Berlin).
 */

/** Lokaler Kalendertag im Format YYYY-MM-DD. */
export type LocalDate = string;

export const DEFAULT_TIME_ZONE = 'Europe/Berlin';

const LOCAL_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const MS_PER_DAY = 86_400_000;

export function isLocalDate(value: string): boolean {
  const m = LOCAL_DATE_RE.exec(value);
  if (!m) return false;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (mo < 1 || mo > 12 || d < 1) return false;
  return d <= daysInMonth(y, mo);
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function parts(date: LocalDate): [number, number, number] {
  const m = LOCAL_DATE_RE.exec(date);
  if (!m || !isLocalDate(date)) throw new Error(`Ungültiges Datum: "${date}" (erwartet YYYY-MM-DD)`);
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

/** Tage seit 1970-01-01 (reine Kalenderzählung). */
export function toDayNumber(date: LocalDate): number {
  const [y, m, d] = parts(date);
  return Math.round(Date.UTC(y, m - 1, d) / MS_PER_DAY);
}

export function fromDayNumber(dayNumber: number): LocalDate {
  const dt = new Date(dayNumber * MS_PER_DAY);
  const y = dt.getUTCFullYear();
  const m = dt.getUTCMonth() + 1;
  const d = dt.getUTCDate();
  return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

export function addDays(date: LocalDate, days: number): LocalDate {
  return fromDayNumber(toDayNumber(date) + days);
}

/** Anzahl Tage von `from` bis `to` (positiv, wenn `to` später liegt). */
export function diffDays(from: LocalDate, to: LocalDate): number {
  return toDayNumber(to) - toDayNumber(from);
}

export function compareDates(a: LocalDate, b: LocalDate): number {
  return toDayNumber(a) - toDayNumber(b);
}

/** ISO-Wochentag: 1 = Montag … 7 = Sonntag. */
export function isoWeekday(date: LocalDate): number {
  // 1970-01-01 war ein Donnerstag (ISO 4).
  const n = toDayNumber(date);
  return ((((n + 3) % 7) + 7) % 7) + 1;
}

/** Montag der Woche, in der `date` liegt. Wochen beginnen montags. */
export function startOfWeek(date: LocalDate): LocalDate {
  return addDays(date, 1 - isoWeekday(date));
}

export function endOfWeek(date: LocalDate): LocalDate {
  return addDays(startOfWeek(date), 6);
}

export function isInWeek(date: LocalDate, weekStart: LocalDate): boolean {
  const offset = diffDays(weekStart, date);
  return offset >= 0 && offset <= 6;
}

/** Kalenderwoche nach ISO 8601 (in Deutschland üblich). */
export function isoWeek(date: LocalDate): { year: number; week: number } {
  const thursday = addDays(date, 4 - isoWeekday(date));
  const [year] = parts(thursday);
  const jan1 = `${String(year).padStart(4, '0')}-01-01`;
  const week = Math.floor(diffDays(jan1, thursday) / 7) + 1;
  return { year, week };
}

/** Liefert den lokalen Kalendertag eines Zeitpunkts in der angegebenen Zeitzone. */
export function localDateInTimeZone(instant: Date, timeZone: string = DEFAULT_TIME_ZONE): LocalDate {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const p = fmt.formatToParts(instant);
  const get = (type: string): string => p.find((x) => x.type === type)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

export function today(timeZone: string = DEFAULT_TIME_ZONE, now: Date = new Date()): LocalDate {
  return localDateInTimeZone(now, timeZone);
}

/** Alle Wochenanfänge (Montage) von der Woche von `from` bis einschließlich der Woche von `to`. */
export function weekStartsBetween(from: LocalDate, to: LocalDate): LocalDate[] {
  const first = startOfWeek(from);
  const last = startOfWeek(to);
  const result: LocalDate[] = [];
  for (let d = first; compareDates(d, last) <= 0; d = addDays(d, 7)) result.push(d);
  return result;
}

const WEEKDAYS_DE = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'] as const;

/** "Mo, 16.11.2026" */
export function formatDateDe(date: LocalDate, withWeekday = true): string {
  const [y, m, d] = parts(date);
  const base = `${String(d).padStart(2, '0')}.${String(m).padStart(2, '0')}.${y}`;
  return withWeekday ? `${WEEKDAYS_DE[isoWeekday(date) - 1]}, ${base}` : base;
}

/** "Mo 16.11." */
export function formatWeekdayDayMonthDe(date: LocalDate): string {
  return `${WEEKDAYS_DE[isoWeekday(date) - 1]} ${formatDayMonthDe(date)}`;
}

/** "16.11." */
export function formatDayMonthDe(date: LocalDate): string {
  const [, m, d] = parts(date);
  return `${String(d).padStart(2, '0')}.${String(m).padStart(2, '0')}.`;
}

/** "16.11. – 22.11.2026" */
export function formatWeekRangeDe(weekStart: LocalDate): string {
  return `${formatDayMonthDe(weekStart)} – ${formatDateDe(addDays(weekStart, 6), false)}`;
}
