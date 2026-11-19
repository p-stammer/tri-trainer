/**
 * Datenmodell (MVP 1) als Zod-Schemas. Die TypeScript-Typen werden daraus abgeleitet,
 * damit Validierung (Eingabe, Import, Restore) und Typen nie auseinanderlaufen.
 *
 * Konventionen: Distanz in Metern, Dauer in Sekunden, Kalendertage als "YYYY-MM-DD",
 * Zeitstempel als ISO-8601-UTC-String. Alle Entitäten haben eine eindeutige String-ID.
 */
import { z } from 'zod';
import { isLocalDate } from './calendar';
import { PHASE_TYPES, SESSION_FOCUSES, SPORTS, PLANNED_SPORTS, ENDURANCE_SPORTS } from './sports';

export const localDateSchema = z.string().refine(isLocalDate, { message: 'Ungültiges Datum (YYYY-MM-DD)' });
export const timestampSchema = z.string().min(10);
export const idSchema = z.string().min(1);

const nonNeg = z.number().finite().min(0);
const posInt = z.number().int().min(0);

export const sportSchema = z.enum(SPORTS);
export const plannedSportSchema = z.enum(PLANNED_SPORTS);
export const enduranceSportSchema = z.enum(ENDURANCE_SPORTS);
export const sessionFocusSchema = z.enum(SESSION_FOCUSES);
export const phaseTypeSchema = z.enum(PHASE_TYPES);
export const primaryMetricSchema = z.enum(['duration', 'distance']);

/** Zonenzeiten: fehlender Schlüssel = unbekannt. */
export const zoneSecondsSchema = z.object({
  z1: nonNeg.optional(),
  z2: nonNeg.optional(),
  z3: nonNeg.optional(),
  z4: nonNeg.optional(),
  z5: nonNeg.optional(),
});

// ───────────────────────────── Einstellungen & Profil ─────────────────────────────

export const appSettingsSchema = z.object({
  id: z.literal('app'),
  timeZone: z.string().min(1),
  primaryMetric: z.object({
    swim: primaryMetricSchema,
    bike: primaryMetricSchema,
    run: primaryMetricSchema,
  }),
  theme: z.enum(['system', 'light', 'dark']),
  lastSport: sportSchema.optional(),
  lastBackupAt: timestampSchema.optional(),
  /** Anpassungsvorschläge für diese Woche ausgeblendet (seit 0.14.0). */
  adaptationDismissedWeek: localDateSchema.optional(),
  /** Wochenrückblick für diese Woche ausgeblendet (Wochenanfang der laufenden Woche, seit 0.17.0). */
  reviewDismissedWeek: localDateSchema.optional(),
  /** Test-Erinnerung für diese Woche ausgeblendet (seit 0.18.0). */
  testReminderDismissedWeek: localDateSchema.optional(),
  /** Annahmen der Zielzeit-Prognose (seit 0.19.0). */
  prognosis: z
    .object({
      /** bis 0.20.0: Rad-Typ für die Prognose – seit 0.21.0 im Race-Setup des Profils */
      bikeType: z.enum(['tt', 'road_aero', 'road']).optional(),
      bikeElevationM: z.number().min(0).max(6000).optional(),
    })
    .optional(),
  onboardingCompletedAt: timestampSchema.optional(),
  /** Aktiver Trainingsplan (MVP 1: genau ein aktiver Plan). */
  activePlanId: idSchema.optional(),
});
export type AppSettings = z.infer<typeof appSettingsSchema>;

/** Aktueller (durchschnittlicher) Wochenumfang einer Sportart im Bezugszeitraum. */
const baselineSportSchema = z.object({
  distanceM: nonNeg.optional(),
  durationSec: nonNeg.optional(),
  /** Durchschnittliche Anzahl Einheiten pro Woche (Dezimalwerte erlaubt, z. B. 2,5). */
  sessions: z.number().min(0).max(30).optional(),
});

