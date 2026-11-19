/* Zielzeit-Prognose Langdistanz (Version 2.0): Spannen je Teildisziplin aus Leistungswerten, Bestzeiten und Training. */
import { useState } from 'react';
import { Button, DecimalInput, DurationInput, Field, PaceInput, Screen, Section } from '../components/ui';
import { SPORT_TEXT_CLASS, SportIcon } from '../components/icons';
import { errorText, useLive, useNav, useRepo, useToast, useToday } from '../state';
import type { ActiveContext } from '../../data/usecases';
import type { AppSettings, AthleteProfile } from '../../domain/schemas';
import { formatDurationShort } from '../../domain/units';
import { formatDateDe } from '../../domain/calendar';
import { nowIso } from '../../domain/ids';
import { raceSetupSummary } from '../components/RaceSetup';
import { computePrognosis, historyDates, prognosisHistory, round5, scenarioMetrics, type MethodBasis, type PrognosisInput, type PrognosisPoint, type PrognosisSettings, type Range, type Scenario, type SplitEstimate } from '../../domain/prognosis';

const SPLIT_LABEL: Record<SplitEstimate['split'], string> = { swim: 'Schwimmen', bike: 'Rad', run: 'Laufen', transitions: 'Wechsel' };
const BASIS_LABEL: Record<MethodBasis, string> = { metric: 'Leistungswert', best: 'Bestzeit', training: 'Training', assumption: 'Annahme' };
type BestKey = keyof NonNullable<AthleteProfile['bestTimes']>;
const BEST_LABEL: Record<BestKey, string> = {
  run10k: '10 km',
  runHalf: 'Halbmarathon',
  runMarathon: 'Marathon',
  triOlympic: 'Triathlon olympisch',
  tri703: 'Triathlon 70.3',
};

const t = (sec: number) => formatDurationShort(sec >= 3600 ? round5(sec) : Math.round(sec / 60) * 60);
const range = (r: Range) => `${t(r.lo)} – ${t(r.hi)}`;

export const DEFAULT_PROGNOSIS: PrognosisSettings = {};

export function usePrognosis(ctx: ActiveContext, settings: AppSettings, today: string) {
  return useLive(
    async (r) => {
      const [profile, metrics, activities] = await Promise.all([r.getProfile(), r.listMetrics(), r.listActivities()]);
      const input: PrognosisInput = { today, race: ctx.race, profile, metrics, activities, settings: settings.prognosis ?? DEFAULT_PROGNOSIS };
      return { profile, input, prognosis: computePrognosis(input) };
    },
    [ctx.race, settings.prognosis, today],
  );
}

