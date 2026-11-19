import { describe, expect, it } from 'vitest';
import {
  applyImportedValues,
  buildImportChanges,
  fieldFromKey,
  fieldKey,
  fieldOptions,
  importTemplateCsv,
  interpretRows,
  parseDateCell,
  parseDistanceCell,
  parseDurationCell,
  parseNumber,
  parsePhaseCell,
  parseSessionsCell,
  readImportText,
  suggestMapping,
  validateMapping,
  type ColumnMapping,
  type RawTable,
} from './planImport';
import { weekStartsBetween } from './calendar';
import type { WeekTargets } from './schemas';

const PLAN = weekStartsBetween('2026-11-16', '2027-02-14'); // 13 Wochen, über den Jahreswechsel

function table(text: string): RawTable {
  const r = readImportText(text);
  if (!r.ok) throw new Error(r.error);
  return r.table;
}

describe('Tabelle einlesen', () => {
  it('CSV mit Semikolon, BOM, Dezimalkomma und Anführungszeichen', () => {
    const r = readImportText('﻿Woche ab;Rad h;Notiz\r\n16.11.2026;5,5;"Locker; mit ""Freunden"""\r\n\r\n23.11.2026;6;\r\n');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.source).toBe('csv');
    expect(r.table.headers).toEqual(['Woche ab', 'Rad h', 'Notiz']);
    expect(r.table.rows).toEqual([
      ['16.11.2026', '5,5', 'Locker; mit "Freunden"'],
      ['23.11.2026', '6', ''],
    ]);
  });

  it('eingefügte Tabelle aus Excel/Numbers (Tabulator)', () => {
    const r = readImportText('KW\tSchwimmen km\tLaufen h\n47\t6\t3,5\n48\t\t4');
    expect(r.ok && r.source).toBe('tsv');
    if (r.ok) expect(r.table.rows[1]).toEqual(['48', '', '4']);
  });

  it('ohne Überschriftenzeile: Spalten werden durchnummeriert', () => {
    const r = readImportText('16.11.2026;5\n23.11.2026;6', false);
    expect(r.ok && r.table.headers).toEqual(['Spalte 1', 'Spalte 2']);
    expect(r.ok && r.table.rows).toHaveLength(2);
  });

  it('JSON: Liste unter "weeks", verschachtelte Werte werden zu Spalten', () => {
    const r = readImportText(JSON.stringify({ weeks: [{ week: '2026-11-16', bike: { hours: 6 }, run: { km: 30 } }, { week: '2026-11-23', bike: { hours: 6.5 } }] }));
    expect(r.ok && r.source).toBe('json');
    if (!r.ok) return;
    expect(r.table.headers).toEqual(['week', 'bike.hours', 'run.km']);
    expect(r.table.rows[1]).toEqual(['2026-11-23', '6.5', '']);
  });

  it('Fehler mit Klartext', () => {
    expect(readImportText('   ')).toEqual({ ok: false, error: 'Die Eingabe ist leer.' });
    expect(readImportText('{kaputt').ok).toBe(false);
    expect(readImportText('nur eine Spalte\nwert').ok).toBe(false);
    expect(readImportText('{"a": 1}').ok).toBe(false);
  });
});

