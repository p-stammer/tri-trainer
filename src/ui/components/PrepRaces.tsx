/* Vorbereitungswettkämpfe: Liste, Hinzufügen, Bearbeiten, Löschen (Profil und Einstellungen). */
import { useState } from 'react';
import { Button, DecimalInput, Field, Section, Segmented, TextInput } from './ui';
import { errorText, useLive, useNav, useRepo, useToast } from '../state';
import { savePrepRace, type PrepRaceInput } from '../../data/usecases';
import { PREP_RACE_KINDS, type PrepRace, type PrepRaceKind, type PrepRacePriority } from '../../domain/schemas';
import { isEmptyTargets } from '../../domain/plan';
import { PREP_RACE_KIND_LABEL, PREP_RACE_PRIORITY_HINT, PREP_RACE_PRIORITY_LABEL, PREP_RACE_PRESETS, PREP_RACE_SIZE_LABEL, prepRaceIssues, prepRaceIssueText, prepRaceSize } from '../../domain/prepRace';
import { compareDates, formatDateDe, isLocalDate, startOfWeek, type LocalDate } from '../../domain/calendar';
import { formatDistance, kmToMeters } from '../../domain/units';

type Editing = { mode: 'new' } | { mode: 'edit'; race: PrepRace } | null;

export function PrepRaceSettings({ planId, mainRaceDate, today }: { planId: string; mainRaceDate: LocalDate; today: LocalDate }) {
  const races = useLive((repo) => repo.listPrepRaces(planId), [planId]);
  const hasFuturePlan = useLive(
    async (repo) => (await repo.listWeeks(planId)).some((w) => compareDates(w.weekStart, startOfWeek(today)) >= 0 && !isEmptyTargets(w.current)),
    [planId, today],
  );
  const [editing, setEditing] = useState<Editing>(null);
  const [askAdapt, setAskAdapt] = useState(false);
  const { navigate } = useNav();
  const done = (changed: boolean) => {
    setEditing(null);
    if (changed && hasFuturePlan) setAskAdapt(true);
  };

  return (
    <Section title="Vorbereitungswettkämpfe">
      <p className="mb-4 text-sm text-muted">
        Rennen vor dem Hauptwettkampf, z. B. ein Halbmarathon oder eine olympische Distanz. Künftige Planvorschläge berücksichtigen sie mit weniger Umfang davor und danach. Termine kannst du jederzeit ändern.
      </p>
      {askAdapt && (
        <div className="mb-4 rounded-2xl border border-line bg-surface-2 p-3" role="status">
          <p className="font-semibold">Trainingsplan anpassen?</p>
          <p className="mt-1 text-sm text-muted">Dein Plan berücksichtigt diese Änderung noch nicht. Ein neuer Vorschlag zeigt dir vorher genau, welche Wochen sich ändern; vergangene Wochen und deine Einheiten bleiben unverändert.</p>
          <div className="mt-3 flex gap-2">
            <Button onClick={() => navigate({ name: 'planGenerate' })}>Plan neu vorschlagen</Button>
            <Button variant="ghost" onClick={() => setAskAdapt(false)}>
              Später
            </Button>
          </div>
        </div>
      )}
      {races === undefined ? null : (
        <ul className="mb-4 flex flex-col gap-2" aria-label="Vorbereitungswettkämpfe">
          {races.length === 0 && <li className="text-sm text-muted">Noch keine Vorbereitungswettkämpfe eingetragen.</li>}
          {races.map((r) =>
            editing?.mode === 'edit' && editing.race.id === r.id ? (
              <li key={r.id}>
                <PrepRaceForm planId={planId} existing={r} others={races} mainRaceDate={mainRaceDate} today={today} onDone={done} />
              </li>
            ) : (
              <li key={r.id}>
                <button
                  type="button"
                  onClick={() => setEditing({ mode: 'edit', race: r })}
                  className="flex w-full flex-col items-start rounded-2xl bg-surface-2 p-3 text-left"
                  aria-label={`${r.name} bearbeiten`}
                >
                  <span className="font-semibold">{r.name}</span>
                  <span className="num text-sm text-muted">
                    {formatDateDe(r.date)} · {PREP_RACE_KIND_LABEL[r.kind]} · {distanceSummary(r)} · {PREP_RACE_PRIORITY_LABEL[r.priority ?? 'low']}
                  </span>
                  {prepRaceIssues(r, mainRaceDate, today, races).map((i) => (
                    <span key={i.code} className="mt-1 text-xs text-warn">
                      {prepRaceIssueText(i)}
                    </span>
                  ))}
                </button>
              </li>
            ),
          )}
        </ul>
      )}
      {editing?.mode === 'new' ? (
        <PrepRaceForm planId={planId} others={races ?? []} mainRaceDate={mainRaceDate} today={today} onDone={done} />
      ) : (
        editing === null && (
          <Button variant="secondary" full onClick={() => { setAskAdapt(false); setEditing({ mode: 'new' }); }}>
            Vorbereitungswettkampf hinzufügen
          </Button>
        )
      )}
    </Section>
  );
}

