import { describe, expect, it } from 'vitest';
import { bikeTimeSec, computePrognosis, setupCda, setupCrr, withAssumedSetup, type RaceSetup, historyDates, prognosisHistory, scenarioMetrics, speedForPower, type PrognosisInput } from './prognosis';
import type { PerformanceMetric } from './schemas';

const metric = (kind: PerformanceMetric['kind'], value: number, date = '2026-11-17'): PerformanceMetric => ({
  id: kind,
  kind,
  value,
  unit: kind === 'bike_ftp_w' ? 'W' : kind === 'swim_css_s_per_100m' ? 's/100m' : 's/km',
  date,
  createdAt: `${date}T10:00:00.000Z`,
});
const FULL = { swimM: 3800, bikeM: 180000, runM: 42195 };
const SETUP: RaceSetup = { bikeType: 'tt', clipOns: true, wheels: 'standard', tires: 'race', kit: 'normal', runShoes: 'training', wetsuit: 'no' };
const base: PrognosisInput = {
  today: '2026-11-25',
  race: FULL,
  profile: { weightKg: 75, sex: 'male', raceSetup: SETUP },
  metrics: [metric('swim_css_s_per_100m', 90), metric('bike_ftp_w', 250), metric('run_threshold_pace_s_per_km', 235)],
  activities: [],
  settings: {},
};
const split = (p: ReturnType<typeof computePrognosis>, k: string) => p.splits.find((s) => s.split === k)!;

