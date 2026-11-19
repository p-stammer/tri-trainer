/**
 * Anwendungsfälle: kombinieren Domänenlogik und Repository.
 * Die UI ruft nur diese Funktionen bzw. lesende Repository-Methoden auf.
 */
import { newId, nowIso } from '../domain/ids';
import type { LocalDate } from '../domain/calendar';
import { applyWeekTargets, copyWeekTargets, emptyWeekTargets, planWeekStarts, reconcileWeeks } from '../domain/plan';
import type { PlanChange, PlanChangeKind } from '../domain/schemas';
import type { CompletedActivity, PainIssue, PainObservation, TargetRace, TrainingPause, TrainingPlan, TrainingWeek, WeekTargets, WeeklyWellnessCheckin } from '../domain/schemas';
import { canUndo, sameTargets, undoChanges, type PlanWeekChange } from '../domain/planEdit';
import type { PlanGeneratorInput, PlanProposal } from '../engine/types';
import type { GeneratorSettings, PrepRace, TrainingCamp, StrengthWorkoutLog, StrengthWorkoutTemplate, TrainingBaseline } from '../domain/schemas';
import { defaultGeneratorSettings } from '../domain/schemas';
import { createLogFromTemplate, createQuickLog } from '../domain/strength';
import { DERIVED_METHOD, ZONE_METRIC_FOR_SPORT, deriveZonesFromReference } from '../domain/zones';
import { isoWeek, startOfWeek } from '../domain/calendar';
import type { Repository } from './repository';

export type RaceInput = Omit<TargetRace, 'id' | 'createdAt' | 'updatedAt'>;

function emptyWeek(planId: string, weekStart: LocalDate, now: string): TrainingWeek {
  return { id: newId(), planId, weekStart, current: emptyWeekTargets(), revision: 0, updatedAt: now };
}

/** Onboarding: Wettkampf anlegen, leeren manuellen Plan mit allen Wochen erzeugen, als aktiv setzen. */
export async function setupRaceAndPlan(repo: Repository, input: RaceInput, now: string = nowIso()) {
  const race: TargetRace = { ...input, id: newId(), createdAt: now, updatedAt: now };
  await repo.saveRace(race);
  const weekStarts = planWeekStarts(race.prepStartDate, race.date);
  const plan: TrainingPlan = {
    id: newId(),
    raceId: race.id,
    name: `Plan ${race.name}`,
    origin: 'manual',
    startWeek: weekStarts[0] ?? race.prepStartDate,
    createdAt: now,
    updatedAt: now,
  };
  await repo.savePlan(plan);
  await repo.saveWeeks(weekStarts.map((ws) => emptyWeek(plan.id, ws, now)));
  await repo.updateSettings({ activePlanId: plan.id, onboardingCompletedAt: now });
  return { race, plan };
}

/**
 * Wettkampf ändern. Fehlende Wochen werden ergänzt; Wochen außerhalb des neuen Zeitraums
 * bleiben gespeichert (keine stillen Löschungen). Absolvierte Einheiten sind nicht betroffen.
 */
export async function updateRace(repo: Repository, race: TargetRace, now: string = nowIso()) {
  const saved = await repo.saveRace({ ...race, updatedAt: now });
  const settings = await repo.getSettings();
  const plan = settings.activePlanId ? await repo.getPlan(settings.activePlanId) : undefined;
  if (!plan || plan.raceId !== race.id) return { race: saved, added: [] as LocalDate[], outside: [] as LocalDate[] };
  const weeks = await repo.listWeeks(plan.id);
  const { missing, outside } = reconcileWeeks(weeks, saved.prepStartDate, saved.date);
  if (missing.length > 0) await repo.saveWeeks(missing.map((ws) => emptyWeek(plan.id, ws, now)));
  const starts = planWeekStarts(saved.prepStartDate, saved.date);
  await repo.savePlan({ ...plan, startWeek: starts[0] ?? plan.startWeek, updatedAt: now });
  return { race: saved, added: missing, outside };
}

