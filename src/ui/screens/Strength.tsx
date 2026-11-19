/* Krafttraining: Vorlagen-Bibliothek, Vorlagen-Editor, Workout durchführen. */
import { useEffect, useRef, useState } from 'react';
import { Button, DecimalInput, DurationInput, EmptyState, Field, Loading, Screen, Section, Segmented, TextInput, inputClass } from '../components/ui';
import { ScalePicker } from '../components/ScalePicker';
import { IconChevron, IconTrash } from '../components/icons';
import { errorText, useLive, useNav, useRepo, useToast, useToday } from '../state';
import { deleteWorkout, finishWorkout, logQuickWorkout, saveStrengthTemplate, saveWorkoutProgress, startWorkout } from '../../data/usecases';
import type { AppSettings, StrengthExerciseTemplate, StrengthFocus, StrengthWorkoutLog, StrengthWorkoutTemplate } from '../../domain/schemas';
import { STRENGTH_FOCUSES } from '../../domain/schemas';
import { STRENGTH_FOCUS_LABEL, addSet, describeSets, isQuickWithoutDetails, lastPerformance, normalizeEntryMode, summarizeWorkout, toggleSet, updateExercise, updateSet } from '../../domain/strength';
import { formatDateDe, isLocalDate } from '../../domain/calendar';
import { formatDurationShort, formatNumber } from '../../domain/units';
import { newId } from '../../domain/ids';

// ───────────────────────────── Bibliothek ─────────────────────────────

