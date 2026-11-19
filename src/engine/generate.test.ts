import { describe, expect, it } from 'vitest';
import { generatePlan } from './generate';
import { FIXED, resolveParams } from './params';
import { input, profile, race, TODAY } from './fixtures.test-helper';
import type { PlanGeneratorInput, PlanProposal } from './types';
import type { PrepRace, WeeklySportTarget } from '../domain/schemas';

function ok(i: PlanGeneratorInput): PlanProposal {
  const r = generatePlan(i);
  if (!r.ok) throw new Error(r.needs.map((n) => n.message).join(' | '));
  return r.proposal;
}
const sportOf = (w: PlanProposal['weeks'][number], s: string): WeeklySportTarget | undefined => w.targets.sports.find((x) => x.sport === s);
const dur = (w: PlanProposal['weeks'][number], s: string) => sportOf(w, s)?.durationSec ?? 0;
const total = (w: PlanProposal['weeks'][number]) => w.targets.sports.reduce((a, s) => a + (s.durationSec ?? 0), 0);

function prepRace(o: Partial<PrepRace>): PrepRace {
  return { id: 'pr', planId: 'plan', name: 'Halbmarathon', date: '2027-04-11', kind: 'run', runM: 21_097.5, createdAt: 'x1234567890', updatedAt: 'x1234567890', ...o };
}

describe('Plangenerator – Grundverhalten', () => {
  it('ist deterministisch', () => {
    expect(generatePlan(input())).toEqual(generatePlan(input()));
  });

  it('Beispiel: 1 h / 10 km Laufen → Woche 1 höchstens +10 %, nie 2 h / 24 km', () => {
    for (const phi of [0, 50, 100]) {
      const p = ok(input({ settings: { philosophy: phi } }));
      const w1 = p.weeks[0]!;
      const run = sportOf(w1, 'run')!;
      expect(run.durationSec).toBeLessThanOrEqual(3600 * 1.1);
      expect(run.distanceM).toBeLessThanOrEqual(11_000);
      expect(w1.longRun?.distanceM).toBeLessThanOrEqual(6600);
      expect(p.violations).toEqual([]);
    }
  });

  it('plant jede Woche bis zum Wettkampf, mit Taper und Wettkampfwoche am Ende', () => {
    const p = ok(input());
    expect(p.weeks[0]?.weekStart).toBe('2026-11-23');
    expect(p.weeks.at(-1)?.weekStart).toBe('2027-06-21');
    expect(p.weeks.at(-1)?.phase).toBe('race');
    expect(p.weeks.at(-2)?.kind).toBe('taper');
    expect(total(p.weeks.at(-1)!)).toBeLessThan(0.6 * Math.max(...p.weeks.map(total)));
  });

  it('keine Wochentage: Ergebnis sind Wochenziele und Schwerpunkte', () => {
    const p = ok(input());
    const w = p.weeks[0]!;
    expect(w.targets.sports.map((s) => s.sport)).toEqual(['swim', 'bike', 'run', 'strength']);
    expect(w.targets.focuses.some((f) => f.sport === 'run' && f.focus === 'long')).toBe(true);
    expect(JSON.stringify(w.targets)).not.toMatch(/Montag|Dienstag|weekday/);
  });

  it('Laufen bleibt locker, harte Intensität liegt auf dem Rad', () => {
    for (const phi of [0, 50, 69]) {
      for (const w of ok(input({ settings: { philosophy: phi } })).weeks) {
        const z = sportOf(w, 'run')?.zoneSec ?? {};
        expect((z.z3 ?? 0) + (z.z4 ?? 0) + (z.z5 ?? 0)).toBe(0);
      }
    }
    const aggressive = ok(input({ settings: { philosophy: 100 } }));
    const hasBikeHard = aggressive.weeks.some((w) => (sportOf(w, 'bike')?.zoneSec?.z5 ?? 0) > 0);
    expect(hasBikeHard).toBe(true);
  });

  it('Regler: konservativ = weniger Intensität bei gleicher Trainingszeit; Entlastungsrhythmus gleich', () => {
    const lowShare = (p: PlanProposal) => {
      let low = 0;
      let all = 0;
      for (const w of p.weeks) for (const s of w.targets.sports) if (s.zoneSec) { low += s.zoneSec.z2 ?? 0; all += s.durationSec ?? 0; }
      return low / all;
    };
    const c = ok(input({ settings: { philosophy: 0 } }));
    const a = ok(input({ settings: { philosophy: 100 } }));
    expect(lowShare(c)).toBeGreaterThan(lowShare(a));
    const rec = (p: PlanProposal) => p.weeks.filter((w) => w.kind === 'recovery').map((w) => w.weekStart);
    expect(rec(c)).toEqual(rec(a));
    expect(lowShare(c) - lowShare(a)).toBeGreaterThan(0.12); // die Extreme wirken deutlich
    // Trainingszeit (ohne Kraft) über den ganzen Plan nahezu gleich – „konservativ“ heißt nicht weniger Zeit
    const all = (p: PlanProposal) => p.weeks.reduce((a2, w) => a2 + total(w), 0);
    expect(Math.abs(all(c) - all(a)) / all(a)).toBeLessThan(0.03);
    const hard = (p: PlanProposal) => p.weeks.reduce((a2, w) => a2 + w.targets.sports.reduce((b, s) => b + (s.zoneSec?.z4 ?? 0) + (s.zoneSec?.z5 ?? 0), 0), 0);
    expect(hard(a)).toBeGreaterThan(2 * hard(c));
  });

  it('Zeitbudget wird nie überschritten, Spitzenwochen um 90 %', () => {
    for (const h of [6, 9, 12, 16]) {
      const p = ok(input({ profile: profile({ availableWeeklySec: h * 3600 }) }));
      for (const w of p.weeks) expect(total(w)).toBeLessThanOrEqual(h * 3600);
      expect(p.violations).toEqual([]);
    }
  });

  it('Laufgrenze → freie Zeit geht aufs Rad (R17)', () => {
    const p = ok(input());
    const w1 = p.weeks[0]!;
    expect(w1.reasons.join(' ')).toMatch(/Laufen begrenzt/);
    expect(dur(w1, 'bike')).toBeGreaterThan(3 * 3600); // Ausgangsumfang Rad 3 h + umverteilte Laufzeit
  });

  it('warnt, wenn der lange Lauf bis zum Taper für einen Marathon knapp bleibt (W1), statt die Grenze zu brechen', () => {
    const p = ok(input());
    expect(p.warnings.some((w) => w.code === 'W1')).toBe(true);
  });
});

