import { describe, expect, it } from 'vitest';
import { applyWeekTargets, copyWeekTargets, plannedDurationTotal, reconcileWeeks, scaleWeekTargets, setSportTarget, planWeekStarts } from './plan';
import type { CompletedActivity, TrainingWeek, WeekTargets } from './schemas';
import { computeWeekProgress } from './progress';
import { deriveBikeZonesFromFtp, validateZoneBounds, zoneForValue } from './zones';

const base: WeekTargets = {
  phase: 'base',
  sports: [
    { sport: 'swim', distanceM: 6000, durationSec: 7200 },
    { sport: 'bike', durationSec: 8 * 3600, zoneSec: { z2: 6 * 3600, z4: 1800 } },
    { sport: 'strength', sessions: 2 },
  ],
  focuses: [{ id: 'f1', sport: 'bike', focus: 'threshold', count: 1 }],
};

describe('Plan-Operationen', () => {
  it('Planwochen umfassen Vorbereitungsbeginn bis Wettkampfwoche', () => {
    const w = planWeekStarts('2026-11-04', '2026-11-29');
    expect(w).toEqual(['2026-11-02', '2026-11-09', '2026-11-16', '2026-11-23']);
  });

  it('Datumsänderung löscht keine Wochen, sondern meldet sie', () => {
    const existing = [{ weekStart: '2026-11-02' }, { weekStart: '2026-11-09' }];
    const r = reconcileWeeks(existing, '2026-11-09', '2026-11-22');
    expect(r.missing).toEqual(['2026-11-16']);
    expect(r.outside).toEqual(['2026-11-02']);
  });

  it('proportionales Skalieren rundet sinnvoll und lässt Anzahlen unverändert', () => {
    const s = scaleWeekTargets(base, 0.8);
    expect(s.sports[0]?.distanceM).toBe(4800);
    expect(s.sports[1]?.durationSec).toBe(6.4 * 3600);
    expect(s.sports[1]?.zoneSec?.z4).toBe(1440);
    expect(s.sports[2]?.sessions).toBe(2);
    // Original unverändert
    expect(base.sports[0]?.distanceM).toBe(6000);
  });

  it('nur ausgewählte Sportarten skalieren', () => {
    const s = scaleWeekTargets(base, 1.1, ['swim']);
    expect(s.sports[0]?.distanceM).toBe(6600);
    expect(s.sports[1]?.durationSec).toBe(8 * 3600);
  });

  it('Gesamtdauer nur bei vollständigen Dauerzielen', () => {
    expect(plannedDurationTotal(base)).toBeNull();
    expect(plannedDurationTotal({ sports: [{ sport: 'bike', durationSec: 3600 }, { sport: 'run', durationSec: 1800 }], focuses: [] })).toBe(5400);
  });

  it('Kopie erhält neue Schwerpunkt-IDs', () => {
    const c = copyWeekTargets(base);
    expect(c.focuses[0]?.id).not.toBe('f1');
    expect(c.focuses[0]?.focus).toBe('threshold');
  });

  it('leeres Sportziel wird entfernt, Reihenfolge bleibt stabil', () => {
    const t = setSportTarget(base, { sport: 'swim' });
    expect(t.sports.map((s) => s.sport)).toEqual(['bike', 'strength']);
    const t2 = setSportTarget(t, { sport: 'run', durationSec: 3600 });
    expect(t2.sports.map((s) => s.sport)).toEqual(['bike', 'run', 'strength']);
  });

  it('Testfall 4: Planänderung verändert keine absolvierten Einheiten; Original bleibt erhalten', () => {
    const week: TrainingWeek = {
      id: 'w1', planId: 'p1', weekStart: '2026-11-16', current: base, revision: 0, updatedAt: 'x',
    };
    const activity: CompletedActivity = {
      id: 'a1', sport: 'bike', date: '2026-11-17', durationSec: 5400, focus: 'endurance', createdAt: 't', updatedAt: 't',
    };
    const snapshot = JSON.stringify(activity);
    const first = applyWeekTargets(week, base, 'now1');
    const changed = applyWeekTargets(first, scaleWeekTargets(base, 0.5), 'now2');
    expect(JSON.stringify(activity)).toBe(snapshot);
    expect(changed.original?.sports[1]?.durationSec).toBe(8 * 3600);
    expect(changed.current.sports[1]?.durationSec).toBe(4 * 3600);
    expect(changed.revision).toBe(2);
    // Ist-Werte unabhängig von Planänderung
    expect(computeWeekProgress('2026-11-16', changed.current, [activity]).sports.bike.duration.done).toBe(5400);
    expect(computeWeekProgress('2026-11-16', base, [activity]).sports.bike.duration.done).toBe(5400);
  });
});

describe('Zonen', () => {
  it('Coggan-Leistungszonen aus FTP', () => {
    expect(deriveBikeZonesFromFtp(250)).toEqual([140, 190, 228, 265]);
    expect(() => deriveBikeZonesFromFtp(0)).toThrow();
  });

  it('prüft die Richtung der Grenzen', () => {
    expect(validateZoneBounds('power_w', [140, 190, 228, 265])).toBeNull();
    expect(validateZoneBounds('power_w', [190, 140, 228, 265])).not.toBeNull();
    expect(validateZoneBounds('pace_s_per_km', [330, 300, 280, 260])).toBeNull();
    expect(validateZoneBounds('pace_s_per_km', [260, 280, 300, 330])).not.toBeNull();
  });

  it('ordnet Werte Zonen zu', () => {
    const bike = { metric: 'power_w' as const, bounds: [140, 190, 228, 265] as [number, number, number, number] };
    expect(zoneForValue(bike, 100)).toBe('z1');
    expect(zoneForValue(bike, 200)).toBe('z3');
    expect(zoneForValue(bike, 300)).toBe('z5');
    const run = { metric: 'pace_s_per_km' as const, bounds: [330, 300, 280, 260] as [number, number, number, number] };
    expect(zoneForValue(run, 360)).toBe('z1');
    expect(zoneForValue(run, 290)).toBe('z3');
    expect(zoneForValue(run, 250)).toBe('z5');
  });
});
