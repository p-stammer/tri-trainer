import { describe, expect, it } from 'vitest';
import { complianceSummary, weekCompliance, analysisWeeks, compareToTarget, focusCounts, otherActivitySummary, periodWeekStarts, trailingMean, zoneSummary } from './analytics';
import type { CompletedActivity, TrainingWeek } from './schemas';

const act = (id: string, p: Partial<CompletedActivity> & Pick<CompletedActivity, 'sport' | 'date' | 'durationSec'>): CompletedActivity => ({
  id, focus: 'endurance', createdAt: 't', updatedAt: 't', ...p,
});

describe('Analysen', () => {
  it('Zeiträume', () => {
    expect(periodWeekStarts('week', '2026-11-18', '2026-11-02', '2027-06-27')).toEqual(['2026-11-16']);
    expect(periodWeekStarts('4w', '2026-11-18', '2026-11-02', '2027-06-27')).toEqual(['2026-10-26', '2026-11-02', '2026-11-09', '2026-11-16']);
    expect(periodWeekStarts('plan', '2026-11-18', '2026-11-04', '2027-06-27')).toEqual(['2026-11-02', '2026-11-09', '2026-11-16']);
    expect(periodWeekStarts('plan', '2026-10-01', '2026-11-04', '2027-06-27')).toEqual(['2026-09-28']);
  });

  it('Soll-Ist nur über Wochen mit Ziel; Ist insgesamt separat', () => {
    const weeks: Pick<TrainingWeek, 'weekStart' | 'current'>[] = [
      { weekStart: '2026-11-02', current: { sports: [{ sport: 'run', distanceM: 30000 }], focuses: [] } },
      { weekStart: '2026-11-09', current: { sports: [], focuses: [] } },
    ];
    const acts = [
      act('a', { sport: 'run', date: '2026-11-03', durationSec: 3600, distanceM: 24000 }),
      act('b', { sport: 'run', date: '2026-11-10', durationSec: 3600, distanceM: 10000 }),
    ];
    const rows = analysisWeeks(['2026-11-02', '2026-11-09'], weeks, acts, []);
    const c = compareToTarget(rows, 'run', 'distance');
    expect(c.doneAll).toBe(34000);
    expect(c.planned).toBe(30000);
    expect(c.doneInPlannedWeeks).toBe(24000);
    expect(c.ratio).toBeCloseTo(0.8, 6);
    expect(c.weeksWithTarget).toBe(1);
    expect(compareToTarget(rows, 'bike', 'duration').planned).toBeNull();
  });

  it('Sonstiges / Cardio: eigene Wochensumme, Gruppen nach Bezeichnung, zählt zur Gesamtzeit', () => {
    const acts = [
      act('a', { sport: 'other', date: '2026-11-03', durationSec: 3 * 3600, label: 'Wandern' }),
      act('b', { sport: 'other', date: '2026-11-04', durationSec: 2 * 3600, label: 'wandern' }),
      act('c', { sport: 'other', date: '2026-11-10', durationSec: 1800, label: 'Rudern' }),
      act('d', { sport: 'other', date: '2026-11-11', durationSec: 600 }),
      act('e', { sport: 'run', date: '2026-11-03', durationSec: 3600 }),
      act('f', { sport: 'other', date: '2026-10-20', durationSec: 9999, label: 'Alt' }),
    ];
    const rows = analysisWeeks(['2026-11-02', '2026-11-09'], [], acts, []);
    expect(rows.map((r) => r.otherSec)).toEqual([5 * 3600, 2400]);
    expect(rows[0]?.totalSec).toBe(6 * 3600);
    const o = otherActivitySummary(acts, ['2026-11-02', '2026-11-09']);
    expect(o.count).toBe(4);
    expect(o.durationSec).toBe(5 * 3600 + 2400);
    expect(o.byLabel.map((g) => [g.label, g.count])).toEqual([['Wandern', 2], ['Rudern', 1], ['ohne Angabe', 1]]);
  });

  it('Zonen: unbekannte Zeit und Anteil mit Zonenangabe', () => {
    const acts = [
      act('a', { sport: 'bike', date: '2026-11-03', durationSec: 3600, zoneSec: { z2: 1800, z4: 1200 } }),
      act('b', { sport: 'bike', date: '2026-11-04', durationSec: 3600 }),
    ];
    const z = zoneSummary(analysisWeeks(['2026-11-02'], [], acts, []), 'bike');
    expect(z.done.z2).toBe(1800);
    expect(z.done.z4).toBe(1200);
    expect(z.unknownSec).toBe(4200);
    expect(z.knownShare).toBeCloseTo(3000 / 7200, 6);
    expect(z.planned).toBeNull();
  });

  it('Fokus-Zählung und gleitender Mittelwert mit Lücken', () => {
    const acts = [
      act('a', { sport: 'run', date: '2026-11-03', durationSec: 1800, focus: 'vo2max' }),
      act('b', { sport: 'run', date: '2026-11-05', durationSec: 1800, focus: 'vo2max' }),
      act('c', { sport: 'run', date: '2026-10-20', durationSec: 1800, focus: 'long' }),
    ];
    expect(focusCounts(acts, ['2026-11-02']).get('run')?.get('vo2max')).toBe(2);
    expect(focusCounts(acts, ['2026-11-02']).get('run')?.get('long')).toBeUndefined();
    expect(trailingMean([100, null, 200, 300, 400], 3)).toEqual([100, 100, 150, 250, 300]);
    expect(trailingMean([null, null], 4)).toEqual([null, null]);
  });

  it('Belastung je Sportart und Planerfüllung je Woche', () => {
    const weeks = [
      { weekStart: '2026-11-02', current: { sports: [{ sport: 'run' as const, durationSec: 3600 }, { sport: 'bike' as const, durationSec: 3 * 3600 }], focuses: [] } },
      { weekStart: '2026-11-09', current: { sports: [{ sport: 'run' as const, durationSec: 3600 }, { sport: 'strength' as const, sessions: 2 }], focuses: [] } },
    ];
    const acts = [
      act('a', { sport: 'run', date: '2026-11-03', durationSec: 3600, rpe: 4 }),
      act('b', { sport: 'bike', date: '2026-11-04', durationSec: 2 * 3600, rpe: 3 }),
      act('c', { sport: 'other', date: '2026-11-05', durationSec: 3600, rpe: 2 }),
      act('d', { sport: 'run', date: '2026-11-10', durationSec: 1800 }),
    ];
    const rows = analysisWeeks(['2026-11-02', '2026-11-09'], weeks, acts, []);
    expect(rows[0]!.loadBySport).toMatchObject({ run: 240, bike: 360, other: 120, swim: 0 });
    expect(weekCompliance(rows[0]!, 'all')).toBeCloseTo(3 / 4, 6); // Sonstiges zählt nicht
    expect(weekCompliance(rows[1]!, 'all')).toBeNull(); // Kraft ohne Dauerziel
    expect(weekCompliance(rows[1]!, 'run')).toBeCloseTo(0.5, 6);
    expect(weekCompliance(rows[1]!, 'strength')).toBe(0);
    expect(weekCompliance(rows[1]!, 'swim')).toBeNull();
    expect(complianceSummary([0.95, 0.8, 0.5, null])).toEqual({ weeks: 3, high: 1, mid: 1, low: 1, mean: (0.95 + 0.8 + 0.5) / 3 });
  });
});
