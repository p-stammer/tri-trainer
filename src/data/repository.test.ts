import { describe, expect, it } from 'vitest';
import { MemoryBackend } from './memoryBackend';
import { Repository, ValidationError } from './repository';
import { applyGeneratedPlan, loadGeneratorInput, loadGeneratorSettings, commitWeekChanges, undoPlanChange, saveReferenceMetric, logQuickWorkout, deleteActivityWithLinks, finishWorkout, saveStrengthTemplate, startWorkout, saveWorkoutProgress, acknowledgeCheckin, addPainObservation, applyWeekChanges, createPainIssue, savePause, copyWeekToWeeks, loadActiveContext, logActivity, saveCheckin, saveWeekTargets, setupRaceAndPlan, updateRace, type RaceInput } from './usecases';
import { createBackup, parseBackup } from '../domain/backup';
import { generatePlan } from '../engine/generate';
import { computeWeekProgress } from '../domain/progress';
import { proposePauseAdjustment, summarizeIssue } from '../domain/health';
import { bulkScale, bulkSetPhase } from '../domain/planEdit';
import { buildImportChanges, interpretRows, readImportText, suggestMapping } from '../domain/planImport';

const raceInput: RaceInput = {
  name: 'Ironman Frankfurt',
  date: '2027-06-27',
  preset: 'full',
  swimM: 3800,
  bikeM: 180_000,
  runM: 42_195,
  prepStartDate: '2026-11-02',
};

async function setup() {
  const repo = new Repository(new MemoryBackend());
  const { race, plan } = await setupRaceAndPlan(repo, raceInput, '2026-11-16T10:00:00.000Z');
  return { repo, race, plan };
}