describe('Plangenerator – harte Grenzen über viele Eingaben', () => {
  it('keine Verletzung für Regler, Budget, Taper, Pausen, Rennen, Beschwerden', () => {
    const prep = [prepRace({}), prepRace({ id: 'tri', name: 'Mitteldistanz', date: '2027-05-23', kind: 'triathlon', swimM: 1900, bikeM: 90_000, runM: 21_097.5 })];
    for (const phi of [0, 33, 67, 100]) {
      for (const budget of [7, 12, 18]) {
        for (const taperWeeks of [1, 2, 3] as const) {
          const p = ok(
            input({
              profile: profile({ availableWeeklySec: budget * 3600 }),
              settings: { philosophy: phi, taperWeeks },
              extra: {
                prepRaces: prep,
                pauses: [{ id: 'pa', scope: 'sports', sports: ['run'], startDate: '2027-01-06', endDate: '2027-01-12', createdAt: 'x1234567890', updatedAt: 'x1234567890' }],
              },
            }),
          );
          expect(p.violations).toEqual([]);
        }
      }
    }
  });

  it('Pause: kein Nachholen – danach wird vom niedrigeren Niveau aus gesteigert', () => {
    const pause = { id: 'pa', scope: 'all' as const, sports: [], startDate: '2026-11-30', endDate: '2026-12-06', createdAt: 'x1234567890', updatedAt: 'x1234567890' };
    const p = ok(input({ extra: { pauses: [pause] } }));
    const [w1, w2, w3] = p.weeks;
    expect(total(w2!)).toBe(0);
    expect(dur(w3!, 'run')).toBeLessThanOrEqual(dur(w1!, 'run'));
  });

  it('aktive Laufbeschwerde (Schmerz ≥ 4): keine Steigerung in den ersten 2 Wochen, Warnung W7', () => {
    const p = ok(
      input({
        extra: {
          painIssues: [{ id: 'k', region: 'knee', sports: ['run'], status: 'active', startDate: '2026-11-10', createdAt: 'x1234567890', updatedAt: 'x1234567890' }],
          painObservations: [{ id: 'o', issueId: 'k', date: '2026-11-16', pain: 5, createdAt: 'x1234567890' }],
        },
      }),
    );
    expect(dur(p.weeks[0]!, 'run')).toBeLessThanOrEqual(3600);
    expect(dur(p.weeks[1]!, 'run')).toBeLessThanOrEqual(dur(p.weeks[0]!, 'run'));
    expect(p.warnings.some((w) => w.code === 'W7')).toBe(true);
  });

  it('niedrige Frische → erste Woche Entlastung (adaptiv)', () => {
    const p = ok(input({ extra: { wellness: [{ id: 'c', weekStart: '2026-11-16', date: '2026-11-16', freshness: 2, createdAt: 'x1234567890', updatedAt: 'x1234567890' }] } }));
    expect(p.weeks[0]?.kind).toBe('recovery');
  });

  it('Vorbereitungsrennen: Mini-Taper, Erholung, Warnung bei zu langer Laufdistanz (W3)', () => {
    const p = ok(input({ extra: { prepRaces: [prepRace({})] } }));
    const idx = p.weeks.findIndex((w) => w.weekStart === '2027-04-05');
    expect(p.weeks[idx]?.kind).toBe('prep_race');
    expect(p.weeks[idx + 1]?.kind).toBe('post_race');
    expect(p.weeks[idx]?.targets.notes).toMatch(/Halbmarathon/);
    expect(p.warnings.some((w) => w.code === 'W3')).toBe(true);
  });

  it('Rennen im Taper oder in der Vergangenheit wird ignoriert und begründet', () => {
    const p = ok(input({ extra: { prepRaces: [prepRace({ date: '2027-06-20' }), prepRace({ id: 'old', date: '2026-10-01' })] } }));
    expect(p.weeks.some((w) => w.kind === 'prep_race')).toBe(false);
    expect(p.rationale.filter((r) => /nicht berücksichtigt/.test(r.text))).toHaveLength(2);
  });
});

