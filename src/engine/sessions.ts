/**
 * Modul G – Einheiten, Schlüsseleinheiten und Kraft (PLAN_MODEL 4.8).
 * Keine Wochentage (R21): Ausgabe sind Wochenziele plus Schwerpunkte, die man selbst in die Woche legt.
 */
import { addDays, compareDates, type LocalDate } from '../domain/calendar';
import type { GeneratorSettings, PlannedSessionFocus, WeekTargets, WeeklySportTarget } from '../domain/schemas';
import type { EnduranceSport, PhaseType, SessionFocus } from '../domain/sports';
import { formatDistance, formatDurationShort } from '../domain/units';
import { FIXED } from './params';
import type { WeekIntensity } from './intensity';
import type { WeekVolume } from './volume';

const MIN_INTERVAL_SEC = 15 * 60;
const MIN_TEMPO_SEC = 20 * 60;

function fmtLong(sec: number, m?: number): string {
  return m !== undefined && m > 0 ? `${formatDurationShort(sec)} / ${formatDistance(m)}` : formatDurationShort(sec);
}

export function weekPhase(w: WeekVolume): PhaseType {
  const f = w.frame;
  if (f.kind === 'recovery') return 'recovery';
  return f.phase;
}

export function buildWeekTargets(
  w: WeekVolume,
  zi: WeekIntensity,
  settings: Pick<GeneratorSettings, 'openWaterFrom'>,
  extraNotes: readonly string[],
): WeekTargets {
  const f = w.frame;
  const isRaceWeek = f.phase === 'race';
  const focuses: PlannedSessionFocus[] = [];
  const add = (sport: PlannedSessionFocus['sport'], focus: SessionFocus, note: string, count = 1) => {
    focuses.push({ id: `gen-${f.weekStart}-${focuses.length + 1}`, sport, focus, count, note });
  };
  const dur = (s: EnduranceSport) => w.sport[s].durationSec;
  const z = zi.zoneSec;

  if (!isRaceWeek) {
    if (w.longRun) {
      add('run', 'long', `Langer Lauf ca. ${fmtLong(w.longRun.durationSec, w.longRun.distanceM)}, locker (Z2)${f.kind === 'loading' || f.kind === 'camp' ? '' : ' – verkürzt'}`);
    }
    if (w.longRide) {
      add('bike', 'long', `Lange Ausfahrt ca. ${formatDurationShort(w.longRide.durationSec)}, locker (Z2)${f.kind === 'loading' ? '' : f.kind === 'camp' ? ' – Camp' : ' – verkürzt'}`);
    }
    const bz4 = z.bike.z4 ?? 0;
    const bz5 = z.bike.z5 ?? 0;
    const bz3 = z.bike.z3 ?? 0;
    if (bz4 >= MIN_INTERVAL_SEC && bz5 >= MIN_INTERVAL_SEC) {
      add('bike', 'threshold', `Schwellenintervalle, gesamt ca. ${formatDurationShort(bz4)} in Z4 (z. B. 3 × 10–15 min)`);
      add('bike', 'vo2max', `Kurze harte Intervalle, gesamt ca. ${formatDurationShort(bz5)} in Z5 (z. B. 5 × 3–4 min)`);
    } else if (bz4 + bz5 >= MIN_INTERVAL_SEC) {
      add('bike', bz5 > bz4 ? 'vo2max' : 'threshold', `Rad-Intervalle, gesamt ca. ${formatDurationShort(bz4 + bz5)} in Z4–Z5${f.kind === 'taper' ? ' – kurz, Intensität halten' : ''}`);
    }
    if (bz3 >= MIN_TEMPO_SEC) add('bike', 'tempo', `Tempoabschnitte, gesamt ca. ${formatDurationShort(bz3)} in Z3`);
    if ((z.swim.z4 ?? 0) >= MIN_INTERVAL_SEC) add('swim', 'threshold', `Zügige Intervalle, gesamt ca. ${formatDurationShort(z.swim.z4 ?? 0)}`);
    if ((z.run.z3 ?? 0) > 0) add('run', 'race_pace', `Renntempo-Abschnitte, gesamt ca. ${formatDurationShort(z.run.z3 ?? 0)}`);
    if (f.phase === 'specific' && f.kind === 'loading' && dur('run') > 0 && dur('bike') > 0) {
      add('run', 'brick', `Koppellauf ca. ${Math.round(FIXED.brickRunSec / 60)} min locker direkt nach dem Rad`);
    }
    if (settings.openWaterFrom && dur('swim') > 0 && compareDates(settings.openWaterFrom, addDays(f.weekStart as LocalDate, 6)) <= 0) {
      add('swim', 'other', 'Freiwasser/Neopren, wenn möglich');
    }
  }

  const keyCount = (s: EnduranceSport) => focuses.filter((x) => x.sport === s).length;
  const sports: WeeklySportTarget[] = [];
  for (const s of ['swim', 'bike', 'run'] as const) {
    const d = dur(s);
    if (d <= 0) continue;
    const [lo, hi] = FIXED.sessionRange[s];
    let sessions = Math.min(hi, Math.max(lo, Math.ceil(d / FIXED.typicalSessionSec[s])));
    sessions = Math.max(sessions, keyCount(s));
    if (isRaceWeek) sessions = Math.min(sessions, 3);
    const t: WeeklySportTarget = { sport: s, durationSec: d, sessions, zoneSec: z[s] };
    if (w.sport[s].distanceM !== undefined && (w.sport[s].distanceM ?? 0) > 0) t.distanceM = w.sport[s].distanceM;
    sports.push(t);
  }
  if (w.strengthSessions > 0) sports.push({ sport: 'strength', sessions: w.strengthSessions, durationSec: w.strengthSec });

  const notes = [...(isRaceWeek ? ['Wettkampfwoche: wenige kurze, lockere Einheiten mit ein paar kurzen Temposteigerungen. Viel Erholung.'] : []), ...f.reasons, ...w.reasons, ...extraNotes];
  const targets: WeekTargets = { phase: weekPhase(w), sports, focuses };
  if (notes.length) targets.notes = notes.join(' · ').slice(0, 2000);
  return targets;
}
