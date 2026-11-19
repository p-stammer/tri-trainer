/**
 * Repository: einzige Stelle, über die UI und Anwendungsfälle Daten lesen und schreiben.
 * - validiert JEDEN Schreibvorgang mit den Zod-Schemas (Datenintegrität hat Priorität 1)
 * - benachrichtigt Abonnenten nach Änderungen (UI aktualisiert sich automatisch)
 * - kapselt das Backend (Dexie heute, später z. B. Sync-fähiger Speicher)
 */
import type { z } from 'zod';
import { addDays, DEFAULT_TIME_ZONE, type LocalDate } from '../domain/calendar';
import { backupDataSchema, type BackupData } from '../domain/backup';
import {
  appSettingsSchema,
  athleteProfileSchema,
  completedActivitySchema,
  performanceMetricSchema,
  sportZoneConfigSchema,
  targetRaceSchema,
  trainingPlanSchema,
  trainingWeekSchema,
  type AppSettings,
  type AthleteProfile,
  type CompletedActivity,
  type PerformanceMetric,
  type SportZoneConfiguration,
  type TargetRace,
  type TrainingPlan,
  type TrainingWeek,
  weeklyWellnessCheckinSchema,
  type WeeklyWellnessCheckin,
  painIssueSchema,
  painObservationSchema,
  trainingPauseSchema,
  type PainIssue,
  type PainObservation,
  type TrainingPause,
  strengthWorkoutTemplateSchema,
  strengthWorkoutLogSchema,
  type StrengthWorkoutTemplate,
  type StrengthWorkoutLog,
  planChangeSchema,
  type PlanChange,
  prepRaceSchema,
  type PrepRace,
  trainingCampSchema,
  type TrainingCamp,
  generatorSettingsSchema,
  type GeneratorSettings,
} from '../domain/schemas';
import type { Row, StorageBackend, TableName } from './backend';

export class ValidationError extends Error {
  constructor(
    message: string,
    readonly issues: string[],
  ) {
    super(message);
    this.name = 'ValidationError';
  }
}

function validate<S extends z.ZodTypeAny>(schema: S, value: unknown, what: string): z.infer<S> {
  const r = schema.safeParse(value);
  if (!r.success) {
    const issues = r.error.issues.map((i) => `${i.path.join('.') || what}: ${i.message}`);
    throw new ValidationError(`${what} konnte nicht gespeichert werden: ${issues[0] ?? 'ungültige Daten'}`, issues);
  }
  return r.data as z.infer<S>;
}

export function defaultSettings(): AppSettings {
  return {
    id: 'app',
    timeZone: DEFAULT_TIME_ZONE,
    primaryMetric: { swim: 'distance', bike: 'duration', run: 'distance' },
    theme: 'system',
  };
}

type Listener = () => void;

export class Repository {
  private listeners = new Set<Listener>();

  constructor(private readonly backend: StorageBackend) {}

  // ───────── Änderungsbenachrichtigung ─────────
  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private changed(): void {
    for (const l of this.listeners) l();
  }

  private async write<T extends Row>(table: TableName, row: T): Promise<T> {
    await this.backend.put(table, row);
    this.changed();
    return row;
  }

  // ───────── Einstellungen & Profil ─────────
  async getSettings(): Promise<AppSettings> {
    return (await this.backend.get<AppSettings>('settings', 'app')) ?? defaultSettings();
  }

  async saveSettings(s: AppSettings): Promise<AppSettings> {
    return this.write('settings', validate(appSettingsSchema, s, 'Einstellungen'));
  }

  async updateSettings(patch: Partial<Omit<AppSettings, 'id'>>): Promise<AppSettings> {
    const current = await this.getSettings();
    return this.saveSettings({ ...current, ...patch });
  }

  getProfile(): Promise<AthleteProfile | undefined> {
    return this.backend.get<AthleteProfile>('profile', 'me');
  }

  saveProfile(p: AthleteProfile): Promise<AthleteProfile> {
    return this.write('profile', validate(athleteProfileSchema, p, 'Profil'));
  }

  // ───────── Wettkampf & Plan ─────────
  getRace(id: string): Promise<TargetRace | undefined> {
    return this.backend.get<TargetRace>('races', id);
  }

