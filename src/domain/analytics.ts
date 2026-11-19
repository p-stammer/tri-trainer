/**
 * Analysen über mehrere Wochen. Reine Aggregation dokumentierter Daten – keine physiologischen
 * Kennzahlen (kein TSS/CTL), keine Kausalaussagen, unbekannte Werte bleiben unbekannt.
 */
import { addDays, compareDates, startOfWeek, type LocalDate } from './calendar';
import { sessionLoad, summarizeLoad, type LoadSummary } from './load';
import { activitiesInWeek, computeWeekProgress } from './progress';
import type { CompletedActivity, TrainingWeek, WeeklyWellnessCheckin } from './schemas';
import { PLANNED_SPORTS, ZONES, isEnduranceSport, type PlannedSport, type SessionFocus, type Zone } from './sports';

export type AnalysisPeriod = 'week' | '4w' | '12w' | 'plan';

/** Wochenanfänge des Zeitraums, chronologisch, bis einschließlich der aktuellen Woche. */
export function periodWeekStarts(period: AnalysisPeriod, today: LocalDate, prepStart: LocalDate, raceDate: LocalDate): LocalDate[] {
  const current = startOfWeek(today);
  const count = period === 'week' ? 1 : period === '4w' ? 4 : period === '12w' ? 12 : 0;
  if (count > 0) return Array.from({ length: count }, (_, i) => addDays(current, -7 * (count - 1 - i)));
  const first = startOfWeek(prepStart);
  const raceWeek = startOfWeek(raceDate);
  const last = compareDates(current, raceWeek) < 0 ? current : raceWeek;
  if (compareDates(last, first) < 0) return [current];
  const out: LocalDate[] = [];
  for (let d = first; compareDates(d, last) <= 0; d = addDays(d, 7)) out.push(d);
  return out;
}

export interface SportWeekValues {
  doneSec: number;
  doneM: number;
  doneSessions: number;
  activitiesWithoutDistance: number;
  plannedSec: number | null;
  plannedM: number | null;
  plannedSessions: number | null;
  zoneDone: Partial<Record<Zone, number>>;
  zonePlanned: Partial<Record<Zone, number>>;
  unknownZoneSec: number;
}

export interface AnalysisWeek {
  weekStart: LocalDate;
  sports: Record<PlannedSport, SportWeekValues>;
  /** „Sonstiges / Cardio“ – ohne Wochenziel, zählt aber zur Gesamtzeit und Belastung. */
  otherSec: number;
  otherCount: number;
  totalSec: number;
  load: LoadSummary;
  /** Session Load je Sportart (nur Einheiten mit RPE), seit 0.20.0. */
  loadBySport: Record<PlannedSport | 'other', number>;
  freshness: number | null;
}

export function analysisWeeks(
  weekStarts: readonly LocalDate[],
  weeks: readonly Pick<TrainingWeek, 'weekStart' | 'current'>[],
  activities: readonly CompletedActivity[],
  checkins: readonly WeeklyWellnessCheckin[],
): AnalysisWeek[] {
  return weekStarts.map((ws) => {
    const targets = weeks.find((w) => w.weekStart === ws)?.current;
    const p = computeWeekProgress(ws, targets, activities);
    const sports = {} as Record<PlannedSport, SportWeekValues>;
    for (const s of PLANNED_SPORTS) {
      const sp = p.sports[s];
      const zoneDone: Partial<Record<Zone, number>> = {};
      const zonePlanned: Partial<Record<Zone, number>> = {};
      for (const z of sp.zones) {
        if (z.doneSec > 0) zoneDone[z.zone] = z.doneSec;
        if (z.plannedSec !== null) zonePlanned[z.zone] = z.plannedSec;
      }
      sports[s] = {
        doneSec: sp.duration.done,
        doneM: sp.distance.done,
        doneSessions: sp.sessions.done,
        activitiesWithoutDistance: sp.activitiesWithoutDistance,
        plannedSec: sp.duration.planned,
        plannedM: sp.distance.planned,
        plannedSessions: sp.sessions.planned,
        zoneDone,
        zonePlanned,
        unknownZoneSec: sp.unknownZoneSec,
      };
    }
    return {
      weekStart: ws,
      sports,
      otherSec: p.other.durationSec,
      otherCount: p.other.count,
      totalSec: p.totalDurationSec,
      load: summarizeLoad(activitiesInWeek(activities, ws)),
      loadBySport: loadBySport(activitiesInWeek(activities, ws)),
      freshness: checkins.find((c) => c.weekStart === ws)?.freshness ?? null,
    };
  });
}

