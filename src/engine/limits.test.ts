import { describe, expect, it } from 'vitest';
import { disciplineWeights, FIXED, growthFor, MODEL_VERSION, raceClass, resolveParams, sliderCurve, volumeCeilingSec } from './params';
import { floorVolume, longRunCap, longSessionRef, progressionCap, recoveryVolume, trailingMean } from './limits';

describe('Modellparameter (PLAN_MODEL 4.1)', () => {
  it('Regler-Endpunkte entsprechen der Tabelle', () => {
    const c = resolveParams(0);
    const a = resolveParams(100);
    expect(c.lowIntensityShare).toBeCloseTo(0.9);
    expect(a.lowIntensityShare).toBeCloseTo(0.7);
    expect(c.runGrowth).toBeCloseTo(0.05);
    expect(a.runGrowth).toBeCloseTo(0.1);
    // Trainingszeit hängt nicht vom Regler ab (3.6)
    expect(c.otherGrowth).toBe(a.otherGrowth);
    expect(c.otherGrowth).toBeCloseTo(0.15);
    expect(c.recoveryCut).toBe(a.recoveryCut);
    expect(c.recoveryCut).toBeCloseTo(0.3);
    expect(c.strengthSessions).toBe(2);
    expect(a.strengthSessions).toBe(1);
    expect(c.runRacePaceShare).toBe(0);
    expect(resolveParams(59).runRacePaceShare).toBe(0);
    expect(a.runRacePaceShare).toBeCloseTo(0.06);

    expect(MODEL_VERSION).toMatch(/^im-gen-/);
  });

  it('harte Obergrenzen werden vom Regler nie überschritten', () => {
    for (let phi = 0; phi <= 100; phi += 5) {
      const p = resolveParams(phi);
      expect(p.runGrowth).toBeLessThanOrEqual(0.1 + 1e-9);
      expect(p.otherGrowth).toBeLessThanOrEqual(0.2 + 1e-9);
      expect(p.lowIntensityShare).toBeGreaterThanOrEqual(0.7 - 1e-9);
      expect(p.recoveryEvery).toBe(4); // fester Rhythmus, unabhängig vom Regler
      expect(growthFor('run', p)).toBeLessThan(growthFor('bike', p));
    }
    expect(resolveParams(250).runGrowth).toBeCloseTo(0.1);
    expect(resolveParams(-5).runGrowth).toBeCloseTo(0.05);
    expect(resolveParams(Number.NaN).philosophy).toBe(50);
  });

  it('Altersanpassung: ab 50 eine Woche früher entlasten, mindestens alle 3 Wochen', () => {
    expect(resolveParams(80, 52).recoveryEvery).toBe(3);
    expect(resolveParams(20, 52).recoveryEvery).toBe(3);
    expect(resolveParams(80, 49).recoveryEvery).toBe(4);
  });

  it('Disziplingewichte: Grundgewichte 10/50/40, Priorität verschiebt, Summe 1', () => {
    const neutral = disciplineWeights({});
    expect(neutral.swim).toBeCloseTo(0.1);
    expect(neutral.bike).toBeCloseTo(0.5);
    expect(neutral.run).toBeCloseTo(0.4);
    const swim5 = disciplineWeights({ swim: 5 });
    expect(swim5.swim).toBeGreaterThan(neutral.swim);
    expect(swim5.swim + swim5.bike + swim5.run).toBeCloseTo(1);
    expect(disciplineWeights({ run: 9 }).run).toBeCloseTo(disciplineWeights({ run: 5 }).run);
  });
});

describe('Reglerkurve und Umfangsnormen (1.2.0)', () => {
  it('Kurve: Mitte flach, Enden steil', () => {
    expect(sliderCurve(0)).toBe(0);
    expect(sliderCurve(1)).toBe(1);
    expect(sliderCurve(0.5)).toBeCloseTo(0.5);
    const mid = sliderCurve(0.6) - sliderCurve(0.4);
    const end = sliderCurve(1) - sliderCurve(0.8);
    expect(end).toBeGreaterThan(2.5 * mid);
  });
  it('Obergrenze je Distanz, unabhängig vom Regler (Langdistanz 19 h, Mitteldistanz 16 h)', () => {
    expect(volumeCeilingSec('full') / 3600).toBe(19);
    expect(volumeCeilingSec('half') / 3600).toBe(16);
    expect(raceClass({ runM: 42_195, bikeM: 180_000 })).toBe('full');
    expect(raceClass({ runM: 21_097.5, bikeM: 90_000 })).toBe('half');
    expect(raceClass({ runM: 10_000, bikeM: 40_000 })).toBe('olympic');
    expect(raceClass({ runM: 5000, bikeM: 20_000 })).toBe('sprint');
  });
});