describe('Plangenerator – fehlende Angaben werden erfragt, nicht geschätzt', () => {
  it('ohne Zeitbudget', () => {
    const r = generatePlan(input({ profile: profile({ availableWeeklySec: undefined }) }));
    expect(r.ok).toBe(false);
    expect(!r.ok && r.needs.map((n) => n.code)).toEqual(['budget']);
  });
  it('ohne Ausgangsumfang', () => {
    const r = generatePlan(input({ profile: profile({ baseline: undefined }) }));
    expect(!r.ok && r.needs.map((n) => n.code)).toContain('baseline');
  });
  it('Laufen nur in km → fragt nach der Zeit', () => {
    const r = generatePlan(input({ profile: profile({ baseline: { ...profile().baseline, run: { distanceM: 10_000 } } }) }));
    expect(!r.ok && r.needs.find((n) => n.code === 'baseline')?.sport).toBe('run');
  });
  it('ohne längsten Lauf', () => {
    const r = generatePlan(input({ settings: { longestRecentRun: undefined } }));
    expect(!r.ok && r.needs.map((n) => n.code)).toEqual(['longest_run']);
  });
  it('längster Lauf aus erfassten Einheiten der letzten 30 Tage', () => {
    const history = [{ id: 'a', sport: 'run' as const, date: '2026-11-08', durationSec: 2700, distanceM: 7000, focus: 'long' as const, createdAt: 'x1234567890', updatedAt: 'x1234567890' }];
    const p = ok(input({ settings: { longestRecentRun: undefined }, extra: { history } }));
    expect(p.weeks[0]?.longRun?.distanceM).toBeLessThanOrEqual(7700);
    expect(p.weeks[0]?.longRun?.distanceM).toBeGreaterThanOrEqual(7000);
  });
});

