import { useState } from 'react';
import { Button, Chip, Screen, Section, Segmented } from '../components/ui';
import { SPORT_TEXT_CLASS, SportIcon, IconChevron } from '../components/icons';
import { WeekDiffList } from '../components/WeekDiff';
import { VolumeTimeline, campMarkers, type TimelineWeek } from '../components/VolumeTimeline';
import { errorText, useLive, useNav, useRepo, useToast, useToday } from '../state';
import { commitWeekChanges, undoPlanChange, type ActiveContext } from '../../data/usecases';
import type { AppSettings, CompletedActivity, PlanChange, PlanChangeKind, TrainingWeek } from '../../domain/schemas';
import { compareDates, formatDateDe, formatWeekRangeDe, isoWeek, localDateInTimeZone, startOfWeek } from '../../domain/calendar';
import { PHASE_LABEL, PHASE_TYPES, PLANNED_SPORTS, SPORT_LABEL, SPORT_SHORT, type PhaseType, type PlannedSport } from '../../domain/sports';
import { formatDistance, formatDurationShort } from '../../domain/units';
import { isEmptyTargets, plannedDurationTotal } from '../../domain/plan';
import { bulkCopyFrom, bulkScale, bulkSetFreshness, bulkSetPhase, canUndo, sameTargets, type PlanWeekChange } from '../../domain/planEdit';

type BulkAction = 'phase' | 'scale' | 'copy' | 'freshness';

export function PlanOverview({ ctx, settings }: { ctx: ActiveContext; settings: AppSettings }) {
  const { navigate } = useNav();
  const today = useToday(settings.timeZone);
  const current = startOfWeek(today);
  const data = useLive(
    async (repo) => ({ acts: await repo.listActivities(), history: await repo.listPlanChanges(ctx.plan.id), prepRaces: await repo.listPrepRaces(ctx.plan.id), camps: await repo.listTrainingCamps(ctx.plan.id) }),
    [ctx.plan.id],
  );
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);

  const doneByWeek = new Map<string, number>();
  for (const a of data?.acts ?? []) {
    const ws = startOfWeek(a.date);
    doneByWeek.set(ws, (doneByWeek.get(ws) ?? 0) + a.durationSec);
  }

  const raceWeek = startOfWeek(ctx.race.date);
  const prepWeek = startOfWeek(ctx.race.prepStartDate);
  const inRange = ctx.weeks.filter((w) => compareDates(w.weekStart, prepWeek) >= 0 && compareDates(w.weekStart, raceWeek) <= 0);
  const outside = ctx.weeks.length - inRange.length;
  const toggle = (ws: string) => setSelected((s) => (s.includes(ws) ? s.filter((x) => x !== ws) : [...s, ws].sort()));

  return (
    <Screen
      title="Trainingsplan"
      subtitle={`${inRange.length} Wochen bis ${ctx.race.name}`}
      actions={
        <Button
          variant={selectMode ? 'primary' : 'secondary'}
          onClick={() => {
            setSelectMode(!selectMode);
            setSelected([]);
          }}
        >
          {selectMode ? 'Fertig' : 'Auswählen'}
        </Button>
      }
    >
      {outside > 0 && (
        <p className="rounded-2xl bg-surface p-3 text-sm text-muted">
          {outside} {outside === 1 ? 'Woche liegt' : 'Wochen liegen'} nach einer Datumsänderung außerhalb des Planzeitraums. Die Daten bleiben gespeichert.
        </p>
      )}

      {!selectMode && inRange.every((w) => isEmptyTargets(w.current)) && (
        <Section title="Noch keine Wochenziele">
          <p className="text-sm text-muted">
            Lass dir einen Plan vorschlagen – er startet bei deinem aktuellen Umfang und steigert sicher bis zum Wettkampf. Oder übernimm einen Plan von deinem Coach aus einer Tabelle.
          </p>
          <div className="mt-3 flex flex-col gap-2">
            <Button onClick={() => navigate({ name: 'planGenerate' })}>Plan vorschlagen lassen</Button>
            <Button variant="secondary" onClick={() => navigate({ name: 'planImport' })}>
              Plan importieren
            </Button>
          </div>
        </Section>
      )}

      {!selectMode && inRange.some((w) => !isEmptyTargets(w.current)) && (
        <Section title="Umfangsverlauf">
          <VolumeTimeline
            ariaLabel="Geplanter Wochenumfang je Sportart"
            currentWeek={current}
            weeks={inRange.map((w) => {
              const planned: Partial<Record<PlannedSport, number>> = {};
              for (const t of w.current.sports) if (t.durationSec) planned[t.sport] = t.durationSec;
              const tw: TimelineWeek = { weekStart: w.weekStart, planned };
              if (w.current.phase) tw.label = PHASE_LABEL[w.current.phase];
              if (compareDates(w.weekStart, current) <= 0) tw.doneSec = doneByWeek.get(w.weekStart) ?? 0;
              return tw;
            })}
            markers={[
              ...(data?.prepRaces ?? []).map((r) => ({ weekStart: startOfWeek(r.date), label: r.name })),
              { weekStart: raceWeek, label: ctx.race.name, main: true },
              ...campMarkers(data?.camps ?? []),
            ]}
          />
        </Section>
      )}

      {selectMode && (
        <BulkPanel
          ctx={ctx}
          weeks={inRange}
          current={current}
          selected={selected}
          setSelected={setSelected}
          onDone={() => {
            setSelectMode(false);
            setSelected([]);
          }}
        />
      )}

      <ol className="flex flex-col gap-2">
        {inRange.map((w, i) => (
          <li key={w.id}>
            <WeekCard
              week={w}
              index={i + 1}
              isCurrent={w.weekStart === current}
              isPast={compareDates(w.weekStart, current) < 0}
              doneSec={doneByWeek.get(w.weekStart) ?? 0}
              acts={data?.acts}
              selectable={selectMode}
              selected={selected.includes(w.weekStart)}
              onClick={() => (selectMode ? toggle(w.weekStart) : navigate({ name: 'week', weekStart: w.weekStart }))}
            />
          </li>
        ))}
      </ol>

      {!selectMode && (
        <div className="flex flex-col gap-2">
          <Button variant="secondary" full onClick={() => navigate({ name: 'planGenerate' })}>
            Plan vorschlagen lassen …
          </Button>
          <Button variant="secondary" full onClick={() => navigate({ name: 'planImport' })}>
            Plan importieren (CSV, JSON, Tabelle) …
          </Button>
        </div>
      )}

      {data && data.history.length > 0 && <HistorySection history={data.history} weeks={ctx.weeks} timeZone={settings.timeZone} />}
    </Screen>
  );
}

