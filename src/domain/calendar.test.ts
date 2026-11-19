import { describe, expect, it } from 'vitest';
import {
  addDays,
  diffDays,
  formatDateDe,
  isLocalDate,
  isoWeek,
  isoWeekday,
  isInWeek,
  localDateInTimeZone,
  startOfWeek,
  weekStartsBetween,
} from './calendar';

describe('calendar', () => {
  it('validiert Kalendertage inkl. Schaltjahr', () => {
    expect(isLocalDate('2026-11-16')).toBe(true);
    expect(isLocalDate('2028-02-29')).toBe(true);
    expect(isLocalDate('2026-02-29')).toBe(false);
    expect(isLocalDate('2026-13-01')).toBe(false);
    expect(isLocalDate('16.11.2026')).toBe(false);
  });

  it('Wochen beginnen montags', () => {
    expect(isoWeekday('2026-11-16')).toBe(1); // Montag
    expect(isoWeekday('2026-11-22')).toBe(7); // Sonntag
    expect(startOfWeek('2026-11-22')).toBe('2026-11-16');
    expect(startOfWeek('2026-11-16')).toBe('2026-11-16');
    expect(startOfWeek('2026-11-23')).toBe('2026-11-23');
  });

  it('Jahreswechsel: ISO-Kalenderwochen 2026/2027', () => {
    // 2026 beginnt an einem Donnerstag → 53 ISO-Wochen.
    expect(isoWeek('2026-01-01')).toEqual({ year: 2026, week: 1 });
    expect(isoWeek('2026-12-31')).toEqual({ year: 2026, week: 53 });
    expect(isoWeek('2027-01-03')).toEqual({ year: 2026, week: 53 });
    expect(isoWeek('2027-01-04')).toEqual({ year: 2027, week: 1 });
    // 2024-12-30 (Montag) gehört zu KW 1/2025.
    expect(isoWeek('2024-12-30')).toEqual({ year: 2025, week: 1 });
    expect(startOfWeek('2027-01-01')).toBe('2026-12-28');
  });

  it('Zeitumstellung verschiebt keine Tage', () => {
    // Sommerzeitbeginn 29.03.2026, Winterzeitbeginn 25.10.2026
    expect(diffDays('2026-03-28', '2026-03-30')).toBe(2);
    expect(diffDays('2026-10-24', '2026-10-26')).toBe(2);
    expect(addDays('2026-03-29', 1)).toBe('2026-03-30');
    expect(weekStartsBetween('2026-03-23', '2026-04-05')).toEqual(['2026-03-23', '2026-03-30']);
  });

  it('bestimmt "heute" in Europe/Berlin – auch kurz nach Mitternacht', () => {
    // 23:30 UTC am 16.11. = 00:30 MEZ am 17.11.
    expect(localDateInTimeZone(new Date('2026-11-16T23:30:00Z'), 'Europe/Berlin')).toBe('2026-11-17');
    // Sommerzeit: 22:30 UTC am 30.06. = 00:30 MESZ am 01.07.
    expect(localDateInTimeZone(new Date('2026-06-30T22:30:00Z'), 'Europe/Berlin')).toBe('2026-07-01');
    // Nacht der Umstellung
    expect(localDateInTimeZone(new Date('2026-03-29T00:30:00Z'), 'Europe/Berlin')).toBe('2026-03-29');
    expect(localDateInTimeZone(new Date('2026-10-24T22:30:00Z'), 'Europe/Berlin')).toBe('2026-10-25');
  });

  it('ordnet Tage der richtigen Woche zu', () => {
    expect(isInWeek('2026-11-22', '2026-11-16')).toBe(true);
    expect(isInWeek('2026-11-23', '2026-11-16')).toBe(false);
    expect(isInWeek('2026-11-15', '2026-11-16')).toBe(false);
  });

  it('formatiert deutsch', () => {
    expect(formatDateDe('2026-11-16')).toBe('Mo, 16.11.2026');
  });
});
