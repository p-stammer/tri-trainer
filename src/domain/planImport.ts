/**
 * Planimport (M2.6): CSV-/JSON-Datei oder eingefügte Tabelle → Vorschlag für Wochenziele.
 *
 * Ablauf: Text → Tabelle (Spalten × Zeilen) → Zuordnung der Spalten zu Feldern → Zeilen deuten →
 * Vorher/Nachher je Planwoche. Übernommen wird erst nach Bestätigung (Anwendungsfall `commitWeekChanges`).
 *
 * Grundregeln:
 * - Fehlende Werte bleiben leer. Eine leere Zelle ist nie 0 und wird nie geschätzt.
 * - Unklare Werte werden markiert und NICHT übernommen; der bisherige Planwert bleibt dann bestehen.
 * - Nur zugeordnete Spalten verändern den Plan. Schwerpunkte, Zonenziele und Frischebereich bleiben unberührt.
 * - Es werden keine Wochen angelegt oder gelöscht; Zeilen außerhalb des Planzeitraums werden gemeldet.
 */
import { addDays, isLocalDate, isoWeek, startOfWeek, type LocalDate } from './calendar';
import { PHASE_LABEL, PHASE_TYPES, PLANNED_SPORTS, SPORT_SHORT, type PhaseType, type PlannedSport } from './sports';
import type { WeekTargets, WeeklySportTarget } from './schemas';
import { getSportTarget, setSportTarget } from './plan';
import { canonical, sameTargets, type PlanWeekChange } from './planEdit';

// ───────────────────────────── Tabelle einlesen ─────────────────────────────

export interface RawTable {
  headers: string[];
  rows: string[][];
}

export type ReadResult = { ok: true; table: RawTable; source: 'csv' | 'tsv' | 'json'; delimiter?: string } | { ok: false; error: string };

const MAX_ROWS = 400;

/** Erkennt JSON oder Text-Tabelle (CSV mit `;`/`,` oder tab-getrennt, z. B. aus Excel/Numbers eingefügt). */
export function readImportText(text: string, hasHeader = true): ReadResult {
  const clean = text.replace(/^﻿/, '');
  if (clean.trim() === '') return { ok: false, error: 'Die Eingabe ist leer.' };
  const first = clean.trimStart()[0];
  if (first === '[' || first === '{') return parseJsonTable(clean);
  return parseDelimited(clean, hasHeader);
}

function detectDelimiter(line: string): string {
  const count = (d: string) => {
    let n = 0;
    let quoted = false;
    for (const ch of line) {
      if (ch === '"') quoted = !quoted;
      else if (!quoted && ch === d) n++;
    }
    return n;
  };
  if (count('\t') > 0) return '\t';
  if (count(';') > 0) return ';';
  if (count(',') > 0) return ',';
  return ';';
}

/** CSV nach RFC 4180 (Anführungszeichen, "" als Escape, Zeilenumbrüche in Anführungszeichen). */
export function parseDelimited(text: string, hasHeader = true): ReadResult {
  const clean = text.replace(/^﻿/, '').replace(/\r\n?/g, '\n');
  const firstLine = clean.split('\n').find((l) => l.trim() !== '') ?? '';
  const delimiter = detectDelimiter(firstLine);
  const records: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];
    if (quoted) {
      if (ch === '"') {
        if (clean[i + 1] === '"') {
          cell += '"';
          i++;
        } else quoted = false;
      } else cell += ch;
    } else if (ch === '"' && cell.trim() === '') {
      quoted = true;
      cell = '';
    } else if (ch === delimiter) {
      row.push(cell);
      cell = '';
    } else if (ch === '\n') {
      row.push(cell);
      records.push(row);
      row = [];
      cell = '';
    } else cell += ch;
  }
  if (cell !== '' || row.length > 0) {
    row.push(cell);
    records.push(row);
  }
  const nonEmpty = records.map((r) => r.map((c) => c.trim())).filter((r) => r.some((c) => c !== ''));
  if (nonEmpty.length === 0) return { ok: false, error: 'Keine Zeilen gefunden.' };
  const width = Math.max(...nonEmpty.map((r) => r.length));
  if (width < 2) return { ok: false, error: 'Es wurde nur eine Spalte erkannt. Spalten bitte mit Semikolon, Komma oder Tabulator trennen.' };
  const pad = (r: string[]) => [...r, ...Array<string>(width - r.length).fill('')];
  const headerRow = hasHeader ? pad(nonEmpty[0] ?? []) : Array.from({ length: width }, (_, i) => `Spalte ${i + 1}`);
  const rows = (hasHeader ? nonEmpty.slice(1) : nonEmpty).map(pad);
  if (rows.length === 0) return { ok: false, error: 'Unter der Überschrift stehen keine Datenzeilen.' };
  if (rows.length > MAX_ROWS) return { ok: false, error: `Zu viele Zeilen (${rows.length}). Erlaubt sind ${MAX_ROWS}.` };
  const headers = headerRow.map((h, i) => (h === '' ? `Spalte ${i + 1}` : h));
  return { ok: true, table: { headers, rows }, source: delimiter === '\t' ? 'tsv' : 'csv', delimiter };
}