describe('Werte deuten', () => {
  it('Zahlen: Dezimalkomma/-punkt, Tausender nur eindeutig', () => {
    expect(parseNumber('5,5')).toBe(5.5);
    expect(parseNumber('5.5')).toBe(5.5);
    expect(parseNumber('1.234,5')).toBe(1234.5);
    expect(parseNumber('1,234.5')).toBe(1234.5);
    expect(parseNumber('abc')).toBeNull();
    expect(parseDistanceCell('1.500', 'm', 'swim')).toMatchObject({ kind: 'unclear' });
    expect(parseDistanceCell('1500', 'm', 'swim')).toEqual({ kind: 'value', value: 1500 });
  });

  it('Dauer in allen üblichen Schreibweisen', () => {
    const sec = (raw: string, unit: 'h' | 'min' = 'h') => {
      const r = parseDurationCell(raw, unit);
      return r.kind === 'value' ? r.value : r.kind;
    };
    expect(sec('1:30')).toBe(5400);
    expect(sec('1:30:00')).toBe(5400);
    expect(sec('1h30')).toBe(5400);
    expect(sec('1 h 30 min')).toBe(5400);
    expect(sec('1,5 h')).toBe(5400);
    expect(sec('1,5 Std')).toBe(5400);
    expect(sec('90 min')).toBe(5400);
    expect(sec('1,5')).toBe(5400);
    expect(sec('90', 'min')).toBe(5400);
    expect(sec('')).toBe('empty');
    expect(sec('–')).toBe('empty');
    expect(sec('viel')).toBe('unclear');
    expect(sec('-2')).toBe('unclear');
    expect(sec('300')).toBe('unclear'); // 300 h pro Woche → Einheit prüfen
    expect(sec('0')).toBe(0); // 0 ist ein Wert, nicht leer
  });

  it('Distanz mit und ohne Einheit in der Zelle', () => {
    expect(parseDistanceCell('3,8 km', 'm', 'swim')).toEqual({ kind: 'value', value: 3800 });
    expect(parseDistanceCell('3800 m', 'km', 'swim')).toEqual({ kind: 'value', value: 3800 });
    expect(parseDistanceCell('42,2', 'km', 'run')).toEqual({ kind: 'value', value: 42200 });
    expect(parseDistanceCell('4000', 'km', 'run')).toMatchObject({ kind: 'unclear' });
  });

  it('Einheiten: nur ganze Zahlen, nichts wird gerundet', () => {
    expect(parseSessionsCell('3')).toEqual({ kind: 'value', value: 3 });
    expect(parseSessionsCell('2x')).toEqual({ kind: 'value', value: 2 });
    expect(parseSessionsCell('2,5')).toMatchObject({ kind: 'unclear' });
    expect(parseSessionsCell('')).toEqual({ kind: 'empty' });
  });

  it('Phasen deutsch und englisch, Unbekanntes wird markiert', () => {
    const p = (raw: string) => {
      const r = parsePhaseCell(raw);
      return r.kind === 'value' ? r.value : r.kind;
    };
    expect(p('Grundlage')).toBe('base');
    expect(p('Grundlagenphase')).toBe('base');
    expect(p('Aufbau 2')).toBe('build');
    expect(p('Entlastungswoche')).toBe('recovery');
    expect(p('Spezifische Vorbereitung')).toBe('specific');
    expect(p('Taper')).toBe('taper');
    expect(p('Übergang')).toBe('transition');
    expect(p('Wettkampfwoche')).toBe('race');
    expect(p('build')).toBe('build');
    expect(p('Hügelblock')).toBe('unclear');
  });

  it('Datumsformate', () => {
    expect(parseDateCell('16.11.2026')).toBe('2026-11-16');
    expect(parseDateCell('6.1.27')).toBe('2027-01-06');
    expect(parseDateCell('2026-11-16T00:00:00Z')).toBe('2026-11-16');
    expect(parseDateCell('31.02.2026')).toBeNull();
    expect(parseDateCell('KW 47')).toBeNull();
  });
});

describe('Zuordnung', () => {
  it('erkennt deutsche Überschriften inkl. Einheiten', () => {
    const t = table('Woche ab;KW;Phase;Schwimmen km;Rad h;Laufen Dauer (min);Kraft Einheiten;Notiz;Puls\n16.11.2026;47;Grundlage;6;5;210;2;x;140');
    expect(suggestMapping(t).map((m) => fieldKey(m.field))).toEqual([
      'weekStart',
      'ignore', // KW neben dem Datum: nur eine Wochenangabe, Datum hat Vorrang
      'phase',
      'distance:swim:km',
      'duration:bike:h',
      'duration:run:min',
      'sessions:strength',
      'notes',
      'ignore',
    ]);
  });

  it('Einheit ohne Angabe wird aus den Werten erraten und als „vermutet“ markiert', () => {
    const t = table('week;swim;bike;run distance\n2026-11-16;3500;6;30\n2026-11-23;4000;7;32');
    const m = suggestMapping(t);
    expect(m.map((x) => fieldKey(x.field))).toEqual(['weekStart', 'distance:swim:m', 'duration:bike:h', 'distance:run:km']);
    expect(m.map((x) => x.guessed)).toEqual([false, true, true, true]);
  });

  it('zusammengesetzte deutsche Wörter', () => {
    const t = table('Trainingswoche;Trainingsphase;Gesamtdauer Rad (Std.);Dauerlauf km;Schwimmumfang m\n1;Aufbau;5;30;3000');
    expect(suggestMapping(t).map((m) => fieldKey(m.field))).toEqual(['planWeek', 'phase', 'duration:bike:h', 'distance:run:km', 'distance:swim:m']);
    const d = table('Startdatum;Rad h\n16.11.2026;5');
    expect(suggestMapping(d)[0]?.field.kind).toBe('weekStart');
  });

  it('dieselbe Zielgröße zweimal: nur die erste Spalte wird vorgeschlagen', () => {
    const t = table('Woche;Rad h;Rad Stunden\n16.11.2026;5;5');
    expect(suggestMapping(t).map((m) => m.field.kind)).toEqual(['weekStart', 'duration', 'ignore']);
  });

  it('Prüfung: genau eine Wochenangabe, keine doppelten Felder, mindestens ein Wert', () => {
    const t = table('a;b;c\n1;2;3');
    const m = (...keys: string[]): ColumnMapping[] => keys.map((k) => ({ field: fieldFromKey(k), guessed: false }));
    expect(validateMapping(t, m('ignore', 'duration:bike:h', 'ignore'))[0]).toMatch(/Woche/);
    expect(validateMapping(t, m('weekStart', 'isoWeek', 'duration:bike:h'))[0]).toMatch(/nur eine/);
    expect(validateMapping(t, m('weekStart', 'duration:bike:h', 'duration:bike:min'))[0]).toMatch(/dasselbe Feld/);
    expect(validateMapping(t, m('weekStart', 'ignore', 'ignore'))[0]).toMatch(/Mindestens/);
    expect(validateMapping(t, m('weekStart', 'duration:bike:h', 'sessions:bike'))).toEqual([]);
  });

  it('alle Auswahl-Optionen lassen sich verlustfrei als Schlüssel speichern', () => {
    for (const g of fieldOptions()) for (const f of g.fields) expect(fieldFromKey(fieldKey(f))).toEqual(f);
  });
});

