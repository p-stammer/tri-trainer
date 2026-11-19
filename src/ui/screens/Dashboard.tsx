import type { ReactNode } from 'react';
import { Button, EmptyState, ProgressBar, Section } from '../components/ui';
import { IconUser, SPORT_BG_CLASS, SPORT_TEXT_CLASS, SportIcon } from '../components/icons';
import { AttentionHint, describePause, pauseRange } from './Health';
import { activePauses, isOpenIssue, isSportPaused, painIssueTitle, summarizeIssue } from '../../domain/health';
import { assessFreshness, freshnessChange } from '../../domain/wellness';
import type { PainIssue, PainObservation, TrainingPause, WeeklyWellnessCheckin } from '../../domain/schemas';
import { ActivityRow } from '../components/ActivityRow';
import { AdaptationCard } from '../components/AdaptationCard';
import { WeekReviewCard } from '../components/WeekReviewCard';
import { TestReminderCard } from '../components/TestReminderCard';
import { useLive, useNav, useToday } from '../state';
import type { ActiveContext } from '../../data/usecases';
import type { AppSettings } from '../../domain/schemas';
import { formatDateDe, formatDayMonthDe, formatWeekRangeDe, isoWeek } from '../../domain/calendar';
import { raceCalendar } from '../../domain/race';
import { computeFocusProgress, computeWeekProgress, primaryProgress, type SportWeekProgress } from '../../domain/progress';
import {
  ENDURANCE_SPORTS,
  PHASE_LABEL,
  PLANNED_SPORTS,
  SESSION_FOCUS_LABEL,
  SPORT_LABEL,
  ZONE_LABEL,
  type PrimaryMetric,
} from '../../domain/sports';
import { formatDistance, formatDurationShort, formatPercent } from '../../domain/units';

const BACKUP_REMINDER_DAYS = 14;