function flatten(value: unknown, prefix: string, out: Record<string, string>) {
  if (value === null || value === undefined) {
    if (prefix) out[prefix] = '';
    return;
  }
  if (Array.isArray(value)) {
    if (prefix) out[prefix] = value.map((v) => (typeof v === 'object' ? JSON.stringify(v) : String(v))).join(', ');
    return;
  }
  if (typeof value === 'object') {
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) flatten(v, prefix ? `${prefix}.${k}` : k, out);
    return;
  }
  out[prefix || 'Wert'] = String(value);
}

/** Sucht die erste Liste von Objekten (direkt, unter `weeks`/`wochen`/`plan` …) und macht daraus eine Tabelle. */
export function parseJsonTable(text: string): ReadResult {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, error: 'Die Datei ist kein gültiges JSON.' };
  }
  const findList = (v: unknown, depth: number): unknown[] | null => {
    if (Array.isArray(v)) return v.length > 0 && v.every((x) => x && typeof x === 'object' && !Array.isArray(x)) ? v : null;
    if (!v || typeof v !== 'object' || depth > 3) return null;
    const obj = v as Record<string, unknown>;
    const preferred = ['weeks', 'wochen', 'plan', 'trainingPlan', 'data'];
    for (const k of [...preferred, ...Object.keys(obj).filter((k) => !preferred.includes(k))]) {
      if (k in obj) {
        const found = findList(obj[k], depth + 1);
        if (found) return found;
      }
    }
    return null;
  };
  const list = findList(data, 0);
  if (!list) return { ok: false, error: 'Im JSON wurde keine Liste von Wochen gefunden (erwartet z. B. [{"woche": "2026-11-16", "rad_h": 6}, …]).' };
  if (list.length > MAX_ROWS) return { ok: false, error: `Zu viele Einträge (${list.length}). Erlaubt sind ${MAX_ROWS}.` };
  const flat = list.map((item) => {
    const o: Record<string, string> = {};
    flatten(item, '', o);
    return o;
  });
  const headers: string[] = [];
  for (const o of flat) for (const k of Object.keys(o)) if (!headers.includes(k)) headers.push(k);
  return { ok: true, table: { headers, rows: flat.map((o) => headers.map((h) => (o[h] ?? '').trim())) }, source: 'json' };
}

// ───────────────────────────── Felder und Zuordnung ─────────────────────────────

export type DurationUnit = 'h' | 'min';
export type DistanceUnit = 'km' | 'm';

export type ImportField =
  | { kind: 'ignore' }
  | { kind: 'weekStart' }
  | { kind: 'isoWeek' }
  | { kind: 'year' }
  | { kind: 'planWeek' }
  | { kind: 'phase' }
  | { kind: 'notes' }
  | { kind: 'duration'; sport: PlannedSport; unit: DurationUnit }
  | { kind: 'distance'; sport: Exclude<PlannedSport, 'strength'>; unit: DistanceUnit }
  | { kind: 'sessions'; sport: PlannedSport };

export interface ColumnMapping {
  field: ImportField;
  /** true = aus den Werten erraten (z. B. Einheit), in der Oberfläche als „bitte prüfen“ markiert. */
  guessed: boolean;
}

export function fieldKey(f: ImportField): string {
  switch (f.kind) {
    case 'duration':
      return `duration:${f.sport}:${f.unit}`;
    case 'distance':
      return `distance:${f.sport}:${f.unit}`;
    case 'sessions':
      return `sessions:${f.sport}`;
    default:
      return f.kind;
  }
}

/** Ziel-Feld ohne Einheit – zwei Spalten dürfen nicht dasselbe Ziel befüllen. */
function targetKey(f: ImportField): string {
  if (f.kind === 'duration' || f.kind === 'distance' || f.kind === 'sessions') return `${f.kind}:${f.sport}`;
  return f.kind;
}

export function fieldFromKey(key: string): ImportField {
  const [kind, sport, unit] = key.split(':');
  const ps = PLANNED_SPORTS.find((s) => s === sport);
  if (kind === 'duration' && ps && (unit === 'h' || unit === 'min')) return { kind, sport: ps, unit };
  if (kind === 'distance' && ps && ps !== 'strength' && (unit === 'km' || unit === 'm')) return { kind, sport: ps, unit };
  if (kind === 'sessions' && ps) return { kind, sport: ps };
  if (kind === 'weekStart' || kind === 'isoWeek' || kind === 'year' || kind === 'planWeek' || kind === 'phase' || kind === 'notes') return { kind };
  return { kind: 'ignore' };
}

