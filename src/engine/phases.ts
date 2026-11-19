/**
 * Modul D – Phasen und Wochenrahmen (PLAN_MODEL 4.2).
 * Legt je Woche Phase, Art (Belastung, Entlastung, Taper, Vorbereitungsrennen), Faktor, Verfügbarkeit (Pausen)
 * und Steigerungsstopp (Beschwerden, niedrige Frische) fest.
 */
import { addDays, compareDates, diffDays, formatDateDe, startOfWeek, type LocalDate } from '../domain/calendar';
import { pausedDaysInWeek, pauseAffectsSport } from '../domain/health';
import { PREP_RACE_PRIORITY_LABEL, prepRaceSize } from '../domain/prepRace';
import type { PainIssue, PainObservation, PrepRace, TrainingCamp, TrainingPause, WeeklyWellnessCheckin } from '../domain/schemas';
import { PLANNED_SPORTS, SPORT_LABEL, type PhaseType, type PlannedSport } from '../domain/sports';
import { FIXED, prepRaceFactor, type PhilosophyParams } from './params';
import type { WeekFrame } from './types';

export interface PhaseInput {
  weeks: readonly LocalDate[];
  raceDate: LocalDate;
  today: LocalDate;
  taperWeeks: 1 | 2 | 3;
  params: PhilosophyParams;
  prepRaces: readonly PrepRace[];
  camps?: readonly TrainingCamp[];
  wellness: readonly WeeklyWellnessCheckin[];
  pauses: readonly TrainingPause[];
  painIssues: readonly PainIssue[];
  painObservations: readonly PainObservation[];
}

export interface PhaseResult {
  frames: WeekFrame[];
  /** Index der ersten Woche der spezifischen Phase (R für den Wunschverlauf). */
  specificStart: number;
  /** Berücksichtigte Vorbereitungsrennen (ohne ignorierte). */
  usedPrepRaces: PrepRace[];
  ignoredPrepRaces: { race: PrepRace; reason: string }[];
  usedCamps: TrainingCamp[];
  ignoredCamps: { camp: TrainingCamp; reason: string }[];
  /** Frische-/Beschwerde-Gründe für Warnung W7. */
  freezeReasons: string[];
}

/** Phasenlängen: Taper, spezifisch, Aufbau, Grundlage. */
export function phaseLengths(n: number, taperWeeks: number): { taper: number; specific: number; build: number; base: number } {
  const taper = Math.min(taperWeeks, Math.max(1, n));
  const pre = Math.max(0, n - taper);
  if (pre < 6) {
    const specific = Math.min(pre, FIXED.minSpecificWeeks);
    return { taper, specific, build: pre - specific, base: 0 };
  }
  const specific = Math.max(FIXED.minSpecificWeeks, Math.round(FIXED.phaseShares.specific * pre));
  const build = Math.min(pre - specific, Math.round(FIXED.phaseShares.build * pre));
  return { taper, specific, build, base: pre - specific - build };
}

