/* Trainingslager: Liste, Hinzufügen, Bearbeiten, Löschen (Profil). Nach Änderungen Nachfrage „Trainingsplan anpassen?“. */
import { useState } from 'react';
import { Button, DecimalInput, Field, Section, TextInput } from './ui';
import { errorText, useLive, useNav, useRepo, useToast } from '../state';
import { saveTrainingCamp, type TrainingCampInput } from '../../data/usecases';
import type { TrainingCamp } from '../../domain/schemas';
import { isEmptyTargets } from '../../domain/plan';
import { campDays, campEffectText, campIssues, campIssueText } from '../../domain/trainingCamp';
import { compareDates, formatDateDe, isLocalDate, startOfWeek, type LocalDate } from '../../domain/calendar';

type Editing = { mode: 'new' } | { mode: 'edit'; camp: TrainingCamp } | null;

export function TrainingCampSettings({ planId, mainRaceDate, today }: { planId: string; mainRaceDate: LocalDate; today: LocalDate }) {
  const camps = useLive((repo) => repo.listTrainingCamps(planId), [planId]);
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
    <Section title="Trainingslager">
      <p className="mb-4 text-sm text-muted">
        Zeiträume mit mehr Zeit zum Trainieren, z. B. eine Woche Radcamp. Der Planer erhöht dort den Umfang – vor allem Rad und Schwimmen, locker – und plant
        danach eine Erholungswoche.
      </p>
      {askAdapt && (
        <div className="mb-4 rounded-2xl border border-line bg-surface-2 p-3" role="status" data-testid="camp-adapt-prompt">
          <p className="font-semibold">Trainingsplan anpassen?</p>
          <p className="mt-1 text-sm text-muted">
            Dein Plan berücksichtigt das Trainingslager noch nicht. Ein neuer Vorschlag zeigt dir vorher genau, welche Wochen sich ändern; vergangene Wochen und deine
            Einheiten bleiben unverändert.
          </p>
          <div className="mt-3 flex gap-2">
            <Button onClick={() => navigate({ name: 'planGenerate' })}>Plan neu vorschlagen</Button>
            <Button variant="ghost" onClick={() => setAskAdapt(false)}>
              Später
            </Button>
          </div>
        </div>
      )}
      {camps === undefined ? null : (
        <ul className="mb-4 flex flex-col gap-2" aria-label="Trainingslager">
          {camps.length === 0 && <li className="text-sm text-muted">Noch kein Trainingslager eingetragen.</li>}
          {camps.map((c) =>
            editing?.mode === 'edit' && editing.camp.id === c.id ? (
              <li key={c.id}>
                <CampForm planId={planId} existing={c} others={camps} mainRaceDate={mainRaceDate} today={today} onDone={done} />
              </li>
            ) : (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => setEditing({ mode: 'edit', camp: c })}
                  className="flex w-full flex-col items-start rounded-2xl bg-surface-2 p-3 text-left"
                  aria-label={`${c.name} bearbeiten`}
                >
                  <span className="font-semibold">⛺ {c.name}</span>
                  <span className="num text-sm text-muted">
                    {formatDateDe(c.startDate, false)} – {formatDateDe(c.endDate, false)} · {campDays(c)} Tage · bis {c.hoursPerDay.toLocaleString('de-DE')}{'\u00a0'}h/Tag
                  </span>
                  {campIssues(c, mainRaceDate, today, camps).map((i) => (
                    <span key={i.code} className="mt-1 text-xs text-warn">
                      {campIssueText(i)}
                    </span>
                  ))}
                </button>
              </li>
            ),
          )}
        </ul>
      )}
      {editing?.mode === 'new' ? (
        <CampForm planId={planId} others={camps ?? []} mainRaceDate={mainRaceDate} today={today} onDone={done} />
      ) : (
        editing === null && (
          <Button
            variant="secondary"
            full
            onClick={() => setEditing({ mode: 'new' })}
          >
            Trainingslager hinzufügen
          </Button>
        )
      )}
    </Section>
  );
}