export const trainingBaselineSchema = z.object({
  /** Über wie viele zurückliegende Wochen gemittelt wurde. */
  periodWeeks: z.number().int().min(1).max(52).optional(),
  swim: baselineSportSchema.optional(),
  bike: baselineSportSchema.optional(),
  run: baselineSportSchema.optional(),
  strength: baselineSportSchema.optional(),
});
export type TrainingBaseline = z.infer<typeof trainingBaselineSchema>;

export const athleteProfileSchema = z.object({
  id: z.literal('me'),
  name: z.string().max(80).optional(),
  birthDate: localDateSchema.optional(),
  sex: z.enum(['female', 'male', 'diverse', 'unspecified']).optional(),
  heightCm: z.number().min(50).max(250).optional(),
  weightKg: z.number().min(20).max(300).optional(),
  triathlonExperienceYears: z.number().min(0).max(80).optional(),
  sportsBackground: z.string().max(2000).optional(),
  constraints: z.string().max(2000).optional(),
  /** Zeitbudget: maximal verfügbare Trainingszeit pro Woche (Sekunden) – Obergrenze für Planvorschläge. */
  availableWeeklySec: nonNeg.optional(),
  /** Aktueller Trainingsumfang je Sportart – Ausgangspunkt der späteren Planung (Anforderung 5.3). */
  baseline: trainingBaselineSchema.optional(),
  /** Race-Setup für die Zielzeit-Prognose (seit 0.21.0); ohne Setup zeigt die App keine Prognose. */
  raceSetup: z
    .object({
      bikeType: z.enum(['tt', 'aero_road', 'road', 'gravel']),
      /** Aufleger (bei Zeitfahr-/Triathlonrad immer) */
      clipOns: z.boolean(),
      wheels: z.enum(['deep', 'standard']),
      tires: z.enum(['race', 'training']),
      kit: z.enum(['aero', 'normal', 'loose']),
      runShoes: z.enum(['carbon', 'training']),
      wetsuit: z.enum(['yes', 'no', 'unknown']),
    })
    .optional(),
  /** Bestzeiten für die Zielzeit-Prognose (seit 0.19.0), je optional mit Jahr. */
  bestTimes: z
    .object({
      run10k: z.object({ timeSec: z.number().min(1200).max(7200), year: z.number().int().min(1950).max(2100).optional() }).optional(),
      runHalf: z.object({ timeSec: z.number().min(3000).max(14400), year: z.number().int().min(1950).max(2100).optional() }).optional(),
      runMarathon: z.object({ timeSec: z.number().min(6600).max(28800), year: z.number().int().min(1950).max(2100).optional() }).optional(),
      triOlympic: z.object({ timeSec: z.number().min(5400).max(18000), year: z.number().int().min(1950).max(2100).optional() }).optional(),
      tri703: z.object({ timeSec: z.number().min(12000).max(32400), year: z.number().int().min(1950).max(2100).optional() }).optional(),
    })
    .optional(),
  updatedAt: timestampSchema,
});
export type AthleteProfile = z.infer<typeof athleteProfileSchema>;

// ───────────────────────────── Wettkampf ─────────────────────────────

export const raceDistancePresetSchema = z.enum(['full', 'half', 'olympic', 'sprint', 'custom']);
export type RaceDistancePreset = z.infer<typeof raceDistancePresetSchema>;

export const targetRaceSchema = z
  .object({
    id: idSchema,
    name: z.string().min(1).max(120),
    date: localDateSchema,
    preset: raceDistancePresetSchema,
    swimM: nonNeg,
    bikeM: nonNeg,
    runM: nonNeg,
    goalTimeSec: nonNeg.optional(),
    prepStartDate: localDateSchema,
    createdAt: timestampSchema,
    updatedAt: timestampSchema,
  })
  .refine((r) => r.prepStartDate <= r.date, {
    message: 'Der Vorbereitungsbeginn muss vor dem Wettkampf liegen.',
    path: ['prepStartDate'],
  });
export type TargetRace = z.infer<typeof targetRaceSchema>;

// ───────────────────────────── Leistungswerte & Zonen ─────────────────────────────