export interface ActiveContext {
  race: TargetRace;
  plan: TrainingPlan;
  weeks: TrainingWeek[];
}

export async function loadActiveContext(repo: Repository): Promise<ActiveContext | null> {
  const settings = await repo.getSettings();
  if (!settings.activePlanId) return null;
  const plan = await repo.getPlan(settings.activePlanId);
  if (!plan) return null;
  const race = await repo.getRace(plan.raceId);
  if (!race) return null;
  return { race, plan, weeks: await repo.listWeeks(plan.id) };
}

/**
 * Zentrale Stelle für jede Planänderung: übernimmt die neuen Ziele (Original bleibt erhalten)
 * und protokolliert Vorher/Nachher in der Änderungshistorie.
 */
export async function commitWeekChanges(
  repo: Repository,
  planId: string,
  changes: readonly PlanWeekChange[],
  kind: PlanChangeKind,
  description: string,
  extra: { undoOf?: string } = {},
  now: string = nowIso(),
): Promise<TrainingWeek[]> {
  if (changes.length === 0) return [];
  const weeks = await repo.listWeeks(planId);
  const updated: TrainingWeek[] = [];
  const recorded: PlanWeekChange[] = [];
  for (const c of changes) {
    const w = weeks.find((x) => x.weekStart === c.weekStart);
    if (!w) continue;
    updated.push(applyWeekTargets(w, c.after, now));
    recorded.push({ weekStart: c.weekStart, before: w.current, after: c.after });
  }
  if (updated.length === 0) return [];
  await repo.saveWeeks(updated);
  await repo.savePlanChange({
    id: newId(),
    planId,
    createdAt: now,
    kind,
    description,
    weeks: recorded,
    ...(extra.undoOf ? { undoOf: extra.undoOf } : {}),
  });
  return updated;
}

export async function saveWeekTargets(repo: Repository, week: TrainingWeek, targets: WeekTargets, now: string = nowIso()) {
  const [saved] = await commitWeekChanges(
    repo,
    week.planId,
    [{ weekStart: week.weekStart, before: week.current, after: targets }],
    'week_edit',
    `KW ${isoWeek(week.weekStart).week} bearbeitet`,
    {},
    now,
  );
  return saved ?? week;
}

/** Kopiert die Ziele einer Woche in andere Wochen desselben Plans. */
export async function copyWeekToWeeks(
  repo: Repository,
  source: TrainingWeek,
  targetWeekStarts: readonly LocalDate[],
  now: string = nowIso(),
): Promise<number> {
  const weeks = await repo.listWeeks(source.planId);
  const changes = weeks
    .filter((w) => targetWeekStarts.includes(w.weekStart) && w.id !== source.id)
    .map((w) => ({ weekStart: w.weekStart, before: w.current, after: copyWeekTargets(source.current) }));
  const updated = await commitWeekChanges(repo, source.planId, changes, 'copy', `KW ${isoWeek(source.weekStart).week} in ${changes.length} Woche(n) übernommen`, {}, now);
  return updated.length;
}

/** Macht eine protokollierte Änderung rückgängig – nur, wenn die Wochen seitdem nicht weiter geändert wurden. */
export async function undoPlanChange(repo: Repository, change: PlanChange, now: string = nowIso()) {
  const weeks = await repo.listWeeks(change.planId);
  if (!canUndo(change, weeks)) {
    throw new Error('Diese Änderung kann nicht mehr rückgängig gemacht werden, weil die betroffenen Wochen inzwischen weiter geändert wurden.');
  }
  return commitWeekChanges(repo, change.planId, undoChanges(change), 'undo', `Rückgängig: ${change.description}`, { undoOf: change.id }, now);
}

export type ActivityInput = Omit<CompletedActivity, 'id' | 'createdAt' | 'updatedAt'>;

