/**
 * Modul E – Umfang (PLAN_MODEL 4.3–4.6) plus lange Einheiten (4.5).
 * Vorwärtsrechnung: Woche i = min(Wunsch, harte Grenzen). Lauf-Fehlbetrag geht aufs Rad, das Zeitbudget wird nie überschritten.
 */
import { ENDURANCE_SPORTS, SPORT_LABEL, type EnduranceSport } from '../domain/sports';
import { formatDurationShort } from '../domain/units';
import { startDuration } from './inputs';
import { disciplineWeights, FIXED, growthFor, raceClass, volumeCeilingSec, type PhilosophyParams, type RaceClass } from './params';
import { floorVolume, longRunCap, longSessionCap, longSessionRef, progressionCap } from './limits';
import { isReferenceWeek } from './phases';
import type { AppliedPriority, Baseline, Explanation, WeekFrame } from './types';
import type { GeneratorSettings, PerformanceMetric } from '../domain/schemas';
import { formatPace } from '../domain/units';

export interface SportVolume {
  durationSec: number;
  distanceM?: number;
}

export interface WeekVolume {
  frame: WeekFrame;
  sport: Record<EnduranceSport, SportVolume>;
  strengthSessions: number;
  strengthSec: number;
  longRun?: { durationSec: number; distanceM?: number };
  longRide?: { durationSec: number };
  /** Wunschumfang je Sportart (für Warnungen und Begründungen). */
  wish: Record<EnduranceSport, number>;
  /** Zeit, die wegen der Laufgrenzen aufs Rad verschoben werden sollte. */
  runShortfallSec: number;
  /** Mehrumfang durch ein Trainingslager (locker, zählt nicht in die Intensitätsberechnung). */
  campExtraSec?: number;
  reasons: string[];
}

export interface VolumeContext {
  /** Effektive Startwerte (Dauer) je Sportart. */
  start: Record<EnduranceSport, number>;
  /** Verhältnis Distanz/Dauer (m/s) für Distanzziele – eigenes Tempo oder Schätzung aus Leistungswerten (1.4.0). */
  ratio: Partial<Record<EnduranceSport, number>>;
  ratioSource: Partial<Record<EnduranceSport, RatioSource>>;
  /** Spitzen-Wunschumfang je Sportart. */
  peak: Record<EnduranceSport, number>;
  maxDur: Record<EnduranceSport, number>;
  maxDist: Partial<Record<EnduranceSport, number>>;
  strengthSessionSec: number;
  longRunStart: { durationSec: number; distanceM?: number };
  longRideStart: number;
  raceClass: RaceClass;
  /** Obergrenze Wochenumfang inkl. Kraft nach Wettkampfklasse und Regler (R22). */
  ceilingSec: number;
  /** Ausgangsumfang gesamt (Ausdauer + Kraft). */
  startTotalSec: number;
  /** Harte Wochengrenze: min(Budget, max(Obergrenze, Ausgangsumfang)) – niemand wird unter seinen aktuellen Umfang gezwungen. */
  weekCapSec: number;
}

export type RatioSource = { kind: 'baseline' } | { kind: 'longest'; paceSec: number } | { kind: 'metric'; metricPace: number; paceSec: number };

/** Neuester Wert einer Leistungskennzahl. */
function latestMetric(metrics: readonly PerformanceMetric[], kind: PerformanceMetric['kind']): number | undefined {
  return [...metrics].filter((m) => m.kind === kind).sort((a, b) => b.date.localeCompare(a.date))[0]?.value;
}

