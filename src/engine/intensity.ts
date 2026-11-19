/**
 * Modul F – Intensität (PLAN_MODEL 4.7).
 * Laufen bleibt locker (nur Z1–Z2, außer Renntempo-Anteil bei hohem Regler in der spezifischen Phase),
 * Z4–Z5 und der Großteil von Z3 liegen auf dem Rad (R6a, Produktentscheidung). Was nicht unterzubringen ist, entfällt mit Hinweis.
 */
import { ENDURANCE_SPORTS, type EnduranceSport, type ZoneSeconds } from '../domain/sports';
import { FIXED, type PhilosophyParams } from './params';
import type { WeekVolume } from './volume';

export interface WeekIntensity {
  zoneSec: Record<EnduranceSport, ZoneSeconds>;
  /** Geplante Zeit außerhalb Z1–Z2 vor der Verteilung (s). */
  targetNonLowSec: number;
  /** Nicht untergebrachte Intensität (W5). */
  droppedSec: number;
}

const round5 = (s: number) => Math.floor(s / FIXED.zoneRoundSec + 1e-9) * FIXED.zoneRoundSec;

export function planIntensity(weeks: readonly WeekVolume[], params: PhilosophyParams): WeekIntensity[] {
  const out: WeekIntensity[] = [];
  let prevTarget = 0;
  for (const w of weeks) {
    const f = w.frame;
    const dur = (s: EnduranceSport) => w.sport[s].durationSec;
    // Camp-Mehrumfang ist locker: Intensität wie in einer normalen Belastungswoche
    const total = dur('swim') + dur('bike') + dur('run') - (w.campExtraSec ?? 0);
    let x = (1 - params.lowIntensityShare) * total;
    if (f.phase === 'base' || f.kind === 'recovery' || f.kind === 'prep_race' || f.kind === 'post_race' || f.kind === 'post_camp') x *= FIXED.reducedIntensityFactor;
    if (f.kind === 'taper' && f.phase === 'race') x *= FIXED.reducedIntensityFactor;
    else if (f.kind === 'taper') x = Math.max(x, FIXED.taperIntensityKeep * prevTarget);
    x = Math.max(0, x);

    let z3 = params.z3ShareOfNonLow * x;
    const high = x - z3;
    let z5 = params.z5ShareOfHigh * high;
    let z4 = high - z5;

    // Laufen: nur Renntempo-Anteil (Z3) in der spezifischen Phase bei hohem Regler.
    const runZ3 = f.phase === 'specific' && f.kind === 'loading' ? round5(Math.min(z3, params.runRacePaceShare * dur('run'))) : 0;
    z3 -= runZ3;

    // Rad: Z4–Z5 vollständig (höchstens Radzeit), Z3 bis 35 % der Radzeit.
    const bike = dur('bike');
    const bikeZ5 = round5(Math.min(z5, bike));
    const bikeZ4 = round5(Math.min(z4, bike - bikeZ5));
    const bikeZ3 = round5(Math.max(0, Math.min(z3, FIXED.bikeMaxZ3Share * bike, bike - bikeZ5 - bikeZ4)));
    let rest = z3 - bikeZ3 + (z4 - bikeZ4) + (z5 - bikeZ5);
    z4 = bikeZ4;
    z5 = bikeZ5;

    // Schwimmen: Rest als Z4 bis 30 % der Schwimmzeit.
    const swimZ4 = round5(Math.max(0, Math.min(rest, FIXED.swimMaxNonLowShare * dur('swim'))));
    rest -= swimZ4;

    const zoneSec = {} as Record<EnduranceSport, ZoneSeconds>;
    const set = (s: EnduranceSport, hi: ZoneSeconds) => {
      const d = dur(s);
      if (d <= 0) {
        zoneSec[s] = {};
        return;
      }
      const used = (hi.z3 ?? 0) + (hi.z4 ?? 0) + (hi.z5 ?? 0);
      const zs: ZoneSeconds = { z2: d - used };
      for (const k of ['z3', 'z4', 'z5'] as const) if ((hi[k] ?? 0) > 0) zs[k] = hi[k];
      zoneSec[s] = zs;
    };
    set('run', { z3: runZ3 });
    set('bike', { z3: bikeZ3, z4, z5 });
    set('swim', { z4: swimZ4 });
    for (const s of ENDURANCE_SPORTS) if (dur(s) <= 0) zoneSec[s] = {};

    out.push({ zoneSec, targetNonLowSec: x, droppedSec: Math.max(0, rest) });
    prevTarget = x;
  }
  return out;
}