describe('Zeilen zu Planwochen', () => {
  const map = (t: RawTable) => suggestMapping(t);

  it('Datum mitten in der Woche → Montag (mit Hinweis); außerhalb des Plans und doppelt → übersprungen', () => {
    const t = table('Woche;Rad h\n18.11.2026;5\n01.03.2027;5\n16.11.2026;6\nkeins;4');
    const r = interpretRows(t, map(t), PLAN);
    expect(r.weeks.map((w) => w.weekStart)).toEqual(['2026-11-16']);
    expect(r.issues.map((i) => [i.row, i.level])).toEqual([
      [1, 'info'],
      [2, 'skipped'],
      [3, 'skipped'],
      [4, 'skipped'],
    ]);
  });

  it('KW über den Jahreswechsel eindeutig (2026 hat 53 KW), mehrdeutige KW verlangt ein Jahr', () => {
    const t = table('KW;Rad h\n53;5\n1;4\n30;3');
    const r = interpretRows(t, map(t), PLAN);
    expect(r.weeks.map((w) => w.weekStart)).toEqual(['2026-12-28', '2027-01-04']);
    expect(r.issues[0]?.message).toMatch(/außerhalb/);
    const long = weekStartsBetween('2026-11-16', '2027-12-31');
    const t2 = table('KW;Rad h\n48;5\n52;4');
    const r2 = interpretRows(t2, map(t2), long);
    expect(r2.issues.filter((i) => i.level === 'skipped').map((i) => i.message)).toEqual([
      expect.stringMatching(/mehrfach/),
      expect.stringMatching(/mehrfach/),
    ]);
    const tj = table('KW;Jahr;Rad h\n47;2027;5');
    expect(interpretRows(tj, map(tj), long).weeks[0]?.weekStart).toBe('2027-11-22');
  });

  it('Trainingswoche 1…n', () => {
    const t = table('Woche;Laufen h\n1;3\n13;2\n14;2');
    const r = interpretRows(t, map(t), PLAN);
    expect(r.weeks.map((w) => w.weekStart)).toEqual(['2026-11-16', '2027-02-08']);
    expect(r.issues[0]?.message).toMatch(/Trainingswoche 14/);
  });
});