function loadBySport(acts: readonly CompletedActivity[]): Record<PlannedSport | 'other', number> {
  const out = { swim: 0, bike: 0, run: 0, strength: 0, other: 0 } as Record<PlannedSport | 'other', number>;
  for (const a of acts) {
    const l = sessionLoad(a);
    if (l !== null) out[a.sport] += l;
  }
  return out;
}

/**
 * Planerfüllung einer Woche (M4.5): absolvierte Dauer der geplanten Sportarten ÷ geplante Dauer.
 * Gesamt nur, wenn jede Sportart mit Ziel ein Dauerziel hat; je Sportart Dauer, sonst Distanz, sonst Einheiten.
 * Null ohne Ziel. Sonstiges/Cardio zählt nicht (kein Ziel).
 */
export function weekCompliance(r: AnalysisWeek, sport: PlannedSport | 'all'): number | null {
  if (sport !== 'all') {
    const v = r.sports[sport];
    if (v.plannedSec) return v.doneSec / v.plannedSec;
    if (v.plannedM) return v.doneM / v.plannedM;
    if (v.plannedSessions) return v.doneSessions / v.plannedSessions;
    return null;
  }
  let planned = 0;
  let done = 0;
  for (const s of PLANNED_SPORTS) {
    const v = r.sports[s];
    const has = v.plannedSec !== null || v.plannedM !== null || v.plannedSessions !== null;
    if (!has) continue;
    if (v.plannedSec === null) return null;
    planned += v.plannedSec;
    done += v.doneSec;
  }
  return planned > 0 ? done / planned : null;
}

export interface ComplianceSummary {
  weeks: number;
  high: number;
  mid: number;
  low: number;
  /** Mittel der Wochenquoten */
  mean: number | null;
}

/** Zusammenfassung über abgeschlossene Wochen: ≥ 90 %, 70–90 %, < 70 % (Schwellen wie bei den Anpassungsvorschlägen, H). */
export function complianceSummary(ratios: readonly (number | null)[]): ComplianceSummary {
  const xs = ratios.filter((x): x is number => x !== null);
  return {
    weeks: xs.length,
    high: xs.filter((x) => x >= 0.9).length,
    mid: xs.filter((x) => x >= 0.7 && x < 0.9).length,
    low: xs.filter((x) => x < 0.7).length,
    mean: xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null,
  };
}

export type MetricKey = 'duration' | 'distance' | 'sessions';

export interface TargetComparison {
  /** Ist über alle Wochen des Zeitraums. */
  doneAll: number;
  /** Soll-Summe – nur Wochen, für die ein Ziel dieser Größe existiert. */
  planned: number | null;
  /** Ist in genau diesen Wochen (fairer Vergleich mit dem Soll). */
  doneInPlannedWeeks: number;
  ratio: number | null;
  weeksWithTarget: number;
  weeks: number;
}

/** Soll-Ist für eine Sportart und Größe über den Zeitraum. */
export function compareToTarget(rows: readonly AnalysisWeek[], sport: PlannedSport, metric: MetricKey): TargetComparison {
  let doneAll = 0;
  let planned = 0;
  let doneInPlanned = 0;
  let weeksWithTarget = 0;
  for (const r of rows) {
    const v = r.sports[sport];
    const done = metric === 'duration' ? v.doneSec : metric === 'distance' ? v.doneM : v.doneSessions;
    const plan = metric === 'duration' ? v.plannedSec : metric === 'distance' ? v.plannedM : v.plannedSessions;
    doneAll += done;
    if (plan !== null) {
      planned += plan;
      doneInPlanned += done;
      weeksWithTarget += 1;
    }
  }
  return {
    doneAll,
    planned: weeksWithTarget ? planned : null,
    doneInPlannedWeeks: doneInPlanned,
    ratio: weeksWithTarget && planned > 0 ? doneInPlanned / planned : null,
    weeksWithTarget,
    weeks: rows.length,
  };
}

