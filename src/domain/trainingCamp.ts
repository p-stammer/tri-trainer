/** Trainingslager (seit 0.21.0): Dauer, Hinweise beim Eintragen. Planung im Generator (engine/phases, engine/volume). */
import { compareDates, diffDays, formatDateDe, type LocalDate } from './calendar';
import type { TrainingCamp } from './schemas';

export function campDays(c: Pick<TrainingCamp, 'startDate' | 'endDate'>): number {
  return diffDays(c.startDate, c.endDate) + 1;
}

export type CampIssue =
  | { code: 'past' }
  | { code: 'after_race' }
  | { code: 'near_race'; days: number }
  | { code: 'overlap'; name: string }
  | { code: 'long'; days: number };

/** Hinweise; „near_race“: Camp endet weniger als 21 Tage vor dem Rennen (Taper – der Planer ignoriert es dann). */
export function campIssues(
  c: Pick<TrainingCamp, 'id' | 'startDate' | 'endDate'>,
  mainRaceDate: LocalDate,
  today: LocalDate,
  others: readonly Pick<TrainingCamp, 'id' | 'name' | 'startDate' | 'endDate'>[],
): CampIssue[] {
  const out: CampIssue[] = [];
  if (compareDates(c.endDate, today) < 0) out.push({ code: 'past' });
  if (compareDates(c.startDate, mainRaceDate) >= 0) out.push({ code: 'after_race' });
  else {
    const gap = diffDays(c.endDate, mainRaceDate);
    if (gap < 21) out.push({ code: 'near_race', days: gap });
  }
  const o = others.find((x) => x.id !== c.id && compareDates(x.startDate, c.endDate) <= 0 && compareDates(x.endDate, c.startDate) >= 0);
  if (o) out.push({ code: 'overlap', name: o.name });
  const d = campDays(c);
  if (d > 14) out.push({ code: 'long', days: d });
  return out;
}

export function campIssueText(i: CampIssue): string {
  switch (i.code) {
    case 'past':
      return 'Liegt in der Vergangenheit – wird bei neuen Planvorschlägen nicht berücksichtigt.';
    case 'after_race':
      return 'Liegt am oder nach dem Hauptwettkampf.';
    case 'near_race':
      return `Endet ${i.days} Tage vor dem Rennen – im Taper plant die App keinen Mehrumfang; das Camp wird dann nicht berücksichtigt.`;
    case 'overlap':
      return `Überschneidet sich mit „${i.name}“.`;
    case 'long':
      return `${i.days} Tage sind lang: Studien zu Trainingslagern untersuchen meist 1–2 Wochen. Achte besonders auf Frische und Beschwerden.`;
  }
}

/** Kurzbeschreibung der Wirkung im Planer. */
export function campEffectText(c: Pick<TrainingCamp, 'startDate' | 'endDate' | 'hoursPerDay'>): string {
  const d = campDays(c);
  return `${d} ${d === 1 ? 'Tag' : 'Tage'} mit bis zu ${c.hoursPerDay.toLocaleString('de-DE')} h pro Tag (${formatDateDe(c.startDate, false)} – ${formatDateDe(c.endDate, false)}). Der Planer erhöht vor allem Rad und Schwimmen (locker), Laufen bleibt bei der normalen Steigerung; danach folgt eine Erholungswoche.`;
}