function distanceSummary(r: Pick<PrepRace, 'swimM' | 'bikeM' | 'runM'>): string {
  const parts: string[] = [];
  if (r.swimM) parts.push(`${formatDistance(r.swimM, 'auto-swim')} Schwimmen`);
  if (r.bikeM) parts.push(`${formatDistance(r.bikeM)} Rad`);
  if (r.runM) parts.push(`${formatDistance(r.runM)} Laufen`);
  return parts.length ? parts.join(', ') : 'ohne Distanz';
}

function PrepRaceForm({ planId, existing, others, mainRaceDate, today, onDone }: {
  planId: string;
  existing?: PrepRace;
  others: readonly PrepRace[];
  mainRaceDate: LocalDate;
  today: LocalDate;
  onDone: (changed: boolean) => void;
}) {
  const repo = useRepo();
  const toast = useToast();
  const [draft, setDraft] = useState<PrepRaceInput>(() =>
    existing ? stripMeta(existing) : { planId, name: '', date: '' as LocalDate, kind: 'run', priority: 'low' },
  );
  const [confirmDelete, setConfirmDelete] = useState(false);
  const hasDistance = (draft.swimM ?? 0) + (draft.bikeM ?? 0) + (draft.runM ?? 0) > 0;
  const valid = draft.name.trim() !== '' && isLocalDate(draft.date) && (draft.kind === 'other' || hasDistance);
  const issues = isLocalDate(draft.date) ? prepRaceIssues({ id: existing?.id ?? '', date: draft.date }, mainRaceDate, today, others) : [];

  function applyPreset(key: string) {
    const p = PREP_RACE_PRESETS[key];
    if (!p) return;
    const next: PrepRaceInput = { ...draft, kind: p.kind, name: draft.name.trim() === '' ? p.label : draft.name };
    delete next.swimM;
    delete next.bikeM;
    delete next.runM;
    if (p.swimM) next.swimM = p.swimM;
    if (p.bikeM) next.bikeM = p.bikeM;
    if (p.runM) next.runM = p.runM;
    setDraft(next);
  }

  function setDistance(key: 'swimM' | 'bikeM' | 'runM', km: number | undefined) {
    const next = { ...draft };
    delete next[key];
    if (km !== undefined && km > 0) next[key] = kmToMeters(km);
    setDraft(next);
  }

  async function save() {
    try {
      await savePrepRace(repo, draft, existing);
      toast(existing ? 'Vorbereitungswettkampf gespeichert' : 'Vorbereitungswettkampf hinzugefügt');
      onDone(true);
    } catch (e) {
      toast(errorText(e), 'error');
    }
  }

  async function remove() {
    if (!existing) return;
    try {
      await repo.deletePrepRace(existing.id);
      toast('Vorbereitungswettkampf gelöscht');
      onDone(true);
    } catch (e) {
      toast(errorText(e), 'error');
    }
  }

  const showSwim = draft.kind === 'triathlon' || draft.kind === 'swim' || draft.kind === 'other';
  const showBike = draft.kind === 'triathlon' || draft.kind === 'bike' || draft.kind === 'other';
  const showRun = draft.kind === 'triathlon' || draft.kind === 'run' || draft.kind === 'other';

  return (
    <form
      className="flex flex-col gap-4 rounded-2xl border border-line p-3"
      aria-label={existing ? 'Vorbereitungswettkampf bearbeiten' : 'Neuer Vorbereitungswettkampf'}
      onSubmit={(e) => {
        e.preventDefault();
        if (valid) void save();
      }}
    >
      {!existing && (
        <Field label="Vorlage (optional)">
          {(id) => (
            <select id={id} value="" onChange={(e) => applyPreset(e.target.value)} className="min-h-12 w-full rounded-xl border border-line bg-surface-2 px-3">
              <option value="">Vorlage wählen …</option>
              {Object.entries(PREP_RACE_PRESETS).map(([k, p]) => (
                <option key={k} value={k}>
                  {p.label}
                </option>
              ))}
            </select>
          )}
        </Field>
      )}
      <Field label="Name">{(id) => <TextInput id={id} value={draft.name} onChange={(v) => setDraft({ ...draft, name: v })} placeholder="z. B. Halbmarathon Köln" />}</Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Datum">{(id) => <TextInput id={id} type="date" value={draft.date} onChange={(v) => setDraft({ ...draft, date: v as LocalDate })} />}</Field>
        <Field label="Art">
          {(id) => (
            <select
              id={id}
              value={draft.kind}
              onChange={(e) => setDraft({ ...draft, kind: e.target.value as PrepRaceKind })}
              className="min-h-12 w-full rounded-xl border border-line bg-surface-2 px-3"
            >
              {PREP_RACE_KINDS.map((k) => (
                <option key={k} value={k}>
                  {PREP_RACE_KIND_LABEL[k]}
                </option>
              ))}
            </select>
          )}
        </Field>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {showSwim && <Field label="Schwimmen">{(id) => <DecimalInput id={id} value={km(draft.swimM)} suffix="km" onChange={(v) => setDistance('swimM', v)} />}</Field>}
        {showBike && <Field label="Rad">{(id) => <DecimalInput id={id} value={km(draft.bikeM)} suffix="km" onChange={(v) => setDistance('bikeM', v)} />}</Field>}
        {showRun && <Field label="Laufen">{(id) => <DecimalInput id={id} value={km(draft.runM)} suffix="km" onChange={(v) => setDistance('runM', v)} />}</Field>}
      </div>
      {draft.kind !== 'other' && !hasDistance && <p className="text-xs text-muted">Bitte mindestens eine Distanz angeben.</p>}
      <Field label="Wichtigkeit">
        {() => (
          <Segmented
            ariaLabel="Wichtigkeit"
            value={draft.priority ?? 'low'}
            onChange={(v: PrepRacePriority) => setDraft({ ...draft, priority: v })}
            options={[
              { value: 'low', label: 'Training' },
              { value: 'medium', label: 'Wichtig' },
              { value: 'high', label: 'Höhepunkt' },
            ]}
          />
        )}
      </Field>
      <p className="-mt-2 text-xs text-muted">
        {PREP_RACE_PRIORITY_HINT[draft.priority ?? 'low']}
        {hasDistance ? ` Distanz: ${PREP_RACE_SIZE_LABEL[prepRaceSize(draft)]}.` : ''}
      </p>
      {issues.map((i) => (
        <p key={i.code} className="text-xs text-warn">
          {prepRaceIssueText(i)}
        </p>
      ))}
      <Field label="Notiz (optional)">
        {(id) => <TextInput id={id} value={draft.notes ?? ''} onChange={(v) => setDraft({ ...draft, notes: v })} />}
      </Field>
      <div className="flex gap-2">
        <Button type="submit" full disabled={!valid}>
          Speichern
        </Button>
        <Button variant="secondary" onClick={() => onDone(false)}>
          Abbrechen
        </Button>
      </div>
      {existing &&
        (confirmDelete ? (
          <div className="flex gap-2">
            <Button variant="danger" full onClick={() => void remove()}>
              Endgültig löschen
            </Button>
            <Button variant="secondary" onClick={() => setConfirmDelete(false)}>
              Abbrechen
            </Button>
          </div>
        ) : (
          <Button variant="ghost" onClick={() => setConfirmDelete(true)}>
            <span className="text-danger">Löschen</span>
          </Button>
        ))}
    </form>
  );
}

function km(m: number | undefined): number | undefined {
  return m === undefined ? undefined : m / 1000;
}

function stripMeta(r: PrepRace): PrepRaceInput {
  const { id: _id, createdAt: _c, updatedAt: _u, ...rest } = r;
  return rest;
}
