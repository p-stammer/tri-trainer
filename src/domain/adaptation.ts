/**
 * Anpassungsvorschläge (M3.6, R16 „Rückkopplung statt einmaliger Optimierung“).
 * Prüft regelbasiert, ob ein vorgeschlagener Plan neu berechnet werden sollte. Ändert selbst nichts –
 * der Nutzer entscheidet, die Neuberechnung zeigt vorher jede geänderte Woche.
 */
import { addDays, compareDates, diffDays, formatDateDe, startOfWeek, type LocalDate } from './calendar';
import { scaleWeekTargets } from './plan';
import type { PlanWeekChange } from './planEdit';
import { painIssueTitle } from './health';
import type { PainIssue, PainObservation } from './schemas';
import type { CompletedActivity, PerformanceMetric, PerformanceMetricKind, TrainingPause, TrainingWeek, WeeklyWellnessCheckin } from './schemas';
import { ENDURANCE_SPORTS, SPORT_LABEL, type EnduranceSport } from './sports';
import { formatPace } from './units';

export type AdaptationReason =
  | { code: 'under'; sport: EnduranceSport; ratios: [number, number] }
  | { code: 'over'; sport: 'run'; ratio: number }
  | { code: 'fatigue'; freshness: number; date: LocalDate; deloadWeek: LocalDate | null }
  | { code: 'rpe'; mean: number; count: number; previousMean: number | null; deloadWeek: LocalDate | null }
  | { code: 'pain'; issueId: string; title: string; pain: number; date: LocalDate; sports: string[] }
  | { code: 'metric'; kind: PerformanceMetricKind; value: number; date: LocalDate }
  | { code: 'model'; from: string; to: string }
  | { code: 'priority'; changes: { sport: EnduranceSport; from: number; to: number; reason: string }[] };

/** Unter 70 % der geplanten Zeit in beiden letzten Wochen → Plan passt nicht zum tatsächlichen Umfang (H). */
export const UNDER_RATIO = 0.7;
/** Laufen über 120 % der geplanten Zeit → Hinweis, nicht mehr steigern (H). */
export const OVER_RATIO = 1.2;
const FRESHNESS_LOW = 3;
/** Entlastung als Sofortmaßnahme: gleiche Tiefe wie die festen Entlastungswochen (−30 %, R4). */
export const QUICK_DELOAD_FACTOR = 0.7;
const RESTFUL_PHASES = new Set(['recovery', 'taper', 'race', 'transition']);

/**
 * Woche für eine sofortige Entlastung: die laufende Woche, solange sie höchstens bis Mittwoch läuft,
 * sonst die nächste. Null, wenn diese Woche fehlt, kein Ziel hat oder ohnehin entlastet.
 */
export function quickDeloadWeek(today: LocalDate, weeks: AdaptationInput['weeks']): LocalDate | null {
  const ws = startOfWeek(addDays(today, 4)) === startOfWeek(today) ? startOfWeek(today) : addDays(startOfWeek(today), 7);
  const w = weeks.find((x) => x.weekStart === ws);
  if (!w || w.current.sports.length === 0) return null;
  if (w.current.phase && RESTFUL_PHASES.has(w.current.phase)) return null;
  return ws;
}

/** Änderung „Woche entlasten“: Umfang und Zonenzeit −30 %, Kraft höchstens 1×, Phase Entlastung, Hinweis. */
/** `cause` z. B. „Frische 2/10“ oder „hoher RPE bei lockeren Einheiten (Ø 6,3)“. */
export function quickDeloadChange(week: Pick<TrainingWeek, 'weekStart' | 'current'>, cause: string): PlanWeekChange {
  const scaled = scaleWeekTargets(week.current, QUICK_DELOAD_FACTOR);
  const note = `Entlastung nach ${cause}: Umfang −30 %, lange Einheiten entsprechend kürzer, Intervalle nur wenn du dich frisch fühlst.`;
  const after = {
    ...scaled,
    phase: 'recovery' as const,
    sports: scaled.sports.map((t) => (t.sport === 'strength' && t.sessions !== undefined && t.sessions > 1 ? { ...t, sessions: 1 } : t)),
    notes: (week.current.notes ? `${note}\n${week.current.notes}` : note).slice(0, 2000),
  };
  return { weekStart: week.weekStart, before: week.current, after };
}

