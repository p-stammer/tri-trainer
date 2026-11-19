import { SPORT_BG_CLASS, SportIcon, IconChevron } from './icons';
import type { CompletedActivity } from '../../domain/schemas';
import { SESSION_FOCUS_LABEL, SPORT_LABEL } from '../../domain/sports';
import { formatWeekdayDayMonthDe } from '../../domain/calendar';
import { formatDistance, formatDurationShort, formatPace, pacePer100m, pacePerKm, speedKmh, formatNumber } from '../../domain/units';
import { hasAnyZoneTime } from '../../domain/zones';

function detail(a: CompletedActivity): string | null {
  if (a.distanceM === undefined) return null;
  if (a.sport === 'swim') {
    const p = pacePer100m(a.durationSec, a.distanceM);
    return `${formatDistance(a.distanceM, 'auto-swim')}${p ? `, ${formatPace(p)} /100 m` : ''}`;
  }
  if (a.sport === 'run') {
    const p = pacePerKm(a.durationSec, a.distanceM);
    return `${formatDistance(a.distanceM)}${p ? `, ${formatPace(p)} /km` : ''}`;
  }
  if (a.sport === 'bike') {
    const v = speedKmh(a.durationSec, a.distanceM);
    return `${formatDistance(a.distanceM)}${v ? `, ${formatNumber(v)} km/h` : ''}`;
  }
  return formatDistance(a.distanceM);
}

export function ActivityRow({ a, onClick, showDate = true }: { a: CompletedActivity; onClick: () => void; showDate?: boolean }) {
  const d = detail(a);
  const parts = [
    showDate ? formatWeekdayDayMonthDe(a.date) : null,
    d ?? (a.sport === 'swim' || a.sport === 'bike' || a.sport === 'run' ? 'ohne Distanz' : null),
    a.rpe !== undefined ? `RPE ${a.rpe}` : null,
    hasAnyZoneTime(a.zoneSec) ? 'Zonen erfasst' : null,
  ].filter(Boolean);
  return (
    <button type="button" onClick={onClick} className="flex w-full items-center gap-3 rounded-2xl px-1 py-2.5 text-left active:bg-surface-2">
      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${SPORT_BG_CLASS[a.sport]} text-white`}>
        <SportIcon sport={a.sport} title={SPORT_LABEL[a.sport]} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-semibold">
          {a.sport === 'other' && a.label ? a.label : SESSION_FOCUS_LABEL[a.focus]}
          <span className="font-normal text-muted"> {SPORT_LABEL[a.sport]}</span>
        </span>
        <span className="block truncate text-sm text-muted">
          {parts.join(', ')}
        </span>
      </span>
      <span className="num shrink-0 font-semibold">{formatDurationShort(a.durationSec)}</span>
      <IconChevron className="h-4 w-4 shrink-0 text-muted" />
    </button>
  );
}
