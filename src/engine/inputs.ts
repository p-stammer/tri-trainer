/**
 * Modul A – Eingaben und Datenqualität (PLAN_MODEL 3).
 * Ermittelt den Ausgangsumfang je Sportart aus Profil und erfassten Einheiten. Fehlende Pflichtangaben
 * führen zu `NeedsInput` – es wird nichts geschätzt.
 */
import { addDays, compareDates, diffDays, type LocalDate } from '../domain/calendar';
import type { CompletedActivity } from '../domain/schemas';
import { ENDURANCE_SPORTS, SPORT_LABEL, type EnduranceSport } from '../domain/sports';
import { FIXED } from './params';
import type { Baseline, DataQuality, NeedsInput, PlanGeneratorInput, SportBaseline, Warning } from './types';

export interface InputsResult {
  baseline: Baseline;
  needs: NeedsInput[];
  warnings: Warning[];
  /** Eingaben, auf die sich der Ausgangsumfang stützt (für Begründungen). */
  sources: string[];
}

const HISTORY_WEEKS = 4;

/** Summe je Woche der letzten 4 Wochen vor `firstWeek`, nur wenn in mindestens 3 Wochen trainiert wurde. */
function historyWeekly(history: readonly CompletedActivity[], sport: EnduranceSport | 'strength', firstWeek: LocalDate) {
  const from = addDays(firstWeek, -7 * HISTORY_WEEKS);
  const weeks = new Set<number>();
  let dur = 0;
  let dist = 0;
  let distKnown = true;
  let count = 0;
  for (const a of history) {
    if (a.sport !== sport) continue;
    if (compareDates(a.date, from) < 0 || compareDates(a.date, firstWeek) >= 0) continue;
    weeks.add(Math.floor(diffDays(from, a.date) / 7));
    dur += a.durationSec;
    if (a.distanceM === undefined) distKnown = false;
    else dist += a.distanceM;
    count += 1;
  }
  if (weeks.size < 3) return null;
  return {
    durationSec: dur / HISTORY_WEEKS,
    distanceM: distKnown && dist > 0 ? dist / HISTORY_WEEKS : undefined,
    sessions: count / HISTORY_WEEKS,
    weeks: weeks.size,
  };
}

/** Längste Einheit der letzten 30 Tage vor `firstWeek`. */
function longestRecent(history: readonly CompletedActivity[], sport: EnduranceSport, firstWeek: LocalDate) {
  const from = addDays(firstWeek, -30);
  let best: CompletedActivity | undefined;
  for (const a of history) {
    if (a.sport !== sport || compareDates(a.date, from) < 0 || compareDates(a.date, firstWeek) >= 0) continue;
    if (!best || a.durationSec > best.durationSec) best = a;
  }
  return best ? { durationSec: best.durationSec, distanceM: best.distanceM } : null;
}

function ageOn(birthDate: LocalDate | undefined, today: LocalDate): number | undefined {
  if (!birthDate) return undefined;
  const [by, bm, bd] = birthDate.split('-').map(Number);
  const [ty, tm, td] = today.split('-').map(Number);
  if (!by || !bm || !bd || !ty || !tm || !td) return undefined;
  return ty - by - (tm < bm || (tm === bm && td < bd) ? 1 : 0);
}

