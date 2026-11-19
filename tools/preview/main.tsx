/**
 * Klickbare Vorschau (claude.ai-Artefakt „Ironman Planner – Vorschau“).
 *
 * Gleiche App wie in src/main.tsx, aber:
 * - Speicher im Arbeitsspeicher mit Kopie in localStorage (kein IndexedDB, kein Service Worker),
 * - gelbe Schaltfläche „Vorschau“ mit Beispieldaten und Zurücksetzen.
 *
 * Bauen: `npm run build:preview` → dist-preview/ironman-planner-vorschau.html (eine einzige Datei).
 */
import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './preview.css';
import { App } from '../../src/ui/App';
import { RepoProvider, ToastProvider } from '../../src/ui/state';
import { Repository } from '../../src/data/repository';
import { MemoryBackend } from '../../src/data/memoryBackend';
import { TABLES, type Row, type StorageBackend, type TableName } from '../../src/data/backend';
import {
  addPainObservation,
  createPainIssue,
  finishWorkout,
  logActivity,
  logQuickWorkout,
  saveCheckin,
  saveReferenceMetric,
  saveStrengthTemplate,
  saveWeekTargets,
  setupRaceAndPlan,
  startWorkout,
  type ActivityInput,
} from '../../src/data/usecases';
import type { BackupData } from '../../src/domain/backup';
import { addDays, startOfWeek, today as todayIn } from '../../src/domain/calendar';
import { newId } from '../../src/domain/ids';
import type { WeekTargets } from '../../src/domain/schemas';

const STORAGE_KEY = 'ironman-planner-preview-v1';

/** In-Memory-Speicher, der jeden Schreibvorgang zusätzlich in localStorage sichert (überlebt Neuladen der Vorschau). */
class PreviewBackend implements StorageBackend {
  private mem = new MemoryBackend();

  static async create(): Promise<PreviewBackend> {
    const b = new PreviewBackend();
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<Record<TableName, Row[]>>;
        const data = Object.fromEntries(TABLES.map((t) => [t, parsed[t] ?? []])) as Record<TableName, Row[]>;
        await b.mem.replaceAll(data);
      }
    } catch {
      // localStorage nicht verfügbar oder Inhalt defekt → leer starten
    }
    return b;
  }

  private async persist() {
    try {
      const out: Partial<Record<TableName, Row[]>> = {};
      for (const t of TABLES) out[t] = await this.mem.all(t);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(out));
    } catch {
      // ohne localStorage bleibt die Vorschau rein im Arbeitsspeicher
    }
  }

  get<T extends Row>(table: TableName, id: string) {
    return this.mem.get<T>(table, id);
  }
  all<T extends Row>(table: TableName) {
    return this.mem.all<T>(table);
  }
  range<T extends Row>(table: TableName, index: string, from: string, to: string) {
    return this.mem.range<T>(table, index, from, to);
  }
  equals<T extends Row>(table: TableName, index: string, value: string) {
    return this.mem.equals<T>(table, index, value);
  }
  async put<T extends Row>(table: TableName, row: T) {
    await this.mem.put(table, row);
    await this.persist();
  }
  async bulkPut<T extends Row>(table: TableName, rows: readonly T[]) {
    await this.mem.bulkPut(table, rows);
    await this.persist();
  }
  async delete(table: TableName, id: string) {
    await this.mem.delete(table, id);
    await this.persist();
  }
  async replaceAll(data: Record<TableName, readonly Row[]>) {
    await this.mem.replaceAll(data);
    await this.persist();
  }
}

const h = (hours: number) => Math.round(hours * 3600);
const min = (minutes: number) => Math.round(minutes * 60);
const roundMin = (sec: number) => Math.round(sec / 60) * 60;