  listRaces(): Promise<TargetRace[]> {
    return this.backend.all<TargetRace>('races');
  }

  saveRace(r: TargetRace): Promise<TargetRace> {
    return this.write('races', validate(targetRaceSchema, r, 'Wettkampf'));
  }

  getPlan(id: string): Promise<TrainingPlan | undefined> {
    return this.backend.get<TrainingPlan>('plans', id);
  }

  savePlan(p: TrainingPlan): Promise<TrainingPlan> {
    return this.write('plans', validate(trainingPlanSchema, p, 'Trainingsplan'));
  }

  async listWeeks(planId: string): Promise<TrainingWeek[]> {
    const weeks = await this.backend.equals<TrainingWeek>('weeks', 'planId', planId);
    return weeks.sort((a, b) => a.weekStart.localeCompare(b.weekStart));
  }

  async getWeek(planId: string, weekStart: LocalDate): Promise<TrainingWeek | undefined> {
    return (await this.listWeeks(planId)).find((w) => w.weekStart === weekStart);
  }

  saveWeek(w: TrainingWeek): Promise<TrainingWeek> {
    return this.write('weeks', validate(trainingWeekSchema, w, 'Trainingswoche'));
  }

  async saveWeeks(weeks: readonly TrainingWeek[]): Promise<void> {
    const valid = weeks.map((w) => validate(trainingWeekSchema, w, 'Trainingswoche'));
    await this.backend.bulkPut('weeks', valid);
    this.changed();
  }

  // ───────── Absolvierte Einheiten ─────────
  async listActivities(): Promise<CompletedActivity[]> {
    return sortActivities(await this.backend.all<CompletedActivity>('activities'));
  }

  async listActivitiesBetween(from: LocalDate, to: LocalDate): Promise<CompletedActivity[]> {
    return sortActivities(await this.backend.range<CompletedActivity>('activities', 'date', from, to));
  }

  listActivitiesInWeek(weekStart: LocalDate): Promise<CompletedActivity[]> {
    return this.listActivitiesBetween(weekStart, addDays(weekStart, 6));
  }

  getActivity(id: string): Promise<CompletedActivity | undefined> {
    return this.backend.get<CompletedActivity>('activities', id);
  }

  saveActivity(a: CompletedActivity): Promise<CompletedActivity> {
    return this.write('activities', validate(completedActivitySchema, a, 'Trainingseinheit'));
  }

  async deleteActivity(id: string): Promise<void> {
    await this.backend.delete('activities', id);
    this.changed();
  }

  // ───────── Zonen & Leistungswerte ─────────
  listZoneConfigs(): Promise<SportZoneConfiguration[]> {
    return this.backend.all<SportZoneConfiguration>('zoneConfigs');
  }

  saveZoneConfig(c: SportZoneConfiguration): Promise<SportZoneConfiguration> {
    return this.write('zoneConfigs', validate(sportZoneConfigSchema, c, 'Zonenkonfiguration'));
  }

  async listMetrics(): Promise<PerformanceMetric[]> {
    return (await this.backend.all<PerformanceMetric>('metrics')).sort((a, b) => b.date.localeCompare(a.date));
  }

  saveMetric(m: PerformanceMetric): Promise<PerformanceMetric> {
    return this.write('metrics', validate(performanceMetricSchema, m, 'Leistungswert'));
  }

  async deleteMetric(id: string): Promise<void> {
    await this.backend.delete('metrics', id);
    this.changed();
  }

  // ───────── Frische-Check-in ─────────
  async listCheckins(): Promise<WeeklyWellnessCheckin[]> {
    return (await this.backend.all<WeeklyWellnessCheckin>('wellness')).sort((a, b) => b.weekStart.localeCompare(a.weekStart));
  }

  async getCheckinForWeek(weekStart: LocalDate): Promise<WeeklyWellnessCheckin | undefined> {
    return (await this.backend.equals<WeeklyWellnessCheckin>('wellness', 'weekStart', weekStart))[0];
  }

  saveCheckin(c: WeeklyWellnessCheckin): Promise<WeeklyWellnessCheckin> {
    return this.write('wellness', validate(weeklyWellnessCheckinSchema, c, 'Frische-Check-in'));
  }