export const performanceMetricKindSchema = z.enum([
  'bike_ftp_w',
  'bike_threshold_hr',
  'run_threshold_pace_s_per_km',
  'run_threshold_hr',
  'swim_css_s_per_100m',
  /** VO2max in ml/kg/min (seit 0.20.0) – nur Dokumentation, fließt nicht in Planung oder Prognose ein. */
  'vo2max_ml_kg_min',
]);
export type PerformanceMetricKind = z.infer<typeof performanceMetricKindSchema>;

export const performanceMetricSchema = z.object({
  id: idSchema,
  kind: performanceMetricKindSchema,
  value: z.number().finite().positive(),
  unit: z.enum(['W', 'bpm', 's/km', 's/100m', 'ml/kg/min']),
  date: localDateSchema,
  method: z.string().max(200).optional(),
  source: z.string().max(200).optional(),
  createdAt: timestampSchema,
});
export type PerformanceMetric = z.infer<typeof performanceMetricSchema>;

export const zoneMetricSchema = z.enum(['power_w', 'pace_s_per_km', 'pace_s_per_100m', 'heart_rate_bpm']);
export type ZoneMetric = z.infer<typeof zoneMetricSchema>;

/**
 * Zonengrenzen als Untergrenzen von Z2…Z5 in der jeweiligen Messgröße.
 * Bei Leistung/Herzfrequenz steigen die Werte, bei Pace fallen sie (schneller = kleiner).
 */
export const sportZoneConfigSchema = z.object({
  id: enduranceSportSchema,
  sport: enduranceSportSchema,
  metric: zoneMetricSchema,
  /** `derived_friel_pace` nur aus 0.15.0 (alte, zu schnelle Grundlage) – wird nicht mehr erzeugt. */
  method: z.enum(['manual', 'derived_coggan_ftp', 'derived_friel_pace', 'derived_run_pace', 'derived_css_offset']),
  /** Referenzwert, aus dem abgeleitet wurde (z. B. FTP), sonst leer. */
  referenceValue: z.number().positive().optional(),
  bounds: z.tuple([z.number().positive(), z.number().positive(), z.number().positive(), z.number().positive()]),
  updatedAt: timestampSchema,
});
export type SportZoneConfiguration = z.infer<typeof sportZoneConfigSchema>;

// ───────────────────────────── Trainingsplan ─────────────────────────────

export const weeklySportTargetSchema = z.object({
  sport: plannedSportSchema,
  durationSec: nonNeg.optional(),
  distanceM: nonNeg.optional(),
  sessions: posInt.optional(),
  zoneSec: zoneSecondsSchema.optional(),
});
export type WeeklySportTarget = z.infer<typeof weeklySportTargetSchema>;

export const plannedSessionFocusSchema = z.object({
  id: idSchema,
  sport: plannedSportSchema,
  focus: sessionFocusSchema,
  count: z.number().int().min(1).max(14),
  note: z.string().max(300).optional(),
});
export type PlannedSessionFocus = z.infer<typeof plannedSessionFocusSchema>;

export const weekTargetsSchema = z.object({
  phase: phaseTypeSchema.optional(),
  sports: z.array(weeklySportTargetSchema),
  focuses: z.array(plannedSessionFocusSchema),
  freshnessTarget: z
    .object({ min: z.number().int().min(1).max(10), max: z.number().int().min(1).max(10) })
    .optional(),
  notes: z.string().max(2000).optional(),
});
export type WeekTargets = z.infer<typeof weekTargetsSchema>;

export const trainingPlanSchema = z.object({
  id: idSchema,
  raceId: idSchema,
  name: z.string().min(1).max(120),
  origin: z.enum(['manual', 'generated', 'imported']),
  startWeek: localDateSchema,
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
});
export type TrainingPlan = z.infer<typeof trainingPlanSchema>;

/**
 * Eine Planwoche. `original` ist der Stand bei Planübernahme (wird nie überschrieben),
 * `current` ist der aktuell gültige Plan. Absolvierte Einheiten liegen getrennt in `activities`
 * und werden durch Planänderungen nie berührt.
 */
