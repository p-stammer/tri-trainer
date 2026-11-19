/* Planimport (M2.6): Datei oder eingefügte Tabelle → Spalten zuordnen → Vorschau → Übernehmen. */
import { useMemo, useRef, useState } from 'react';
import { Button, Screen, Section, Segmented } from '../components/ui';
import { WeekDiffList } from '../components/WeekDiff';
import { errorText, useNav, useRepo, useToast } from '../state';
import { deliverFile } from '../files';
import { commitWeekChanges, type ActiveContext } from '../../data/usecases';
import { compareDates, startOfWeek } from '../../domain/calendar';
import {
  buildImportChanges,
  exampleTable,
  fieldFromKey,
  fieldKey,
  fieldLabel,
  fieldOptions,
  importTemplateCsv,
  interpretRows,
  readImportText,
  suggestMapping,
  validateMapping,
  type ColumnMapping,
  type EmptyCellMode,
  type RawTable,
} from '../../domain/planImport';

type Step = 'source' | 'map' | 'preview';
type SourceKind = 'file' | 'paste';

const selectClass = 'min-h-12 w-full rounded-xl border border-line bg-surface-2 px-3 text-[16px]';

export function PlanImport({ ctx }: { ctx: ActiveContext }) {
  const repo = useRepo();
  const toast = useToast();
  const { replace } = useNav();
  const fileRef = useRef<HTMLInputElement>(null);

  const prepWeek = startOfWeek(ctx.race.prepStartDate);
  const raceWeek = startOfWeek(ctx.race.date);
  const planWeeks = useMemo(
    () => ctx.weeks.filter((w) => compareDates(w.weekStart, prepWeek) >= 0 && compareDates(w.weekStart, raceWeek) <= 0),
    [ctx.weeks, prepWeek, raceWeek],
  );

  const [step, setStep] = useState<Step>('source');
  const [sourceKind, setSourceKind] = useState<SourceKind>('file');
  const [pasted, setPasted] = useState('');
  const [fileText, setFileText] = useState<{ name: string; text: string } | null>(null);
  const [hasHeader, setHasHeader] = useState(true);
  const [readError, setReadError] = useState<string | null>(null);
  const [table, setTable] = useState<RawTable | null>(null);
  const [mapping, setMapping] = useState<ColumnMapping[]>([]);
  const [mode, setMode] = useState<EmptyCellMode>('replace');
  const [busy, setBusy] = useState(false);

  const sourceName = sourceKind === 'file' ? (fileText?.name ?? 'Datei') : 'eingefügter Tabelle';
  const rowLabel = (row: number) => `Zeile ${row + (hasHeader ? 1 : 0)}`;

  function readSource() {
    setReadError(null);
    const text = sourceKind === 'file' ? fileText?.text : pasted;
    if (!text) {
      setReadError(sourceKind === 'file' ? 'Bitte zuerst eine Datei auswählen.' : 'Bitte zuerst eine Tabelle einfügen.');
      return;
    }
    const r = readImportText(text, hasHeader);
    if (!r.ok) {
      setReadError(r.error);
      return;
    }
    setTable(r.table);
    setMapping(suggestMapping(r.table));
    setStep('map');
  }

  const mappingErrors = table ? validateMapping(table, mapping) : [];
  const result = useMemo(() => {
    if (!table || step !== 'preview') return null;
    const interpreted = interpretRows(table, mapping, planWeeks.map((w) => w.weekStart));
    const changes = buildImportChanges(planWeeks, interpreted.weeks, mode);
    return { ...interpreted, changes };
  }, [table, mapping, planWeeks, mode, step]);

  async function apply() {
    if (!result || result.changes.length === 0) return;
    setBusy(true);
    try {
      const n = result.changes.length;
      await commitWeekChanges(repo, ctx.plan.id, result.changes, 'import', `Plan importiert: ${n} ${n === 1 ? 'Woche' : 'Wochen'} aus ${sourceName}`.slice(0, 300));
      toast(`${n} ${n === 1 ? 'Woche' : 'Wochen'} übernommen`);
      replace({ name: 'plan' });
    } catch (e) {
      toast(errorText(e), 'error');
      setBusy(false);
    }
  }

  async function downloadTemplate() {
    try {
      await deliverFile('trainingsplan-vorlage.csv', '﻿' + importTemplateCsv(planWeeks.map((w) => w.weekStart)), 'text/csv');
    } catch (e) {
      toast(errorText(e), 'error');
    }
  }

  // ───────── Schritt 1: Quelle ─────────
  if (step === 'source') {
    return (
      <Screen title="Plan importieren" subtitle={`${planWeeks.length} Planwochen bis ${ctx.race.name}`} back>
        <Section title="Quelle">
          <div className="flex flex-col gap-3">
            <Segmented<SourceKind>
              ariaLabel="Quelle"
              value={sourceKind}
              onChange={(v) => {
                setSourceKind(v);
                setReadError(null);
              }}
              options={[
                { value: 'file', label: 'Datei' },
                { value: 'paste', label: 'Tabelle einfügen' },
              ]}
            />
            {sourceKind === 'file' ? (
              <div className="flex flex-col gap-2">
                <Button variant="secondary" onClick={() => fileRef.current?.click()}>
                  {fileText ? 'Andere Datei wählen …' : 'Datei auswählen …'}
                </Button>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".csv,.tsv,.txt,.json,text/csv,text/plain,application/json,text/tab-separated-values"
                  className="hidden"
                  aria-label="Plan-Datei auswählen"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    e.target.value = '';
                    if (!f) return;
                    setReadError(null);
                    f.text().then(
                      (text) => setFileText({ name: f.name, text }),
                      () => setReadError('Die Datei konnte nicht gelesen werden.'),
                    );
                  }}
                />
                <p className="text-sm text-muted">{fileText ? `Ausgewählt: ${fileText.name}` : 'CSV (Semikolon, Komma oder Tabulator) oder JSON.'}</p>
              </div>
            ) : (
              <div className="flex flex-col gap-1.5">
                <textarea
                  aria-label="Tabelle einfügen"
                  value={pasted}
                  onChange={(e) => setPasted(e.target.value)}
                  rows={7}
                  spellCheck={false}
                  placeholder={'Woche ab;Rad h;Laufen h\n16.11.2026;5;3,5'}
                  className="w-full rounded-xl border border-line bg-surface-2 px-3 py-2 font-mono text-[16px] text-ink placeholder:text-muted/70 focus:border-swim focus:outline-none"
                />
                <p className="text-xs text-muted">In Excel, Numbers oder Google Tabellen die Zellen markieren, kopieren und hier einfügen.</p>
              </div>
            )}
            <label className="flex min-h-11 items-center gap-3 text-[15px]">
              <input type="checkbox" checked={hasHeader} onChange={(e) => setHasHeader(e.target.checked)} className="h-5 w-5" />
              Erste Zeile enthält Überschriften
            </label>
            {readError && (
              <p className="rounded-xl border border-danger/40 p-3 text-sm text-danger" role="alert">
                {readError}
              </p>
            )}
            <Button onClick={readSource}>Weiter</Button>
          </div>
        </Section>

        <Section title="So sieht die Tabelle aus">
          <div className="flex flex-col gap-3 text-sm">
            <p>
              Eine Zeile pro Woche. Die Woche als Datum (beliebiger Tag der Woche), als Kalenderwoche oder als Trainingswoche (1, 2, …). Dazu
              beliebige Spalten mit Dauer, Distanz oder Anzahl Einheiten je Sportart, Phase und Notiz.
            </p>
            <pre className="overflow-x-auto rounded-xl bg-surface-2 p-3 text-xs leading-relaxed">{exampleTable(planWeeks[0]?.weekStart ?? prepWeek)}</pre>
            <ul className="list-disc pl-5 text-muted">
              <li>Dauer als „5“, „5,5“, „5:30“, „90 min“; Distanz als „3,8“ oder „3800 m“.</li>
              <li>Leere Zellen bleiben leer – es wird nichts geschätzt oder umgerechnet.</li>
              <li>Unklare Werte werden markiert und nicht übernommen.</li>
            </ul>
            <Button variant="secondary" onClick={() => void downloadTemplate()}>
              Vorlage mit allen Planwochen (CSV)
            </Button>
          </div>
        </Section>
      </Screen>
    );
  }

  if (!table) return null;

  // ───────── Schritt 2: Zuordnung ─────────
  if (step === 'map') {
    const groups = fieldOptions();
    return (
      <Screen title="Spalten zuordnen" subtitle={`${table.rows.length} ${table.rows.length === 1 ? 'Zeile' : 'Zeilen'} aus ${sourceName}`}>
        <Section title="Spalten" aside={`${table.headers.length}`}>
          <ul className="flex flex-col">
            {table.headers.map((h, i) => {
              const m = mapping[i] ?? { field: { kind: 'ignore' as const }, guessed: false };
              const samples = table.rows
                .map((r) => r[i] ?? '')
                .filter((v) => v !== '')
                .slice(0, 3);
              return (
                <li key={i} className="flex flex-col gap-1.5 border-t border-line py-3 first:border-t-0 first:pt-0">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="min-w-0 truncate font-semibold">{h}</span>
                    {m.guessed && m.field.kind !== 'ignore' && <span className="shrink-0 text-xs font-semibold text-warn">vermutet – bitte prüfen</span>}
                  </div>
                  <span className="num truncate text-xs text-muted">{samples.length ? samples.join(' · ') : 'keine Werte'}</span>
                  <select
                    aria-label={`Zuordnung für Spalte ${h}`}
                    value={fieldKey(m.field)}
                    onChange={(e) => setMapping((prev) => prev.map((x, j) => (j === i ? { field: fieldFromKey(e.target.value), guessed: false } : x)))}
                    className={selectClass}
                  >
                    {groups.map((g) => (
                      <optgroup key={g.group} label={g.group}>
                        {g.fields.map((f) => (
                          <option key={fieldKey(f)} value={fieldKey(f)}>
                            {fieldLabel(f)}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </li>
              );
            })}
          </ul>
        </Section>

        <Section title="Leere Zellen">
          <div className="flex flex-col gap-2">
            <Segmented<EmptyCellMode>
              ariaLabel="Leere Zellen"
              value={mode}
              onChange={setMode}
              options={[
                { value: 'replace', label: 'Ziel entfernen' },
                { value: 'keep', label: 'Bisheriges behalten' },
              ]}
            />
            <p className="text-xs text-muted">
              {mode === 'replace'
                ? 'Der Plan übernimmt die Tabelle: Ist eine zugeordnete Zelle leer, wird das bisherige Ziel dieser Woche entfernt.'
                : 'Nur ausgefüllte Zellen ändern den Plan; bei leeren Zellen bleibt das bisherige Ziel stehen.'}{' '}
              Nicht zugeordnete Angaben (Schwerpunkte, Zonenziele, Frischebereich) bleiben immer unverändert.
            </p>
          </div>
        </Section>

        {mappingErrors.length > 0 && (
          <ul className="flex list-disc flex-col gap-1 rounded-2xl border border-danger/40 p-3 pl-8 text-sm text-danger" role="alert">
            {mappingErrors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        )}
        <div className="flex gap-2">
          <Button onClick={() => setStep('preview')} disabled={mappingErrors.length > 0}>
            Vorschau
          </Button>
          <Button variant="ghost" onClick={() => setStep('source')}>
            Zurück
          </Button>
        </div>
      </Screen>
    );
  }

  // ───────── Schritt 3: Vorschau ─────────
  if (!result) return null;
  const skipped = result.issues.filter((i) => i.level === 'skipped');
  const unclear = result.issues.filter((i) => i.level === 'unclear');
  const infos = result.issues.filter((i) => i.level === 'info');
  const unchanged = result.weeks.length - result.changes.length;
  const n = result.changes.length;
  const actions = (
    <div className="flex gap-2">
      <Button onClick={() => void apply()} disabled={n === 0 || busy}>
        {busy ? 'Speichere …' : 'Übernehmen'}
      </Button>
      <Button variant="ghost" onClick={() => setStep('map')}>
        Zurück
      </Button>
    </div>
  );

  return (
    <Screen title="Vorschau" subtitle={`Import aus ${sourceName}`}>
      <Section title="Zusammenfassung">
        <ul className="num flex flex-col gap-1 text-[15px]">
          <li>
            <span className="font-semibold">{n}</span> {n === 1 ? 'Woche ändert' : 'Wochen ändern'} sich
          </li>
          {unchanged > 0 && <li className="text-muted">{unchanged} {unchanged === 1 ? 'Woche' : 'Wochen'} bereits wie in der Tabelle</li>}
          {skipped.length > 0 && <li className="text-warn">{skipped.length} {skipped.length === 1 ? 'Zeile' : 'Zeilen'} nicht übernommen</li>}
          {unclear.length > 0 && <li className="text-warn">{unclear.length} {unclear.length === 1 ? 'unklarer Wert' : 'unklare Werte'} nicht übernommen</li>}
        </ul>
        <p className="mt-2 text-xs text-muted">
          Absolvierte Einheiten bleiben unverändert. Wochen, die nicht in der Tabelle stehen, bleiben wie sie sind. Die Übernahme erscheint im
          Änderungsverlauf und lässt sich dort rückgängig machen.
        </p>
        <div className="mt-3">{actions}</div>
      </Section>

      {(skipped.length > 0 || unclear.length > 0) && (
        <Section title="Nicht übernommen">
          <ul className="flex flex-col gap-2 text-sm">
            {skipped.map((i) => (
              <li key={`s${i.row}`}>
                <span className="font-semibold">{rowLabel(i.row)}:</span> {i.message}
              </li>
            ))}
            {unclear.map((i) => (
              <li key={`u${i.row}-${i.column ?? ''}`}>
                <span className="font-semibold">
                  {rowLabel(i.row)}, {i.column}:
                </span>{' '}
                {i.message} Der bisherige Wert bleibt.
              </li>
            ))}
          </ul>
        </Section>
      )}

      {infos.length > 0 && (
        <Section title="Hinweise">
          <ul className="flex flex-col gap-1 text-sm text-muted">
            {infos.map((i) => (
              <li key={`i${i.row}`}>
                {rowLabel(i.row)}: {i.message}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {n > 0 ? <WeekDiffList changes={result.changes} /> : <p className="rounded-2xl bg-surface p-4 text-sm text-muted">Mit dieser Tabelle ändert sich am Plan nichts.</p>}
      {n > 3 && actions}
    </Screen>
  );
}
