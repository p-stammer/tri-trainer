/* Plan vorschlagen (M3.5): Einstellungen, fehlende Angaben, Vorschau mit Begründungen und Warnungen, Übernahme. */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Button, DecimalInput, DurationInput, Field, Screen, Section, Segmented, TextInput } from '../components/ui';
import { SPORT_TEXT_CLASS, SportIcon } from '../components/icons';
import { BaselineEditor } from '../components/BaselineEditor';
import { VolumeTimeline, campMarkers, type TimelineMarker } from '../components/VolumeTimeline';
import { WeekDiffList } from '../components/WeekDiff';
import type { PlanWeekChange } from '../../domain/planEdit';
import { errorText, useLive, useNav, useRepo, useToast, useToday } from '../state';
import { applyGeneratedPlan, loadGeneratorInput, loadGeneratorSettings, planRangeWeeks, type ActiveContext } from '../../data/usecases';
import type { AppSettings, AthleteProfile, GeneratorSettings } from '../../domain/schemas';
import { addDays, compareDates, isLocalDate, isoWeek, isoWeekday, startOfWeek, type LocalDate } from '../../domain/calendar';
import { ENDURANCE_SPORTS, PHASE_LABEL, PLANNED_SPORTS, SESSION_FOCUS_LABEL, SPORT_LABEL, SPORT_SHORT, type PlannedSport } from '../../domain/sports';
import { formatDistance, formatDurationShort, formatNumber, kmToMeters } from '../../domain/units';
import { cleanBaseline } from '../../domain/baseline';
import { isEmptyTargets } from '../../domain/plan';
import { sameTargets } from '../../domain/planEdit';
import { nowIso } from '../../domain/ids';
import { generatePlan } from '../../engine/generate';
import { raceClass, resolveParams, volumeCeilingSec } from '../../engine/params';
import type { PlanProposal, ProposedWeek, Warning, WeekKind } from '../../engine/types';


export const WEEK_KIND_LABEL: Record<WeekKind, string> = {
  loading: 'Belastung',
  recovery: 'Entlastung',
  taper: 'Taper',
  prep_race: 'Vorbereitungsrennen',
  post_race: 'Erholung nach Rennen',
  camp: 'Trainingslager',
  post_camp: 'Erholung nach Trainingslager',
};

const SEVERITY_ORDER: Record<Warning['severity'], number> = { important: 0, caution: 1, info: 2 };

