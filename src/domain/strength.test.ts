import { describe, expect, it } from 'vitest';
import { addSet, createQuickLog, isQuickWithoutDetails, normalizeEntryMode, createLogFromTemplate, describeSets, lastPerformance, summarizeWorkout, toggleSet, updateSet } from './strength';
import type { StrengthWorkoutTemplate } from './schemas';

const template: StrengthWorkoutTemplate = {
  id: 't1',
  name: 'Ganzkörper A',
  focus: 'full_body',
  plannedDurationSec: 2700,
  exercises: [
    { id: 'e1', name: 'Kniebeuge', sets: 3, mode: 'reps', reps: 10, weightKg: 40, restSec: 90 },
    { id: 'e2', name: 'Unterarmstütz', sets: 2, mode: 'time', durationSec: 45 },
  ],
  createdAt: 't',
  updatedAt: 't',
};

describe('Krafttraining', () => {
  it('Workout aus Vorlage: Kopie mit offenen Sätzen und Vorgaben', () => {
    const log = createLogFromTemplate(template, '2026-11-17', 'l1', 'now');
    expect(log.exercises[0]?.sets).toHaveLength(3);
    expect(log.exercises[0]?.sets[0]).toEqual({ done: false, targetReps: 10, targetWeightKg: 40 });
    expect(log.exercises[1]?.sets[0]).toEqual({ done: false, targetDurationSec: 45 });
    expect(log.status).toBe('in_progress');
  });

  it('Testfall 8: Vorlagenänderung verändert kein abgeschlossenes Workout', () => {
    const log = createLogFromTemplate(template, '2026-11-17', 'l1', 'now');
    const snapshot = JSON.stringify(log);
    template.exercises[0]!.weightKg = 60;
    template.exercises[0]!.name = 'Frontkniebeuge';
    template.name = 'Neu';
    expect(JSON.stringify(log)).toBe(snapshot);
    expect(log.exercises[0]?.name).toBe('Kniebeuge');
    template.exercises[0]!.weightKg = 40;
    template.exercises[0]!.name = 'Kniebeuge';
    template.name = 'Ganzkörper A';
  });

  it('Satz abhaken übernimmt Vorgabe nur für leere Ist-Werte; Öffnen behält Werte', () => {
    expect(toggleSet({ done: false, targetReps: 10, targetWeightKg: 40 })).toEqual({ done: true, targetReps: 10, targetWeightKg: 40, reps: 10, weightKg: 40 });
    expect(toggleSet({ done: false, targetReps: 10, reps: 8 }).reps).toBe(8);
    expect(toggleSet({ done: true, reps: 8 })).toEqual({ done: false, reps: 8 });
  });

  it('Zusammenfassung: übersprungene Übungen zählen nicht, Volumen nur mit bekannten Werten', () => {
    let log = createLogFromTemplate(template, '2026-11-17', 'l1', 'now');
    log = updateSet(log, 0, 0, toggleSet);
    log = updateSet(log, 0, 1, (s) => toggleSet({ ...s, reps: 8 }));
    log = { ...log, exercises: log.exercises.map((e, i) => (i === 1 ? { ...e, skipped: true } : e)) };
    const s = summarizeWorkout(log);
    expect(s.totalSets).toBe(3);
    expect(s.doneSets).toBe(2);
    expect(s.skippedExercises).toBe(1);
    expect(s.volumeKg).toBe(10 * 40 + 8 * 40);
  });

  it('Schnell-Erfassung: abgeschlossen, ohne erfundene Satzwerte; wird durch Satzdetails zu "detailed"', () => {
    const q = createQuickLog(template, '2026-11-17', 'q', 'now');
    expect(q.status).toBe('completed');
    expect(q.entryMode).toBe('quick');
    expect(isQuickWithoutDetails(q)).toBe(true);
    expect(summarizeWorkout(q).volumeKg).toBe(0);
    expect(q.exercises.every((e) => e.sets.every((s) => !s.done && s.reps === undefined))).toBe(true);
    const d = normalizeEntryMode(updateSet(q, 0, 0, toggleSet));
    expect(d.entryMode).toBe('detailed');
    expect(lastPerformance([q], 'Kniebeuge')).toBeNull();
  });

  it('zusätzlichen Satz anhängen', () => {
    const log = addSet(createLogFromTemplate(template, '2026-11-17', 'l1', 'now'), 0);
    expect(log.exercises[0]?.sets).toHaveLength(4);
    expect(log.exercises[0]?.sets[3]?.targetReps).toBe(10);
  });

  it('letzte Ausführung und Kurzbeschreibung', () => {
    let a = createLogFromTemplate(template, '2026-11-10', 'a', 'x');
    a = { ...updateSet(a, 0, 0, toggleSet), status: 'completed' };
    let b = createLogFromTemplate(template, '2026-11-14', 'b', 'y');
    b = { ...updateSet(updateSet(b, 0, 0, (s) => toggleSet({ ...s, weightKg: 42.5 })), 0, 1, (s) => toggleSet({ ...s, weightKg: 42.5 })), status: 'completed' };
    const open = createLogFromTemplate(template, '2026-11-17', 'c', 'z');
    const last = lastPerformance([a, b, open], 'kniebeuge', 'c');
    expect(last?.date).toBe('2026-11-14');
    expect(describeSets(last!.sets, 'reps')).toBe('2 × 10 @ 42,5 kg');
    expect(describeSets([{ durationSec: 45 }, { durationSec: 40 }], 'time')).toBe('45 s, 40 s');
  });
});
