/** Wettkampf-Kalender: Countdown, Trainingswoche, Fortschritt. */
import { compareDates, diffDays, isoWeek, startOfWeek, type LocalDate } from './calendar';
import type { RaceDistancePreset } from './schemas';

export const RACE_PRESETS: Record<Exclude<RaceDistancePreset, 'custom'>, { label: string; swimM: number; bikeM: number; runM: number }> = {
  full: { label: 'Langdistanz (Ironman)', swimM: 3800, bikeM: 180_000, runM: 42_195 },
  half: { label: 'Mitteldistanz (70.3)', swimM: 1900, bikeM: 90_000, runM: 21_097.5 },
  olympic: { label: 'Olympische Distanz', swimM: 1500, bikeM: 40_000, runM: 10_000 },
  sprint: { label: 'Sprintdistanz', swimM: 750, bikeM: 20_000, runM: 5000 },
};

export type RaceStatus = 'before-prep' | 'in-prep' | 'race-week' | 'race-day' | 'past';

export interface RaceCalendar {
  /** Tage bis zum Wettkampf (0 = heute ist Wettkampftag, negativ = vorbei). */
  daysUntil: number;
  currentWeekStart: LocalDate;
  raceWeekStart: LocalDate;
  prepWeekStart: LocalDate;
  calendarWeek: { year: number; week: number };
  /** 1-basierte Trainingswoche seit Vorbereitungsbeginn; null vor Beginn bzw. nach dem Wettkampf. */
  trainingWeek: number | null;
  /** Gesamtzahl Trainingswochen inkl. Wettkampfwoche. */
  totalWeeks: number;
  /** Verbleibende Wochen inkl. aktueller Woche und Wettkampfwoche (0 nach dem Wettkampf). */
  remainingWeeks: number;
  /** Zeitlicher Fortschritt 0…1 vom Vorbereitungsbeginn bis zum Wettkampftag. */
  progress: number;
  status: RaceStatus;
}

export function raceCalendar(race: { date: LocalDate; prepStartDate: LocalDate }, todayDate: LocalDate): RaceCalendar {
  const currentWeekStart = startOfWeek(todayDate);
  const raceWeekStart = startOfWeek(race.date);
  const prepWeekStart = startOfWeek(race.prepStartDate);
  const daysUntil = diffDays(todayDate, race.date);
  const totalWeeks = diffDays(prepWeekStart, raceWeekStart) / 7 + 1;

  const weeksSincePrep = diffDays(prepWeekStart, currentWeekStart) / 7;
  const inRange = compareDates(currentWeekStart, prepWeekStart) >= 0 && compareDates(currentWeekStart, raceWeekStart) <= 0;
  const trainingWeek = inRange && daysUntil >= 0 ? weeksSincePrep + 1 : null;

  const remainingWeeks = daysUntil < 0 ? 0 : Math.max(0, diffDays(currentWeekStart, raceWeekStart) / 7 + 1);

  const totalDays = diffDays(race.prepStartDate, race.date);
  const elapsed = diffDays(race.prepStartDate, todayDate);
  const progress = totalDays <= 0 ? (daysUntil <= 0 ? 1 : 0) : Math.min(1, Math.max(0, elapsed / totalDays));

  let status: RaceStatus;
  if (daysUntil < 0) status = 'past';
  else if (daysUntil === 0) status = 'race-day';
  else if (currentWeekStart === raceWeekStart) status = 'race-week';
  else if (compareDates(todayDate, race.prepStartDate) < 0) status = 'before-prep';
  else status = 'in-prep';

  return {
    daysUntil,
    currentWeekStart,
    raceWeekStart,
    prepWeekStart,
    calendarWeek: isoWeek(todayDate),
    trainingWeek,
    totalWeeks,
    remainingWeeks,
    progress,
    status,
  };
}