export async function logActivity(repo: Repository, input: ActivityInput, now: string = nowIso()) {
  const activity = await repo.saveActivity({ ...input, id: newId(), createdAt: now, updatedAt: now });
  await repo.updateSettings({ lastSport: input.sport });
  return activity;
}

export async function updateActivity(repo: Repository, existing: CompletedActivity, input: ActivityInput, now: string = nowIso()) {
  return repo.saveActivity({ ...input, id: existing.id, createdAt: existing.createdAt, updatedAt: now });
}

export type CheckinInput = Omit<WeeklyWellnessCheckin, 'id' | 'weekStart' | 'createdAt' | 'updatedAt' | 'acknowledgedAt'>;

/**
 * Speichert den Frische-Check-in der Woche, in die `input.date` fällt. Gibt es für diese Woche
 * schon einen, wird er ersetzt (ein Check-in pro Woche). Der Trainingsplan wird NICHT verändert.
 */
export async function saveCheckin(repo: Repository, input: CheckinInput, now: string = nowIso()) {
  const weekStart = startOfWeek(input.date);
  const existing = await repo.getCheckinForWeek(weekStart);
  return repo.saveCheckin({
    ...input,
    id: existing?.id ?? newId(),
    weekStart,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  });
}

export async function acknowledgeCheckin(repo: Repository, checkin: WeeklyWellnessCheckin, now: string = nowIso()) {
  return repo.saveCheckin({ ...checkin, acknowledgedAt: now, updatedAt: now });
}

// ───────── Beschwerden ─────────

export type PainIssueInput = Omit<PainIssue, 'id' | 'createdAt' | 'updatedAt'>;
export type PainObservationInput = Omit<PainObservation, 'id' | 'issueId' | 'createdAt'>;

/** Neue Beschwerde mit erstem Schmerzeintrag. */
export async function createPainIssue(repo: Repository, issue: PainIssueInput, first: PainObservationInput, now: string = nowIso()) {
  const saved = await repo.savePainIssue({ ...issue, id: newId(), createdAt: now, updatedAt: now });
  await repo.savePainObservation({ ...first, id: newId(), issueId: saved.id, createdAt: now });
  return saved;
}

export async function addPainObservation(repo: Repository, issue: PainIssue, input: PainObservationInput, now: string = nowIso()) {
  const o = await repo.savePainObservation({ ...input, id: newId(), issueId: issue.id, createdAt: now });
  await repo.savePainIssue({ ...issue, updatedAt: now });
  return o;
}

export async function setPainStatus(repo: Repository, issue: PainIssue, status: PainIssue['status'], today: LocalDate, now: string = nowIso()) {
  const next: PainIssue = { ...issue, status, updatedAt: now };
  if (status === 'resolved') next.resolvedDate = today;
  else delete next.resolvedDate;
  return repo.savePainIssue(next);
}

// ───────── Pausen ─────────

export type PauseInput = Omit<TrainingPause, 'id' | 'createdAt' | 'updatedAt'>;

/** Speichert eine Pause. Der Plan bleibt unverändert – Anpassungen nur über applyWeekChanges nach Bestätigung. */
export async function savePause(repo: Repository, input: PauseInput, existing?: TrainingPause, now: string = nowIso()) {
  return repo.savePause({ ...input, id: existing?.id ?? newId(), createdAt: existing?.createdAt ?? now, updatedAt: now });
}

// ───────── Vorbereitungswettkämpfe und Planer-Einstellungen ─────────
export type PrepRaceInput = Omit<PrepRace, 'id' | 'createdAt' | 'updatedAt'>;
export type TrainingCampInput = Omit<TrainingCamp, 'id' | 'createdAt' | 'updatedAt'>;

export async function saveTrainingCamp(repo: Repository, input: TrainingCampInput, existing?: TrainingCamp, now: string = nowIso()) {
  const clean = Object.fromEntries(Object.entries(input).filter(([, v]) => v !== undefined && v !== '')) as TrainingCampInput;
  return repo.saveTrainingCamp({ ...clean, id: existing?.id ?? newId(), createdAt: existing?.createdAt ?? now, updatedAt: now });
}

