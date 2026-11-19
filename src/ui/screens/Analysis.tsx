/* Analysen: Umfang, Soll-Ist, Intensität, Belastung und Frische über wählbare Zeiträume. */
import { useState } from 'react';
import { Button, Chip, Loading, Screen, Section, Segmented } from '../components/ui';
import { Legend, ShareBar, WeekBarChart, type BarSeries } from '../components/charts';
import { SPORT_TEXT_CLASS, SportIcon } from '../components/icons';
import { useLive, useNav, useToday } from '../state';
import type { ActiveContext } from '../../data/usecases';
import type { AppSettings } from '../../domain/schemas';
import { compareDates, isoWeek, startOfWeek } from '../../domain/calendar';
import { HIGHER_IS_BETTER, metricHistory } from '../../domain/performanceTests';
import { fmtMetric as fmtTestMetric } from './PerformanceTests';
import { usePrognosis } from './Prognosis';
import { round5 } from '../../domain/prognosis';
import { complianceSummary, weekCompliance, analysisWeeks, compareToTarget, focusCounts, otherActivitySummary, periodWeekStarts, trailingMean, zoneSummary, type AnalysisPeriod, type MetricKey } from '../../domain/analytics';
import { ENDURANCE_SPORTS, PLANNED_SPORTS, SESSION_FOCUS_LABEL, SPORT_LABEL, SPORT_SHORT, ZONES, ZONE_LABEL, type PlannedSport, type Zone } from '../../domain/sports';
import { formatDistance, formatDurationShort, formatNumber, formatPercent } from '../../domain/units';

const FILL: Record<PlannedSport, string> = { swim: 'fill-swim', bike: 'fill-bike', run: 'fill-run', strength: 'fill-strength' };
const BG: Record<PlannedSport, string> = { swim: 'bg-swim', bike: 'bg-bike', run: 'bg-run', strength: 'bg-strength' };

/** Zonen als Helligkeitsstufen derselben Sportfarbe (sequenziell: Z1 hell → Z5 kräftig). */
const ZONE_FILL: Record<PlannedSport, Record<Zone, string>> = {
  swim: { z1: 'fill-swim/25', z2: 'fill-swim/45', z3: 'fill-swim/60', z4: 'fill-swim/80', z5: 'fill-swim' },
  bike: { z1: 'fill-bike/25', z2: 'fill-bike/45', z3: 'fill-bike/60', z4: 'fill-bike/80', z5: 'fill-bike' },
  run: { z1: 'fill-run/25', z2: 'fill-run/45', z3: 'fill-run/60', z4: 'fill-run/80', z5: 'fill-run' },
  strength: { z1: '', z2: '', z3: '', z4: '', z5: '' },
};
const ZONE_BG: Record<PlannedSport, Record<Zone, string>> = {
  swim: { z1: 'bg-swim/25', z2: 'bg-swim/45', z3: 'bg-swim/60', z4: 'bg-swim/80', z5: 'bg-swim' },
  bike: { z1: 'bg-bike/25', z2: 'bg-bike/45', z3: 'bg-bike/60', z4: 'bg-bike/80', z5: 'bg-bike' },
  run: { z1: 'bg-run/25', z2: 'bg-run/45', z3: 'bg-run/60', z4: 'bg-run/80', z5: 'bg-run' },
  strength: { z1: '', z2: '', z3: '', z4: '', z5: '' },
};

type SportFilter = PlannedSport | 'all';

function fmtMetric(metric: MetricKey, sport: SportFilter) {
  return (v: number) =>
    metric === 'duration'
      ? formatDurationShort(v)
      : metric === 'distance'
        ? formatDistance(v, sport === 'swim' ? 'auto-swim' : 'km')
        : `${formatNumber(v, 0)}×`;
}

