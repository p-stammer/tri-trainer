/* Erinnerung „Leistungstest fällig“ auf „Heute“ – ausblendbar je Woche, nicht im Taper. */
import { Button } from './ui';
import { useLive, useNav, useRepo } from '../state';
import type { ActiveContext } from '../../data/usecases';
import type { AppSettings } from '../../domain/schemas';
import { compareDates, formatDateDe, startOfWeek, type LocalDate } from '../../domain/calendar';
import { testsDue } from '../../domain/performanceTests';
import { SPORT_LABEL } from '../../domain/sports';

export function TestReminderCard({ ctx, settings, today }: { ctx: ActiveContext; settings: AppSettings; today: LocalDate }) {
  const repo = useRepo();
  const { navigate } = useNav();
  const metrics = useLive((r) => r.listMetrics(), []);
  const thisWeek = startOfWeek(today);
  if (!metrics || settings.testReminderDismissedWeek === thisWeek) return null;
  if (compareDates(ctx.race.date, today) < 0) return null;
  const phase = ctx.weeks.find((w) => w.weekStart === thisWeek)?.current.phase;
  const due = testsDue(metrics, today, phase);
  if (due.length === 0) return null;
  const nextRecovery = ctx.weeks.find((w) => compareDates(w.weekStart, thisWeek) >= 0 && w.current.phase === 'recovery');
  return (
    <section className="rounded-3xl border border-line bg-surface p-4" aria-label="Leistungstest fällig">
      <p className="font-semibold">Leistungstest fällig</p>
      <p className="mt-1 text-sm">
        {due.map((d) => `${SPORT_LABEL[d.sport]} (${d.ageDays === null ? 'noch kein Wert' : `letzter vor ${Math.floor(d.ageDays / 7)} Wochen`})`).join(', ')}
      </p>
      <p className="mt-1 text-xs text-muted">
        {nextRecovery?.weekStart === thisWeek
          ? 'Diese Woche ist eine Entlastungswoche – ausgeruht ist ein guter Zeitpunkt zum Testen.'
          : `Am besten ausgeruht testen, z. B. am Ende einer Entlastungswoche${nextRecovery ? ` (nächste ab ${formatDateDe(nextRecovery.weekStart, false)})` : ''}.`}{' '}
        Neue Werte aktualisieren deine Zonen.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button variant="secondary" onClick={() => navigate({ name: 'tests' })}>
          Zu den Tests
        </Button>
        <Button variant="ghost" onClick={() => void repo.updateSettings({ testReminderDismissedWeek: thisWeek })}>
          Diese Woche nicht
        </Button>
      </div>
    </section>
  );
}