describe('Zielzeit-Prognose', () => {
  it('Physik: 250 W × 0,70 mit CdA 0,27 und 85 kg ≈ 34 km/h; Höhenmeter machen langsamer', () => {
    const v = speedForPower(175, 0.27, 85);
    expect(v * 3.6).toBeGreaterThan(33.5);
    expect(v * 3.6).toBeLessThan(35);
    expect(bikeTimeSec(180000, 175, 0.27, 85, 1200)).toBeGreaterThan(bikeTimeSec(180000, 175, 0.27, 85) + 10 * 60);
  });

  it('nur aus Leistungswerten: Teilzeiten plausibel, Gesamtspanne = Summe', () => {
    const p = computePrognosis(base);
    const swim = split(p, 'swim').combined!;
    expect(swim.lo).toBe(94 * 38);
    expect(swim.hi).toBe(102 * 38);
    const bike = split(p, 'bike').combined!;
    expect(bike.lo / 3600).toBeGreaterThan(4.8);
    expect(bike.hi / 3600).toBeLessThan(5.9);
    const run = split(p, 'run').combined!;
    expect(run.lo).toBeCloseTo(235 * 1.18 * 42.195, 6);
    expect(p.total!.lo).toBeCloseTo(swim.lo + bike.lo + run.lo + 6 * 60, 6);
    expect(p.total!.hi).toBeCloseTo(swim.hi + bike.hi + run.hi + 14 * 60, 6);
    expect(p.total!.lo / 3600).toBeGreaterThan(9);
    expect(p.total!.hi / 3600).toBeLessThan(11);
  });

  it('absolviertes Training geht als eigener Schätzweg ein und wird mit dem Leistungswert gemittelt', () => {
    const acts = [
      { sport: 'run' as const, date: '2026-11-08', durationSec: 5400, distanceM: 16000 }, // 5:37 /km
      { sport: 'run' as const, date: '2026-11-22', durationSec: 6000, distanceM: 18000 }, // 5:33 /km
      { sport: 'bike' as const, date: '2026-11-15', durationSec: 4 * 3600, distanceM: 120000 }, // 30 km/h
      { sport: 'bike' as const, date: '2026-11-21', durationSec: 3 * 3600, distanceM: 93000 },
      { sport: 'run' as const, date: '2026-09-01', durationSec: 9000, distanceM: 30000 }, // zu alt
    ];
    const p = computePrognosis({ ...base, activities: acts });
    const run = split(p, 'run');
    const t = run.methods.find((m) => m.id === 'run_training')!;
    expect(t.detail).toMatch(/aus 2 Läufen/);
    expect(t.detail).toMatch(/längster unter 2 h/);
    expect(t.hi).toBeCloseTo(((5400 / 16 + 6000 / 18) / 2) * 1.17 * 42.195, 3);
    expect(run.combined!.lo).toBeCloseTo((run.methods[0]!.lo + run.methods[1]!.lo) / 2, 6);
    expect(split(p, 'bike').methods.map((m) => m.id)).toEqual(['bike_ftp', 'bike_training']);
    expect(p.trainingWeeklySec).toBeCloseTo((5400 + 6000 + 4 * 3600 + 3 * 3600) / 8, 6);
  });

  it('ohne Grundlage für eine Disziplin keine Gesamtzahl, aber Hinweis, was fehlt', () => {
    const p = computePrognosis({ ...base, metrics: base.metrics.filter((m) => m.kind !== 'swim_css_s_per_100m') });
    expect(p.total).toBeNull();
    expect(split(p, 'swim').missing).toMatch(/CSS-Test/);
  });

  it('Bestzeiten: Marathon + 20–45 min, Riegel aus Halbmarathon, Formel nach Rüst, 70.3-Regel', () => {
    const p = computePrognosis({ ...base, profile: { weightKg: 75, sex: 'male', raceSetup: SETUP, bestTimes: { runMarathon: { timeSec: 3 * 3600 }, triOlympic: { timeSec: 2.25 * 3600 }, tri703: { timeSec: 4.75 * 3600 } } } });
    const best = split(p, 'run').methods.find((m) => m.id === 'run_best')!;
    expect(best.lo).toBe(3 * 3600 + 20 * 60);
    expect(best.hi).toBe(3 * 3600 + 45 * 60);
    const ruest = p.formulas.find((f) => f.id === 'ruest_m')!;
    expect((ruest.lo + ruest.hi) / 2 / 60).toBeCloseTo(152.1 + 1.332 * 180 + 1.964 * 135, 6);
    expect(p.formulas.find((f) => f.id === 'half_double')!.lo).toBeCloseTo(9.5 * 3600 * 1.03, 6);
    const half = computePrognosis({ ...base, profile: { raceSetup: SETUP, bestTimes: { runHalf: { timeSec: 5400 } } } });
    expect(split(half, 'run').methods.find((m) => m.id === 'run_best')!.detail).toMatch(/Marathon-Äquivalent 3:08 h/);
  });

  it('nur Langdistanz', () => {
    expect(computePrognosis({ ...base, race: { swimM: 1900, bikeM: 90000, runM: 21100 } }).supported).toBe(false);
  });

  it('Verlauf: rückwirkend nur mit damals vorhandenen Werten; Stichtage alle 2 Wochen', () => {
    expect(historyDates('2026-11-25', '2026-10-20')).toEqual(['2026-10-28', '2026-11-11', '2026-11-25']);
    const metrics = [...base.metrics, metric('bike_ftp_w', 230, '2026-10-01')];
    metrics.splice(1, 1, { ...metric('bike_ftp_w', 250, '2026-11-17') });
    const pts = prognosisHistory({ ...base, metrics }, ['2026-10-15', '2026-11-25']);
    // am 15.10. gab es CSS/Schwellenpace (17.11.) noch nicht → keine Gesamtzahl
    expect(pts[0]!.total).toBeNull();
    expect(pts[1]!.total).not.toBeNull();
  });

  it('Szenario „FTP + 20 W, 5 s/km schneller“ macht die Prognose schneller, ohne die Daten zu ändern', () => {
    const now = computePrognosis(base).total!;
    const m2 = scenarioMetrics(base.metrics, { ftpW: 20, runPaceSec: -5 }, base.today);
    const sc = computePrognosis({ ...base, metrics: m2 }).total!;
    expect(sc.mid).toBeLessThan(now.mid - 10 * 60);
    expect(base.metrics).toHaveLength(3);
    // ohne vorhandenen Wert keine Wirkung
    expect(scenarioMetrics([], { ftpW: 20 }, base.today)).toEqual([]);
  });

  it('ohne Race-Setup keine Prognose, nur der Hinweis; der Planer rechnet mit einer Annahme weiter', () => {
    const p = computePrognosis({ ...base, profile: { weightKg: 75 } });
    expect(p.needsSetup).toBe(true);
    expect(p.total).toBeNull();
    expect(p.splits).toEqual([]);
    const assumed = computePrognosis({ ...base, profile: withAssumedSetup({ weightKg: 75 }, { bikeType: 'road_aero' }) });
    expect(assumed.needsSetup).toBe(false);
    expect(assumed.total).not.toBeNull();
  });

  it('Race-Setup: Material verschiebt die Teilzeiten in die erwartete Richtung', () => {
    const with_ = (s: Partial<RaceSetup>) => computePrognosis({ ...base, profile: { weightKg: 75, raceSetup: { ...SETUP, ...s } } });
    const ref = with_({});
    const bike = (p: ReturnType<typeof computePrognosis>) => split(p, 'bike').combined!.lo;
    // Rad: Gravel ohne Aufleger < Rennrad ohne < Rennrad mit Aufliegern < TT; Aero-Kleidung, Hochprofil, Rennreifen schneller
    expect(bike(with_({ bikeType: 'gravel', clipOns: false }))).toBeGreaterThan(bike(with_({ bikeType: 'road', clipOns: false })));
    expect(bike(with_({ bikeType: 'road', clipOns: false }))).toBeGreaterThan(bike(with_({ bikeType: 'road', clipOns: true })));
    expect(bike(with_({ bikeType: 'road', clipOns: true }))).toBeGreaterThan(bike(ref));
    expect(bike(with_({ kit: 'aero', wheels: 'deep' }))).toBeLessThan(bike(ref));
    expect(bike(with_({ kit: 'loose' }))).toBeGreaterThan(bike(ref));
    expect(bike(with_({ tires: 'training' }))).toBeGreaterThan(bike(ref));
    // Neo 3–7 % schneller; „noch offen“ = Spanne von mit bis ohne
    const swimRef = split(ref, 'swim').combined!;
    const swimNeo = split(with_({ wetsuit: 'yes' }), 'swim').combined!;
    const swimOpen = split(with_({ wetsuit: 'unknown' }), 'swim').combined!;
    expect(swimNeo.lo).toBeCloseTo(swimRef.lo * 0.93, -1);
    expect(swimNeo.hi).toBeCloseTo(swimRef.hi * 0.97, -1);
    expect(swimOpen.lo).toBeCloseTo(swimNeo.lo, -1);
    expect(swimOpen.hi).toBeCloseTo(swimRef.hi, -1);
    // Carbonschuhe 0,5–2 % schneller
    const runRef = split(ref, 'run').combined!;
    const runCarbon = split(with_({ runShoes: 'carbon' }), 'run').combined!;
    expect(runCarbon.lo).toBeLessThan(runRef.lo);
    expect(runCarbon.lo).toBeGreaterThan(runRef.lo * 0.975);
    // Faktoren
    expect(setupCda({ ...SETUP, bikeType: 'aero_road', clipOns: false }).lo).toBeCloseTo(0.31, 3);
    expect(setupCrr({ ...SETUP, bikeType: 'gravel', tires: 'training' })).toBeCloseTo(0.0065, 5);
  });
});
