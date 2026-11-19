/* Beschwerden: erfassen, Verlauf ansehen, Einträge ergänzen. Keine Diagnosen. */
import { useState } from 'react';
import { Button, Chip, Field, Loading, Screen, Section, Segmented, TextInput } from '../components/ui';
import { ScalePicker } from '../components/ScalePicker';
import { SPORT_TEXT_CLASS, SportIcon, IconTrash } from '../components/icons';
import { errorText, useLive, useNav, useRepo, useToast, useToday } from '../state';
import { addPainObservation, createPainIssue, setPainStatus } from '../../data/usecases';
import type { AppSettings, BodyRegion, PainIssue, PainObservation, CompletedActivity } from '../../domain/schemas';
import { BODY_REGIONS } from '../../domain/schemas';
import { BODY_REGION_LABEL, PAIN_STATUS_LABEL, painIssueTitle, summarizeIssue } from '../../domain/health';
import { PLANNED_SPORTS, SPORT_LABEL, SPORT_SHORT, type Sport } from '../../domain/sports';
import { compareDates, formatDateDe, formatDayMonthDe, formatWeekdayDayMonthDe, isLocalDate, isoWeek, startOfWeek } from '../../domain/calendar';
import { formatDurationShort } from '../../domain/units';

const DISCLAIMER =
  'Die App stellt keine Diagnosen und gibt keine Trainingsfreigaben. Anhaltende, starke oder ungewöhnliche Beschwerden bitte ärztlich bzw. physiotherapeutisch abklären lassen.';

type Side = NonNullable<PainIssue['side']> | 'none';

export function PainScreen({ settings, issueId }: { settings: AppSettings; issueId?: string | undefined }) {
  return issueId ? <PainDetail settings={settings} issueId={issueId} /> : <PainNew settings={settings} />;
}

function PainNew({ settings }: { settings: AppSettings }) {
  const repo = useRepo();
  const toast = useToast();
  const { replace } = useNav();
  const today = useToday(settings.timeZone);
  const [region, setRegion] = useState<BodyRegion | ''>('');
  const [side, setSide] = useState<Side>('none');
  const [pain, setPain] = useState<number | undefined>(undefined);
  const [date, setDate] = useState(today);
  const [sports, setSports] = useState<Sport[]>([]);
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);

  const valid = region !== '' && pain !== undefined && isLocalDate(date) && (region !== 'other' || description.trim() !== '');

  async function save() {
    if (!valid || pain === undefined) return;
    setBusy(true);
    try {
      const issue = await createPainIssue(
        repo,
        {
          region,
          ...(side !== 'none' ? { side } : {}),
          ...(description.trim() ? { description: description.trim() } : {}),
          sports,
          status: 'active',
          startDate: date,
        },
        { date, pain },
      );
      toast('Beschwerde gespeichert');
      replace({ name: 'pain', issueId: issue.id });
    } catch (e) {
      toast(errorText(e), 'error');
      setBusy(false);
    }
  }

  return (
    <Screen title="Beschwerde erfassen" back>
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <Section>
          <div className="flex flex-col gap-4">
            <Field label="Körperstelle">
              {(id) => (
                <select id={id} value={region} onChange={(e) => setRegion(e.target.value as BodyRegion | '')} className="min-h-12 w-full rounded-xl border border-line bg-surface-2 px-3">
                  <option value="">Bitte wählen</option>
                  {BODY_REGIONS.map((r) => (
                    <option key={r} value={r}>
                      {BODY_REGION_LABEL[r]}
                    </option>
                  ))}
                </select>
              )}
            </Field>
            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-muted">Seite</span>
              <Segmented<Side>
                ariaLabel="Seite"
                value={side}
                onChange={setSide}
                options={[
                  { value: 'none', label: 'keine' },
                  { value: 'left', label: 'links' },
                  { value: 'right', label: 'rechts' },
                  { value: 'both', label: 'beide' },
                ]}
              />
            </div>
            <ScalePicker label="Schmerzstärke heute" min={0} max={10} value={pain} onChange={setPain} lowLabel="0 keine" highLabel="10 stärkste" optional={false} />
            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-muted">Betroffene Sportarten</span>
              <div className="flex flex-wrap gap-2">
                {PLANNED_SPORTS.map((s) => (
                  <Chip key={s} active={sports.includes(s)} onClick={() => setSports(sports.includes(s) ? sports.filter((x) => x !== s) : [...sports, s])}>
                    {SPORT_SHORT[s]}
                  </Chip>
                ))}
              </div>
            </div>
            <Field label={region === 'other' ? 'Körperstelle und Beschreibung' : 'Beschreibung (optional)'} hint="z. B. wann es auftritt, wie es sich anfühlt">
              {(id) => <textarea id={id} rows={3} value={description} onChange={(e) => setDescription(e.target.value)} className="w-full rounded-xl border border-line bg-surface-2 p-3" />}
            </Field>
            <Field label="Seit">{(id) => <TextInput id={id} type="date" value={date} onChange={setDate} />}</Field>
          </div>
        </Section>
        <Button type="submit" full disabled={!valid || busy}>
          Beschwerde speichern
        </Button>
        <p className="px-2 text-center text-xs text-muted">{DISCLAIMER}</p>
      </form>
    </Screen>
  );
}