export const trainingWeekSchema = z.object({
  id: idSchema,
  planId: idSchema,
  weekStart: localDateSchema,
  original: weekTargetsSchema.optional(),
  current: weekTargetsSchema,
  revision: z.number().int().min(0),
  updatedAt: timestampSchema,
});
export type TrainingWeek = z.infer<typeof trainingWeekSchema>;

// ───────────────────────────── Absolvierte Einheiten ─────────────────────────────

export const completedActivitySchema = z
  .object({
    id: idSchema,
    sport: sportSchema,
    /** Lokaler Kalendertag, an dem trainiert wurde. Bestimmt die Wochenzuordnung. */
    date: localDateSchema,
    durationSec: z.number().finite().positive().max(24 * 3600),
    distanceM: nonNeg.optional(),
    focus: sessionFocusSchema,
    zoneSec: zoneSecondsSchema.optional(),
    rpe: z.number().int().min(1).max(10).optional(),
    note: z.string().max(2000).optional(),
    /** Art bei „Sonstiges / Cardio“, z. B. „Wandern“ (seit 0.12.0). */
    label: z.string().trim().min(1).max(60).optional(),
    plannedFocusId: idSchema.optional(),
    createdAt: timestampSchema,
    updatedAt: timestampSchema,
  })
  .refine(
    (a) => {
      const z = a.zoneSec;
      if (!z) return true;
      const sum = (z.z1 ?? 0) + (z.z2 ?? 0) + (z.z3 ?? 0) + (z.z4 ?? 0) + (z.z5 ?? 0);
      return sum <= a.durationSec + 0.5;
    },
    { message: 'Die Summe der Zonenzeiten ist größer als die Trainingsdauer.', path: ['zoneSec'] },
  );
export type CompletedActivity = z.infer<typeof completedActivitySchema>;

// ───────────────────────────── Frische (MVP 2, DB-Version 2) ─────────────────────────────

const scale5 = z.number().int().min(1).max(5);

/**
 * Wöchentlicher Check-in. Pro Trainingswoche gibt es höchstens einen Eintrag (Upsert über weekStart).
 * Hauptkennzahl: subjektive Frische 1–10 (1 = extrem erschöpft, 5 = durchschnittlich, 10 = außergewöhnlich frisch).
 */
export const weeklyWellnessCheckinSchema = z.object({
  id: idSchema,
  weekStart: localDateSchema,
  date: localDateSchema,
  freshness: z.number().int().min(1).max(10),
  sleepQuality: scale5.optional(),
  soreness: scale5.optional(),
  motivation: scale5.optional(),
  wellbeing: scale5.optional(),
  note: z.string().max(2000).optional(),
  /** Nutzer hat einen Hinweis zu diesem Check-in als geprüft markiert. */
  acknowledgedAt: timestampSchema.optional(),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
});
export type WeeklyWellnessCheckin = z.infer<typeof weeklyWellnessCheckinSchema>;

// ───────────────────────────── Beschwerden & Pausen (MVP 2, DB-Version 3) ─────────────────────────────

export const BODY_REGIONS = [
  'foot',
  'ankle',
  'achilles',
  'calf',
  'shin',
  'knee',
  'thigh_front',
  'thigh_back',
  'hip',
  'groin',
  'lower_back',
  'upper_back',
  'neck',
  'shoulder',
  'elbow',
  'wrist',
  'other',
] as const;
export type BodyRegion = (typeof BODY_REGIONS)[number];

export const painIssueSchema = z.object({
  id: idSchema,
  region: z.enum(BODY_REGIONS),
  side: z.enum(['left', 'right', 'both']).optional(),
  /** Freitext, z. B. "Ziehen an der Außenseite". Bei region "other" die Körperstelle. */
  description: z.string().max(2000).optional(),
  sports: z.array(sportSchema),
  status: z.enum(['active', 'improving', 'resolved']),
  startDate: localDateSchema,
  resolvedDate: localDateSchema.optional(),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
});
export type PainIssue = z.infer<typeof painIssueSchema>;