describe('Harte Grenzen (PLAN_MODEL 4.4, 4.5)', () => {
  it('Woche 1 bezieht sich auf den Ausgangsumfang: 1 h Laufen → höchstens 1:06 h bei +10 %', () => {
    expect(progressionCap([], 3600, 0.1)).toBeCloseTo(3960);
    expect(progressionCap([], 10_000, 0.1)).toBeCloseTo(11_000);
    // „unter keinen Umständen 2 h / 24 km“
    expect(progressionCap([], 3600, resolveParams(100).runGrowth)).toBeLessThan(2 * 3600);
  });

  it('Mittel der drei Vorwochen, fehlende Wochen mit Ausgangswert', () => {
    expect(trailingMean([], 60)).toBe(60);
    expect(trailingMean([64.5], 60)).toBeCloseTo(61.5);
    expect(trailingMean([100, 64.5, 66, 70], 60)).toBeCloseTo((64.5 + 66 + 70) / 3);
  });

  it('Bezug = letzte Belastungswoche: echte Steigerung um g pro Belastungswoche (1.4.0)', () => {
    let v = 3600;
    const hist: number[] = [];
    for (let i = 0; i < 10; i++) {
      v = progressionCap(hist, 3600, 0.075);
      hist.push(v);
    }
    expect(v / 3600).toBeCloseTo(1.075 ** 10, 6);
  });

  it('nach einer Pause sanfter Wiedereinstieg über das Mittel der letzten drei', () => {
    const L = 3 * 3600;
    // Woche mit voller Pause (0) zählt mit: Bezug = Mittel (0, L, L) statt 0
    expect(progressionCap([L, L, 0], L, 0.1)).toBeCloseTo(1.1 * ((2 * L) / 3));
    // Entlastungswochen sind keine Bezugswochen → nach der Entlastung weiter ab L
    expect(progressionCap([L * 0.95, L], L, 0.1)).toBeCloseTo(1.1 * L);
    expect(recoveryVolume(L, 0.3)).toBeCloseTo(0.7 * L);
  });

  it('langer Lauf: +10 % Grenze, Wochenanteil bremst nur, absolute Obergrenze', () => {
    // bisher 6 km, Woche 10,7 km → 0,5 × Woche = 5,35 km bremst, aber nicht unter 6 km
    expect(longRunCap(6000, 10_700, 'm')).toBe(6000);
    // Wochenumfang groß genug → +10 %
    expect(longRunCap(20_000, 60_000, 'm')).toBeCloseTo(22_000);
    // Obergrenze 32 km / 3 h
    expect(longRunCap(31_000, 90_000, 'm')).toBe(32_000);
    expect(longRunCap(3 * 3600, 8 * 3600, 'sec')).toBe(3 * 3600);
    expect(FIXED.longRunMaxM).toBe(32_000);
  });

  it('Referenz für den längsten Lauf: Ausgangswert gilt, bis 4 Planwochen vorliegen', () => {
    expect(longSessionRef([], 12_000)).toBe(12_000);
    expect(longSessionRef([8000, 9000], 12_000)).toBe(12_000);
    expect(longSessionRef([8000, 9000, 9500, 10_000], 12_000)).toBe(10_000);
    expect(longSessionRef([8000, 13_000, 9500, 10_000, 11_000], 12_000)).toBe(13_000);
  });

  it('Beispiel PLAN_MODEL 8: 1:00 h / 10 km, längster Lauf 6 km, φ = 50 (abgerundet geplant)', () => {
    const p = resolveParams(50);
    expect(p.runGrowth).toBeCloseTo(0.075);
    const dur: number[] = [];
    const dist: number[] = [];
    const long: number[] = [];
    for (let w = 0; w < 3; w++) {
      dur.push(floorVolume(progressionCap(dur, 3600, p.runGrowth), 'sec'));
      dist.push(floorVolume(progressionCap(dist, 10_000, p.runGrowth), 'm'));
      long.push(floorVolume(longRunCap(longSessionRef(long, 6000), dist[w] ?? 0, 'm'), 'm'));
    }
    expect(dur.map((s) => s / 60)).toEqual([64, 68, 73]);
    expect(dist.map((m) => m / 1000)).toEqual([10.7, 11.5, 12.3]);
    expect(long).toEqual([6000, 6000, 6100]); // Woche 3: 0,5 × 12,3 km = 6,15 km
    expect(floorVolume(recoveryVolume(dur[2] ?? 0, p.recoveryCut), 'sec') / 60).toBe(51);
    expect(floorVolume(recoveryVolume(dist[2] ?? 0, p.recoveryCut), 'm') / 1000).toBe(8.6);
    // jede Woche hält die harte Grenze gegenüber den (geplanten) Vorwochen ein
    for (let w = 0; w < 3; w++) expect(dur[w]).toBeLessThanOrEqual(progressionCap(dur.slice(0, w), 3600, p.runGrowth));
  });

  it('Abrunden: nie über der Grenze', () => {
    expect(floorVolume(3870, 'sec')).toBe(3840);
    expect(floorVolume(10_750, 'm')).toBe(10_700);
    expect(floorVolume(3600, 'sec')).toBe(3600);
  });
});
