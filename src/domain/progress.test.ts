import { describe, expect, it } from 'vitest';
import { computeWeekProgress, primaryProgress, type ActivityLike } from './progress';
import { summarizeLoad, sessionLoad } from './load';
import type { WeekTargets } from './schemas';

const WEEK = '2026-11-16';

function act(p: Partial<ActivityLike> & Pick<ActivityLike, 'sport' | 'durationSec'>): ActivityLike {
  return { date: '2026-11-17', ...p };
}

describe('Soll-Ist-Berechnung', () => {
  it('Testfall 1: Radziel 8 h, 90 min absolviert → 6 h 30 min verbleibend', () => {
    const targets: WeekTargets = { sports: [{ sport: 'bike', durationSec: 8 * 3600 }], focuses: [] };
    const p = computeWeekProgress(WEEK, targets, [act({ sport: 'bike', durationSec: 90 * 60 })]);
    expect(p.sports.bike.duration.remaining).toBe(6.5 * 3600);
    expect(p.sports.bike.duration.ratio).toBeCloseTo(0.1875, 6);
  });

  it('Testfall 2: Schwelleneinheit 60 min mit 20 min Z4 → nur 20 min Z4, 40 min unbekannt', () => {
    const targets: WeekTargets = { sports: [{ sport: 'bike', zoneSec: { z4: 3600 } }], focuses: [] };
    const p = computeWeekProgress(WEEK, targets, [act({ sport: 'bike', durationSec: 3600, zoneSec: { z4: 1200 } })]);
    const z4 = p.sports.bike.zones.find((z) => z.zone === 'z4');
    expect(z4?.doneSec).toBe(1200);
    expect(z4?.remainingSec).toBe(2400);
    expect(p.sports.bike.unknownZoneSec).toBe(2400);
    // Keine erfundene Z2-Zeit:
    expect(p.sports.bike.zones.find((z) => z.zone === 'z2')?.doneSec).toBe(0);
  });

  it('Testfall 12: Einheit ohne Zonenzeiten → gesamte Dauer bleibt unbekannt', () => {
    const p = computeWeekProgress(WEEK, undefined, [act({ sport: 'run', durationSec: 2700 })]);
    expect(p.sports.run.unknownZoneSec).toBe(2700);
    expect(p.sports.run.zones.every((z) => z.doneSec === 0)).toBe(true);
  });

  it('Testfall 3: nachträglich erfasste Einheit zählt zur richtigen (Vor-)Woche', () => {
    const late = act({ sport: 'run', durationSec: 3600, date: '2026-11-15' }); // Sonntag Vorwoche
    expect(computeWeekProgress(WEEK, undefined, [late]).sports.run.duration.done).toBe(0);
    expect(computeWeekProgress('2026-11-09', undefined, [late]).sports.run.duration.done).toBe(3600);
  });

  it('übererfülltes Ziel: verbleibend 0, Quote > 1', () => {
    const targets: WeekTargets = { sports: [{ sport: 'run', distanceM: 10_000 }], focuses: [] };
    const p = computeWeekProgress(WEEK, targets, [act({ sport: 'run', durationSec: 4000, distanceM: 12_000 })]);
    expect(p.sports.run.distance.remaining).toBe(0);
    expect(p.sports.run.distance.ratio).toBeCloseTo(1.2, 6);
  });

  it('fehlende Distanz wird gezählt, nicht geschätzt', () => {
    const p = computeWeekProgress(WEEK, undefined, [
      act({ sport: 'swim', durationSec: 1800, distanceM: 1500 }),
      act({ sport: 'swim', durationSec: 1800 }),
    ]);
    expect(p.sports.swim.distance.done).toBe(1500);
    expect(p.sports.swim.activitiesWithoutDistance).toBe(1);
  });

  it('ohne Ziel: keine Quote, kein Rest', () => {
    const p = computeWeekProgress(WEEK, undefined, [act({ sport: 'bike', durationSec: 3600 })]);
    expect(p.sports.bike.duration.planned).toBeNull();
    expect(p.sports.bike.duration.ratio).toBeNull();
    expect(p.sports.bike.hasTarget).toBe(false);
  });

  it('Krafttraining zählt Einheiten; Sonstiges fließt nicht in Ziele', () => {
    const targets: WeekTargets = { sports: [{ sport: 'strength', sessions: 2 }], focuses: [] };
    const p = computeWeekProgress(WEEK, targets, [
      act({ sport: 'strength', durationSec: 2400 }),
      act({ sport: 'other', durationSec: 1800 }),
    ]);
    expect(p.sports.strength.sessions.remaining).toBe(1);
    expect(p.other.count).toBe(1);
    // Kraft hat nur ein Anzahl-Ziel → Gesamtdauerziel ist unvollständig
    expect(p.plannedTotalComplete).toBe(false);
    expect(p.totalDurationSec).toBe(4200);
  });

  it('primäre Zielgröße fällt transparent auf die vorhandene Größe zurück', () => {
    const targets: WeekTargets = { sports: [{ sport: 'swim', durationSec: 7200 }], focuses: [] };
    const p = computeWeekProgress(WEEK, targets, []);
    const r = primaryProgress(p.sports.swim, 'distance');
    expect(r.metric).toBe('duration');
    expect(r.isFallback).toBe(true);
  });
});

describe('Session-RPE-Belastung', () => {
  it('Testfall 6: fehlender RPE erzeugt keine Belastungskennzahl', () => {
    expect(sessionLoad({ durationSec: 3600 })).toBeNull();
    const s = summarizeLoad([{ durationSec: 3600 }, { durationSec: 1800, rpe: 6 }]);
    expect(s.load).toBe(180);
    expect(s.withRpe).toBe(1);
    expect(s.completeness).toBe(0.5);
  });

  it('ohne Einheiten ist die Vollständigkeit unbestimmt', () => {
    expect(summarizeLoad([]).completeness).toBeNull();
  });
});

describe('Trainingsschwerpunkte', () => {
  it('zählt zugeordnete und passende Einheiten, jede höchstens einmal', async () => {
    const { computeFocusProgress } = await import('./progress');
    const focuses = [
      { id: 'f1', sport: 'bike' as const, focus: 'threshold' as const, count: 1 },
      { id: 'f2', sport: 'run' as const, focus: 'vo2max' as const, count: 2 },
    ];
    const r = computeFocusProgress(focuses, [
      { sport: 'bike', focus: 'threshold' },
      { sport: 'bike', focus: 'threshold' }, // Ziel schon erfüllt → zählt nicht doppelt
      { sport: 'run', focus: 'endurance', plannedFocusId: 'f2' }, // ausdrücklich zugeordnet
      { sport: 'run', focus: 'endurance' }, // passt zu nichts
    ]);
    expect(r).toEqual([
      { focusId: 'f1', planned: 1, done: 1 },
      { focusId: 'f2', planned: 2, done: 1 },
    ]);
  });
});