export async function savePrepRace(repo: Repository, input: PrepRaceInput, existing?: PrepRace, now: string = nowIso()) {
  const clean: Record<string, unknown> = { ...input, name: input.name.trim() };
  for (const k of ['swimM', 'bikeM', 'runM', 'notes'] as const) {
    if (clean[k] === undefined || clean[k] === 0 || clean[k] === '') delete clean[k];
  }
  return repo.savePrepRace({ ...(clean as PrepRaceInput), id: existing?.id ?? newId(), createdAt: existing?.createdAt ?? now, updatedAt: now });
}

// ───────── Plangenerator ─────────

/** Planwochen im Zeitraum Vorbereitungsbeginn … Wettkampfwoche. */
export function planRangeWeeks(ctx: ActiveContext): LocalDate[] {
  const from = startOfWeek(ctx.race.prepStartDate);
  const to = startOfWeek(ctx.race.date);
  return ctx.weeks.map((w) => w.weekStart).filter((ws) => ws >= from && ws <= to).sort();
}

/** Sammelt alle Eingaben für den Generator (PLAN_MODEL 3). */
export async function loadGeneratorInput(
  repo: Repository,
  ctx: ActiveContext,
  today: LocalDate,
  firstWeek: LocalDate,
  settingsOverride?: GeneratorSettings,
): Promise<PlanGeneratorInput> {
  const [profile, settings, prepRaces, metrics, history, wellness, pauses, painIssues, painObservations, appSettings, camps] = await Promise.all([
    repo.getProfile(),
    settingsOverride ? Promise.resolve(settingsOverride) : loadGeneratorSettings(repo, ctx.plan.id),
    repo.listPrepRaces(ctx.plan.id),
    repo.listMetrics(),
    repo.listActivities(),
    repo.listCheckins(),
    repo.listPauses(),
    repo.listPainIssues(),
    repo.listPainObservations(),
    repo.getSettings(),
    repo.listTrainingCamps(ctx.plan.id),
  ]);
  return {
    camps,
    ...(appSettings?.prognosis ? { prognosisSettings: appSettings.prognosis } : {}),
    today,
    race: ctx.race,
    firstWeek,
    planWeeks: planRangeWeeks(ctx),
    profile: profile ?? null,
    settings,
    prepRaces,
    metrics,
    history,
    wellness,
    pauses,
    painIssues,
    painObservations,
  };
}

/** Übernimmt einen Planvorschlag (Änderungsart `generated`, rückgängig machbar) und speichert die Prioritäten getrennt. */
export async function applyGeneratedPlan(repo: Repository, ctx: ActiveContext, proposal: PlanProposal, settings: GeneratorSettings, now: string = nowIso()) {
  const weeks = await repo.listWeeks(ctx.plan.id);
  const changes: PlanWeekChange[] = [];
  for (const pw of proposal.weeks) {
    const w = weeks.find((x) => x.weekStart === pw.weekStart);
    if (w && !sameTargets(w.current, pw.targets)) changes.push({ weekStart: pw.weekStart, before: w.current, after: pw.targets });
  }
  const n = changes.length;
  await commitWeekChanges(
    repo,
    ctx.plan.id,
    changes,
    'generated',
    `Plan vorgeschlagen: ${n} ${n === 1 ? 'Woche' : 'Wochen'} ab KW ${isoWeek(proposal.firstWeek).week} (Regler ${proposal.params.philosophy}, Modell ${proposal.modelVersion})`,
    {},
    now,
  );
  const priorities: GeneratorSettings['priorities'] = { ...settings.priorities };
  for (const p of proposal.priorities) {
    const entry: NonNullable<GeneratorSettings['priorities']['swim']> = { suggested: p.suggested, applied: p.applied };
    if (p.user !== undefined) entry.user = p.user;
    priorities[p.sport] = entry;
  }
  await repo.saveGeneratorSettings({ ...settings, priorities, updatedAt: now });

  // Ausgangsumfang aus erfassten Einheiten ins Profil übernehmen (1.5.0), damit das Profil den aktuellen Stand zeigt.
  const fromHistory = (['swim', 'bike', 'run', 'strength'] as const).filter((s) => proposal.baseline.bySport[s]?.source === 'history');
  if (fromHistory.length) {
    const profile = (await repo.getProfile()) ?? { id: 'me' as const, updatedAt: now };
    const baseline: TrainingBaseline = { ...(profile.baseline ?? {}), periodWeeks: 4 };
    for (const s of fromHistory) {
      const sb = proposal.baseline.bySport[s];
      if (!sb?.durationSec) continue;
      const entry: NonNullable<TrainingBaseline['swim']> = { durationSec: Math.round(sb.durationSec) };
      if (sb.distanceM) entry.distanceM = Math.round(sb.distanceM);
      if (sb.sessions !== undefined) entry.sessions = Math.round(sb.sessions * 10) / 10;
      baseline[s] = entry;
    }
    await repo.saveProfile({ ...profile, baseline, updatedAt: now });
  }
  return n;
}

