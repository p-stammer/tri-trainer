/** Vorbereitungswettkämpfe: Vorlagen, Einstufung für den Generator (PLAN_MODEL 4.2 Punkt 5), Plausibilitätshinweise. */
import { compareDates, diffDays, type LocalDate } from './calendar';
import type { PrepRace, PrepRaceKind, PrepRacePriority } from './schemas';

export type PrepRaceSize = 'short' | 'medium' | 'long';

export interface PrepRacePreset {
  label: string;
  kind: PrepRaceKind;
  swimM?: number;
  bikeM?: number;
  runM?: number;
}

export const PREP_RACE_PRESETS: Record<string, PrepRacePreset> = {
  tri_sprint: { label: 'Triathlon Sprint', kind: 'triathlon', swimM: 750, bikeM: 20_000, runM: 5000 },
  tri_olympic: { label: 'Triathlon olympisch', kind: 'triathlon', swimM: 1500, bikeM: 40_000, runM: 10_000 },
  tri_half: { label: 'Mitteldistanz (70.3)', kind: 'triathlon', swimM: 1900, bikeM: 90_000, runM: 21_097.5 },
  run_10k: { label: '10-km-Lauf', kind: 'run', runM: 10_000 },
  run_half: { label: 'Halbmarathon', kind: 'run', runM: 21_097.5 },
  run_marathon: { label: 'Marathon', kind: 'run', runM: 42_195 },
  bike_long: { label: 'Radmarathon / RTF', kind: 'bike', bikeM: 150_000 },
  swim_long: { label: 'Freiwasser-Langstrecke', kind: 'swim', swimM: 3800 },
};

export const PREP_RACE_KIND_LABEL: Record<PrepRaceKind, string> = {
  triathlon: 'Triathlon',
  run: 'Lauf',
  bike: 'Rad',
  swim: 'Schwimmen',
  other: 'Sonstiges',
};

export const PREP_RACE_PRIORITY_LABEL: Record<PrepRacePriority, string> = {
  low: 'Trainingswettkampf',
  medium: 'wichtig',
  high: 'Saisonhöhepunkt',
};

export const PREP_RACE_PRIORITY_HINT: Record<PrepRacePriority, string> = {
  low: 'Kein Taper. Kurze Rennen ersetzen nur eine Einheit; nach langen Rennen trotzdem etwas Erholung.',
  medium: 'Leicht reduzierte Rennwoche, kurze Erholung danach.',
  high: 'Mini-Taper vor dem Rennen und Erholungswoche danach.',
};

export const PREP_RACE_SIZE_LABEL: Record<PrepRaceSize, string> = {
  short: 'kurz',
  medium: 'mittel',
  long: 'lang',
};

/**
 * Einstufung nach PLAN_MODEL 4.2 Punkt 5:
 * kurz = Lauf ≤ 10 km, Sprint/olympisch; mittel = Halbmarathon, Rad-/Schwimm-Langstrecke; lang = 70.3, Marathon.
 * Grenzen: Lauf > 12 km mittel, > 25 km lang; Triathlon mit Lauf ≥ 15 km oder Rad ≥ 60 km lang; Rad ≥ 100 km bzw. Schwimmen ≥ 3 km mittel.
 * „Sonstiges“ ohne Distanz zählt als mittel (vorsichtiger als kurz).
 */
export function prepRaceSize(r: Pick<PrepRace, 'kind' | 'swimM' | 'bikeM' | 'runM'>): PrepRaceSize {
  const run = r.runM ?? 0;
  const bike = r.bikeM ?? 0;
  const swim = r.swimM ?? 0;
  if (r.kind === 'triathlon') return run >= 15_000 || bike >= 60_000 ? 'long' : 'short';
  if (run > 25_000) return 'long';
  if (run > 12_000) return 'medium';
  if (bike >= 100_000 || swim >= 3000) return 'medium';
  if (r.kind === 'other' && run + bike + swim === 0) return 'medium';
  return 'short';
}

export type PrepRaceIssue =
  | { code: 'in_past' }
  | { code: 'after_main_race' }
  | { code: 'close_to_main_race'; days: number }
  | { code: 'same_week'; otherName: string };

/** Hinweise (keine Fehler): das Speichern bleibt erlaubt. */
export function prepRaceIssues(
  r: Pick<PrepRace, 'id' | 'date'>,
  mainRaceDate: LocalDate,
  today: LocalDate,
  others: readonly Pick<PrepRace, 'id' | 'date' | 'name'>[],
): PrepRaceIssue[] {
  const issues: PrepRaceIssue[] = [];
  if (compareDates(r.date, today) < 0) issues.push({ code: 'in_past' });
  const days = diffDays(r.date, mainRaceDate);
  if (days <= 0) issues.push({ code: 'after_main_race' });
  else if (days < 21) issues.push({ code: 'close_to_main_race', days });
  for (const o of others) {
    if (o.id === r.id) continue;
    if (Math.abs(diffDays(o.date, r.date)) < 7) {
      issues.push({ code: 'same_week', otherName: o.name });
      break;
    }
  }
  return issues;
}

export function prepRaceIssueText(i: PrepRaceIssue): string {
  switch (i.code) {
    case 'in_past':
      return 'Liegt in der Vergangenheit – zählt für künftige Planvorschläge nicht mehr.';
    case 'after_main_race':
      return 'Liegt am oder nach dem Hauptwettkampf – wird vom Planer ignoriert.';
    case 'close_to_main_race':
      return `Nur ${i.days} Tage vor dem Hauptwettkampf – fällt in den Taper; der Planer reduziert dort ohnehin.`;
    case 'same_week':
      return `Weniger als eine Woche Abstand zu „${i.otherName}“ – zwei Rennen kurz hintereinander kosten viel Erholung.`;
  }
}
