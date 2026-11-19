/**
 * Speicher-Backend: dünne Abstraktion über IndexedDB (Dexie) bzw. In-Memory (Tests).
 * Validierung, Änderungsbenachrichtigung und Geschäftsregeln liegen NICHT hier,
 * sondern im Repository – so verhalten sich beide Backends garantiert gleich.
 */

export const TABLES = ['settings', 'profile', 'races', 'plans', 'weeks', 'activities', 'zoneConfigs', 'metrics', 'wellness', 'painIssues', 'painObservations', 'pauses', 'strengthTemplates', 'strengthLogs', 'planChanges', 'prepRaces', 'generatorSettings', 'trainingCamps'] as const;
export type TableName = (typeof TABLES)[number];

export type Row = { id: string };

export interface StorageBackend {
  get<T extends Row>(table: TableName, id: string): Promise<T | undefined>;
  all<T extends Row>(table: TableName): Promise<T[]>;
  /** Alle Zeilen, deren Index-Feld zwischen from und to liegt (inklusive). */
  range<T extends Row>(table: TableName, index: string, from: string, to: string): Promise<T[]>;
  /** Alle Zeilen, deren Index-Feld exakt `value` ist. */
  equals<T extends Row>(table: TableName, index: string, value: string): Promise<T[]>;
  put<T extends Row>(table: TableName, row: T): Promise<void>;
  bulkPut<T extends Row>(table: TableName, rows: readonly T[]): Promise<void>;
  delete(table: TableName, id: string): Promise<void>;
  /** Ersetzt den gesamten Datenbestand atomar (alles oder nichts). */
  replaceAll(data: Record<TableName, readonly Row[]>): Promise<void>;
}