function BulkPanel({
  ctx,
  weeks,
  current,
  selected,
  setSelected,
  onDone,
}: {
  ctx: ActiveContext;
  weeks: TrainingWeek[];
  current: string;
  selected: string[];
  setSelected: (s: string[]) => void;
  onDone: () => void;
}) {
  const repo = useRepo();
  const toast = useToast();
  const [action, setAction] = useState<BulkAction>('phase');
  const [phase, setPhase] = useState<PhaseType | ''>('base');
  const [factor, setFactor] = useState(0.9);
  const [sports, setSports] = useState<PlannedSport[]>([...PLANNED_SPORTS]);
  const [source, setSource] = useState<string>(weeks.find((w) => w.current.sports.length > 0)?.weekStart ?? '');
  const [fMin, setFMin] = useState(5);
  const [fMax, setFMax] = useState(7);
  const [clearFresh, setClearFresh] = useState(false);
  const [preview, setPreview] = useState<{ changes: PlanWeekChange[]; kind: PlanChangeKind; description: string } | null>(null);
  const [from, setFrom] = useState(weeks.find((w) => compareDates(w.weekStart, current) >= 0)?.weekStart ?? weeks[0]?.weekStart ?? '');
  const [to, setTo] = useState(weeks[weeks.length - 1]?.weekStart ?? '');

  const chosen = weeks.filter((w) => selected.includes(w.weekStart));
  const label = (ws: string) => `KW ${isoWeek(ws).week} (${formatWeekRangeDe(ws).split(' – ')[0]})`;

  function compute() {
    let changes: PlanWeekChange[] = [];
    let kind: PlanChangeKind = 'bulk_phase';
    let description = '';
    const n = chosen.length;
    if (action === 'phase') {
      changes = bulkSetPhase(chosen, phase || undefined);
      kind = 'bulk_phase';
      description = `${phase ? PHASE_LABEL[phase] : 'Keine Phase'} für ${n} Wochen`;
    } else if (action === 'scale') {
      changes = bulkScale(chosen, factor, sports);
      kind = 'bulk_scale';
      const pct = Math.round((factor - 1) * 100);
      description = `Umfang ${pct > 0 ? '+' : '−'}${Math.abs(pct)} % (${sports.length === PLANNED_SPORTS.length ? 'alle Sportarten' : sports.map((s) => SPORT_SHORT[s]).join(', ')}) für ${n} Wochen`;
    } else if (action === 'copy') {
      const src = weeks.find((w) => w.weekStart === source);
      if (!src) return toast('Bitte eine Quellwoche wählen.', 'error');
      changes = bulkCopyFrom(chosen, src);
      kind = 'bulk_copy';
      description = `Ziele aus KW ${isoWeek(src.weekStart).week} in ${changes.length} Wochen übernommen`;
    } else {
      changes = bulkSetFreshness(chosen, clearFresh ? undefined : { min: fMin, max: fMax });
      kind = 'bulk_freshness';
      description = clearFresh ? `Frischebereich entfernt (${n} Wochen)` : `Frischebereich ${Math.min(fMin, fMax)}–${Math.max(fMin, fMax)} für ${n} Wochen`;
    }
    if (changes.length === 0) {
      toast('Mit diesen Einstellungen ändert sich nichts.');
      return;
    }
    setPreview({ changes, kind, description });
  }

  async function apply() {
    if (!preview) return;
    try {
      const updated = await commitWeekChanges(repo, ctx.plan.id, preview.changes, preview.kind, preview.description);
      toast(`${updated.length} ${updated.length === 1 ? 'Woche' : 'Wochen'} geändert`);
      setPreview(null);
      onDone();
    } catch (e) {
      toast(errorText(e), 'error');
    }
  }

  if (preview) {
    return (
      <>
        <Section title="Vorschau">
          <p className="text-sm">{preview.description}</p>
          <p className="mt-1 text-xs text-muted">Absolvierte Einheiten bleiben unverändert. Die Änderung erscheint im Änderungsverlauf und lässt sich dort rückgängig machen.</p>
          <div className="mt-3 flex gap-2">
            <Button onClick={() => void apply()}>Übernehmen</Button>
            <Button variant="ghost" onClick={() => setPreview(null)}>
              Zurück
            </Button>
          </div>
        </Section>
        <WeekDiffList changes={preview.changes} />
        <div className="flex gap-2">
          <Button onClick={() => void apply()}>Übernehmen</Button>
          <Button variant="ghost" onClick={() => setPreview(null)}>
            Zurück
          </Button>
        </div>
      </>
    );
  }

  return (
    <Section title="Mehrere Wochen bearbeiten" aside={`${selected.length} ausgewählt`}>
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium text-muted">Zeitraum auswählen oder Wochen unten antippen</span>
          <div className="grid grid-cols-2 gap-2">
            <select aria-label="Von Woche" value={from} onChange={(e) => setFrom(e.target.value)} className="min-h-11 rounded-xl border border-line bg-surface-2 px-2 text-[15px]">
              {weeks.map((w) => (
                <option key={w.weekStart} value={w.weekStart}>
                  ab {label(w.weekStart)}
                </option>
              ))}
            </select>
            <select aria-label="Bis Woche" value={to} onChange={(e) => setTo(e.target.value)} className="min-h-11 rounded-xl border border-line bg-surface-2 px-2 text-[15px]">
              {weeks.map((w) => (
                <option key={w.weekStart} value={w.weekStart}>
                  bis {label(w.weekStart)}
                </option>
              ))}
            </select>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setSelected(weeks.filter((w) => compareDates(w.weekStart, from) >= 0 && compareDates(w.weekStart, to) <= 0).map((w) => w.weekStart))}>
              Zeitraum wählen
            </Button>
            <Button variant="ghost" onClick={() => setSelected([])}>
              Keine
            </Button>
          </div>
        </div>

        <Segmented<BulkAction>
          ariaLabel="Aktion"
          value={action}
          onChange={setAction}
          options={[
            { value: 'phase', label: 'Phase' },
            { value: 'scale', label: 'Umfang' },
            { value: 'copy', label: 'Kopieren' },
            { value: 'freshness', label: 'Frische' },
          ]}
        />

        {action === 'phase' && (
          <select aria-label="Neue Phase" value={phase} onChange={(e) => setPhase(e.target.value as PhaseType | '')} className="min-h-12 rounded-xl border border-line bg-surface-2 px-3">
            <option value="">Keine Phase</option>
            {PHASE_TYPES.map((p) => (
              <option key={p} value={p}>
                {PHASE_LABEL[p]}
              </option>
            ))}
          </select>
        )}

        {action === 'scale' && (
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-4 gap-2">
              {[0.8, 0.9, 1.1, 1.2].map((f) => (
                <Chip key={f} active={factor === f} onClick={() => setFactor(f)}>
                  {f < 1 ? `−${Math.round((1 - f) * 100)} %` : `+${Math.round((f - 1) * 100)} %`}
                </Chip>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              {PLANNED_SPORTS.map((s) => (
                <Chip key={s} active={sports.includes(s)} onClick={() => setSports(sports.includes(s) ? sports.filter((x) => x !== s) : [...sports, s])}>
                  {SPORT_SHORT[s]}
                </Chip>
              ))}
            </div>
            <p className="text-xs text-muted">Skaliert Dauer, Distanz und Zonenziele. Anzahl der Einheiten bleibt gleich.</p>
          </div>
        )}

        {action === 'copy' && (
          <select aria-label="Quellwoche" value={source} onChange={(e) => setSource(e.target.value)} className="min-h-12 rounded-xl border border-line bg-surface-2 px-3">
            <option value="">Quellwoche wählen</option>
            {weeks
              .filter((w) => w.current.sports.length > 0 || w.current.focuses.length > 0)
              .map((w) => (
                <option key={w.weekStart} value={w.weekStart}>
                  Ziele aus {label(w.weekStart)}
                </option>
              ))}
          </select>
        )}

        {action === 'freshness' && (
          <div className="flex flex-col gap-2">
            {!clearFresh && (
              <div className="grid grid-cols-2 gap-2">
                <select aria-label="Frische von" value={fMin} onChange={(e) => setFMin(Number(e.target.value))} className="min-h-12 rounded-xl border border-line bg-surface-2 px-3">
                  {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                    <option key={n} value={n}>
                      von {n}
                    </option>
                  ))}
                </select>
                <select aria-label="Frische bis" value={fMax} onChange={(e) => setFMax(Number(e.target.value))} className="min-h-12 rounded-xl border border-line bg-surface-2 px-3">
                  {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                    <option key={n} value={n}>
                      bis {n}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={clearFresh} onChange={(e) => setClearFresh(e.target.checked)} className="h-5 w-5" />
              Frischebereich entfernen
            </label>
          </div>
        )}

        <Button full disabled={selected.length === 0} onClick={compute}>
          Vorschau anzeigen
        </Button>
      </div>
    </Section>
  );
}

function HistorySection({ history, weeks, timeZone }: { history: PlanChange[]; weeks: TrainingWeek[]; timeZone: string }) {
  const repo = useRepo();
  const toast = useToast();
  const [showAll, setShowAll] = useState(false);
  const shown = showAll ? history : history.slice(0, 5);
  const fmt = (iso: string) => {
    const d = new Date(iso);
    const time = new Intl.DateTimeFormat('de-DE', { timeZone, hour: '2-digit', minute: '2-digit' }).format(d);
    return `${formatDateDe(localDateInTimeZone(d, timeZone), false)}, ${time}`;
  };
  return (
    <Section title="Änderungsverlauf" aside={`${history.length}`}>
      <ul className="flex flex-col">
        {shown.map((h) => {
          const undoable = canUndo(h, weeks);
          return (
            <li key={h.id} className="flex items-center gap-3 border-t border-line py-2.5 first:border-t-0">
              <span className="min-w-0 flex-1">
                <span className="block text-[15px]">{h.description}</span>
                <span className="num block text-xs text-muted">
                  {fmt(h.createdAt)}, {h.weeks.length} {h.weeks.length === 1 ? 'Woche' : 'Wochen'}
                </span>
              </span>
              {undoable && (
                <Button
                  variant="ghost"
                  onClick={() =>
                    void undoPlanChange(repo, h).then(
                      () => toast('Rückgängig gemacht'),
                      (e: unknown) => toast(errorText(e), 'error'),
                    )
                  }
                >
                  Rückgängig
                </Button>
              )}
            </li>
          );
        })}
      </ul>
      {history.length > 5 && (
        <Button variant="ghost" onClick={() => setShowAll(!showAll)}>
          {showAll ? 'Weniger anzeigen' : `Alle ${history.length} anzeigen`}
        </Button>
      )}
      <p className="mt-1 text-xs text-muted">Rückgängig geht nur, solange die betroffenen Wochen danach nicht weiter geändert wurden.</p>
    </Section>
  );
}

function WeekCard({
  week,
  index,
  isCurrent,
  isPast,
  doneSec,
  acts,
  selectable,
  selected,
  onClick,
}: {
  week: TrainingWeek;
  index: number;
  isCurrent: boolean;
  isPast: boolean;
  doneSec: number;
  acts: CompletedActivity[] | undefined;
  selectable: boolean;
  selected: boolean;
  onClick: () => void;
}) {
  const t = week.current;
  const planned = plannedDurationTotal(t);
  const changed = !!week.original && !sameTargets(week.original, week.current);
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={isCurrent ? 'date' : undefined}
      aria-pressed={selectable ? selected : undefined}
      className={`flex w-full items-center gap-3 rounded-3xl bg-surface p-4 text-left ${isCurrent ? 'ring-2 ring-ink' : ''} ${selected ? 'outline-2 outline-swim' : ''} ${isPast && !selectable ? 'opacity-70' : ''}`}
    >
      {selectable && (
        <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 text-sm font-bold ${selected ? 'border-swim bg-swim text-white' : 'border-line'}`} aria-hidden>
          {selected ? '✓' : ''}
        </span>
      )}
      <div className="w-12 shrink-0 text-center">
        <div className="num text-[22px] font-bold leading-none">{index}</div>
        <div className="mt-1 text-[11px] text-muted">KW {isoWeek(week.weekStart).week}</div>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <span className="font-semibold">{formatWeekRangeDe(week.weekStart)}</span>
          {isCurrent && <span className="text-xs font-semibold">diese Woche</span>}
        </div>
        <div className="text-sm text-muted">
          {t.phase ? PHASE_LABEL[t.phase] : 'Keine Phase'}
          {changed && ', geändert'}
        </div>
        {t.sports.length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-sm">
            {t.sports.map((s) => (
              <span key={s.sport} className="num inline-flex items-center gap-1">
                <span className={SPORT_TEXT_CLASS[s.sport]}>
                  <SportIcon sport={s.sport} className="h-4 w-4" title={SPORT_LABEL[s.sport]} />
                </span>
                {s.sport === 'strength' && s.sessions !== undefined
                  ? `${s.sessions}×`
                  : s.durationSec !== undefined
                    ? formatDurationShort(s.durationSec)
                    : s.distanceM !== undefined
                      ? formatDistance(s.distanceM, s.sport === 'swim' ? 'auto-swim' : 'km')
                      : '–'}
              </span>
            ))}
          </div>
        ) : (
          <div className="mt-1 text-sm text-muted">Noch keine Ziele</div>
        )}
        {(isPast || isCurrent) && acts && (
          <div className="num mt-1 text-xs text-muted">
            Absolviert {formatDurationShort(doneSec)}
            {planned !== null && ` von ${formatDurationShort(planned)}`}
          </div>
        )}
      </div>
      {!selectable && <IconChevron className="h-4 w-4 shrink-0 text-muted" />}
    </button>
  );
}
