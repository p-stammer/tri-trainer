/*
 * Umfangsverlauf des Plans: gestapelte Wochenbalken je Sportart, seitlich scrollbar, Auflösung 4 / 12 Wochen / alle.
 * Jede Woche zeigt ihre Gesamtsumme direkt über dem Balken (keine Hilfslinien), Wettkämpfe sind markiert,
 * absolvierte Zeit erscheint als dunkle Marke. Antippen zeigt die Woche ausgeschrieben unter dem Diagramm.
 */
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Segmented } from './ui';
import { Legend } from './charts';
import { addDays, formatWeekRangeDe, isoWeek, startOfWeek, type LocalDate } from '../../domain/calendar';
import { PLANNED_SPORTS, SPORT_SHORT, type PlannedSport } from '../../domain/sports';
import { formatDurationShort } from '../../domain/units';

export interface TimelineWeek {
  weekStart: LocalDate;
  planned: Partial<Record<PlannedSport, number>>;
  /** Kurzbeschreibung der Woche, z. B. „Aufbau“ oder „Entlastung“. */
  label?: string;
  /** Absolvierte Zeit (nur vergangene/aktuelle Wochen). */
  doneSec?: number;
  /** Erklärende Zusätze (z. B. Gründe aus dem Planvorschlag). */
  details?: string[];
}

export interface TimelineMarker {
  weekStart: LocalDate;
  label: string;
  main?: boolean;
  /** Trainingslager statt Wettkampf (seit 0.21.0) */
  camp?: boolean;
}

/** Markierungen für ein Trainingslager: jede Woche, die es berührt. */
export function campMarkers(camps: readonly { name: string; startDate: LocalDate; endDate: LocalDate }[]): TimelineMarker[] {
  const out: TimelineMarker[] = [];
  for (const c of camps) {
    for (let ws = startOfWeek(c.startDate); ws <= c.endDate; ws = addDays(ws, 7)) out.push({ weekStart: ws, label: c.name, camp: true });
  }
  return out;
}

type Resolution = '4' | '12' | 'all';

const BG: Record<PlannedSport, string> = { swim: 'bg-swim', bike: 'bg-bike', run: 'bg-run', strength: 'bg-strength' };
const BAR_AREA = 150;
/** Höhe über dem Balkenbereich: Wettkampf-Zeile (20 px) + Summen-Zeile (16 px). */
const TOP = 36;

/** Achsenschritt in Stunden: grob, damit man ablesen kann (5, 10, 15 … h), bei kleinen Umfängen feiner. */
function axisStep(maxSec: number): number {
  const h = maxSec / 3600;
  return h > 12 ? 5 : h > 5 ? 2 : 1;
}

function hours(sec: number, withUnit: boolean): string {
  const h = sec / 3600;
  const n = h.toLocaleString('de-DE', { maximumFractionDigits: h < 10 ? 1 : 0 });
  return withUnit ? `${n} h` : n;
}