export function fieldLabel(f: ImportField): string {
  switch (f.kind) {
    case 'ignore':
      return 'Nicht übernehmen';
    case 'weekStart':
      return 'Woche (Datum)';
    case 'isoWeek':
      return 'Kalenderwoche (KW)';
    case 'year':
      return 'Jahr (zur KW)';
    case 'planWeek':
      return 'Trainingswoche (1, 2, …)';
    case 'phase':
      return 'Phase';
    case 'notes':
      return 'Notizen';
    case 'duration':
      return `${SPORT_SHORT[f.sport]}: Dauer in ${f.unit === 'h' ? 'Stunden' : 'Minuten'}`;
    case 'distance':
      return `${SPORT_SHORT[f.sport]}: Distanz in ${f.unit}`;
    case 'sessions':
      return `${SPORT_SHORT[f.sport]}: Anzahl Einheiten`;
  }
}

/** Alle wählbaren Felder, gruppiert für die Auswahlliste. */
export function fieldOptions(): { group: string; fields: ImportField[] }[] {
  const groups: { group: string; fields: ImportField[] }[] = [
    { group: 'Allgemein', fields: [{ kind: 'ignore' }, { kind: 'weekStart' }, { kind: 'isoWeek' }, { kind: 'year' }, { kind: 'planWeek' }, { kind: 'phase' }, { kind: 'notes' }] },
  ];
  for (const sport of PLANNED_SPORTS) {
    const fields: ImportField[] = [
      { kind: 'duration', sport, unit: 'h' },
      { kind: 'duration', sport, unit: 'min' },
    ];
    if (sport !== 'strength') fields.push({ kind: 'distance', sport, unit: 'km' }, { kind: 'distance', sport, unit: 'm' });
    fields.push({ kind: 'sessions', sport });
    groups.push({ group: SPORT_SHORT[sport], fields });
  }
  return groups;
}

