/* Vorher/Nachher-Darstellung von Planänderungen je Woche (für Vorschläge und Sammeländerungen). */
import { Section } from './ui';
import type { WeekTargets, WeeklySportTarget } from '../../domain/schemas';
import type { PlanWeekChange } from '../../domain/planEdit';
import { canonical } from '../../domain/planEdit';
import { PHASE_LABEL, PLANNED_SPORTS, SPORT_LABEL } from '../../domain/sports';
import { formatWeekRangeDe, isoWeek } from '../../domain/calendar';
import { formatDistance, formatDurationShort } from '../../domain/units';

export function describeTarget(t: WeeklySportTarget | undefined): string {
  if (!t) return '–';
  const parts = [
    t.durationSec !== undefined ? formatDurationShort(t.durationSec) : null,
    t.distanceM !== undefined ? formatDistance(t.distanceM, t.sport === 'swim' ? 'auto-swim' : 'km') : null,
    t.sessions !== undefined ? `${t.sessions}×` : null,
  ].filter(Boolean);
  return parts.join(', ') || '–';
}

function lines(before: WeekTargets, after: WeekTargets): { label: string; from: string; to: string }[] {
  const out: { label: string; from: string; to: string }[] = [];
  if ((before.phase ?? '') !== (after.phase ?? '')) {
    out.push({ label: 'Phase', from: before.phase ? PHASE_LABEL[before.phase] : 'keine', to: after.phase ? PHASE_LABEL[after.phase] : 'keine' });
  }
  for (const s of PLANNED_SPORTS) {
    const b = before.sports.find((x) => x.sport === s);
    const a = after.sports.find((x) => x.sport === s);
    if (canonical(b) !== canonical(a)) {
      const zoneOnly = describeTarget(b) === describeTarget(a);
      out.push({ label: SPORT_LABEL[s] + (zoneOnly ? ' (Zonenziele)' : ''), from: describeTarget(b), to: zoneOnly ? 'geändert' : describeTarget(a) });
    }
  }
  if (before.focuses.length !== after.focuses.length || canonical(before.focuses.map((f) => [f.sport, f.focus, f.count, f.note])) !== canonical(after.focuses.map((f) => [f.sport, f.focus, f.count, f.note]))) {
    out.push({ label: 'Schwerpunkte', from: `${before.focuses.length}`, to: `${after.focuses.length}` });
  }
  const fb = before.freshnessTarget ? `${before.freshnessTarget.min}–${before.freshnessTarget.max}` : 'keiner';
  const fa = after.freshnessTarget ? `${after.freshnessTarget.min}–${after.freshnessTarget.max}` : 'keiner';
  if (fb !== fa) out.push({ label: 'Frischebereich', from: fb, to: fa });
  if ((before.notes ?? '') !== (after.notes ?? '')) out.push({ label: 'Notizen', from: before.notes ? 'vorhanden' : 'keine', to: after.notes ? 'geändert' : 'keine' });
  return out;
}

export function WeekDiffList({ changes, aside }: { changes: readonly PlanWeekChange[]; aside?: (c: PlanWeekChange) => string | undefined }) {
  // Viele Wochen: kompakte Liste statt einer Karte je Woche
  if (changes.length > 3) {
    return (
      <Section title={`${changes.length} Wochen`}>
        <ul className="flex flex-col">
          {changes.map((c) => (
            <li key={c.weekStart} className="border-t border-line py-2 text-sm first:border-t-0">
              <span className="font-semibold">KW {isoWeek(c.weekStart).week}</span>
              {aside?.(c) ? <span className="text-muted"> ({aside(c)})</span> : null}
              <span className="num block text-muted">
                {lines(c.before, c.after)
                  .map((l) => `${l.label}: ${l.from} → ${l.to}`)
                  .join('; ')}
              </span>
            </li>
          ))}
        </ul>
      </Section>
    );
  }
  return (
    <>
      {changes.map((c) => (
        <Section key={c.weekStart} title={`KW ${isoWeek(c.weekStart).week}`} aside={aside?.(c) ?? formatWeekRangeDe(c.weekStart)}>
          <ul className="flex flex-col gap-1 text-sm">
            {lines(c.before, c.after).map((l) => (
              <li key={l.label} className="num flex justify-between gap-3">
                <span>{l.label}</span>
                <span className="text-right">
                  <span className="text-muted line-through">{l.from}</span> → <span className="font-semibold">{l.to}</span>
                </span>
              </li>
            ))}
          </ul>
        </Section>
      ))}
    </>
  );
}