/** Einzelbeobachtung einer Beschwerde an einem Tag (Schmerzstärke 0–10). */
export const painObservationSchema = z.object({
  id: idSchema,
  issueId: idSchema,
  date: localDateSchema,
  pain: z.number().int().min(0).max(10),
  note: z.string().max(1000).optional(),
  createdAt: timestampSchema,
});
export type PainObservation = z.infer<typeof painObservationSchema>;

export const trainingPauseSchema = z
  .object({
    id: idSchema,
    /** "all" = gesamtes Training, "sports" = nur die genannten Sportarten. */
    scope: z.enum(['all', 'sports']),
    sports: z.array(plannedSportSchema),
    startDate: localDateSchema,
    /** Leer = offenes Ende. */
    endDate: localDateSchema.optional(),
    reason: z.string().max(500).optional(),
    painIssueId: idSchema.optional(),
    createdAt: timestampSchema,
    updatedAt: timestampSchema,
  })
  .refine((p) => p.scope === 'all' || p.sports.length > 0, { message: 'Bitte mindestens eine Sportart wählen.', path: ['sports'] })
  .refine((p) => !p.endDate || p.endDate >= p.startDate, { message: 'Das Ende darf nicht vor dem Beginn liegen.', path: ['endDate'] });
export type TrainingPause = z.infer<typeof trainingPauseSchema>;

// ───────────────────────────── Krafttraining (MVP 2, DB-Version 4) ─────────────────────────────

export const STRENGTH_FOCUSES = ['full_body', 'lower_body', 'upper_body', 'core', 'mobility', 'prevention', 'other'] as const;
export type StrengthFocus = (typeof STRENGTH_FOCUSES)[number];

export const strengthExerciseTemplateSchema = z
  .object({
    id: idSchema,
    name: z.string().min(1).max(120),
    sets: z.number().int().min(1).max(20),
    /** Wiederholungen ODER Dauer je Satz. */
    mode: z.enum(['reps', 'time']),
    reps: z.number().int().min(1).max(200).optional(),
    durationSec: z.number().int().min(1).max(3600).optional(),
    weightKg: z.number().min(0).max(500).optional(),
    restSec: z.number().int().min(0).max(1800).optional(),
    targetRpe: z.number().min(1).max(10).optional(),
    targetRir: z.number().int().min(0).max(10).optional(),
    note: z.string().max(500).optional(),
  })
  .refine((e) => (e.mode === 'reps' ? e.reps !== undefined : e.durationSec !== undefined), {
    message: 'Bitte Wiederholungen bzw. Dauer je Satz angeben.',
    path: ['reps'],
  });
export type StrengthExerciseTemplate = z.infer<typeof strengthExerciseTemplateSchema>;

export const strengthWorkoutTemplateSchema = z.object({
  id: idSchema,
  name: z.string().min(1).max(120),
  focus: z.enum(STRENGTH_FOCUSES),
  description: z.string().max(2000).optional(),
  plannedDurationSec: z.number().int().min(0).max(6 * 3600).optional(),
  exercises: z.array(strengthExerciseTemplateSchema).min(1, { message: 'Mindestens eine Übung.' }),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
});
export type StrengthWorkoutTemplate = z.infer<typeof strengthWorkoutTemplateSchema>;

/** Ein Satz: Vorgabe (aus der Vorlage kopiert) und tatsächliche Werte. */
export const strengthSetLogSchema = z.object({
  targetReps: z.number().int().min(1).optional(),
  targetDurationSec: z.number().int().min(1).optional(),
  targetWeightKg: z.number().min(0).optional(),
  reps: z.number().int().min(0).max(500).optional(),
  durationSec: z.number().int().min(0).max(3600).optional(),
  weightKg: z.number().min(0).max(500).optional(),
  done: z.boolean(),
});
export type StrengthSetLog = z.infer<typeof strengthSetLogSchema>;