function normalizeHeader(h: string): string[] {
  return h
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .replace(/([a-z])(\d)/g, '$1 $2')
    .split(/[^a-z0-9#]+/)
    .filter(Boolean);
}

const SPORT_WORDS: Record<PlannedSport, string[]> = {
  swim: ['swim', 'swimming', 'schwimmen', 'schwimm', 'sw', 'schw'],
  bike: ['bike', 'rad', 'radfahren', 'cycling', 'ride', 'fahrrad', 'velo'],
  run: ['run', 'running', 'lauf', 'laufen', 'lf'],
  strength: ['kraft', 'krafttraining', 'strength', 'athletik', 'gym', 'stabi'],
};

/** Wort exakt, oder (ab 4 Buchstaben) als Anfang oder Ende eines zusammengesetzten Wortes: „Trainingswoche“, „Startdatum“, „Dauerlauf“. */
function hasAny(tokens: string[], words: string[]): boolean {
  return tokens.some((t) => words.includes(t) || words.some((w) => w.length >= 4 && (t.startsWith(w) || t.endsWith(w))));
}

function sampleValues(table: RawTable, col: number): string[] {
  return table.rows.map((r) => r[col] ?? '').filter((v) => v.trim() !== '');
}

/** Mehrheit der Werte (einzelne Tippfehler sollen die Erkennung nicht verhindern). */
function mostly(values: string[], test: (v: string) => boolean): boolean {
  return values.length > 0 && values.filter(test).length / values.length >= 0.6;
}

function looksLikeDates(values: string[]): boolean {
  return mostly(values, (v) => parseDateCell(v) !== null);
}

function looksLikeSmallInts(values: string[]): boolean {
  return mostly(values, (v) => /^\d{1,2}$/.test(v.trim()));
}

function maxNumeric(values: string[]): number | null {
  const nums = values.map((v) => parseNumber(v.replace(/[a-zA-Zäöü×.]+$/g, '').trim())).filter((n): n is number => typeof n === 'number');
  return nums.length ? Math.max(...nums) : null;
}

/** Schlägt je Spalte ein Feld vor. Unklare Spalten werden „Nicht übernehmen“. */
export function suggestMapping(table: RawTable): ColumnMapping[] {
  const used = new Set<string>();
  const result = table.headers.map((header, col): ColumnMapping => {
    const tokens = normalizeHeader(header);
    const values = sampleValues(table, col);
    const sport = PLANNED_SPORTS.find((s) => hasAny(tokens, SPORT_WORDS[s]));

    if (!sport) {
      if (hasAny(tokens, ['kw', 'kalenderwoche', 'isoweek', 'cw'])) return { field: { kind: 'isoWeek' }, guessed: false };
      if (hasAny(tokens, ['jahr', 'year'])) return { field: { kind: 'year' }, guessed: false };
      if (hasAny(tokens, ['phase', 'block', 'periode', 'zyklus', 'mesozyklus'])) return { field: { kind: 'phase' }, guessed: false };
      if (hasAny(tokens, ['notiz', 'notizen', 'bemerkung', 'bemerkungen', 'kommentar', 'note', 'notes', 'comment', 'hinweis'])) return { field: { kind: 'notes' }, guessed: false };
      if (hasAny(tokens, ['woche', 'week', 'wochenbeginn', 'weekstart', 'datum', 'date', 'start', 'montag', 'ab', 'von'])) {
        if (looksLikeDates(values)) return { field: { kind: 'weekStart' }, guessed: false };
        if (looksLikeSmallInts(values)) return { field: { kind: 'planWeek' }, guessed: true };
      }
      if (looksLikeDates(values)) return { field: { kind: 'weekStart' }, guessed: true };
      return { field: { kind: 'ignore' }, guessed: false };
    }

    const isSessions = hasAny(tokens, ['einheiten', 'anzahl', 'sessions', 'session', 'count', 'x', '#', 'workouts', 'trainings', 'eh']);
    const isDistance = hasAny(tokens, ['km', 'distanz', 'distance', 'strecke', 'dist', 'm', 'meter', 'metern', 'kilometer']);
    const isDuration = hasAny(tokens, ['h', 'std', 'stunden', 'stunde', 'hours', 'hrs', 'hr', 'min', 'minuten', 'minutes', 'mins', 'dauer', 'zeit', 'duration', 'time', 'umfang']);

    if (isSessions || (sport === 'strength' && !isDuration)) return { field: { kind: 'sessions', sport }, guessed: !isSessions };
    if (isDistance && sport !== 'strength') {
      const explicit = tokens.includes('km') || tokens.includes('kilometer') ? 'km' : tokens.some((t) => t === 'm' || t === 'meter' || t === 'metern') ? 'm' : null;
      if (explicit) return { field: { kind: 'distance', sport, unit: explicit }, guessed: false };
      const max = maxNumeric(values);
      const limit = sport === 'swim' ? 50 : 2000; // Schwimmen 3,8 vs. 3800; Rad/Laufen km pro Woche
      return { field: { kind: 'distance', sport, unit: max !== null && max > limit ? 'm' : 'km' }, guessed: true };
    }
    const explicit = hasAny(tokens, ['min', 'minuten', 'minutes', 'mins']) ? 'min' : hasAny(tokens, ['h', 'std', 'stunden', 'stunde', 'hours', 'hrs', 'hr']) ? 'h' : null;
    if (explicit) return { field: { kind: 'duration', sport, unit: explicit }, guessed: false };
    // Nur Sportart oder „Dauer“ ohne Einheit: aus den Werten erraten.
    const max = maxNumeric(values);
    const hasTime = values.some((v) => /\d:\d\d|h|min|std/i.test(v));
    if (!isDuration && !hasTime && sport === 'swim' && max !== null && max > 100) {
      return { field: { kind: 'distance', sport, unit: 'm' }, guessed: true }; // „Schwimmen: 3500“ sind Meter
    }
    return { field: { kind: 'duration', sport, unit: max !== null && max > 40 ? 'min' : 'h' }, guessed: true };
  });
  // Nur eine Wochenangabe: Datum vor KW vor Trainingswoche (eine KW-Spalte neben dem Datum ist dann nur Info)
  const kinds = result.map((m) => m.field.kind);
  const weekKind = kinds.includes('weekStart') ? 'weekStart' : kinds.includes('isoWeek') ? 'isoWeek' : 'planWeek';
  const single = result.map((m): ColumnMapping => {
    const k = m.field.kind;
    if ((k === 'weekStart' || k === 'isoWeek' || k === 'planWeek') && k !== weekKind) return { field: { kind: 'ignore' }, guessed: false };
    if (k === 'year' && weekKind !== 'isoWeek') return { field: { kind: 'ignore' }, guessed: false };
    return m;
  });
  // Doppelte Ziele: nur die erste Spalte behält den Vorschlag
  return single.map((m) => {
    if (m.field.kind === 'ignore') return m;
    const k = targetKey(m.field);
    if (used.has(k)) return { field: { kind: 'ignore' }, guessed: false };
    used.add(k);
    return m;
  });
}

/** Prüft die Zuordnung als Ganzes. Leere Liste = in Ordnung. */
export function validateMapping(table: RawTable, mapping: readonly ColumnMapping[]): string[] {
  const errors: string[] = [];
  const kinds = mapping.map((m) => m.field.kind);
  const weekKinds = (['weekStart', 'isoWeek', 'planWeek'] as const).filter((k) => kinds.includes(k));
  if (weekKinds.length === 0) errors.push('Eine Spalte muss die Woche angeben: Datum, Kalenderwoche (KW) oder Trainingswoche.');
  if (weekKinds.length > 1) errors.push('Bitte nur eine Art der Wochenangabe zuordnen (Datum, KW oder Trainingswoche).');
  if (kinds.includes('year') && !kinds.includes('isoWeek')) errors.push('„Jahr“ wird nur zusammen mit einer KW-Spalte verwendet.');
  const seen = new Map<string, number>();
  mapping.forEach((m, i) => {
    if (m.field.kind === 'ignore') return;
    const k = targetKey(m.field);
    const prev = seen.get(k);
    if (prev !== undefined) errors.push(`„${table.headers[prev]}“ und „${table.headers[i]}“ befüllen dasselbe Feld (${fieldLabel(m.field).replace(/ in (Stunden|Minuten|km|m)$/, '')}).`);
    else seen.set(k, i);
  });
  const hasValue = mapping.some((m) => ['phase', 'notes', 'duration', 'distance', 'sessions'].includes(m.field.kind));
  if (!hasValue) errors.push('Mindestens eine Spalte mit Planwerten zuordnen (z. B. Dauer, Distanz, Einheiten oder Phase).');
  return errors;
}

// ───────────────────────────── Werte deuten ─────────────────────────────

export type CellResult<T> = { kind: 'empty' } | { kind: 'value'; value: T; note?: string } | { kind: 'unclear'; message: string };

const EMPTY_MARKERS = new Set(['', '-', '–', '—', 'n/a', 'na', '/']);

function isEmptyCell(raw: string): boolean {
  return EMPTY_MARKERS.has(raw.trim().toLowerCase());
}

/**
 * Zahl mit Dezimalkomma oder -punkt. Mit beiden Zeichen gilt das letzte als Dezimaltrenner („1.234,5“, „1,234.5“).
 * „1.500“ ist mehrdeutig (1,5 oder 1500) → null mit Grund.
 */
export function parseNumber(raw: string): number | null {
  const s = raw.trim().replace(/\s/g, '').replace(/^\+/, '');
  if (!/^-?[\d.,]+$/.test(s) || !/\d/.test(s)) return null;
  const lastDot = s.lastIndexOf('.');
  const lastComma = s.lastIndexOf(',');
  let normalized: string;
  if (lastDot >= 0 && lastComma >= 0) {
    const dec = lastDot > lastComma ? '.' : ',';
    const thou = dec === '.' ? ',' : '.';
    normalized = s.split(thou).join('').replace(dec, '.');
  } else if (lastComma >= 0) {
    if ((s.match(/,/g) ?? []).length > 1) return null;
    normalized = s.replace(',', '.');
  } else if (lastDot >= 0) {
    if ((s.match(/\./g) ?? []).length > 1) return null;
    normalized = s;
  } else normalized = s;
  if (!/^-?\d*\.?\d+$/.test(normalized)) return null;
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

function isAmbiguousThousands(raw: string): boolean {
  return /^\d{1,3}\.\d{3}$/.test(raw.trim());
}

const LIMITS = {
  durationSec: 40 * 3600,
  distanceM: { swim: 50_000, bike: 1_500_000, run: 300_000 } as Record<Exclude<PlannedSport, 'strength'>, number>,
  sessions: 21,
};

function numberOrUnclear(raw: string): { n: number } | { message: string } {
  if (isAmbiguousThousands(raw)) return { message: `„${raw.trim()}“ ist mehrdeutig (Tausenderpunkt oder Dezimalpunkt?). Bitte „1500“ oder „1,5“ schreiben.` };
  const n = parseNumber(raw);
  if (n === null) return { message: `„${raw.trim()}“ ist keine Zahl.` };
  if (n < 0) return { message: `„${raw.trim()}“ ist negativ.` };
  return { n };
}

/** Dauer: „1:30“, „1:30:00“, „1h30“, „90 min“, „1,5 h“ oder reine Zahl in der Spalten-Einheit. */
export function parseDurationCell(raw: string, unit: DurationUnit): CellResult<number> {
  if (isEmptyCell(raw)) return { kind: 'empty' };
  const s = raw.trim().toLowerCase().replace(/\s+/g, ' ');
  let sec: number | null = null;
  let m: RegExpMatchArray | null;
  if ((m = s.match(/^(\d{1,3}):([0-5]\d)(?::([0-5]\d))?$/))) {
    sec = Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3] ?? 0);
  } else if ((m = s.match(/^(\d+(?:[.,]\d+)?) ?(?:h|std\.?|stunden?|hrs?|hours?) ?(?:(\d{1,2}) ?(?:min\.?|minuten|mins?|m|')?)?$/))) {
    const h = parseNumber(m[1] ?? '');
    if (h !== null) sec = h * 3600 + Number(m[2] ?? 0) * 60;
  } else if ((m = s.match(/^(\d+(?:[.,]\d+)?) ?(?:min\.?|minuten|mins?|')$/))) {
    const min = parseNumber(m[1] ?? '');
    if (min !== null) sec = min * 60;
  } else {
    const r = numberOrUnclear(raw);
    if ('message' in r) return { kind: 'unclear', message: r.message };
    sec = unit === 'h' ? r.n * 3600 : r.n * 60;
  }
  if (sec === null) return { kind: 'unclear', message: `„${raw.trim()}“ ist keine Dauer.` };
  sec = Math.round(sec);
  if (sec > LIMITS.durationSec) return { kind: 'unclear', message: `„${raw.trim()}“ ergibt mehr als 40 Stunden pro Woche – Einheit prüfen.` };
  return { kind: 'value', value: sec };
}

/** Distanz: „3,8 km“, „3800 m“ oder reine Zahl in der Spalten-Einheit. Ergebnis in Metern. */
export function parseDistanceCell(raw: string, unit: DistanceUnit, sport: Exclude<PlannedSport, 'strength'>): CellResult<number> {
  if (isEmptyCell(raw)) return { kind: 'empty' };
  const s = raw.trim().toLowerCase();
  let meters: number;
  const m = s.match(/^([\d.,]+) ?(km|m|meter|metern)$/);
  if (m) {
    const r = numberOrUnclear(m[1] ?? '');
    if ('message' in r) return { kind: 'unclear', message: r.message };
    meters = m[2] === 'km' ? r.n * 1000 : r.n;
  } else {
    const r = numberOrUnclear(raw);
    if ('message' in r) return { kind: 'unclear', message: r.message };
    meters = unit === 'km' ? r.n * 1000 : r.n;
  }
  meters = Math.round(meters);
  if (meters > LIMITS.distanceM[sport]) return { kind: 'unclear', message: `„${raw.trim()}“ ist für ${SPORT_SHORT[sport]} pro Woche unplausibel hoch – Einheit prüfen.` };
  return { kind: 'value', value: meters };
}

/** Anzahl Einheiten: ganze Zahl, „3x“/„3×“ erlaubt. Dezimalzahlen werden nicht gerundet, sondern markiert. */
export function parseSessionsCell(raw: string): CellResult<number> {
  if (isEmptyCell(raw)) return { kind: 'empty' };
  const s = raw.trim().replace(/\s*[x×]$/i, '');
  const r = numberOrUnclear(s);
  if ('message' in r) return { kind: 'unclear', message: r.message };
  if (!Number.isInteger(r.n)) return { kind: 'unclear', message: `„${raw.trim()}“ ist keine ganze Anzahl.` };
  if (r.n > LIMITS.sessions) return { kind: 'unclear', message: `„${raw.trim()}“ Einheiten pro Woche ist unplausibel.` };
  return { kind: 'value', value: r.n };
}

const PHASE_WORDS: Record<PhaseType, string[]> = {
  base: ['base', 'basis', 'grundlage', 'grundlagen', 'grundlagenphase', 'gp', 'general', 'vorbereitung'],
  build: ['build', 'aufbau', 'aufbauphase', 'entwicklung'],
  specific: ['specific', 'spezifisch', 'spezifische', 'wettkampfspezifisch', 'peak', 'spitze'],
  recovery: ['recovery', 'entlastung', 'entlastungswoche', 'regeneration', 'erholung', 'ruhewoche', 'deload', 'rest'],
  taper: ['taper', 'tapering', 'formaufbau'],
  race: ['race', 'wettkampf', 'wettkampfwoche', 'rennen', 'rennwoche', 'raceweek'],
  transition: ['transition', 'uebergang', 'uebergangsphase', 'off', 'offseason'],
};

export function parsePhaseCell(raw: string): CellResult<PhaseType> {
  if (isEmptyCell(raw)) return { kind: 'empty' };
  const tokens = normalizeHeader(raw);
  const joined = tokens.join('');
  for (const p of PHASE_TYPES) {
    if (joined === p || normalizeHeader(PHASE_LABEL[p]).join('') === joined) return { kind: 'value', value: p };
  }
  const hits = PHASE_TYPES.filter((p) => tokens.some((t) => PHASE_WORDS[p].includes(t)) || PHASE_WORDS[p].includes(joined));
  if (hits.length === 1 && hits[0]) return { kind: 'value', value: hits[0] };
  return { kind: 'unclear', message: `Phase „${raw.trim()}“ nicht erkannt (z. B. Grundlage, Aufbau, Spezifisch, Entlastung, Taper, Wettkampf).` };
}

/** Datum: 2026-11-16, 16.11.2026, 16.11.26, 16/11/2026, ISO-Zeitstempel. Ergebnis: lokaler Kalendertag. */
export function parseDateCell(raw: string): LocalDate | null {
  const s = raw.trim();
  let m: RegExpMatchArray | null;
  let y: number, mo: number, d: number;
  if ((m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T ].*)?$/))) {
    [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  } else if ((m = s.match(/^(\d{1,2})[./](\d{1,2})[./](\d{2}|\d{4})$/))) {
    [d, mo, y] = [Number(m[1]), Number(m[2]), Number(m[3])];
    if (y < 100) y += 2000;
  } else return null;
  const date = `${String(y).padStart(4, '0')}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  return isLocalDate(date) ? date : null;
}

// ───────────────────────────── Zeilen zu Wochen ─────────────────────────────

type MetricKey = 'durationSec' | 'distanceM' | 'sessions';

/** Gedeutete Werte einer Woche. Schlüssel fehlt = Spalte nicht zugeordnet oder Wert unklar (Plan bleibt unberührt). `null` = Zelle leer. */
export interface ImportedWeekValues {
  phase?: PhaseType | null;
  notes?: string | null;
  sports: Partial<Record<PlannedSport, Partial<Record<MetricKey, number | null>>>>;
}

export interface ImportedWeek {
  weekStart: LocalDate;
  /** Zeilennummer in der Quelle (1 = erste Datenzeile). */
  row: number;
  values: ImportedWeekValues;
}

export interface ImportIssue {
  row: number;
  column?: string;
  raw?: string;
  message: string;
  /** skipped = ganze Zeile nicht übernommen; unclear = einzelner Wert nicht übernommen; info = nur Hinweis */
  level: 'skipped' | 'unclear' | 'info';
}

export interface InterpretResult {
  weeks: ImportedWeek[];
  issues: ImportIssue[];
}

function resolveWeek(
  row: string[],
  mapping: readonly ColumnMapping[],
  table: RawTable,
  planWeeks: readonly LocalDate[],
): { weekStart: LocalDate; info?: string } | { error: string } {
  const col = (kind: ImportField['kind']) => mapping.findIndex((m) => m.field.kind === kind);
  const ws = col('weekStart');
  if (ws >= 0) {
    const raw = row[ws] ?? '';
    if (isEmptyCell(raw)) return { error: `Keine Woche angegeben („${table.headers[ws]}“ ist leer).` };
    const date = parseDateCell(raw);
    if (!date) return { error: `„${raw}“ ist kein Datum (z. B. 16.11.2026 oder 2026-11-16).` };
    const monday = startOfWeek(date);
    return monday === date ? { weekStart: monday } : { weekStart: monday, info: `${raw} auf den Wochenbeginn (Montag) gelegt.` };
  }
  const pw = col('planWeek');
  if (pw >= 0) {
    const raw = (row[pw] ?? '').trim();
    if (!/^\d{1,3}$/.test(raw)) return { error: `„${raw}“ ist keine Trainingswochen-Nummer.` };
    const n = Number(raw);
    const w = planWeeks[n - 1];
    if (n < 1 || !w) return { error: `Trainingswoche ${n} gibt es im Plan nicht (Plan hat ${planWeeks.length} Wochen).` };
    return { weekStart: w };
  }
  const kw = col('isoWeek');
  const rawKw = (row[kw] ?? '').trim().replace(/^kw\s*/i, '');
  if (!/^\d{1,2}$/.test(rawKw) || Number(rawKw) < 1 || Number(rawKw) > 53) return { error: `„${row[kw] ?? ''}“ ist keine Kalenderwoche.` };
  const week = Number(rawKw);
  const yc = col('year');
  let year: number | null = null;
  if (yc >= 0) {
    const rawY = (row[yc] ?? '').trim();
    if (!/^\d{4}$/.test(rawY)) return { error: `„${rawY}“ ist keine Jahreszahl.` };
    year = Number(rawY);
  }
  const candidates = planWeeks.filter((w) => {
    const iw = isoWeek(w);
    return iw.week === week && (year === null || iw.year === year);
  });
  if (candidates.length === 1 && candidates[0]) return { weekStart: candidates[0] };
  if (candidates.length > 1) return { error: `KW ${week} kommt im Planzeitraum mehrfach vor – bitte eine Spalte „Jahr“ ergänzen.` };
  return { error: `KW ${week}${year ? `/${year}` : ''} liegt außerhalb des Planzeitraums.` };
}

/** Deutet alle Zeilen. Wochen außerhalb des Plans und doppelte Wochen werden übersprungen und gemeldet. */
export function interpretRows(table: RawTable, mapping: readonly ColumnMapping[], planWeeks: readonly LocalDate[]): InterpretResult {
  const issues: ImportIssue[] = [];
  const weeks: ImportedWeek[] = [];
  const seen = new Map<LocalDate, number>();
  const planSet = new Set(planWeeks);

  table.rows.forEach((row, idx) => {
    const rowNo = idx + 1;
    const resolved = resolveWeek(row, mapping, table, planWeeks);
    if ('error' in resolved) {
      issues.push({ row: rowNo, message: resolved.error, level: 'skipped' });
      return;
    }
    const { weekStart } = resolved;
    if (!planSet.has(weekStart)) {
      issues.push({ row: rowNo, message: `Woche ab ${weekStart.split('-').reverse().join('.')} (KW ${isoWeek(weekStart).week}) liegt außerhalb des Planzeitraums.`, level: 'skipped' });
      return;
    }
    const prev = seen.get(weekStart);
    if (prev !== undefined) {
      issues.push({ row: rowNo, message: `KW ${isoWeek(weekStart).week} steht bereits in Zeile ${prev}; diese Zeile wird nicht übernommen.`, level: 'skipped' });
      return;
    }
    seen.set(weekStart, rowNo);
    if (resolved.info) issues.push({ row: rowNo, message: resolved.info, level: 'info' });

    const values: ImportedWeekValues = { sports: {} };
    const setMetric = (sport: PlannedSport, key: MetricKey, v: number | null) => {
      values.sports[sport] = { ...values.sports[sport], [key]: v };
    };
    mapping.forEach((m, c) => {
      const raw = row[c] ?? '';
      const f = m.field;
      let r: CellResult<unknown>;
      switch (f.kind) {
        case 'phase':
          r = parsePhaseCell(raw);
          if (r.kind === 'value') values.phase = r.value as PhaseType;
          else if (r.kind === 'empty') values.phase = null;
          break;
        case 'notes': {
          const t = raw.trim();
          r = t.length > 2000 ? { kind: 'unclear', message: 'Notiz ist länger als 2000 Zeichen.' } : t === '' ? { kind: 'empty' } : { kind: 'value', value: t };
          if (r.kind === 'value') values.notes = t;
          else if (r.kind === 'empty') values.notes = null;
          break;
        }
        case 'duration':
          r = parseDurationCell(raw, f.unit);
          if (r.kind !== 'unclear') setMetric(f.sport, 'durationSec', r.kind === 'value' ? (r.value as number) : null);
          break;
        case 'distance':
          r = parseDistanceCell(raw, f.unit, f.sport);
          if (r.kind !== 'unclear') setMetric(f.sport, 'distanceM', r.kind === 'value' ? (r.value as number) : null);
          break;
        case 'sessions':
          r = parseSessionsCell(raw);
          if (r.kind !== 'unclear') setMetric(f.sport, 'sessions', r.kind === 'value' ? (r.value as number) : null);
          break;
        default:
          return;
      }
      if (r.kind === 'unclear') issues.push({ row: rowNo, column: table.headers[c], raw, message: r.message, level: 'unclear' });
    });
    weeks.push({ weekStart, row: rowNo, values });
  });
  return { weeks, issues };
}

// ───────────────────────────── Vorschau: Vorher/Nachher ─────────────────────────────

/** replace: leere Zelle entfernt das bisherige Ziel. keep: leere Zelle lässt das bisherige Ziel stehen. */
export type EmptyCellMode = 'replace' | 'keep';

export function applyImportedValues(t: WeekTargets, v: ImportedWeekValues, mode: EmptyCellMode): WeekTargets {
  let next: WeekTargets = { ...t };
  if (v.phase !== undefined) {
    if (v.phase !== null) next.phase = v.phase;
    else if (mode === 'replace') delete next.phase;
  }
  if (v.notes !== undefined) {
    if (v.notes !== null) next.notes = v.notes;
    else if (mode === 'replace') delete next.notes;
  }
  for (const sport of PLANNED_SPORTS) {
    const metrics = v.sports[sport];
    if (!metrics) continue;
    const before = getSportTarget(next, sport);
    const target: WeeklySportTarget = { ...(before ?? { sport }) };
    for (const key of ['durationSec', 'distanceM', 'sessions'] as const) {
      if (!(key in metrics)) continue;
      const val = metrics[key];
      if (val !== null && val !== undefined) target[key] = val;
      else if (mode === 'replace') delete target[key];
    }
    // Unverändert → Liste nicht anfassen (sonst entstünde allein durch Umsortieren eine Scheinänderung)
    if (canonical(target) !== canonical(before ?? { sport })) next = setSportTarget(next, target);
  }
  return next;
}

/** Vorher/Nachher je Planwoche – nur Wochen, die sich tatsächlich ändern. */
export function buildImportChanges(
  planWeeks: readonly { weekStart: LocalDate; current: WeekTargets }[],
  imported: readonly ImportedWeek[],
  mode: EmptyCellMode,
): PlanWeekChange[] {
  const out: PlanWeekChange[] = [];
  for (const iw of imported) {
    const w = planWeeks.find((x) => x.weekStart === iw.weekStart);
    if (!w) continue;
    const after = applyImportedValues(w.current, iw.values, mode);
    if (!sameTargets(after, w.current)) out.push({ weekStart: w.weekStart, before: w.current, after });
  }
  return out.sort((a, b) => (a.weekStart < b.weekStart ? -1 : 1));
}

// ───────────────────────────── Vorlage ─────────────────────────────

/** Leere CSV-Vorlage mit allen Planwochen (Semikolon, Dezimalkomma – passt zu deutschem Excel/Numbers). */
export function importTemplateCsv(planWeeks: readonly LocalDate[]): string {
  const header = ['Woche ab', 'KW', 'Phase', 'Schwimmen km', 'Schwimmen h', 'Rad h', 'Rad km', 'Laufen h', 'Laufen km', 'Kraft Einheiten', 'Notiz'];
  const lines = [header.join(';')];
  for (const w of planWeeks) {
    const [y, m, d] = w.split('-');
    lines.push([`${d}.${m}.${y}`, String(isoWeek(w).week), '', '', '', '', '', '', '', '', ''].join(';'));
  }
  return lines.join('\r\n') + '\r\n';
}

/** Beispielwochen für die Hilfe – nur zur Anzeige. */
export function exampleTable(firstWeek: LocalDate): string {
  const fmt = (w: LocalDate) => w.split('-').reverse().join('.');
  return [
    'Woche ab;Phase;Schwimmen km;Rad h;Laufen h;Kraft Einheiten',
    `${fmt(firstWeek)};Grundlage;6;5;3,5;2`,
    `${fmt(addDays(firstWeek, 7))};Grundlage;6,5;5:30;4;2`,
    `${fmt(addDays(firstWeek, 14))};Entlastung;4;3;2,5;1`,
  ].join('\n');
}