export function VolumeTimeline({
  weeks,
  markers = [],
  currentWeek,
  initial = '12',
  ariaLabel,
}: {
  weeks: readonly TimelineWeek[];
  markers?: readonly TimelineMarker[];
  currentWeek?: LocalDate;
  initial?: Resolution;
  ariaLabel: string;
}) {
  const [res, setRes] = useState<Resolution>(initial);
  const [selected, setSelected] = useState<LocalDate | null>(currentWeek && weeks.some((w) => w.weekStart === currentWeek) ? currentWeek : (weeks[0]?.weekStart ?? null));
  const scroller = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(340);

  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const update = () => setWidth(el.clientWidth || 340);
    update();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const visible = res === 'all' ? Math.max(1, weeks.length) : Number(res);
  const colW = Math.max(res === 'all' ? 8 : 28, width / visible);
  const showTotals = colW >= 24;
  const unit = colW >= 40;
  const totals = weeks.map((w) => PLANNED_SPORTS.reduce((a, s) => a + (w.planned[s] ?? 0), 0));
  const rawMax = Math.max(1, ...totals, ...weeks.map((w) => w.doneSec ?? 0));
  const step = axisStep(rawMax);
  const max = Math.ceil(rawMax / (step * 3600)) * step * 3600;
  const ticks = Array.from({ length: Math.round(max / (step * 3600)) + 1 }, (_, i) => i * step);
  const markerByWeek = new Map<string, TimelineMarker[]>();
  for (const m of markers) markerByWeek.set(m.weekStart, [...(markerByWeek.get(m.weekStart) ?? []), m]);

  // Beim Öffnen und bei Wechsel der Auflösung zur aktuellen (bzw. ausgewählten) Woche scrollen.
  useEffect(() => {
    const el = scroller.current;
    const target = selected ?? currentWeek;
    if (!el || !target) return;
    const idx = weeks.findIndex((w) => w.weekStart === target);
    if (idx < 0) return;
    el.scrollLeft = Math.max(0, idx * colW - colW * (res === '4' ? 0 : 1));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [res, colW]);

  const sel = weeks.find((w) => w.weekStart === selected);
  const selTotal = sel ? PLANNED_SPORTS.reduce((a, s) => a + (sel.planned[s] ?? 0), 0) : 0;
  const hasDone = weeks.some((w) => (w.doneSec ?? 0) > 0);

  return (
    <div>
      <div className="mb-3">
        <Segmented
          ariaLabel="Zeitraum"
          value={res}
          onChange={setRes}
          options={[
            { value: '4', label: '4 Wochen' },
            { value: '12', label: '12 Wochen' },
            { value: 'all', label: 'Alle' },
          ]}
        />
      </div>
      <Legend
        items={[
          ...PLANNED_SPORTS.map((s) => ({ label: SPORT_SHORT[s], swatchClass: BG[s] })),
          ...(hasDone ? [{ label: 'Absolviert', swatchClass: 'bg-ink', kind: 'tick' as const }] : []),
          ...(markers.some((m) => !m.camp) ? [{ label: '⚑ Wettkampf', swatchClass: 'bg-warn', kind: 'bar' as const }] : []),
          ...(markers.some((m) => m.camp) ? [{ label: '⛺ Trainingslager', swatchClass: 'bg-ok', kind: 'bar' as const }] : []),
        ]}
      />
      {showTotals && !unit && <p className="-mt-1 mb-1 text-xs text-muted">Zahlen über den Balken: Stunden pro Woche</p>}
      <div className="flex">
      <div className="relative w-8 shrink-0" aria-hidden style={{ height: TOP + BAR_AREA }}>
        {ticks.map((t) => (
          <span key={t} className="num absolute right-1 text-[10px] leading-none text-muted" style={{ top: TOP + BAR_AREA - (t * 3600 / max) * BAR_AREA - 5 }}>
            {t} h
          </span>
        ))}
      </div>
      <div
        ref={scroller}
        className="min-w-0 flex-1 overflow-x-auto overscroll-x-contain pb-1"
        style={{ scrollSnapType: res === 'all' ? undefined : 'x mandatory', WebkitOverflowScrolling: 'touch' }}
        role="group"
        aria-label={ariaLabel}
      >
        <div className="relative flex items-end" style={{ width: Math.max(width, colW * weeks.length) }}>
          {ticks.map((t) => (
            <span
              key={t}
              aria-hidden
              className={`pointer-events-none absolute left-0 right-0 ${t === 0 ? 'border-t border-muted/50' : 'border-t border-line'}`}
              style={{ top: TOP + BAR_AREA - (t * 3600 / max) * BAR_AREA }}
            />
          ))}
          {weeks.map((w, i) => {
            const total = totals[i] ?? 0;
            const isSel = w.weekStart === selected;
            const isCurrent = w.weekStart === currentWeek;
            const ms = markerByWeek.get(w.weekStart) ?? [];
            const done = w.doneSec ?? 0;
            const kw = isoWeek(w.weekStart).week;
            return (
              <button
                key={w.weekStart}
                type="button"
                onClick={() => setSelected(w.weekStart)}
                aria-pressed={isSel}
                aria-label={`KW ${kw}: ${formatDurationShort(total)} geplant${done ? `, ${formatDurationShort(done)} absolviert` : ''}${ms.length ? `, ${ms.map((m) => m.label).join(', ')}` : ''}`}
                className={`relative flex shrink-0 flex-col items-center rounded-lg ${isSel ? 'bg-surface-2/70' : ''}`}
                style={{ width: colW, scrollSnapAlign: 'start' }}
              >
                <span className={`flex h-5 items-end justify-center text-[10px] font-semibold ${ms[0]?.camp ? 'text-ok' : 'text-warn'}`}>
                  {ms.length > 0 &&
                    (colW >= 44 ? (
                      <span className="max-w-full truncate px-0.5" style={{ maxWidth: colW - 2 }}>
                        {ms[0]?.camp ? '⛺' : '⚑'} {ms[0]?.label}
                      </span>
                    ) : (
                      <span aria-hidden>{ms[0]?.camp ? '⛺' : '⚑'}</span>
                    ))}
                </span>
                <span className="num h-4 text-[11px] font-semibold leading-4 text-ink">{showTotals || isSel ? (total > 0 ? hours(total, unit) : '–') : ''}</span>
                <span className="relative flex w-full justify-center" style={{ height: BAR_AREA }}>
                  <span className="flex h-full flex-col-reverse items-stretch" style={{ width: Math.max(4, Math.min(28, colW - (colW > 20 ? 10 : 3))) }}>
                    {PLANNED_SPORTS.map((s) => {
                      const v = w.planned[s] ?? 0;
                      if (v <= 0) return null;
                      return <span key={s} className={`${BG[s]} border-t-2 border-surface first:rounded-b-[2px] last:rounded-t-[4px]`} style={{ height: (v / max) * BAR_AREA }} />;
                    })}
                  </span>
                  {done > 0 && (
                    <span className="absolute h-0.5 bg-ink" style={{ bottom: (done / max) * BAR_AREA, width: Math.max(8, Math.min(36, colW - 4)) }} aria-hidden />
                  )}
                </span>
                <span className={`num mt-1 h-4 text-[10px] leading-4 ${isCurrent ? 'font-bold text-ink' : 'text-muted'}`}>
                  {colW >= 22 || i % Math.ceil(22 / colW) === 0 ? kw : isCurrent ? <span className="mx-auto mt-1.5 block h-1 w-1 rounded-full bg-ink" aria-hidden /> : ''}
                </span>
              </button>
            );
          })}
        </div>
      </div>
      </div>
      {sel && (
        <div className="num mt-3 rounded-xl bg-surface-2 p-3 text-sm" aria-live="polite">
          <p className="font-semibold">
            KW {isoWeek(sel.weekStart).week} · {formatWeekRangeDe(sel.weekStart)}
            {sel.label ? ` · ${sel.label}` : ''}
          </p>
          <p className="mt-1">
            Geplant <span className="font-semibold">{formatDurationShort(selTotal)}</span>
            {selTotal > 0 &&
              `: ${PLANNED_SPORTS.filter((s) => (sel.planned[s] ?? 0) > 0)
                .map((s) => `${SPORT_SHORT[s]} ${formatDurationShort(sel.planned[s] ?? 0)}`)
                .join(' · ')}`}
          </p>
          {sel.doneSec !== undefined && sel.doneSec > 0 && (
            <p className="mt-0.5">
              Absolviert <span className="font-semibold">{formatDurationShort(sel.doneSec)}</span>
            </p>
          )}
          {(markerByWeek.get(sel.weekStart) ?? []).map((m) => (
            <p key={m.label} className={`mt-0.5 ${m.camp ? 'text-ok' : 'text-warn'}`}>
              {m.camp ? '⛺ Trainingslager' : `⚑ ${m.main ? 'Wettkampf' : 'Vorbereitungswettkampf'}`}: {m.label}
            </p>
          ))}
          {sel.details?.length ? <p className="mt-1 text-xs text-muted">{sel.details.join(' · ')}</p> : null}
        </div>
      )}
    </div>
  );
}