function CampForm({ planId, existing, others, mainRaceDate, today, onDone }: {
  planId: string;
  existing?: TrainingCamp;
  others: readonly TrainingCamp[];
  mainRaceDate: LocalDate;
  today: LocalDate;
  onDone: (changed: boolean) => void;
}) {
  const repo = useRepo();
  const toast = useToast();
  const [draft, setDraft] = useState<TrainingCampInput>(() =>
    existing
      ? { planId, name: existing.name, startDate: existing.startDate, endDate: existing.endDate, hoursPerDay: existing.hoursPerDay, ...(existing.notes ? { notes: existing.notes } : {}) }
      : { planId, name: '', startDate: '' as LocalDate, endDate: '' as LocalDate, hoursPerDay: 4 },
  );
  const [confirmDelete, setConfirmDelete] = useState(false);
  const datesOk = isLocalDate(draft.startDate) && isLocalDate(draft.endDate) && compareDates(draft.endDate, draft.startDate) >= 0;
  const tooLong = datesOk && campDays(draft) > 28;
  const valid = draft.name.trim() !== '' && datesOk && !tooLong && draft.hoursPerDay >= 0.5 && draft.hoursPerDay <= 8;
  const issues = datesOk ? campIssues({ id: existing?.id ?? '', ...draft }, mainRaceDate, today, others) : [];

  async function save() {
    try {
      await saveTrainingCamp(repo, draft, existing);
      toast(existing ? 'Trainingslager gespeichert' : 'Trainingslager hinzugefügt');
      onDone(true);
    } catch (e) {
      toast(errorText(e), 'error');
    }
  }
  async function remove() {
    if (!existing) return;
    try {
      await repo.deleteTrainingCamp(existing.id);
      toast('Trainingslager gelöscht');
      onDone(true);
    } catch (e) {
      toast(errorText(e), 'error');
    }
  }

  return (
    <form
      className="flex flex-col gap-4 rounded-2xl border border-line p-3"
      aria-label={existing ? 'Trainingslager bearbeiten' : 'Neues Trainingslager'}
      onSubmit={(e) => {
        e.preventDefault();
        if (valid) void save();
      }}
    >
      <Field label="Name">{(id) => <TextInput id={id} value={draft.name} onChange={(v) => setDraft({ ...draft, name: v })} placeholder="z. B. Radcamp Mallorca" />}</Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Von">
          {(id) => (
            <TextInput
              id={id}
              type="date"
              value={draft.startDate}
              onChange={(v) => setDraft({ ...draft, startDate: v as LocalDate, ...(draft.endDate === '' || draft.endDate < v ? { endDate: v as LocalDate } : {}) })}
            />
          )}
        </Field>
        <Field label="Bis">{(id) => <TextInput id={id} type="date" value={draft.endDate} onChange={(v) => setDraft({ ...draft, endDate: v as LocalDate })} />}</Field>
      </div>
      <Field label="Trainingszeit pro Tag" hint="Wie viel Zeit du im Camp pro Tag höchstens trainieren kannst (0,5–8 h).">
        {(id) => <DecimalInput id={id} value={draft.hoursPerDay} onChange={(v) => setDraft({ ...draft, hoursPerDay: v ?? 0 })} suffix="h" />}
      </Field>
      {datesOk && !tooLong && <p className="-mt-2 text-xs text-muted">{campEffectText(draft)}</p>}
      {tooLong && <p className="text-xs text-danger">Höchstens 4 Wochen.</p>}
      {(draft.hoursPerDay < 0.5 || draft.hoursPerDay > 8) && <p className="text-xs text-danger">Bitte 0,5 bis 8 Stunden pro Tag angeben.</p>}
      {issues.map((i) => (
        <p key={i.code} className="text-xs text-warn">
          {campIssueText(i)}
        </p>
      ))}
      <Field label="Notiz (optional)">{(id) => <TextInput id={id} value={draft.notes ?? ''} onChange={(v) => setDraft({ ...draft, notes: v })} />}</Field>
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
              Wirklich löschen
            </Button>
            <Button variant="ghost" onClick={() => setConfirmDelete(false)}>
              Nein
            </Button>
          </div>
        ) : (
          <Button variant="ghost" onClick={() => setConfirmDelete(true)}>
            Trainingslager löschen
          </Button>
        ))}
    </form>
  );
}