export function StrengthLibrary({ settings }: { settings: AppSettings }) {
  const repo = useRepo();
  const toast = useToast();
  const { navigate } = useNav();
  const today = useToday(settings.timeZone);
  const data = useLive(async (r) => ({ templates: await r.listStrengthTemplates(), logs: await r.listStrengthLogs() }), []);
  const [quickFor, setQuickFor] = useState<string | null>(null);
  if (!data) return <Loading />;
  const running = data.logs.filter((l) => l.status === 'in_progress');
  const recent = data.logs.filter((l) => l.status === 'completed').slice(0, 10);

  async function start(t: StrengthWorkoutTemplate) {
    try {
      const log = await startWorkout(repo, t, today);
      navigate({ name: 'workout', logId: log.id });
    } catch (e) {
      toast(errorText(e), 'error');
    }
  }

  return (
    <Screen title="Krafttraining" back>
      {running.map((l) => (
        <button
          key={l.id}
          type="button"
          onClick={() => navigate({ name: 'workout', logId: l.id })}
          className="flex items-center gap-3 rounded-3xl border-2 border-strength bg-surface p-4 text-left"
        >
          <span className="flex-1">
            <span className="block font-semibold">{l.name} läuft</span>
            <span className="block text-sm text-muted">
              {formatDateDe(l.date)}, {summarizeWorkout(l).doneSets} von {summarizeWorkout(l).totalSets} Sätzen
            </span>
          </span>
          <span className="font-semibold">Weiter</span>
        </button>
      ))}

      <Section title="Vorlagen" aside={data.templates.length ? `${data.templates.length}` : undefined}>
        {data.templates.length === 0 ? (
          <EmptyState title="Noch keine Vorlage">Lege deine Kraftworkouts einmal an – danach startest du sie mit einem Tipp und hakst Sätze ab.</EmptyState>
        ) : (
          <ul className="flex flex-col gap-3">
            {data.templates.map((t) => (
              <li key={t.id} className="rounded-2xl border border-line p-3">
                <div className="flex items-start gap-2">
                  <div className="flex-1">
                    <p className="font-semibold">{t.name}</p>
                    <p className="text-sm text-muted">
                      {STRENGTH_FOCUS_LABEL[t.focus]}, {t.exercises.length} {t.exercises.length === 1 ? 'Übung' : 'Übungen'}
                      {t.plannedDurationSec ? `, ca. ${formatDurationShort(t.plannedDurationSec)}` : ''}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => navigate({ name: 'template', templateId: t.id })}
                    aria-label={`${t.name} bearbeiten`}
                    className="min-h-10 rounded-full px-3 text-sm font-medium text-muted underline underline-offset-4"
                  >
                    Bearbeiten
                  </button>
                </div>
                {quickFor === t.id ? (
                  <QuickPanel
                    template={t}
                    today={today}
                    onDone={() => setQuickFor(null)}
                    onSave={async (d) => {
                      try {
                        await logQuickWorkout(repo, t, d);
                        toast(`${t.name} abgehakt`);
                        setQuickFor(null);
                      } catch (e) {
                        toast(errorText(e), 'error');
                      }
                    }}
                  />
                ) : (
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <Button onClick={() => setQuickFor(t.id)}>✓ Erledigt</Button>
                    <Button variant="secondary" onClick={() => void start(t)}>
                      Mit Sätzen
                    </Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
        <div className="mt-3">
          <Button variant="secondary" full onClick={() => navigate({ name: 'template' })}>
            Vorlage anlegen
          </Button>
        </div>
      </Section>

      <Section title="Zuletzt absolviert">
        {recent.length === 0 ? (
          <p className="text-sm text-muted">Noch kein abgeschlossenes Workout.</p>
        ) : (
          <ul className="-my-1 flex flex-col">
            {recent.map((l) => {
              const s = summarizeWorkout(l);
              return (
                <li key={l.id}>
                  <button type="button" onClick={() => navigate({ name: 'workout', logId: l.id })} className="flex w-full items-center gap-3 py-2.5 text-left">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold">{l.name}</span>
                      <span className="num block truncate text-sm text-muted">
                        {formatDateDe(l.date)}
                        {isQuickWithoutDetails(l) ? ', abgehakt' : `, ${s.doneSets}/${s.totalSets} Sätze`}
                        {s.skippedExercises ? `, ${s.skippedExercises} übersprungen` : ''}
                      </span>
                    </span>
                    {l.durationSec !== undefined && <span className="num font-semibold">{formatDurationShort(l.durationSec)}</span>}
                    <IconChevron className="h-4 w-4 text-muted" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </Section>
    </Screen>
  );
}

/** Schnell abhaken: Datum, Dauer (aus der Vorlage vorbelegt), optional RPE. */
function QuickPanel({
  template,
  today,
  onSave,
  onDone,
}: {
  template: StrengthWorkoutTemplate;
  today: string;
  onSave: (d: { date: string; durationSec: number; rpe?: number | undefined }) => Promise<void>;
  onDone: () => void;
}) {
  const [date, setDate] = useState(today);
  const [duration, setDuration] = useState<number | undefined>(template.plannedDurationSec);
  const [rpe, setRpe] = useState<number | undefined>(undefined);
  const valid = isLocalDate(date) && duration !== undefined && duration > 0;
  return (
    <div className="mt-3 flex flex-col gap-3 rounded-2xl bg-surface-2 p-3">
      <Field label="Dauer" hint={template.plannedDurationSec ? 'Aus der Vorlage übernommen – bei Bedarf anpassen.' : undefined}>
        {(id) => <DurationInput idPrefix={id} value={duration} onChange={setDuration} />}
      </Field>
      <Field label="Datum">{(id) => <TextInput id={id} type="date" value={date} onChange={setDate} />}</Field>
      <ScalePicker label="Anstrengung (RPE, optional)" max={10} value={rpe} onChange={setRpe} lowLabel="1 sehr leicht" highLabel="10 maximal" />
      <div className="flex gap-2">
        <Button disabled={!valid} onClick={() => void onSave({ date, durationSec: duration ?? 0, rpe })}>
          Abhaken
        </Button>
        <Button variant="ghost" onClick={onDone}>
          Abbrechen
        </Button>
      </div>
    </div>
  );
}

// ───────────────────────────── Vorlagen-Editor ─────────────────────────────

type DraftExercise = Omit<StrengthExerciseTemplate, 'reps' | 'durationSec' | 'weightKg' | 'restSec' | 'targetRpe' | 'targetRir'> & {
  reps?: number | undefined;
  durationSec?: number | undefined;
  weightKg?: number | undefined;
  restSec?: number | undefined;
  targetRpe?: number | undefined;
  targetRir?: number | undefined;
};

function emptyExercise(): DraftExercise {
  return { id: newId(), name: '', sets: 3, mode: 'reps', reps: 10, restSec: 90 };
}

function cleanExercise(e: DraftExercise): StrengthExerciseTemplate {
  const out: StrengthExerciseTemplate = { id: e.id, name: e.name.trim(), sets: e.sets, mode: e.mode };
  if (e.mode === 'reps' && e.reps !== undefined) out.reps = e.reps;
  if (e.mode === 'time' && e.durationSec !== undefined) out.durationSec = e.durationSec;
  if (e.weightKg !== undefined) out.weightKg = e.weightKg;
  if (e.restSec !== undefined) out.restSec = e.restSec;
  if (e.targetRpe !== undefined) out.targetRpe = e.targetRpe;
  if (e.targetRir !== undefined) out.targetRir = e.targetRir;
  if (e.note?.trim()) out.note = e.note.trim();
  return out;
}

export function TemplateEditor({ templateId }: { templateId?: string | undefined }) {
  const existing = useLive(async (r) => (templateId ? ((await r.getStrengthTemplate(templateId)) ?? null) : null), [templateId]);
  if (existing === undefined) return <Loading />;
  if (templateId && !existing) {
    return (
      <Screen title="Vorlage nicht gefunden" back>
        <p className="text-muted">Diese Vorlage existiert nicht mehr.</p>
      </Screen>
    );
  }
  return <TemplateForm existing={existing} />;
}

function TemplateForm({ existing }: { existing: StrengthWorkoutTemplate | null }) {
  const repo = useRepo();
  const toast = useToast();
  const { back } = useNav();
  const [name, setName] = useState(existing?.name ?? '');
  const [focus, setFocus] = useState<StrengthFocus>(existing?.focus ?? 'full_body');
  const [description, setDescription] = useState(existing?.description ?? '');
  const [planned, setPlanned] = useState<number | undefined>(existing?.plannedDurationSec);
  const [exercises, setExercises] = useState<DraftExercise[]>(existing?.exercises.map((e) => ({ ...e })) ?? [emptyExercise()]);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const exerciseErrors = exercises.map((e) =>
    !e.name.trim() ? 'Name fehlt' : e.mode === 'reps' && e.reps === undefined ? 'Wiederholungen fehlen' : e.mode === 'time' && e.durationSec === undefined ? 'Dauer fehlt' : null,
  );
  const valid = name.trim() !== '' && exercises.length > 0 && exerciseErrors.every((x) => x === null);

  const set = (i: number, patch: Partial<DraftExercise>) => setExercises((xs) => xs.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const move = (i: number, d: -1 | 1) =>
    setExercises((xs) => {
      const j = i + d;
      if (j < 0 || j >= xs.length) return xs;
      const next = [...xs];
      [next[i], next[j]] = [next[j]!, next[i]!];
      return next;
    });

  async function save() {
    if (!valid) return;
    try {
      await saveStrengthTemplate(
        repo,
        {
          name: name.trim(),
          focus,
          ...(description.trim() ? { description: description.trim() } : {}),
          ...(planned ? { plannedDurationSec: planned } : {}),
          exercises: exercises.map(cleanExercise),
        },
        existing ?? undefined,
      );
      toast('Vorlage gespeichert');
      back();
    } catch (e) {
      toast(errorText(e), 'error');
    }
  }

  return (
    <Screen title={existing ? 'Vorlage bearbeiten' : 'Neue Vorlage'} back>
      <Section>
        <div className="flex flex-col gap-4">
          <Field label="Name">{(id) => <TextInput id={id} value={name} onChange={setName} placeholder="z. B. Ganzkörper A" />}</Field>
          <div className="flex flex-col gap-4">
            <Field label="Schwerpunkt">
              {(id) => (
                <select id={id} value={focus} onChange={(e) => setFocus(e.target.value as StrengthFocus)} className="min-h-12 w-full rounded-xl border border-line bg-surface-2 px-3">
                  {STRENGTH_FOCUSES.map((f) => (
                    <option key={f} value={f}>
                      {STRENGTH_FOCUS_LABEL[f]}
                    </option>
                  ))}
                </select>
              )}
            </Field>
            <Field label="Geplante Dauer">{(id) => <DurationInput idPrefix={id} value={planned} onChange={setPlanned} />}</Field>
          </div>
          <Field label="Beschreibung (optional)">
            {(id) => <textarea id={id} rows={2} value={description} onChange={(e) => setDescription(e.target.value)} className="w-full rounded-xl border border-line bg-surface-2 p-3" />}
          </Field>
        </div>
      </Section>

      {exercises.map((e, i) => (
        <Section
          key={e.id}
          title={`Übung ${i + 1}`}
          aside={
            <span className="flex gap-1">
              <button type="button" aria-label={`Übung ${i + 1} nach oben`} disabled={i === 0} onClick={() => move(i, -1)} className="h-9 w-9 rounded-full text-ink disabled:opacity-30">
                ↑
              </button>
              <button type="button" aria-label={`Übung ${i + 1} nach unten`} disabled={i === exercises.length - 1} onClick={() => move(i, 1)} className="h-9 w-9 rounded-full text-ink disabled:opacity-30">
                ↓
              </button>
              <button
                type="button"
                aria-label={`Übung ${i + 1} entfernen`}
                disabled={exercises.length === 1}
                onClick={() => setExercises((xs) => xs.filter((_, j) => j !== i))}
                className="flex h-9 w-9 items-center justify-center rounded-full text-muted disabled:opacity-30"
              >
                <IconTrash className="h-4 w-4" />
              </button>
            </span>
          }
        >
          <div className="flex flex-col gap-3">
            <input aria-label={`Name Übung ${i + 1}`} value={e.name} placeholder="Übungsname" onChange={(ev) => set(i, { name: ev.target.value })} className={inputClass} />
            <Segmented<'reps' | 'time'>
              ariaLabel={`Art Übung ${i + 1}`}
              value={e.mode}
              onChange={(v) => set(i, { mode: v, ...(v === 'time' && e.durationSec === undefined ? { durationSec: 45 } : {}) })}
              options={[
                { value: 'reps', label: 'Wiederholungen' },
                { value: 'time', label: 'Zeit' },
              ]}
            />
            <div className="grid grid-cols-3 gap-2">
              <Field label="Sätze">{(id) => <DecimalInput id={id} integer value={e.sets} onChange={(v) => set(i, { sets: Math.max(1, Math.min(20, v ?? 1)) })} />}</Field>
              {e.mode === 'reps' ? (
                <Field label="Wdh.">{(id) => <DecimalInput id={id} integer value={e.reps} onChange={(v) => set(i, { reps: v })} />}</Field>
              ) : (
                <Field label="Sekunden">{(id) => <DecimalInput id={id} integer value={e.durationSec} onChange={(v) => set(i, { durationSec: v })} />}</Field>
              )}
              <Field label="Gewicht">{(id) => <DecimalInput id={id} value={e.weightKg} suffix="kg" onChange={(v) => set(i, { weightKg: v })} />}</Field>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <Field label="Pause">{(id) => <DecimalInput id={id} integer value={e.restSec} suffix="s" onChange={(v) => set(i, { restSec: v })} />}</Field>
              <Field label="RPE">{(id) => <DecimalInput id={id} value={e.targetRpe} placeholder="opt." onChange={(v) => set(i, { targetRpe: v === undefined ? undefined : Math.max(1, Math.min(10, v)) })} />}</Field>
              <Field label="RIR">{(id) => <DecimalInput id={id} integer value={e.targetRir} placeholder="opt." onChange={(v) => set(i, { targetRir: v === undefined ? undefined : Math.max(0, Math.min(10, v)) })} />}</Field>
            </div>
            <input aria-label={`Notiz Übung ${i + 1}`} value={e.note ?? ''} placeholder="Notiz, z. B. Ausführung" onChange={(ev) => set(i, { note: ev.target.value })} className={inputClass} />
            {exerciseErrors[i] && <p className="text-sm text-danger">{exerciseErrors[i]}</p>}
          </div>
        </Section>
      ))}

      <Button variant="secondary" full onClick={() => setExercises((xs) => [...xs, emptyExercise()])}>
        Übung hinzufügen
      </Button>
      <Button full disabled={!valid} onClick={() => void save()}>
        Vorlage speichern
      </Button>
      <p className="px-2 text-center text-xs text-muted">Änderungen an der Vorlage verändern keine bereits absolvierten Workouts.</p>
      {existing &&
        (confirmDelete ? (
          <div className="flex gap-2">
            <Button
              variant="danger"
              full
              onClick={() =>
                void repo.deleteStrengthTemplate(existing.id).then(() => {
                  toast('Vorlage gelöscht');
                  back();
                })
              }
            >
              Vorlage löschen
            </Button>
            <Button variant="secondary" onClick={() => setConfirmDelete(false)}>
              Abbrechen
            </Button>
          </div>
        ) : (
          <Button variant="ghost" onClick={() => setConfirmDelete(true)}>
            <span className="text-danger">Vorlage löschen</span>
          </Button>
        ))}
    </Screen>
  );
}

// ───────────────────────────── Workout durchführen ─────────────────────────────

export function WorkoutScreen({ logId }: { logId: string }) {
  const data = useLive(async (r) => ({ log: (await r.getStrengthLog(logId)) ?? null, logs: await r.listStrengthLogs() }), [logId]);
  if (!data) return <Loading />;
  if (!data.log) {
    return (
      <Screen title="Workout nicht gefunden" back>
        <p className="text-muted">Dieses Workout existiert nicht mehr.</p>
      </Screen>
    );
  }
  return <WorkoutRun key={data.log.id} initial={data.log} allLogs={data.logs} />;
}

function useElapsed(startedAt: string, active: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const t = window.setInterval(() => setNow(Date.now()), 15_000);
    return () => window.clearInterval(t);
  }, [active]);
  return Math.max(0, Math.round((now - Date.parse(startedAt)) / 1000));
}

function WorkoutRun({ initial, allLogs }: { initial: StrengthWorkoutLog; allLogs: StrengthWorkoutLog[] }) {
  const repo = useRepo();
  const toast = useToast();
  const { back } = useNav();
  const [log, setLog] = useState(initial);
  const running = log.status === 'in_progress';
  const elapsed = useElapsed(log.startedAt, running);
  const [finishing, setFinishing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const firstRender = useRef(true);

  // Fortschritt sofort speichern (bleibt beim Schließen der App erhalten)
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    saveWorkoutProgress(repo, normalizeEntryMode(log)).catch((e: unknown) => toast(errorText(e), 'error'));
  }, [log, repo, toast]);

  const summary = summarizeWorkout(log);

  return (
    <Screen
      title={log.name}
      subtitle={
        <span className="num">
          {formatDateDe(log.date)}
          {running ? `, läuft seit ${formatDurationShort(elapsed)}` : log.durationSec !== undefined ? `, ${formatDurationShort(log.durationSec)}` : ''}
        </span>
      }
      back
    >
      {isQuickWithoutDetails(log) && (
        <p className="rounded-2xl bg-surface p-3 text-sm text-muted">Als erledigt abgehakt, ohne Satzdetails. Du kannst Sätze und Gewichte unten optional ergänzen.</p>
      )}
      <div className="num flex gap-2 text-sm">
        <span className="rounded-full bg-surface px-3 py-1.5">
          {summary.doneSets}/{summary.totalSets} Sätze
        </span>
        {summary.volumeKg > 0 && <span className="rounded-full bg-surface px-3 py-1.5">{formatNumber(summary.volumeKg, 0)} kg bewegt</span>}
        {summary.skippedExercises > 0 && <span className="rounded-full bg-surface px-3 py-1.5">{summary.skippedExercises} übersprungen</span>}
      </div>

      {log.exercises.map((e, ei) => {
        const last = lastPerformance(allLogs, e.name, log.id);
        const target = describeSets(
          e.sets.map((s) => {
            const t: { reps?: number; durationSec?: number; weightKg?: number } = {};
            if (s.targetReps !== undefined) t.reps = s.targetReps;
            if (s.targetDurationSec !== undefined) t.durationSec = s.targetDurationSec;
            if (s.targetWeightKg !== undefined) t.weightKg = s.targetWeightKg;
            return t;
          }),
          e.mode,
        );
        return (
          <Section key={ei} className={e.skipped ? 'opacity-60' : ''}>
            <div className="flex items-start gap-2">
              <div className="flex-1">
                <h2 className="text-[17px] font-semibold">{e.name}</h2>
                <p className="num text-sm text-muted">
                  Vorgabe {target}
                  {e.restSec ? `, Pause ${e.restSec} s` : ''}
                  {e.targetRpe !== undefined ? `, RPE ${e.targetRpe}` : ''}
                  {e.targetRir !== undefined ? `, RIR ${e.targetRir}` : ''}
                </p>
                {last && (
                  <p className="num text-xs text-muted">
                    Zuletzt ({formatDateDe(last.date, false)}): {describeSets(last.sets, e.mode)}
                  </p>
                )}
                {e.templateNote && <p className="mt-1 text-xs italic text-muted">{e.templateNote}</p>}
              </div>
              <button
                type="button"
                aria-pressed={e.skipped}
                onClick={() => setLog((l) => updateExercise(l, ei, (x) => ({ ...x, skipped: !x.skipped })))}
                className="min-h-10 rounded-full border border-line px-3 text-sm"
              >
                {e.skipped ? 'Doch machen' : 'Überspringen'}
              </button>
            </div>

            {!e.skipped && (
              <>
                <div className="mt-3 grid grid-cols-[44px_1fr_1fr] items-center gap-2 text-xs text-muted">
                  <span />
                  <span>{e.mode === 'reps' ? 'Wiederholungen' : 'Sekunden'}</span>
                  <span>Gewicht</span>
                </div>
                <ul className="mt-1 flex flex-col gap-2">
                  {e.sets.map((s, si) => (
                    <li key={si} className="grid grid-cols-[44px_1fr_1fr] items-center gap-2">
                      <button
                        type="button"
                        role="checkbox"
                        aria-checked={s.done}
                        aria-label={`${e.name} Satz ${si + 1} erledigt`}
                        onClick={() => setLog((l) => updateSet(l, ei, si, toggleSet))}
                        className={`flex h-11 w-11 items-center justify-center rounded-full border-2 text-[15px] font-bold ${s.done ? 'border-strength bg-strength text-white' : 'border-line text-muted'}`}
                      >
                        {s.done ? '✓' : si + 1}
                      </button>
                      <DecimalInput
                        ariaLabel={`${e.name} Satz ${si + 1} ${e.mode === 'reps' ? 'Wiederholungen' : 'Sekunden'}`}
                        integer
                        value={e.mode === 'reps' ? s.reps : s.durationSec}
                        placeholder={String((e.mode === 'reps' ? s.targetReps : s.targetDurationSec) ?? '')}
                        onChange={(v) =>
                          setLog((l) =>
                            updateSet(l, ei, si, (x) => {
                              const n = { ...x };
                              if (e.mode === 'reps') {
                                delete n.reps;
                                if (v !== undefined) n.reps = v;
                              } else {
                                delete n.durationSec;
                                if (v !== undefined) n.durationSec = v;
                              }
                              return n;
                            }),
                          )
                        }
                      />
                      <DecimalInput
                        ariaLabel={`${e.name} Satz ${si + 1} Gewicht`}
                        value={s.weightKg}
                        suffix="kg"
                        placeholder={s.targetWeightKg !== undefined ? String(s.targetWeightKg).replace('.', ',') : ''}
                        onChange={(v) =>
                          setLog((l) =>
                            updateSet(l, ei, si, (x) => {
                              const n = { ...x };
                              delete n.weightKg;
                              if (v !== undefined) n.weightKg = v;
                              return n;
                            }),
                          )
                        }
                      />
                    </li>
                  ))}
                </ul>
                <div className="mt-2 flex items-center gap-2">
                  <Button variant="ghost" onClick={() => setLog((l) => addSet(l, ei))}>
                    + Satz
                  </Button>
                  <input
                    aria-label={`Notiz ${e.name}`}
                    value={e.note ?? ''}
                    placeholder="Notiz zur Übung"
                    onChange={(ev) =>
                      setLog((l) =>
                        updateExercise(l, ei, (x) => {
                          const n = { ...x };
                          delete n.note;
                          if (ev.target.value) n.note = ev.target.value;
                          return n;
                        }),
                      )
                    }
                    className="min-h-10 min-w-0 flex-1 rounded-xl border border-line bg-surface-2 px-3"
                  />
                </div>
              </>
            )}
          </Section>
        );
      })}

      {finishing ? (
        <FinishPanel
          log={log}
          suggestedSec={running ? Math.max(60, Math.round(elapsed / 60) * 60) : (log.durationSec ?? 0)}
          onCancel={() => setFinishing(false)}
          onSave={async (details) => {
            try {
              const saved = await finishWorkout(repo, normalizeEntryMode({ ...log, date: details.date }), details);
              toast(running ? 'Workout abgeschlossen' : 'Änderungen gespeichert');
              setLog(saved);
              setFinishing(false);
              if (running) back();
            } catch (e) {
              toast(errorText(e), 'error');
            }
          }}
        />
      ) : (
        <Button full onClick={() => setFinishing(true)}>
          {running ? 'Workout abschließen' : 'Dauer, RPE und Notiz bearbeiten'}
        </Button>
      )}

      {confirmDelete ? (
        <div className="flex gap-2">
          <Button
            variant="danger"
            full
            onClick={() =>
              void deleteWorkout(repo, log).then(() => {
                toast(running ? 'Workout verworfen' : 'Workout gelöscht');
                back();
              })
            }
          >
            {running ? 'Verwerfen' : 'Endgültig löschen'}
          </Button>
          <Button variant="secondary" onClick={() => setConfirmDelete(false)}>
            Abbrechen
          </Button>
        </div>
      ) : (
        <Button variant="ghost" onClick={() => setConfirmDelete(true)}>
          <span className="text-danger">{running ? 'Workout verwerfen' : 'Workout löschen'}</span>
        </Button>
      )}
      {!running && <p className="px-2 text-center text-xs text-muted">Das Workout zählt als Krafteinheit in deinen Wochenzielen und erscheint im Verlauf.</p>}
    </Screen>
  );
}

function FinishPanel({
  log,
  suggestedSec,
  onCancel,
  onSave,
}: {
  log: StrengthWorkoutLog;
  suggestedSec: number;
  onCancel: () => void;
  onSave: (d: { date: string; durationSec: number; rpe?: number | undefined; note?: string | undefined }) => Promise<void>;
}) {
  const [date, setDate] = useState(log.date);
  const [duration, setDuration] = useState<number | undefined>(log.durationSec ?? suggestedSec);
  const [rpe, setRpe] = useState<number | undefined>(log.rpe);
  const [note, setNote] = useState(log.note ?? '');
  const valid = isLocalDate(date) && duration !== undefined && duration > 0;
  return (
    <Section title={log.status === 'in_progress' ? 'Workout abschließen' : 'Workout bearbeiten'}>
      <div className="flex flex-col gap-4">
        <Field label="Dauer" hint={log.status === 'in_progress' ? 'Vorgeschlagen aus der Zeit seit dem Start – bitte prüfen.' : undefined}>
          {(id) => <DurationInput idPrefix={id} value={duration} onChange={setDuration} />}
        </Field>
        <ScalePicker label="Anstrengung (Session-RPE, optional)" max={10} value={rpe} onChange={setRpe} lowLabel="1 sehr leicht" highLabel="10 maximal" />
        <Field label="Notiz">{(id) => <TextInput id={id} value={note} onChange={setNote} />}</Field>
        <Field label="Datum">{(id) => <TextInput id={id} type="date" value={date} onChange={setDate} />}</Field>
        <div className="flex gap-2">
          <Button disabled={!valid} onClick={() => void onSave({ date, durationSec: duration ?? 0, rpe, note: note.trim() || undefined })}>
            Speichern
          </Button>
          <Button variant="ghost" onClick={onCancel}>
            Abbrechen
          </Button>
        </div>
      </div>
    </Section>
  );
}