export const strengthExerciseLogSchema = z.object({
  templateExerciseId: idSchema.optional(),
  name: z.string().min(1).max(120),
  mode: z.enum(['reps', 'time']),
  restSec: z.number().int().min(0).optional(),
  targetRpe: z.number().optional(),
  targetRir: z.number().int().optional(),
  templateNote: z.string().optional(),
  skipped: z.boolean(),
  note: z.string().max(500).optional(),
  sets: z.array(strengthSetLogSchema),
});
export type StrengthExerciseLog = z.infer<typeof strengthExerciseLogSchema>;

/**
 * Durchgeführtes Workout. Enthält eine KOPIE der Vorlage (Name, Fokus, Übungen, Vorgaben),
 * damit spätere Vorlagenänderungen die Historie nicht verändern.
 */
export const strengthWorkoutLogSchema = z.object({
  id: idSchema,
  templateId: idSchema.optional(),
  name: z.string().min(1).max(120),
  focus: z.enum(STRENGTH_FOCUSES),
  date: localDateSchema,
  status: z.enum(['in_progress', 'completed']),
  /**
   * "quick" = nur abgehakt ("Vorlage X gemacht"), ohne Satzdetails. Wird zu "detailed", sobald
   * ein Satz dokumentiert wird. Fehlt das Feld (ältere Daten), gilt "detailed".
   */
  entryMode: z.enum(['quick', 'detailed']).optional(),
  startedAt: timestampSchema,
  durationSec: z.number().int().min(0).max(24 * 3600).optional(),
  rpe: z.number().int().min(1).max(10).optional(),
  note: z.string().max(2000).optional(),
  exercises: z.array(strengthExerciseLogSchema),
  /** Verknüpfte Trainingseinheit (zählt für Wochenziele). Erst beim Abschluss gesetzt. */
  activityId: idSchema.optional(),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
});
export type StrengthWorkoutLog = z.infer<typeof strengthWorkoutLogSchema>;

// ───────────────────────────── Änderungshistorie des Plans (MVP 2, DB-Version 5) ─────────────────────────────

export const PLAN_CHANGE_KINDS = ['week_edit', 'copy', 'bulk_phase', 'bulk_scale', 'bulk_copy', 'bulk_freshness', 'pause_adjust', 'import', 'generated', 'undo'] as const;
export type PlanChangeKind = (typeof PLAN_CHANGE_KINDS)[number];

/** Jede übernommene Planänderung mit Vorher/Nachher je Woche – Grundlage für Vergleich und "Rückgängig". */
export const planChangeSchema = z.object({
  id: idSchema,
  planId: idSchema,
  createdAt: timestampSchema,
  kind: z.enum(PLAN_CHANGE_KINDS),
  description: z.string().max(300),
  weeks: z.array(z.object({ weekStart: localDateSchema, before: weekTargetsSchema, after: weekTargetsSchema })).min(1),
  /** Bei kind "undo": die rückgängig gemachte Änderung. */
  undoOf: idSchema.optional(),
});
export type PlanChange = z.infer<typeof planChangeSchema>;

// ───────────────────────────── Plangenerator (Version 1.0, DB-Version 6) ─────────────────────────────

export const PREP_RACE_KINDS = ['triathlon', 'run', 'bike', 'swim', 'other'] as const;
export type PrepRaceKind = (typeof PREP_RACE_KINDS)[number];

/** Vorbereitungswettkampf (Entscheidung 17.11.2026): mehrere je Plan, Datum frei, mit Mini-Taper im Generator. */
export const PREP_RACE_PRIORITIES = ['low', 'medium', 'high'] as const;
export type PrepRacePriority = (typeof PREP_RACE_PRIORITIES)[number];

export const prepRaceSchema = z
  .object({
    id: idSchema,
    planId: idSchema,
    name: z.string().min(1).max(120),
    date: localDateSchema,
    kind: z.enum(PREP_RACE_KINDS),
    swimM: nonNeg.optional(),
    bikeM: nonNeg.optional(),
    runM: nonNeg.optional(),
    /** Wichtigkeit (seit 0.13.0): niedrig = Trainingswettkampf ohne Taper. Fehlt sie, gilt „niedrig“. */
    priority: z.enum(PREP_RACE_PRIORITIES).optional(),
    notes: z.string().max(1000).optional(),
    createdAt: timestampSchema,
    updatedAt: timestampSchema,
  })
  .refine((r) => r.kind === 'other' || (r.swimM ?? 0) + (r.bikeM ?? 0) + (r.runM ?? 0) > 0, {
    message: 'Bitte mindestens eine Distanz angeben.',
    path: ['runM'],
  });