export function Dashboard({ ctx, settings }: { ctx: ActiveContext; settings: AppSettings }) {
  const { navigate } = useNav();
  const today = useToday(settings.timeZone);
  const cal = raceCalendar(ctx.race, today);
  const week = ctx.weeks.find((w) => w.weekStart === cal.currentWeekStart);
  const data = useLive(
    async (repo) => ({
      weekActs: await repo.listActivitiesInWeek(cal.currentWeekStart),
      anyActs: (await repo.listActivities()).length,
      checkins: await repo.listCheckins(),
      pauses: await repo.listPauses(),
      issues: await repo.listPainIssues(),
      observations: await repo.listPainObservations(),
      runningWorkouts: (await repo.listStrengthLogs()).filter((l) => l.status === 'in_progress'),
    }),
    [cal.currentWeekStart],
  );

  const progress = data ? computeWeekProgress(cal.currentWeekStart, week?.current, data.weekActs) : null;
  const focusProgress = data && week ? computeFocusProgress(week.current.focuses, data.weekActs) : [];
  const backupDue =
    !!data &&
    data.anyActs > 0 &&
    (!settings.lastBackupAt || Date.now() - Date.parse(settings.lastBackupAt) > BACKUP_REMINDER_DAYS * 86_400_000);

  return (
    <div className="mx-auto w-full max-w-xl px-4 pb-32">
      <RaceHeader ctx={ctx} cal={cal} phase={week?.current.phase ? PHASE_LABEL[week.current.phase] : null} />

      <div className="flex flex-col gap-4">
        {data && activePauses(data.pauses, today).map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => navigate({ name: 'pause', pauseId: p.id })}
            className="rounded-3xl border-2 border-warn/60 bg-surface p-4 text-left"
          >
            <span className="block font-semibold">{describePause(p)}</span>
            <span className="block text-sm text-muted">
              {pauseRange(p)}
              {p.reason ? `, ${p.reason}` : ''}. Ausgefallenes Training wird nicht nachgeholt.
            </span>
          </button>
        ))}

        {data?.runningWorkouts.map((l) => (
          <button
            key={l.id}
            type="button"
            onClick={() => navigate({ name: 'workout', logId: l.id })}
            className="rounded-3xl border-2 border-strength bg-surface p-4 text-left"
          >
            <span className="block font-semibold">{l.name} läuft</span>
            <span className="block text-sm text-muted">Tippen, um weiterzumachen oder abzuschließen.</span>
          </button>
        ))}

        <AdaptationCard ctx={ctx} settings={settings} today={today} />

        <WeekReviewCard ctx={ctx} settings={settings} today={today} />

        <TestReminderCard ctx={ctx} settings={settings} today={today} />

        {backupDue && (
          <button
            type="button"
            onClick={() => navigate({ name: 'settings' })}
            className="rounded-3xl border border-warn/50 bg-surface p-4 text-left text-sm"
          >
            <span className="font-semibold text-warn">Backup empfohlen.</span>{' '}
            {settings.lastBackupAt
              ? `Letztes Backup vor mehr als ${BACKUP_REMINDER_DAYS} Tagen.`
              : 'Es gibt noch kein Backup deiner Trainingsdaten.'}{' '}
            Browserdaten können verloren gehen – jetzt unter Profil sichern.
          </button>
        )}

        <Section title="Diese Woche" aside={formatWeekRangeDe(cal.currentWeekStart)}>
          {!week ? (
            <p className="text-sm text-muted">Diese Woche liegt außerhalb deines Trainingsplans.</p>
          ) : !progress ? (
            <p className="text-sm text-muted">Lade …</p>
          ) : (
            <div className="flex flex-col gap-4">
              {PLANNED_SPORTS.map((s) => (
                <SportLane
                  onOpen={s === 'strength' ? () => navigate({ name: 'strength' }) : undefined}
                  key={s}
                  p={progress.sports[s]}
                  preferred={s === 'strength' ? 'duration' : settings.primaryMetric[s]}
                  paused={data ? isSportPaused(data.pauses, s, today) : null}
                />
              ))}
              {progress.other.durationSec > 0 && (
                <div className="flex items-baseline justify-between text-sm">
                  <span className="flex items-center gap-1.5">
                    <SportIcon sport="other" className="h-4 w-4 text-other" />
                    Sonstiges / Cardio
                    <span className="text-xs text-muted">({progress.other.count}×, ohne Ziel)</span>
                  </span>
                  <span className="num font-semibold">{formatDurationShort(progress.other.durationSec)}</span>
                </div>
              )}
              <div className="flex items-baseline justify-between border-t border-line pt-3 text-sm">
                <span className="text-muted">Gesamt</span>
                <span className="num font-semibold">
                  {formatDurationShort(progress.totalDurationSec)}
                  {progress.plannedTotalComplete && progress.plannedTotalDurationSec !== null && (
                    <span className="font-normal text-muted"> von {formatDurationShort(progress.plannedTotalDurationSec)}</span>
                  )}
                </span>
              </div>
              {!progress.plannedTotalComplete && progress.plannedTotalDurationSec !== null && (
                <p className="-mt-2 text-xs text-muted">Kein Gesamtziel: nicht jede Sportart hat ein Dauerziel.</p>
              )}
              {week.current.sports.length === 0 && (
                <Button variant="secondary" onClick={() => navigate({ name: 'week', weekStart: cal.currentWeekStart })}>
                  Wochenziele festlegen
                </Button>
              )}
            </div>
          )}
        </Section>

        {week && week.current.focuses.length > 0 && (
          <Section title="Schwerpunkte">
            <ul className="flex flex-col gap-2">
              {week.current.focuses.map((f) => {
                const fp = focusProgress.find((x) => x.focusId === f.id);
                const done = fp ? Math.min(fp.done, fp.planned) : 0;
                const complete = done >= f.count;
                return (
                  <li key={f.id} className="flex items-center gap-3">
                    <span className={SPORT_TEXT_CLASS[f.sport]}>
                      <SportIcon sport={f.sport} title={SPORT_LABEL[f.sport]} />
                    </span>
                    <span className={`flex-1 ${complete ? 'text-muted line-through' : ''}`}>
                      {f.count > 1 ? `${f.count}× ` : ''}
                      {SESSION_FOCUS_LABEL[f.focus]}
                      {f.note ? <span className="text-muted"> – {f.note}</span> : null}
                    </span>
                    <span className="num text-sm font-semibold">
                      {done}/{f.count}
                    </span>
                  </li>
                );
              })}
            </ul>
          </Section>
        )}

        {progress && <IntensitySection progress={progress.sports} />}

        {data && (
          <HealthCard
            checkins={data.checkins}
            weekStart={cal.currentWeekStart}
            target={week?.current.freshnessTarget}
            issues={data.issues}
            observations={data.observations}
          />
        )}

        <Section title="Einheiten dieser Woche" aside={data ? `${data.weekActs.length}` : undefined}>
          {!data ? null : data.weekActs.length === 0 ? (
            <EmptyState title="Noch keine Einheit erfasst">Nach dem Training einfach über das Plus unten eintragen.</EmptyState>
          ) : (
            <ul className="-mx-1 flex flex-col">
              {data.weekActs.map((a) => (
                <li key={a.id}>
                  <ActivityRow a={a} onClick={() => navigate({ name: 'log', activityId: a.id })} />
                </li>
              ))}
            </ul>
          )}
        </Section>

        <div className="grid grid-cols-2 gap-3">
          <Button onClick={() => navigate({ name: 'log' })}>Training erfassen</Button>
          <Button variant="secondary" onClick={() => navigate({ name: 'checkin' })}>
            Frische erfassen
          </Button>
          <Button variant="secondary" onClick={() => navigate({ name: 'week', weekStart: cal.currentWeekStart })} disabled={!week}>
            Woche planen
          </Button>
          <Button variant="secondary" onClick={() => navigate({ name: 'pain' })}>
            Beschwerde erfassen
          </Button>
        </div>
      </div>
    </div>
  );
}

