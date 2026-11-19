/** Hilfsfunktionen für den aktuellen Trainingsumfang (Baseline) aus dem Profil. */
import type { TrainingBaseline } from './schemas';
import { PLANNED_SPORTS } from './sports';

/** Entfernt leere Einträge; gibt undefined zurück, wenn nichts angegeben ist. */
export function cleanBaseline(b: TrainingBaseline | undefined): TrainingBaseline | undefined {
  if (!b) return undefined;
  const out: TrainingBaseline = {};
  for (const s of PLANNED_SPORTS) {
    const v = b[s];
    if (!v) continue;
    const c: NonNullable<TrainingBaseline['swim']> = {};
    if (v.distanceM !== undefined) c.distanceM = v.distanceM;
    if (v.durationSec !== undefined) c.durationSec = v.durationSec;
    if (v.sessions !== undefined) c.sessions = v.sessions;
    if (Object.keys(c).length) out[s] = c;
  }
  if (Object.keys(out).length === 0) return undefined;
  if (b.periodWeeks !== undefined) out.periodWeeks = b.periodWeeks;
  return out;
}

/** Summe der Stundenangaben – nur wenn für jede angegebene Sportart eine Dauer vorliegt. */
export function baselineTotalDuration(b: TrainingBaseline | undefined): number | null {
  const c = cleanBaseline(b);
  if (!c) return null;
  let total = 0;
  for (const s of PLANNED_SPORTS) {
    const v = c[s];
    if (!v) continue;
    if (v.durationSec === undefined) return null;
    total += v.durationSec;
  }
  return total;
}
