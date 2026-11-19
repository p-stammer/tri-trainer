/* Trainingspause eintragen/bearbeiten. Optionaler Planvorschlag, der bestätigt werden muss. */
import { useState } from 'react';
import { Button, Chip, Field, Loading, Screen, Section, Segmented, TextInput } from '../components/ui';
import { WeekDiffList } from '../components/WeekDiff';
import { errorText, useLive, useNav, useRepo, useToast, useToday } from '../state';
import { applyWeekChanges, savePause, type ActiveContext } from '../../data/usecases';
import type { AppSettings, PainIssue, TrainingPause } from '../../domain/schemas';
import { painIssueTitle, proposePauseAdjustment, type WeekChange } from '../../domain/health';
import { PLANNED_SPORTS, SPORT_LABEL, SPORT_SHORT, type PlannedSport } from '../../domain/sports';
import { compareDates, formatDateDe, isLocalDate } from '../../domain/calendar';

export function PauseForm({ ctx, settings, pauseId, issueId }: { ctx: ActiveContext; settings: AppSettings; pauseId?: string | undefined; issueId?: string | undefined }) {
  const data = useLive(
    async (repo) => ({
      pause: pauseId ? ((await repo.getPause(pauseId)) ?? null) : null,
      issue: issueId ? ((await repo.getPainIssue(issueId)) ?? null) : null,
    }),
    [pauseId, issueId],
  );
  if (!data) return <Loading />;
  if (pauseId && !data.pause) {
    return (
      <Screen title="Pause nicht gefunden" back>
        <p className="text-muted">Diese Pause existiert nicht mehr.</p>
      </Screen>
    );
  }
  return <Form ctx={ctx} settings={settings} existing={data.pause} issue={data.issue} />;
}

