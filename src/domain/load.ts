/**
 * Subjektive Trainingsbelastung (Session-RPE-Methode nach Foster et al.):
 * Session Load = Dauer in Minuten × Session-RPE (CR-10).
 *
 * Wird nur berechnet, wenn ein RPE-Wert vorliegt. Fehlende Werte werden nicht geschätzt;
 * stattdessen wird die Datenvollständigkeit ausgewiesen.
 */
import type { ActivityLike } from './progress';

export function sessionLoad(a: Pick<ActivityLike, 'durationSec' | 'rpe'>): number | null {
  if (a.rpe === undefined) return null;
  return (a.durationSec / 60) * a.rpe;
}

export interface LoadSummary {
  /** Summe der Session Loads aller Einheiten mit RPE (beliebige Einheit "AU"). */
  load: number;
  withRpe: number;
  total: number;
  /** Anteil der Einheiten mit RPE (0…1); null, wenn keine Einheiten vorhanden. */
  completeness: number | null;
}

export function summarizeLoad(activities: readonly Pick<ActivityLike, 'durationSec' | 'rpe'>[]): LoadSummary {
  let load = 0;
  let withRpe = 0;
  for (const a of activities) {
    const l = sessionLoad(a);
    if (l !== null) {
      load += l;
      withRpe += 1;
    }
  }
  return {
    load,
    withRpe,
    total: activities.length,
    completeness: activities.length === 0 ? null : withRpe / activities.length,
  };
}