/** Gespeicherte Einstellungen oder Standardwerte (werden erst beim Speichern angelegt). */
export async function loadGeneratorSettings(repo: Repository, planId: string, now: string = nowIso()): Promise<GeneratorSettings> {
  return (await repo.getGeneratorSettings(planId)) ?? defaultGeneratorSettings(planId, now);
}

/** Übernimmt einen bestätigten Vorschlag (z. B. aus einer Pause). Ursprünglicher Plan je Woche bleibt erhalten. */
export async function applyWeekChanges(
  repo: Repository,
  planId: string,
  changes: readonly PlanWeekChange[],
  kind: PlanChangeKind = 'pause_adjust',
  description = 'Pause berücksichtigt',
  now: string = nowIso(),
) {
  const updated = await commitWeekChanges(
    repo,
    planId,
    changes.map((c) => ({ weekStart: c.weekStart, before: c.before, after: c.after })),
    kind,
    description,
    {},
    now,
  );
  return updated.length;
}

// ───────── Krafttraining ─────────

/** "Vorlage X gemacht" – Workout ohne Satzdetails abhaken; zählt als Kraft-Einheit. */
export async function logQuickWorkout(
  repo: Repository,
  template: StrengthWorkoutTemplate,
  details: { date: LocalDate; durationSec: number; rpe?: number | undefined; note?: string | undefined },
  now: string = nowIso(),
) {
  const log = createQuickLog(template, details.date, newId(), now);
  return finishWorkout(repo, log, details, now);
}

export type TemplateInput = Omit<StrengthWorkoutTemplate, 'id' | 'createdAt' | 'updatedAt'>;

export async function saveStrengthTemplate(repo: Repository, input: TemplateInput, existing?: StrengthWorkoutTemplate, now: string = nowIso()) {
  return repo.saveStrengthTemplate({ ...input, id: existing?.id ?? newId(), createdAt: existing?.createdAt ?? now, updatedAt: now });
}

/** Startet ein Workout aus einer Vorlage (Kopie, Status "läuft"). */
export async function startWorkout(repo: Repository, template: StrengthWorkoutTemplate, date: LocalDate, now: string = nowIso()) {
  return repo.saveStrengthLog(createLogFromTemplate(template, date, newId(), now));
}

export async function saveWorkoutProgress(repo: Repository, log: StrengthWorkoutLog, now: string = nowIso()) {
  return repo.saveStrengthLog({ ...log, updatedAt: now });
}

/**
 * Schließt ein Workout ab und legt bzw. aktualisiert die verknüpfte Trainingseinheit (Sportart Kraft),
 * damit es in Wochenzielen und Verlauf zählt. Die Einheit übernimmt Datum, Dauer, RPE und Notiz.
 */