function sampleWeek(f: number, phase: 'base' | 'recovery'): WeekTargets {
  return {
    phase,
    freshnessTarget: phase === 'recovery' ? { min: 7, max: 9 } : { min: 5, max: 7 },
    sports: [
      { sport: 'swim', distanceM: Math.round((7000 * f) / 100) * 100, durationSec: h(2.5 * f), sessions: 3 },
      { sport: 'bike', durationSec: roundMin(h(6 * f)), distanceM: Math.round((170_000 * f) / 1000) * 1000, sessions: 3, zoneSec: { z2: roundMin(h(4.5 * f)), z4: min(30) } },
      { sport: 'run', distanceM: Math.round((32_000 * f) / 1000) * 1000, durationSec: roundMin(h(3 * f)), sessions: 4, zoneSec: { z2: roundMin(h(2.4 * f)), z5: min(15) } },
      { sport: 'strength', sessions: 2, durationSec: h(1.5) },
    ],
    focuses: [
      { id: newId(), sport: 'bike', focus: 'threshold', count: 1, note: '3×10 min' },
      { id: newId(), sport: 'run', focus: 'vo2max', count: 1, note: '5×3 min' },
      { id: newId(), sport: 'bike', focus: 'long', count: 1 },
      { id: newId(), sport: 'swim', focus: 'technique', count: 1 },
    ],
  };
}