export function PlanGenerator({ ctx, settings: appSettings }: { ctx: ActiveContext; settings: AppSettings }) {
  const repo = useRepo();
  const toast = useToast();
  const { navigate } = useNav();
  const today = useToday(appSettings.timeZone);
  const weeks = planRangeWeeks(ctx);
  const thisWeek = startOfWeek(today);
  const nextWeek = addDays(thisWeek, 7);
  const canThisWeek = weeks.includes(thisWeek);
  const [startChoice, setStartChoice] = useState<'this' | 'next'>(() => (canThisWeek && isoWeekday(today) <= 2 ? 'this' : 'next'));
  const firstWeek: LocalDate = startChoice === 'this' && canThisWeek ? thisWeek : compareDates(nextWeek, weeks[0] ?? nextWeek) < 0 ? (weeks[0] ?? nextWeek) : nextWeek;

  const stored = useLive((r) => loadGeneratorSettings(r, ctx.plan.id), [ctx.plan.id]);
  const [draft, setDraft] = useState<GeneratorSettings | null>(null);
  useEffect(() => {
    if (stored && !draft) setDraft(stored);
  }, [stored, draft]);

  // Einstellungen speichern (verzögert), damit sie beim nächsten Öffnen wieder da sind.
  const saveTimer = useRef<number | undefined>(undefined);
  function update(patch: Partial<GeneratorSettings>, remove: (keyof GeneratorSettings)[] = []) {
    if (!draft) return;
    const next: GeneratorSettings = { ...draft, ...patch, updatedAt: nowIso() };
    for (const k of remove) delete (next as Partial<GeneratorSettings>)[k];
    setDraft(next);
    window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      repo.saveGeneratorSettings(next).catch((e: unknown) => toast(errorText(e), 'error'));
    }, 400);
  }
  useEffect(() => () => window.clearTimeout(saveTimer.current), []);

  const input = useLive((r) => (draft ? loadGeneratorInput(r, ctx, today, firstWeek, draft) : Promise.resolve(null)), [ctx, today, firstWeek, draft]);
  const result = useMemo(() => (input ? generatePlan(input) : null), [input]);
  const [busy, setBusy] = useState(false);

  if (!draft) return <Screen title="Plan vorschlagen" back>{null}</Screen>;

  const proposal = result?.ok ? result.proposal : null;
  const changed = proposal
    ? proposal.weeks.filter((pw) => {
        const w = ctx.weeks.find((x) => x.weekStart === pw.weekStart);
        return w && !sameTargets(w.current, pw.targets);
      })
    : [];
  const overwritten = changed.filter((pw) => {
    const w = ctx.weeks.find((x) => x.weekStart === pw.weekStart);
    return w && !isEmptyTargets(w.current);
  }).length;

  async function apply() {
    if (!proposal || !draft) return;
    setBusy(true);
    try {
      const n = await applyGeneratedPlan(repo, ctx, proposal, draft);
      toast(`Plan übernommen: ${n} ${n === 1 ? 'Woche' : 'Wochen'}. Rückgängig im Änderungsverlauf.`);
      navigate({ name: 'plan' });
    } catch (e) {
      toast(errorText(e), 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen title="Plan vorschlagen" subtitle={`Wochenziele bis ${ctx.race.name}`} back>
      <SettingsSection draft={draft} update={update} startChoice={startChoice} setStartChoice={setStartChoice} canThisWeek={canThisWeek} firstWeek={firstWeek} race={ctx.race} />
      {proposal && <PrioritySection priorities={proposal.priorities} />}
      <BaselineSection
        key={input?.profile?.updatedAt ?? 'neu'}
        profile={input?.profile ?? null}
        draft={draft}
        update={update}
        needs={result && !result.ok ? result.needs.map((n) => n.message) : []}
        proposal={proposal}
        today={today}
      />
      {proposal && (
        <>
          <WarningsSection warnings={proposal.warnings} uncertainties={proposal.uncertainties.map((u) => u.text)} />
          <OverviewSection
            proposal={proposal}
            currentWeek={thisWeek}
            markers={[
              ...(input?.prepRaces ?? []).map((r) => ({ weekStart: startOfWeek(r.date), label: r.name })),
              { weekStart: startOfWeek(ctx.race.date), label: ctx.race.name, main: true },
              ...campMarkers(input?.camps ?? []),
            ]}
          />
          {overwritten > 0 && (
            <CompareSection
              changes={changed.flatMap((pw) => {
                const w = ctx.weeks.find((x) => x.weekStart === pw.weekStart);
                return w && !isEmptyTargets(w.current) ? [{ weekStart: pw.weekStart, before: w.current, after: pw.targets }] : [];
              })}
            />
          )}
          <WeeksSection proposal={proposal} />
          <RationaleSection proposal={proposal} />
          {proposal.violations.length > 0 && (
            <p className="rounded-2xl bg-surface p-3 text-sm text-danger">
              Interne Prüfung fehlgeschlagen ({proposal.violations.map((v) => `${v.rule} ${v.weekStart}`).join(', ')}). Bitte nicht übernehmen und mir melden.
            </p>
          )}
          <div className="sticky bottom-24 z-10 flex flex-col gap-2 rounded-2xl bg-surface p-3 shadow-lg">
            <p className="text-sm text-muted">
              {changed.length === 0
                ? 'Der Vorschlag entspricht schon deinem Plan.'
                : `${changed.length} ${changed.length === 1 ? 'Woche ändert' : 'Wochen ändern'} sich${overwritten ? `, davon ${overwritten} mit bisherigen Zielen` : ''}. Rückgängig jederzeit im Änderungsverlauf.`}
            </p>
            <Button full disabled={busy || changed.length === 0 || proposal.violations.length > 0} onClick={() => void apply()}>
              Plan übernehmen
            </Button>
          </div>
        </>
      )}
    </Screen>
  );
}

function SettingsSection({ draft, update, startChoice, setStartChoice, canThisWeek, firstWeek, race }: {
  race: { swimM: number; bikeM: number; runM: number };
  draft: GeneratorSettings;
  update: (p: Partial<GeneratorSettings>, remove?: (keyof GeneratorSettings)[]) => void;
  startChoice: 'this' | 'next';
  setStartChoice: (v: 'this' | 'next') => void;
  canThisWeek: boolean;
  firstWeek: LocalDate;
}) {
  const p = resolveParams(draft.philosophy);
  const setPrio = (s: 'swim' | 'bike' | 'run', v: number) => update({ priorities: { ...draft.priorities, [s]: { ...draft.priorities[s], user: v } } });
  return (
    <Section title="Einstellungen">
      <div className="flex flex-col gap-5">
        <div>
          <label htmlFor="phi" className="mb-1 block font-semibold">
            Ausrichtung
          </label>
          <input
            id="phi"
            type="range"
            min={0}
            max={100}
            step={5}
            value={draft.philosophy}
            onChange={(e) => update({ philosophy: Number(e.target.value) })}
            className="w-full accent-ink"
            aria-valuetext={`${draft.philosophy} von 100`}
          />
          <div className="flex justify-between text-xs text-muted">
            <span>Konservativ, Langlebigkeit</span>
            <span className="num">{draft.philosophy}</span>
            <span>Zeitoptimiert, ambitioniert</span>
          </div>
          <ul className="num mt-2 flex flex-col gap-0.5 text-sm text-muted">
            <li>
              {Math.round(p.lowIntensityShare * 100)} % locker, {p.z3ShareOfNonLow >= 0.5 ? 'eher pyramidal (mehr Tempo, wenig hart)' : 'eher polarisiert (mehr harte Intervalle)'}
            </li>
            <li>
              Harte Intervalle: {Math.round((1 - p.lowIntensityShare) * (1 - p.z3ShareOfNonLow) * 100)} % der Ausdauerzeit, davon {Math.round(p.z5ShareOfHigh * 100)} % sehr hart (Z5)
            </li>
            <li>
              Laufen: Steigerung bis +{formatNumber(p.runGrowth * 100, 1)} % pro Woche{p.runRacePaceShare > 0 ? ', kurze Abschnitte im Renntempo' : ', nur locker'}
            </li>
            <li>{p.strengthSessions}× Kraft pro Woche</li>
          </ul>
          <p className="mt-1 text-xs text-muted">
            Die Trainingszeit hängt nicht vom Regler ab: Spitzenwoche höchstens {formatDurationShort(volumeCeilingSec(raceClass(race)))} (bzw. dein Zeitbudget), Rad/Schwimmen bis +15 % pro Woche, Entlastung fest jede 4. Woche (ab 50 Jahren jede 3.).
          </p>
        </div>
        <Field label="Start">
          {() => (
            <Segmented
              ariaLabel="Start"
              value={canThisWeek ? startChoice : 'next'}
              onChange={setStartChoice}
              options={[
                ...(canThisWeek ? [{ value: 'this' as const, label: 'Diese Woche' }] : []),
                { value: 'next' as const, label: canThisWeek ? 'Nächste Woche' : `ab KW ${isoWeek(firstWeek).week}` },
              ]}
            />
          )}
        </Field>
        <Field label="Taper vor dem Wettkampf">
          {() => (
            <Segmented
              ariaLabel="Taper"
              value={String(draft.taperWeeks) as '1' | '2' | '3'}
              onChange={(v) => update({ taperWeeks: Number(v) as 1 | 2 | 3 })}
              options={[
                { value: '1', label: '1 Woche' },
                { value: '2', label: '2 Wochen' },
                { value: '3', label: '3 Wochen' },
              ]}
            />
          )}
        </Field>
        <Field label="Prioritäten" hint="Automatisch: aus deinem Umfang im Verhältnis zur Renndauer. Hybrid: Mittel aus Wunsch und Vorschlag. Manuell: dein Wunsch. Harte Grenzen gelten immer.">
          {() => (
            <Segmented
              ariaLabel="Prioritäten"
              value={draft.priorityMode}
              onChange={(v) => update({ priorityMode: v })}
              options={[
                { value: 'auto', label: 'Automatisch' },
                { value: 'hybrid', label: 'Hybrid' },
                { value: 'manual', label: 'Manuell' },
              ]}
            />
          )}
        </Field>
        {draft.priorityMode !== 'auto' && (
          <div className="flex flex-col gap-3">
            {ENDURANCE_SPORTS.map((s) => (
              <div key={s} className="flex items-center gap-3">
                <span className={`flex w-24 items-center gap-1.5 text-sm font-semibold ${SPORT_TEXT_CLASS[s]}`}>
                  <SportIcon sport={s} className="h-4 w-4" />
                  {SPORT_SHORT[s]}
                </span>
                <div className="flex-1">
                  <Segmented
                    ariaLabel={`Priorität ${SPORT_LABEL[s]}`}
                    value={String(draft.priorities[s]?.user ?? 3) as '1' | '2' | '3' | '4' | '5'}
                    onChange={(v) => setPrio(s, Number(v))}
                    options={(['1', '2', '3', '4', '5'] as const).map((v) => ({ value: v, label: v }))}
                  />
                </div>
              </div>
            ))}
            <p className="text-xs text-muted">1 = wenig, 3 = neutral, 5 = Schwerpunkt</p>
          </div>
        )}
        <Field label="Freiwasser / Neopren möglich ab (optional)">
          {(id) => (
            <TextInput
              id={id}
              type="date"
              value={draft.openWaterFrom ?? ''}
              onChange={(v) => (isLocalDate(v) ? update({ openWaterFrom: v }) : update({}, ['openWaterFrom']))}
            />
          )}
        </Field>
      </div>
    </Section>
  );
}

function PrioritySection({ priorities }: { priorities: PlanProposal['priorities'] }) {
  return (
    <Section title="Gewichtung der Disziplinen" aside="1 wenig · 3 neutral · 5 Schwerpunkt">
      <ul className="flex flex-col gap-2 text-sm" data-testid="priority-suggestions">
        {priorities.map((p) => (
          <li key={p.sport}>
            <div className="flex items-center justify-between gap-2">
              <span className={`inline-flex items-center gap-1.5 font-semibold ${SPORT_TEXT_CLASS[p.sport]}`}>
                <SportIcon sport={p.sport} className="h-4 w-4" />
                {SPORT_SHORT[p.sport]}
              </span>
              <span className="num">
                Vorschlag <span className="font-semibold">{p.suggested}</span>
                {p.applied !== p.suggested && (
                  <>
                    {' '}
                    · verwendet <span className="font-semibold">{p.applied}</span>
                  </>
                )}
              </span>
            </div>
            <p className="text-xs text-muted">{p.mode === 'manual' ? `${p.reason}. Vorschlag: ${(p.factors ?? []).join('; ') || 'unauffällig'}` : p.reason}</p>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-muted">
        Grundlage: Umfang im Verhältnis zur Renndauer, Verlauf deiner Leistungstests und die Teilzeiten der Zielzeit-Prognose im Vergleich zu typischen
        Altersklassen-Athleten. Das sind Zusammenhänge – dass mehr Training in der schwächeren Disziplin am meisten bringt, ist nicht belegt.
      </p>
    </Section>
  );
}

function BaselineSection({ profile, draft, update, needs, proposal, today }: {
  today: LocalDate;
  profile: AthleteProfile | null;
  draft: GeneratorSettings;
  update: (p: Partial<GeneratorSettings>) => void;
  needs: string[];
  proposal: PlanProposal | null;
}) {
  const repo = useRepo();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const initial: AthleteProfile = profile ?? { id: 'me', updatedAt: nowIso() };
  const [p, setP] = useState<AthleteProfile>(initial);
  const lr = draft.longestRecentRun;
  const [lrKm, setLrKm] = useState<number | undefined>(lr?.distanceM !== undefined ? lr.distanceM / 1000 : undefined);
  const [lrSec, setLrSec] = useState<number | undefined>(lr?.durationSec);
  const showOpen = open || needs.length > 0;

  async function save() {
    try {
      await repo.saveProfile({ ...p, updatedAt: nowIso() });
      if (lrKm !== undefined || lrSec !== undefined) {
        const next: NonNullable<GeneratorSettings['longestRecentRun']> = { asOf: today };
        if (lrKm) next.distanceM = kmToMeters(lrKm);
        if (lrSec) next.durationSec = lrSec;
        update({ longestRecentRun: next });
      }
      toast('Ausgangslage gespeichert');
      setOpen(false);
    } catch (e) {
      toast(errorText(e), 'error');
    }
  }

  const b = proposal?.baseline;
  return (
    <Section title="Ausgangslage" aside={!showOpen ? <Button variant="ghost" onClick={() => setOpen(true)}>Bearbeiten</Button> : undefined}>
      {needs.length > 0 && (
        <ul className="mb-4 flex flex-col gap-2">
          {needs.map((n) => (
            <li key={n} className="rounded-xl bg-surface-2 p-3 text-sm text-warn">
              {n}
            </li>
          ))}
        </ul>
      )}
      {!showOpen && b && (
        <ul className="num flex flex-col gap-1 text-sm">
          <li>Zeitbudget: {formatDurationShort(b.budgetSec)} pro Woche</li>
          {ENDURANCE_SPORTS.map((s) => {
            const sb = b.bySport[s];
            return (
              <li key={s}>
                {SPORT_LABEL[s]}: {formatDurationShort(sb?.durationSec ?? 0)}
                {sb?.distanceM ? ` / ${formatDistance(sb.distanceM, s === 'swim' ? 'auto-swim' : 'km')}` : ''} pro Woche
                {s === 'run' && sb?.longestSec ? `, längster Lauf ${formatDurationShort(sb.longestSec)}${sb.longestM ? ` / ${formatDistance(sb.longestM)}` : ''}` : ''}
                {sb?.source === 'history' ? ' (aus deinen Einheiten)' : ''}
              </li>
            );
          })}
        </ul>
      )}
      {showOpen && (
        <div className="flex flex-col gap-4">
          <Field label="Zeitbudget pro Woche" hint="Wie viel Zeit du künftig höchstens hast. Spitzenwochen planen mit etwa 90 % davon.">
            {(id) => (
              <DecimalInput
                id={id}
                value={p.availableWeeklySec === undefined ? undefined : p.availableWeeklySec / 3600}
                suffix="h"
                onChange={(v) => {
                  const next = { ...p };
                  delete next.availableWeeklySec;
                  if (v !== undefined) next.availableWeeklySec = Math.round(v * 3600);
                  setP(next);
                }}
              />
            )}
          </Field>
          <div className="rounded-2xl bg-surface-2 p-3">
            <p className="mb-1 font-semibold">Aktueller Trainingsumfang</p>
            <p className="mb-3 text-xs text-muted">Durchschnitt pro Woche. Der Plan startet genau hier. Sportarten ohne Angabe gelten als „aktuell kein Training“.</p>
            <BaselineEditor
              value={p.baseline}
              onChange={(v) => {
                const next = { ...p };
                const c = cleanBaseline(v) ?? (v.periodWeeks ? { periodWeeks: v.periodWeeks } : undefined);
                delete next.baseline;
                if (c) next.baseline = c;
                setP(next);
              }}
            />
          </div>
          <div>
            <p className="mb-2 font-semibold">Längster Lauf der letzten 30 Tage</p>
            <div className="flex flex-col gap-2">
              <DecimalInput ariaLabel="Längster Lauf, Kilometer" value={lrKm} suffix="km" onChange={setLrKm} />
              <DurationInput idPrefix="lr" value={lrSec} onChange={setLrSec} />
            </div>
          </div>
          <Button onClick={() => void save()}>Ausgangslage speichern</Button>
        </div>
      )}
    </Section>
  );
}

function WarningsSection({ warnings, uncertainties }: { warnings: Warning[]; uncertainties: string[] }) {
  if (warnings.length === 0 && uncertainties.length === 0) return null;
  const sorted = [...warnings].sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
  return (
    <Section title="Hinweise" aside={`${warnings.length + uncertainties.length}`}>
      <ul className="flex flex-col gap-2">
        {sorted.map((w, i) => (
          <li key={`${w.code}-${i}`} className={`rounded-xl p-3 text-sm ${w.severity === 'important' ? 'bg-surface-2 text-warn' : 'bg-surface-2'}`}>
            {w.text}
          </li>
        ))}
        {uncertainties.map((u) => (
          <li key={u} className="rounded-xl bg-surface-2 p-3 text-sm text-muted">
            {u}
          </li>
        ))}
      </ul>
    </Section>
  );
}

function OverviewSection({ proposal, markers, currentWeek }: { proposal: PlanProposal; markers: TimelineMarker[]; currentWeek: LocalDate }) {
  const ws = proposal.weeks;
  const dur = (w: ProposedWeek, s: PlannedSport) => w.targets.sports.find((x) => x.sport === s)?.durationSec ?? 0;
  const totals = ws.map((w) => PLANNED_SPORTS.reduce((a, s) => a + dur(w, s), 0));
  return (
    <Section title="Verlauf">
      <p className="num mb-3 text-sm text-muted">
        Woche 1: {formatDurationShort(totals[0] ?? 0)} · Spitze: {formatDurationShort(Math.max(...totals))} · Wettkampfwoche: {formatDurationShort(totals.at(-1) ?? 0)}
      </p>
      <VolumeTimeline
        ariaLabel="Vorgeschlagener Wochenumfang je Sportart"
        initial="all"
        currentWeek={currentWeek}
        markers={markers}
        weeks={ws.map((w) => ({
          weekStart: w.weekStart,
          planned: Object.fromEntries(PLANNED_SPORTS.map((s) => [s, dur(w, s)])) as Partial<Record<PlannedSport, number>>,
          label: [PHASE_LABEL[w.phase], w.kind !== 'loading' && w.kind !== 'recovery' && w.kind !== 'taper' ? WEEK_KIND_LABEL[w.kind] : null].filter(Boolean).join(' · '),
          details: [
            ...(w.longRun ? [`Langer Lauf ${formatDurationShort(w.longRun.durationSec ?? 0)}${w.longRun.distanceM ? ` / ${formatDistance(w.longRun.distanceM)}` : ''}`] : []),
            ...w.reasons,
          ],
        }))}
      />
    </Section>
  );
}

function CompareSection({ changes }: { changes: PlanWeekChange[] }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Section title="Vergleich mit deinem Plan" aside={`${changes.length} ${changes.length === 1 ? 'Woche' : 'Wochen'}`}>
        <p className="text-sm text-muted">Diese Wochen haben schon Ziele und würden ersetzt. Vergangene Wochen und deine Einheiten bleiben unverändert.</p>
        <div className="mt-3">
          <Button variant="secondary" onClick={() => setOpen(!open)}>
            {open ? 'Vergleich ausblenden' : 'Vorher → nachher anzeigen'}
          </Button>
        </div>
      </Section>
      {open && <WeekDiffList changes={changes} />}
    </>
  );
}

function WeeksSection({ proposal }: { proposal: PlanProposal }) {
  return (
    <Section title="Wochen">
      <ol className="flex flex-col">
        {proposal.weeks.map((w) => (
          <li key={w.weekStart} className="border-t border-line first:border-t-0">
            <details className="py-2">
              <summary className="flex cursor-pointer list-none items-baseline gap-2">
                <span className="num w-14 shrink-0 font-semibold">KW {isoWeek(w.weekStart).week}</span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm">
                    {PHASE_LABEL[w.phase]}
                    {w.kind !== 'loading' && w.kind !== 'recovery' && w.kind !== 'taper' ? ` · ${WEEK_KIND_LABEL[w.kind]}` : ''}
                  </span>
                  <span className="num block text-xs text-muted">
                    {w.targets.sports
                      .map((s) => `${SPORT_SHORT[s.sport]} ${s.sport === 'strength' ? `${s.sessions ?? 0}×` : formatDurationShort(s.durationSec ?? 0)}`)
                      .join(' · ')}
                  </span>
                </span>
              </summary>
              <div className="mt-2 flex flex-col gap-1 pl-16 text-sm">
                {w.targets.sports
                  .filter((s) => s.sport !== 'strength')
                  .map((s) => (
                    <p key={s.sport} className="num">
                      <span className={SPORT_TEXT_CLASS[s.sport]}>{SPORT_SHORT[s.sport]}</span>: {formatDurationShort(s.durationSec ?? 0)}
                      {s.distanceM ? ` / ${formatDistance(s.distanceM, s.sport === 'swim' ? 'auto-swim' : 'km')}` : ''}, {s.sessions}×
                      {s.zoneSec && (s.zoneSec.z3 || s.zoneSec.z4 || s.zoneSec.z5)
                        ? ` (davon ${[
                            s.zoneSec.z3 ? `Z3 ${formatDurationShort(s.zoneSec.z3)}` : null,
                            s.zoneSec.z4 ? `Z4 ${formatDurationShort(s.zoneSec.z4)}` : null,
                            s.zoneSec.z5 ? `Z5 ${formatDurationShort(s.zoneSec.z5)}` : null,
                          ]
                            .filter(Boolean)
                            .join(', ')})`
                        : ' (locker)'}
                    </p>
                  ))}
                {w.targets.focuses.length > 0 && (
                  <ul className="mt-1 list-disc pl-5 text-muted">
                    {w.targets.focuses.map((f) => (
                      <li key={f.id}>
                        {SESSION_FOCUS_LABEL[f.focus]} ({SPORT_SHORT[f.sport]}){f.note ? `: ${f.note}` : ''}
                      </li>
                    ))}
                  </ul>
                )}
                {w.reasons.length > 0 && <p className="mt-1 text-xs text-muted">{w.reasons.join(' · ')}</p>}
              </div>
            </details>
          </li>
        ))}
      </ol>
    </Section>
  );
}

function RationaleSection({ proposal }: { proposal: PlanProposal }) {
  return (
    <Section title="Warum so?">
      <ul className="flex flex-col gap-2 text-sm">
        {proposal.rationale.map((r, i) => (
          <li key={i}>
            {r.text} <span className="text-xs text-muted">({r.rules.join(', ')})</span>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-muted">
        Modell {proposal.modelVersion}. Regeln (R…) und Quellen stehen in den Projektdokumenten TRAINING_SCIENCE und PLAN_MODEL. Der Plan ist ein Vorschlag – keine medizinische Beratung.
      </p>
    </Section>
  );
}