export function buildFrames(input: PhaseInput): PhaseResult {
  const { weeks, params } = input;
  const n = weeks.length;
  const len = phaseLengths(n, input.taperWeeks);
  const taperStart = n - len.taper;
  const specificStart = len.base + len.build;

  const frames: WeekFrame[] = weeks.map((weekStart, index) => {
    let phase: PhaseType = index < len.base ? 'base' : index < specificStart ? 'build' : index < taperStart ? 'specific' : 'taper';
    if (index === n - 1) phase = 'race';
    const availability = Object.fromEntries(PLANNED_SPORTS.map((s) => [s, 1])) as Record<PlannedSport, number>;
    return { weekStart, index, phase, kind: phase === 'taper' || phase === 'race' ? 'taper' : 'loading', factor: 1, availability, freeze: [], prepRaceIds: [], reasons: [] };
  });

  // Vorbereitungsrennen (R19)
  const usedPrepRaces: PrepRace[] = [];
  const ignoredPrepRaces: { race: PrepRace; reason: string }[] = [];
  const firstWeek = weeks[0];
  for (const r of [...input.prepRaces].sort((a, b) => a.date.localeCompare(b.date))) {
    const rw = startOfWeek(r.date);
    const idx = weeks.indexOf(rw);
    if (compareDates(r.date, input.today) < 0 || (firstWeek && compareDates(rw, firstWeek) < 0)) {
      ignoredPrepRaces.push({ race: r, reason: 'liegt vor dem Planbeginn' });
      continue;
    }
    if (compareDates(r.date, input.raceDate) >= 0) {
      ignoredPrepRaces.push({ race: r, reason: 'liegt am oder nach dem Hauptwettkampf' });
      continue;
    }
    if (idx < 0) {
      ignoredPrepRaces.push({ race: r, reason: 'liegt außerhalb der Planwochen' });
      continue;
    }
    if (idx >= taperStart) {
      ignoredPrepRaces.push({ race: r, reason: 'liegt im Taper – dort wird ohnehin reduziert' });
      continue;
    }
    usedPrepRaces.push(r);
    const f = prepRaceFactor(prepRaceSize(r), r.priority);
    const prioLabel = PREP_RACE_PRIORITY_LABEL[r.priority ?? 'low'];
    const label = `${r.name} (${formatDateDe(r.date, false)})`;
    const before = frames[idx - 1];
    if (before && before.index < taperStart && f.before < 1 && before.kind === 'loading') {
      before.factor = Math.min(before.factor, f.before);
      before.reasons.push(`Woche vor ${label}: Umfang × ${f.before.toLocaleString('de-DE')}`);
    }
    const raceFrame = frames[idx];
    if (raceFrame) {
      raceFrame.prepRaceIds.push(r.id);
      if (f.raceWeek < 1) {
        raceFrame.kind = 'prep_race';
        raceFrame.factor = Math.min(raceFrame.factor, f.raceWeek);
        raceFrame.reasons.push(`${label}, ${prioLabel}: Umfang × ${f.raceWeek.toLocaleString('de-DE')} (Rennen zählt mit)`);
      } else {
        raceFrame.reasons.push(`${label}, ${prioLabel}: Plan unverändert – das Rennen ersetzt eine Einheit`);
      }
    }
    const after = frames[idx + 1];
    if (after && after.index < taperStart && after.kind !== 'prep_race' && f.after < 1) {
      after.kind = 'post_race';
      after.factor = Math.min(after.factor, f.after);
      after.reasons.push(`Erholung nach ${r.name}: Umfang × ${f.after.toLocaleString('de-DE')}`);
    }
  }

  // Trainingslager (1.8.0): Camp-Wochen mit Tagen und Stunden pro Tag, danach Erholungswoche.
  const usedCamps: TrainingCamp[] = [];
  const ignoredCamps: { camp: TrainingCamp; reason: string }[] = [];
  const lastWeekEnd = weeks.length ? addDays(weeks[weeks.length - 1]!, 6) : input.raceDate;
  for (const c of [...(input.camps ?? [])].sort((a, b) => a.startDate.localeCompare(b.startDate))) {
    if (compareDates(c.endDate, input.today) < 0 || (firstWeek && compareDates(c.endDate, firstWeek) < 0)) {
      ignoredCamps.push({ camp: c, reason: 'liegt vor dem Planbeginn' });
      continue;
    }
    if (compareDates(c.startDate, input.raceDate) >= 0 || compareDates(c.startDate, lastWeekEnd) > 0) {
      ignoredCamps.push({ camp: c, reason: 'liegt am oder nach dem Hauptwettkampf' });
      continue;
    }
    const touched = frames.filter((f) => compareDates(f.weekStart, c.endDate) <= 0 && compareDates(addDays(f.weekStart, 6), c.startDate) >= 0);
    if (touched.some((f) => f.index >= taperStart)) {
      ignoredCamps.push({ camp: c, reason: 'überschneidet sich mit dem Taper – so kurz vor dem Rennen keinen Mehrumfang' });
      continue;
    }
    usedCamps.push(c);
    let total = 0;
    for (const f of touched) {
      const from = compareDates(c.startDate, f.weekStart) > 0 ? c.startDate : f.weekStart;
      const to = compareDates(c.endDate, addDays(f.weekStart, 6)) < 0 ? c.endDate : addDays(f.weekStart, 6);
      const days = Math.max(0, diffDays(from, to) + 1);
      // Tage vor dem heutigen Tag zählen nicht (Plan beginnt ab heute)
      if (days <= 0) continue;
      if (f.kind === 'prep_race') {
        f.reasons.push(`${c.name}: in der Rennwoche kein Camp-Mehrumfang`);
        continue;
      }
      const prev = f.camp?.days ?? 0;
      f.kind = 'camp';
      f.factor = 1;
      f.camp = { id: c.id, name: c.name, days: Math.min(7, prev + days), hoursPerDay: c.hoursPerDay };
      total += days;
      f.reasons.push(`${c.name}: ${days} Camp-${days === 1 ? 'Tag' : 'Tage'} mit bis zu ${c.hoursPerDay.toLocaleString('de-DE')} h/Tag – Mehrumfang vor allem Rad und Schwimmen, locker`);
    }
    const lastIdx = Math.max(...touched.map((f) => f.index));
    const after = frames[lastIdx + 1];
    if (after && after.index < taperStart && after.kind === 'loading') {
      const factor = total >= 7 ? FIXED.camp.postFactorLong : FIXED.camp.postFactorShort;
      after.kind = 'post_camp';
      after.factor = Math.min(after.factor, factor);
      after.reasons.push(`Erholung nach ${c.name}: Umfang × ${factor.toLocaleString('de-DE')}`);
    }
  }

  // Entlastungswochen (R4): jede k-te Woche, Zählung startet nach einer Renn- oder Camp-Erholung neu.
  // Wäre eine Entlastung im Camp oder direkt davor fällig, kommt sie in die Woche vor dem Camp (ausgeruht ins Camp).
  let counter = 0;
  for (const f of frames) {
    if (f.index >= taperStart) break;
    if (f.kind === 'prep_race' || f.kind === 'camp') continue;
    if (f.kind === 'post_race' || f.kind === 'post_camp') {
      counter = 0;
      continue;
    }
    counter += 1;
    const next = frames[f.index + 1];
    if (next?.kind === 'camp' && counter >= params.recoveryEvery - 1 && f.factor === 1 && f.kind === 'loading') {
      f.kind = 'recovery';
      f.reasons.push(`Entlastungswoche vor dem Trainingslager (wäre sonst im Camp fällig): Umfang × ${(1 - params.recoveryCut).toLocaleString('de-DE', { maximumFractionDigits: 2 })}`);
      counter = 0;
      continue;
    }
    const lastBeforeTaper = f.index === taperStart - 1;
    if (counter >= params.recoveryEvery && !lastBeforeTaper && f.factor === 1) {
      f.kind = 'recovery';
      f.reasons.push(`Entlastungswoche (jede ${params.recoveryEvery}. Woche): Umfang × ${(1 - params.recoveryCut).toLocaleString('de-DE', { maximumFractionDigits: 2 })}`);
      counter = 0;
    }
  }

  // Adaptive Entlastung und Steigerungsstopp (R13, 4.4)
  const freezeReasons: string[] = [];
  const recent = [...input.wellness]
    .filter((c) => diffDays(c.date, input.today) <= FIXED.freshnessMaxAgeDays && diffDays(c.date, input.today) >= 0)
    .sort((a, b) => b.date.localeCompare(a.date));
  const last = recent[0];
  const first = frames[0];
  if (last && last.freshness <= FIXED.lowFreshness && first && first.kind === 'loading' && first.factor === 1) {
    first.kind = 'recovery';
    first.reasons.push(`Entlastung, weil dein letzter Frische-Wert ${last.freshness} von 10 war (adaptiv)`);
    freezeReasons.push(`Frische zuletzt ${last.freshness} von 10 – erste Woche als Entlastung`);
  }
  const sorted = [...input.wellness].filter((c) => compareDates(c.date, input.today) <= 0).sort((a, b) => b.date.localeCompare(a.date));
  const twoLow = !!last && sorted[0] === last && last.freshness <= FIXED.lowFreshness && (sorted[1]?.freshness ?? 10) <= FIXED.lowFreshness;
  if (twoLow) {
    for (const f of frames.slice(0, FIXED.freezeWeeks)) {
      for (const s of PLANNED_SPORTS) if (!f.freeze.includes(s)) f.freeze.push(s);
      f.reasons.push('Keine Steigerung: zwei Frische-Werte ≤ 3 hintereinander');
    }
    freezeReasons.push('zwei Frische-Werte ≤ 3 hintereinander – keine Steigerung in den ersten 2 Wochen');
  }

  for (const issue of input.painIssues) {
    if (issue.status !== 'active') continue;
    const lastObs = input.painObservations.filter((o) => o.issueId === issue.id).sort((a, b) => b.date.localeCompare(a.date))[0];
    if (!lastObs || lastObs.pain < FIXED.painFreezeThreshold) continue;
    const sports = PLANNED_SPORTS.filter((s) => issue.sports.includes(s));
    if (sports.length === 0) continue;
    for (const f of frames.slice(0, FIXED.freezeWeeks)) {
      for (const s of sports) if (!f.freeze.includes(s)) f.freeze.push(s);
      f.reasons.push(`Keine Steigerung ${sports.map((s) => SPORT_LABEL[s]).join('/')}: aktive Beschwerde (Schmerz ${lastObs.pain})`);
    }
    freezeReasons.push(`aktive Beschwerde mit Schmerz ${lastObs.pain} – keine Steigerung für ${sports.map((s) => SPORT_LABEL[s]).join(', ')} in den ersten 2 Wochen`);
  }

  // Pausen (H6): Anteil nicht pausierter Tage. Offenes Ende zählt nur in der ersten Planwoche.
  for (const p of input.pauses) {
    for (const f of frames) {
      let days = pausedDaysInWeek(p, f.weekStart);
      if (days === null) {
        if (f.index !== 0 || compareDates(p.startDate, addDays(f.weekStart, 6)) > 0) continue;
        days = Math.min(7, diffDays(compareDates(p.startDate, f.weekStart) > 0 ? p.startDate : f.weekStart, addDays(f.weekStart, 6)) + 1);
      }
      if (days <= 0) continue;
      for (const s of PLANNED_SPORTS) {
        if (!pauseAffectsSport(p, s)) continue;
        f.availability[s] = Math.min(f.availability[s], 1 - days / 7);
      }
      f.reasons.push(`Pause: ${days} von 7 Tagen (${p.scope === 'all' ? 'alle Sportarten' : p.sports.map((s) => SPORT_LABEL[s]).join(', ')})`);
    }
  }

  return { frames, specificStart: Math.max(1, specificStart), usedPrepRaces, ignoredPrepRaces, usedCamps, ignoredCamps, freezeReasons };
}

/** Planwoche, deren Umfang als Referenz für die Steigerungsgrenze zählt (keine geplante Reduktion). */
export function isReferenceWeek(f: Pick<WeekFrame, 'kind' | 'factor'>): boolean {
  return f.kind === 'loading' && f.factor === 1;
}
