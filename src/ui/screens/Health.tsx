import { Button, EmptyState, Loading, Screen, Section } from '../components/ui';
import { IconChevron } from '../components/icons';
import { PAIN_STATUS_LABEL, activePauses, isOpenIssue, painIssueTitle, recurringRegions, summarizeIssue } from '../../domain/health';
import type { PainIssue, PainObservation, TrainingPause } from '../../domain/schemas';
import { SPORT_LABEL } from '../../domain/sports';
import { FreshnessChart } from '../components/FreshnessChart';
import { errorText, useLive, useNav, useRepo, useToast, useToday } from '../state';
import { acknowledgeCheckin, type ActiveContext } from '../../data/usecases';
import type { AppSettings, WeeklyWellnessCheckin } from '../../domain/schemas';
import { addDays, compareDates, formatDateDe, isoWeek, startOfWeek } from '../../domain/calendar';
import { freshnessChange, needsAttention, weekRange, weeklyHealthRows, type FreshnessAssessment, type WeeklyHealthRow } from '../../domain/wellness';
import { formatDurationShort, formatNumber } from '../../domain/units';

const WEEKS_SHOWN = 12;

export function Health({ ctx, settings }: { ctx: ActiveContext; settings: AppSettings }) {
  const today = useToday(settings.timeZone);
  const current = startOfWeek(today);
  const data = useLive(
    async (repo) => ({
      checkins: await repo.listCheckins(),
      activities: await repo.listActivities(),
      issues: await repo.listPainIssues(),
      observations: await repo.listPainObservations(),
      pauses: await repo.listPauses(),
    }),
    [],
  );
  if (!data) return <Loading />;

  const prep = startOfWeek(ctx.race.prepStartDate);
  const from = compareDates(addDays(current, -7 * (WEEKS_SHOWN - 1)), prep) > 0 ? addDays(current, -7 * (WEEKS_SHOWN - 1)) : prep;
  const starts = compareDates(from, current) <= 0 ? weekRange(from, current) : [current];
  const rows = weeklyHealthRows(starts, ctx.weeks, data.activities, data.checkins);
  const thisWeek = rows.find((r) => r.weekStart === current);

  return (
    <Screen title="Gesundheit und Frische">
      <PausesSection pauses={data.pauses} today={today} />
      <CurrentWeekCard row={thisWeek} checkins={data.checkins} currentWeek={current} />
      <PainSection issues={data.issues} observations={data.observations} />

      <Section title="Frischeverlauf" aside="Skala 1–10">
        {data.checkins.length === 0 ? (
          <p className="text-sm text-muted">Nach dem ersten Check-in siehst du hier den Verlauf.</p>
        ) : (
          <>
            <FreshnessChart rows={rows} />
            <p className="mt-1 text-xs text-muted">Grüne Flächen: gewünschter Frischebereich der Woche. Zahlen unten: Kalenderwochen.</p>
          </>
        )}
      </Section>

      <Section title="Wochen im Vergleich">
        <p className="mb-3 text-xs text-muted">
          Frische, Trainingsumfang und subjektive Belastung nebeneinander. Gleichzeitige Veränderungen zeigen keinen Ursache-Wirkungs-Zusammenhang.
        </p>
        <div className="-mx-1 overflow-x-auto">
          <table className="num w-full text-left text-sm">
            <thead className="text-xs text-muted">
              <tr>
                <th className="px-1 py-1.5 font-medium">KW</th>
                <th className="px-1 py-1.5 font-medium">Frische</th>
                <th className="px-1 py-1.5 font-medium">Umfang</th>
                <th className="px-1 py-1.5 font-medium">Belastung</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.weekStart} className="border-t border-line">
                  <td className="px-1 py-2">{isoWeek(r.weekStart).week}</td>
                  <td className="px-1 py-2">
                    {r.checkin ? <span className="font-semibold">{r.checkin.freshness}</span> : <span className="text-muted">–</span>}
                    {r.target && <span className="text-muted"> ({r.target.min}–{r.target.max})</span>}
                    {r.assessment && r.assessment.status === 'below' && <span className="text-warn"> ↓</span>}
                    {r.assessment && r.assessment.status === 'above' && <span className="text-ok"> ↑</span>}
                  </td>
                  <td className="px-1 py-2">{r.activityCount ? formatDurationShort(r.durationSec) : <span className="text-muted">–</span>}</td>
                  <td className="px-1 py-2">
                    {r.load.withRpe > 0 ? (
                      <>
                        {formatNumber(r.load.load, 0)}
                        <span className="text-xs text-muted">
                          {' '}
                          ({r.load.withRpe}/{r.load.total} mit RPE)
                        </span>
                      </>
                    ) : (
                      <span className="text-muted">{r.activityCount ? 'kein RPE' : '–'}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-muted">Belastung = Summe aus Dauer (min) × Session-RPE, nur für Einheiten mit RPE.</p>
      </Section>

      <p className="px-2 text-center text-xs text-muted">
        Die App bewertet subjektive Angaben nicht medizinisch und stellt keine Diagnosen. Bei anhaltender Erschöpfung oder Beschwerden fachlich abklären lassen.
      </p>
    </Screen>
  );
}

export function describePause(p: TrainingPause): string {
  const what = p.scope === 'all' ? 'Gesamtes Training' : p.sports.map((s) => SPORT_LABEL[s]).join(', ');
  return `${what} pausiert`;
}

export function pauseRange(p: TrainingPause): string {
  return p.endDate ? `${formatDateDe(p.startDate, false)} bis ${formatDateDe(p.endDate, false)}` : `seit ${formatDateDe(p.startDate, false)}, offen`;
}

function PausesSection({ pauses, today }: { pauses: TrainingPause[]; today: string }) {
  const { navigate } = useNav();
  const active = activePauses(pauses, today);
  const upcoming = pauses.filter((p) => compareDates(p.startDate, today) > 0);
  const past = pauses.filter((p) => p.endDate && compareDates(p.endDate, today) < 0);
  return (
    <Section title="Trainingspausen" aside={past.length ? `${past.length} beendet` : undefined}>
      {active.length + upcoming.length === 0 ? (
        <p className="text-sm text-muted">Keine aktive Pause.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {[...active, ...upcoming].map((p) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => navigate({ name: 'pause', pauseId: p.id })}
                className={`flex w-full items-center gap-3 rounded-2xl border p-3 text-left ${active.includes(p) ? 'border-warn/60' : 'border-line'}`}
              >
                <span className="flex-1">
                  <span className="block font-semibold">{describePause(p)}</span>
                  <span className="block text-sm text-muted">
                    {active.includes(p) ? '' : 'geplant: '}
                    {pauseRange(p)}
                    {p.reason ? `, ${p.reason}` : ''}
                  </span>
                </span>
                <IconChevron className="h-4 w-4 text-muted" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-3">
        <Button variant="secondary" full onClick={() => navigate({ name: 'pause' })}>
          Pause eintragen
        </Button>
      </div>
    </Section>
  );
}

function PainSection({ issues, observations }: { issues: PainIssue[]; observations: PainObservation[] }) {
  const { navigate } = useNav();
  const open = issues.filter(isOpenIssue);
  const resolved = issues.filter((i) => !isOpenIssue(i));
  const recurring = recurringRegions(issues);
  const row = (i: PainIssue) => {
    const s = summarizeIssue(i, observations);
    return (
      <li key={i.id}>
        <button type="button" onClick={() => navigate({ name: 'pain', issueId: i.id })} className="flex w-full items-center gap-3 py-2.5 text-left">
          <span className="num flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-surface-2 text-[17px] font-bold">{s.latest?.pain ?? '–'}</span>
          <span className="min-w-0 flex-1">
            <span className="block truncate font-semibold">{painIssueTitle(i)}</span>
            <span className="block truncate text-sm text-muted">
              {PAIN_STATUS_LABEL[i.status]}
              {s.latest ? `, zuletzt ${formatDateDe(s.latest.date, false)}` : ''}
              {s.change !== null && s.change !== 0 ? ` (${s.change > 0 ? '+' : '−'}${Math.abs(s.change)})` : ''}
            </span>
          </span>
          <IconChevron className="h-4 w-4 text-muted" />
        </button>
      </li>
    );
  };
  return (
    <Section title="Beschwerden" aside={open.length ? `${open.length} offen` : undefined}>
      {open.length === 0 ? <p className="text-sm text-muted">Keine offenen Beschwerden.</p> : <ul className="-my-1 flex flex-col">{open.map(row)}</ul>}
      {recurring.length > 0 && (
        <p className="mt-2 text-sm text-warn">
          Wiederholt betroffen: {recurring.map((r) => `${r.title} (${r.count}×)`).join(', ')}
        </p>
      )}
      {resolved.length > 0 && (
        <details className="mt-2">
          <summary className="cursor-pointer py-1 text-sm text-muted">{resolved.length} abgeklungene Beschwerden</summary>
          <ul className="flex flex-col">{resolved.map(row)}</ul>
        </details>
      )}
      <div className="mt-3">
        <Button variant="secondary" full onClick={() => navigate({ name: 'pain' })}>
          Beschwerde erfassen
        </Button>
      </div>
    </Section>
  );
}

function CurrentWeekCard({ row, checkins, currentWeek }: { row: WeeklyHealthRow | undefined; checkins: WeeklyWellnessCheckin[]; currentWeek: string }) {
  const { navigate } = useNav();
  const checkin = row?.checkin ?? null;
  if (!checkin || !row?.assessment) {
    return (
      <Section title="Diese Woche">
        <EmptyState title="Noch kein Frische-Check-in">Wie erholt fühlst du dich diese Woche? Dauert 20 Sekunden.</EmptyState>
        <div className="mt-3">
          <Button full onClick={() => navigate({ name: 'checkin' })}>
            Frische erfassen
          </Button>
        </div>
        {row?.target && (
          <p className="mt-2 text-center text-sm text-muted">
            Gewünschter Bereich diese Woche: {row.target.min}–{row.target.max}
          </p>
        )}
      </Section>
    );
  }
  const change = freshnessChange(checkins, currentWeek);
  return (
    <Section title="Diese Woche" aside={`erfasst ${formatDateDe(checkin.date)}`}>
      <div className="flex items-end gap-3">
        <span className="num text-[52px] font-extrabold leading-none">{checkin.freshness}</span>
        <span className="pb-1.5 text-sm leading-tight text-muted">
          von 10
          <br />
          {change === null ? 'erster Wert' : change === 0 ? 'wie Vorwoche' : `${change > 0 ? '+' : '−'}${Math.abs(change)} zur Vorwoche`}
        </span>
        {row.target && (
          <span className="ml-auto rounded-full bg-surface-2 px-3 py-1.5 text-sm">
            Ziel {row.target.min}–{row.target.max}
          </span>
        )}
      </div>
      <Details c={checkin} />
      <AttentionHint assessment={row.assessment} checkin={checkin} weekStart={currentWeek} />
      <div className="mt-3">
        <Button variant="secondary" full onClick={() => navigate({ name: 'checkin' })}>
          Check-in bearbeiten
        </Button>
      </div>
    </Section>
  );
}

function Details({ c }: { c: WeeklyWellnessCheckin }) {
  const items = [
    c.sleepQuality !== undefined ? `Schlaf ${c.sleepQuality}/5` : null,
    c.soreness !== undefined ? `Muskelkater ${c.soreness}/5` : null,
    c.motivation !== undefined ? `Motivation ${c.motivation}/5` : null,
    c.wellbeing !== undefined ? `Wohlbefinden ${c.wellbeing}/5` : null,
  ].filter(Boolean);
  if (items.length === 0 && !c.note) return null;
  return (
    <div className="mt-3 text-sm text-muted">
      {items.length > 0 && <p className="num">{items.join(', ')}</p>}
      {c.note && <p className="mt-1 italic">„{c.note}“</p>}
    </div>
  );
}

/** Hinweis bei Abweichung. Ändert nie selbst den Plan – führt höchstens zum Wochen-Editor. */
export function AttentionHint({ assessment, checkin, weekStart }: { assessment: FreshnessAssessment; checkin: WeeklyWellnessCheckin; weekStart: string }) {
  const repo = useRepo();
  const toast = useToast();
  const { navigate } = useNav();
  const kind = needsAttention(assessment, !!checkin.acknowledgedAt);
  if (!kind) {
    if (checkin.acknowledgedAt && (assessment.status === 'below' || assessment.status === 'above' || assessment.notablyLow || assessment.notablyHigh)) {
      return <p className="mt-3 text-xs text-muted">Hinweis als geprüft markiert.</p>;
    }
    return null;
  }
  const t = assessment.target;
  const text =
    kind === 'low'
      ? t
        ? `Deine Frische liegt unter dem gewünschten Bereich (${t.min}–${t.max}). Prüfe, ob der Plan der nächsten Tage zu deiner Erholung passt.`
        : 'Deine Frische ist deutlich niedriger als durchschnittlich. Prüfe, ob der Plan der nächsten Tage zu deiner Erholung passt.'
      : t
        ? `Deine Frische liegt über dem gewünschten Bereich (${t.min}–${t.max}). Schön! Prüfe bei Gelegenheit, ob der geplante Umfang zur Phase passt.`
        : 'Du fühlst dich außergewöhnlich frisch. Schön! Prüfe bei Gelegenheit, ob der geplante Umfang zur Phase passt.';
  const nextWeek = addDays(weekStart, 7);
  return (
    <div className={`mt-3 rounded-2xl border p-3 text-sm ${kind === 'low' ? 'border-warn/50' : 'border-ok/50'}`} role="status">
      <p>{text}</p>
      <p className="mt-1 text-xs text-muted">
        {kind === 'low'
          ? 'Eine mögliche konservative Anpassung: den Umfang der kommenden Woche im Wochen-Editor reduzieren (z. B. −10 % oder −20 %). Der Plan wird nicht automatisch geändert.'
          : 'Eine Steigerung erfolgt nicht automatisch – hohe Frische allein ist kein Grund für mehr Umfang.'}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button variant="secondary" onClick={() => navigate({ name: 'week', weekStart: nextWeek })}>
          Nächste Woche ansehen
        </Button>
        <Button
          variant="ghost"
          onClick={() =>
            void acknowledgeCheckin(repo, checkin).then(
              () => toast('Als geprüft markiert'),
              (e: unknown) => toast(errorText(e), 'error'),
            )
          }
        >
          Als geprüft markieren
        </Button>
      </div>
    </div>
  );
}