function RaceHeader({ ctx, cal, phase }: { ctx: ActiveContext; cal: ReturnType<typeof raceCalendar>; phase: string | null }) {
  const headline =
    cal.status === 'past'
      ? 'Wettkampf vorbei'
      : cal.status === 'race-day'
        ? 'Heute ist Wettkampftag'
        : `${cal.daysUntil}`;
  return (
    <header className="pt-safe pb-5">
      <div className="flex items-center justify-between pt-2">
        <p className="text-[15px] font-semibold">{ctx.race.name}</p>
        <ProfileButton />
      </div>
      <div className="mt-1 flex items-end gap-3">
        <span className={`num font-extrabold leading-none tracking-tight ${cal.daysUntil > 0 ? 'text-[64px]' : 'text-[34px]'}`}>
          {headline}
        </span>
        {cal.daysUntil > 0 && (
          <span className="pb-2 text-[15px] leading-tight text-muted">
            {cal.daysUntil === 1 ? 'Tag' : 'Tage'} bis
            <br />
            {formatDateDe(ctx.race.date)}
          </span>
        )}
      </div>
      <div className="mt-4 flex flex-wrap gap-2 text-sm">
        {cal.trainingWeek !== null ? (
          <Pill>
            Woche <span className="num font-semibold">{cal.trainingWeek}</span> von <span className="num">{cal.totalWeeks}</span>
          </Pill>
        ) : cal.status === 'before-prep' ? (
          <Pill>Vorbereitung beginnt {formatDateDe(ctx.race.prepStartDate, false)}</Pill>
        ) : null}
        <Pill>
          KW <span className="num font-semibold">{cal.calendarWeek.week}</span>
        </Pill>
        {phase && <Pill>{phase}</Pill>}
      </div>
      <div className="mt-4">
        <ProgressBar ratio={cal.progress} colorClass="bg-ink" label="Fortschritt der Vorbereitung" />
        <p className="mt-1.5 text-xs text-muted">
          {formatPercent(cal.progress)} der Vorbereitungszeit vergangen
          {cal.remainingWeeks > 0 ? `, ${cal.remainingWeeks} ${cal.remainingWeeks === 1 ? 'Woche' : 'Wochen'} übrig` : ''}
        </p>
      </div>
    </header>
  );
}

function ProfileButton() {
  const { navigate } = useNav();
  return (
    <button
      type="button"
      onClick={() => navigate({ name: 'settings' })}
      aria-label="Profil und Einstellungen"
      className="-mr-2 flex h-11 w-11 items-center justify-center rounded-full text-ink hover:bg-surface"
    >
      <IconUser />
    </button>
  );
}

function HealthCard(props: {
  checkins: WeeklyWellnessCheckin[];
  weekStart: string;
  target: { min: number; max: number } | undefined;
  issues: PainIssue[];
  observations: PainObservation[];
}) {
  const open = props.issues.filter(isOpenIssue);
  return (
    <>
      <FreshnessCard checkins={props.checkins} weekStart={props.weekStart} target={props.target} />
      {open.length > 0 && <OpenIssuesCard issues={open} observations={props.observations} />}
    </>
  );
}