/**
 * Ermüdungssignal aus Session-RPE (R13, TRAINING_SCIENCE 2.9: subjektive Maße reagieren empfindlich auf Belastung).
 * Betrachtet nur lockere Ausdauereinheiten (Regeneration, Grundlage, lang), weil deren RPE ohne Ermüdung niedrig sein sollte.
 * Schwellen sind Heuristik (H): letzte 14 Tage mindestens 3 Einheiten mit RPE und
 *   Ø ≥ 6 oder Ø mindestens 1,5 Punkte über den 4 Wochen davor (dort ebenfalls ≥ 3 Einheiten) bei Ø ≥ 5.
 */
export const RPE_EASY_HIGH = 6;
export const RPE_EASY_RISE = 1.5;
const RPE_EASY_RISE_FLOOR = 5;
const RPE_MIN_COUNT = 3;
const EASY_FOCUSES = new Set(['recovery', 'endurance', 'long']);

export function easyRpeTrend(
  activities: AdaptationInput['activities'],
  today: LocalDate,
  since?: LocalDate,
): { mean: number; count: number; previousMean: number | null } | null {
  const easy = activities.filter(
    (a) => (a.sport === 'swim' || a.sport === 'bike' || a.sport === 'run') && a.rpe !== undefined && a.focus !== undefined && EASY_FOCUSES.has(a.focus),
  );
  const inRange = (d: LocalDate, fromDaysAgo: number, toDaysAgo: number) => {
    const ago = diffDays(d, today);
    return ago >= toDaysAgo && ago < fromDaysAgo;
  };
  const recent = easy.filter((a) => inRange(a.date, 14, 0) && (!since || compareDates(a.date, since) >= 0));
  if (recent.length < RPE_MIN_COUNT) return null;
  const prev = easy.filter((a) => inRange(a.date, 42, 14));
  const mean = (xs: typeof easy) => xs.reduce((s, a) => s + (a.rpe ?? 0), 0) / xs.length;
  const m = mean(recent);
  const pm = prev.length >= RPE_MIN_COUNT ? mean(prev) : null;
  const triggered = m >= RPE_EASY_HIGH || (pm !== null && m >= RPE_EASY_RISE_FLOOR && m - pm >= RPE_EASY_RISE);
  return triggered ? { mean: m, count: recent.length, previousMean: pm } : null;
}

/** Schmerz ab 4/10 stoppt im Planer die Steigerung (H9) – ab hier lohnt die Überprüfung. */
export const PAIN_HIGH = 4;

const RELEVANT_METRICS: readonly PerformanceMetricKind[] = ['swim_css_s_per_100m', 'run_threshold_pace_s_per_km', 'bike_ftp_w'];

export interface AdaptationInput {
  today: LocalDate;
  weeks: readonly Pick<TrainingWeek, 'weekStart' | 'current'>[];
  activities: readonly (Pick<CompletedActivity, 'sport' | 'date' | 'durationSec'> & Partial<Pick<CompletedActivity, 'focus' | 'rpe'>>)[];
  checkins: readonly Pick<WeeklyWellnessCheckin, 'date' | 'freshness'>[];
  metrics: readonly Pick<PerformanceMetric, 'kind' | 'value' | 'date' | 'createdAt'>[];
  pauses: readonly Pick<TrainingPause, 'startDate' | 'endDate'>[];
  painIssues?: readonly Pick<PainIssue, 'id' | 'region' | 'side' | 'description' | 'sports' | 'status'>[];
  painObservations?: readonly Pick<PainObservation, 'issueId' | 'date' | 'pain' | 'createdAt'>[];
  /** Letzte Übernahme eines Planvorschlags; ohne sie gibt es keine Vorschläge. */
  lastGenerated?: { at: string; modelVersion?: string };
  currentModelVersion: string;
  /** Vorgeschlagene Gewichtung heute vs. bei der Übernahme gespeicherter Vorschlag (nur Modus automatisch/hybrid). */
  priorityChanges?: { sport: EnduranceSport; from: number; to: number; reason: string }[];
}

function weekHasPause(pauses: AdaptationInput['pauses'], weekStart: LocalDate): boolean {
  const end = addDays(weekStart, 6);
  return pauses.some((p) => compareDates(p.startDate, end) <= 0 && (!p.endDate || compareDates(p.endDate, weekStart) >= 0));
}

function versionLess(a: string, b: string): boolean {
  const pa = a.replace(/^im-gen-/, '').split('.').map(Number);
  const pb = b.replace(/^im-gen-/, '').split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const x = pa[i] ?? 0;
    const y = pb[i] ?? 0;
    if (x !== y) return x < y;
  }
  return false;
}

