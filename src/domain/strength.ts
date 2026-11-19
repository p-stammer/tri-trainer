/** Krafttraining: Workout aus Vorlage erzeugen, Sätze dokumentieren, auswerten. Reine Funktionen. */
import { compareDates, type LocalDate } from './calendar';
import type { StrengthExerciseLog, StrengthFocus, StrengthSetLog, StrengthWorkoutLog, StrengthWorkoutTemplate } from './schemas';

export const STRENGTH_FOCUS_LABEL: Record<StrengthFocus, string> = {
  full_body: 'Ganzkörper',
  lower_body: 'Beine und Hüfte',
  upper_body: 'Oberkörper',
  core: 'Rumpf',
  mobility: 'Beweglichkeit',
  prevention: 'Prävention',
  other: 'Sonstiges',
};

/** Neues Workout als tiefe Kopie der Vorlage. Sätze sind offen, tatsächliche Werte leer. */
export function createLogFromTemplate(t: StrengthWorkoutTemplate, date: LocalDate, id: string, now: string): StrengthWorkoutLog {
  return {
    id,
    templateId: t.id,
    name: t.name,
    focus: t.focus,
    date,
    status: 'in_progress',
    startedAt: now,
    exercises: t.exercises.map((e) => {
      const log: StrengthExerciseLog = {
        templateExerciseId: e.id,
        name: e.name,
        mode: e.mode,
        skipped: false,
        sets: Array.from({ length: e.sets }, () => {
          const s: StrengthSetLog = { done: false };
          if (e.mode === 'reps' && e.reps !== undefined) s.targetReps = e.reps;
          if (e.mode === 'time' && e.durationSec !== undefined) s.targetDurationSec = e.durationSec;
          if (e.weightKg !== undefined) s.targetWeightKg = e.weightKg;
          return s;
        }),
      };
      if (e.restSec !== undefined) log.restSec = e.restSec;
      if (e.targetRpe !== undefined) log.targetRpe = e.targetRpe;
      if (e.targetRir !== undefined) log.targetRir = e.targetRir;
      if (e.note) log.templateNote = e.note;
      return log;
    }),
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Schnell-Erfassung: Vorlage als absolviert abhaken, ohne Satzdetails. Die Übungen werden als
 * Kopie gespeichert (für spätere Ergänzung), Sätze bleiben offen – es werden keine Werte unterstellt.
 */
export function createQuickLog(t: StrengthWorkoutTemplate, date: LocalDate, id: string, now: string): StrengthWorkoutLog {
  return { ...createLogFromTemplate(t, date, id, now), status: 'completed', entryMode: 'quick' };
}

export function isQuickWithoutDetails(log: Pick<StrengthWorkoutLog, 'entryMode' | 'exercises'>): boolean {
  return log.entryMode === 'quick' && summarizeWorkout(log).doneSets === 0;
}

/** Sobald Sätze dokumentiert sind, ist ein Schnell-Eintrag ein detailliertes Protokoll. */
export function normalizeEntryMode(log: StrengthWorkoutLog): StrengthWorkoutLog {
  if (log.entryMode === 'quick' && summarizeWorkout(log).doneSets > 0) return { ...log, entryMode: 'detailed' };
  return log;
}

/**
 * Satz abhaken bzw. wieder öffnen. Beim Abhaken werden leere Ist-Werte mit der Vorgabe vorbelegt
 * (der Nutzer bestätigt damit, die Vorgabe absolviert zu haben, und kann die Werte ändern).
 */
export function toggleSet(set: StrengthSetLog): StrengthSetLog {
  if (set.done) return { ...set, done: false };
  const next: StrengthSetLog = { ...set, done: true };
  if (next.reps === undefined && next.targetReps !== undefined) next.reps = next.targetReps;
  if (next.durationSec === undefined && next.targetDurationSec !== undefined) next.durationSec = next.targetDurationSec;
  if (next.weightKg === undefined && next.targetWeightKg !== undefined) next.weightKg = next.targetWeightKg;
  return next;
}

export function updateExercise(log: StrengthWorkoutLog, index: number, fn: (e: StrengthExerciseLog) => StrengthExerciseLog): StrengthWorkoutLog {
  return { ...log, exercises: log.exercises.map((e, i) => (i === index ? fn(e) : e)) };
}

export function updateSet(log: StrengthWorkoutLog, exIndex: number, setIndex: number, fn: (s: StrengthSetLog) => StrengthSetLog): StrengthWorkoutLog {
  return updateExercise(log, exIndex, (e) => ({ ...e, sets: e.sets.map((s, i) => (i === setIndex ? fn(s) : s)) }));
}

export function addSet(log: StrengthWorkoutLog, exIndex: number): StrengthWorkoutLog {
  return updateExercise(log, exIndex, (e) => {
    const last = e.sets[e.sets.length - 1];
    const s: StrengthSetLog = { done: false };
    if (last?.targetReps !== undefined) s.targetReps = last.targetReps;
    if (last?.targetDurationSec !== undefined) s.targetDurationSec = last.targetDurationSec;
    if (last?.targetWeightKg !== undefined) s.targetWeightKg = last.targetWeightKg;
    return { ...e, sets: [...e.sets, s] };
  });
}

export interface WorkoutSummary {
  totalSets: number;
  doneSets: number;
  exercises: number;
  doneExercises: number;
  skippedExercises: number;
  /** Summe Wiederholungen × Gewicht der abgehakten Sätze, bei denen beides bekannt ist (kg). */
  volumeKg: number;
}

export function summarizeWorkout(log: Pick<StrengthWorkoutLog, 'exercises'>): WorkoutSummary {
  let totalSets = 0;
  let doneSets = 0;
  let doneExercises = 0;
  let skipped = 0;
  let volume = 0;
  for (const e of log.exercises) {
    if (e.skipped) {
      skipped += 1;
      continue;
    }
    totalSets += e.sets.length;
    const done = e.sets.filter((s) => s.done);
    doneSets += done.length;
    if (done.length === e.sets.length && e.sets.length > 0) doneExercises += 1;
    for (const s of done) if (s.reps !== undefined && s.weightKg !== undefined) volume += s.reps * s.weightKg;
  }
  return { totalSets, doneSets, exercises: log.exercises.length, doneExercises, skippedExercises: skipped, volumeKg: volume };
}

/** Letzte abgeschlossene Ausführung einer Übung (über den Namen, unabhängig von der Vorlage). */
export function lastPerformance(
  logs: readonly StrengthWorkoutLog[],
  exerciseName: string,
  beforeLogId?: string,
): { date: LocalDate; sets: StrengthSetLog[] } | null {
  const key = exerciseName.trim().toLowerCase();
  const candidates = logs
    .filter((l) => l.status === 'completed' && l.id !== beforeLogId)
    .sort((a, b) => compareDates(b.date, a.date) || b.startedAt.localeCompare(a.startedAt));
  for (const l of candidates) {
    const e = l.exercises.find((x) => !x.skipped && x.name.trim().toLowerCase() === key);
    const done = e?.sets.filter((s) => s.done) ?? [];
    if (e && done.length) return { date: l.date, sets: done };
  }
  return null;
}

/** "3 × 10 @ 40 kg" bzw. "3 × 45 s" – kompakte Beschreibung von Sätzen. */
export function describeSets(sets: readonly Pick<StrengthSetLog, 'reps' | 'durationSec' | 'weightKg'>[], mode: 'reps' | 'time'): string {
  if (sets.length === 0) return '–';
  const val = (s: (typeof sets)[number]) =>
    mode === 'reps' ? (s.reps !== undefined ? `${s.reps}` : '?') : s.durationSec !== undefined ? `${s.durationSec} s` : '?';
  const w = (s: (typeof sets)[number]) => (s.weightKg !== undefined && s.weightKg > 0 ? ` @ ${String(s.weightKg).replace('.', ',')} kg` : '');
  const parts = sets.map((s) => `${val(s)}${w(s)}`);
  const allSame = parts.every((p) => p === parts[0]);
  return allSame ? `${sets.length} × ${parts[0]}` : parts.join(', ');
}