export function Analysis({ ctx, settings }: { ctx: ActiveContext; settings: AppSettings }) {
  const { navigate } = useNav();
  const today = useToday(settings.timeZone);
  const [period, setPeriod] = useState<AnalysisPeriod>('4w');
  const [sport, setSport] = useState<SportFilter>('all');
  const [metric, setMetric] = useState<MetricKey>('duration');
  const data = useLive(async (r) => ({ activities: await r.listActivities(), checkins: await r.listCheckins() }), []);
  if (!data) return <Loading />;

  const starts = periodWeekStarts(period, today, ctx.race.prepStartDate, ctx.race.date);
  const rows = analysisWeeks(starts, ctx.weeks, data.activities, data.checkins);
  const labels = starts.map((s) => String(isoWeek(s).week));
  const effMetric: MetricKey = sport === 'all' ? 'duration' : sport === 'strength' && metric === 'distance' ? 'sessions' : metric;
  const fmt = fmtMetric(effMetric, sport);

  const pick = (s: PlannedSport, r: (typeof rows)[number]) => {
    const v = r.sports[s];
    return effMetric === 'duration' ? v.doneSec : effMetric === 'distance' ? v.doneM : v.doneSessions;
  };
  const pickPlan = (s: PlannedSport, r: (typeof rows)[number]) => {
    const v = r.sports[s];
    return effMetric === 'duration' ? v.plannedSec : effMetric === 'distance' ? v.plannedM : v.plannedSessions;
  };

  const shownSports = sport === 'all' ? [...PLANNED_SPORTS] : [sport];
  const other = otherActivitySummary(data.activities, starts);
  const series: BarSeries[] = shownSports.map((s) => ({
    key: s,
    label: SPORT_LABEL[s],
    fillClass: FILL[s],
    swatchClass: BG[s],
    values: rows.map((r) => pick(s, r)),
  }));
  // „Sonstiges / Cardio“ nur in der Gesamtansicht (Dauer) – ohne Wochenziel
  if (sport === 'all' && other.count > 0) {
    series.push({ key: 'other', label: SPORT_SHORT.other, fillClass: 'fill-other', swatchClass: 'bg-other', values: rows.map((r) => r.otherSec) });
  }
  // Gesamtziel nur, wenn jede Sportart mit Ziel in der Woche ein Dauerziel hat
  const targets = rows.map((r) => {
    if (sport !== 'all') return pickPlan(sport, r);
    let sum = 0;
    let any = false;
    for (const s of PLANNED_SPORTS) {
      const v = r.sports[s];
      const hasTarget = v.plannedSec !== null || v.plannedM !== null || v.plannedSessions !== null;
      if (!hasTarget) continue;
      if (v.plannedSec === null) return null;
      sum += v.plannedSec;
      any = true;
    }
    return any ? sum : null;
  });
  const hasTargets = targets.some((t) => t !== null);

  const loads = rows.map((r) => (r.load.withRpe > 0 ? (sport === 'all' ? r.load.load : r.loadBySport[sport]) : null));
  const loadSeries: BarSeries[] =
    sport === 'all'
      ? ([...PLANNED_SPORTS, 'other'] as const)
          .filter((s) => rows.some((r) => r.loadBySport[s] > 0))
          .map((s) => ({
            key: s,
            label: s === 'other' ? SPORT_SHORT.other : SPORT_LABEL[s],
            fillClass: s === 'other' ? 'fill-other' : FILL[s],
            swatchClass: s === 'other' ? 'bg-other' : BG[s],
            values: rows.map((r) => r.loadBySport[s]),
          }))
      : [{ key: sport, label: SPORT_LABEL[sport], fillClass: FILL[sport], swatchClass: BG[sport], values: loads.map((l) => l ?? 0) }];
  const currentWeek = startOfWeek(today);
  const compliance = rows.map((r) => (compareDates(r.weekStart, currentWeek) <= 0 ? weekCompliance(r, sport) : null));
  const compSummary = complianceSummary(rows.map((r, i) => (compareDates(r.weekStart, currentWeek) < 0 ? compliance[i]! : null)));
  const loadMean = trailingMean(loads, 4);
  const anyLoad = loads.some((l) => l !== null);
  const anyFresh = rows.some((r) => r.freshness !== null);

  const enduranceShown = (sport === 'all' ? [...ENDURANCE_SPORTS] : ENDURANCE_SPORTS.filter((s) => s === sport)) as PlannedSport[];
  const focus = focusCounts(data.activities, starts);

  return (
    <Screen title="Analysen" subtitle={`${starts.length === 1 ? 'Diese Woche' : `${starts.length} Wochen`}, bis KW ${labels[labels.length - 1]}`}>
      <Segmented<AnalysisPeriod>
        ariaLabel="Zeitraum"
        value={period}
        onChange={setPeriod}
        options={[
          { value: 'week', label: 'Woche' },
          { value: '4w', label: '4 Wo.' },
          { value: '12w', label: '12 Wo.' },
          { value: 'plan', label: 'Plan' },
        ]}
      />
      <div className="flex flex-wrap gap-2">
        <Chip active={sport === 'all'} onClick={() => setSport('all')}>
          Alle
        </Chip>
        {PLANNED_SPORTS.map((s) => (
          <Chip key={s} active={sport === s} onClick={() => setSport(s)}>
            {SPORT_SHORT[s]}
          </Chip>
        ))}
      </div>

      <Section title="Umfang">
        {sport !== 'all' && (
          <div className="mb-3">
            <Segmented<MetricKey>
              ariaLabel="Größe"
              value={sport === 'strength' && metric === 'distance' ? 'sessions' : metric}
              onChange={setMetric}
              options={
                sport === 'strength'
                  ? [
                      { value: 'duration', label: 'Dauer' },
                      { value: 'sessions', label: 'Workouts' },
                    ]
                  : [
                      { value: 'duration', label: 'Dauer' },
                      { value: 'distance', label: 'Distanz' },
                      { value: 'sessions', label: 'Einheiten' },
                    ]
              }
            />
          </div>
        )}
        <Legend
          items={[
            ...(series.length > 1 ? series.map((s) => ({ label: s.label, swatchClass: s.swatchClass })) : []),
            ...(hasTargets ? [{ label: sport === 'all' ? 'Wochenziel gesamt' : 'Wochenziel', swatchClass: 'bg-ink', kind: 'tick' as const }] : []),
          ]}
        />
        <WeekBarChart
          labels={labels}
          series={series}
          {...(hasTargets ? { targets } : {})}
          format={fmt}
          niceUnit={effMetric === 'duration' ? 3600 : effMetric === 'distance' ? (sport === 'swim' ? 100 : 1000) : 1}
          axisFormat={(v) =>
            effMetric === 'duration'
              ? `${formatNumber(v / 3600, 1)} h`
              : effMetric === 'distance'
                ? sport === 'swim' && v < 10000
                  ? `${formatNumber(v, 0)} m`
                  : `${formatNumber(v / 1000, 0)} km`
                : formatNumber(v, 0)
          }
          ariaLabel={`Umfang je Woche: ${series.map((s) => `${s.label} ${fmt(s.values.reduce((a, b) => a + b, 0))}`).join(', ')}`}
        />
        <p className="mt-1 text-xs text-muted">
          Woche antippen für Details.{sport === 'all' ? ' Bei „Alle“ wird die Dauer gezeigt – Distanzen verschiedener Sportarten lassen sich nicht addieren.' : ''}
        </p>
      </Section>

      <Section title="Soll und Ist">
        <table className="num w-full text-left text-sm">
          <thead className="text-xs text-muted">
            <tr>
              <th className="py-1 font-medium">Sportart</th>
              <th className="py-1 font-medium">Ist</th>
              <th className="py-1 font-medium">Soll</th>
              <th className="py-1 text-right font-medium">Erreicht</th>
            </tr>
          </thead>
          <tbody>
            {shownSports.map((s) => {
              const m: MetricKey = sport === 'all' ? (s === 'strength' ? 'sessions' : settings.primaryMetric[s]) : effMetric;
              const c = compareToTarget(rows, s, m);
              const f = fmtMetric(m, s);
              return (
                <tr key={s} className="border-t border-line align-top">
                  <td className="py-2 pr-3">
                    <span className="inline-flex items-center gap-1.5">
                      <span className={SPORT_TEXT_CLASS[s]}>
                        <SportIcon sport={s} className="h-4 w-4" />
                      </span>
                      {SPORT_SHORT[s]}
                    </span>
                  </td>
                  <td className="py-2">
                    {f(c.doneAll)}
                    {c.planned !== null && c.doneAll !== c.doneInPlannedWeeks && (
                      <span className="block text-xs text-muted">davon {f(c.doneInPlannedWeeks)} in Wochen mit Ziel</span>
                    )}
                  </td>
                  <td className="py-2">
                    {c.planned !== null ? f(c.planned) : '–'}
                    {c.planned !== null && c.weeksWithTarget < c.weeks && (
                      <span className="block text-xs text-muted">
                        {c.weeksWithTarget} von {c.weeks} Wochen
                      </span>
                    )}
                  </td>
                  <td className="py-2 text-right font-semibold whitespace-nowrap">{c.ratio !== null ? formatPercent(c.ratio) : '–'}</td>
                </tr>
              );
            })}
            {sport === 'all' && other.count > 0 && (
              <tr className="border-t border-line align-top" data-testid="analysis-other-row">
                <td className="py-2 pr-3">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="text-other">
                      <SportIcon sport="other" className="h-4 w-4" />
                    </span>
                    {SPORT_SHORT.other}
                  </span>
                </td>
                <td className="py-2">
                  {formatDurationShort(other.durationSec)}
                  <span className="block text-xs text-muted">
                    {other.byLabel
                      .slice(0, 3)
                      .map((g) => `${g.label} ${formatDurationShort(g.durationSec)}`)
                      .join(', ')}
                    {other.byLabel.length > 3 ? ', …' : ''}
                  </span>
                </td>
                <td className="py-2 text-muted">ohne Ziel</td>
                <td className="py-2 text-right">–</td>
              </tr>
            )}
          </tbody>
        </table>
        <p className="mt-2 text-xs text-muted">Erreicht = Ist in Wochen mit Ziel geteilt durch Soll. Wochen ohne Ziel fließen nur ins Ist ein.</p>
      </Section>

      {hasTargets && (
        <Section title="Planerfüllung" aside="absolviert ÷ geplant">
          {compliance.every((c) => c === null) ? (
            <p className="text-sm text-muted">Für diese Auswahl gibt es in vergangenen Wochen keine vollständigen Dauerziele.</p>
          ) : (
            <>
              <WeekBarChart
                labels={labels}
                series={[{ key: 'comp', label: 'Planerfüllung', fillClass: sport === 'all' ? 'fill-ink/60' : FILL[sport], swatchClass: 'bg-ink', values: compliance.map((c) => (c === null ? 0 : c * 100)) }]}
                targets={compliance.map((c) => (c === null ? null : 100))}
                format={(v) => `${Math.round(v)} %`}
                niceUnit={50}
                dimmed={rows.map((r) => r.weekStart === currentWeek)}
                describe={(i) => (rows[i]?.weekStart === currentWeek ? 'laufende Woche' : compliance[i] === null ? 'kein vollständiges Ziel' : null)}
                ariaLabel="Planerfüllung je Woche in Prozent, Marke bei 100 %"
              />
              <p className="num mt-1 text-sm" data-testid="compliance-summary">
                {compSummary.weeks === 0
                  ? 'Noch keine abgeschlossene Woche mit Ziel.'
                  : `${compSummary.weeks} abgeschlossene ${compSummary.weeks === 1 ? 'Woche' : 'Wochen'}, Ø ${formatPercent(compSummary.mean!)} · ≥ 90 %: ${compSummary.high} · 70–90 %: ${compSummary.mid} · unter 70 %: ${compSummary.low}`}
              </p>
              <p className="text-xs text-muted">Marke = 100 % des Wochenziels. Die laufende Woche ist blass und zählt nicht mit.{sport === 'all' ? ' Gesamt nur für Wochen, in denen jede geplante Sportart ein Dauerziel hat.' : ''}</p>
            </>
          )}
        </Section>
      )}

      {enduranceShown.length > 0 && (
        <Section title="Intensität">
          <div className="flex flex-col gap-6">
            {enduranceShown.map((s) => {
              const z = zoneSummary(rows, s);
              const f = focus.get(s);
              if (z.totalSec === 0 && !z.planned) {
                return (
                  <div key={s}>
                    <SportHeading sport={s} />
                    <p className="text-sm text-muted">Keine Einheiten im Zeitraum.</p>
                  </div>
                );
              }
              return (
                <div key={s}>
                  <SportHeading sport={s} />
                  <ShareBar
                    ariaLabel={`Zonenverteilung ${SPORT_LABEL[s]}`}
                    parts={[
                      ...ZONES.map((zz) => ({ key: zz, value: z.done[zz], className: ZONE_FILL[s][zz] })),
                      { key: 'unknown', value: z.unknownSec, className: '', pattern: true },
                    ]}
                  />
                  <table className="num mt-2 w-full text-left text-sm">
                    <thead className="text-xs text-muted">
                      <tr>
                        <th className="py-1 font-medium">Zone</th>
                        <th className="py-1 font-medium">Geplant</th>
                        <th className="py-1 text-right font-medium">Absolviert</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ZONES.filter((zz) => z.done[zz] > 0 || (z.planned?.[zz] ?? 0) > 0).map((zz) => (
                        <tr key={zz} className="border-t border-line">
                          <td className="py-1.5">
                            <span className="inline-flex items-center gap-2">
                              <span className={`inline-block h-2.5 w-2.5 rounded-sm ${ZONE_BG[s][zz]}`} />
                              {ZONE_LABEL[zz]}
                            </span>
                          </td>
                          <td className="py-1.5">{z.planned && z.planned[zz] > 0 ? formatDurationShort(z.planned[zz]) : '–'}</td>
                          <td className="py-1.5 text-right">{formatDurationShort(z.done[zz])}</td>
                        </tr>
                      ))}
                      <tr className="border-t border-line text-muted">
                        <td className="py-1.5">
                          <span className="inline-flex items-center gap-2">
                            <span className="inline-block h-2.5 w-2.5 rounded-sm border border-muted bg-[repeating-linear-gradient(45deg,var(--muted)_0_1.5px,transparent_1.5px_4px)]" />
                            Ohne Zonenangabe
                          </span>
                        </td>
                        <td className="py-1.5" />
                        <td className="py-1.5 text-right">{formatDurationShort(z.unknownSec)}</td>
                      </tr>
                    </tbody>
                  </table>
                  {z.knownShare !== null && (
                    <p className="mt-1 text-xs text-muted">
                      Für {formatPercent(z.knownShare)} der Trainingszeit sind Zonen erfasst. Der Rest wird keiner Zone zugeordnet.
                    </p>
                  )}
                  {f && f.size > 0 && (
                    <p className="mt-2 text-sm">
                      <span className="text-muted">Fokus der Einheiten: </span>
                      {[...f.entries()]
                        .sort((a, b) => b[1] - a[1])
                        .map(([k, n]) => `${n}× ${SESSION_FOCUS_LABEL[k]}`)
                        .join(', ')}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </Section>
      )}

      <Section title="Belastung und Frische">
        {!anyLoad ? (
          <p className="text-sm text-muted">Noch keine Einheiten mit Session-RPE im Zeitraum. Die Belastung wird nur aus erfassten RPE-Werten berechnet.</p>
        ) : (
          <>
            <Legend
              items={[
                ...loadSeries.map((x) => ({ label: x.label, swatchClass: x.swatchClass })),
                { label: 'Mittel 4 Wochen', swatchClass: 'bg-ink', kind: 'line' as const },
              ]}
            />
            <WeekBarChart
              labels={labels}
              series={loadSeries}
              line={{ label: 'Mittel 4 Wo.', values: loadMean }}
              format={(v) => formatNumber(v, 0)}
              niceUnit={100}
              dimmed={rows.map((r) => r.load.total > 0 && r.load.withRpe < r.load.total)}
              describe={(i) => {
                const r = rows[i];
                if (!r) return null;
                const parts = [
                  r.load.total ? `RPE bei ${r.load.withRpe} von ${r.load.total} Einheiten` : null,
                  r.freshness !== null ? `Frische ${r.freshness}/10` : null,
                ];
                return parts.filter(Boolean).join('; ') || null;
              }}
              ariaLabel={`Wöchentliche subjektive Belastung (min × RPE)${sport === 'all' ? ' je Sportart' : ''} mit gleitendem Mittel`}
            />
            <p className="mt-1 text-xs text-muted">Blasse Balken: nicht alle Einheiten der Woche haben einen RPE-Wert – die Summe ist dann eine Untergrenze.</p>
          </>
        )}
        {anyFresh && (
          <div className="mt-3">
            <p className="mb-1 text-xs text-muted">Frische (1–10) je Kalenderwoche</p>
            <div className="num flex gap-1 overflow-x-auto text-center text-xs">
              {rows.map((r, i) => (
                <div key={r.weekStart} className="min-w-9 rounded-lg bg-surface-2 px-1 py-1">
                  <div className="text-muted">{labels[i]}</div>
                  <div className="text-[15px] font-semibold">{r.freshness ?? '–'}</div>
                </div>
              ))}
            </div>
          </div>
        )}
        <p className="mt-2 text-xs text-muted">Nebeneinandergestellt, nicht verrechnet: Gleichzeitige Veränderungen zeigen keinen Ursache-Wirkungs-Zusammenhang.</p>
      </Section>

      <PrognosisSummary ctx={ctx} settings={settings} />

      <MetricsSummary />

      <Button variant="secondary" full onClick={() => navigate({ name: 'history' })}>
        Alle Einheiten anzeigen
      </Button>
    </Screen>
  );
}

function SportHeading({ sport }: { sport: PlannedSport }) {
  return (
    <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
      <span className={SPORT_TEXT_CLASS[sport]}>
        <SportIcon sport={sport} className="h-4 w-4" />
      </span>
      {SPORT_LABEL[sport]}
    </div>
  );
}

function MetricsSummary() {
  const { navigate } = useNav();
  const metrics = useLive((r) => r.listMetrics(), []);
  if (!metrics) return null;
  const rows = ENDURANCE_SPORTS.map((s) => ({ sport: s, h: metricHistory(metrics, s) }));
  return (
    <Section title="Leistungswerte" aside="erster → aktueller Wert">
      <ul className="num flex flex-col gap-1 text-sm" data-testid="analysis-metrics">
        {rows.map(({ sport, h }) => {
          const first = h[0]?.metric;
          const last = h[h.length - 1]?.metric;
          const rel = first && last && first !== last ? (HIGHER_IS_BETTER[sport] ? last.value / first.value - 1 : first.value / last.value - 1) : null;
          return (
            <li key={sport} className="flex items-center justify-between gap-3">
              <span className="inline-flex items-center gap-1.5">
                <span className={SPORT_TEXT_CLASS[sport]}>
                  <SportIcon sport={sport} className="h-4 w-4" />
                </span>
                {SPORT_SHORT[sport]}
              </span>
              <span>
                {!last ? (
                  <span className="text-muted">noch kein Test</span>
                ) : (
                  <>
                    {first !== last && <span className="text-muted">{fmtTestMetric(sport, first!.value)} → </span>}
                    <span className="font-semibold">{fmtTestMetric(sport, last.value)}</span>
                    {rel !== null && <span className={`ml-2 text-xs ${rel >= 0 ? 'text-ok' : 'text-warn'}`}>{rel >= 0 ? '+' : '−'}{formatPercent(Math.abs(rel))}</span>}
                  </>
                )}
              </span>
            </li>
          );
        })}
      </ul>
      <div className="mt-3">
        <Button variant="secondary" onClick={() => navigate({ name: 'tests' })}>
          Leistungstests
        </Button>
      </div>
    </Section>
  );
}

function PrognosisSummary({ ctx, settings }: { ctx: ActiveContext; settings: AppSettings }) {
  const { navigate } = useNav();
  const today = useToday(settings.timeZone);
  const data = usePrognosis(ctx, settings, today);
  if (!data || !data.prognosis.supported) return null;
  const tot = data.prognosis.total;
  return (
    <Section title="Zielzeit-Prognose" aside="Stand heute">
      <button type="button" onClick={() => navigate({ name: data.prognosis.needsSetup ? 'settings' : 'prognosis' })} className="w-full text-left" data-testid="analysis-prognosis">
        {data.prognosis.needsSetup ? (
          <span className="block text-sm">Hinterlege im Profil dein Race-Setup (Rad, Laufräder, Neo …), dann siehst du hier deine Zielzeit-Spanne ›</span>
        ) : tot ? (
          <>
            <span className="num block text-2xl font-bold">ca. {formatDurationShort(round5(tot.mid))}</span>
            <span className="num block text-sm text-muted">
              Spanne {formatDurationShort(round5(tot.lo))} – {formatDurationShort(round5(tot.hi))} · Details und Annahmen ›
            </span>
          </>
        ) : (
          <span className="block text-sm">Für eine Prognose fehlen noch Werte – tippen für Details ›</span>
        )}
      </button>
    </Section>
  );
}
