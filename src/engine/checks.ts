/**
 * Modul H – zweite Prüfung aller harten Grenzen und Warnungen (PLAN_MODEL 5, 6).
 * Die Prüfung rechnet unabhängig von Modul E aus dem fertigen Ergebnis nach. Verletzungen müssen leer sein.
 */
import { formatDateDe } from '../domain/calendar';
import type { PrepRace, TargetRace } from '../domain/schemas';
import { ENDURANCE_SPORTS, SPORT_LABEL, type EnduranceSport } from '../domain/sports';
import { formatDistance, formatDurationShort } from '../domain/units';
import { FIXED, growthFor, VOLUME_NORMS, type PhilosophyParams } from './params';
import { longSessionRef, progressionCap } from './limits';
import { isReferenceWeek } from './phases';
import type { WeekIntensity } from './intensity';
import { campBudgetSec, type VolumeContext, type WeekVolume } from './volume';
import type { AppliedPriority, Violation, Warning } from './types';

const EPS = 1; // 1 s bzw. 1 m Toleranz für Gleitkomma

export function checkHardLimits(
  weeks: readonly WeekVolume[],
  intensity: readonly WeekIntensity[],
  ctx: VolumeContext,
  params: PhilosophyParams,
  budgetSec: number,
  prepRaceRunSec: (w: WeekVolume) => number | undefined,
): Violation[] {
  const v: Violation[] = [];
  const ref: Record<EnduranceSport, number[]> = { swim: [], bike: [], run: [] };
  const refDist: Record<EnduranceSport, number[]> = { swim: [], bike: [], run: [] };
  const longHist: number[] = [];
  for (const [i, w] of weeks.entries()) {
    const f = w.frame;
    const scales = f.kind === 'loading' || f.kind === 'prep_race' || f.kind === 'post_race' || f.kind === 'post_camp' || f.kind === 'camp';
    const campBoost = (s: EnduranceSport) => (f.kind === 'camp' && f.camp ? 1 + FIXED.camp.growth[s] * (f.camp.days / 7) : 1);
    for (const s of ENDURANCE_SPORTS) {
      const g = growthFor(s, params);
      const vol = w.sport[s];
      if (scales) {
        const cap = progressionCap(ref[s], ctx.start[s], g) * f.factor * f.availability[s] * campBoost(s);
        if (vol.durationSec > cap + EPS) v.push({ rule: s === 'run' ? 'H1' : 'H3', weekStart: f.weekStart, sport: s, detail: `${vol.durationSec} s > ${Math.round(cap)} s` });
        const k = ctx.ratio[s];
        if (k && vol.distanceM !== undefined) {
          const capM = progressionCap(refDist[s], ctx.start[s] * k, g) * f.factor * f.availability[s] * campBoost(s);
          if (vol.distanceM > capM + EPS) v.push({ rule: s === 'run' ? 'H1' : 'H3', weekStart: f.weekStart, sport: s, detail: `${vol.distanceM} m > ${Math.round(capM)} m` });
        }
      }
      if (vol.durationSec > ctx.maxDur[s] + EPS) v.push({ rule: 'H5', weekStart: f.weekStart, sport: s, detail: 'individueller Höchstwert' });
      if (f.availability[s] === 0 && vol.durationSec > 0) v.push({ rule: 'H6', weekStart: f.weekStart, sport: s, detail: 'Umfang trotz vollständiger Pause' });
      if (isReferenceWeek(f)) {
        ref[s].push(vol.durationSec);
        if (vol.distanceM !== undefined) refDist[s].push(vol.distanceM);
      }
    }
    // H2: langer Lauf
    const lr = w.longRun?.durationSec ?? 0;
    const refL = longSessionRef(longHist, ctx.longRunStart.durationSec);
    if (lr > (1 + FIXED.longRunGrowth) * refL + EPS) v.push({ rule: 'H2', weekStart: f.weekStart, sport: 'run', detail: `${lr} s > 1,1 × ${Math.round(refL)} s` });
    const race = f.kind === 'prep_race' ? prepRaceRunSec(w) : undefined;
    longHist.push(f.kind === 'prep_race' ? Math.min(race ?? 0, (1 + FIXED.longRunGrowth) * refL) : lr);
    // H4: Budget
    const total = w.sport.swim.durationSec + w.sport.bike.durationSec + w.sport.run.durationSec + w.strengthSec;
    if (f.kind === 'camp' && f.camp) {
      // Camp-Woche: eigenes Budget (Camp-Tage × Stunden + übrige Tage anteilig); R22 gilt hier nicht
      const cb = campBudgetSec(budgetSec, f.camp);
      if (total > cb + EPS) v.push({ rule: 'H4', weekStart: f.weekStart, detail: `${total} s > Camp-Budget ${cb} s` });
    } else {
      if (total > budgetSec + EPS) v.push({ rule: 'H4', weekStart: f.weekStart, detail: `${total} s > ${budgetSec} s` });
      if (total > ctx.weekCapSec + EPS) v.push({ rule: 'H10', weekStart: f.weekStart, detail: `${total} s > Obergrenze ${ctx.weekCapSec} s` });
    }
    // H7: Laufen locker
    const z = intensity[i]?.zoneSec.run ?? {};
    const hard = (z.z4 ?? 0) + (z.z5 ?? 0);
    const allowedZ3 = params.runRacePaceShare * w.sport.run.durationSec + EPS;
    if (hard > 0 || (z.z3 ?? 0) > allowedZ3) v.push({ rule: 'H7', weekStart: f.weekStart, sport: 'run', detail: 'Laufintensität über dem Renntempo-Anteil' });
  }
  return v;
}

