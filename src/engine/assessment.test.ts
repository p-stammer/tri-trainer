import { describe, expect, it } from 'vitest';
import { referenceShares } from './assessment';
import { generatePlan, suggestPriorities } from './generate';
import { input, TODAY } from './fixtures.test-helper';
import type { PerformanceMetric } from '../domain/schemas';

const metric = (kind: PerformanceMetric['kind'], value: number, date: string): PerformanceMetric => ({
  id: `${kind}-${date}`,
  kind,
  value,
  unit: kind === 'bike_ftp_w' ? 'W' : kind === 'swim_css_s_per_100m' ? 's/100m' : 's/km',
  date,
  createdAt: `${date}T10:00:00.000Z`,
});
const bySport = (ps: ReturnType<typeof suggestPriorities>) => Object.fromEntries((ps ?? []).map((p) => [p.sport, p]));

describe('Dynamische Repriorisierung (Modell 1.7.0)', () => {
  it('Referenzanteile [D2] je nach prognostizierter Zeit, Summe 1', () => {
    const fast = referenceShares(8.5 * 3600);
    const slow = referenceShares(15 * 3600);
    expect(fast.bike).toBeGreaterThan(slow.bike);
    expect(fast.run).toBeLessThan(slow.run);
    expect(fast.swim + fast.bike + fast.run).toBeCloseTo(1, 9);
  });

  it('ausgeglichene Prognose → keine Änderung durch Teilzeiten', () => {
    const ps = bySport(
      suggestPriorities(input({ extra: { metrics: [metric('swim_css_s_per_100m', 90, '2026-11-10'), metric('bike_ftp_w', 250, '2026-11-10'), metric('run_threshold_pace_s_per_km', 235, '2026-11-10')] } })),
    );
    for (const s of ['swim', 'bike', 'run']) expect(ps[s]!.factors!.some((f) => f.startsWith('Prognose'))).toBe(false);
  });

  it('relativ langsames Laufen → Laufen +1, starkes Rad −1; Testverschlechterung +1', () => {
    const metrics = [
      metric('swim_css_s_per_100m', 95, '2026-11-10'),
      metric('bike_ftp_w', 330, '2026-11-10'),
      metric('run_threshold_pace_s_per_km', 300, '2026-11-10'),
      metric('swim_css_s_per_100m', 90, '2026-10-01'), // Vortest schneller → Schwimmen 5 % schwächer
    ];
    const ps = bySport(suggestPriorities(input({ extra: { metrics } })));
    expect(ps.run!.factors!.join()).toMatch(/relativ langsamer \(\+1\)/);
    expect(ps.bike!.factors!.join()).toMatch(/relativ stärker \(−1\)/);
    expect(ps.swim!.factors!.join()).toMatch(/letzter Test 5 % schwächer \(\+1\)/);
    expect(ps.run!.suggested).toBe(5); // dazu: Umfang unter Rennanteil (+1)
    expect(ps.bike!.suggested).toBe(2);
    // im Plan: Prioritäten wirken nur über die Gewichte, harte Grenzen bleiben
    const r = generatePlan(input({ extra: { metrics } }));
    expect(r.ok && r.proposal.violations).toEqual([]);
  });

  it('alter Vortest (> 16 Wochen) oder zu kurzer Abstand zählt nicht', () => {
    const old = bySport(suggestPriorities(input({ extra: { metrics: [metric('bike_ftp_w', 230, '2026-11-10'), metric('bike_ftp_w', 250, '2026-07-01')] } })));
    // Abstand ok, letzter Test aktuell → zählt (−8 %)
    expect(old.bike!.factors!.join()).toMatch(/schwächer/);
    const close = bySport(suggestPriorities(input({ extra: { metrics: [metric('bike_ftp_w', 230, '2026-11-10'), metric('bike_ftp_w', 250, '2026-11-01')] } })));
    expect(close.bike!.factors!.join()).not.toMatch(/schwächer/);
    const stale = bySport(suggestPriorities(input({ extra: { metrics: [metric('bike_ftp_w', 230, '2026-06-01'), metric('bike_ftp_w', 250, '2026-04-01')] } })));
    expect(stale.bike!.factors!.join()).not.toMatch(/schwächer/);
    expect(TODAY).toBe('2026-11-17');
  });
});
