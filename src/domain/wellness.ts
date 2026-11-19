/**
 * Frische-Auswertung. Reine Vergleiche und Zusammenfassungen – keine medizinische Interpretation
 * und keine automatische Planänderung. Hinweise führen höchstens zu einem Prüfvorschlag.
 */
import { addDays, compareDates, type LocalDate } from './calendar';
import { summarizeLoad, type LoadSummary } from './load';
import type { CompletedActivity, TrainingWeek, WeeklyWellnessCheckin } from './schemas';
import { activitiesInWeek } from './progress';

export type FreshnessTarget = { min: number; max: number };

export type FreshnessStatus = 'below' | 'within' | 'above' | 'no-target';

export interface FreshnessAssessment {
  status: FreshnessStatus;
  value: number;
  target: FreshnessTarget | null;
  /** Abstand zum Zielbereich (negativ = darunter, positiv = darüber, 0 = innerhalb). */
  deviation: number;
  /**
   * Heuristik ohne Zielbereich: Werte ≤ 3 gelten als "deutlich unter durchschnittlich" (Skalenmitte 5).
   * Das ist eine Anzeigeregel, keine wissenschaftliche Schwelle (siehe TRAINING_SCIENCE.md).
   */
  notablyLow: boolean;
  notablyHigh: boolean;
}

export const NOTABLY_LOW_MAX = 3;
export const NOTABLY_HIGH_MIN = 9;

export function assessFreshness(value: number, target: FreshnessTarget | undefined | null): FreshnessAssessment {
  const t = target ?? null;
  let status: FreshnessStatus = 'no-target';
  let deviation = 0;
  if (t) {
    if (value < t.min) {
      status = 'below';
      deviation = value - t.min;
    } else if (value > t.max) {
      status = 'above';
      deviation = value - t.max;
    } else status = 'within';
  }
  return {
    status,
    value,
    target: t,
    deviation,
    notablyLow: value <= NOTABLY_LOW_MAX,
    notablyHigh: value >= NOTABLY_HIGH_MIN,
  };
}

/** Braucht dieser Check-in einen Hinweis (und ist er noch nicht als geprüft markiert)? */
export function needsAttention(a: FreshnessAssessment, acknowledged: boolean): 'low' | 'high' | null {
  if (acknowledged) return null;
  if (a.status === 'below' || (a.status === 'no-target' && a.notablyLow)) return 'low';
  if (a.status === 'above' || (a.status === 'no-target' && a.notablyHigh)) return 'high';
  return null;
}

export interface WeeklyHealthRow {
  weekStart: LocalDate;
  checkin: WeeklyWellnessCheckin | null;
  target: FreshnessTarget | null;
  assessment: FreshnessAssessment | null;
  durationSec: number;
  activityCount: number;
  load: LoadSummary;
}

/**
 * Wochenübersicht für die Gegenüberstellung von Frische, Umfang und subjektiver Belastung.
 * Neueste Woche zuerst. Es werden nur Zusammenhänge nebeneinander gezeigt – keine Kausalität.
 */
export function weeklyHealthRows(
  weekStarts: readonly LocalDate[],
  weeks: readonly Pick<TrainingWeek, 'weekStart' | 'current'>[],
  activities: readonly CompletedActivity[],
  checkins: readonly WeeklyWellnessCheckin[],
): WeeklyHealthRow[] {
  return [...weekStarts]
    .sort((a, b) => compareDates(b, a))
    .map((ws) => {
      const acts = activitiesInWeek(activities, ws);
      const checkin = checkins.find((c) => c.weekStart === ws) ?? null;
      const target = weeks.find((w) => w.weekStart === ws)?.current.freshnessTarget ?? null;
      return {
        weekStart: ws,
        checkin,
        target,
        assessment: checkin ? assessFreshness(checkin.freshness, target) : null,
        durationSec: acts.reduce((s, a) => s + a.durationSec, 0),
        activityCount: acts.length,
        load: summarizeLoad(acts),
      };
    });
}

/** Veränderung zum vorherigen Check-in (null, wenn es keinen gibt). */
export function freshnessChange(checkins: readonly WeeklyWellnessCheckin[], weekStart: LocalDate): number | null {
  const sorted = [...checkins].sort((a, b) => compareDates(a.weekStart, b.weekStart));
  const i = sorted.findIndex((c) => c.weekStart === weekStart);
  if (i <= 0) return null;
  return (sorted[i]?.freshness ?? 0) - (sorted[i - 1]?.freshness ?? 0);
}

/** Wochenanfänge von `from` bis `to` (beide Montage), z. B. für Tabellen. */
export function weekRange(from: LocalDate, to: LocalDate): LocalDate[] {
  const out: LocalDate[] = [];
  for (let d = from; compareDates(d, to) <= 0; d = addDays(d, 7)) out.push(d);
  return out;
}