export function collectWarnings(args: {
  weeks: readonly WeekVolume[];
  intensity: readonly WeekIntensity[];
  ctx: VolumeContext;
  race: TargetRace;
  priorities: readonly AppliedPriority[];
  usedPrepRaces: readonly PrepRace[];
  freezeReasons: readonly string[];
  taperWeeks: number;
  budgetSec: number;
}): Warning[] {
  const { weeks, ctx, race } = args;
  const out: Warning[] = [];

  // W10/W11: Zeitbudget im Verhältnis zu den beobachteten Umfängen (R22)
  const norm = VOLUME_NORMS[ctx.raceClass];
  const budgetH = args.budgetSec / 3600;
  const label = { full: 'eine Langdistanz', half: 'eine Mitteldistanz', olympic: 'eine olympische Distanz', sprint: 'eine Sprintdistanz' }[ctx.raceClass];
  if (budgetH < norm.importantBelowH) {
    out.push({
      code: 'W10',
      severity: 'important',
      text: `${formatDurationShort(args.budgetSec)} pro Woche sind für ${label} sehr wenig. ${ctx.raceClass === 'full' ? 'Freizeit-Finisher trainieren in Studien im Mittel etwa 14 h pro Woche (± 5 h). ' : ''}Der Plan nutzt die Zeit so gut wie möglich, aber ein sicheres Finish ist damit nicht wahrscheinlich. Mehr Zeit, ein späteres Rennen oder eine kürzere Distanz wären sinnvoller.`,
    });
  } else if (budgetH < norm.cautionBelowH) {
    out.push({
      code: 'W10',
      severity: 'caution',
      text: `${formatDurationShort(args.budgetSec)} pro Woche liegen für ${label} unter dem Bereich, in dem die meisten Freizeit-Athleten trainieren${ctx.raceClass === 'full' ? ' (etwa 9–19 h)' : ''}. Ein Finish ist möglich, rechne aber mit wenig Reserven.`,
    });
  }
  if (args.budgetSec > ctx.weekCapSec + 60 && ctx.weekCapSec === ctx.ceilingSec) {
    out.push({
      code: 'W11',
      severity: 'info',
      text: `Dein Zeitbudget (${formatDurationShort(args.budgetSec)}) liegt über der Obergrenze für diese Distanz: höchstens ${formatDurationShort(ctx.ceilingSec)} pro Woche. Mehr Umfang ist in Studien zu Freizeit-Athleten kein verlässlicher Vorteil, erhöht aber Belastung und Risiko. Die übrige Zeit bleibt frei.`,
    });
  } else if (ctx.startTotalSec > ctx.ceilingSec + 60) {
    out.push({
      code: 'W11',
      severity: 'info',
      text: `Dein aktueller Umfang (${formatDurationShort(ctx.startTotalSec)}) liegt schon über der Obergrenze für diese Distanz (${formatDurationShort(ctx.ceilingSec)}). Der Plan senkt ihn nicht zwangsweise, steigert ihn aber nicht weiter.`,
    });
  }
  const preTaper = weeks.slice(0, Math.max(0, weeks.length - args.taperWeeks));

  // W1: langer Lauf vor dem Taper
  if (race.runM >= 30_000 && ctx.start.run > 0) {
    let bestSec = 0;
    let bestM = 0;
    for (const w of preTaper) {
      bestSec = Math.max(bestSec, w.longRun?.durationSec ?? 0);
      bestM = Math.max(bestM, w.longRun?.distanceM ?? 0);
    }
    const short = bestSec < FIXED.longRunSoftTargetSec && (bestM === 0 || bestM < FIXED.longRunSoftTargetM);
    if (short) {
      const peakRun = Math.max(...preTaper.map((w) => w.sport.run.durationSec));
      const shareLimited = bestSec >= FIXED.longRunShareOfWeek * peakRun - 120;
      const reason = shareLimited
        ? `Der lange Lauf ist auf die Hälfte des Wochen-Laufumfangs begrenzt (Spitze ${formatDurationShort(peakRun)} Laufen pro Woche); mehr Laufumfang ${peakRun >= ctx.peak.run - 60 ? 'sieht dein Zeitbudget bzw. die Gewichtung der Disziplinen nicht vor' : 'erlaubt die Steigerungsgrenze bis dahin nicht'}.`
        : 'Der lange Lauf darf höchstens 10 % über dem längsten Lauf der letzten 4 Wochen liegen.'
      out.push({
        code: 'W1',
        severity: 'important',
        sport: 'run',
        text: `Bis zum Taper erreichst du einen längsten Lauf von ${formatDurationShort(bestSec)}${bestM ? ` / ${formatDistance(bestM)}` : ''} (Richtwert für einen durchgelaufenen Marathon: etwa 2:30 h). ${reason} Optionen: Lauf-Geh-Strategie im Rennen, Laufen höher priorisieren, mehr Zeitbudget oder höherer Regler.`,
      });
    }
  }

  // W2: Schwimmen unter Mindestumfang in Belastungswochen
  const swimLow = weeks.filter((w) => w.frame.kind === 'loading' && w.sport.swim.durationSec > 0 && w.sport.swim.durationSec < FIXED.swimMinSec);
  if (swimLow.length) {
    out.push({ code: 'W2', severity: 'caution', sport: 'swim', text: `In ${swimLow.length} Belastungswochen reicht das Zeitbudget nicht für zwei Schwimmeinheiten (mindestens 1 h).` });
  }

  // W3: Vorbereitungsrennen deutlich länger als der längste Lauf davor
  for (const r of args.usedPrepRaces) {
    if (!r.runM) continue;
    const idx = weeks.findIndex((w) => w.frame.prepRaceIds.includes(r.id));
    const before = weeks.slice(Math.max(0, idx - FIXED.longRunLookbackWeeks), Math.max(0, idx));
    const longestM = Math.max(ctx.longRunStart.distanceM ?? 0, ...before.map((w) => w.longRun?.distanceM ?? 0));
    if (longestM > 0 && r.runM > (1 + FIXED.longRunGrowth) * longestM) {
      out.push({
        code: 'W3',
        severity: 'caution',
        weekStart: weeks[idx]?.frame.weekStart,
        sport: 'run',
        text: `${r.name} am ${formatDateDe(r.date, false)}: ${formatDistance(r.runM)} Laufen ist deutlich länger als dein bis dahin längster Lauf (${formatDistance(longestM)}). Locker angehen oder als Trainingslauf mit Gehpausen nutzen.`,
      });
    }
  }

  // W4: hohe Priorität durch harte Grenzen gebremst
  const lastPre = preTaper[preTaper.length - 1];
  for (const p of args.priorities) {
    if (p.applied < 4 || p.user === undefined || !lastPre) continue;
    const reached = lastPre.sport[p.sport].durationSec;
    if (reached < 0.9 * ctx.peak[p.sport]) {
      out.push({
        code: 'W4',
        severity: 'info',
        sport: p.sport,
        text: `${SPORT_LABEL[p.sport]} ist hoch priorisiert (${p.applied}), erreicht vor dem Taper aber nur ${formatDurationShort(reached)} statt ${formatDurationShort(ctx.peak[p.sport])} pro Woche – die Steigerungsgrenze bzw. das Zeitbudget gehen vor.`,
      });
    }
  }

  // W5: Intensität entfällt
  const dropped = args.intensity.reduce((s, x) => s + x.droppedSec, 0);
  if (dropped >= 15 * 60) {
    out.push({ code: 'W5', severity: 'info', text: `Insgesamt ${formatDurationShort(dropped)} der eingestellten Intensität entfallen, weil Laufen locker bleibt und Rad/Schwimmen nur begrenzt Intensität aufnehmen.` });
  }

  // W7: Beschwerde / Frische
  for (const r of args.freezeReasons) out.push({ code: 'W7', severity: 'important', text: `${r}. Erzeuge den Plan neu, sobald es dir besser geht.` });

  // W8: kurzer Plan
  if (weeks.length < 8) {
    out.push({ code: 'W8', severity: 'caution', text: `Sehr kurze Vorbereitung (${weeks.length} Wochen) – der Plan hält vor allem deinen aktuellen Umfang und tapert vor dem Rennen.` });
  }
  return out;
}