describe('Repository & Anwendungsfälle', () => {
  it('Onboarding legt Wettkampf, Plan und alle Wochen an', async () => {
    const { repo } = await setup();
    const ctx = await loadActiveContext(repo);
    expect(ctx?.race.name).toBe('Ironman Frankfurt');
    expect(ctx?.weeks).toHaveLength(34); // 02.11.2026 … Woche ab 21.06.2027
    expect(ctx?.weeks[0]?.weekStart).toBe('2026-11-02');
    expect(ctx?.weeks[33]?.weekStart).toBe('2027-06-21');
  });

  it('ungültige Einheiten werden abgelehnt, nichts wird gespeichert', async () => {
    const { repo } = await setup();
    let error: unknown;
    try {
      await logActivity(repo, { sport: 'bike', date: '2026-11-17', durationSec: 3600, focus: 'threshold', zoneSec: { z4: 5000 } });
    } catch (e) {
      error = e;
    }
    expect(error instanceof ValidationError).toBe(true);
    expect(await repo.listActivities()).toHaveLength(0);
  });

  it('benachrichtigt Abonnenten nach Änderungen', async () => {
    const { repo } = await setup();
    let calls = 0;
    const off = repo.subscribe(() => calls++);
    await logActivity(repo, { sport: 'run', date: '2026-11-17', durationSec: 2400, focus: 'endurance' });
    off();
    await logActivity(repo, { sport: 'run', date: '2026-11-18', durationSec: 2400, focus: 'endurance' });
    expect(calls).toBe(2); // Einheit + lastSport-Einstellung, danach abgemeldet
  });

  it('Wettkampfdatum ändern: Historie und Wochen bleiben erhalten', async () => {
    const { repo, race } = await setup();
    await logActivity(repo, { sport: 'swim', date: '2026-11-03', durationSec: 2700, distanceM: 2400, focus: 'technique' });
    const ctx = await loadActiveContext(repo);
    const firstWeek = ctx!.weeks[0]!;
    await saveWeekTargets(repo, firstWeek, { sports: [{ sport: 'swim', distanceM: 6000 }], focuses: [] });

    const r = await updateRace(repo, { ...race, prepStartDate: '2026-11-16', date: '2027-07-04' });
    expect(r.added).toEqual(['2027-06-28']);
    expect(r.outside).toEqual(['2026-11-02', '2026-11-09']);

    const after = await loadActiveContext(repo);
    expect(after!.weeks.find((w) => w.weekStart === '2026-11-02')?.current.sports[0]?.distanceM).toBe(6000);
    expect(await repo.listActivities()).toHaveLength(1);
  });

  it('Testfall 4 (DB-Ebene): Planänderung lässt absolvierte Einheiten unverändert', async () => {
    const { repo, plan } = await setup();
    const a = await logActivity(repo, { sport: 'bike', date: '2026-11-17', durationSec: 5400, focus: 'endurance' });
    const week = (await repo.getWeek(plan.id, '2026-11-16'))!;
    await saveWeekTargets(repo, week, { sports: [{ sport: 'bike', durationSec: 8 * 3600 }], focuses: [] });
    const week2 = (await repo.getWeek(plan.id, '2026-11-16'))!;
    await saveWeekTargets(repo, week2, { sports: [{ sport: 'bike', durationSec: 4 * 3600 }], focuses: [] });
    expect(await repo.getActivity(a.id)).toStrictEqual(a);
    const w = (await repo.getWeek(plan.id, '2026-11-16'))!;
    expect(w.original?.sports[0]?.durationSec).toBe(8 * 3600);
    expect(w.current.sports[0]?.durationSec).toBe(4 * 3600);
    const p = computeWeekProgress(w.weekStart, w.current, await repo.listActivitiesInWeek(w.weekStart));
    expect(p.sports.bike.duration.remaining).toBe(4 * 3600 - 5400);
  });

  it('Woche in Folgewochen kopieren', async () => {
    const { repo, plan } = await setup();
    const week = (await repo.getWeek(plan.id, '2026-11-16'))!;
    const saved = await saveWeekTargets(repo, week, {
      phase: 'base',
      sports: [{ sport: 'run', distanceM: 30_000 }],
      focuses: [{ id: 'f1', sport: 'run', focus: 'long', count: 1 }],
    });
    const n = await copyWeekToWeeks(repo, saved, ['2026-11-23', '2026-11-30']);
    expect(n).toBe(2);
    const w = (await repo.getWeek(plan.id, '2026-11-30'))!;
    expect(w.current.sports[0]?.distanceM).toBe(30_000);
    expect(w.current.focuses[0]?.id).not.toBe('f1');
  });

  it('Testfall 7 (DB-Ebene): Frische außerhalb des Zielbereichs ändert den Plan nicht; ein Check-in pro Woche', async () => {
    const { repo, plan } = await setup();
    const week = (await repo.getWeek(plan.id, '2026-11-16'))!;
    await saveWeekTargets(repo, week, { sports: [{ sport: 'run', distanceM: 30_000 }], focuses: [], freshnessTarget: { min: 6, max: 8 } });
    const before = JSON.stringify(await repo.listWeeks(plan.id));
    const c1 = await saveCheckin(repo, { date: '2026-11-17', freshness: 3 });
    const c2 = await saveCheckin(repo, { date: '2026-11-19', freshness: 4, sleepQuality: 2 });
    expect(c2.id).toBe(c1.id);
    expect(c2.weekStart).toBe('2026-11-16');
    expect(await repo.listCheckins()).toHaveLength(1);
    await acknowledgeCheckin(repo, c2);
    expect((await repo.getCheckinForWeek('2026-11-16'))?.acknowledgedAt).toBeDefined();
    expect(JSON.stringify(await repo.listWeeks(plan.id))).toBe(before);
  });

  it('Testfall 5 (DB-Ebene): Pause allein ändert nichts; bestätigter Vorschlag kürzt nur, Original bleibt', async () => {
    const { repo, plan } = await setup();
    for (const ws of ['2026-11-16', '2026-11-23', '2026-11-30']) {
      const w = (await repo.getWeek(plan.id, ws))!;
      await saveWeekTargets(repo, w, { sports: [{ sport: 'run', distanceM: 35_000 }, { sport: 'bike', durationSec: 25_200 }], focuses: [] });
    }
    const before = JSON.stringify(await repo.listWeeks(plan.id));
    const pause = await savePause(repo, { scope: 'sports', sports: ['run'], startDate: '2026-11-18', endDate: '2026-11-25', reason: 'Wade' });
    expect(JSON.stringify(await repo.listWeeks(plan.id))).toBe(before);

    const changes = proposePauseAdjustment(pause, await repo.listWeeks(plan.id));
    expect(await applyWeekChanges(repo, plan.id, changes)).toBe(2);
    const weeks = await repo.listWeeks(plan.id);
    const get = (ws: string) => weeks.find((w) => w.weekStart === ws)!;
    expect(get('2026-11-16').current.sports.find((s) => s.sport === 'run')?.distanceM).toBe(10_000);
    expect(get('2026-11-16').original?.sports.find((s) => s.sport === 'run')?.distanceM).toBe(35_000);
    expect(get('2026-11-30').current.sports.find((s) => s.sport === 'run')?.distanceM).toBe(35_000);
    expect(get('2026-11-16').current.sports.find((s) => s.sport === 'bike')?.durationSec).toBe(25_200);
  });

  it('Beschwerde mit Verlauf; Löschen entfernt auch die Einträge', async () => {
    const { repo } = await setup();
    const issue = await createPainIssue(repo, { region: 'achilles', side: 'left', sports: ['run'], status: 'active', startDate: '2026-11-14' }, { date: '2026-11-14', pain: 4 });
    await addPainObservation(repo, issue, { date: '2026-11-16', pain: 2, note: 'besser' });
    const s = summarizeIssue((await repo.getPainIssue(issue.id))!, await repo.listPainObservations());
    expect(s.observations.map((o) => o.pain)).toEqual([4, 2]);
    await repo.deletePainIssue(issue.id);
    expect(await repo.listPainObservations()).toHaveLength(0);
    expect(await repo.listPainIssues()).toHaveLength(0);
  });

  it('Workout: Start, Abschluss erzeugt Kraft-Einheit, Vorlagenänderung lässt Log unverändert (Testfall 8), Löschen der Einheit entfernt Log', async () => {
    const { repo, plan } = await setup();
    const t = await saveStrengthTemplate(repo, {
      name: 'Ganzkörper A', focus: 'full_body', exercises: [{ id: 'e1', name: 'Kniebeuge', sets: 2, mode: 'reps', reps: 10, weightKg: 40 }],
    });
    let log = await startWorkout(repo, t, '2026-11-17');
    log = { ...log, exercises: log.exercises.map((e) => ({ ...e, sets: e.sets.map((s) => ({ ...s, done: true, reps: 10, weightKg: 40 })) })) };
    await saveWorkoutProgress(repo, log);
    const done = await finishWorkout(repo, log, { durationSec: 2400, rpe: 6 });
    expect(done.status).toBe('completed');
    const act = await repo.getActivity(done.activityId!);
    expect(act?.sport).toBe('strength');
    expect(act?.durationSec).toBe(2400);
    const week = (await repo.getWeek(plan.id, '2026-11-16'))!;
    const p = computeWeekProgress(week.weekStart, { sports: [{ sport: 'strength', sessions: 2 }], focuses: [] }, await repo.listActivitiesInWeek(week.weekStart));
    expect(p.sports.strength.sessions.done).toBe(1);

    const snapshot = JSON.stringify(await repo.getStrengthLog(done.id));
    await saveStrengthTemplate(repo, { ...t, name: 'Geändert', exercises: [{ id: 'e1', name: 'Frontkniebeuge', sets: 5, mode: 'reps', reps: 5, weightKg: 60 }] }, t);
    expect(JSON.stringify(await repo.getStrengthLog(done.id))).toBe(snapshot);

    // erneut abschließen (Bearbeitung) aktualisiert dieselbe Einheit statt eine zweite anzulegen
    await finishWorkout(repo, done, { durationSec: 3000 });
    expect((await repo.listActivities()).filter((a) => a.sport === 'strength')).toHaveLength(1);

    await deleteActivityWithLinks(repo, done.activityId!);
    expect(await repo.listStrengthLogs()).toHaveLength(0);
  });

  it('Kraft schnell abhaken: Einheit mit Vorlagenname, Protokoll ohne Satzdetails', async () => {
    const { repo } = await setup();
    const t = await saveStrengthTemplate(repo, { name: 'Rumpf', focus: 'core', plannedDurationSec: 1500, exercises: [{ id: 'e', name: 'Seitstütz', sets: 2, mode: 'time', durationSec: 40 }] });
    const log = await logQuickWorkout(repo, t, { date: '2026-11-17', durationSec: 1500 });
    expect(log.entryMode).toBe('quick');
    expect(log.status).toBe('completed');
    const act = await repo.getActivity(log.activityId!);
    expect(act?.note).toBe('Rumpf');
    expect(act?.durationSec).toBe(1500);
  });

  it('Referenzwerte: FTP, CSS und Schwellenpace leiten Zonen ab; manuelle Lauf-/Schwimmzonen bleiben', async () => {
    const { repo } = await setup();
    await saveReferenceMetric(repo, 'bike', 250, '2026-11-10', '20-min-Test');
    await saveReferenceMetric(repo, 'swim', 105, '2026-11-12');
    const metrics = await repo.listMetrics();
    expect(metrics.map((m) => m.kind).sort()).toEqual(['bike_ftp_w', 'swim_css_s_per_100m']);
    const zones = await repo.listZoneConfigs();
    expect(zones).toHaveLength(2);
    expect(zones.find((z) => z.sport === 'bike')?.bounds).toEqual([140, 190, 228, 265]);
    const swim = zones.find((z) => z.sport === 'swim');
    expect(swim?.method).toBe('derived_css_offset');
    expect(swim?.bounds).toEqual([117, 110, 107, 102]);
    // manuell festgelegte Laufzonen werden durch eine neue Schwellenpace nicht überschrieben
    await repo.saveZoneConfig({ id: 'run', sport: 'run', metric: 'pace_s_per_km', method: 'manual', bounds: [330, 300, 280, 260], updatedAt: '2026-11-12T10:00:00.000Z' });
    await saveReferenceMetric(repo, 'run', 240, '2026-11-13');
    const run = (await repo.listZoneConfigs()).find((z) => z.sport === 'run');
    expect(run?.method).toBe('manual');
    expect(run?.bounds).toEqual([330, 300, 280, 260]);
  });

  it('Änderungshistorie: jede Änderung protokolliert, Rückgängig nur ohne spätere Änderung, Historie und Ist bleiben', async () => {
    const { repo, plan } = await setup();
    const a = await logActivity(repo, { sport: 'run', date: '2026-11-17', durationSec: 3600, distanceM: 10000, focus: 'endurance' });
    for (const ws of ['2026-11-16', '2026-11-23']) {
      await saveWeekTargets(repo, (await repo.getWeek(plan.id, ws))!, { sports: [{ sport: 'run', distanceM: 40000 }], focuses: [] });
    }
    const weeks = (await repo.listWeeks(plan.id)).filter((w) => ['2026-11-16', '2026-11-23'].includes(w.weekStart));
    await commitWeekChanges(repo, plan.id, bulkScale(weeks, 0.5), 'bulk_scale', 'Umfang −50 %');
    await commitWeekChanges(repo, plan.id, bulkSetPhase(await repo.listWeeks(plan.id), 'recovery').filter((c) => c.weekStart === '2026-11-30'), 'bulk_phase', 'Phase');
    const hist = await repo.listPlanChanges(plan.id);
    expect(hist.map((h) => h.kind)).toContain('bulk_scale');
    const scale = hist.find((h) => h.kind === 'bulk_scale')!;
    await undoPlanChange(repo, scale);
    expect((await repo.getWeek(plan.id, '2026-11-23'))?.current.sports[0]?.distanceM).toBe(40000);
    expect((await repo.getWeek(plan.id, '2026-11-23'))?.original?.sports[0]?.distanceM).toBe(40000);
    // zweites Rückgängig derselben Änderung nicht mehr möglich (Wochen stehen nicht mehr auf "nachher")
    let err: unknown;
    try { await undoPlanChange(repo, scale); } catch (e) { err = e; }
    expect(err instanceof Error).toBe(true);
    expect(await repo.getActivity(a.id)).toStrictEqual(a);
    expect((await repo.listPlanChanges(plan.id)).some((h) => h.kind === 'undo' && h.undoOf === scale.id)).toBe(true);
  });

  it('Planimport: Übernahme über den Änderungsverlauf, Ist-Daten unberührt, Rückgängig, Backup', async () => {
    const { repo, plan } = await setup();
    const act = await logActivity(repo, { sport: 'bike', date: '2026-11-04', durationSec: 3600, focus: 'endurance' });
    await saveWeekTargets(repo, (await repo.getWeek(plan.id, '2026-11-09'))!, { sports: [{ sport: 'run', distanceM: 30000 }], focuses: [] });
    const read = readImportText('Woche ab;Phase;Rad h;Laufen km\n02.11.2026;Grundlage;5;\n09.11.2026;Grundlage;5,5;\n05.07.2027;Übergang;2;');
    if (!read.ok) throw new Error(read.error);
    const weeks = await repo.listWeeks(plan.id);
    const result = interpretRows(read.table, suggestMapping(read.table), weeks.map((w) => w.weekStart));
    expect(result.issues.map((i) => i.level)).toEqual(['skipped']); // Juli 2027 liegt nach dem Wettkampf
    const changes = buildImportChanges(weeks, result.weeks, 'replace');
    await commitWeekChanges(repo, plan.id, changes, 'import', 'Plan importiert (2 Wochen)');

    const w1 = await repo.getWeek(plan.id, '2026-11-02');
    expect(w1?.current).toEqual({ phase: 'base', sports: [{ sport: 'bike', durationSec: 18000 }], focuses: [] });
    expect(w1?.original).toEqual(w1?.current); // erste Fassung einer leeren Woche wird zum ursprünglichen Plan
    const w2 = await repo.getWeek(plan.id, '2026-11-09');
    expect(w2?.current.sports).toEqual([{ sport: 'bike', durationSec: 19800 }]); // Laufen-km leer → entfernt, nicht erfunden
    expect(w2?.original?.sports).toEqual([{ sport: 'run', distanceM: 30000 }]); // Original bleibt
    expect(await repo.getActivity(act.id)).toStrictEqual(act);

    const [entry] = await repo.listPlanChanges(plan.id);
    expect(entry?.kind).toBe('import');
    const file = parseBackup(JSON.stringify(createBackup(await repo.exportAll(), '0.8.0', '2026-11-17T12:00:00.000Z')));
    expect(file.ok).toBe(true);

    await undoPlanChange(repo, entry!);
    expect((await repo.getWeek(plan.id, '2026-11-09'))?.current.sports).toEqual([{ sport: 'run', distanceM: 30000 }]);
    expect((await repo.getWeek(plan.id, '2026-11-02'))?.current).toEqual({ sports: [], focuses: [] });
  });

  it('Testfall 9 (DB-Ebene): Export → Restore in leere Datenbank ergibt identische Daten', async () => {
    const { repo } = await setup();
    await logActivity(repo, { sport: 'run', date: '2026-11-17', durationSec: 2400, distanceM: 8000, focus: 'endurance', rpe: 4 });
    const exported = await repo.exportAll();
    const file = parseBackup(JSON.stringify(createBackup(exported, '0.1.0', '2026-11-16T21:00:00.000Z')));
    expect(file.ok).toBe(true);
    if (!file.ok) return;
    const fresh = new Repository(new MemoryBackend());
    await fresh.replaceAll(file.backup.data);
    expect(await fresh.exportAll()).toEqual(exported);
  });
});

