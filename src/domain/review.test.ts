import { describe, expect, it } from 'vitest';
import { reviewWeekFor, weekReview } from './review';
import type { WeekTargets } from './schemas';

const PM = { swim: 'duration', bike: 'duration', run: 'distance' } as const;
const targets: WeekTargets = {
  phase: 'base',
  sports: [
    { sport: 'run', durationSec: 3 * 3600, distanceM: 30000 },
    { sport: 'bike', durationSec: 5 * 3600 },
    { sport: 'strength', sessions: 2 },
  ],
  focuses: [
    { id: 'f1', sport: 'run', focus: 'long', count: 1 },
    { id: 'f2', sport: 'bike', focus: 'threshold', count: 1 },
  ],
};
const a = (sport: 'run' | 'bike' | 'strength' | 'other', date: string, h: number, extra: object = {}) => ({ sport, date, durationSec: h * 3600, ...extra });

describe('Wochenrückblick', () => {
  it('Montag bis Mittwoch für die Vorwoche, danach nicht', () => {
    expect(reviewWeekFor('2026-11-23')).toBe('2026-11-16');
    expect(reviewWeekFor('2026-11-25')).toBe('2026-11-16');
    expect(reviewWeekFor('2026-11-26')).toBeNull();
  });

  it('geplant gegen absolviert, Zielgröße je Sportart, Schlüsseleinheiten, RPE und Frische', () => {
    const acts = [
      a('run', '2026-11-17', 1, { distanceM: 10000, focus: 'endurance', rpe: 3 }),
      a('run', '2026-11-22', 1.5, { distanceM: 15000, focus: 'long', rpe: 5 }),
      a('bike', '2026-11-19', 4, { focus: 'endurance' }),
      a('strength', '2026-11-18', 0.75, { focus: 'strength' }),
      a('other', '2026-11-21', 2, { focus: 'other' }),
      a('run', '2026-11-24', 1, { distanceM: 10000 }), // nächste Woche
    ];
    const r = weekReview('2026-11-16', targets, acts, [{ weekStart: '2026-11-16', freshness: 6 }], [], PM)!;
    const run = r.sports.find((s) => s.sport === 'run')!;
    expect(run).toMatchObject({ metric: 'distance', planned: 30000, done: 25000 });
    expect(run.ratio).toBeCloseTo(25 / 30, 6);
    expect(r.sports.find((s) => s.sport === 'bike')).toMatchObject({ metric: 'duration', done: 4 * 3600 });
    expect(r.sports.find((s) => s.sport === 'strength')).toMatchObject({ metric: 'sessions', planned: 2, done: 1 });
    expect(r.focusesPlanned).toBe(2);
    expect(r.focusesDone).toBe(1);
    expect(r.rpeMean).toBe(4);
    expect(r.freshness).toBe(6);
    expect(r.otherSec).toBe(7200);
    expect(r.sessions).toBe(5);
    expect(r.totalRatio).toBeNull(); // Kraft ohne Dauerziel → keine Gesamtquote
  });

  it('ohne Ziele und ohne Einheiten kein Rückblick; offene Pause zählt bis Wochenende', () => {
    expect(weekReview('2026-11-16', undefined, [], [], [], PM)).toBeNull();
    const r = weekReview('2026-11-16', targets, [], [], [{ startDate: '2026-11-20' }], PM)!;
    expect(r.pausedDays).toBe(3);
  });
});