function Form({
  ctx,
  settings,
  existing,
  issue,
}: {
  ctx: ActiveContext;
  settings: AppSettings;
  existing: TrainingPause | null;
  issue: PainIssue | null;
}) {
  const repo = useRepo();
  const toast = useToast();
  const { back, navigate } = useNav();
  const today = useToday(settings.timeZone);
  const issueSports = (issue?.sports ?? []).filter((s): s is PlannedSport => (PLANNED_SPORTS as readonly string[]).includes(s));

  const [scope, setScope] = useState<TrainingPause['scope']>(existing?.scope ?? (issueSports.length ? 'sports' : 'all'));
  const [sports, setSports] = useState<PlannedSport[]>(existing?.sports ?? issueSports);
  const [start, setStart] = useState(existing?.startDate ?? today);
  const [end, setEnd] = useState(existing?.endDate ?? '');
  const [reason, setReason] = useState(existing?.reason ?? (issue ? painIssueTitle(issue) : ''));
  const [saved, setSaved] = useState<TrainingPause | null>(null);
  const [proposal, setProposal] = useState<WeekChange[] | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);

  const endValid = end === '' || (isLocalDate(end) && isLocalDate(start) && compareDates(end, start) >= 0);
  const valid = isLocalDate(start) && endValid && (scope === 'all' || sports.length > 0);

  async function save() {
    if (!valid) return;
    setBusy(true);
    try {
      const p = await savePause(
        repo,
        {
          scope,
          sports: scope === 'all' ? [] : sports,
          startDate: start,
          ...(end ? { endDate: end } : {}),
          ...(reason.trim() ? { reason: reason.trim() } : {}),
          ...(existing?.painIssueId ? { painIssueId: existing.painIssueId } : issue ? { painIssueId: issue.id } : {}),
        },
        existing ?? undefined,
      );
      toast(existing ? 'Pause aktualisiert' : 'Pause eingetragen');
      const changes = proposePauseAdjustment(p, ctx.weeks);
      if (changes.length === 0) {
        back();
        return;
      }
      setSaved(p);
      setProposal(changes);
    } catch (e) {
      toast(errorText(e), 'error');
    } finally {
      setBusy(false);
    }
  }

  async function endToday() {
    if (!existing) return;
    try {
      await savePause(repo, { ...stripMeta(existing), endDate: compareDates(today, existing.startDate) >= 0 ? today : existing.startDate }, existing);
      toast('Pause beendet');
      back();
    } catch (e) {
      toast(errorText(e), 'error');
    }
  }

  if (saved && proposal) {
    return (
      <Screen title="Plan anpassen?" back>
        <Section>
          <p className="text-sm">
            Während der Pause vom {formatDateDe(saved.startDate)} bis {formatDateDe(saved.endDate!)} könnten die Wochenziele{' '}
            {saved.scope === 'all' ? 'aller Sportarten' : saved.sports.map((s) => SPORT_LABEL[s]).join(', ')} anteilig zu den pausierten Tagen gekürzt werden.
          </p>
          <p className="mt-2 text-xs text-muted">
            Ausgefallenes Training wird nicht nachgeholt, andere Wochen bleiben unverändert. Der ursprüngliche Plan bleibt gespeichert. Annahme: Der Umfang verteilt sich gleichmäßig über die Woche.
          </p>
        </Section>
        <WeekDiffList changes={proposal} aside={(c) => `${(c as WeekChange).pausedDays} von 7 Tagen pausiert`} />
        <div className="flex flex-col gap-2">
          <Button
            full
            disabled={busy}
            onClick={() => {
              setBusy(true);
              void applyWeekChanges(repo, ctx.plan.id, proposal, 'pause_adjust', `Pause berücksichtigt: ${saved.scope === 'all' ? 'gesamtes Training' : saved.sports.map((x) => SPORT_LABEL[x]).join(', ')}`).then(
                (n) => {
                  toast(`${n} ${n === 1 ? 'Woche' : 'Wochen'} angepasst`);
                  back();
                },
                (e: unknown) => {
                  toast(errorText(e), 'error');
                  setBusy(false);
                },
              );
            }}
          >
            Übernehmen
          </Button>
          <Button variant="secondary" full onClick={() => navigate({ name: 'week', weekStart: proposal[0]!.weekStart })}>
            Manuell bearbeiten
          </Button>
          <Button variant="ghost" full onClick={back}>
            Ablehnen – Plan unverändert lassen
          </Button>
        </div>
      </Screen>
    );
  }

  return (
    <Screen title={existing ? 'Trainingspause' : 'Trainingspause eintragen'} subtitle={issue ? `wegen: ${painIssueTitle(issue)}` : undefined} back>
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <Section>
          <div className="flex flex-col gap-4">
            <Segmented<TrainingPause['scope']>
              ariaLabel="Umfang der Pause"
              value={scope}
              onChange={setScope}
              options={[
                { value: 'sports', label: 'Einzelne Sportarten' },
                { value: 'all', label: 'Gesamtes Training' },
              ]}
            />
            {scope === 'sports' && (
              <div className="flex flex-wrap gap-2">
                {PLANNED_SPORTS.map((s) => (
                  <Chip key={s} active={sports.includes(s)} onClick={() => setSports(sports.includes(s) ? sports.filter((x) => x !== s) : [...sports, s])}>
                    {SPORT_SHORT[s]}
                  </Chip>
                ))}
              </div>
            )}
            <div className="grid grid-cols-2 gap-2">
              <Field label="Ab">{(id) => <TextInput id={id} type="date" value={start} onChange={setStart} />}</Field>
              <Field label="Bis (optional)" error={endValid ? null : 'Ende vor Beginn'}>
                {(id) => <TextInput id={id} type="date" value={end} onChange={setEnd} />}
              </Field>
            </div>
            <Field label="Grund (optional)">{(id) => <TextInput id={id} value={reason} onChange={setReason} />}</Field>
            <p className="text-xs text-muted">
              Mit Enddatum kann die App einen Vorschlag zur Planänderung berechnen. Ohne Enddatum bleibt die Pause offen, bis du sie beendest.
            </p>
          </div>
        </Section>
        <Button type="submit" full disabled={!valid || busy}>
          {existing ? 'Pause speichern' : 'Pause eintragen'}
        </Button>
        {existing && !existing.endDate && (
          <Button variant="secondary" full onClick={() => void endToday()}>
            Pause heute beenden
          </Button>
        )}
        {existing &&
          (confirmDelete ? (
            <div className="flex gap-2">
              <Button
                variant="danger"
                full
                onClick={() =>
                  void repo.deletePause(existing.id).then(() => {
                    toast('Pause gelöscht');
                    back();
                  })
                }
              >
                Endgültig löschen
              </Button>
              <Button variant="secondary" onClick={() => setConfirmDelete(false)}>
                Abbrechen
              </Button>
            </div>
          ) : (
            <Button variant="ghost" onClick={() => setConfirmDelete(true)}>
              <span className="text-danger">Pause löschen</span>
            </Button>
          ))}
      </form>
    </Screen>
  );
}

function stripMeta(p: TrainingPause) {
  const { id: _id, createdAt: _c, updatedAt: _u, ...rest } = p;
  return rest;
}
