/**
 * Beschwerden und Trainingspausen.
 * Grundsätze: keine Diagnosen, keine Kausalaussagen aus Zeitreihen, keine automatische
 * Nachholbelastung. Planänderungen entstehen nur als Vorschlag, der bestätigt werden muss.
 */
import { addDays, compareDates, diffDays, type LocalDate } from './calendar';
import { scaleWeekTargets } from './plan';
import type { BodyRegion, PainIssue, PainObservation, TrainingPause, TrainingWeek, WeekTargets } from './schemas';
import { PLANNED_SPORTS, type PlannedSport, type Sport } from './sports';

export const BODY_REGION_LABEL: Record<BodyRegion, string> = {
  foot: 'Fuß',
  ankle: 'Sprunggelenk',
  achilles: 'Achillessehne',
  calf: 'Wade',
  shin: 'Schienbein',
  knee: 'Knie',
  thigh_front: 'Oberschenkel vorne',
  thigh_back: 'Oberschenkel hinten',
  hip: 'Hüfte',
  groin: 'Leiste',
  lower_back: 'Unterer Rücken',
  upper_back: 'Oberer Rücken',
  neck: 'Nacken',
  shoulder: 'Schulter',
  elbow: 'Ellenbogen',
  wrist: 'Handgelenk',
  other: 'Andere Stelle',
};

export const SIDE_LABEL = { left: 'links', right: 'rechts', both: 'beidseitig' } as const;

export const PAIN_STATUS_LABEL: Record<PainIssue['status'], string> = {
  active: 'aktiv',
  improving: 'klingt ab',
  resolved: 'abgeklungen',
};

export function painIssueTitle(i: Pick<PainIssue, 'region' | 'side' | 'description'>): string {
  const base = i.region === 'other' && i.description ? i.description.split('\n')[0]!.slice(0, 40) : BODY_REGION_LABEL[i.region];
  return i.side ? `${base} ${SIDE_LABEL[i.side]}` : base;
}

export function isOpenIssue(i: Pick<PainIssue, 'status'>): boolean {
  return i.status !== 'resolved';
}

export interface PainSummary {
  issue: PainIssue;
  observations: PainObservation[]; // chronologisch
  latest: PainObservation | null;
  maxPain: number | null;
  /** Veränderung letzter gegenüber vorletztem Wert. */
  change: number | null;
}

export function summarizeIssue(issue: PainIssue, all: readonly PainObservation[]): PainSummary {
  const observations = all
    .filter((o) => o.issueId === issue.id)
    .sort((a, b) => (a.date === b.date ? a.createdAt.localeCompare(b.createdAt) : compareDates(a.date, b.date)));
  const latest = observations[observations.length - 1] ?? null;
  const prev = observations[observations.length - 2] ?? null;
  return {
    issue,
    observations,
    latest,
    maxPain: observations.length ? Math.max(...observations.map((o) => o.pain)) : null,
    change: latest && prev ? latest.pain - prev.pain : null,
  };
}

/** Körperstellen, die mehr als einmal als eigene Beschwerde dokumentiert wurden. */
export function recurringRegions(issues: readonly PainIssue[]): { key: string; title: string; count: number }[] {
  const map = new Map<string, { title: string; count: number }>();
  for (const i of issues) {
    if (i.region === 'other') continue;
    const key = `${i.region}:${i.side ?? ''}`;
    const e = map.get(key) ?? { title: painIssueTitle({ region: i.region, side: i.side }), count: 0 };
    e.count += 1;
    map.set(key, e);
  }
  return [...map.entries()]
    .filter(([, v]) => v.count >= 2)
    .map(([key, v]) => ({ key, ...v }))
    .sort((a, b) => b.count - a.count);
}

// ───────────────────────────── Pausen ─────────────────────────────

export function pauseCovers(p: Pick<TrainingPause, 'startDate' | 'endDate'>, date: LocalDate): boolean {
  return compareDates(date, p.startDate) >= 0 && (!p.endDate || compareDates(date, p.endDate) <= 0);
}

export function pauseAffectsSport(p: Pick<TrainingPause, 'scope' | 'sports'>, sport: Sport): boolean {
  return p.scope === 'all' || (p.sports as readonly string[]).includes(sport);
}

/** Pausen, die an `date` gelten. */
export function activePauses<T extends Pick<TrainingPause, 'startDate' | 'endDate'>>(pauses: readonly T[], date: LocalDate): T[] {
  return pauses.filter((p) => pauseCovers(p, date));
}

export function isSportPaused(pauses: readonly TrainingPause[], sport: Sport, date: LocalDate): TrainingPause | null {
  return pauses.find((p) => pauseCovers(p, date) && pauseAffectsSport(p, sport)) ?? null;
}

/** Anzahl pausierter Tage einer Pause innerhalb der Woche ab `weekStart` (0–7). Offenes Ende → null. */
export function pausedDaysInWeek(p: Pick<TrainingPause, 'startDate' | 'endDate'>, weekStart: LocalDate): number | null {
  if (!p.endDate) return null;
  const weekEnd = addDays(weekStart, 6);
  const from = compareDates(p.startDate, weekStart) > 0 ? p.startDate : weekStart;
  const to = compareDates(p.endDate, weekEnd) < 0 ? p.endDate : weekEnd;
  const days = diffDays(from, to) + 1;
  return Math.max(0, Math.min(7, days));
}

export interface WeekChange {
  weekStart: LocalDate;
  pausedDays: number;
  before: WeekTargets;
  after: WeekTargets;
}

/**
 * Vorschlag zur Planänderung für eine Pause mit Enddatum: Für jede betroffene Woche werden die Ziele
 * der pausierten Sportarten anteilig zu den pausierten Tagen gekürzt (7 von 7 Tagen → 0).
 *
 * Bewusst NICHT enthalten: Verschieben oder Nachholen des ausgefallenen Umfangs in andere Wochen.
 * Wochen außerhalb der Pause und nicht pausierte Sportarten bleiben unverändert.
 * Annahme (Heuristik): Umfang verteilt sich gleichmäßig über die Woche.
 */
export function proposePauseAdjustment(pause: TrainingPause, weeks: readonly Pick<TrainingWeek, 'weekStart' | 'current'>[]): WeekChange[] {
  if (!pause.endDate) return [];
  const sports: PlannedSport[] = pause.scope === 'all' ? [...PLANNED_SPORTS] : [...pause.sports];
  const changes: WeekChange[] = [];
  for (const w of weeks) {
    const days = pausedDaysInWeek(pause, w.weekStart);
    if (!days) continue;
    const factor = 1 - days / 7;
    let after = scaleWeekTargets(w.current, factor, sports);
    after = {
      ...after,
      sports: after.sports.map((s) =>
        sports.includes(s.sport) && s.sessions !== undefined ? { ...s, sessions: Math.floor(s.sessions * factor) } : s,
      ),
      focuses: factor === 0 ? after.focuses.filter((f) => !sports.includes(f.sport)) : after.focuses,
    };
    if (JSON.stringify(after) !== JSON.stringify(w.current)) {
      changes.push({ weekStart: w.weekStart, pausedDays: days, before: w.current, after });
    }
  }
  return changes;
}
