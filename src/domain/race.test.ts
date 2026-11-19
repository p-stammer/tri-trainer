import { describe, expect, it } from 'vitest';
import { raceCalendar } from './race';

const race = { date: '2027-07-04', prepStartDate: '2026-11-02' }; // Sonntag / Montag

describe('Wettkampf-Kalender', () => {
  it('berechnet Countdown, Trainingswoche und Restwochen', () => {
    const c = raceCalendar(race, '2026-11-16');
    expect(c.daysUntil).toBe(230);
    expect(c.trainingWeek).toBe(3);
    expect(c.raceWeekStart).toBe('2027-06-28');
    expect(c.totalWeeks).toBe(35);
    expect(c.remainingWeeks).toBe(33);
    expect(c.calendarWeek).toEqual({ year: 2026, week: 47 });
    expect(c.status).toBe('in-prep');
  });

  it('vor Vorbereitungsbeginn gibt es keine Trainingswoche', () => {
    const c = raceCalendar(race, '2026-10-20');
    expect(c.trainingWeek).toBeNull();
    expect(c.status).toBe('before-prep');
    expect(c.progress).toBe(0);
  });

  it('Wettkampfwoche, Wettkampftag und danach', () => {
    expect(raceCalendar(race, '2027-06-30').status).toBe('race-week');
    expect(raceCalendar(race, '2027-06-30').trainingWeek).toBe(35);
    const day = raceCalendar(race, '2027-07-04');
    expect(day.status).toBe('race-day');
    expect(day.progress).toBe(1);
    const after = raceCalendar(race, '2027-07-10');
    expect(after.status).toBe('past');
    expect(after.remainingWeeks).toBe(0);
    expect(after.trainingWeek).toBeNull();
  });

  it('über den Jahreswechsel korrekt', () => {
    const c = raceCalendar(race, '2027-01-01');
    expect(c.currentWeekStart).toBe('2026-12-28');
    expect(c.trainingWeek).toBe(9);
    expect(c.calendarWeek).toEqual({ year: 2026, week: 53 });
  });
});