/** Beispieldaten: Wettkampf in ~30 Wochen, Vorbereitung seit 2 Wochen, 8 geplante Wochen, Einheiten, Kraft, Frische, Beschwerden. */
async function loadSampleData(repo: Repository) {
  const today = todayIn('Europe/Berlin');
  const monday = startOfWeek(today);
  const prep = addDays(monday, -14);
  await setupRaceAndPlan(repo, { name: 'Ironman Hamburg', date: addDays(monday, 209), preset: 'full', swimM: 3800, bikeM: 180_000, runM: 42_195, prepStartDate: prep, goalTimeSec: h(11.5) });
  await repo.saveProfile({
    id: 'me',
    name: 'Alex',
    availableWeeklySec: h(12),
    baseline: {
      periodWeeks: 8,
      swim: { distanceM: 6000, durationSec: h(2.2), sessions: 2.5 },
      bike: { durationSec: h(5), distanceM: 140_000, sessions: 3 },
      run: { distanceM: 30_000, durationSec: h(2.8), sessions: 3.5 },
      strength: { sessions: 1.5, durationSec: h(1) },
    },
    raceSetup: { bikeType: 'road', clipOns: true, wheels: 'standard', tires: 'race', kit: 'normal', runShoes: 'carbon', wetsuit: 'unknown' },
    updatedAt: new Date().toISOString(),
  });
  const settings = await repo.getSettings();
  const stamp = new Date().toISOString();
  await repo.savePrepRace({ id: newId(), planId: settings.activePlanId ?? '', name: 'Halbmarathon (Beispiel)', date: addDays(monday, 7 * 16 + 6), kind: 'run', runM: 21_097.5, createdAt: stamp, updatedAt: stamp });
  await repo.saveTrainingCamp({ id: newId(), planId: settings.activePlanId ?? '', name: 'Radcamp Mallorca (Beispiel)', startDate: addDays(monday, 7 * 10 - 2), endDate: addDays(monday, 7 * 10 + 5), hoursPerDay: 5, createdAt: stamp, updatedAt: stamp });
  const weeks = await repo.listWeeks(settings.activePlanId ?? '');
  const factors = [0.9, 1, 1.05, 0.7, 1.05, 1.1, 1.15, 0.75];
  for (let i = 0; i < Math.min(8, weeks.length); i++) {
    const w = weeks[i];
    if (w) await saveWeekTargets(repo, w, sampleWeek(factors[i] ?? 1, i === 3 || i === 7 ? 'recovery' : 'base'));
  }

  const acts: ActivityInput[] = [];
  for (const [d, x] of [
    [prep, 0.95],
    [addDays(prep, 7), 0.9],
  ] as const) {
    acts.push(
      { sport: 'swim', date: d, durationSec: min(50 * x), distanceM: 2400, focus: 'technique', rpe: 4 },
      { sport: 'run', date: addDays(d, 1), durationSec: min(55), distanceM: 10_200, focus: 'vo2max', zoneSec: { z2: min(30), z5: min(14) }, rpe: 8 },
      { sport: 'bike', date: addDays(d, 2), durationSec: min(75), distanceM: 36_000, focus: 'threshold', zoneSec: { z2: min(40), z4: min(30) }, rpe: 7 },
      { sport: 'strength', date: addDays(d, 2), durationSec: min(45), focus: 'strength', rpe: 6 },
      { sport: 'swim', date: addDays(d, 3), durationSec: min(55), distanceM: 2800, focus: 'endurance' },
      { sport: 'run', date: addDays(d, 4), durationSec: min(45), distanceM: 8000, focus: 'recovery', rpe: 3 },
      { sport: 'bike', date: addDays(d, 5), durationSec: h(3 * x), distanceM: 88_000, focus: 'long', zoneSec: { z2: h(2.6 * x) }, rpe: 6 },
      { sport: 'run', date: addDays(d, 6), durationSec: min(95), distanceM: 17_500, focus: 'long', rpe: 6 },
      { sport: 'strength', date: addDays(d, 6), durationSec: min(40), focus: 'strength' },
    );
  }
  acts.push({ sport: 'other', date: addDays(prep, 12), durationSec: h(2.5), focus: 'other', label: 'Wandern', rpe: 3 });
  acts.push(
    { sport: 'swim', date: monday, durationSec: min(50), distanceM: 2500, focus: 'technique', rpe: 4, note: 'Fokus Wasserlage' },
    { sport: 'bike', date: monday, durationSec: min(90), distanceM: 42_000, focus: 'threshold', zoneSec: { z2: min(45), z4: min(30) }, rpe: 7 },
  );
  if (today !== monday) acts.push({ sport: 'run', date: addDays(monday, 1), durationSec: min(50), distanceM: 9500, focus: 'endurance', zoneSec: { z2: min(46) }, rpe: 4 });
  for (const a of acts) if (a.date <= today) await logActivity(repo, a);

  const full = await saveStrengthTemplate(repo, {
    name: 'Ganzkörper A',
    focus: 'full_body',
    plannedDurationSec: min(45),
    description: 'Kraftausdauer und Stabilität für Lauf und Rad',
    exercises: [
      { id: newId(), name: 'Kniebeuge', sets: 3, mode: 'reps', reps: 10, weightKg: 40, restSec: 90, targetRir: 2 },
      { id: newId(), name: 'Rumänisches Kreuzheben', sets: 3, mode: 'reps', reps: 10, weightKg: 35, restSec: 90 },
      { id: newId(), name: 'Bulgarian Split Squat', sets: 2, mode: 'reps', reps: 8, weightKg: 12, restSec: 60, note: 'je Seite' },
      { id: newId(), name: 'Wadenheben einbeinig', sets: 3, mode: 'reps', reps: 15, restSec: 45 },
      { id: newId(), name: 'Unterarmstütz', sets: 3, mode: 'time', durationSec: 45, restSec: 30 },
    ],
  });
  const core = await saveStrengthTemplate(repo, {
    name: 'Rumpf und Hüfte',
    focus: 'core',
    plannedDurationSec: min(25),
    exercises: [
      { id: newId(), name: 'Seitstütz', sets: 2, mode: 'time', durationSec: 40, restSec: 30, note: 'je Seite' },
      { id: newId(), name: 'Glute Bridge einbeinig', sets: 3, mode: 'reps', reps: 12, restSec: 45 },
      { id: newId(), name: 'Dead Bug', sets: 3, mode: 'reps', reps: 10, restSec: 30 },
    ],
  });
  let log = await startWorkout(repo, full, addDays(prep, 9));
  log = {
    ...log,
    exercises: log.exercises.map((e, i) => ({
      ...e,
      skipped: i === 2,
      sets: e.sets.map((s) => ({
        ...s,
        done: true,
        ...(s.targetReps !== undefined ? { reps: s.targetReps } : {}),
        ...(s.targetDurationSec !== undefined ? { durationSec: s.targetDurationSec } : {}),
        ...(s.targetWeightKg !== undefined ? { weightKg: s.targetWeightKg } : {}),
      })),
    })),
  };
  await finishWorkout(repo, log, { durationSec: min(42), rpe: 6 });
  await logQuickWorkout(repo, core, { date: addDays(prep, 12), durationSec: min(25) });

  await saveReferenceMetric(repo, 'bike', 240, addDays(prep, -10), '20-min-Test');
  await saveReferenceMetric(repo, 'run', 285, addDays(prep, -8), '30-min-Test');
  await saveReferenceMetric(repo, 'swim', 108, addDays(prep, -5), 'CSS-Test 400/200');
  await saveCheckin(repo, { date: addDays(prep, 6), freshness: 7, sleepQuality: 4, motivation: 5 });
  await saveCheckin(repo, { date: addDays(prep, 13), freshness: 5, sleepQuality: 3, soreness: 3 });

  const knee = await createPainIssue(
    repo,
    { region: 'knee', side: 'right', sports: ['run'], status: 'active', startDate: addDays(prep, -40), description: 'Außenseite, nach langen Läufen' },
    { date: addDays(prep, -40), pain: 3 },
  );
  await addPainObservation(repo, knee, { date: addDays(prep, -35), pain: 1 });
  await repo.savePainIssue({ ...knee, status: 'resolved', resolvedDate: addDays(prep, -30) });
  const calf = await createPainIssue(
    repo,
    { region: 'calf', side: 'left', sports: ['run'], status: 'active', startDate: addDays(prep, 8), description: 'Ziehen beim Abdrücken' },
    { date: addDays(prep, 8), pain: 4, note: 'nach Intervallen' },
  );
  await addPainObservation(repo, calf, { date: addDays(prep, 10), pain: 3 });
  await addPainObservation(repo, calf, { date: addDays(prep, 13), pain: 3 });
  if (today !== monday) await addPainObservation(repo, calf, { date: today, pain: 2 });
  await saveCheckin(repo, { date: today, freshness: 4, sleepQuality: 2, soreness: 4, note: 'Beine schwer nach der Schwelle' });
}