  async deleteCheckin(id: string): Promise<void> {
    await this.backend.delete('wellness', id);
    this.changed();
  }

  // ───────── Beschwerden ─────────
  async listPainIssues(): Promise<PainIssue[]> {
    return (await this.backend.all<PainIssue>('painIssues')).sort((a, b) => b.startDate.localeCompare(a.startDate));
  }

  getPainIssue(id: string): Promise<PainIssue | undefined> {
    return this.backend.get<PainIssue>('painIssues', id);
  }

  savePainIssue(i: PainIssue): Promise<PainIssue> {
    return this.write('painIssues', validate(painIssueSchema, i, 'Beschwerde'));
  }

  listPainObservations(): Promise<PainObservation[]> {
    return this.backend.all<PainObservation>('painObservations');
  }

  savePainObservation(o: PainObservation): Promise<PainObservation> {
    return this.write('painObservations', validate(painObservationSchema, o, 'Schmerzeintrag'));
  }

  async deletePainObservation(id: string): Promise<void> {
    await this.backend.delete('painObservations', id);
    this.changed();
  }

  /** Löscht eine Beschwerde samt aller Einträge. */
  async deletePainIssue(id: string): Promise<void> {
    const obs = await this.backend.equals<PainObservation>('painObservations', 'issueId', id);
    for (const o of obs) await this.backend.delete('painObservations', o.id);
    await this.backend.delete('painIssues', id);
    this.changed();
  }

  // ───────── Trainingspausen ─────────
  async listPauses(): Promise<TrainingPause[]> {
    return (await this.backend.all<TrainingPause>('pauses')).sort((a, b) => b.startDate.localeCompare(a.startDate));
  }

  getPause(id: string): Promise<TrainingPause | undefined> {
    return this.backend.get<TrainingPause>('pauses', id);
  }

  savePause(p: TrainingPause): Promise<TrainingPause> {
    return this.write('pauses', validate(trainingPauseSchema, p, 'Trainingspause'));
  }

  async deletePause(id: string): Promise<void> {
    await this.backend.delete('pauses', id);
    this.changed();
  }

  // ───────── Krafttraining ─────────
  async listStrengthTemplates(): Promise<StrengthWorkoutTemplate[]> {
    return (await this.backend.all<StrengthWorkoutTemplate>('strengthTemplates')).sort((a, b) => a.name.localeCompare(b.name, 'de'));
  }

  getStrengthTemplate(id: string): Promise<StrengthWorkoutTemplate | undefined> {
    return this.backend.get<StrengthWorkoutTemplate>('strengthTemplates', id);
  }

  saveStrengthTemplate(t: StrengthWorkoutTemplate): Promise<StrengthWorkoutTemplate> {
    return this.write('strengthTemplates', validate(strengthWorkoutTemplateSchema, t, 'Workout-Vorlage'));
  }

  async deleteStrengthTemplate(id: string): Promise<void> {
    await this.backend.delete('strengthTemplates', id);
    this.changed();
  }

  async listStrengthLogs(): Promise<StrengthWorkoutLog[]> {
    return (await this.backend.all<StrengthWorkoutLog>('strengthLogs')).sort((a, b) => b.date.localeCompare(a.date) || b.startedAt.localeCompare(a.startedAt));
  }

  getStrengthLog(id: string): Promise<StrengthWorkoutLog | undefined> {
    return this.backend.get<StrengthWorkoutLog>('strengthLogs', id);
  }

  async findStrengthLogByActivity(activityId: string): Promise<StrengthWorkoutLog | undefined> {
    return (await this.backend.equals<StrengthWorkoutLog>('strengthLogs', 'activityId', activityId))[0];
  }

  saveStrengthLog(l: StrengthWorkoutLog): Promise<StrengthWorkoutLog> {
    return this.write('strengthLogs', validate(strengthWorkoutLogSchema, l, 'Workout'));
  }

  async deleteStrengthLog(id: string): Promise<void> {
    await this.backend.delete('strengthLogs', id);
    this.changed();
  }