export type PrepRace = z.infer<typeof prepRaceSchema>;

/** Trainingslager (seit 0.21.0, DB-Version 7): Zeitraum mit mehr verfügbarer Zeit pro Tag. */
export const trainingCampSchema = z
  .object({
    id: idSchema,
    planId: idSchema,
    name: z.string().min(1).max(120),
    startDate: localDateSchema,
    endDate: localDateSchema,
    /** Verfügbare Trainingszeit pro Camp-Tag in Stunden (0,5–8). */
    hoursPerDay: z.number().min(0.5).max(8),
    notes: z.string().max(1000).optional(),
    createdAt: timestampSchema,
    updatedAt: timestampSchema,
  })
  .refine((c) => c.endDate >= c.startDate, { message: 'Das Ende darf nicht vor dem Beginn liegen.', path: ['endDate'] })
  .refine((c) => c.endDate <= addDaysIso(c.startDate, 27), { message: 'Ein Trainingslager darf höchstens 4 Wochen dauern.', path: ['endDate'] });
export type TrainingCamp = z.infer<typeof trainingCampSchema>;

function addDaysIso(d: string, n: number): string {
  const t = Date.UTC(Number(d.slice(0, 4)), Number(d.slice(5, 7)) - 1, Number(d.slice(8, 10))) + n * 86400000;
  return new Date(t).toISOString().slice(0, 10);
}

const priorityValue = z.number().int().min(1).max(5);
const disciplinePrioritySchema = z.object({
  /** Vom Nutzer gewünscht (manuell). */
  user: priorityValue.optional(),
  /** Vom Modell vorgeschlagen (Modul C) – ändert nur der Generator. */
  suggested: priorityValue.optional(),
  /** Tatsächlich verwendet – ändert sich nur durch Bestätigung eines Vorschlags. */
  applied: priorityValue.optional(),
});

const volumeLimitSchema = z.object({ durationSec: nonNeg.optional(), distanceM: nonNeg.optional() });

/** Einstellungen des Plangenerators je Plan (id = planId). */
export const generatorSettingsSchema = z.object({
  id: idSchema,
  planId: idSchema,
  /** 0 = konservativ/Langlebigkeit, 100 = aggressiv/zeitoptimiert. */
  philosophy: z.number().int().min(0).max(100),
  priorityMode: z.enum(['auto', 'hybrid', 'manual']),
  priorities: z.object({
    swim: disciplinePrioritySchema.optional(),
    bike: disciplinePrioritySchema.optional(),
    run: disciplinePrioritySchema.optional(),
  }),
  taperWeeks: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  /** Freiwasser/Neopren möglich ab (leer = nicht einplanen). */
  openWaterFrom: localDateSchema.optional(),
  /** Individuelle Höchstwerte pro Woche (harte Grenze). */
  maxWeekly: z.object({ swim: volumeLimitSchema.optional(), bike: volumeLimitSchema.optional(), run: volumeLimitSchema.optional() }).optional(),
  /** Längste Einheiten der letzten 30 Tage, falls nicht aus erfassten Einheiten ableitbar. */
  longestRecentRun: z.object({ durationSec: nonNeg.optional(), distanceM: nonNeg.optional(), asOf: localDateSchema }).optional(),
  longestRecentRide: z.object({ durationSec: nonNeg.optional(), asOf: localDateSchema }).optional(),
  updatedAt: timestampSchema,
});
export type GeneratorSettings = z.infer<typeof generatorSettingsSchema>;

export function defaultGeneratorSettings(planId: string, now: string): GeneratorSettings {
  return { id: planId, planId, philosophy: 50, priorityMode: 'auto', priorities: {}, taperWeeks: 2, updatedAt: now };
}