function PainDetail({ settings, issueId }: { settings: AppSettings; issueId: string }) {
  const data = useLive(
    async (repo) => ({
      issue: (await repo.getPainIssue(issueId)) ?? null,
      observations: await repo.listPainObservations(),
      activities: await repo.listActivities(),
    }),
    [issueId],
  );
  if (!data) return <Loading />;
  if (!data.issue) {
    return (
      <Screen title="Beschwerde nicht gefunden" back>
        <p className="text-muted">Diese Beschwerde existiert nicht mehr.</p>
      </Screen>
    );
  }
  return <Detail settings={settings} issue={data.issue} observations={data.observations} activities={data.activities} />;
}

function Detail({ settings, issue, observations, activities }: { settings: AppSettings; issue: PainIssue; observations: PainObservation[]; activities: CompletedActivity[] }) {
  const repo = useRepo();
  const toast = useToast();
  const { navigate, back } = useNav();
  const today = useToday(settings.timeZone);
  const summary = summarizeIssue(issue, observations);
  const [pain, setPain] = useState<number | undefined>(undefined);
  const [date, setDate] = useState(today);
  const [note, setNote] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function addEntry() {
    if (pain === undefined || !isLocalDate(date)) return;
    try {
      await addPainObservation(repo, issue, { date, pain, ...(note.trim() ? { note: note.trim() } : {}) });
      setPain(undefined);
      setNote('');
      toast('Eintrag gespeichert');
    } catch (e) {
      toast(errorText(e), 'error');
    }
  }

  // Wochenweise Gegenüberstellung: höchster Schmerzwert und Trainingszeit der betroffenen Sportarten
  const weeks = new Map<string, { maxPain: number }>();
  for (const o of summary.observations) {
    const ws = startOfWeek(o.date);
    weeks.set(ws, { maxPain: Math.max(weeks.get(ws)?.maxPain ?? 0, o.pain) });
  }
  const weekRows = [...weeks.entries()]
    .sort((a, b) => compareDates(b[0], a[0]))
    .map(([ws, v]) => {
      const sec = activities
        .filter((a) => startOfWeek(a.date) === ws && (issue.sports.length === 0 || issue.sports.includes(a.sport)))
        .reduce((s, a) => s + a.durationSec, 0);
      return { ws, maxPain: v.maxPain, sec };
    });

  return (
    <Screen title={painIssueTitle(issue)} subtitle={`seit ${formatDateDe(issue.startDate)}`} back>
      <Section>
        <div className="flex items-end gap-3">
          <span className="num text-[52px] font-extrabold leading-none">{summary.latest?.pain ?? '–'}</span>
          <span className="pb-1.5 text-sm leading-tight text-muted">
            von 10, zuletzt
            <br />
            {summary.latest ? formatDateDe(summary.latest.date) : 'kein Eintrag'}
            {summary.change !== null && summary.change !== 0 && ` (${summary.change > 0 ? '+' : '−'}${Math.abs(summary.change)})`}
          </span>
        </div>
        {issue.description && <p className="mt-3 text-sm text-muted">{issue.description}</p>}
        {issue.sports.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-3 text-sm">
            {issue.sports.map((s) => (
              <span key={s} className="inline-flex items-center gap-1">
                <span className={SPORT_TEXT_CLASS[s]}>
                  <SportIcon sport={s} className="h-4 w-4" />
                </span>
                {SPORT_LABEL[s]}
              </span>
            ))}
          </div>
        )}
        <div className="mt-4">
          <Segmented<PainIssue['status']>
            ariaLabel="Status"
            value={issue.status}
            onChange={(v) =>
              void setPainStatus(repo, issue, v, today).then(
                () => toast(`Status: ${PAIN_STATUS_LABEL[v]}`),
                (e: unknown) => toast(errorText(e), 'error'),
              )
            }
            options={[
              { value: 'active', label: 'aktiv' },
              { value: 'improving', label: 'klingt ab' },
              { value: 'resolved', label: 'abgeklungen' },
            ]}
          />
        </div>
      </Section>

      <Section title="Neuer Eintrag">
        <div className="flex flex-col gap-4">
          <ScalePicker label="Schmerzstärke" min={0} max={10} value={pain} onChange={setPain} lowLabel="0 keine" highLabel="10 stärkste" optional={false} />
          <div className="grid grid-cols-2 gap-2">
            <Field label="Datum">{(id) => <TextInput id={id} type="date" value={date} onChange={setDate} />}</Field>
            <Field label="Notiz">{(id) => <TextInput id={id} value={note} onChange={setNote} placeholder="optional" />}</Field>
          </div>
          <Button variant="secondary" disabled={pain === undefined || !isLocalDate(date)} onClick={() => void addEntry()}>
            Eintrag hinzufügen
          </Button>
        </div>
      </Section>

      <Section title="Schmerzverlauf" aside={summary.maxPain !== null ? `höchster Wert ${summary.maxPain}` : undefined}>
        {summary.observations.length >= 2 && <PainChart observations={summary.observations} />}
        <ul className="mt-2 flex flex-col">
          {[...summary.observations].reverse().map((o) => (
            <li key={o.id} className="flex items-center gap-3 border-t border-line py-2 text-sm first:border-t-0">
              <span className="num w-20 shrink-0 text-muted">{formatWeekdayDayMonthDe(o.date)}</span>
              <span className="num w-8 shrink-0 font-semibold">{o.pain}</span>
              <span className="flex-1 truncate text-muted">{o.note}</span>
              {summary.observations.length > 1 && (
                <button
                  type="button"
                  aria-label={`Eintrag vom ${formatDateDe(o.date)} löschen`}
                  className="flex h-10 w-10 items-center justify-center rounded-full text-muted"
                  onClick={() => void repo.deletePainObservation(o.id)}
                >
                  <IconTrash className="h-4 w-4" />
                </button>
              )}
            </li>
          ))}
        </ul>
      </Section>

      {weekRows.length > 0 && (
        <Section title="Neben dem Training">
          <p className="mb-2 text-xs text-muted">
            Höchster Schmerzwert je Woche und Trainingszeit {issue.sports.length ? 'der betroffenen Sportarten' : 'insgesamt'}. Nur eine Gegenüberstellung – keine Aussage über Ursachen.
          </p>
          <table className="num w-full text-left text-sm">
            <thead className="text-xs text-muted">
              <tr>
                <th className="py-1 font-medium">KW</th>
                <th className="py-1 font-medium">Schmerz max.</th>
                <th className="py-1 font-medium">Training</th>
              </tr>
            </thead>
            <tbody>
              {weekRows.map((r) => (
                <tr key={r.ws} className="border-t border-line">
                  <td className="py-1.5">{isoWeek(r.ws).week}</td>
                  <td className="py-1.5">{r.maxPain}</td>
                  <td className="py-1.5">{r.sec ? formatDurationShort(r.sec) : '–'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      )}

      {issue.status !== 'resolved' && (
        <Button variant="secondary" full onClick={() => navigate({ name: 'pause', issueId: issue.id })}>
          Trainingspause eintragen
        </Button>
      )}

      {confirmDelete ? (
        <div className="flex gap-2">
          <Button
            variant="danger"
            full
            onClick={() =>
              void repo.deletePainIssue(issue.id).then(() => {
                toast('Beschwerde gelöscht');
                back();
              })
            }
          >
            Mit allen Einträgen löschen
          </Button>
          <Button variant="secondary" onClick={() => setConfirmDelete(false)}>
            Abbrechen
          </Button>
        </div>
      ) : (
        <Button variant="ghost" onClick={() => setConfirmDelete(true)}>
          <span className="text-danger">Beschwerde löschen</span>
        </Button>
      )}
      <p className="px-2 text-center text-xs text-muted">{DISCLAIMER}</p>
    </Screen>
  );
}

function PainChart({ observations }: { observations: PainObservation[] }) {
  const W = 340;
  const H = 120;
  const P = { l: 22, r: 8, t: 8, b: 20 };
  const first = observations[0]!.date;
  const last = observations[observations.length - 1]!.date;
  const span = Math.max(1, compareDates(last, first));
  const x = (d: string) => P.l + (compareDates(d, first) / span) * (W - P.l - P.r);
  const y = (v: number) => P.t + ((10 - v) / 10) * (H - P.t - P.b);
  const pts = observations.map((o) => `${x(o.date).toFixed(1)},${y(o.pain).toFixed(1)}`).join(' ');
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`Schmerzverlauf: ${observations.map((o) => `${formatDayMonthDe(o.date)} ${o.pain}`).join(', ')}`}>
      {[0, 5, 10].map((v) => (
        <g key={v}>
          <line x1={P.l} x2={W - P.r} y1={y(v)} y2={y(v)} className="stroke-line" strokeDasharray={v === 5 ? '3 3' : undefined} />
          <text x={P.l - 6} y={y(v) + 4} textAnchor="end" className="fill-muted text-[10px]">
            {v}
          </text>
        </g>
      ))}
      <polyline points={pts} fill="none" className="stroke-danger" strokeWidth={2} strokeLinejoin="round" />
      {observations.map((o) => (
        <circle key={o.id} cx={x(o.date)} cy={y(o.pain)} r={3.5} className="fill-danger" />
      ))}
      <text x={P.l} y={H - 4} className="fill-muted text-[10px]">
        {formatDayMonthDe(first)}
      </text>
      <text x={W - P.r} y={H - 4} textAnchor="end" className="fill-muted text-[10px]">
        {formatDayMonthDe(last)}
      </text>
    </svg>
  );
}
