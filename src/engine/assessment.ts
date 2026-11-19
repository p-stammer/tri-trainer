/**
 * Modul B (Leistungsbewertung) und Modul C (Disziplinpriorisierung), PLAN_MODEL 4.9.
 * Leistungswerte werden nur innerhalb einer Disziplin bewertet – kein Vergleich FTP vs. CSS vs. Schwellenpace.
 */
import { diffDays, type LocalDate } from '../domain/calendar';
import { metricHistory } from '../domain/performanceTests';
import type { Prognosis } from '../domain/prognosis';
import type { GeneratorSettings, PerformanceMetric, PerformanceMetricKind } from '../domain/schemas';
import { ENDURANCE_SPORTS, SPORT_LABEL, type EnduranceSport } from '../domain/sports';
import { FIXED } from './params';
import type { AppliedPriority, Baseline, DisciplineAssessment, Uncertainty } from './types';

const METRIC_KINDS: Record<EnduranceSport, readonly PerformanceMetricKind[]> = {
  swim: ['swim_css_s_per_100m'],
  bike: ['bike_ftp_w', 'bike_threshold_hr'],
  run: ['run_threshold_pace_s_per_km', 'run_threshold_hr'],
};
const STALE_WEEKS = 12;

/**
 * Dynamische Repriorisierung (Modell 1.7.0, alle Schwellen H, PLAN_MODEL 4.9):
 * - Testverlauf: Vortest und letzter Test ≤ 16 Wochen alt, ≥ 3 Wochen auseinander; Verschlechterung ≥ 3 % → +1.
 * - Prognose-Teilzeiten: Anteil an Schwimmen + Rad + Laufen gegen den typischen Anteil von Altersklassen-Athleten
 *   [D2: schnellste Gruppe ≈ 10/54/35 %, langsamste ≈ 10/48/40 %, je nach prognostizierter Zeit interpoliert];
 *   mindestens 10 % (relativ) höher → „relativ langsamer“ +1, mindestens 10 % niedriger → „relativ stärker“ −1.
 * Zusammenhänge, kein belegter Nutzen von mehr Training in der schwächeren Disziplin (TRAINING_SCIENCE 2.7).
 */
export const TREND_MAX_AGE_WEEKS = 16;
export const TREND_MIN_GAP_WEEKS = 3;
export const TREND_DECLINE = 0.03;
export const SHARE_DEVIATION = 0.1;
/** Referenzanteile [D2] Schwimmen/Rad/Laufen (ohne Wechsel), schnellste bzw. langsamste Leistungsgruppe. */
export const REFERENCE_SHARES = {
  fast: { swim: 0.1, bike: 0.54, run: 0.35 },
  slow: { swim: 0.1, bike: 0.48, run: 0.4 },
} as const;

/** Typischer Anteil je Disziplin für eine prognostizierte Gesamtzeit (≤ 9 h schnell, ≥ 14 h langsam, dazwischen linear; H). */
export function referenceShares(totalSec: number): Record<EnduranceSport, number> {
  const t = Math.min(1, Math.max(0, (totalSec / 3600 - 9) / 5));
  const raw = Object.fromEntries(
    ENDURANCE_SPORTS.map((sp) => [sp, REFERENCE_SHARES.fast[sp] + (REFERENCE_SHARES.slow[sp] - REFERENCE_SHARES.fast[sp]) * t]),
  ) as Record<EnduranceSport, number>;
  const sum = ENDURANCE_SPORTS.reduce((s, sp) => s + raw[sp], 0);
  return Object.fromEntries(ENDURANCE_SPORTS.map((sp) => [sp, raw[sp] / sum])) as Record<EnduranceSport, number>;
}
/** Eigener Umfangsanteil unter 60 % des Rennanteils → „Umfang deutlich unter Rennanteil“. */
const UNDER_SHARE = 0.6;

