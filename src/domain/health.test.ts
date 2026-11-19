import { describe, expect, it } from 'vitest';
import {
  isSportPaused,
  pausedDaysInWeek,
  painIssueTitle,
  proposePauseAdjustment,
  recurringRegions,
  summarizeIssue,
} from './health';
import type { PainIssue, PainObservation, TrainingPause, WeekTargets } from './schemas';

const issue = (id: string, region: PainIssue['region'], side?: PainIssue['side']): PainIssue => ({
  id, region, ...(side ? { side } : {}), sports: ['run'], status: 'active', startDate: '2026-11-10', createdAt: 't', updatedAt: 't',
});
const obs = (issueId: string, date: string, pain: number): PainObservation => ({ id: `${issueId}${date}`, issueId, date, pain, createdAt: date });
const pause = (p: Partial<TrainingPause>): TrainingPause => ({
  id: 'p', scope: 'sports', sports: ['run'], startDate: '2026-11-18', createdAt: 't', updatedAt: 't', ...p,
});

const targets: WeekTargets = {
  sports: [
    { sport: 'swim', distanceM: 6000 },
    { sport: 'bike', durationSec: 7 * 3600 },
    { sport: 'run', distanceM: 35_000, durationSec: 7 * 3600, sessions: 4, zoneSec: { z2: 7 * 3600 } },
  ],
  focuses: [{ id: 'f', sport: 'run', focus: 'vo2max', count: 1 }],
};

describe('Beschwerden', () => {
  it('Verlauf: chronologisch, letzter Wert, Maximum, Veränderung', () => {
    const s = summarizeIssue(issue('a', 'knee', 'left'), [obs('a', '2026-11-12', 5), obs('a', '2026-11-10', 3), obs('a', '2026-11-14', 2), obs('b', '2026-11-11', 9)]);
    expect(s.observations.map((o) => o.pain)).toEqual([3, 5, 2]);
    expect(s.latest?.pain).toBe(2);
    expect(s.maxPain).toBe(5);
    expect(s.change).toBe(-3);
  });

  it('wiederholt betroffene Körperstellen (gleiche Seite)', () => {
    const r = recurringRegions([issue('1', 'knee', 'left'), issue('2', 'knee', 'left'), issue('3', 'knee', 'right'), issue('4', 'achilles')]);
    expect(r).toEqual([{ key: 'knee:left', title: 'Knie links', count: 2 }]);
  });

  it('Titel', () => {
    expect(painIssueTitle({ region: 'achilles', side: 'right' })).toBe('Achillessehne rechts');
    expect(painIssueTitle({ region: 'other', description: 'Rippen\nbeim Atmen' })).toBe('Rippen');
  });
});

describe('Pausen', () => {
  it('gilt nur für betroffene Sportarten und Zeitraum; offenes Ende', () => {
    const p = pause({ endDate: '2026-11-20' });
    expect(isSportPaused([p], 'run', '2026-11-19')).not.toBeNull();
    expect(isSportPaused([p], 'bike', '2026-11-19')).toBeNull();
    expect(isSportPaused([p], 'run', '2026-11-21')).toBeNull();
    expect(isSportPaused([pause({ scope: 'all', sports: [] })], 'swim', '2027-03-01')).not.toBeNull();
  });

  it('pausierte Tage je Woche', () => {
    const p = pause({ startDate: '2026-11-18', endDate: '2026-11-25' });
    expect(pausedDaysInWeek(p, '2026-11-16')).toBe(5); // Mi–So
    expect(pausedDaysInWeek(p, '2026-11-23')).toBe(3); // Mo–Mi
    expect(pausedDaysInWeek(p, '2026-11-30')).toBe(0);
    expect(pausedDaysInWeek(pause({}), '2026-11-16')).toBeNull();
  });

  it('Testfall 5: Vorschlag kürzt nur betroffene Wochen/Sportarten anteilig und holt nichts nach', () => {
    const p = pause({ startDate: '2026-11-18', endDate: '2026-11-25' });
    const weeks = ['2026-11-16', '2026-11-23', '2026-11-30'].map((weekStart) => ({ weekStart, current: targets }));
    const changes = proposePauseAdjustment(p, weeks);
    expect(changes.map((c) => c.weekStart)).toEqual(['2026-11-16', '2026-11-23']);
    const w1 = changes[0]!.after.sports.find((s) => s.sport === 'run')!;
    expect(w1.distanceM).toBe(10_000); // 35 km × 2/7
    expect(w1.durationSec).toBe(2 * 3600);
    expect(w1.sessions).toBe(1); // floor(4 × 2/7)
    expect(changes[1]!.after.sports.find((s) => s.sport === 'run')!.distanceM).toBe(20_000);
    // Andere Sportarten unverändert, nirgends eine Erhöhung
    for (const c of changes) {
      expect(c.after.sports.find((s) => s.sport === 'bike')).toEqual(targets.sports[1]);
      for (const s of c.after.sports) {
        const b = c.before.sports.find((x) => x.sport === s.sport)!;
        expect((s.durationSec ?? 0) <= (b.durationSec ?? 0)).toBe(true);
        expect((s.distanceM ?? 0) <= (b.distanceM ?? 0)).toBe(true);
      }
    }
  });

  it('volle Pausenwoche: Ziele 0, Schwerpunkte der Sportart entfernt', () => {
    const p = pause({ scope: 'all', sports: [], startDate: '2026-11-16', endDate: '2026-11-22' });
    const [c] = proposePauseAdjustment(p, [{ weekStart: '2026-11-16', current: targets }]);
    expect(c!.after.sports.every((s) => (s.durationSec ?? 0) === 0 && (s.distanceM ?? 0) === 0)).toBe(true);
    expect(c!.after.focuses).toHaveLength(0);
  });

  it('ohne Enddatum kein Vorschlag', () => {
    expect(proposePauseAdjustment(pause({}), [{ weekStart: '2026-11-16', current: targets }])).toEqual([]);
  });
});
