import { describe, expect, it } from 'vitest';
import { generatePlan } from './generate';
import { campBudgetSec } from './volume';
import { input, profile } from './fixtures.test-helper';
import type { TrainingCamp } from '../domain/schemas';

const camp = (o: Partial<TrainingCamp> = {}): TrainingCamp => ({
  id: 'c1',
  planId: 'plan',
  name: 'Mallorca',
  startDate: '2027-03-01',
  endDate: '2027-03-07',
  hoursPerDay: 5,
  createdAt: 'x1234567890',
  updatedAt: 'x1234567890',
  ...o,
});
const run = (camps: TrainingCamp[], budgetH = 14) => {
  const r = generatePlan(input({ extra: { camps }, profile: profile({ availableWeeklySec: budgetH * 3600 }) }));
  if (!r.ok) throw new Error('kein Plan');
  return r.proposal;
};
const total = (w: { targets: { sports: { sport: string; durationSec?: number }[] } }) =>
  w.targets.sports.filter((s) => s.sport !== 'strength').reduce((a, s) => a + (s.durationSec ?? 0), 0);
const sp = (w: { targets: { sports: { sport: string; durationSec?: number }[] } }, s: string) => w.targets.sports.find((x) => x.sport === s)?.durationSec ?? 0;

describe('Trainingslager (Modell 1.8.0)', () => {
  it('Camp-Budget: Camp-Tage mit Camp-Stunden, übrige Tage anteilig', () => {
    expect(campBudgetSec(14 * 3600, { days: 7, hoursPerDay: 5 })).toBe(35 * 3600);
    expect(campBudgetSec(14 * 3600, { days: 3, hoursPerDay: 5 })).toBe(8 * 3600 + 15 * 3600);
  });

  it('volle Camp-Woche: deutlich mehr Rad und Schwimmen, Laufen normal, danach Erholung, keine Grenzverletzung', () => {
    const without = run([]);
    const p = run([camp()]);
    expect(p.violations).toEqual([]);
    const i = p.weeks.findIndex((w) => w.weekStart === '2027-03-01');
    const w = p.weeks[i]!;
    const w0 = without.weeks[i]!;
    expect(w.kind).toBe('camp');
    expect(sp(w, 'bike')).toBeGreaterThan(sp(w0, 'bike') * 1.3);
    expect(sp(w, 'swim')).toBeGreaterThanOrEqual(sp(w0, 'swim'));
    // Laufen nicht über der normalen Belastungswoche
    const prevLoading = [...p.weeks.slice(0, i)].reverse().find((x) => x.kind === 'loading')!;
    expect(sp(w, 'run')).toBeLessThanOrEqual(Math.ceil(sp(prevLoading, 'run') * 1.1) + 60);
    // Camp-Mehrumfang ist locker: Z4/Z5 wie ohne Camp
    const hard = (x: typeof w) => x.targets.sports.reduce((a, s) => a + ((s.zoneSec?.z4 ?? 0) + (s.zoneSec?.z5 ?? 0)), 0);
    expect(hard(w)).toBeLessThanOrEqual(hard(w0) * 1.05 + 300);
    const after = p.weeks[i + 1]!;
    expect(after.kind).toBe('post_camp');
    expect(total(after)).toBeLessThan(total(w) * 0.6);
    expect(w.targets.notes).toMatch(/Mallorca/);
  });

  it('fällige Entlastung rutscht vor das Camp; Folgewochen steigen vom Niveau vor dem Camp weiter', () => {
    const p = run([camp()]);
    const i = p.weeks.findIndex((w) => w.weekStart === '2027-03-01');
    const kinds = p.weeks.slice(i - 4, i + 3).map((w) => w.kind);
    expect(kinds.slice(4)).toEqual(['camp', 'post_camp', 'loading']);
    expect(kinds.slice(0, 4).filter((k) => k === 'recovery').length).toBeLessThanOrEqual(1);
    const prevLoading = [...p.weeks.slice(0, i)].reverse().find((x) => x.kind === 'loading')!;
    const next = p.weeks[i + 2]!;
    expect(sp(next, 'bike')).toBeLessThanOrEqual(Math.ceil(sp(prevLoading, 'bike') * 1.15) + 60);
  });

  it('Teil-Woche: nur Camp-Tage zählen; Camp im Taper wird ignoriert (W12)', () => {
    const p = run([camp({ startDate: '2027-03-05', endDate: '2027-03-07' })]);
    const w = p.weeks.find((x) => x.weekStart === '2027-03-01')!;
    expect(w.kind).toBe('camp');
    expect(w.reasons.join(' ')).toMatch(/3 Camp-Tage/);
    const late = run([camp({ startDate: '2027-06-21', endDate: '2027-06-24' })]);
    expect(late.warnings.some((x) => x.code === 'W12')).toBe(true);
    expect(late.weeks.some((x) => x.kind === 'camp')).toBe(false);
  });

  it('wenig Camp-Zeit begrenzt den Mehrumfang auf das Camp-Budget', () => {
    const p = run([camp({ hoursPerDay: 1 })]);
    expect(p.violations).toEqual([]);
    const w = p.weeks.find((x) => x.weekStart === '2027-03-01')!;
    const strength = w.targets.sports.find((s) => s.sport === 'strength')?.durationSec ?? 0;
    expect(total(w) + strength).toBeLessThanOrEqual(7 * 3600 + 60);
  });

  it('Raster: Regler × Budget × Camp-Länge × Stunden – nie eine Grenzverletzung', () => {
    for (const philosophy of [0, 50, 100])
      for (const budgetH of [6, 12, 20])
        for (const [start, end] of [['2027-01-06', '2027-01-08'], ['2027-02-01', '2027-02-14'], ['2027-04-26', '2027-05-09']] as const)
          for (const hoursPerDay of [1, 4, 8]) {
            const r = generatePlan(
              input({ settings: { philosophy }, profile: profile({ availableWeeklySec: budgetH * 3600 }), extra: { camps: [camp({ startDate: start, endDate: end, hoursPerDay })] } }),
            );
            if (!r.ok) throw new Error('kein Plan');
            expect(r.proposal.violations, `${philosophy}/${budgetH}/${start}/${hoursPerDay}`).toEqual([]);
          }
  });
});
