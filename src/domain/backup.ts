/**
 * Backup-Format (versioniertes JSON) und CSV-Export.
 * Restore läuft immer: Datei lesen → validieren → Vorschau → Bestätigung → ersetzen.
 */
import { z } from 'zod';
import { isoWeek } from './calendar';
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
} from './schemas';
import { SESSION_FOCUS_LABEL, SPORT_LABEL, ZONES } from './sports';
import { splitKnownUnknown } from './zones';

export const BACKUP_FORMAT = 'ironman-planner-backup';
/**
 * Formatversionen: 1 = MVP 1 · 2 = + wellness · 3 = + painIssues, painObservations, pauses ·
 * 4 = + strengthTemplates, strengthLogs · 5 = + planChanges · 6 = + prepRaces, generatorSettings · 7 = + trainingCamps.
 * Ältere Backups werden schrittweise migriert.
 */
export const BACKUP_FORMAT_VERSION = 7;

export interface BackupData {
  settings: AppSettings | null;
  profile: AthleteProfile | null;
  races: TargetRace[];
  plans: TrainingPlan[];
  weeks: TrainingWeek[];
  activities: CompletedActivity[];
  zoneConfigs: SportZoneConfiguration[];
  metrics: PerformanceMetric[];
  wellness: WeeklyWellnessCheckin[];
  painIssues: PainIssue[];
  painObservations: PainObservation[];
  pauses: TrainingPause[];
  strengthTemplates: StrengthWorkoutTemplate[];
  strengthLogs: StrengthWorkoutLog[];
  planChanges: PlanChange[];
  prepRaces: PrepRace[];
  generatorSettings: GeneratorSettings[];
  trainingCamps: TrainingCamp[];
}

export const backupDataSchema = z.object({
  settings: appSettingsSchema.nullable(),
  profile: athleteProfileSchema.nullable(),
  races: z.array(targetRaceSchema),
  plans: z.array(trainingPlanSchema),
  weeks: z.array(trainingWeekSchema),
  activities: z.array(completedActivitySchema),
  zoneConfigs: z.array(sportZoneConfigSchema),
  metrics: z.array(performanceMetricSchema),
  wellness: z.array(weeklyWellnessCheckinSchema),
  painIssues: z.array(painIssueSchema),
  painObservations: z.array(painObservationSchema),
  pauses: z.array(trainingPauseSchema),
  strengthTemplates: z.array(strengthWorkoutTemplateSchema),
  strengthLogs: z.array(strengthWorkoutLogSchema),
  planChanges: z.array(planChangeSchema),
  prepRaces: z.array(prepRaceSchema),
  generatorSettings: z.array(generatorSettingsSchema),
  trainingCamps: z.array(trainingCampSchema),
});

export const backupFileSchema = z.object({
  format: z.literal(BACKUP_FORMAT),
  formatVersion: z.literal(BACKUP_FORMAT_VERSION),
  appVersion: z.string(),
  exportedAt: z.string(),
  data: backupDataSchema,
});
export type BackupFile = z.infer<typeof backupFileSchema>;

export function createBackup(data: BackupData, appVersion: string, exportedAt: string): BackupFile {
  return { format: BACKUP_FORMAT, formatVersion: BACKUP_FORMAT_VERSION, appVersion, exportedAt, data };
}

export interface BackupSummary {
  exportedAt: string;
  appVersion: string;
  races: number;
  plans: number;
  weeks: number;
  activities: number;
  firstActivity: string | null;
  lastActivity: string | null;
}

export type ParseBackupResult =
  | { ok: true; backup: BackupFile; summary: BackupSummary }
  | { ok: false; errors: string[] };