export function volumeContext(
  baseline: Baseline,
  params: PhilosophyParams,
  priorities: readonly AppliedPriority[],
  settings: Pick<GeneratorSettings, 'maxWeekly'>,
  race: { swimM: number; bikeM: number; runM: number },
  metrics: readonly PerformanceMetric[] = [],
): VolumeContext {
  const raceSwimM = race.swimM;
  const cls = raceClass(race);
  const ceilingSec = volumeCeilingSec(cls);
  const start = {} as Record<EnduranceSport, number>;
  const ratio: Partial<Record<EnduranceSport, number>> = {};
  const ratioSource: Partial<Record<EnduranceSport, RatioSource>> = {};
  const maxDur = {} as Record<EnduranceSport, number>;
  const maxDist: Partial<Record<EnduranceSport, number>> = {};
  for (const s of ENDURANCE_SPORTS) {
    const sb = baseline.bySport[s];
    start[s] = startDuration(sb, s);
    if (sb?.durationSec && sb.distanceM) {
      ratio[s] = sb.distanceM / sb.durationSec;
      ratioSource[s] = { kind: 'baseline' };
    } else if (s === 'run' && sb?.longestSec && sb.longestM) {
      ratio[s] = sb.longestM / sb.longestSec;
      ratioSource[s] = { kind: 'longest', paceSec: (sb.longestSec / sb.longestM) * 1000 };
    } else if (s === 'run') {
      const thr = latestMetric(metrics, 'run_threshold_pace_s_per_km');
      if (thr) {
        const pace = thr * FIXED.runEasyPaceFactor;
        ratio[s] = 1000 / pace;
        ratioSource[s] = { kind: 'metric', metricPace: thr, paceSec: pace };
      }
    } else if (s === 'swim') {
      const css = latestMetric(metrics, 'swim_css_s_per_100m');
      if (css) {
        const pace = css * FIXED.swimSessionPaceFactor;
        ratio[s] = 100 / pace;
        ratioSource[s] = { kind: 'metric', metricPace: css, paceSec: pace };
      }
    }
    const lim = settings.maxWeekly?.[s];
    let md = lim?.durationSec ?? Infinity;
    const k = ratio[s];
    if (lim?.distanceM !== undefined) {
      maxDist[s] = lim.distanceM;
      if (k) md = Math.min(md, lim.distanceM / k);
    }
    maxDur[s] = md;
  }
  const str = baseline.bySport.strength;
  const strengthSessionSec = str?.sessions && str.durationSec ? str.durationSec / str.sessions : FIXED.strengthDefaultSessionSec;
  const weights = disciplineWeights(Object.fromEntries(priorities.map((p) => [p.sport, p.applied])));
  const startTotalSec = ENDURANCE_SPORTS.reduce((a, s) => a + (baseline.bySport[s]?.durationSec ?? 0), 0) + (str?.durationSec ?? 0);
  const weekCapSec = Math.min(baseline.budgetSec, Math.max(ceilingSec, startTotalSec));
  const peakTotal = Math.min(FIXED.peakBudgetShare * baseline.budgetSec, ceilingSec);
  const enduranceBudget = peakTotal - params.strengthSessions * strengthSessionSec;
  const peak = {} as Record<EnduranceSport, number>;
  for (const s of ENDURANCE_SPORTS) peak[s] = Math.max(0, weights[s] * enduranceBudget);
  // R11: Schwimmen braucht genug Wochenumfang für die Renndistanz – Untergrenze der Spitze, Rest anteilig auf Rad/Laufen.
  // Vielfaches der Renndistanz nach Schwimm-Priorität: 1 → 1,5×, 3 → 2×, 5 → 2,5× (1.4.0).
  const swimPrio = priorities.find((p) => p.sport === 'swim')?.applied ?? 3;
  const swimMultiple = Math.min(2.5, Math.max(1.5, 2 + 0.25 * (swimPrio - 3)));
  const swimFloor = Math.min(
    FIXED.swimPeakMaxShare * Math.max(0, enduranceBudget),
    ratio.swim ? (swimMultiple * raceSwimM) / ratio.swim : Math.max(3600, ((swimMultiple / 2.5) * FIXED.swimPeakFallbackSecPer3800 * raceSwimM) / 3800),
  );
  if (raceSwimM > 0 && swimFloor > peak.swim) {
    const rest = Math.max(0, enduranceBudget - swimFloor);
    const bikeRun = weights.bike + weights.run;
    peak.swim = swimFloor;
    peak.bike = (rest * weights.bike) / bikeRun;
    peak.run = (rest * weights.run) / bikeRun;
  }
  for (const s of ENDURANCE_SPORTS) peak[s] = Math.min(peak[s], maxDur[s]);

  const run = baseline.bySport.run;
  const longRunStart: VolumeContext['longRunStart'] = {
    durationSec: run?.entry ? FIXED.entryLongRunSec : (run?.longestSec ?? FIXED.entryLongRunSec),
  };
  if (run?.longestM !== undefined && !run.entry) longRunStart.distanceM = run.longestM;
  else if (ratio.run) longRunStart.distanceM = longRunStart.durationSec * ratio.run;
  const bike = baseline.bySport.bike;
  const longRideStart = bike?.longestSec ?? FIXED.longRideShareOfWeek * start.bike;

  return { start, ratio, ratioSource, peak, maxDur, maxDist, strengthSessionSec, longRunStart, longRideStart, raceClass: cls, ceilingSec, startTotalSec, weekCapSec };
}