  // ───────── Änderungshistorie ─────────
  async listPlanChanges(planId: string): Promise<PlanChange[]> {
    return (await this.backend.equals<PlanChange>('planChanges', 'planId', planId)).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  savePlanChange(c: PlanChange): Promise<PlanChange> {
    return this.write('planChanges', validate(planChangeSchema, c, 'Planänderung'));
  }

  // ───────── Plangenerator (DB-Version 6) ─────────
  async listPrepRaces(planId: string): Promise<PrepRace[]> {
    return (await this.backend.equals<PrepRace>('prepRaces', 'planId', planId)).sort((a, b) => a.date.localeCompare(b.date));
  }

  getPrepRace(id: string): Promise<PrepRace | undefined> {
    return this.backend.get<PrepRace>('prepRaces', id);
  }

  async savePrepRace(r: PrepRace): Promise<PrepRace> {
    return this.write('prepRaces', validate(prepRaceSchema, r, 'Vorbereitungswettkampf'));
  }

  async listTrainingCamps(planId: string): Promise<TrainingCamp[]> {
    return (await this.backend.equals<TrainingCamp>('trainingCamps', 'planId', planId)).sort((a, b) => a.startDate.localeCompare(b.startDate));
  }

  async saveTrainingCamp(c: TrainingCamp): Promise<TrainingCamp> {
    return this.write('trainingCamps', validate(trainingCampSchema, c, 'Trainingslager'));
  }

  async deleteTrainingCamp(id: string): Promise<void> {
    await this.backend.delete('trainingCamps', id);
    this.changed();
  }

  async deletePrepRace(id: string): Promise<void> {
    await this.backend.delete('prepRaces', id);
    this.changed();
  }

  getGeneratorSettings(planId: string): Promise<GeneratorSettings | undefined> {
    return this.backend.get<GeneratorSettings>('generatorSettings', planId);
  }

  async saveGeneratorSettings(s: GeneratorSettings): Promise<GeneratorSettings> {
    return this.write('generatorSettings', validate(generatorSettingsSchema, s, 'Generator-Einstellungen'));
  }

  // ───────── Backup ─────────
  async exportAll(): Promise<BackupData> {
    return {
      settings: (await this.backend.get<AppSettings>('settings', 'app')) ?? null,
      profile: (await this.backend.get<AthleteProfile>('profile', 'me')) ?? null,
      races: await this.backend.all('races'),
      plans: await this.backend.all('plans'),
      weeks: await this.backend.all('weeks'),
      activities: await this.backend.all('activities'),
      zoneConfigs: await this.backend.all('zoneConfigs'),
      metrics: await this.backend.all('metrics'),
      wellness: await this.backend.all('wellness'),
      painIssues: await this.backend.all('painIssues'),
      painObservations: await this.backend.all('painObservations'),
      pauses: await this.backend.all('pauses'),
      strengthTemplates: await this.backend.all('strengthTemplates'),
      strengthLogs: await this.backend.all('strengthLogs'),
      planChanges: await this.backend.all('planChanges'),
      prepRaces: await this.backend.all('prepRaces'),
      generatorSettings: await this.backend.all('generatorSettings'),
      trainingCamps: await this.backend.all('trainingCamps'),
    };
  }

  /** Ersetzt alle Daten atomar durch einen validierten Backup-Stand. */
  async replaceAll(data: BackupData): Promise<void> {
    const d = validate(backupDataSchema, data, 'Backup');
    await this.backend.replaceAll({
      settings: d.settings ? [d.settings] : [],
      profile: d.profile ? [d.profile] : [],
      races: d.races,
      plans: d.plans,
      weeks: d.weeks,
      activities: d.activities,
      zoneConfigs: d.zoneConfigs,
      metrics: d.metrics,
      wellness: d.wellness,
      painIssues: d.painIssues,
      painObservations: d.painObservations,
      pauses: d.pauses,
      strengthTemplates: d.strengthTemplates,
      strengthLogs: d.strengthLogs,
      planChanges: d.planChanges,
      prepRaces: d.prepRaces,
      generatorSettings: d.generatorSettings,
      trainingCamps: d.trainingCamps,
    });
    this.changed();
  }
}

function sortActivities(list: CompletedActivity[]): CompletedActivity[] {
  // Neueste zuerst; bei gleichem Tag zuletzt erfasste zuerst.
  return list.sort((a, b) => (a.date === b.date ? b.createdAt.localeCompare(a.createdAt) : b.date.localeCompare(a.date)));
}
