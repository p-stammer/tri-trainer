/** In-Memory-Backend für Tests und Vorschau. Kopiert alle Werte, damit keine Referenzen geteilt werden. */
import { TABLES, type Row, type StorageBackend, type TableName } from './backend';

export class MemoryBackend implements StorageBackend {
  private tables = new Map<TableName, Map<string, Row>>(TABLES.map((t) => [t, new Map()]));

  private t(table: TableName): Map<string, Row> {
    const m = this.tables.get(table);
    if (!m) throw new Error(`Unbekannte Tabelle ${table}`);
    return m;
  }

  async get<T extends Row>(table: TableName, id: string): Promise<T | undefined> {
    const v = this.t(table).get(id);
    return v ? (structuredClone(v) as T) : undefined;
  }

  async all<T extends Row>(table: TableName): Promise<T[]> {
    return [...this.t(table).values()].map((v) => structuredClone(v) as T);
  }

  async range<T extends Row>(table: TableName, index: string, from: string, to: string): Promise<T[]> {
    return (await this.all<T>(table)).filter((r) => {
      const v = (r as Record<string, unknown>)[index];
      return typeof v === 'string' && v >= from && v <= to;
    });
  }

  async equals<T extends Row>(table: TableName, index: string, value: string): Promise<T[]> {
    return (await this.all<T>(table)).filter((r) => (r as Record<string, unknown>)[index] === value);
  }

  async put<T extends Row>(table: TableName, row: T): Promise<void> {
    this.t(table).set(row.id, structuredClone(row));
  }

  async bulkPut<T extends Row>(table: TableName, rows: readonly T[]): Promise<void> {
    for (const r of rows) this.t(table).set(r.id, structuredClone(r));
  }

  async delete(table: TableName, id: string): Promise<void> {
    this.t(table).delete(id);
  }

  async replaceAll(data: Record<TableName, readonly Row[]>): Promise<void> {
    const next = new Map<TableName, Map<string, Row>>(
      TABLES.map((t) => [t, new Map(data[t].map((r) => [r.id, structuredClone(r)]))]),
    );
    this.tables = next;
  }
}
