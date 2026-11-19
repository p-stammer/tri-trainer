/** Reine Funktionen für Trainingsplan-Wochen (manuelle Planung, Editor-Operationen). */
import { compareDates, weekStartsBetween, type LocalDate } from './calendar';
import { newId } from './ids';
import { PLANNED_SPORTS, ZONES, type PlannedSport } from './sports';
import type { TrainingWeek, WeekTargets, WeeklySportTarget } from './schemas';

export function emptyWeekTargets(): WeekTargets {
  return { sports: [], focuses: [] };
}

export function isEmptyTargets(t: WeekTargets): boolean {
  return (
    t.sports.every((s) => s.durationSec === undefined && s.distanceM === undefined && s.sessions === undefined && !s.zoneSec) &&
    t.focuses.length === 0 &&
    !t.phase &&
    !t.notes &&
    !t.freshnessTarget
  );
}

/** Alle Wochenanfänge des Plans: Woche des Vorbereitungsbeginns bis einschließlich Wettkampfwoche. */
export function planWeekStarts(prepStartDate: LocalDate, raceDate: LocalDate): LocalDate[] {
  return weekStartsBetween(prepStartDate, raceDate);
}

/**
 * Abgleich nach Änderung von Vorbereitungsbeginn oder Wettkampfdatum.
 * Es werden nur fehlende Wochen ergänzt. Wochen außerhalb des neuen Zeitraums werden
 * NICHT gelöscht, sondern gemeldet – so gehen weder Planwerte noch Historie verloren.
 */
export function reconcileWeeks(
  existing: readonly Pick<TrainingWeek, 'weekStart'>[],
  prepStartDate: LocalDate,
  raceDate: LocalDate,
): { missing: LocalDate[]; outside: LocalDate[] } {
  const wanted = planWeekStarts(prepStartDate, raceDate);
  const have = new Set(existing.map((w) => w.weekStart));
  const wantedSet = new Set(wanted);
  return {
    missing: wanted.filter((d) => !have.has(d)),
    outside: existing
      .map((w) => w.weekStart)
      .filter((d) => !wantedSet.has(d))
      .sort(compareDates),
  };
}

export function getSportTarget(t: WeekTargets, sport: PlannedSport): WeeklySportTarget | undefined {
  return t.sports.find((s) => s.sport === sport);
}

/** Ersetzt das Ziel einer Sportart (oder entfernt es, wenn `target` leer ist). Sortiert stabil. */
export function setSportTarget(t: WeekTargets, target: WeeklySportTarget): WeekTargets {
  const isEmpty =
    target.durationSec === undefined &&
    target.distanceM === undefined &&
    target.sessions === undefined &&
    (!target.zoneSec || ZONES.every((z) => target.zoneSec?.[z] === undefined));
  const others = t.sports.filter((s) => s.sport !== target.sport);
  const sports = isEmpty ? others : [...others, target];
  sports.sort((a, b) => PLANNED_SPORTS.indexOf(a.sport) - PLANNED_SPORTS.indexOf(b.sport));
  return { ...t, sports };
}

function roundTo(value: number, step: number): number {
  return Math.round(value / step) * step;
}

/**
 * Skaliert Umfangsziele proportional (z. B. 0,8 für eine Entlastungswoche).
 * Dauer wird auf Minuten, Distanz auf 100 m gerundet. Einheitenanzahlen bleiben unverändert,
 * weil sich eine Anzahl nicht sinnvoll proportional skalieren lässt.
 */
export function scaleWeekTargets(t: WeekTargets, factor: number, onlySports?: readonly PlannedSport[]): WeekTargets {
  if (!(factor >= 0) || !Number.isFinite(factor)) throw new Error('Ungültiger Skalierungsfaktor');
  const affects = (s: PlannedSport) => !onlySports || onlySports.includes(s);
  return {
    ...t,
    sports: t.sports.map((s) => {
      if (!affects(s.sport)) return s;
      const out: WeeklySportTarget = { ...s };
      if (s.durationSec !== undefined) out.durationSec = roundTo(s.durationSec * factor, 60);
      if (s.distanceM !== undefined) out.distanceM = roundTo(s.distanceM * factor, 100);
      if (s.zoneSec) {
        const z: NonNullable<WeeklySportTarget['zoneSec']> = {};
        for (const zone of ZONES) {
          const v = s.zoneSec[zone];
          if (v !== undefined) z[zone] = roundTo(v * factor, 60);
        }
        out.zoneSec = z;
      }
      return out;
    }),
  };
}

/** Tiefe Kopie mit neuen IDs für Schwerpunkte (für "Woche kopieren"). */
export function copyWeekTargets(t: WeekTargets): WeekTargets {
  const clone = structuredClone(t);
  clone.focuses = clone.focuses.map((f) => ({ ...f, id: newId() }));
  return clone;
}

/**
 * Speichert neue Zielwerte einer Woche. Der ursprüngliche Plan (`original`) bleibt erhalten;
 * existiert noch keiner, wird die erste gespeicherte Fassung zum ursprünglichen Plan.
 */
export function applyWeekTargets(week: TrainingWeek, next: WeekTargets, now: string): TrainingWeek {
  return {
    ...week,
    original: week.original ?? structuredClone(next),
    current: structuredClone(next),
    revision: week.revision + 1,
    updatedAt: now,
  };
}

/** Geplante Gesamtdauer – nur wenn JEDE Sportart mit Ziel ein Dauerziel hat, sonst null (keine Teilsumme als Gesamtwert). */
export function plannedDurationTotal(t: WeekTargets): number | null {
  if (t.sports.length === 0 || t.sports.some((s) => s.durationSec === undefined)) return null;
  return t.sports.reduce((sum, s) => sum + (s.durationSec ?? 0), 0);
}