export async function finishWorkout(
  repo: Repository,
  log: StrengthWorkoutLog,
  details: { durationSec: number; rpe?: number | undefined; note?: string | undefined },
  now: string = nowIso(),
) {
  const existing = log.activityId ? await repo.getActivity(log.activityId) : undefined;
  const input: ActivityInput = {
    sport: 'strength',
    date: log.date,
    durationSec: details.durationSec,
    focus: 'strength',
    note: details.note ? `${log.name}: ${details.note}` : log.name,
    ...(details.rpe !== undefined ? { rpe: details.rpe } : {}),
  };
  const activity = existing ? await updateActivity(repo, existing, input, now) : await logActivity(repo, input, now);
  const next: StrengthWorkoutLog = { ...log, status: 'completed', durationSec: details.durationSec, activityId: activity.id, updatedAt: now };
  delete next.rpe;
  delete next.note;
  if (details.rpe !== undefined) next.rpe = details.rpe;
  if (details.note) next.note = details.note;
  return repo.saveStrengthLog(next);
}

/** Löscht eine Einheit; ein verknüpftes Workout-Protokoll wird mit gelöscht (es ist dieselbe Trainingseinheit). */
export async function deleteActivityWithLinks(repo: Repository, activityId: string) {
  const log = await repo.findStrengthLogByActivity(activityId);
  if (log) await repo.deleteStrengthLog(log.id);
  await repo.deleteActivity(activityId);
}

/** Löscht ein Workout samt verknüpfter Einheit. */
export async function deleteWorkout(repo: Repository, log: StrengthWorkoutLog) {
  if (log.activityId) await repo.deleteActivity(log.activityId);
  await repo.deleteStrengthLog(log.id);
}

// ───────── Leistungswerte ─────────

export type ReferenceSport = 'bike' | 'run' | 'swim';

const METRIC_KIND = { bike: 'bike_ftp_w', run: 'run_threshold_pace_s_per_km', swim: 'swim_css_s_per_100m' } as const;
const METRIC_UNIT = { bike: 'W', run: 's/km', swim: 's/100m' } as const;

/**
 * Speichert einen Referenzwert (FTP, Schwellenpace, CSS) mit Datum und optionaler Methode.
 * Beim Rad werden die Leistungszonen nach Coggan neu abgeleitet; Lauf-/Schwimmzonen bleiben unverändert.
 */
/** Speichert die aus dem Ankerwert abgeleiteten Zonen (Vorschlag übernehmen). */
export async function applyDerivedZones(repo: Repository, sport: ReferenceSport, value: number, now: string = nowIso()) {
  return repo.saveZoneConfig({
    id: sport,
    sport,
    metric: ZONE_METRIC_FOR_SPORT[sport],
    method: DERIVED_METHOD[sport],
    referenceValue: value,
    bounds: deriveZonesFromReference(sport, value),
    updatedAt: now,
  });
}

export async function saveReferenceMetric(
  repo: Repository,
  sport: ReferenceSport,
  value: number,
  date: LocalDate,
  method?: string,
  now: string = nowIso(),
) {
  const metric = await repo.saveMetric({
    id: newId(),
    kind: METRIC_KIND[sport],
    value,
    unit: METRIC_UNIT[sport],
    date,
    ...(method?.trim() ? { method: method.trim() } : {}),
    createdAt: now,
  });
  // Rad: Zonen werden immer neu berechnet (Coggan). Laufen/Schwimmen: nur als Vorschlag –
  // manuell festgelegte Zonen haben Vorrang und bleiben unverändert (R14).
  const existing = (await repo.listZoneConfigs()).find((c) => c.sport === sport);
  if (sport === 'bike' || !existing || existing.method !== 'manual') {
    await applyDerivedZones(repo, sport, value, now);
  }
  return metric;
}
