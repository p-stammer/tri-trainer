/**
 * Sammeländerungen am Plan und Änderungshistorie. Reine Funktionen: Sie berechnen Vorschläge
 * (Vorher/Nachher je Woche); übernommen wird erst nach Bestätigung im Anwendungsfall.
 */
import { copyWeekTargets, scaleWeekTargets } from './plan';
import type { PhaseType, PlannedSport } from './sports';
import type { PlanChange, TrainingWeek, WeekTargets } from './schemas';

export interface PlanWeekChange {
  weekStart: string;
  before: WeekTargets;
  after: WeekTargets;
}

/** Kanonische Darstellung (sortierte Schlüssel, ohne undefined) für Vergleiche unabhängig von Feldreihenfolge. */
export function canonical(value: unknown): string {
  const norm = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(norm);
    if (v && typeof v === 'object') {
      const out: Record<string, unknown> = {};
      for (const k of Object.keys(v as Record<string, unknown>).sort()) {
        const x = (v as Record<string, unknown>)[k];
        if (x !== undefined) out[k] = norm(x);
      }
      return out;
    }
    return v;
  };
  return JSON.stringify(norm(value));
}

export function sameTargets(a: WeekTargets | undefined, b: WeekTargets | undefined): boolean {
  return canonical(a) === canonical(b);
}

type W = Pick<TrainingWeek, 'weekStart' | 'current'>;

function collect(weeks: readonly W[], fn: (t: WeekTargets) => WeekTargets): PlanWeekChange[] {
  const out: PlanWeekChange[] = [];
  for (const w of weeks) {
    const after = fn(w.current);
    if (!sameTargets(after, w.current)) out.push({ weekStart: w.weekStart, before: w.current, after });
  }
  return out;
}

export function bulkSetPhase(weeks: readonly W[], phase: PhaseType | undefined): PlanWeekChange[] {
  return collect(weeks, (t) => {
    const next = { ...t };
    delete next.phase;
    if (phase) next.phase = phase;
    return next;
  });
}

export function bulkScale(weeks: readonly W[], factor: number, sports?: readonly PlannedSport[]): PlanWeekChange[] {
  return collect(weeks, (t) => scaleWeekTargets(t, factor, sports));
}

/** Übernimmt die Ziele einer Quellwoche in die ausgewählten Wochen (die Quelle selbst bleibt unverändert). */
export function bulkCopyFrom(weeks: readonly W[], source: W): PlanWeekChange[] {
  return collect(
    weeks.filter((w) => w.weekStart !== source.weekStart),
    () => copyWeekTargets(source.current),
  );
}

export function bulkSetFreshness(weeks: readonly W[], target: { min: number; max: number } | undefined): PlanWeekChange[] {
  return collect(weeks, (t) => {
    const next = { ...t };
    delete next.freshnessTarget;
    if (target) next.freshnessTarget = { min: Math.min(target.min, target.max), max: Math.max(target.min, target.max) };
    return next;
  });
}

/**
 * Darf eine Änderung rückgängig gemacht werden? Nur wenn alle betroffenen Wochen noch genau
 * den Stand nach der Änderung haben – sonst würden spätere Änderungen stillschweigend überschrieben.
 */
export function canUndo(change: Pick<PlanChange, 'weeks'>, current: readonly W[]): boolean {
  return change.weeks.every((c) => {
    const w = current.find((x) => x.weekStart === c.weekStart);
    return !!w && sameTargets(w.current, c.after);
  });
}

export function undoChanges(change: Pick<PlanChange, 'weeks'>): PlanWeekChange[] {
  return change.weeks.map((c) => ({ weekStart: c.weekStart, before: c.after, after: c.before }));
}
