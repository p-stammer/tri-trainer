// Läuft mit Vitest auf deinem Rechner (benötigt fake-indexeddb als IndexedDB-Ersatz in Node).
import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { describe, expect, it } from 'vitest';
import { DexieBackend, createPlannerDb } from './dexieBackend';
import { Repository } from './repository';
import { loadGeneratorSettings, logActivity, savePrepRace, setupRaceAndPlan } from './usecases';

let counter = 0;
function freshRepo() {
  counter += 1;
  return new Repository(new DexieBackend(createPlannerDb(`test-db-${counter}-${Date.now()}`)));
}

describe('DexieBackend (IndexedDB)', () => {
  it('speichert und lädt Einheiten, Wochenabfrage über Datumsindex', async () => {
    const repo = freshRepo();
    await logActivity(repo, { sport: 'run', date: '2026-11-15', durationSec: 1800, focus: 'endurance' });
    await logActivity(repo, { sport: 'run', date: '2026-11-16', durationSec: 2400, focus: 'endurance' });
    await logActivity(repo, { sport: 'bike', date: '2026-11-22', durationSec: 3600, focus: 'long' });
    await logActivity(repo, { sport: 'bike', date: '2026-11-23', durationSec: 3600, focus: 'long' });
    const week = await repo.listActivitiesInWeek('2026-11-16');
    expect(week.map((a) => a.date)).toEqual(['2026-11-22', '2026-11-16']);
  });

  it('Wochen per planId-Index', async () => {
    const repo = freshRepo();
    const { plan } = await setupRaceAndPlan(repo, {
      name: 'Test', date: '2026-12-20', preset: 'olympic', swimM: 1500, bikeM: 40000, runM: 10000, prepStartDate: '2026-11-16',
    });
    expect((await repo.listWeeks(plan.id)).map((w) => w.weekStart)).toEqual(['2026-11-16', '2026-11-23', '2026-11-30', '2026-12-07', '2026-12-14']);
  });

  it('replaceAll ersetzt den Bestand vollständig', async () => {
    const repo = freshRepo();
    await logActivity(repo, { sport: 'swim', date: '2026-11-16', durationSec: 1800, focus: 'technique' });
    const snapshot = await repo.exportAll();
    await logActivity(repo, { sport: 'swim', date: '2026-11-17', durationSec: 1800, focus: 'technique' });
    await repo.replaceAll(snapshot);
    expect(await repo.listActivities()).toHaveLength(1);
  });

  it('Vorbereitungswettkämpfe und Planer-Einstellungen (DB-Version 6)', async () => {
    const repo = freshRepo();
    const { plan } = await setupRaceAndPlan(repo, {
      name: 'IM', date: '2027-06-27', preset: 'full', swimM: 3800, bikeM: 180000, runM: 42195, prepStartDate: '2026-11-16',
    });
    const hm = await savePrepRace(repo, { planId: plan.id, name: ' HM Köln ', date: '2027-04-11', kind: 'run', runM: 21097.5, bikeM: 0 });
    await savePrepRace(repo, { planId: plan.id, name: 'Olympisch', date: '2027-05-16', kind: 'triathlon', swimM: 1500, bikeM: 40000, runM: 10000 });
    await savePrepRace(repo, { planId: 'anderer', name: 'X', date: '2027-01-01', kind: 'other' });
    expect(hm.name).toBe('HM Köln');
    expect(hm.bikeM).toBeUndefined();
    expect((await repo.listPrepRaces(plan.id)).map((r) => r.name)).toEqual(['HM Köln', 'Olympisch']);
    const moved = await savePrepRace(repo, { ...hm, date: '2027-06-01' }, hm);
    expect(moved.id).toBe(hm.id);
    expect((await repo.listPrepRaces(plan.id)).map((r) => r.name)).toEqual(['Olympisch', 'HM Köln']);
    await repo.deletePrepRace(hm.id);
    expect(await repo.listPrepRaces(plan.id)).toHaveLength(1);

    const defaults = await loadGeneratorSettings(repo, plan.id);
    expect(defaults.philosophy).toBe(50);
    expect(await repo.getGeneratorSettings(plan.id)).toBeUndefined();
    await repo.saveGeneratorSettings({ ...defaults, philosophy: 20, taperWeeks: 3 });
    expect((await loadGeneratorSettings(repo, plan.id)).philosophy).toBe(20);
    await expect(repo.saveGeneratorSettings({ ...defaults, philosophy: 120 })).rejects.toThrow();

    const snapshot = await repo.exportAll();
    const other = freshRepo();
    await other.replaceAll(snapshot);
    expect(await other.listPrepRaces(plan.id)).toHaveLength(1);
    expect((await other.getGeneratorSettings(plan.id))?.taperWeeks).toBe(3);
  });

  it('Upgrade von DB-Version 1 auf die aktuelle Version erhält vorhandene Daten', async () => {
    const name = `test-upgrade-${Date.now()}`;
    // Stand von App-Version 0.1: nur Schema-Version 1
    const v1 = new Dexie(name);
    v1.version(1).stores({
      settings: 'id', profile: 'id', races: 'id', plans: 'id, raceId',
      weeks: 'id, planId, weekStart, [planId+weekStart]', activities: 'id, date, sport',
      zoneConfigs: 'id', metrics: 'id, kind, date',
    });
    await v1.table('activities').put({ id: 'a1', date: '2026-11-16', sport: 'run', durationSec: 1800 });
    v1.close();

    const repo = new Repository(new DexieBackend(createPlannerDb(name)));
    const all = await repo.exportAll();
    expect(all.activities.map((a) => a.id)).toEqual(['a1']);
    for (const t of ['wellness', 'painIssues', 'painObservations', 'pauses', 'strengthTemplates', 'strengthLogs', 'planChanges', 'prepRaces', 'generatorSettings'] as const) {
      expect(all[t]).toEqual([]);
    }
    await logActivity(repo, { sport: 'bike', date: '2026-11-17', durationSec: 3600, focus: 'long' });
    expect(await repo.listActivities()).toHaveLength(2);
  });
});
