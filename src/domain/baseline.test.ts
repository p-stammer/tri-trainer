import { describe, expect, it } from 'vitest';
import { baselineTotalDuration, cleanBaseline } from './baseline';
import { athleteProfileSchema } from './schemas';

describe('Aktueller Trainingsumfang', () => {
  it('entfernt leere Sportarten und gibt bei leerer Eingabe undefined zurück', () => {
    expect(cleanBaseline({ periodWeeks: 8, swim: {}, run: { distanceM: 30000 } })).toEqual({ periodWeeks: 8, run: { distanceM: 30000 } });
    expect(cleanBaseline({ periodWeeks: 8, swim: {} })).toBeUndefined();
  });

  it('Gesamtdauer nur, wenn jede angegebene Sportart eine Dauer hat', () => {
    expect(baselineTotalDuration({ swim: { durationSec: 7200 }, run: { durationSec: 10800, distanceM: 30000 } })).toBe(18000);
    expect(baselineTotalDuration({ swim: { durationSec: 7200 }, run: { distanceM: 30000 } })).toBeNull();
  });

  it('Profil mit Baseline ist gültig, Dezimal-Einheiten erlaubt', () => {
    const r = athleteProfileSchema.safeParse({
      id: 'me', updatedAt: '2026-11-17T08:00:00.000Z',
      baseline: { periodWeeks: 8, swim: { distanceM: 6000, sessions: 2.5 }, strength: { sessions: 1, durationSec: 3600 } },
    });
    expect(r.success).toBe(true);
  });
});
