/** Testhilfen für den Plangenerator (nur in Tests verwendet). */
import { planWeekStarts } from '../domain/plan';
import { defaultGeneratorSettings, type AthleteProfile, type GeneratorSettings, type TargetRace } from '../domain/schemas';
import type { PlanGeneratorInput } from './types';

export const TODAY = '2026-11-17';
export const FIRST_WEEK = '2026-11-23';

export function race(overrides: Partial<TargetRace> = {}): TargetRace {
  return {
    id: 'race',
    name: 'Ironman Frankfurt',
    date: '2027-06-27',
    preset: 'full',
    swimM: 3800,
    bikeM: 180_000,
    runM: 42_195,
    prepStartDate: '2026-11-16',
    createdAt: 'x1234567890',
    updatedAt: 'x1234567890',
    ...overrides,
  };
}

export function profile(overrides: Partial<AthleteProfile> = {}): AthleteProfile {
  return {
    id: 'me',
    birthDate: '1990-05-01',
    availableWeeklySec: 12 * 3600,
    baseline: {
      periodWeeks: 4,
      swim: { durationSec: 1.5 * 3600, distanceM: 4000, sessions: 2 },
      bike: { durationSec: 3 * 3600, distanceM: 85_000, sessions: 2 },
      run: { durationSec: 3600, distanceM: 10_000, sessions: 2 },
      strength: { durationSec: 3600, sessions: 1 },
    },
    updatedAt: '2026-11-10T10:00:00.000Z',
    ...overrides,
  };
}

export function input(o: {
  profile?: AthleteProfile | null;
  settings?: Partial<GeneratorSettings>;
  race?: TargetRace;
  extra?: Partial<PlanGeneratorInput>;
} = {}): PlanGeneratorInput {
  const r = o.race ?? race();
  const settings: GeneratorSettings = {
    ...defaultGeneratorSettings('plan', 'x1234567890'),
    longestRecentRun: { distanceM: 6000, durationSec: 36 * 60, asOf: TODAY },
    ...o.settings,
  };
  return {
    today: TODAY,
    race: r,
    firstWeek: FIRST_WEEK,
    planWeeks: planWeekStarts(r.prepStartDate, r.date),
    profile: o.profile === undefined ? profile() : o.profile,
    settings,
    prepRaces: [],
    metrics: [],
    history: [],
    wellness: [],
    pauses: [],
    painIssues: [],
    painObservations: [],
    ...o.extra,
  };
}