describe('Validierungsfälle A–H (MODEL_VALIDATION.md)', () => {
  const base = profile().baseline!;

  it('A: starke:r Schwimmer:in mit CSS – Priorität wird nicht allein aus CSS gesenkt', () => {
    const metrics = [{ id: 'm', kind: 'swim_css_s_per_100m' as const, value: 85, unit: 's/100m' as const, date: '2026-11-01', createdAt: 'x1234567890' }];
    const p = ok(input({ profile: profile({ availableWeeklySec: 8 * 3600, baseline: { ...base, swim: { durationSec: 3 * 3600, distanceM: 10_000 } } }), extra: { metrics } }));
    const swim = p.priorities.find((x) => x.sport === 'swim')!;
    expect(swim.suggested).toBe(3);
    expect(p.assessments.find((a) => a.sport === 'swim')?.metrics[0]?.stale).toBe(false);
    expect(dur(p.weeks[0]!, 'swim')).toBeGreaterThan(0);
  });

  it('B: Schwimmanfänger:in – Einstieg, Priorität 4, Schwimmen wächst', () => {
    const p = ok(input({ profile: profile({ baseline: { ...base, swim: { durationSec: 10 * 60, distanceM: 400 } } }) }));
    expect(p.priorities.find((x) => x.sport === 'swim')?.suggested).toBe(4);
    expect(p.warnings.some((w) => w.code === 'W9' && w.sport === 'swim')).toBe(true);
    expect(dur(p.weeks[0]!, 'swim')).toBeGreaterThanOrEqual(FIXED.entrySec.swim);
    expect(dur(p.weeks[0]!, 'swim')).toBeLessThanOrEqual(FIXED.entrySec.swim * 1.15);
    const preTaper = p.weeks.filter((w) => w.kind === 'loading');
    expect(dur(preTaper.at(-1)!, 'swim')).toBeGreaterThan(2 * 3600);
  });

  it('C: starke:r Läufer:in, wenig Rad – Rad höher priorisiert, Laufen bleibt erhalten', () => {
    const p = ok(
      input({
        profile: profile({ baseline: { periodWeeks: 4, swim: base.swim, bike: { durationSec: 1.5 * 3600 }, run: { durationSec: 5 * 3600, distanceM: 55_000 } } }),
        settings: { longestRecentRun: { durationSec: 2 * 3600, distanceM: 24_000, asOf: TODAY } },
      }),
    );
    expect(p.priorities.find((x) => x.sport === 'bike')?.suggested).toBe(4);
    for (const w of p.weeks.filter((x) => x.kind === 'loading')) expect(dur(w, 'run')).toBeGreaterThanOrEqual(5 * 3600 - 60);
  });

  it('D: finishorientiert, Regler 0 – feste Entlastung, 2 Krafteinheiten, wenig harte Intensität', () => {
    const p = ok(input({ settings: { philosophy: 0 } }));
    expect(p.params.recoveryEvery).toBe(4);
    expect(p.params.lowIntensityShare).toBeCloseTo(0.9);
    const loading = p.weeks.find((w) => w.kind === 'loading' && w.phase === 'build')!;
    expect(sportOf(loading, 'strength')?.sessions).toBe(2);
  });

  it('E: leistungsorientiert, Regler 100 – Intensitätsschwerpunkte auf dem Rad, Renntempo-Anteil im Laufen', () => {
    const p = ok(input({ settings: { philosophy: 100 }, profile: profile({ availableWeeklySec: 16 * 3600 }) }));
    const spec = p.weeks.find((w) => w.phase === 'specific' && w.kind === 'loading')!;
    expect(spec.targets.focuses.some((f) => f.sport === 'bike' && f.focus === 'vo2max')).toBe(true);
    expect((sportOf(spec, 'run')?.zoneSec?.z3 ?? 0) > 0).toBe(true);
  });

  it('F: hohe Ermüdung – Überprüfung statt Steigerung', () => {
    const c = (id: string, date: string, freshness: number) => ({ id, weekStart: date, date, freshness, createdAt: 'x1234567890', updatedAt: 'x1234567890' });
    const p = ok(input({ extra: { wellness: [c('a', '2026-11-09', 3), c('b', '2026-11-16', 2)] } }));
    expect(p.weeks[0]?.kind).toBe('recovery');
    expect(dur(p.weeks[1]!, 'run')).toBeLessThanOrEqual(dur(p.weeks[0]!, 'run'));
    expect(p.warnings.filter((w) => w.code === 'W7').length).toBeGreaterThanOrEqual(1);
  });

  it('G: Schwimmen automatisch neutral, manuell 5 – gilt im Rahmen der Grenzen, Zielkonflikt sichtbar', () => {
    const p = ok(input({ profile: profile({ availableWeeklySec: 9 * 3600 }), settings: { priorityMode: 'manual', priorities: { swim: { user: 5 } } } }));
    const swim = p.priorities.find((x) => x.sport === 'swim')!;
    expect(swim.applied).toBe(5);
    expect(swim.suggested).toBe(3);
    expect(p.violations).toEqual([]);
    const auto = ok(input({ profile: profile({ availableWeeklySec: 9 * 3600 }) }));
    const peakSwim = (q: PlanProposal) => Math.max(...q.weeks.map((w) => dur(w, 'swim')));
    expect(peakSwim(p)).toBeGreaterThanOrEqual(peakSwim(auto));
  });

  it('H: keine Leistungswerte, nur Dauer – keine erfundenen Werte oder Distanzen', () => {
    const p = ok(
      input({
        profile: profile({ baseline: { swim: { durationSec: 3600 }, bike: { durationSec: 3 * 3600 }, run: { durationSec: 2 * 3600 } } }),
        settings: { longestRecentRun: { durationSec: 3600, asOf: TODAY } },
      }),
    );
    for (const w of p.weeks) for (const s of w.targets.sports) expect(s.distanceM).toBeUndefined();
    for (const a of p.assessments) expect(a.metrics).toEqual([]);
    expect(p.priorities.every((x) => x.suggested === 3 || x.suggested === 4)).toBe(true);
  });
});