export interface ZoneSummary {
  done: Record<Zone, number>;
  planned: Record<Zone, number> | null;
  unknownSec: number;
  totalSec: number;
  /** Anteil der Trainingszeit mit Zonenangabe (0…1); null ohne Training. */
  knownShare: number | null;
}

export function zoneSummary(rows: readonly AnalysisWeek[], sport: PlannedSport): ZoneSummary {
  const done = Object.fromEntries(ZONES.map((z) => [z, 0])) as Record<Zone, number>;
  const planned = Object.fromEntries(ZONES.map((z) => [z, 0])) as Record<Zone, number>;
  let anyPlanned = false;
  let unknown = 0;
  let total = 0;
  for (const r of rows) {
    const v = r.sports[sport];
    total += v.doneSec;
    unknown += v.unknownZoneSec;
    for (const z of ZONES) {
      done[z] += v.zoneDone[z] ?? 0;
      const p = v.zonePlanned[z];
      if (p !== undefined) {
        planned[z] += p;
        anyPlanned = true;
      }
    }
  }
  return {
    done,
    planned: anyPlanned ? planned : null,
    unknownSec: isEnduranceSport(sport) ? unknown : 0,
    totalSec: total,
    knownShare: total > 0 && isEnduranceSport(sport) ? (total - unknown) / total : null,
  };
}

export interface OtherActivitySummary {
  durationSec: number;
  count: number;
  /** Nach Bezeichnung gruppiert (ohne Bezeichnung: „ohne Angabe“), absteigend nach Dauer. */
  byLabel: { label: string; durationSec: number; count: number }[];
}

/** „Sonstiges / Cardio“ im Zeitraum, nach Bezeichnung gruppiert. */
export function otherActivitySummary(activities: readonly CompletedActivity[], weekStarts: readonly LocalDate[]): OtherActivitySummary {
  const set = new Set(weekStarts);
  const groups = new Map<string, { label: string; durationSec: number; count: number }>();
  let durationSec = 0;
  let count = 0;
  for (const a of activities) {
    if (a.sport !== 'other' || !set.has(startOfWeek(a.date))) continue;
    durationSec += a.durationSec;
    count += 1;
    const label = a.label?.trim() || 'ohne Angabe';
    const key = label.toLocaleLowerCase('de');
    const g = groups.get(key) ?? { label, durationSec: 0, count: 0 };
    g.durationSec += a.durationSec;
    g.count += 1;
    groups.set(key, g);
  }
  return { durationSec, count, byLabel: [...groups.values()].sort((a, b) => b.durationSec - a.durationSec || a.label.localeCompare(b.label, 'de')) };
}

/** Anzahl Einheiten je Fokus und Sportart im Zeitraum. */
export function focusCounts(activities: readonly CompletedActivity[], weekStarts: readonly LocalDate[]): Map<PlannedSport, Map<SessionFocus, number>> {
  const set = new Set(weekStarts);
  const out = new Map<PlannedSport, Map<SessionFocus, number>>();
  for (const a of activities) {
    if (a.sport === 'other' || !set.has(startOfWeek(a.date))) continue;
    const m = out.get(a.sport) ?? new Map<SessionFocus, number>();
    m.set(a.focus, (m.get(a.focus) ?? 0) + 1);
    out.set(a.sport, m);
  }
  return out;
}

/**
 * Gleitender Mittelwert über die letzten `window` Werte (inklusive aktuellem). Fehlende Werte (null)
 * werden ausgelassen; ohne einen einzigen Wert im Fenster ist das Ergebnis null.
 */
export function trailingMean(values: readonly (number | null)[], window: number): (number | null)[] {
  return values.map((_, i) => {
    const slice = values.slice(Math.max(0, i - window + 1), i + 1).filter((v): v is number => v !== null);
    return slice.length ? slice.reduce((s, v) => s + v, 0) / slice.length : null;
  });
}
