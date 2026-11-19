import { describe, expect, it } from 'vitest';
import { activitiesToCsv, createBackup, parseBackup, type BackupData } from './backup';
import { completedActivitySchema } from './schemas';

const data: BackupData = {
  settings: {
    id: 'app',
    timeZone: 'Europe/Berlin',
    primaryMetric: { swim: 'distance', bike: 'duration', run: 'distance' },
    theme: 'system',
    activePlanId: 'p1',
  },
  profile: { id: 'me', name: 'Test', updatedAt: '2026-11-16T10:00:00.000Z' },
  races: [
    {
      id: 'r1', name: 'Ironman Frankfurt', date: '2027-06-27', preset: 'full', swimM: 3800, bikeM: 180000, runM: 42195,
      prepStartDate: '2026-11-02', createdAt: '2026-11-16T10:00:00.000Z', updatedAt: '2026-11-16T10:00:00.000Z',
    },
  ],
  plans: [
    { id: 'p1', raceId: 'r1', name: 'Plan', origin: 'manual', startWeek: '2026-11-02', createdAt: 'x1234567890', updatedAt: 'x1234567890' },
  ],
  weeks: [
    {
      id: 'w1', planId: 'p1', weekStart: '2026-11-16', revision: 1, updatedAt: '2026-11-16T10:00:00.000Z',
      current: { phase: 'base', sports: [{ sport: 'bike', durationSec: 28800, zoneSec: { z2: 20000 } }], focuses: [] },
      original: { sports: [{ sport: 'bike', durationSec: 30000 }], focuses: [] },
    },
  ],
  activities: [
    {
      id: 'a1', sport: 'bike', date: '2026-11-17', durationSec: 3600, focus: 'threshold', zoneSec: { z4: 1200 }, rpe: 7,
      note: 'Wind; "böig"', createdAt: '2026-11-17T18:00:00.000Z', updatedAt: '2026-11-17T18:00:00.000Z',
    },
    {
      id: 'a2', sport: 'swim', date: '2026-11-16', durationSec: 2700, distanceM: 2400, focus: 'technique',
      createdAt: '2026-11-16T07:00:00.000Z', updatedAt: '2026-11-16T07:00:00.000Z',
    },
  ],
  zoneConfigs: [
    { id: 'bike', sport: 'bike', metric: 'power_w', method: 'derived_coggan_ftp', referenceValue: 250, bounds: [140, 190, 228, 265], updatedAt: '2026-11-16T10:00:00.000Z' },
  ],
  metrics: [
    { id: 'm1', kind: 'bike_ftp_w', value: 250, unit: 'W', date: '2026-11-01', method: '20-min-Test', createdAt: '2026-11-16T10:00:00.000Z' },
  ],
  painIssues: [
    { id: 'pi1', region: 'achilles', side: 'left', sports: ['run'], status: 'active', startDate: '2026-11-14', createdAt: 'x1234567890', updatedAt: 'x1234567890' },
  ],
  painObservations: [
    { id: 'po1', issueId: 'pi1', date: '2026-11-14', pain: 4, note: 'morgens steif', createdAt: 'x1234567890' },
  ],
  strengthTemplates: [
    { id: 'st1', name: 'Ganzkörper A', focus: 'full_body', exercises: [{ id: 'e1', name: 'Kniebeuge', sets: 3, mode: 'reps', reps: 10, weightKg: 40 }], createdAt: 'x1234567890', updatedAt: 'x1234567890' },
  ],
  strengthLogs: [
    {
      id: 'sl1', templateId: 'st1', name: 'Ganzkörper A', focus: 'full_body', date: '2026-11-16', status: 'completed', startedAt: 'x1234567890', durationSec: 2400,
      exercises: [{ name: 'Kniebeuge', mode: 'reps', skipped: false, sets: [{ done: true, targetReps: 10, reps: 10, weightKg: 40 }] }],
      createdAt: 'x1234567890', updatedAt: 'x1234567890',
    },
  ],
  planChanges: [
    {
      id: 'pc1', planId: 'p1', createdAt: 'x1234567890', kind: 'week_edit', description: 'KW 47 bearbeitet',
      weeks: [{ weekStart: '2026-11-16', before: { sports: [], focuses: [] }, after: { sports: [{ sport: 'bike', durationSec: 28800 }], focuses: [] } }],
    },
  ],
  pauses: [
    { id: 'pa1', scope: 'sports', sports: ['run'], startDate: '2026-11-15', endDate: '2026-11-21', reason: 'Achillessehne', createdAt: 'x1234567890', updatedAt: 'x1234567890' },
  ],
  wellness: [
    { id: 'c1', weekStart: '2026-11-16', date: '2026-11-17', freshness: 3, sleepQuality: 2, note: 'müde', createdAt: 'x1234567890', updatedAt: 'x1234567890' },
  ],
  prepRaces: [
    { id: 'pr1', planId: 'p1', name: 'Halbmarathon Köln', date: '2027-04-11', kind: 'run', runM: 21097.5, createdAt: 'x1234567890', updatedAt: 'x1234567890' },
  ],
  trainingCamps: [],
  generatorSettings: [
    {
      id: 'p1', planId: 'p1', philosophy: 30, priorityMode: 'hybrid', priorities: { swim: { user: 4, suggested: 3, applied: 4 } }, taperWeeks: 2,
      openWaterFrom: '2027-05-01', longestRecentRun: { distanceM: 12000, durationSec: 4200, asOf: '2026-11-16' }, updatedAt: 'x1234567890',
    },
  ],
};