describe('Plangenerator – Umfangsobergrenzen (R22)', () => {
  const peak = (p: PlanProposal) => Math.max(...p.weeks.map(total));
  it('30 h Budget: Langdistanz höchstens 19 h – bei jeder Reglerstellung, Hinweis W11', () => {
    const big = profile({ availableWeeklySec: 30 * 3600 });
    const c = ok(input({ profile: big, settings: { philosophy: 0 } }));
    const a = ok(input({ profile: big, settings: { philosophy: 100 } }));
    expect(peak(c)).toBeLessThanOrEqual(19 * 3600);
    expect(peak(a)).toBeLessThanOrEqual(19 * 3600);
    expect(peak(c)).toBeGreaterThan(17 * 3600);
    expect(c.warnings.some((w) => w.code === 'W11')).toBe(true);
    expect(c.violations).toEqual([]);
    expect(a.violations).toEqual([]);
  });
  it('4 h für eine Langdistanz → deutliche Warnung W10; 8 h → Hinweis', () => {
    const four = ok(input({ profile: profile({ availableWeeklySec: 4 * 3600 }) }));
    expect(four.warnings.find((w) => w.code === 'W10')?.severity).toBe('important');
    const eight = ok(input({ profile: profile({ availableWeeklySec: 8 * 3600 }) }));
    expect(eight.warnings.find((w) => w.code === 'W10')?.severity).toBe('caution');
    const twelve = ok(input({ profile: profile({ availableWeeklySec: 12 * 3600 }) }));
    expect(twelve.warnings.some((w) => w.code === 'W10')).toBe(false);
  });
  it('Mitteldistanz: andere Norm (4 h nur Hinweis, Obergrenze niedriger)', () => {
    const half = race({ preset: 'half', swimM: 1900, bikeM: 90_000, runM: 21_097.5 });
    const p = ok(input({ race: half, profile: profile({ availableWeeklySec: 5 * 3600 }) }));
    expect(p.warnings.find((w) => w.code === 'W10')?.severity).toBe('caution');
    const big = ok(input({ race: half, profile: profile({ availableWeeklySec: 30 * 3600 }), settings: { philosophy: 100 } }));
    expect(peak(big)).toBeLessThanOrEqual(16 * 3600);
  });
  it('wer schon mehr trainiert als die Obergrenze, wird nicht heruntergezwungen', () => {
    const heavy = profile({
      availableWeeklySec: 25 * 3600,
      baseline: { swim: { durationSec: 3 * 3600 }, bike: { durationSec: 13 * 3600 }, run: { durationSec: 4 * 3600, distanceM: 45_000 } },
    });
    const p = ok(input({ profile: heavy, settings: { philosophy: 0, longestRecentRun: { distanceM: 22_000, asOf: TODAY } } }));
    const loading = p.weeks.filter((w) => w.kind === 'loading');
    for (const w of loading) expect(total(w)).toBeGreaterThanOrEqual(19.9 * 3600);
    expect(p.warnings.find((w) => w.code === 'W11')?.text).toMatch(/aktueller Umfang/);
    expect(p.violations).toEqual([]);
  });
});

