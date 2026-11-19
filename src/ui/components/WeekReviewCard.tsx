/* Wochenrückblick auf „Heute“ (M3.6): Montag bis Mittwoch für die Vorwoche, ausblendbar. */
import { Button } from './ui';
import { SPORT_TEXT_CLASS, SportIcon } from './icons';
import { useLive, useNav, useRepo } from '../state';
import type { ActiveContext } from '../../data/usecases';
import type { AppSettings } from '../../domain/schemas';
import { isoWeek, startOfWeek, type LocalDate } from '../../domain/calendar';
import { reviewWeekFor, weekReview, type SportReview } from '../../domain/review';
import { PHASE_LABEL, SPORT_SHORT } from '../../domain/sports';
import { formatDistance, formatDurationShort, formatNumber, formatPercent } from '../../domain/units';

function fmt(r: SportReview, v: number): string {
  if (r.metric === 'sessions') return `${formatNumber(v, 0)}×`;
  if (r.metric === 'distance') return formatDistance(v, r.sport === 'swim' ? 'auto-swim' : 'km');
  return formatDurationShort(v);
}

export function WeekReviewCard({ ctx, settings, today }: { ctx: ActiveContext; settings: AppSettings; today: LocalDate }) {
  const repo = useRepo();
  const { navigate } = useNav();
  const ws = reviewWeekFor(today);
  const thisWeek = startOfWeek(today);
  const review = useLive(
    async (r) => {
      if (!ws) return null;
      const [activities, checkins, pauses] = await Promise.all([r.listActivitiesInWeek(ws), r.listCheckins(), r.listPauses()]);
      return weekReview(ws, ctx.weeks.find((w) => w.weekStart === ws)?.current, activities, checkins, pauses, settings.primaryMetric);
    },
    [ws, ctx.weeks, settings.primaryMetric],
  );
  if (!ws || !review || settings.reviewDismissedWeek === thisWeek) return null;

  const facts: string[] = [];
  if (review.focusesPlanned > 0) facts.push(`Schlüsseleinheiten ${review.focusesDone} von ${review.focusesPlanned}`);
  if (review.rpeMean !== null) facts.push(`Ø Anstrengung ${formatNumber(review.rpeMean, 1)} (${review.rpeCount}×)`);
  if (review.freshness !== null) facts.push(`Frische ${review.freshness}/10`);
  if (review.otherSec > 0) facts.push(`Sonstiges ${formatDurationShort(review.otherSec)}`);
  if (review.pausedDays > 0) facts.push(`${review.pausedDays} Tage Pause`);

  return (
    <section className="rounded-3xl border border-line bg-surface p-4" aria-label="Wochenrückblick">
      <div className="flex items-baseline justify-between gap-2">
        <p className="font-semibold">Rückblick KW {isoWeek(ws).week}</p>
        <span className="text-xs text-muted">{review.phase ? PHASE_LABEL[review.phase] : ''}</span>
      </div>
      <p className="num mt-1 text-sm">
        <span className="font-semibold">{formatDurationShort(review.totalDoneSec)}</span> trainiert
        {review.plannedTotalSec !== null && (
          <>
            {' '}
            von {formatDurationShort(review.plannedTotalSec)} geplant
            {review.totalRatio !== null && <> ({formatPercent(review.totalRatio)})</>}
          </>
        )}
        , {review.sessions} {review.sessions === 1 ? 'Einheit' : 'Einheiten'}
      </p>
      <ul className="num mt-2 flex flex-col gap-1 text-sm">
        {review.sports.map((r) => (
          <li key={r.sport} className="flex items-center justify-between gap-3">
            <span className="inline-flex items-center gap-1.5">
              <span className={SPORT_TEXT_CLASS[r.sport]}>
                <SportIcon sport={r.sport} className="h-4 w-4" />
              </span>
              {SPORT_SHORT[r.sport]}
            </span>
            <span>
              {fmt(r, r.done)}
              {r.planned !== null && <span className="text-muted"> / {fmt(r, r.planned)}</span>}
              {r.ratio !== null && <span className="ml-2 font-semibold">{formatPercent(r.ratio)}</span>}
            </span>
          </li>
        ))}
      </ul>
      {facts.length > 0 && <p className="mt-2 text-xs text-muted">{facts.join(' · ')}</p>}
      <div className="mt-3 flex flex-wrap gap-2">
        <Button variant="secondary" onClick={() => navigate({ name: 'week', weekStart: ws })}>
          Woche ansehen
        </Button>
        <Button variant="ghost" onClick={() => void repo.updateSettings({ reviewDismissedWeek: thisWeek })}>
          Ausblenden
        </Button>
      </div>
    </section>
  );
}
