/**
 * Plangenerator: generatePlan(input) = I(H(G(F(E(D(C(B(A(input))))))))) – siehe docs/PLAN_MODEL.md.
 * Reine, deterministische Funktion: gleiche Eingabe + gleiche Modellversion = gleiches Ergebnis.
 */
import { compareDates } from '../domain/calendar';
import { computePrognosis, withAssumedSetup } from '../domain/prognosis';
import type { PrepRace } from '../domain/schemas';
import { SPORT_LABEL } from '../domain/sports';
import { formatDurationShort } from '../domain/units';
import { applyPriorities, assessDisciplines } from './assessment';
import { checkHardLimits, collectWarnings } from './checks';
import { buildBaseline } from './inputs';
import { planIntensity } from './intensity';
import { MODEL_VERSION, resolveParams } from './params';
import { buildFrames } from './phases';
import { buildWeekTargets } from './sessions';
import type { Explanation, GeneratorResult, PlanGeneratorInput, ProposedWeek } from './types';
import { projectVolumes, volumeContext, type WeekVolume } from './volume';

export function generatePlan(input: PlanGeneratorInput): GeneratorResult {
  // A
  const a = buildBaseline(input);
  if (a.needs.length) return { ok: false, needs: a.needs };
  const { baseline } = a;
  const params = resolveParams(input.settings.philosophy, baseline.age);

  // B, C
  const prognosis = computePrognosis({
    today: input.today,
    race: input.race,
    profile: withAssumedSetup(input.profile ?? undefined, input.prognosisSettings),
    metrics: input.metrics,
    activities: input.history,
    settings: input.prognosisSettings ?? {},
  });
  const assessments = assessDisciplines(baseline, input.metrics, input.today, prognosis);
  const { priorities, uncertainties } = applyPriorities(assessments, input.settings);

  // D
  const weeks = input.planWeeks.filter((w) => compareDates(w, input.firstWeek) >= 0);
  const phases = buildFrames({
    weeks,
    raceDate: input.race.date,
    today: input.today,
    taperWeeks: input.settings.taperWeeks,
    params,
    prepRaces: input.prepRaces,
    camps: input.camps ?? [],
    wellness: input.wellness,
    pauses: input.pauses,
    painIssues: input.painIssues,
    painObservations: input.painObservations,
  });

  // E
  const ctx = volumeContext(baseline, params, priorities, input.settings, input.race, input.metrics);
  const racesById = new Map<string, PrepRace>(input.prepRaces.map((r) => [r.id, r]));
  const raceRunSec = (ids: readonly string[]): number | undefined => {
    const k = ctx.ratio.run;
    let best: number | undefined;
    for (const id of ids) {
      const r = racesById.get(id);
      if (r?.runM && k) best = Math.max(best ?? 0, r.runM / k);
    }
    return best;
  };
  const volume = projectVolumes(phases.frames, ctx, baseline, params, phases.specificStart, input.settings.taperWeeks, (f) => raceRunSec(f.prepRaceIds));

  // F
  const intensity = planIntensity(volume.weeks, params);

  // G
  const proposed: ProposedWeek[] = volume.weeks.map((w, i) => {
    const raceNotes = w.frame.prepRaceIds.map((id) => {
      const r = racesById.get(id);
      return r ? `Rennen: ${r.name} – zählt als Einheit dieser Woche` : '';
    });
    const zi = intensity[i] ?? { zoneSec: { swim: {}, bike: {}, run: {} }, targetNonLowSec: 0, droppedSec: 0 };
    const targets = buildWeekTargets(w, zi, input.settings, raceNotes.filter(Boolean));
    const pw: ProposedWeek = { weekStart: w.frame.weekStart, kind: w.frame.kind, phase: targets.phase ?? w.frame.phase, reasons: [...w.frame.reasons, ...w.reasons], targets };
    if (w.longRun) pw.longRun = w.longRun;
    if (w.longRide) pw.longRide = w.longRide;
    return pw;
  });

  // H
  const violations = checkHardLimits(volume.weeks, intensity, ctx, params, baseline.budgetSec, (w: WeekVolume) => raceRunSec(w.frame.prepRaceIds));
  const warnings = [
    ...a.warnings,
    ...phases.ignoredCamps.map((x) => ({ code: 'W12' as const, severity: 'info' as const, text: `Trainingslager „${x.camp.name}“ nicht berücksichtigt: ${x.reason}.` })),
    ...collectWarnings({
      weeks: volume.weeks,
      intensity,
      ctx,
      race: input.race,
      priorities,
      usedPrepRaces: phases.usedPrepRaces,
      freezeReasons: phases.freezeReasons,
      taperWeeks: input.settings.taperWeeks,
      budgetSec: baseline.budgetSec,
    }),
  ];

  // I
  const rationale: Explanation[] = [
    {
      text: `Regler ${params.philosophy} von 100: ${Math.round(params.lowIntensityShare * 100)} % der Ausdauerzeit locker (Z1–Z2), vom Rest ${Math.round(params.z3ShareOfNonLow * 100)} % Tempo (Z3) – ${params.z3ShareOfNonLow >= 0.5 ? 'eher pyramidal' : 'eher polarisiert'}. Harte Intensität liegt auf dem Rad, Laufen bleibt locker.`,
      rules: ['R1', 'R6a'],
      inputs: ['settings.philosophy'],
    },
    {
      text: `Entlastung fest jede ${params.recoveryEvery}. Woche${baseline.age !== undefined && baseline.age >= 50 ? ' (ab 50 eine Woche früher)' : ''} mit ${Math.round(params.recoveryCut * 100)} % weniger Umfang, zusätzlich bei niedriger Frische; Taper ${input.settings.taperWeeks} ${input.settings.taperWeeks === 1 ? 'Woche' : 'Wochen'}.`,
      rules: ['R4', 'R8'],
      inputs: ['settings.philosophy', 'settings.taperWeeks', 'profile.birthDate'],
    },
    {
      text: `Spitzenwochen höchstens ${formatDurationShort(Math.min(0.9 * baseline.budgetSec, ctx.ceilingSec))}: das kleinere aus 90 % deines Zeitbudgets (${formatDurationShort(baseline.budgetSec)}) und der Obergrenze für diese Distanz (${formatDurationShort(ctx.ceilingSec)}, abgeleitet aus dem Trainingsumfang von Freizeit-Finishern).`,
      rules: ['R20', 'R22'],
      inputs: ['profile.availableWeeklySec', 'race'],
    },
    ...volume.explanations,
    ...priorities.map(
      (p): Explanation => ({
        sport: p.sport,
        text: `Priorität ${SPORT_LABEL[p.sport]}: ${p.applied} (Vorschlag ${p.suggested}${p.user !== undefined ? `, dein Wunsch ${p.user}` : ''}) – ${p.reason}.`,
        rules: ['R10'],
        inputs: [`settings.priorities.${p.sport}`, 'settings.priorityMode'],
      }),
    ),
    ...phases.usedPrepRaces.map((r): Explanation => ({ text: `Vorbereitungswettkampf ${r.name} eingeplant (Mini-Taper und Erholungswoche).`, rules: ['R19'], inputs: ['prepRaces'] })),
    ...phases.ignoredPrepRaces.map((x): Explanation => ({ text: `${x.race.name} nicht berücksichtigt: ${x.reason}.`, rules: ['R19'], inputs: ['prepRaces'] })),
    ...phases.usedCamps.map(
      (c): Explanation => ({
        text: `Trainingslager ${c.name}: bis zu ${c.hoursPerDay.toLocaleString('de-DE')} h pro Tag. Mehrumfang locker vor allem auf dem Rad (bis etwa +70 % gegenüber der Woche davor) und beim Schwimmen (bis etwa +60 %), Laufen nach den normalen Grenzen, Intensität wie in einer normalen Woche; danach eine Erholungswoche. Studien zu Trainingslagern zeigen im Mittel etwa +50 % Belastung – ein Teil der Athleten ist danach vorübergehend überlastet, daher die Erholung.`,
        rules: ['R23'],
        inputs: ['trainingCamps'],
      }),
    ),
  ];

  return {
    ok: true,
    proposal: {
      modelVersion: MODEL_VERSION,
      firstWeek: weeks[0] ?? input.firstWeek,
      params,
      baseline,
      weeks: proposed,
      assessments,
      priorities,
      rationale,
      warnings,
      uncertainties,
      violations,
    },
  };
}

/** Nur Bewertung und Prioritäten (für Anpassungsvorschläge), ohne Plan. Null, wenn Pflichtangaben fehlen. */
export function suggestPriorities(input: PlanGeneratorInput) {
  const a = buildBaseline(input);
  if (a.needs.length) return null;
  const prognosis = computePrognosis({
    today: input.today,
    race: input.race,
    profile: withAssumedSetup(input.profile ?? undefined, input.prognosisSettings),
    metrics: input.metrics,
    activities: input.history,
    settings: input.prognosisSettings ?? {},
  });
  return applyPriorities(assessDisciplines(a.baseline, input.metrics, input.today, prognosis), input.settings).priorities;
}