describe('Plangenerator – Sensitivität', () => {
  it('kleine Budgetänderung → kleine Planänderung', () => {
    const a = ok(input({ profile: profile({ availableWeeklySec: 12 * 3600 }) }));
    const b = ok(input({ profile: profile({ availableWeeklySec: 12.5 * 3600 }) }));
    for (let i = 0; i < a.weeks.length; i++) expect(Math.abs(total(a.weeks[i]!) - total(b.weeks[i]!))).toBeLessThanOrEqual(0.5 * 3600 + 60);
  });

  it('Altersanpassung: ab 50 Entlastung eine Woche früher', () => {
    const p = ok(input({ profile: profile({ birthDate: '1970-01-01' }), settings: { philosophy: 80 } }));
    expect(p.params.recoveryEvery).toBe(resolveParams(80, 56).recoveryEvery);
    expect(p.params.recoveryEvery).toBe(3);
    expect(resolveParams(80, 30).recoveryEvery).toBe(4);
  });

  it('kurzer Plan (< 8 Wochen) → Warnung W8', () => {
    const p = ok(input({ race: race({ date: '2027-01-10', prepStartDate: '2026-11-16' }) }));
    expect(p.warnings.some((w) => w.code === 'W8')).toBe(true);
    expect(p.violations).toEqual([]);
  });
});

describe('Plangenerator – Fallbeispiel (Backup 18.11.2026)', () => {
  const pascal = () =>
    input({
      race: race({ name: 'Langdistanz im Juli', date: '2027-07-04', prepStartDate: '2026-11-23' }),
      profile: profile({
        birthDate: '1990-01-01',
        availableWeeklySec: 16 * 3600,
        baseline: { periodWeeks: 12, bike: { durationSec: 7 * 3600, sessions: 7 }, run: { durationSec: 1.5 * 3600, sessions: 2 }, strength: { durationSec: 2 * 3600, sessions: 2 } },
      }),
      settings: { philosophy: 50, priorityMode: 'hybrid', priorities: { swim: { user: 1 } }, longestRecentRun: { durationSec: 3600, distanceM: 10_800, asOf: TODAY } },
      extra: {
        metrics: [
          { id: 'css', kind: 'swim_css_s_per_100m', value: 90, unit: 's/100m', date: '2026-11-17', createdAt: 'x1234567890' },
          { id: 'thr', kind: 'run_threshold_pace_s_per_km', value: 235, unit: 's/km', date: '2026-11-17', createdAt: 'x1234567890' },
        ],
      },
    });

  it('Laufen wächst tatsächlich um bis zu 7,5 % pro Belastungswoche (1,5 h → über 4 h)', () => {
    const p = ok(pascal());
    const runs = p.weeks.filter((w) => w.kind === 'loading').map((w) => dur(w, 'run'));
    expect(Math.max(...runs)).toBeGreaterThan(4 * 3600);
    expect(runs[1]! / runs[0]!).toBeGreaterThan(1.05);
    expect(p.violations).toEqual([]);
  });

  it('Distanzen für Laufen (eigenes Tempo beim längsten Lauf) und Schwimmen (geschätzt aus CSS)', () => {
    const p = ok(pascal());
    const w = p.weeks[0]!;
    expect(sportOf(w, 'run')?.distanceM).toBeGreaterThan(0);
    expect(sportOf(w, 'swim')?.distanceM).toBeGreaterThan(0);
    expect(sportOf(w, 'bike')?.distanceM).toBeUndefined();
    // 1:36 h Laufen bei 5:33/km ≈ 17 km
    const run = sportOf(w, 'run')!;
    expect((run.durationSec ?? 0) / ((run.distanceM ?? 1) / 1000)).toBeGreaterThan(320);
    expect(p.rationale.some((r) => /geschätzt aus CSS/.test(r.text))).toBe(true);
  });
});