describe('Backup', () => {
  it('Testfall 9: Export und Restore erhalten alle Daten', () => {
    const json = JSON.stringify(createBackup(data, '0.1.0', '2026-11-16T21:00:00.000Z'));
    const r = parseBackup(json);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.backup.data).toStrictEqual(data);
    expect(r.summary.activities).toBe(2);
    expect(r.summary.firstActivity).toBe('2026-11-16');
    expect(r.summary.lastActivity).toBe('2026-11-17');
  });

  it('migriert Backups im Format 1 (ohne Frische-Daten)', () => {
    const v1 = structuredClone(createBackup(data, '0.1.0', 'x')) as unknown as Record<string, unknown>;
    v1.formatVersion = 1;
    for (const k of ['wellness', 'painIssues', 'painObservations', 'pauses', 'strengthTemplates', 'strengthLogs', 'planChanges', 'prepRaces', 'generatorSettings']) delete (v1.data as Record<string, unknown>)[k];
    const r = parseBackup(JSON.stringify(v1));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.backup.formatVersion).toBe(7);
      expect(r.backup.data.trainingCamps).toEqual([]);
      expect(r.backup.data.planChanges).toEqual([]);
      expect(r.backup.data.prepRaces).toEqual([]);
      expect(r.backup.data.generatorSettings).toEqual([]);
      expect(r.backup.data.strengthLogs).toEqual([]);
      expect(r.backup.data.wellness).toEqual([]);
      expect(r.backup.data.pauses).toEqual([]);
      expect(r.backup.data.activities).toHaveLength(2);
    }
  });

  it('migriert Backups im Format 5 (ohne Generator-Daten)', () => {
    const v5 = structuredClone(createBackup(data, '0.8.0', 'x')) as unknown as Record<string, unknown>;
    v5.formatVersion = 5;
    delete (v5.data as Record<string, unknown>).prepRaces;
    delete (v5.data as Record<string, unknown>).generatorSettings;
    const r = parseBackup(JSON.stringify(v5));
    if (!r.ok) throw new Error(r.errors.join(' | '));
    expect(r.backup.formatVersion).toBe(7);
    expect(r.backup.data.weeks).toEqual(data.weeks);
    expect(r.backup.data.wellness).toEqual(data.wellness);
  });

  it('lehnt fremde, kaputte und zu neue Dateien mit Klartext ab', () => {
    expect(parseBackup('kein json').ok).toBe(false);
    expect(parseBackup('{"foo":1}').ok).toBe(false);
    const newer = parseBackup(JSON.stringify({ format: 'ironman-planner-backup', formatVersion: 99 }));
    expect(newer.ok).toBe(false);
    if (!newer.ok) expect(newer.errors[0]).toMatch('neueren');
  });

  it('meldet ungültige Datensätze mit Pfad', () => {
    const broken = createBackup(data, '0.1.0', 'x');
    const json = JSON.parse(JSON.stringify(broken));
    json.data.activities[0].date = '2026-02-30';
    const r = parseBackup(JSON.stringify(json));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.join(' ')).toMatch('activities.0.date');
  });

  it('Zonenzeiten über der Dauer sind ungültig', () => {
    const bad = { ...data.activities[0], zoneSec: { z4: 4000 } };
    expect(completedActivitySchema.safeParse(bad).success).toBe(false);
  });
});

describe('CSV-Export', () => {
  it('sortiert nach Datum, nutzt Semikolon/Dezimalkomma und maskiert Sonderzeichen', () => {
    const csv = activitiesToCsv(data.activities);
    const lines = csv.split('\r\n');
    expect(lines).toHaveLength(3);
    expect(lines[0]).toMatch(/^Datum;KW;Sportart/);
    expect(lines[1]).toMatch(/^2026-11-16;2026-W47;Schwimmen;Technik;45;2,4;/);
    expect(lines[2]).toContain('"Wind; ""böig"""');
    // Rad: 20 min Z4 bekannt, 40 min unbekannt, andere Zonen leer (nicht 0)
    expect(lines[2]).toContain(';7;;;;20;;40;');
  });
});