export function buildBaseline(input: PlanGeneratorInput): InputsResult {
  const needs: NeedsInput[] = [];
  const warnings: Warning[] = [];
  const sources: string[] = [];
  const { profile, history, firstWeek, today, settings } = input;

  if (compareDates(input.race.date, today) < 0) {
    needs.push({ code: 'race_in_past', message: 'Der Wettkampf liegt in der Vergangenheit. Bitte im Profil ein neues Datum eintragen.' });
  }
  if (input.planWeeks.filter((w) => compareDates(w, firstWeek) >= 0).length === 0) {
    needs.push({ code: 'no_weeks', message: 'Ab der gewählten Woche gibt es keine Planwochen mehr bis zum Wettkampf.' });
  }

  const budgetSec = profile?.availableWeeklySec ?? 0;
  if (!budgetSec) {
    needs.push({ code: 'budget', message: 'Wie viel Zeit hast du künftig höchstens pro Woche fürs Training? Ohne Zeitbudget kann ich keinen Plan rechnen.' });
  } else sources.push('profile.availableWeeklySec');

  const pb = profile?.baseline;
  const bySport: Baseline['bySport'] = {};
  let anyBaseline = false;

  for (const sport of ENDURANCE_SPORTS) {
    const p = pb?.[sport];
    const h = historyWeekly(history, sport, firstWeek);
    let durationSec: number | undefined;
    let distanceM: number | undefined;
    let sessions: number | undefined;
    let source: SportBaseline['source'] = 'none';
    let quality: DataQuality = 'low';

    if (h) {
      // 1.5.0: Erfasste Einheiten (in ≥ 3 der letzten 4 Wochen) haben Vorrang vor der Profilangabe – sie zeigen den aktuellen Stand.
      durationSec = h.durationSec;
      const profileRatio = p?.durationSec && p.distanceM ? p.distanceM / p.durationSec : undefined;
      distanceM = h.distanceM ?? (profileRatio ? h.durationSec * profileRatio : undefined);
      sessions = h.sessions;
      source = 'history';
      quality = h.weeks >= 4 ? 'high' : 'medium';
      sources.push(`history.${sport}`);
      anyBaseline = true;
    } else if (p?.durationSec !== undefined) {
      durationSec = p.durationSec;
      distanceM = p.distanceM;
      sessions = p.sessions;
      source = 'profile';
      quality = 'medium';
      sources.push(`profile.baseline.${sport}`);
      anyBaseline = true;
    } else if (p && (p.distanceM !== undefined || p.sessions !== undefined)) {
      needs.push({
        code: 'baseline',
        sport,
        message: `Für ${SPORT_LABEL[sport]} fehlt die Trainingszeit pro Woche (Stunden). Kilometer allein reichen nicht, weil das Zeitbudget in Stunden rechnet.`,
      });
      anyBaseline = true;
      continue;
    } else if (pb) {
      // Profil vorhanden, Sportart nicht angegeben → aktuell kein Training in dieser Sportart.
      durationSec = 0;
    }

    const sb: SportBaseline = { sport, source, quality };
    if (durationSec !== undefined) sb.durationSec = durationSec;
    if (distanceM !== undefined && distanceM > 0) sb.distanceM = distanceM;
    if (sessions !== undefined) sb.sessions = sessions;

    if (sport === 'run' || sport === 'bike') {
      const fromSettings = sport === 'run' ? settings.longestRecentRun : settings.longestRecentRide;
      const fromHistory = longestRecent(history, sport, firstWeek);
      const ratio = sb.distanceM && sb.durationSec ? sb.distanceM / sb.durationSec : undefined;
      // Eigene Angabe gilt, solange sie aktuell ist (≤ 30 Tage) und nicht kürzer als der längste erfasste Lauf; sonst die Historie.
      const settingsFresh = fromSettings ? diffDays(fromSettings.asOf, firstWeek) <= 30 : false;
      const settingsLen = fromSettings?.durationSec ?? 0;
      const useSettings = !!fromSettings && (!fromHistory || (settingsFresh && settingsLen >= (fromHistory.durationSec ?? 0)) || (!settingsFresh && !fromHistory));
      let lSec = useSettings ? fromSettings?.durationSec : fromHistory?.durationSec;
      let lM = useSettings ? (sport === 'run' ? settings.longestRecentRun?.distanceM : undefined) : fromHistory?.distanceM;
      if (lSec === undefined && lM !== undefined && ratio) lSec = lM / ratio;
      if (lM === undefined && lSec !== undefined && ratio && sport === 'run') lM = lSec * ratio;
      if (lSec !== undefined) sb.longestSec = lSec;
      if (lM !== undefined) sb.longestM = lM;
      if (useSettings) sources.push(sport === 'run' ? 'settings.longestRecentRun' : 'settings.longestRecentRide');
      else if (fromHistory) sources.push(`history.longest.${sport}`);
    }

    if ((sb.durationSec ?? 0) < FIXED.entrySec[sport]) {
      sb.entry = true;
      sb.quality = sb.source === 'none' ? 'low' : sb.quality;
    }
    bySport[sport] = sb;
  }

  if (!anyBaseline && !needs.some((n) => n.code === 'baseline')) {
    needs.push({
      code: 'baseline',
      message: 'Trag bitte deinen aktuellen Trainingsumfang ein (Stunden pro Woche je Sportart). Der Plan startet dort – nicht bei einem angenommenen Wert.',
    });
  }

  const run = bySport.run;
  if (run && !run.entry && run.longestSec === undefined) {
    needs.push({
      code: 'longest_run',
      sport: 'run',
      message: 'Wie lang war dein längster Lauf der letzten 30 Tage? Der lange Lauf darf davon aus höchstens 10 % pro Woche wachsen.',
    });
  }

  // Kraft: Einheiten und Dauer pro Einheit aus dem eigenen Umfang.
  const ps = pb?.strength;
  const hs = historyWeekly(history, 'strength', firstWeek);
  const strSessions = hs?.sessions ?? ps?.sessions ?? (ps?.durationSec ? ps.durationSec / FIXED.strengthDefaultSessionSec : undefined) ?? 0;
  const strSessionSec =
    hs && hs.sessions > 0 ? hs.durationSec / hs.sessions : ps?.durationSec && ps.sessions ? ps.durationSec / ps.sessions : FIXED.strengthDefaultSessionSec;
  bySport.strength = {
    sport: 'strength',
    sessions: strSessions,
    durationSec: strSessions * strSessionSec,
    source: hs ? 'history' : ps ? 'profile' : 'none',
    quality: ps || hs ? 'medium' : 'low',
  };

  // W6: unsicherer Ausgangsumfang (nur wenn mindestens eine Sportart auf der Profilangabe beruht).
  if (pb && ENDURANCE_SPORTS.some((s) => bySport[s]?.source === 'profile')) {
    const updated = profile?.updatedAt?.slice(0, 10);
    const stale = updated && /^\d{4}-\d{2}-\d{2}$/.test(updated) ? diffDays(updated, today) > FIXED.staleBaselineWeeks * 7 : false;
    const shortPeriod = pb.periodWeeks !== undefined && pb.periodWeeks < 2;
    if (stale || shortPeriod) {
      warnings.push({
        code: 'W6',
        severity: 'caution',
        text: stale
          ? 'Dein Ausgangsumfang im Profil ist älter als 8 Wochen. Stimmt er noch? Der ganze Plan baut darauf auf.'
          : 'Dein Ausgangsumfang bezieht sich auf weniger als 2 Wochen und ist deshalb unsicher.',
      });
    }
  }
  for (const sport of ENDURANCE_SPORTS) {
    const sb = bySport[sport];
    if (sb?.entry) {
      warnings.push({
        code: 'W9',
        severity: 'caution',
        sport,
        text: `${SPORT_LABEL[sport]}: Dein aktueller Umfang liegt unter dem Einstieg von ${Math.round(FIXED.entrySec[sport] / 60)} min pro Woche. Der Plan beginnt mit diesem Einstieg${sport === 'run' ? ' (gern als Lauf-Geh-Wechsel)' : ''} und steigert von dort.`,
      });
    }
  }

  const baseline: Baseline = { bySport, budgetSec };
  const age = ageOn(profile?.birthDate, today);
  if (age !== undefined) baseline.age = age;
  return { baseline, needs, warnings, sources };
}

/** Effektiver Startwert (Dauer) einer Ausdauersportart: Ausgangsumfang, mindestens Einstiegsumfang. */
export function startDuration(sb: SportBaseline | undefined, sport: EnduranceSport): number {
  return Math.max(sb?.durationSec ?? 0, FIXED.entrySec[sport]);
}
