import { describe, expect, it } from 'vitest';
import { TEST_PROTOCOLS, cooperVo2max, metricHistory, testsDue, vo2History } from './performanceTests';
import type { PerformanceMetric } from './schemas';

const m = (kind: PerformanceMetric['kind'], value: number, date: string, createdAt = `${date}T10:00:00.000Z`): PerformanceMetric => ({
  id: `${kind}-${date}-${value}`,
  kind,
  value,
  unit: kind === 'bike_ftp_w' ? 'W' : kind === 'swim_css_s_per_100m' ? 's/100m' : 's/km',
  date,
  createdAt,
});
const proto = (id: string) => TEST_PROTOCOLS.find((p) => p.id === id)!;

describe('Leistungstests', () => {
  it('Rechner: FTP = 95 % der 20-min-Leistung, Laufpace aus 30 min, CSS = (t400 − t200) / 2', () => {
    expect(proto('bike_20min').compute({ p20: 263 })).toEqual({ value: 250 });
    expect(proto('run_30min').compute({ d30: 7660 })).toEqual({ value: 235 }); // 3:55 /km
    expect(proto('swim_css').compute({ t400: 6 * 60 + 20, t200: 2 * 60 + 58 })).toEqual({ value: 101 });
    expect(proto('swim_css').compute({ t400: 150, t200: 160 })).toHaveProperty('error');
    expect(proto('bike_20min').compute({})).toBeNull();
    expect(proto('run_30min').compute({ d30: 30 })).toHaveProperty('error'); // km statt m vertippt
  });

  it('Verlauf chronologisch, Verbesserung richtungsabhängig (Watt höher, Pace niedriger)', () => {
    const list = [m('bike_ftp_w', 250, '2026-12-20'), m('bike_ftp_w', 240, '2026-10-01'), m('run_threshold_pace_s_per_km', 240, '2026-10-01'), m('run_threshold_pace_s_per_km', 235, '2026-12-01')];
    const bike = metricHistory(list, 'bike');
    expect(bike.map((h) => h.metric.value)).toEqual([240, 250]);
    expect(bike[1]!.improvement).toBeCloseTo(250 / 240 - 1, 6);
    const run = metricHistory(list, 'run');
    expect(run[1]!.improvement).toBeCloseTo(240 / 235 - 1, 6);
    expect(run[1]!.improvement!).toBeGreaterThan(0);
  });

  it('fällig ab 8 Wochen oder ohne Wert, nicht im Taper', () => {
    const list = [m('bike_ftp_w', 250, '2026-11-01'), m('swim_css_s_per_100m', 90, '2026-09-01')];
    expect(testsDue(list, '2026-12-01').map((d) => [d.sport, d.ageDays])).toEqual([['swim', 91], ['run', null]]);
    expect(testsDue(list, '2026-12-27').map((d) => d.sport)).toEqual(['swim', 'bike', 'run']);
    expect(testsDue(list, '2026-12-27', 'taper')).toEqual([]);
  });

  it('VO2max: Cooper-Formel, Verlauf, Vergleich nur bei gleicher Methode; zählt nicht als fälliger Test', () => {
    expect(cooperVo2max(2800)).toEqual({ value: 51.3 });
    expect(cooperVo2max(300)).toHaveProperty('error');
    const v = (value: number, date: string, method: string) => ({ ...m('vo2max_ml_kg_min', value, date), unit: 'ml/kg/min' as const, method });
    const h = vo2History([v(52, '2026-11-01', 'Sportuhr (Schätzung)'), v(50, '2026-09-01', 'Sportuhr (Schätzung)'), v(55, '2026-12-01', 'Labor (Spiroergometrie)')]);
    expect(h.map((x) => x.metric.value)).toEqual([50, 52, 55]);
    expect(h[1]!.improvement).toBeCloseTo(0.04, 6);
    expect(h[1]!.sameMethod).toBe(true);
    expect(h[2]!.sameMethod).toBe(false);
    expect(testsDue([v(52, '2026-11-01', 'x')], '2026-11-20').map((d) => d.sport)).toEqual(['swim', 'bike', 'run']);
  });
});