describe('Fehlende Werte bleiben leer und werden nicht erfunden', () => {
  const existing: WeekTargets = {
    phase: 'base',
    sports: [
      { sport: 'bike', durationSec: 5 * 3600, sessions: 3, zoneSec: { z2: 4 * 3600 } },
      { sport: 'run', durationSec: 3 * 3600, distanceM: 30000 },
      { sport: 'swim', distanceM: 6000 },
    ],
    focuses: [{ id: 'f1', sport: 'run', focus: 'long', count: 1 }],
    freshnessTarget: { min: 5, max: 7 },
    notes: 'alt',
  };
  const plan = [{ weekStart: '2026-11-16', current: existing }];
  const csv = 'Woche ab;Rad h;Laufen h;Laufen km;Phase\n16.11.2026;;3,5;;Aufbau';

  it('„Ziel entfernen“: leere Zelle entfernt den Wert – keine 0, keine Schätzung', () => {
    const t = table(csv);
    const r = interpretRows(t, suggestMapping(t), PLAN);
    const [c] = buildImportChanges(plan, r.weeks, 'replace');
    const bike = c?.after.sports.find((s) => s.sport === 'bike');
    const run = c?.after.sports.find((s) => s.sport === 'run');
    expect(bike?.durationSec).toBeUndefined();
    expect(bike).toEqual({ sport: 'bike', sessions: 3, zoneSec: { z2: 4 * 3600 } }); // nicht zugeordnete Felder unberührt
    expect(run).toEqual({ sport: 'run', durationSec: 12600 }); // Distanz entfernt, nicht aus Pace berechnet
    expect(c?.after.phase).toBe('build');
    // nicht zugeordnete Sportart, Schwerpunkte, Frischebereich, Notizen unverändert
    expect(c?.after.sports.find((s) => s.sport === 'swim')).toEqual({ sport: 'swim', distanceM: 6000 });
    expect(c?.after.focuses).toEqual(existing.focuses);
    expect(c?.after.freshnessTarget).toEqual({ min: 5, max: 7 });
    expect(c?.after.notes).toBe('alt');
  });

  it('„Ziel behalten“: leere Zelle lässt den bisherigen Wert stehen', () => {
    const t = table(csv);
    const r = interpretRows(t, suggestMapping(t), PLAN);
    const [c] = buildImportChanges(plan, r.weeks, 'keep');
    expect(c?.after.sports.find((s) => s.sport === 'bike')?.durationSec).toBe(5 * 3600);
    expect(c?.after.sports.find((s) => s.sport === 'run')).toEqual({ sport: 'run', durationSec: 12600, distanceM: 30000 });
  });

  it('leere Planwoche: nur angegebene Werte entstehen', () => {
    const t = table('Woche ab;Schwimmen km;Rad h;Laufen h;Kraft Einheiten\n16.11.2026;;6;;');
    const r = interpretRows(t, suggestMapping(t), PLAN);
    const [c] = buildImportChanges([{ weekStart: '2026-11-16', current: { sports: [], focuses: [] } }], r.weeks, 'replace');
    expect(c?.after).toEqual({ sports: [{ sport: 'bike', durationSec: 21600 }], focuses: [] });
  });

  it('unklarer Wert wird markiert und nicht übernommen – bisheriger Wert bleibt (auch bei „Ziel entfernen“)', () => {
    const t = table('Woche ab;Rad h;Rad Einheiten\n16.11.2026;fünf;2,5');
    const r = interpretRows(t, suggestMapping(t), PLAN);
    expect(r.issues.map((i) => [i.level, i.column, i.raw])).toEqual([
      ['unclear', 'Rad h', 'fünf'],
      ['unclear', 'Rad Einheiten', '2,5'],
    ]);
    expect(buildImportChanges(plan, r.weeks, 'replace')).toEqual([]);
  });

  it('0 ist ein Wert und wird übernommen', () => {
    const v = applyImportedValues(existing, { sports: { bike: { durationSec: 0 } } }, 'replace');
    expect(v.sports.find((s) => s.sport === 'bike')?.durationSec).toBe(0);
  });

  it('Sportart ohne verbleibende Werte verschwindet aus den Zielen', () => {
    const v = applyImportedValues(existing, { sports: { swim: { distanceM: null } } }, 'replace');
    expect(v.sports.find((s) => s.sport === 'swim')).toBeUndefined();
  });

  it('unveränderte Wochen erscheinen nicht in der Vorschau', () => {
    const t = table('Woche ab;Schwimmen km\n16.11.2026;6');
    const r = interpretRows(t, suggestMapping(t), PLAN);
    expect(buildImportChanges(plan, r.weeks, 'replace')).toEqual([]);
  });
});

describe('Vorlage', () => {
  it('enthält jede Planwoche und lässt sich ohne Änderung wieder einlesen', () => {
    const csv = importTemplateCsv(PLAN);
    const t = table(csv);
    expect(t.rows).toHaveLength(PLAN.length);
    const m = suggestMapping(t);
    expect(validateMapping(t, m)).toEqual([]);
    const r = interpretRows(t, m, PLAN);
    expect(r.weeks).toHaveLength(PLAN.length);
    expect(r.issues).toEqual([]);
  });
});