function OpenIssuesCard({ issues, observations }: { issues: PainIssue[]; observations: PainObservation[] }) {
  const { navigate } = useNav();
  return (
    <Section title="Beschwerden" aside={`${issues.length} offen`}>
      <ul className="flex flex-col gap-1">
        {issues.map((i) => {
          const s = summarizeIssue(i, observations);
          return (
            <li key={i.id}>
              <button type="button" onClick={() => navigate({ name: 'pain', issueId: i.id })} className="flex w-full items-baseline justify-between gap-3 py-1.5 text-left">
                <span className="font-medium">{painIssueTitle(i)}</span>
                <span className="num text-sm text-muted">
                  Schmerz {s.latest?.pain ?? '–'}/10{s.latest ? `, ${formatDayMonthDe(s.latest.date)}` : ''}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </Section>
  );
}

function FreshnessCard({
  checkins,
  weekStart,
  target,
}: {
  checkins: WeeklyWellnessCheckin[];
  weekStart: string;
  target: { min: number; max: number } | undefined;
}) {
  const { navigate } = useNav();
  const current = checkins.find((c) => c.weekStart === weekStart);
  const last = checkins[0];
  if (!current) {
    return (
      <Section title="Frische" aside={target ? `Ziel ${target.min}–${target.max}` : undefined}>
        <div className="flex items-center gap-3">
          <p className="flex-1 text-sm text-muted">
            {last ? `Letzter Wert: ${last.freshness}/10 (KW ${isoWeekNo(last.weekStart)}). Für diese Woche noch kein Check-in.` : 'Noch kein Frische-Check-in.'}
          </p>
          <Button variant="secondary" onClick={() => navigate({ name: 'checkin' })}>
            Erfassen
          </Button>
        </div>
      </Section>
    );
  }
  const assessment = assessFreshness(current.freshness, target);
  const change = freshnessChange(checkins, weekStart);
  return (
    <Section title="Frische" aside={target ? `Ziel ${target.min}–${target.max}` : undefined}>
      <button type="button" onClick={() => navigate({ name: 'health' })} className="flex w-full items-baseline gap-2 text-left">
        <span className="num text-[34px] font-bold leading-none">{current.freshness}</span>
        <span className="text-sm text-muted">
          von 10{change === null ? '' : change === 0 ? ', wie Vorwoche' : `, ${change > 0 ? '+' : '−'}${Math.abs(change)} zur Vorwoche`}
        </span>
      </button>
      <AttentionHint assessment={assessment} checkin={current} weekStart={weekStart} />
    </Section>
  );
}

function isoWeekNo(d: string): number {
  return isoWeek(d).week;
}

function Pill({ children }: { children: ReactNode }) {
  return <span className="rounded-full bg-surface px-3 py-1.5">{children}</span>;
}

function SportLane({
  p,
  preferred,
  paused,
  onOpen,
}: {
  p: SportWeekProgress;
  preferred: PrimaryMetric;
  paused: TrainingPause | null;
  onOpen?: (() => void) | undefined;
}) {
  const sport = p.sport;
  const label = SPORT_LABEL[sport];
  const isStrength = sport === 'strength';
  const prim = primaryProgress(p, preferred);
  const fmt = (v: number) => (prim.metric === 'duration' ? formatDurationShort(v) : formatDistance(v, sport === 'swim' ? 'auto-swim' : 'km'));

  const noTarget = !p.hasTarget;
  const nothing = noTarget && p.duration.done === 0;

  return (
    <div className={nothing ? 'opacity-55' : ''}>
      <div className="flex items-center gap-2.5">
        <span className={`flex h-8 w-8 items-center justify-center rounded-xl ${SPORT_BG_CLASS[sport]} text-white`}>
          <SportIcon sport={sport} className="h-[18px] w-[18px]" />
        </span>
        {onOpen ? (
          <button type="button" onClick={onOpen} className="flex-1 text-left font-semibold underline decoration-line underline-offset-4">
            {label}
          </button>
        ) : (
          <span className="flex-1 font-semibold">{label}</span>
        )}
        {isStrength ? (
          <span className="num text-[15px] font-semibold">
            {p.sessions.done}
            {p.sessions.planned !== null && <span className="font-normal text-muted"> / {p.sessions.planned} Workouts</span>}
            {p.sessions.planned === null && <span className="font-normal text-muted"> Workouts</span>}
          </span>
        ) : (
          <span className="num text-[15px] font-semibold">
            {fmt(prim.metric === 'duration' ? p.duration.done : p.distance.done)}
            {prim.progress.planned !== null && <span className="font-normal text-muted"> / {fmt(prim.progress.planned)}</span>}
          </span>
        )}
      </div>
      {(isStrength ? p.sessions.planned !== null : prim.progress.planned !== null) && (
        <div className="mt-2 pl-[42px]">
          <ProgressBar
            ratio={isStrength ? p.sessions.ratio : prim.progress.ratio}
            colorClass={SPORT_BG_CLASS[sport]}
            label={`${label}: Zielerreichung`}
          />
          <div className="mt-1 flex justify-between text-xs text-muted">
            <span>
              {paused
                ? `pausiert${paused.endDate ? ` bis ${formatDayMonthDe(paused.endDate)}` : ''}`
                : isStrength
                ? p.sessions.remaining
                  ? `noch ${p.sessions.remaining}`
                  : 'Ziel erreicht'
                : prim.progress.remaining
                  ? `noch ${fmt(prim.progress.remaining)}`
                  : 'Ziel erreicht'}
              {!paused && prim.isFallback && !isStrength && ' (Ziel nur als ' + (prim.metric === 'duration' ? 'Dauer' : 'Distanz') + ' geplant)'}
            </span>
            <span className="num">
              {(isStrength ? p.sessions.ratio : prim.progress.ratio) !== null
                ? formatPercent((isStrength ? p.sessions.ratio : prim.progress.ratio) as number)
                : ''}
            </span>
          </div>
          {!isStrength && prim.metric === 'distance' && p.activitiesWithoutDistance > 0 && (
            <p className="mt-0.5 text-xs text-warn">
              {p.activitiesWithoutDistance} {p.activitiesWithoutDistance === 1 ? 'Einheit' : 'Einheiten'} ohne Distanzangabe
            </p>
          )}
        </div>
      )}
      {noTarget && !nothing && <p className="mt-1 pl-[42px] text-xs text-muted">Kein Wochenziel festgelegt</p>}
    </div>
  );
}

function IntensitySection({ progress }: { progress: Record<(typeof PLANNED_SPORTS)[number], SportWeekProgress> }) {
  const relevant = ENDURANCE_SPORTS.map((s) => progress[s]).filter(
    (p) => p.zones.some((z) => z.plannedSec !== null || z.doneSec > 0) || p.duration.done > 0,
  );
  if (relevant.length === 0) return null;
  return (
    <Section title="Intensität" aside="geplant / absolviert">
      <div className="flex flex-col gap-5">
        {relevant.map((p) => {
          const zones = p.zones.filter((z) => z.plannedSec !== null || z.doneSec > 0);
          return (
            <div key={p.sport}>
              <div className={`mb-2 flex items-center gap-2 text-sm font-semibold ${SPORT_TEXT_CLASS[p.sport]}`}>
                <SportIcon sport={p.sport} className="h-4 w-4" />
                <span className="text-ink">{SPORT_LABEL[p.sport]}</span>
              </div>
              {zones.length === 0 ? (
                <p className="text-sm text-muted">Keine Zonenziele und keine Zonenzeiten erfasst.</p>
              ) : (
                <ul className="flex flex-col gap-1.5 text-sm">
                  {zones.map((z) => (
                    <li key={z.zone} className="grid grid-cols-[1fr_auto] items-center gap-x-3">
                      <span>{ZONE_LABEL[z.zone]}</span>
                      <span className="num">
                        {z.plannedSec !== null ? formatDurationShort(z.plannedSec) : '–'}
                        <span className="text-muted"> / </span>
                        <span className="font-semibold">{formatDurationShort(z.doneSec)}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              {p.unknownZoneSec > 0 && (
                <p className="mt-1.5 text-xs text-muted">
                  {formatDurationShort(p.unknownZoneSec)} ohne Zonenangabe (nicht zugeordnet)
                </p>
              )}
            </div>
          );
        })}
      </div>
    </Section>
  );
}
