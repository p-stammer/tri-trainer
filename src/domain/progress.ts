/**
 * Soll-Ist-Berechnung je Woche.
 *
 * Ebene 1 der Plananpassung: Nach jeder Einheit werden nur abgeleitete Werte neu berechnet.
 * Die Planwerte selbst werden hier nie verändert (reine Funktionen ohne Seiteneffekte).
 */
import { isInWeek, type LocalDate } from './calendar';
import { PLANNED_SPORTS, ZONES, isEnduranceSport, type PlannedSport, type PrimaryMetric, type Sport, type Zone, type ZoneSeconds } from './sports';
import type { CompletedActivity, PlannedSessionFocus, WeekTargets, WeeklySportTarget } from './schemas';
import { addZoneSeconds, splitKnownUnknown } from './zones';

export type ActivityLike = Pick<CompletedActivity, 'sport' | 'date' | 'durationSec' | 'distanceM' | 'zoneSec' | 'rpe'>;

export interface MetricProgress {
  planned: number | null;
  done: number;
  /** Verbleibend bis zum Ziel, nie negativ. Null ohne Ziel. */
  remaining: number | null;
  /** Zielerreichung (kann > 1 sein). Null ohne Ziel oder bei Ziel 0. */
  ratio: number | null;
}

export interface ZoneProgress {
  zone: Zone;
  plannedSec: number | null;
  doneSec: number;
  remainingSec: number | null;
}

export interface SportWeekProgress {
  sport: PlannedSport;
  duration: MetricProgress;
  distance: MetricProgress;
  sessions: MetricProgress;
  /** Anzahl Einheiten ohne Distanzangabe (Distanz-Ist ist dann eine Untergrenze). */
  activitiesWithoutDistance: number;
  zones: ZoneProgress[];
  /** Summe der Trainingszeit ohne Zonenzuordnung. */
  unknownZoneSec: number;
  hasTarget: boolean;
}

export interface WeekProgress {
  weekStart: LocalDate;
  sports: Record<PlannedSport, SportWeekProgress>;
  /** Einheiten der Sportart "Sonstiges" (nicht Teil der Wochenziele). */
  other: { count: number; durationSec: number };
  totalDurationSec: number;
  /** Summe der Dauerziele; null, wenn kein Dauerziel existiert. */
  plannedTotalDurationSec: number | null;
  /** true, wenn jede Sportart mit Wochenziel auch ein Dauerziel hat (Summe ist dann vollständig). */
  plannedTotalComplete: boolean;
}

export function metricProgress(planned: number | undefined | null, done: number): MetricProgress {
  if (planned === undefined || planned === null) return { planned: null, done, remaining: null, ratio: null };
  return {
    planned,
    done,
    remaining: Math.max(0, planned - done),
    ratio: planned > 0 ? done / planned : null,
  };
}

export function activitiesInWeek<T extends Pick<ActivityLike, 'date'>>(activities: readonly T[], weekStart: LocalDate): T[] {
  return activities.filter((a) => isInWeek(a.date, weekStart));
}

function targetFor(targets: WeekTargets | undefined, sport: PlannedSport): WeeklySportTarget | undefined {
  return targets?.sports.find((t) => t.sport === sport);
}

export function computeSportProgress(
  sport: PlannedSport,
  target: WeeklySportTarget | undefined,
  activities: readonly ActivityLike[],
): SportWeekProgress {
  const own = activities.filter((a) => a.sport === sport);
  let durationSec = 0;
  let distanceM = 0;
  let withoutDistance = 0;
  let unknownZoneSec = 0;
  let zoneDone: ZoneSeconds = {};

  for (const a of own) {
    durationSec += a.durationSec;
    if (a.distanceM === undefined) withoutDistance += 1;
    else distanceM += a.distanceM;
    if (isEnduranceSport(sport)) {
      const { unknown } = splitKnownUnknown(a.durationSec, a.zoneSec);
      unknownZoneSec += unknown;
      zoneDone = addZoneSeconds(zoneDone, a.zoneSec);
    }
  }

  const zones: ZoneProgress[] = isEnduranceSport(sport)
    ? ZONES.map((zone) => {
        const planned = target?.zoneSec?.[zone];
        const done = zoneDone[zone] ?? 0;
        return {
          zone,
          plannedSec: planned ?? null,
          doneSec: done,
          remainingSec: planned === undefined ? null : Math.max(0, planned - done),
        };
      })
    : [];

  const hasTarget =
    !!target &&
    (target.durationSec !== undefined || target.distanceM !== undefined || target.sessions !== undefined);

  return {
    sport,
    duration: metricProgress(target?.durationSec, durationSec),
    distance: metricProgress(target?.distanceM, distanceM),
    sessions: metricProgress(target?.sessions, own.length),
    activitiesWithoutDistance: withoutDistance,
    zones,
    unknownZoneSec,
    hasTarget,
  };
}