export function assessDisciplines(
  baseline: Baseline,
  metrics: readonly PerformanceMetric[],
  today: LocalDate,
  prognosis?: Prognosis | null,
): DisciplineAssessment[] {
  const total = ENDURANCE_SPORTS.reduce((s, sp) => s + (baseline.bySport[sp]?.durationSec ?? 0), 0);
  // Prognose-Anteile nur, wenn alle drei Disziplinen geschätzt sind
  const mids = prognosis?.total
    ? Object.fromEntries(
        ENDURANCE_SPORTS.map((sp) => {
          const c = prognosis.splits.find((x) => x.split === sp)?.combined;
          return [sp, c ? (c.lo + c.hi) / 2 : 0];
        }),
      )
    : null;
  const midSum = mids ? ENDURANCE_SPORTS.reduce((s, sp) => s + (mids[sp] ?? 0), 0) : 0;
  const refs = prognosis?.total ? referenceShares(prognosis.total.mid) : null;
  return ENDURANCE_SPORTS.map((sport) => {
    const sb = baseline.bySport[sport];
    const raceShare = FIXED.baseWeights[sport];
    const findings: string[] = [];
    const a: DisciplineAssessment = { sport, raceShare, metrics: [], quality: sb?.quality ?? 'low', findings };
    if (total > 0) {
      a.volumeShare = (sb?.durationSec ?? 0) / total;
      if (a.volumeShare < UNDER_SHARE * raceShare) {
        findings.push(
          `${SPORT_LABEL[sport]}: ${Math.round(a.volumeShare * 100)} % deines Umfangs, aber etwa ${Math.round(raceShare * 100)} % der Rennzeit – Umfang deutlich unter Rennanteil.`,
        );
      }
    }
    for (const kind of METRIC_KINDS[sport]) {
      const latest = metrics.filter((m) => m.kind === kind).sort((x, y) => y.date.localeCompare(x.date))[0];
      if (!latest) continue;
      const ageWeeks = Math.floor(diffDays(latest.date, today) / 7);
      const stale = ageWeeks > STALE_WEEKS;
      a.metrics.push({ kind, value: latest.value, ageWeeks, stale });
      if (stale) findings.push(`${SPORT_LABEL[sport]}: Leistungswert ist ${ageWeeks} Wochen alt – bitte neu testen.`);
    }
    if (a.metrics.length === 0) findings.push(`${SPORT_LABEL[sport]}: kein Leistungswert hinterlegt.`);
    // Testverlauf
    const hist = metricHistory(metrics, sport);
    const last = hist[hist.length - 1];
    const prev = hist[hist.length - 2];
    if (last && prev && last.improvement !== null) {
      const age = diffDays(last.metric.date, today) / 7;
      const gap = diffDays(prev.metric.date, last.metric.date) / 7;
      if (age <= TREND_MAX_AGE_WEEKS && gap >= TREND_MIN_GAP_WEEKS) {
        a.trend = { change: last.improvement, weeksApart: Math.round(gap) };
        if (last.improvement <= -TREND_DECLINE) {
          findings.push(`${SPORT_LABEL[sport]}: letzter Test ${Math.round(Math.abs(last.improvement) * 100)} % schwächer als der Vortest.`);
        }
      }
    }
    // Prognose-Teilzeiten
    if (mids && refs && midSum > 0) {
      a.predictedShare = (mids[sport] ?? 0) / midSum;
      a.referenceShare = refs[sport];
    }
    return a;
  });
}

function clampPrio(v: number): number {
  return Math.min(5, Math.max(1, Math.round(v)));
}

/** Modul C: vorgeschlagene, gewünschte und angewandte Priorität getrennt (Anforderung 21). */
export function applyPriorities(
  assessments: readonly DisciplineAssessment[],
  settings: Pick<GeneratorSettings, 'priorityMode' | 'priorities'>,
): { priorities: AppliedPriority[]; uncertainties: Uncertainty[] } {
  const uncertainties: Uncertainty[] = [];
  const priorities = assessments.map((a): AppliedPriority => {
    const under = a.volumeShare !== undefined && a.volumeShare < UNDER_SHARE * a.raceShare;
    const factors: string[] = [];
    let suggested = 3;
    if (under) {
      suggested += 1;
      factors.push('Umfang deutlich unter Rennanteil (+1)');
    }
    if (a.trend && a.trend.change <= -TREND_DECLINE) {
      suggested += 1;
      factors.push(`letzter Test ${Math.round(Math.abs(a.trend.change) * 100)} % schwächer (+1)`);
    }
    if (a.predictedShare !== undefined && a.referenceShare !== undefined) {
      const dev = a.predictedShare / a.referenceShare - 1;
      const pct = (x: number) => `${Math.round(x * 100)} %`;
      if (dev >= SHARE_DEVIATION) {
        suggested += 1;
        factors.push(`Prognose: ${pct(a.predictedShare)} der Zeit statt typisch ${pct(a.referenceShare)} – relativ langsamer (+1)`);
      } else if (dev <= -SHARE_DEVIATION) {
        suggested -= 1;
        factors.push(`Prognose: ${pct(a.predictedShare)} der Zeit statt typisch ${pct(a.referenceShare)} – relativ stärker (−1)`);
      }
    }
    // automatisch nie unter 2 (Stufe 1 nur auf eigenen Wunsch), nie über 5
    suggested = Math.min(5, Math.max(2, suggested));
    let reason = factors.length ? factors.join('; ') : 'Umfang, Testverlauf und Prognose unauffällig';
    if (a.quality === 'low') {
      suggested = 3;
      factors.length = 0;
      reason = 'zu wenige Daten für eine belastbare Priorisierung';
      uncertainties.push({ topic: `priority.${a.sport}`, text: `${SPORT_LABEL[a.sport]}: Keine belastbare Priorisierung möglich – zu wenige Daten. Es gilt die neutrale Stufe 3.` });
    }
    const user = settings.priorities[a.sport]?.user;
    const mode = settings.priorityMode;
    let applied = suggested;
    if (mode === 'manual') {
      applied = user ?? 3;
      reason = user !== undefined ? 'manuell festgelegt' : 'manuell, aber ohne Wert – neutrale Stufe 3';
    } else if (mode === 'hybrid') {
      applied = clampPrio(((user ?? suggested) + suggested) / 2);
      reason = user !== undefined ? `Mittel aus deinem Wunsch (${user}) und Vorschlag (${suggested})` : reason;
    }
    const p: AppliedPriority = { sport: a.sport, suggested, applied: clampPrio(applied), mode, reason, factors: [...factors] };
    if (user !== undefined) p.user = user;
    return p;
  });
  return { priorities, uncertainties };
}
