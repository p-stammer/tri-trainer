import { describe, expect, it } from 'vitest';
import { assessFreshness, freshnessChange, needsAttention, weeklyHealthRows } from './wellness';
import type { CompletedActivity, WeeklyWellnessCheckin } from './schemas';

const ci = (weekStart: string, freshness: number): WeeklyWellnessCheckin => ({
  id: weekStart, weekStart, date: weekStart, freshness, createdAt: 't', updatedAt: 't',
});

describe('Frische', () => {
  it('Testfall 7: Wert unter dem Zielbereich wird erkannt (Ziel 6–8, Ist 3)', () => {
    const a = assessFreshness(3, { min: 6, max: 8 });
    expect(a.status).toBe('below');
    expect(a.deviation).toBe(-3);
    expect(needsAttention(a, false)).toBe('low');
    expect(needsAttention(a, true)).toBeNull();
  });

  it('innerhalb und oberhalb des Zielbereichs', () => {
    expect(assessFreshness(7, { min: 6, max: 8 }).status).toBe('within');
    expect(needsAttention(assessFreshness(7, { min: 6, max: 8 }), false)).toBeNull();
    const high = assessFreshness(10, { min: 4, max: 6 });
    expect(high.status).toBe('above');
    expect(needsAttention(high, false)).toBe('high');
  });

  it('ohne Zielbereich nur bei auffälligen Werten ein Hinweis', () => {
    expect(needsAttention(assessFreshness(5, null), false)).toBeNull();
    expect(needsAttention(assessFreshness(3, null), false)).toBe('low');
    expect(needsAttention(assessFreshness(9, undefined), false)).toBe('high');
  });

  it('Veränderung zum Vorwert', () => {
    const list = [ci('2026-11-16', 4), ci('2026-11-02', 7), ci('2026-11-09', 6)];
    expect(freshnessChange(list, '2026-11-16')).toBe(-2);
    expect(freshnessChange(list, '2026-11-02')).toBeNull();
  });

  it('Wochenübersicht: Belastung nur aus vorhandenen RPE-Werten, neueste Woche zuerst', () => {
    const acts: CompletedActivity[] = [
      { id: 'a', sport: 'run', date: '2026-11-17', durationSec: 3600, focus: 'endurance', rpe: 5, createdAt: 't', updatedAt: 't' },
      { id: 'b', sport: 'bike', date: '2026-11-18', durationSec: 1800, focus: 'endurance', createdAt: 't', updatedAt: 't' },
    ];
    const rows = weeklyHealthRows(
      ['2026-11-09', '2026-11-16'],
      [{ weekStart: '2026-11-16', current: { sports: [], focuses: [], freshnessTarget: { min: 6, max: 8 } } }],
      acts,
      [ci('2026-11-16', 3)],
    );
    expect(rows[0]?.weekStart).toBe('2026-11-16');
    expect(rows[0]?.durationSec).toBe(5400);
    expect(rows[0]?.load.load).toBe(300);
    expect(rows[0]?.load.withRpe).toBe(1);
    expect(rows[0]?.assessment?.status).toBe('below');
    expect(rows[1]?.checkin).toBeNull();
  });
});
