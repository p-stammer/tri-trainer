import { describe, expect, it } from 'vitest';
import { bulkCopyFrom, bulkScale, bulkSetFreshness, bulkSetPhase, canUndo, canonical, sameTargets, undoChanges } from './planEdit';
import type { WeekTargets } from './schemas';

const t = (run: number, phase?: WeekTargets['phase']): WeekTargets => ({
  ...(phase ? { phase } : {}),
  sports: [{ sport: 'run', distanceM: run }, { sport: 'bike', durationSec: 7200 }],
  focuses: [{ id: `f${run}`, sport: 'run', focus: 'long', count: 1 }],
});
const weeks = [
  { weekStart: '2026-11-16', current: t(30000, 'base') },
  { weekStart: '2026-11-23', current: t(32000) },
  { weekStart: '2026-11-30', current: t(34000, 'base') },
];

describe('Sammeländerungen', () => {
  it('Vergleich unabhängig von Feldreihenfolge', () => {
    expect(sameTargets({ sports: [], focuses: [], phase: 'base' }, { phase: 'base', focuses: [], sports: [] })).toBe(true);
    expect(canonical({ a: 1, b: undefined })).toBe(canonical({ a: 1 }));
  });

  it('Phase setzen: nur tatsächlich geänderte Wochen', () => {
    const c = bulkSetPhase(weeks, 'base');
    expect(c.map((x) => x.weekStart)).toEqual(['2026-11-23']);
    expect(bulkSetPhase(weeks, undefined)).toHaveLength(2);
  });

  it('Skalieren nur gewählter Sportarten', () => {
    const c = bulkScale(weeks, 0.9, ['run']);
    expect(c).toHaveLength(3);
    expect(c[0]?.after.sports.find((s) => s.sport === 'run')?.distanceM).toBe(27000);
    expect(c[0]?.after.sports.find((s) => s.sport === 'bike')?.durationSec).toBe(7200);
  });

  it('Woche übernehmen: Quelle bleibt unverändert, neue Schwerpunkt-IDs', () => {
    const c = bulkCopyFrom(weeks, weeks[0]!);
    expect(c.map((x) => x.weekStart)).toEqual(['2026-11-23', '2026-11-30']);
    expect(c[0]?.after.sports.find((s) => s.sport === 'run')?.distanceM).toBe(30000);
    expect(c[0]?.after.focuses[0]?.id).not.toBe('f30000');
  });

  it('Frischebereich setzen ordnet min/max', () => {
    const c = bulkSetFreshness(weeks.slice(0, 1), { min: 8, max: 6 });
    expect(c[0]?.after.freshnessTarget).toEqual({ min: 6, max: 8 });
  });

  it('Rückgängig nur ohne spätere Änderungen; Umkehrung tauscht Vorher/Nachher', () => {
    const change = { weeks: bulkScale(weeks, 0.5) };
    const applied = weeks.map((w) => ({ ...w, current: change.weeks.find((c) => c.weekStart === w.weekStart)!.after }));
    expect(canUndo(change, applied)).toBe(true);
    const changedLater = applied.map((w, i) => (i === 0 ? { ...w, current: t(1) } : w));
    expect(canUndo(change, changedLater)).toBe(false);
    const undo = undoChanges(change);
    expect(sameTargets(undo[0]?.after, weeks[0]?.current)).toBe(true);
  });
});