export function Prognosis({ ctx, settings }: { ctx: ActiveContext; settings: AppSettings }) {
  const today = useToday(settings.timeZone);
  const { navigate } = useNav();
  const data = usePrognosis(ctx, settings, today);
  if (!data) return null;
  const p = data.prognosis;
  return (
    <Screen title="Zielzeit-Prognose" subtitle={ctx.race.name} back>
      {!p.supported ? (
        <Section>
          <p className="text-sm">{p.notes[0]}</p>
        </Section>
      ) : p.needsSetup ? (
        <Section title="Race-Setup fehlt">
          <div data-testid="prognosis-needs-setup">
            <p className="text-sm">
              Die Prognose hängt stark von deinem Material ab: Rad, Aufleger, Laufräder, Reifen, Kleidung und Helm, Laufschuhe und ob mit Neo geschwommen wird. Hinterlege
              dein Race-Setup im Profil, dann zeigt die App hier deine Zielzeit-Spanne.
            </p>
            <div className="mt-3">
              <Button onClick={() => navigate({ name: 'settings' })}>Race-Setup im Profil eintragen</Button>
            </div>
          </div>
        </Section>
      ) : (
        <>
          <Section title="Stand heute">
            {p.total ? (
              <div data-testid="prognosis-total">
                <p className="num text-3xl font-bold">ca. {t(p.total.mid)}</p>
                <p className="num text-sm text-muted">Spanne {range(p.total)}</p>
                <RangeBar total={p.total} goal={ctx.race.goalTimeSec} />
                <p className="flex flex-wrap gap-x-4 text-xs text-muted">
                  <span className="inline-flex items-center gap-1"><span className="inline-block h-3 w-1 rounded-full bg-ink" /> Prognose</span>
                  <span className="inline-flex items-center gap-1"><span className="inline-block h-2 w-5 rounded-full bg-ink/30" /> Spanne</span>
                  {ctx.race.goalTimeSec !== undefined && <span className="inline-flex items-center gap-1"><span className="inline-block h-3 w-0.5 bg-warn" /> Zielzeit</span>}
                </p>
                {ctx.race.goalTimeSec !== undefined && (
                  <p className="mt-1 text-sm">
                    Deine Zielzeit {t(ctx.race.goalTimeSec)}{' '}
                    {ctx.race.goalTimeSec < p.total.lo
                      ? 'liegt unter der Spanne – mit dem heutigen Stand sehr ambitioniert.'
                      : ctx.race.goalTimeSec > p.total.hi
                        ? 'liegt über der Spanne – mit dem heutigen Stand gut erreichbar.'
                        : 'liegt innerhalb der Spanne.'}
                  </p>
                )}
              </div>
            ) : (
              <p className="text-sm" data-testid="prognosis-missing">
                Für eine Gesamtprognose fehlt noch etwas:{' '}
                {p.splits
                  .filter((s) => s.missing)
                  .map((s) => `${SPLIT_LABEL[s.split]} – ${s.missing}`)
                  .join('; ')}
                .
              </p>
            )}
            <ul className="mt-3 flex flex-col gap-1 text-xs text-muted">
              {p.notes.map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
          </Section>

          <HistorySection points={prognosisHistory(data.input, historyDates(today, ctx.race.prepStartDate))} goal={ctx.race.goalTimeSec} />

          {p.total && <ScenarioSection input={data.input} now={p.total} />}

          <Section title="Teilzeiten" aside="Spanne je Schätzweg">
            <div className="flex flex-col divide-y divide-line">
              {p.splits.map((s) => (
                <SplitRow key={s.split} s={s} />
              ))}
            </div>
            <div className="mt-3">
              <Button variant="secondary" onClick={() => navigate({ name: 'tests' })}>
                Leistungstests
              </Button>
            </div>
          </Section>

          {p.formulas.length > 0 && (
            <Section title="Vergleich: Formeln aus Bestzeiten">
              <ul className="flex flex-col gap-2 text-sm" data-testid="prognosis-formulas">
                {p.formulas.map((f) => (
                  <li key={f.id}>
                    <span className="num font-semibold">{range(f)}</span> {f.label}
                    <span className="block text-xs text-muted">
                      {f.detail} · {f.source}
                    </span>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {p.trainingWeeklySec !== null && (
            <Section title="Trainingsstand">
              <p className="text-sm">
                Ø <span className="num font-semibold">{formatDurationShort(p.trainingWeeklySec)}</span> pro Woche in den letzten 8 Wochen. Zum Vergleich:
                Freizeit-Finisher einer Langdistanz trainierten in einer Studie 13,9 ± 5,0 h pro Woche (Rüst et al. 2011) – der Umfang allein sagte die
                Zielzeit dort aber nicht voraus.
              </p>
            </Section>
          )}

          <AssumptionsSection settings={settings} profile={data.profile} />
        </>
      )}
    </Screen>
  );
}

function HistorySection({ points, goal }: { points: PrognosisPoint[]; goal: number | undefined }) {
  const pts = points.filter((p): p is PrognosisPoint & { total: NonNullable<PrognosisPoint['total']> } => p.total !== null);
  return (
    <Section title="Verlauf" aside="alle 2 Wochen, rückwirkend">
      {pts.length < 2 ? (
        <p className="text-sm text-muted">Der Verlauf erscheint, sobald es für mindestens zwei Stichtage genug Werte gibt.</p>
      ) : (
        <>
          <HistoryChart pts={pts} goal={goal} />
          <p className="flex flex-wrap gap-x-4 text-xs text-muted">
            <span className="inline-flex items-center gap-1"><span className="inline-block h-0.5 w-4 bg-ink" /> Prognose</span>
            <span className="inline-flex items-center gap-1"><span className="inline-block h-2 w-4 bg-ink/10" /> Spanne</span>
            {goal !== undefined && <span className="inline-flex items-center gap-1"><span className="inline-block h-0.5 w-4 bg-warn" /> Zielzeit</span>}
          </p>
        </>
      )}
      <p className="mt-1 text-xs text-muted">Jeder Punkt rechnet nur mit den Tests und Einheiten, die es an dem Tag schon gab. Bestzeiten und Annahmen gelten für alle Punkte gleich.</p>
    </Section>
  );
}

function HistoryChart({ pts, goal }: { pts: (PrognosisPoint & { total: Range & { mid: number } })[]; goal: number | undefined }) {
  const W = 340, H = 160, P = { l: 48, r: 10, t: 10, b: 22 };
  const vals = pts.flatMap((p) => [p.total.lo, p.total.hi]).concat(goal !== undefined ? [goal] : []);
  const min = Math.min(...vals) - 900, max = Math.max(...vals) + 900;
  const y = (v: number) => P.t + ((v - min) / (max - min)) * (H - P.t - P.b); // oben = schneller
  const x = (i: number) => P.l + (pts.length === 1 ? 0.5 : i / (pts.length - 1)) * (W - P.l - P.r);
  const band = [...pts.map((p, i) => `${x(i)},${y(p.total.lo)}`), ...[...pts].reverse().map((p, i) => `${x(pts.length - 1 - i)},${y(p.total.hi)}`)].join(' ');
  const line = pts.map((p, i) => `${x(i)},${y(p.total.mid)}`).join(' ');
  const ticks = [Math.ceil(min / 1800) * 1800];
  while (ticks[ticks.length - 1]! + 1800 < max) ticks.push(ticks[ticks.length - 1]! + 1800);
  const first = pts[0]!, last = pts[pts.length - 1]!;
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full"
      role="img"
      aria-label={`Prognose-Verlauf: ${pts.map((p) => `${formatDateDe(p.date, false)} ca. ${t(p.total.mid)}`).join(', ')}`}
      data-testid="prognosis-history"
    >
      {ticks.map((v) => (
        <g key={v}>
          <line x1={P.l} x2={W - P.r} y1={y(v)} y2={y(v)} className="stroke-line" strokeWidth={1} strokeDasharray="3 3" />
          <text x={P.l - 6} y={y(v) + 4} textAnchor="end" className="fill-muted text-[10px]">
            {formatDurationShort(v).replace(' h', '')}
          </text>
        </g>
      ))}
      <polygon points={band} className="fill-ink/10" />
      {goal !== undefined && <line x1={P.l} x2={W - P.r} y1={y(goal)} y2={y(goal)} className="stroke-warn" strokeWidth={1.5} />}
      <polyline points={line} fill="none" className="stroke-ink" strokeWidth={2} strokeLinejoin="round" />
      {pts.map((p, i) => (
        <circle key={p.date} cx={x(i)} cy={y(p.total.mid)} r={3.5} className="fill-ink stroke-surface" strokeWidth={2} />
      ))}
      <text x={P.l} y={H - 6} className="fill-muted text-[10px]">{formatDateDe(first.date, false)}</text>
      <text x={W - P.r} y={H - 6} textAnchor="end" className="fill-muted text-[10px]">{formatDateDe(last.date, false)}</text>
      <text x={W - P.r} y={P.t + 8} textAnchor="end" className="fill-muted text-[10px]">schneller ↑</text>
    </svg>
  );
}

function Stepper({ label, value, step, unit, onChange, format }: { label: string; value: number; step: number; unit: string; onChange: (v: number) => void; format?: (v: number) => string }) {
  const show = format ? format(value) : `${value > 0 ? '+' : value < 0 ? '−' : '±'}${Math.abs(value)} ${unit}`;
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-sm">{label}</span>
      <span className="flex items-center gap-2">
        <button type="button" className="h-10 w-10 rounded-full bg-surface-2 text-lg font-semibold" aria-label={`${label} weniger`} onClick={() => onChange(value - step)}>
          −
        </button>
        <span className="num w-20 text-center text-sm font-semibold" aria-live="polite">{show}</span>
        <button type="button" className="h-10 w-10 rounded-full bg-surface-2 text-lg font-semibold" aria-label={`${label} mehr`} onClick={() => onChange(value + step)}>
          +
        </button>
      </span>
    </div>
  );
}

function ScenarioSection({ input, now }: { input: PrognosisInput; now: Range & { mid: number } }) {
  const [sc, setSc] = useState<Scenario>({ ftpW: 0, runPaceSec: 0, cssSec: 0 });
  const has = (k: string) => input.metrics.some((m) => m.kind === k);
  const res = computePrognosis({ ...input, metrics: scenarioMetrics(input.metrics, sc, input.today) }).total;
  const diff = res ? round5(res.mid) - round5(now.mid) : 0;
  const changed = (sc.ftpW ?? 0) !== 0 || (sc.runPaceSec ?? 0) !== 0 || (sc.cssSec ?? 0) !== 0;
  const pace = (v: number) => `${v > 0 ? '+' : v < 0 ? '−' : '±'}${Math.abs(v)} s`;
  return (
    <Section title="Was wäre wenn?" aside="wird nicht gespeichert">
      <div className="flex flex-col gap-2">
        {has('bike_ftp_w') && <Stepper label="FTP" value={sc.ftpW ?? 0} step={5} unit="W" onChange={(v) => setSc({ ...sc, ftpW: v })} />}
        {has('run_threshold_pace_s_per_km') && (
          <Stepper label="Schwellenpace /km" value={sc.runPaceSec ?? 0} step={2} unit="s" format={pace} onChange={(v) => setSc({ ...sc, runPaceSec: v })} />
        )}
        {has('swim_css_s_per_100m') && <Stepper label="CSS /100 m" value={sc.cssSec ?? 0} step={1} unit="s" format={pace} onChange={(v) => setSc({ ...sc, cssSec: v })} />}
      </div>
      {res && (
        <p className="mt-3 text-sm" data-testid="scenario-result">
          {changed ? (
            <>
              Dann: <span className="num font-semibold">ca. {t(res.mid)}</span> ({diff === 0 ? 'unverändert' : `${diff < 0 ? '−' : '+'}${Math.abs(diff) / 60} min`}), Spanne {range(res)}
            </>
          ) : (
            'Ändere einen Wert, um zu sehen, wie sich die Prognose verschiebt.'
          )}
        </p>
      )}
      <p className="mt-1 text-xs text-muted">Bei Pace-Werten heißt minus schneller. Nur die Schätzwege über Leistungswerte ändern sich; Training und Bestzeiten bleiben.</p>
    </Section>
  );
}

function RangeBar({ total, goal }: { total: Range & { mid: number }; goal: number | undefined }) {
  const lo = Math.min(total.lo, goal ?? total.lo) - 900;
  const hi = Math.max(total.hi, goal ?? total.hi) + 900;
  const x = (v: number) => `${((v - lo) / (hi - lo)) * 100}%`;
  return (
    <div className="relative mt-3 h-8" aria-hidden="true">
      <div className="absolute top-3 h-2 w-full rounded-full bg-surface-2" />
      <div className="absolute top-3 h-2 rounded-full bg-ink/30" style={{ left: x(total.lo), width: `calc(${x(total.hi)} - ${x(total.lo)})` }} />
      <div className="absolute top-1.5 h-5 w-1 -translate-x-1/2 rounded-full bg-ink" style={{ left: x(total.mid) }} />
      {goal !== undefined && <div className="absolute top-0 h-8 w-0.5 -translate-x-1/2 bg-warn" style={{ left: x(goal) }} title="Zielzeit" />}
    </div>
  );
}

function SplitRow({ s }: { s: SplitEstimate }) {
  const [open, setOpen] = useState(false);
  const sport = s.split === 'transitions' ? null : s.split;
  return (
    <div className="py-2" data-testid={`split-${s.split}`}>
      <button type="button" onClick={() => setOpen(!open)} className="flex w-full items-center justify-between gap-3 text-left" aria-expanded={open}>
        <span className="inline-flex items-center gap-1.5 text-sm">
          {sport && (
            <span className={SPORT_TEXT_CLASS[sport]}>
              <SportIcon sport={sport} className="h-4 w-4" />
            </span>
          )}
          {SPLIT_LABEL[s.split]}
          {s.methods.length > 0 && <span className="text-xs text-muted">({s.methods.map((m) => BASIS_LABEL[m.basis]).join(', ')})</span>}
        </span>
        <span className="num shrink-0 whitespace-nowrap text-sm font-semibold">{s.combined ? range(s.combined) : 'fehlt'}</span>
      </button>
      {(open || !s.combined) && (
        <ul className="mt-1 flex flex-col gap-1.5 pl-6 text-xs text-muted">
          {s.methods.map((m) => (
            <li key={m.id}>
              <span className="num font-semibold text-ink">{range(m)}</span> {m.label}
              <span className="block">
                {m.detail} · Quelle: {m.source}
              </span>
            </li>
          ))}
          {s.missing && <li>Es fehlt: {s.missing}.</li>}
        </ul>
      )}
    </div>
  );
}

function AssumptionsSection({ settings, profile }: { settings: AppSettings; profile: AthleteProfile | undefined }) {
  const repo = useRepo();
  const { navigate } = useNav();
  const toast = useToast();
  const ps = settings.prognosis ?? DEFAULT_PROGNOSIS;
  const [best, setBest] = useState<NonNullable<AthleteProfile['bestTimes']>>(profile?.bestTimes ?? {});
  const [weight, setWeight] = useState<number | undefined>(profile?.weightKg);

  async function saveSettings(next: PrognosisSettings) {
    try {
      await repo.updateSettings({ prognosis: next });
    } catch (e) {
      toast(errorText(e), 'error');
    }
  }
  async function saveProfile() {
    try {
      const clean = Object.fromEntries(Object.entries(best).filter(([, v]) => v && v.timeSec > 0)) as NonNullable<AthleteProfile['bestTimes']>;
      await repo.saveProfile({ ...(profile ?? { id: 'me' as const }), ...(weight ? { weightKg: weight } : {}), bestTimes: clean, updatedAt: nowIso() });
      toast('Bestzeiten gespeichert');
    } catch (e) {
      toast(errorText(e), 'error');
    }
  }
  const setTime = (k: BestKey, sec: number | undefined) => {
    const next = { ...best };
    if (sec === undefined) delete next[k];
    else next[k] = { ...(best[k]?.year ? { year: best[k]!.year } : {}), timeSec: sec };
    setBest(next);
  };

  return (
    <>
      <Section title="Race-Setup und Strecke">
        <div className="flex flex-col gap-3">
          {profile?.raceSetup && <p className="text-sm" data-testid="prognosis-setup">{raceSetupSummary(profile.raceSetup)}</p>}
          <Button variant="secondary" onClick={() => navigate({ name: 'settings' })}>
            Race-Setup im Profil ändern
          </Button>
          <Field label="Höhenmeter der Radstrecke" hint="Laut Veranstalter; leer = flach gerechnet. Die Hälfte der Strecke wird als gleichmäßig bergauf, die andere als bergab gerechnet.">
            {(id) => (
              <DecimalInput
                id={id}
                integer
                suffix="m"
                value={ps.bikeElevationM}
                onChange={(v) => {
                  const next: PrognosisSettings = {};
                  if (v !== undefined) next.bikeElevationM = Math.min(6000, Math.max(0, v));
                  void saveSettings(next);
                }}
              />
            )}
          </Field>
        </div>
      </Section>
      <Section title="Bestzeiten und Gewicht">
        <div className="flex flex-col gap-3">
          <p className="text-sm text-muted">Optional. Bestzeiten ergänzen die Schätzung aus Leistungswerten und Training; ältere Zeiten passen eventuell nicht mehr zum heutigen Stand.</p>
          <PaceInput label={BEST_LABEL.run10k} unit="min:s" value={best.run10k?.timeSec} onChange={(v) => setTime('run10k', v)} />
          {(['runHalf', 'runMarathon', 'triOlympic', 'tri703'] as const).map((k) => (
            <Field key={k} label={BEST_LABEL[k]}>
              {(id) => <DurationInput idPrefix={id} label={BEST_LABEL[k]} value={best[k]?.timeSec} onChange={(v) => setTime(k, v)} />}
            </Field>
          ))}
          <Field label="Körpergewicht" hint="Für das Rad-Leistungsmodell; ohne Angabe 75 kg.">
            {(id) => <DecimalInput id={id} value={weight} onChange={setWeight} suffix="kg" />}
          </Field>
          <Button onClick={() => void saveProfile()}>Speichern</Button>
        </div>
      </Section>
    </>
  );
}
