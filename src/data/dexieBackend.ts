/**
 * IndexedDB-Backend über Dexie.
 *
 * Schema-Versionierung: Jede Strukturänderung bekommt eine NEUE `db.version(n)` mit
 * Upgrade-Funktion. Bestehende Versionen werden nie verändert – sonst gehen auf dem iPhone
 * gespeicherte Trainingsdaten verloren. Siehe docs/ARCHITECTURE.md, Abschnitt "Migrationen".
 */
import Dexie, { type Table } from 'dexie';
import { TABLES, type Row, type StorageBackend, type TableName } from './backend';

export const DB_NAME = 'ironman-planner';

/**
 * Öffnet die App-Datenbank mit allen Schema-Versionen.
 * Bewusst eine Funktion statt einer Unterklasse von Dexie: Mit einer Unterklasse läuft
 * Dexies Typ `TXWithTables<this>` unter TypeScript 6 in TS2589 („excessively deep“).
 */
export function createPlannerDb(name: string = DB_NAME): Dexie {
  const db = new Dexie(name);
  db.version(1).stores({
    settings: 'id',
    profile: 'id',
    races: 'id',
    plans: 'id, raceId',
    weeks: 'id, planId, weekStart, [planId+weekStart]',
    activities: 'id, date, sport',
    zoneConfigs: 'id',
    metrics: 'id, kind, date',
  });
  // Version 2 (MVP 2): wöchentlicher Frische-Check-in. Nur neue/geänderte Tabellen angeben.
  db.version(2).stores({
    wellness: 'id, weekStart',
  });
  // Version 3 (MVP 2): Beschwerden und Trainingspausen.
  db.version(3).stores({
    painIssues: 'id, status, startDate',
    painObservations: 'id, issueId, date',
    pauses: 'id, startDate',
  });
  // Version 4 (MVP 2): Krafttraining – Vorlagen und durchgeführte Workouts.
  db.version(4).stores({
    strengthTemplates: 'id, name',
    strengthLogs: 'id, date, status, templateId, activityId',
  });
  // Version 5 (MVP 2): Änderungshistorie des Plans.
  db.version(5).stores({
    planChanges: 'id, planId, createdAt',
  });
  // Version 6 (1.0): Vorbereitungswettkämpfe und Generator-Einstellungen je Plan.
  db.version(6).stores({
    prepRaces: 'id, planId, date',
    generatorSettings: 'id',
  });
  // 0.21.0: Trainingslager
  db.version(7).stores({
    trainingCamps: 'id, planId, startDate',
  });
  return db;
}

export class DexieBackend implements StorageBackend {
  constructor(private readonly db: Dexie = createPlannerDb()) {}

  private t<T extends Row>(table: TableName): Table<T, string> {
    return this.db.table<T, string>(table);
  }

  get<T extends Row>(table: TableName, id: string): Promise<T | undefined> {
    return this.t<T>(table).get(id);
  }

  all<T extends Row>(table: TableName): Promise<T[]> {
    return this.t<T>(table).toArray();
  }

  range<T extends Row>(table: TableName, index: string, from: string, to: string): Promise<T[]> {
    return this.t<T>(table).where(index).between(from, to, true, true).toArray();
  }

  equals<T extends Row>(table: TableName, index: string, value: string): Promise<T[]> {
    return this.t<T>(table).where(index).equals(value).toArray();
  }

  async put<T extends Row>(table: TableName, row: T): Promise<void> {
    await this.t<T>(table).put(row);
  }

  async bulkPut<T extends Row>(table: TableName, rows: readonly T[]): Promise<void> {
    await this.t<T>(table).bulkPut([...rows]);
  }

  async delete(table: TableName, id: string): Promise<void> {
    await this.t(table).delete(id);
  }

  async replaceAll(data: Record<TableName, readonly Row[]>): Promise<void> {
    // Eine einzige Transaktion: schlägt irgendetwas fehl, bleibt der alte Stand erhalten.
    await this.db.transaction('rw', [...TABLES], async () => {
      for (const name of TABLES) {
        await this.t(name).clear();
        if (data[name].length > 0) await this.t(name).bulkPut([...data[name]]);
      }
    });
  }
}

/**
 * Bittet den Browser, die Daten nicht automatisch zu löschen (Safari ≥ 17, Chrome, Firefox).
 * Ergebnis ist nur ein Hinweis – Backups bleiben trotzdem notwendig.
 */
export async function requestPersistentStorage(): Promise<'granted' | 'denied' | 'unsupported'> {
  try {
    if (!navigator.storage?.persist) return 'unsupported';
    if (await navigator.storage.persisted()) return 'granted';
    return (await navigator.storage.persist()) ? 'granted' : 'denied';
  } catch {
    return 'unsupported';
  }
}
