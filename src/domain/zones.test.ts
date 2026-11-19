import { describe, expect, it } from 'vitest';
import { averagePaceZone, deriveRunZonesFromThresholdPace, deriveSwimZonesFromCss, deriveZonesFromReference, validateZoneBounds, zoneForValue } from './zones';

describe('Zonen-Vorschläge Laufen und Schwimmen', () => {
  it('Laufen für die Langdistanz: 150/128/105/96 % der Schwellenpace', () => {
    expect(deriveRunZonesFromThresholdPace(235)).toEqual([353, 301, 247, 226]);
    expect(validateZoneBounds('pace_s_per_km', deriveRunZonesFromThresholdPace(235))).toBeNull();
  });

  it('Schwimmen: CSS +12/+5/+2/−3 s', () => {
    expect(deriveSwimZonesFromCss(90)).toEqual([102, 95, 92, 87]);
    expect(validateZoneBounds('pace_s_per_100m', deriveSwimZonesFromCss(90))).toBeNull();
  });

  it('Schwelle in Z4, Planer-Lockertempo (×1,4) in Z2, 4:27 /km keine Grundlage', () => {
    const cfg = { metric: 'pace_s_per_km' as const, bounds: deriveRunZonesFromThresholdPace(235) };
    expect(zoneForValue(cfg, 235)).toBe('z4');
    expect(zoneForValue(cfg, Math.round(235 * 1.4))).toBe('z2'); // 5:29 /km
    expect(zoneForValue(cfg, 267)).toBe('z3'); // 4:27 /km ist keine Grundlage
    expect(zoneForValue(cfg, 301)).toBe('z3'); // 5:01 /km: Tempo beginnt
    expect(zoneForValue(cfg, 302)).toBe('z2'); // ab 5:02 /km Grundlage
    expect(zoneForValue(cfg, 360)).toBe('z1');
    expect(zoneForValue(cfg, 220)).toBe('z5');
  });

  it('CSS liegt in Z4', () => {
    const cfg = { metric: 'pace_s_per_100m' as const, bounds: deriveSwimZonesFromCss(100) };
    expect(zoneForValue(cfg, 100)).toBe('z4');
    expect(zoneForValue(cfg, 108)).toBe('z2');
  });

  it('Rad über die gemeinsame Funktion wie bisher (Coggan)', () => {
    expect(deriveZonesFromReference('bike', 250)).toEqual([140, 190, 228, 265]);
  });

  it('Durchschnittspace einer Einheit → Zone (nur Laufen/Schwimmen, unplausibles nicht)', () => {
    const run = { metric: 'pace_s_per_km' as const, bounds: deriveRunZonesFromThresholdPace(235) };
    expect(averagePaceZone('run', 3300, 10000, run)).toEqual({ pace: 330, zone: 'z2' }); // 5:30 /km
    expect(averagePaceZone('run', 2670, 10000, run)?.zone).toBe('z3'); // 4:27 /km
    expect(averagePaceZone('run', 3300, 10000, undefined)).toEqual({ pace: 330, zone: null });
    expect(averagePaceZone('run', 3300, 100000, run)).toBeNull(); // 0:33 /km = Tippfehler
    expect(averagePaceZone('bike', 3600, 30000, undefined)).toBeNull();
    const swim = { metric: 'pace_s_per_100m' as const, bounds: deriveSwimZonesFromCss(90) };
    expect(averagePaceZone('swim', 3000, 3000, swim)).toEqual({ pace: 100, zone: 'z2' }); // 1:40 /100 m
  });

  it('ungültige Ankerwerte werden abgelehnt', () => {
    expect(() => deriveRunZonesFromThresholdPace(0)).toThrow();
    expect(() => deriveSwimZonesFromCss(5)).toThrow();
  });
});