export function adaptationSuggestions(input: AdaptationInput): AdaptationReason[] {
  const out: AdaptationReason[] = [];
  if (!input.lastGenerated) return out;
  const current = startOfWeek(input.today);
  const generatedOn = input.lastGenerated.at.slice(0, 10) as LocalDate;
  const last2 = [addDays(current, -14), addDays(current, -7)];

  // Ziele verfehlt / übertroffen (nur Wochen nach der Übernahme, ohne Pausen)
  const doneIn = (sport: EnduranceSport, ws: LocalDate) =>
    input.activities.filter((a) => a.sport === sport && startOfWeek(a.date) === ws).reduce((s, a) => s + a.durationSec, 0);
  const plannedIn = (sport: EnduranceSport, ws: LocalDate) =>
    input.weeks.find((w) => w.weekStart === ws)?.current.sports.find((t) => t.sport === sport)?.durationSec;
  const eligible = last2.every((ws) => compareDates(addDays(ws, 6), generatedOn) >= 0 && !weekHasPause(input.pauses, ws));
  if (eligible) {
    for (const sport of ENDURANCE_SPORTS) {
      const ratios = last2.map((ws) => {
        const p = plannedIn(sport, ws);
        return p && p > 0 ? doneIn(sport, ws) / p : null;
      });
      const [r1, r2] = ratios;
      if (r1 != null && r2 != null && r1 < UNDER_RATIO && r2 < UNDER_RATIO) out.push({ code: 'under', sport, ratios: [r1, r2] });
    }
  }
  const lastWeek = addDays(current, -7);
  const pRun = plannedIn('run', lastWeek);
  if (pRun && pRun > 0 && compareDates(addDays(lastWeek, 6), generatedOn) >= 0) {
    const r = doneIn('run', lastWeek) / pRun;
    if (r > OVER_RATIO) out.push({ code: 'over', sport: 'run', ratio: r });
  }

  // Steht ohnehin eine Entlastungs-/Taperwoche an (z. B. nach „Woche entlasten“), sind Ermüdungshinweise erledigt
  const restWs = startOfWeek(addDays(input.today, 4)) === current ? current : addDays(current, 7);
  const restPhase = input.weeks.find((w) => w.weekStart === restWs)?.current.phase;
  const restAhead = !!restPhase && RESTFUL_PHASES.has(restPhase);

  // Niedrige Frische (≤ 14 Tage alt)
  const latest = [...input.checkins].filter((c) => compareDates(c.date, input.today) <= 0).sort((a, b) => b.date.localeCompare(a.date))[0];
  if (!restAhead && latest && latest.freshness <= FRESHNESS_LOW && diffDays(latest.date, input.today) <= 14 && compareDates(latest.date, generatedOn) >= 0) {
    out.push({ code: 'fatigue', freshness: latest.freshness, date: latest.date, deloadWeek: quickDeloadWeek(input.today, input.weeks) });
  }

  // Lockere Einheiten fühlen sich hart an (RPE)
  const trend = restAhead ? null : easyRpeTrend(input.activities, input.today, generatedOn);
  if (trend) out.push({ code: 'rpe', ...trend, deloadWeek: quickDeloadWeek(input.today, input.weeks) });

  // Aktive Beschwerde mit Schmerz ≥ 4 (neuer Eintrag seit der Übernahme, ≤ 14 Tage alt), ohne laufende Pause
  const pausedNow = input.pauses.some((p) => compareDates(p.startDate, input.today) <= 0 && (!p.endDate || compareDates(p.endDate, input.today) >= 0));
  if (!pausedNow) {
    for (const issue of input.painIssues ?? []) {
      if (issue.status !== 'active') continue;
      const last = (input.painObservations ?? [])
        .filter((o) => o.issueId === issue.id && compareDates(o.date, input.today) <= 0)
        .sort((a, b) => (a.date === b.date ? b.createdAt.localeCompare(a.createdAt) : b.date.localeCompare(a.date)))[0];
      if (!last || last.pain < PAIN_HIGH || diffDays(last.date, input.today) > 14 || compareDates(last.date, generatedOn) < 0) continue;
      out.push({ code: 'pain', issueId: issue.id, title: painIssueTitle(issue), pain: last.pain, date: last.date, sports: issue.sports.map((x) => SPORT_LABEL[x]) });
    }
  }

  // Neue Leistungswerte seit der Übernahme
  for (const kind of RELEVANT_METRICS) {
    const m = input.metrics.filter((x) => x.kind === kind).sort((a, b) => b.date.localeCompare(a.date))[0];
    if (m && m.createdAt > input.lastGenerated.at) out.push({ code: 'metric', kind, value: m.value, date: m.date });
  }

  // Ältere Planlogik
  const from = input.lastGenerated.modelVersion;
  if (from && versionLess(from, input.currentModelVersion)) out.push({ code: 'model', from, to: input.currentModelVersion });
  // Neue Gewichtung (nur bei aktueller Planlogik – sonst erklärt der Modellhinweis die Abweichung)
  else if (input.priorityChanges && input.priorityChanges.length > 0) out.push({ code: 'priority', changes: input.priorityChanges });
  return out;
}