export function computeWeekProgress(
  weekStart: LocalDate,
  targets: WeekTargets | undefined,
  allActivities: readonly ActivityLike[],
): WeekProgress {
  const week = activitiesInWeek(allActivities, weekStart);
  const sports = {} as Record<PlannedSport, SportWeekProgress>;
  let plannedTotal: number | null = null;
  let complete = true;
  for (const sport of PLANNED_SPORTS) {
    const t = targetFor(targets, sport);
    sports[sport] = computeSportProgress(sport, t, week);
    if (t?.durationSec !== undefined) plannedTotal = (plannedTotal ?? 0) + t.durationSec;
    else if (sports[sport].hasTarget) complete = false;
  }
  const others = week.filter((a) => a.sport === 'other');
  return {
    weekStart,
    sports,
    other: { count: others.length, durationSec: others.reduce((s, a) => s + a.durationSec, 0) },
    totalDurationSec: week.reduce((s, a) => s + a.durationSec, 0),
    plannedTotalDurationSec: plannedTotal,
    plannedTotalComplete: plannedTotal !== null && complete,
  };
}

/**
 * Wählt die primäre Zielgröße für die Anzeige. Ist für die bevorzugte Größe kein Ziel gesetzt,
 * wird auf die andere ausgewichen (und das kenntlich gemacht) – es wird nichts geschätzt.
 */
export function primaryProgress(
  p: SportWeekProgress,
  preferred: PrimaryMetric,
): { metric: PrimaryMetric; progress: MetricProgress; isFallback: boolean } {
  const pick = (m: PrimaryMetric) => (m === 'duration' ? p.duration : p.distance);
  if (pick(preferred).planned !== null) return { metric: preferred, progress: pick(preferred), isFallback: false };
  const other: PrimaryMetric = preferred === 'duration' ? 'distance' : 'duration';
  if (pick(other).planned !== null) return { metric: other, progress: pick(other), isFallback: true };
  return { metric: preferred, progress: pick(preferred), isFallback: false };
}

export function isPlannedSport(s: Sport): s is PlannedSport {
  return (PLANNED_SPORTS as readonly string[]).includes(s);
}

export interface FocusProgress {
  focusId: string;
  planned: number;
  done: number;
}

/**
 * Erledigte Trainingsschwerpunkte einer Woche. Eine Einheit zählt für einen Schwerpunkt, wenn sie
 * ihm ausdrücklich zugeordnet wurde. Einheiten ohne Zuordnung zählen für den ersten noch offenen
 * Schwerpunkt mit gleicher Sportart und gleichem Fokus. Jede Einheit zählt höchstens einmal.
 */
export function computeFocusProgress(
  focuses: readonly Pick<PlannedSessionFocus, 'id' | 'sport' | 'focus' | 'count'>[],
  activities: readonly Pick<CompletedActivity, 'sport' | 'focus' | 'plannedFocusId'>[],
): FocusProgress[] {
  const result = focuses.map((f) => ({ focusId: f.id, planned: f.count, done: 0 }));
  const byId = new Map(result.map((r) => [r.focusId, r]));
  const unlinked: typeof activities[number][] = [];
  for (const a of activities) {
    const r = a.plannedFocusId ? byId.get(a.plannedFocusId) : undefined;
    if (r) r.done += 1;
    else unlinked.push(a);
  }
  for (const a of unlinked) {
    const idx = focuses.findIndex((f, i) => f.sport === a.sport && f.focus === a.focus && (result[i]?.done ?? 0) < f.count);
    const r = idx >= 0 ? result[idx] : undefined;
    if (r) r.done += 1;
  }
  return result;
}