describe('Plangenerator – Übernahme', () => {
  it('Vorschlag übernehmen: Änderungsart generated, Prioritäten getrennt gespeichert, Rückgängig, Backup', async () => {
    const { repo, plan } = await setup();
    await repo.saveProfile({
      id: 'me',
      availableWeeklySec: 10 * 3600,
      baseline: { swim: { durationSec: 3600 }, bike: { durationSec: 3 * 3600 }, run: { durationSec: 2 * 3600, distanceM: 20_000 } },
      updatedAt: '2026-11-16T10:00:00.000Z',
    });
    const ctx = (await loadActiveContext(repo))!;
    const settings = { ...(await loadGeneratorSettings(repo, plan.id)), longestRecentRun: { distanceM: 12_000, asOf: '2026-11-16' } };
    const input = await loadGeneratorInput(repo, ctx, '2026-11-17', '2026-11-23', settings);
    expect(input.planWeeks[0]).toBe('2026-11-02');
    const r = generatePlan(input);
    if (!r.ok) throw new Error(r.needs.map((n) => n.message).join());
    expect(r.proposal.violations).toEqual([]);
    const n = await applyGeneratedPlan(repo, ctx, r.proposal, settings, '2026-11-17T10:00:00.000Z');
    expect(n).toBe(r.proposal.weeks.length);
    const weeks = await repo.listWeeks(plan.id);
    expect(weeks.find((w) => w.weekStart === '2026-11-16')?.current.sports).toEqual([]); // vor dem Start unverändert
    const w1 = weeks.find((w) => w.weekStart === '2026-11-23')!;
    expect(w1.original).toEqual(w1.current); // Vorschlag wird ursprünglicher Plan
    const [change] = await repo.listPlanChanges(plan.id);
    expect(change?.kind).toBe('generated');
    const saved = await repo.getGeneratorSettings(plan.id);
    expect(saved?.priorities.run?.suggested).toBeDefined();
    expect(saved?.priorities.run?.applied).toBeDefined();
    expect(saved?.priorities.run?.user).toBeUndefined();

    const file = parseBackup(JSON.stringify(createBackup(await repo.exportAll(), '0.10.0', '2026-11-17T10:00:00.000Z')));
    expect(file.ok).toBe(true);

    await undoPlanChange(repo, change!);
    expect((await repo.listWeeks(plan.id)).every((w) => w.current.sports.length === 0)).toBe(true);
  });
});