/** Wunschumfang (4.3): linear vom Start zur Spitze bis zum Beginn der spezifischen Phase; nie unter den Start. */
export function wishFor(ctx: VolumeContext, sport: EnduranceSport, index: number, specificStart: number): number {
  const b = ctx.start[sport];
  const p = ctx.peak[sport];
  if (p <= b) return b;
  return b + (p - b) * Math.min(1, (index + 1) / Math.max(1, specificStart));
}

const ORDER: readonly EnduranceSport[] = ['swim', 'run', 'bike'];

/** Zeitbudget einer Camp-Woche: Camp-Tage mit den Camp-Stunden, übrige Tage anteilig mit dem normalen Budget. */
export function campBudgetSec(weekBudgetSec: number, camp: { days: number; hoursPerDay: number }): number {
  const d = Math.min(7, camp.days);
  return Math.round(weekBudgetSec * ((7 - d) / 7) + camp.hoursPerDay * 3600 * d);
}

export function projectVolumes(
  frames: readonly WeekFrame[],
  ctx: VolumeContext,
  baseline: Baseline,
  params: PhilosophyParams,
  specificStart: number,
  taperWeeks: 1 | 2 | 3,
  prepRaceRunSec: (frame: WeekFrame) => number | undefined,
): { weeks: WeekVolume[]; explanations: Explanation[] } {
  const explanations: Explanation[] = [];
  const refHist: Record<EnduranceSport, number[]> = { swim: [], bike: [], run: [] };
  const refHistDist: Record<EnduranceSport, number[]> = { swim: [], bike: [], run: [] };
  const lastPlanned = { ...ctx.start };
  const lastRef = { ...ctx.start };
  const peakRef = { ...ctx.start };
  const longRunHist: number[] = [];
  const longRunHistM: number[] = [];
  const longRideHist: number[] = [];
  let lastLongRun = ctx.longRunStart;
  let lastLongRide = ctx.longRideStart;
  const n = frames.length;
  const taperStart = n - Math.min(taperWeeks, n);
  const strBase = Math.round(baseline.bySport.strength?.sessions ?? 0);
  const longMax = { sec: FIXED.longRunMaxSec, m: FIXED.longRunMaxM };
  const weeks: WeekVolume[] = [];

  for (const f of frames) {
    const i = f.index;
    const reasons: string[] = [];
    const wish = {} as Record<EnduranceSport, number>;
    const sport = {} as Record<EnduranceSport, SportVolume>;
    let runShortfallSec = 0;
    const scalesWithLoad = f.kind === 'loading' || f.kind === 'prep_race' || f.kind === 'post_race' || f.kind === 'post_camp' || f.kind === 'camp';

    for (const s of ORDER) {
      const g = growthFor(s, params);
      wish[s] = wishFor(ctx, s, i, specificStart);
      let target = wish[s];
      if (s === 'bike') target += runShortfallSec;
      const cap = progressionCap(refHist[s], ctx.start[s], g);
      let load = Math.min(target, cap, ctx.maxDur[s]);
      if (f.freeze.includes(s)) load = Math.min(load, lastPlanned[s]);
      if (s === 'run') runShortfallSec = Math.max(0, wish.run - load) * f.factor;

      let v: number;
      if (scalesWithLoad) v = load * f.factor;
      else if (f.kind === 'recovery') v = lastRef[s] * (1 - params.recoveryCut);
      else v = peakRef[s] * (FIXED.taperFactors[taperWeeks][i - taperStart] ?? 0.45);
      v = floorVolume(v * f.availability[s], 'sec');

      const k = ctx.ratio[s];
      const vol: SportVolume = { durationSec: v };
      if (k) {
        let distCap = Infinity;
        if (scalesWithLoad) {
          distCap = Math.min(progressionCap(refHistDist[s], ctx.start[s] * k, g), ctx.maxDist[s] ?? Infinity) * f.factor * f.availability[s];
        }
        vol.distanceM = floorVolume(Math.min(v * k, distCap), 'm');
      }
      sport[s] = vol;
    }
    if (runShortfallSec > 0 && scalesWithLoad) {
      reasons.push(`Laufen begrenzt: ${formatDurationShort(runShortfallSec)} vom Wunsch gehen soweit zulässig aufs Rad`);
    }

    // Trainingslager (1.8.0): Mehrumfang auf Rad und Schwimmen bis zur Camp-Grenze und zum Camp-Budget.
    let campExtraSec = 0;
    if (f.kind === 'camp' && f.camp) {
      const d = f.camp.days / 7;
      const campBudget = campBudgetSec(baseline.budgetSec, f.camp);
      const normal = sport.swim.durationSec + sport.bike.durationSec + sport.run.durationSec;
      // Kraft im Camp höchstens 1 Einheit (s. u.) – Platz dafür freihalten
      let room = Math.max(0, campBudget - normal - floorVolume(Math.min(1, params.strengthSessions) * ctx.strengthSessionSec, 'sec'));
      const before = { swim: sport.swim.durationSec, bike: sport.bike.durationSec };
      for (const s of ['bike', 'swim'] as const) {
        const g = growthFor(s, params);
        const campCap = Math.min(progressionCap(refHist[s], ctx.start[s], g) * (1 + FIXED.camp.growth[s] * d), ctx.maxDur[s]) * f.availability[s];
        const add = floorVolume(Math.max(0, Math.min(campCap - sport[s].durationSec, room)), 'sec');
        sport[s].durationSec += add;
        room -= add;
        const k = ctx.ratio[s];
        if (k && sport[s].distanceM !== undefined) {
          const distCap = Math.min(progressionCap(refHistDist[s], ctx.start[s] * k, g), ctx.maxDist[s] ?? Infinity) * (1 + FIXED.camp.growth[s] * d) * f.availability[s];
          sport[s].distanceM = floorVolume(Math.min(sport[s].durationSec * k, distCap), 'm');
        }
      }
      campExtraSec = sport.swim.durationSec - before.swim + (sport.bike.durationSec - before.bike);
      reasons.push(
        `${f.camp.name}: +${formatDurationShort(campExtraSec)} locker (Rad ${formatDurationShort(sport.bike.durationSec - before.bike)}, Schwimmen ${formatDurationShort(sport.swim.durationSec - before.swim)}); Laufen nach den normalen Grenzen. Camp-Budget diese Woche ${formatDurationShort(campBudget)}.`,
      );
    }

    // Kraft (4.8): +1 Einheit je 2 Wochen ab Ausgangswert, höchstens nach Regler; reduziert in Entlastung/Taper/Rennen.
    let strengthSessions = Math.min(params.strengthSessions, strBase + 1 + Math.floor(i / 2));
    if (f.kind !== 'loading') strengthSessions = Math.min(1, strengthSessions);
    if (i === n - 1) strengthSessions = 0;
    strengthSessions = Math.floor(strengthSessions * f.availability.strength + 1e-9);

    // Budget (H4, 4.6): Reihenfolge Rad → Schwimmen über Mindestumfang → Laufen (bis −10 %) → Kraft → proportional.
    const strengthSecOf = (n2: number) => floorVolume(n2 * ctx.strengthSessionSec, 'sec');
    const total = () => sport.swim.durationSec + sport.bike.durationSec + sport.run.durationSec + strengthSecOf(strengthSessions);
    const cap = f.kind === 'camp' && f.camp ? campBudgetSec(baseline.budgetSec, f.camp) : ctx.weekCapSec;
    let excess = total() - cap;
    if (excess > 0) {
      const before = total();
      const cut = (s: EnduranceSport, floor: number) => {
        if (excess <= 0) return;
        const room = Math.max(0, sport[s].durationSec - floor);
        const d = Math.min(room, Math.ceil(excess / 60) * 60);
        sport[s].durationSec -= d;
        excess -= d;
      };
      cut('bike', Math.min(sport.bike.durationSec, FIXED.entrySec.bike));
      cut('swim', Math.min(sport.swim.durationSec, FIXED.swimMinSec));
      cut('run', Math.min(sport.run.durationSec, floorVolume(0.9 * lastPlanned.run, 'sec')));
      while (excess > 0 && strengthSessions > 0) {
        strengthSessions -= 1;
        excess = total() - cap;
      }
      if (excess > 0) {
        const endu = sport.swim.durationSec + sport.bike.durationSec + sport.run.durationSec;
        const factor = endu > 0 ? Math.max(0, (endu - excess) / endu) : 0;
        for (const s of ENDURANCE_SPORTS) sport[s].durationSec = floorVolume(sport[s].durationSec * factor, 'sec');
      }
      for (const s of ENDURANCE_SPORTS) {
        const k = ctx.ratio[s];
        const vol = sport[s];
        if (k && vol.distanceM !== undefined) vol.distanceM = Math.min(vol.distanceM, floorVolume(vol.durationSec * k, 'm'));
      }
      reasons.push(
        cap < baseline.budgetSec
          ? `Obergrenze: ${formatDurationShort(before - total())} gekürzt, Woche höchstens ${formatDurationShort(cap)} (R22)`
          : `Zeitbudget: ${formatDurationShort(before - total())} gekürzt, damit die Woche in ${formatDurationShort(cap)} passt`,
      );
    }
    const strengthSec = strengthSecOf(strengthSessions);

    // Lange Einheiten (4.5)
    const isLast = i === n - 1;
    const w: WeekVolume = { frame: f, sport, strengthSessions, strengthSec, wish, runShortfallSec, reasons, ...(campExtraSec > 0 ? { campExtraSec } : {}) };
    const runV = sport.run.durationSec;
    const kRun = ctx.ratio.run;
    const raceRun = f.kind === 'prep_race' ? prepRaceRunSec(f) : undefined;
    if (runV > 0 && !isLast && f.kind !== 'prep_race') {
      const ref = longSessionRef(longRunHist, ctx.longRunStart.durationSec);
      let L: number;
      if (f.kind === 'loading' || f.kind === 'camp') {
        L = Math.min(longRunCap(ref, runV, 'sec', longMax), runV);
        if (f.freeze.includes('run')) L = Math.min(L, ref);
      } else {
        L = Math.min(lastLongRun.durationSec * FIXED.reducedLongFactor, FIXED.reducedLongShareOfWeek * runV);
      }
      L = floorVolume(L, 'sec');
      const lr: NonNullable<WeekVolume['longRun']> = { durationSec: L };
      if (kRun && sport.run.distanceM !== undefined) {
        const refM = longSessionRef(longRunHistM, ctx.longRunStart.distanceM ?? ctx.longRunStart.durationSec * kRun);
        const capM = f.kind === 'loading' || f.kind === 'camp' ? longRunCap(refM, sport.run.distanceM, 'm', longMax) : Infinity;
        lr.distanceM = floorVolume(Math.min(L * kRun, capM, sport.run.distanceM), 'm');
      }
      if (L > 0) {
        w.longRun = lr;
        if (f.kind === 'loading' || f.kind === 'camp') lastLongRun = lr;
      }
    }
    // Ein Rennen zählt als langer Lauf, hebt die Referenz aber höchstens um die erlaubten 10 % (H2 bleibt gültig).
    const refSec = longSessionRef(longRunHist, ctx.longRunStart.durationSec);
    longRunHist.push(f.kind === 'prep_race' ? Math.min(raceRun ?? 0, refSec * (1 + FIXED.longRunGrowth)) : (w.longRun?.durationSec ?? 0));
    if (kRun) {
      const refM = longSessionRef(longRunHistM, ctx.longRunStart.distanceM ?? ctx.longRunStart.durationSec * kRun);
      longRunHistM.push(f.kind === 'prep_race' ? Math.min(raceRun !== undefined ? raceRun * kRun : 0, refM * (1 + FIXED.longRunGrowth)) : (w.longRun?.distanceM ?? 0));
    }

    const bikeV = sport.bike.durationSec;
    if (bikeV > 0 && !isLast && f.kind !== 'prep_race') {
      const ref = longSessionRef(longRideHist, ctx.longRideStart);
      let L =
        f.kind === 'loading'
          ? Math.min(longSessionCap(ref, bikeV, params.otherGrowth, FIXED.longRideShareOfWeek, FIXED.longRideMaxSec), bikeV)
          : f.kind === 'camp'
            ? Math.min(
                FIXED.longRideMaxSec,
                Math.max(longSessionCap(ref, bikeV, params.otherGrowth, FIXED.longRideShareOfWeek, FIXED.longRideMaxSec), Math.min(ref * (1 + FIXED.camp.longRideGrowth), FIXED.camp.longRideShareOfWeek * bikeV)),
                bikeV,
              )
            : Math.min(lastLongRide * FIXED.reducedLongFactor, FIXED.reducedLongShareOfWeek * bikeV);
      if (f.kind === 'loading' && f.freeze.includes('bike')) L = Math.min(L, ref);
      L = floorVolume(L, 'sec');
      if (L > 0) {
        w.longRide = { durationSec: L };
        if (f.kind === 'loading') lastLongRide = L;
      }
    }
    // Camp-Ausfahrten heben die Referenz für die Folgewochen höchstens um die normale Steigerung
    const rideRef = longSessionRef(longRideHist, ctx.longRideStart);
    longRideHist.push(f.kind === 'camp' ? Math.min(w.longRide?.durationSec ?? 0, rideRef * (1 + params.otherGrowth)) : (w.longRide?.durationSec ?? 0));

    for (const s of ENDURANCE_SPORTS) {
      lastPlanned[s] = sport[s].durationSec;
      if (isReferenceWeek(f)) {
        refHist[s].push(sport[s].durationSec);
        if (sport[s].distanceM !== undefined) refHistDist[s].push(sport[s].distanceM ?? 0);
        lastRef[s] = sport[s].durationSec;
        peakRef[s] = Math.max(peakRef[s], sport[s].durationSec);
      }
    }
    weeks.push(w);
  }

  for (const s of ['run', 'swim'] as const) {
    const src = ctx.ratioSource[s];
    if (!src || src.kind === 'baseline') continue;
    const unit = s === 'run' ? '/km' : '/100 m';
    explanations.push({
      sport: s,
      text:
        src.kind === 'longest'
          ? `${SPORT_LABEL[s]}: Distanzen aus deinem Tempo beim längsten Lauf (${formatPace(src.paceSec)} ${unit}).`
          : `${SPORT_LABEL[s]}: Distanzen geschätzt aus ${s === 'run' ? 'Schwellenpace' : 'CSS'} ${formatPace(src.metricPace)} ${unit} (lockeres Tempo${s === 'swim' ? ' inkl. Pausen' : ''} ≈ ${formatPace(src.paceSec)} ${unit}). Das ist eine Schätzung – mit deinem echten Wochenumfang in km rechnet der Plan mit deinem eigenen Tempo.`,
      rules: ['H'],
      inputs: src.kind === 'longest' ? ['settings.longestRecentRun'] : ['metrics'],
    });
  }
  for (const s of ENDURANCE_SPORTS) {
    const sb = baseline.bySport[s];
    explanations.push({
      sport: s,
      text: `${SPORT_LABEL[s]}: Start bei ${formatDurationShort(ctx.start[s])} pro Woche${sb?.entry ? ' (Einstiegsumfang)' : ' (dein aktueller Umfang)'}, Ziel in Spitzenwochen ${formatDurationShort(ctx.peak[s])}. Steigerung höchstens ${(growthFor(s, params) * 100).toLocaleString('de-DE', { maximumFractionDigits: 1 })} % pro Belastungswoche.`,
      rules: s === 'run' ? ['R0', 'R5', 'R17'] : ['R0', 'R5'],
      inputs: [`profile.baseline.${s}`, 'profile.availableWeeklySec', 'settings.philosophy'],
    });
  }
  return { weeks, explanations };
}
