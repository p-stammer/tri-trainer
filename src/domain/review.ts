/**
 * Wochenrückblick (M3.6): fasst die abgeschlossene Woche zusammen – geplant gegen absolviert je Sportart,
 * Schlüsseleinheiten, Anstrengung und Frische. Reine Beschreibung, keine Bewertung oder Kausalaussage.
 */
import { addDays, diffDays, startOfWeek, type LocalDate } from './calendar';
import { activitiesInWeek, computeFocusProgress, computeWeekProgress, primaryProgress, type ActivityLike } from './progress';
import type { CompletedActivity, TrainingPause, WeekTargets, WeeklyWellnessCheckin } from './schemas';
import { PLANNED_SPORTS, type PlannedSport, type PrimaryMetric } from './sports';
import { pausedDaysInWeek } from './health';

export interface SportReview {
  sport: PlannedSport;
  metric: PrimaryMetric | 'sessions';
  planned: number | null;
  done: number;
  ratio: number | null;
}

export interface WeekReview {
  weekStart: LocalDate;
  sports: SportReview[];
  totalDoneSec: number;
  plannedTotalSec: number | null;
  /** nur wenn alle Sportarten mit Ziel ein Dauerziel haben */
  totalRatio: number | null;
  otherSec: number;
  focusesPlanned: number;
  focusesDone: number;
  sessions: number;
  rpeMean: number | null;
  rpeCount: number;
  freshness: number | null;
  pausedDays: number;
  phase: WeekTargets['phase'];
}

/** Rückblick ist Montag bis Mittwoch für die Vorwoche sichtbar. */
export function reviewWeekFor(today: LocalDate): LocalDate | null {
  const current = startOfWeek(today);
  return diffDays(current, today) <= 2 ? addDays(current, -7) : null;
}

export function weekReview(
  weekStart: LocalDate,
  targets: WeekTargets | undefined,
  activities: readonly (ActivityLike & Partial<Pick<CompletedActivity, 'focus' | 'plannedFocusId'>>)[],
  checkins: readonly Pick<WeeklyWellnessCheckin, 'weekStart' | 'freshness'>[],
  pauses: readonly Pick<TrainingPause, 'startDate' | 'endDate'>[],
  primaryMetric: Record<'swim' | 'bike' | 'run', PrimaryMetric>,
): WeekReview | null {
  const week = activitiesInWeek(activities, weekStart);
  const hasTargets = !!targets && targets.sports.length > 0;
  if (!hasTargets && week.length === 0) return null;
  const p = computeWeekProgress(weekStart, targets, week);
  const sports: SportReview[] = [];
  for (const s of PLANNED_SPORTS) {
    const sp = p.sports[s];
    if (!sp.hasTarget && sp.duration.done === 0) continue;
    if (s === 'strength') {
      const useSessions = sp.duration.planned === null;
      const m = useSessions ? sp.sessions : sp.duration;
      sports.push({ sport: s, metric: useSessions ? 'sessions' : 'duration', planned: m.planned, done: m.done, ratio: m.ratio });
      continue;
    }
    const pp = primaryProgress(sp, primaryMetric[s]);
    sports.push({ sport: s, metric: pp.metric, planned: pp.progress.planned, done: pp.progress.done, ratio: pp.progress.ratio });
  }
  const focus = targets ? computeFocusProgress(targets.focuses, week.map((a) => ({ sport: a.sport, focus: a.focus ?? 'other', ...(a.plannedFocusId ? { plannedFocusId: a.plannedFocusId } : {}) }))) : [];
  const withRpe = week.filter((a) => a.rpe !== undefined);
  // offene Pausen (ohne Ende) zählen bis Wochenende
  const paused = pauses.reduce((m, x) => Math.max(m, pausedDaysInWeek({ startDate: x.startDate, endDate: x.endDate ?? addDays(weekStart, 6) }, weekStart) ?? 0), 0);
  return {
    weekStart,
    sports,
    totalDoneSec: p.totalDurationSec,
    plannedTotalSec: p.plannedTotalDurationSec,
    totalRatio: p.plannedTotalComplete && p.plannedTotalDurationSec ? (p.totalDurationSec - p.other.durationSec) / p.plannedTotalDurationSec : null,
    otherSec: p.other.durationSec,
    focusesPlanned: focus.reduce((s, f) => s + f.planned, 0),
    focusesDone: focus.reduce((s, f) => s + Math.min(f.done, f.planned), 0),
    sessions: week.length,
    rpeMean: withRpe.length ? withRpe.reduce((s, a) => s + (a.rpe ?? 0), 0) / withRpe.length : null,
    rpeCount: withRpe.length,
    freshness: checkins.find((c) => c.weekStart === weekStart)?.freshness ?? null,
    pausedDays: paused,
    phase: targets?.phase,
  };
}