describe('Vorbereitungsrennen nach Wichtigkeit (1.5.0)', () => {
  const weeksEqual = (a: PlanProposal, b: PlanProposal) =>
    a.weeks.every((w, i) => JSON.stringify(w.targets.sports) === JSON.stringify(b.weeks[i]?.targets.sports));
  it('10 km als Trainingswettkampf: Plan bleibt unverändert, Rennen steht in der Woche', () => {
    const base = ok(input());
    const p = ok(input({ extra: { prepRaces: [prepRace({ name: '10 km Stadtlauf', runM: 10_000, priority: 'low' })] } }));
    expect(weeksEqual(base, p)).toBe(true);
    const w = p.weeks.find((x) => x.weekStart === '2027-04-05')!;
    expect(w.kind).not.toBe('prep_race');
    expect(w.reasons.join(' ')).toMatch(/Plan unverändert/);
    expect(w.longRun).toBeDefined();
  });
  it('Halbmarathon als Saisonhöhepunkt: Woche davor reduziert, Rennwoche und Erholung', () => {
    const p = ok(input({ extra: { prepRaces: [prepRace({ priority: 'high' })] } }));
    const idx = p.weeks.findIndex((w) => w.weekStart === '2027-04-05');
    expect(p.weeks[idx - 1]?.reasons.join(' ')).toMatch(/Woche vor/);
    expect(p.weeks[idx]?.kind).toBe('prep_race');
    expect(p.weeks[idx + 1]?.kind).toBe('post_race');
  });
  it('Marathon auch als Trainingswettkampf mit Erholung danach (physiologische Belastung)', () => {
    const p = ok(input({ extra: { prepRaces: [prepRace({ name: 'Marathon', runM: 42_195, priority: 'low' })] } }));
    const idx = p.weeks.findIndex((w) => w.weekStart === '2027-04-05');
    expect(p.weeks[idx]?.kind).toBe('prep_race');
    expect(p.weeks[idx + 1]?.kind).toBe('post_race');
    expect(p.violations).toEqual([]);
  });
});

describe('Ausgangsumfang aus erfassten Einheiten (1.5.0)', () => {
  const runs = (h: number) =>
    ['2026-10-27', '2026-11-03', '2026-11-10', '2026-11-17'].map((d, i) => ({
      id: `r${i}`, sport: 'run' as const, date: d, durationSec: h * 3600, distanceM: h * 11_000, focus: 'endurance' as const, createdAt: 'x1234567890', updatedAt: 'x1234567890',
    }));
  it('Historie hat Vorrang vor der Profilangabe', () => {
    const p = ok(input({ extra: { history: runs(3) } }));
    expect(p.baseline.bySport.run?.source).toBe('history');
    expect(p.baseline.bySport.run?.durationSec).toBe(3 * 3600);
    const w1 = dur(p.weeks[0]!, 'run');
    expect(w1).toBeGreaterThanOrEqual(3 * 3600);
    expect(w1).toBeLessThanOrEqual(3 * 3600 * 1.1);
  });
  it('längster Lauf aus der Historie, wenn er länger ist als die eigene Angabe', () => {
    const p = ok(input({ extra: { history: runs(3) } }));
    expect(p.baseline.bySport.run?.longestSec).toBe(3 * 3600);
  });
});