const EMPTY: BackupData = {
  trainingCamps: [],
  settings: null,
  profile: null,
  races: [],
  plans: [],
  weeks: [],
  activities: [],
  zoneConfigs: [],
  metrics: [],
  wellness: [],
  painIssues: [],
  painObservations: [],
  pauses: [],
  strengthTemplates: [],
  strengthLogs: [],
  planChanges: [],
  prepRaces: [],
  generatorSettings: [],
};

function PreviewPanel({ repo }: { repo: Repository }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const run = async (withSample: boolean) => {
    setBusy(true);
    await repo.replaceAll(EMPTY);
    if (withSample) await loadSampleData(repo);
    location.hash = '#/';
    setBusy(false);
    setOpen(false);
  };
  const btn = { display: 'block', width: '100%', padding: 8, marginBottom: 6, borderRadius: 10, border: '1px solid #ccc', background: '#f4f4f5', color: '#111' } as const;
  return (
    <div style={{ position: 'fixed', left: 8, bottom: 'calc(max(env(safe-area-inset-bottom), 8px) + 84px)', zIndex: 60, fontFamily: 'system-ui', fontSize: 13 }}>
      <button type="button" onClick={() => setOpen(!open)} style={{ background: '#fde68a', color: '#111', border: 0, borderRadius: 999, padding: '6px 10px', fontWeight: 600 }}>
        Vorschau
      </button>
      {open && (
        <div style={{ position: 'absolute', left: 0, bottom: 40, width: 230, background: '#fff', color: '#111', borderRadius: 14, padding: 12, boxShadow: '0 8px 30px rgba(0,0,0,.25)' }}>
          <p style={{ margin: '0 0 8px' }}>Testversion zum Ausprobieren. Backup-Download und Offline-Installation funktionieren hier nicht.</p>
          <button type="button" disabled={busy} style={btn} onClick={() => void run(true)}>
            Beispieldaten laden
          </button>
          <button type="button" disabled={busy} style={{ ...btn, marginBottom: 0 }} onClick={() => void run(false)}>
            Alles zurücksetzen
          </button>
        </div>
      )}
    </div>
  );
}

const repo = new Repository(await PreviewBackend.create());
(window as unknown as { __repo: Repository }).__repo = repo;

const root = document.getElementById('root');
if (!root) throw new Error('#root fehlt');
createRoot(root).render(
  <StrictMode>
    <RepoProvider repo={repo}>
      <ToastProvider>
        <App />
        <PreviewPanel repo={repo} />
      </ToastProvider>
    </RepoProvider>
  </StrictMode>,
);