describe('Planvorschlag mit Historie', () => {
  it('übernimmt den Ausgangsumfang ins Profil; Einheiten und vergangene Wochen bleiben unverändert', async () => {
    const { repo, plan } = await setup();
    await repo.saveProfile({ id: 'me', availableWeeklySec: 10 * 3600, baseline: { run: { durationSec: 3600, distanceM: 10_000 } }, updatedAt: '2026-11-01T10:00:00.000Z' });
    for (const [i, d] of ['2026-10-27', '2026-11-03', '2026-11-10', '2026-11-17'].entries()) {
      await logActivity(repo, { sport: 'run', date: d, durationSec: 2 * 3600, distanceM: 22_000, focus: 'endurance' });
      await logActivity(repo, { sport: 'bike', date: d, durationSec: (3 + i * 0) * 3600, focus: 'endurance' });
    }
    const before = await repo.listActivities();
    const ctx = (await loadActiveContext(repo))!;
    const settings = { ...(await loadGeneratorSettings(repo, plan.id)), longestRecentRun: { distanceM: 12_000, asOf: '2026-11-16' } };
    const r = generatePlan(await loadGeneratorInput(repo, ctx, '2026-11-18', '2026-11-23', settings));
    if (!r.ok) throw new Error(r.needs.map((x) => x.message).join());
    await applyGeneratedPlan(repo, ctx, r.proposal, settings, '2026-11-18T10:00:00.000Z');
    const prof = await repo.getProfile();
    expect(prof?.baseline?.run?.durationSec).toBe(2 * 3600);
    expect(prof?.baseline?.run?.distanceM).toBe(22_000);
    expect(prof?.baseline?.bike?.durationSec).toBe(3 * 3600);
    expect(prof?.baseline?.periodWeeks).toBe(4);
    expect(await repo.listActivities()).toEqual(before);
    const past = (await repo.listWeeks(plan.id)).filter((w) => w.weekStart < '2026-11-23');
    expect(past.every((w) => w.current.sports.length === 0)).toBe(true);
  });
});