/** Hebt ältere Backup-Formate schrittweise auf die aktuelle Version an. */
function migrateBackup(raw: Record<string, unknown>): unknown {
  let current = raw;
  if (current.formatVersion === 1) {
    const data = (current.data ?? {}) as Record<string, unknown>;
    current = { ...current, formatVersion: 2, data: { ...data, wellness: [] } };
  }
  if (current.formatVersion === 2) {
    const data = (current.data ?? {}) as Record<string, unknown>;
    current = { ...current, formatVersion: 3, data: { ...data, painIssues: [], painObservations: [], pauses: [] } };
  }
  if (current.formatVersion === 3) {
    const data = (current.data ?? {}) as Record<string, unknown>;
    current = { ...current, formatVersion: 4, data: { ...data, strengthTemplates: [], strengthLogs: [] } };
  }
  if (current.formatVersion === 4) {
    const data = (current.data ?? {}) as Record<string, unknown>;
    current = { ...current, formatVersion: 5, data: { ...data, planChanges: [] } };
  }
  if (current.formatVersion === 5) {
    const data = (current.data ?? {}) as Record<string, unknown>;
    current = { ...current, formatVersion: 6, data: { ...data, prepRaces: [], generatorSettings: [] } };
  }
  if (current.formatVersion === 6) {
    const data = (current.data ?? {}) as Record<string, unknown>;
    current = { ...current, formatVersion: 7, data: { ...data, trainingCamps: [] } };
  }
  return current;
}

export function parseBackup(text: string): ParseBackupResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, errors: ['Die Datei ist kein gültiges JSON.'] };
  }
  if (typeof raw !== 'object' || raw === null || (raw as { format?: unknown }).format !== BACKUP_FORMAT) {
    return { ok: false, errors: ['Die Datei ist kein Backup dieser App.'] };
  }
  const version = (raw as { formatVersion?: unknown }).formatVersion;
  if (typeof version === 'number' && version > BACKUP_FORMAT_VERSION) {
    return {
      ok: false,
      errors: [`Das Backup stammt aus einer neueren App-Version (Format ${version}). Bitte zuerst die App aktualisieren.`],
    };
  }
  const parsed = backupFileSchema.safeParse(migrateBackup(raw as Record<string, unknown>));
  if (!parsed.success) {
    return {
      ok: false,
      errors: parsed.error.issues.slice(0, 20).map((i) => `${i.path.join('.') || '(Datei)'}: ${i.message}`),
    };
  }
  const backup = parsed.data;
  const dates = backup.data.activities.map((a) => a.date).sort();
  return {
    ok: true,
    backup,
    summary: {
      exportedAt: backup.exportedAt,
      appVersion: backup.appVersion,
      races: backup.data.races.length,
      plans: backup.data.plans.length,
      weeks: backup.data.weeks.length,
      activities: backup.data.activities.length,
      firstActivity: dates[0] ?? null,
      lastActivity: dates[dates.length - 1] ?? null,
    },
  };
}

// ───────────────────────────── CSV ─────────────────────────────

const CSV_SEP = ';'; // Deutsches Excel erwartet Semikolon und Dezimalkomma.

function csvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  const s = typeof value === 'number' ? String(Math.round(value * 100) / 100).replace('.', ',') : value;
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** CSV aller Einheiten. Unbekannte Zonenzeit bleibt leer bzw. wird separat ausgewiesen. */
export function activitiesToCsv(activities: readonly CompletedActivity[]): string {
  const header = [
    'Datum',
    'KW',
    'Sportart',
    'Fokus',
    'Dauer_min',
    'Distanz_km',
    'RPE',
    ...ZONES.map((z) => `${z.toUpperCase()}_min`),
    'Zone_unbekannt_min',
    'Notiz',
  ];
  const rows = [...activities]
    .sort((a, b) => (a.date === b.date ? a.createdAt.localeCompare(b.createdAt) : a.date.localeCompare(b.date)))
    .map((a) => {
      const { year, week } = isoWeek(a.date);
      const { unknown } = splitKnownUnknown(a.durationSec, a.zoneSec);
      return [
        a.date,
        `${year}-W${String(week).padStart(2, '0')}`,
        SPORT_LABEL[a.sport],
        SESSION_FOCUS_LABEL[a.focus],
        a.durationSec / 60,
        a.distanceM === undefined ? null : a.distanceM / 1000,
        a.rpe ?? null,
        ...ZONES.map((z) => (a.zoneSec?.[z] === undefined ? null : (a.zoneSec[z] as number) / 60)),
        a.sport === 'strength' || a.sport === 'other' ? null : unknown / 60,
        a.note ?? null,
      ]
        .map(csvCell)
        .join(CSV_SEP);
    });
  return [header.join(CSV_SEP), ...rows].join('\r\n');
}