const METRIC_TEXT: Record<string, (v: number) => string> = {
  swim_css_s_per_100m: (v) => `CSS ${formatPace(v)} /100 m`,
  run_threshold_pace_s_per_km: (v) => `Schwellenpace ${formatPace(v)} /km`,
  bike_ftp_w: (v) => `FTP ${Math.round(v)} W`,
};

export function adaptationText(r: AdaptationReason): string {
  const pct = (x: number) => `${Math.round(x * 100)} %`;
  switch (r.code) {
    case 'under':
      return `${SPORT_LABEL[r.sport]}: in den letzten zwei Wochen nur ${pct(r.ratios[0])} bzw. ${pct(r.ratios[1])} der geplanten Zeit. Ein neuer Vorschlag startet bei deinem tatsächlichen Umfang.`;
    case 'over':
      return `Laufen: letzte Woche ${pct(r.ratio)} der geplanten Zeit. Mehr als geplant zu laufen erhöht die Belastung – lieber den Plan einhalten oder neu vorschlagen lassen (steigert dann sicher ab dem tatsächlichen Stand).`;
    case 'fatigue':
      return r.deloadWeek
        ? `Frische am ${formatDateDe(r.date, false)}: ${r.freshness} von 10. Du kannst die Woche ab ${formatDateDe(r.deloadWeek, false)} direkt entlasten (−30 %) – der Rest des Plans bleibt – oder einen neuen Vorschlag berechnen.`
        : `Frische am ${formatDateDe(r.date, false)}: ${r.freshness} von 10. Ein neuer Vorschlag plant zuerst eine Entlastungswoche ein.`;
    case 'rpe': {
      const m = r.mean.toFixed(1).replace('.', ',');
      const cmp = r.previousMean !== null ? ` (davor ${r.previousMean.toFixed(1).replace('.', ',')})` : '';
      const act = r.deloadWeek
        ? `Du kannst die Woche ab ${formatDateDe(r.deloadWeek, false)} direkt entlasten (−30 %) oder einen neuen Vorschlag berechnen.`
        : 'Ein neuer Vorschlag plant zuerst eine Entlastungswoche ein.';
      return `Lockere Einheiten fühlen sich hart an: durchschnittliche Anstrengung ${m} von 10 bei ${r.count} Einheiten in den letzten 14 Tagen${cmp}. Das kann ein Zeichen von Ermüdung sein. ${act}`;
    }
    case 'pain': {
      const sp = r.sports.length ? ` (${r.sports.join(', ')})` : '';
      return `Beschwerde ${r.title}${sp}: Schmerz ${r.pain} von 10 am ${formatDateDe(r.date, false)}. Ein neuer Vorschlag steigert die betroffenen Sportarten vorerst nicht; eine Pause kannst du direkt eintragen. Anhaltende oder starke Beschwerden bitte ärztlich bzw. physiotherapeutisch abklären lassen.`;
    }
    case 'metric':
      return `Neuer Leistungswert: ${METRIC_TEXT[r.kind]?.(r.value) ?? r.kind} vom ${formatDateDe(r.date, false)}. Distanzen und Intensität können damit genauer berechnet werden.`;
    case 'priority':
      return `Neue Gewichtung vorgeschlagen – ${r.changes.map((c) => `${SPORT_LABEL[c.sport]} ${c.from} → ${c.to}: ${c.reason}`).join('. ')}. Ein neuer Vorschlag verteilt die Zeit entsprechend.`;
    case 'model':
      return `Dein Plan stammt aus einer älteren Planlogik (${r.from}); die aktuelle (${r.to}) rechnet in einigen Punkten anders, z. B. Steigerung, Obergrenzen und Vorbereitungsrennen.`;
  }
}

/** Kurzer Anlass für „Woche entlasten“ (Notiz und Änderungsverlauf). */
export function deloadCause(r: AdaptationReason): string | null {
  if (r.code === 'fatigue') return `Frische ${r.freshness}/10`;
  if (r.code === 'rpe') return `hohem RPE bei lockeren Einheiten (Ø ${r.mean.toFixed(1).replace('.', ',')})`;
  return null;
}

/** Modellversion aus der Beschreibung einer früheren Übernahme („… Modell im-gen-1.3.0)“). */
export function modelVersionFromDescription(description: string): string | undefined {
  return /Modell (im-gen-[\d.]+\d)/.exec(description)?.[1];
}
