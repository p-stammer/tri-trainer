import { describe, expect, it } from 'vitest';
import { adaptationSuggestions, adaptationText, deloadCause, easyRpeTrend, modelVersionFromDescription, quickDeloadChange, quickDeloadWeek } from './adaptation';
import type { WeekTargets } from './schemas';

const t = (run: number, bike = 3 * 3600): WeekTargets => ({ phase: 'base', sports: [{ sport: 'run', durationSec: run }, { sport: 'bike', durationSec: bike }], focuses: [] });
const base = {
  today: '2026-12-16',
  weeks: [
    { weekStart: '2026-11-30', current: t(3600) },
    { weekStart: '2026-12-07', current: t(3600) },
    { weekStart: '2026-12-14', current: t(3600) },
  ],
  activities: [] as { sport: 'run' | 'bike'; date: string; durationSec: number }[],
  checkins: [],
  metrics: [],
  pauses: [],
  lastGenerated: { at: '2026-11-25T10:00:00.000Z', modelVersion: 'im-gen-1.5.0' },
  currentModelVersion: 'im-gen-1.5.0',
};
const act = (sport: 'run' | 'bike', date: string, h: number) => ({ sport, date, durationSec: h * 3600 });

describe('Anpassungsvorschläge (M3.6)', () => {
  it('ohne übernommenen Planvorschlag keine Vorschläge', () => {
    const { lastGenerated: _l, ...rest } = base;
    expect(adaptationSuggestions(rest)).toEqual([]);
  });

  it('Ziel in zwei Wochen deutlich verfehlt → Vorschlag für die Sportart', () => {
    const r = adaptationSuggestions({ ...base, activities: [act('run', '2026-12-01', 0.5), act('run', '2026-12-08', 0.6), act('bike', '2026-12-02', 3), act('bike', '2026-12-09', 3)] });
    expect(r.map((x) => x.code)).toEqual(['under']);
    expect(adaptationText(r[0]!)).toMatch(/Laufen: .* 50 % bzw\. 60 %/);
  });

  it('nur eine Woche verfehlt oder Woche mit Pause → kein Vorschlag', () => {
    expect(adaptationSuggestions({ ...base, activities: [act('run', '2026-12-01', 0.5), act('run', '2026-12-08', 1), act('bike', '2026-12-02', 3), act('bike', '2026-12-09', 3)] })).toEqual([]);
    const pauses = [{ startDate: '2026-12-02', endDate: '2026-12-04' }];
    expect(adaptationSuggestions({ ...base, pauses, activities: [act('bike', '2026-12-02', 3), act('bike', '2026-12-09', 3)] })).toEqual([]);
  });

  it('Laufen deutlich über Plan → Hinweis', () => {
    const r = adaptationSuggestions({ ...base, activities: [act('run', '2026-12-01', 1), act('run', '2026-12-08', 1.5), act('bike', '2026-12-02', 3), act('bike', '2026-12-09', 3)] });
    expect(r.map((x) => x.code)).toEqual(['over']);
  });

  it('niedrige Frische, neuer Leistungswert und ältere Planlogik', () => {
    const r = adaptationSuggestions({
      ...base,
      activities: [act('run', '2026-12-01', 1), act('run', '2026-12-08', 1), act('bike', '2026-12-02', 3), act('bike', '2026-12-09', 3)],
      checkins: [{ date: '2026-12-14', freshness: 3 }],
      metrics: [{ kind: 'swim_css_s_per_100m', value: 88, date: '2026-12-10', createdAt: '2026-12-10T08:00:00.000Z' }],
      lastGenerated: { at: '2026-11-25T10:00:00.000Z', modelVersion: 'im-gen-1.3.0' },
    });
    expect(r.map((x) => x.code)).toEqual(['fatigue', 'metric', 'model']);
    expect(adaptationText(r[1]!)).toMatch(/CSS 1:28/);
  });

  it('Frische niedrig: Woche direkt entlasten – bis Mittwoch die laufende, danach die nächste Woche', () => {
    const weeks = [...base.weeks, { weekStart: '2026-12-21', current: t(4000) }];
    expect(quickDeloadWeek('2026-12-16', weeks)).toBe('2026-12-14');
    expect(quickDeloadWeek('2026-12-17', weeks)).toBe('2026-12-21');
    expect(quickDeloadWeek('2026-12-24', weeks)).toBeNull(); // Woche ab 28.12. fehlt
    const r = adaptationSuggestions({ ...base, weeks, checkins: [{ date: '2026-12-14', freshness: 2 }] });
    const f = r.find((x) => x.code === 'fatigue');
    expect(f).toMatchObject({ deloadWeek: '2026-12-14' });
    expect(adaptationText(f!)).toMatch(/Woche ab .* direkt entlasten/);

    const week = { weekStart: '2026-12-21', current: { ...t(4000), sports: [...t(4000).sports, { sport: 'strength' as const, sessions: 2, durationSec: 5400 }] } };
    const c = quickDeloadChange(week, 'Frische 2/10');
    expect(c.after.phase).toBe('recovery');
    expect(c.after.sports.find((x) => x.sport === 'run')?.durationSec).toBe(2820); // 4000 × 0,7 → auf volle Minuten
    expect(c.after.sports.find((x) => x.sport === 'strength')?.sessions).toBe(1);
    expect(c.after.notes).toMatch(/Frische 2\/10/);
    expect(c.before).toBe(week.current);
  });

  it('steht schon eine Entlastungswoche an, entfällt der Frische-Hinweis', () => {
    const weeks = [base.weeks[0]!, base.weeks[1]!, { weekStart: '2026-12-14', current: { ...t(2400), phase: 'recovery' as const } }];
    const r = adaptationSuggestions({ ...base, weeks, checkins: [{ date: '2026-12-14', freshness: 2 }] });
    expect(r.map((x) => x.code)).not.toContain('fatigue');
  });

  it('RPE: lockere Einheiten mit hoher Anstrengung → Ermüdungshinweis mit „Woche entlasten“', () => {
    const e = (date: string, rpe: number, focus: 'endurance' | 'long' | 'threshold' = 'endurance', sport: 'run' | 'bike' = 'run') => ({ sport, date, durationSec: 3600, focus, rpe });
    // absolut hoch: Ø 6,3 in den letzten 14 Tagen
    const high = [e('2026-12-08', 6), e('2026-12-11', 7, 'long'), e('2026-12-14', 6, 'endurance', 'bike')];
    expect(easyRpeTrend(high, '2026-12-16')?.mean).toBeCloseTo(6.33, 2);
    const r = adaptationSuggestions({ ...base, activities: [...high, act('bike', '2026-12-02', 3), act('bike', '2026-12-09', 3), act('run', '2026-12-01', 1), act('run', '2026-12-09', 1)] });
    const rpe = r.find((x) => x.code === 'rpe');
    expect(rpe).toMatchObject({ count: 3, deloadWeek: '2026-12-14' });
    expect(adaptationText(rpe!)).toMatch(/Lockere Einheiten fühlen sich hart an: durchschnittliche Anstrengung 6,3/);
    expect(deloadCause(rpe!)).toBe('hohem RPE bei lockeren Einheiten (Ø 6,3)');
    // Anstieg: vorher Ø 3, jetzt Ø 5 → Hinweis; jetzt Ø 4 → keiner
    const before = [e('2026-11-10', 3), e('2026-11-15', 3), e('2026-11-20', 3)];
    expect(easyRpeTrend([...before, e('2026-12-08', 5), e('2026-12-10', 5), e('2026-12-12', 5)], '2026-12-16')).toMatchObject({ previousMean: 3 });
    expect(easyRpeTrend([...before, e('2026-12-08', 4), e('2026-12-10', 4), e('2026-12-12', 4)], '2026-12-16')).toBeNull();
    // harte Einheiten zählen nicht, zu wenige Einheiten auch nicht
    expect(easyRpeTrend([e('2026-12-08', 8, 'threshold'), e('2026-12-10', 8, 'threshold'), e('2026-12-12', 8, 'threshold')], '2026-12-16')).toBeNull();
    expect(easyRpeTrend([e('2026-12-10', 8), e('2026-12-12', 8)], '2026-12-16')).toBeNull();
    // vor der Planübernahme erfasste Einheiten zählen nicht
    expect(easyRpeTrend(high, '2026-12-16', '2026-12-12')).toBeNull();
  });

  it('Beschwerde mit Schmerz ≥ 4 seit der Übernahme → Hinweis; nicht bei Pause, < 4, abklingend oder alt', () => {
    const issue = { id: 'i1', region: 'calf' as const, side: 'left' as const, sports: ['run' as const], status: 'active' as const };
    const obs = (date: string, pain: number) => ({ issueId: 'i1', date, pain, createdAt: `${date}T08:00:00.000Z` });
    const run = (o: object) => adaptationSuggestions({ ...base, activities: [act('run', '2026-12-01', 1), act('run', '2026-12-08', 1), act('bike', '2026-12-02', 3), act('bike', '2026-12-09', 3)], painIssues: [issue], ...o });
    const r = run({ painObservations: [obs('2026-12-10', 2), obs('2026-12-14', 5)] });
    const p = r.find((x) => x.code === 'pain');
    expect(p).toMatchObject({ issueId: 'i1', title: 'Wade links', pain: 5, sports: ['Laufen'] });
    expect(adaptationText(p!)).toMatch(/Beschwerde Wade links \(Laufen\): Schmerz 5 von 10/);
    expect(run({ painObservations: [obs('2026-12-10', 5), obs('2026-12-14', 3)] }).map((x) => x.code)).not.toContain('pain');
    expect(run({ painObservations: [obs('2026-11-20', 6)] }).map((x) => x.code)).not.toContain('pain'); // vor der Übernahme
    expect(run({ painObservations: [obs('2026-12-14', 5)], pauses: [{ startDate: '2026-12-15' }] }).map((x) => x.code)).not.toContain('pain');
    expect(run({ painObservations: [obs('2026-12-14', 5)], painIssues: [{ ...issue, status: 'improving' }] }).map((x) => x.code)).not.toContain('pain');
  });

  it('neue Gewichtung → Hinweis, aber nicht zusätzlich zum Hinweis auf eine ältere Planlogik', () => {
    const changes = [{ sport: 'run' as const, from: 3, to: 4, reason: 'Prognose: 41 % der Zeit statt typisch 36 % – relativ langsamer (+1)' }];
    const r = adaptationSuggestions({ ...base, priorityChanges: changes });
    const p = r.find((x) => x.code === 'priority');
    expect(adaptationText(p!)).toMatch(/Neue Gewichtung vorgeschlagen – Laufen 3 → 4: Prognose/);
    const old = adaptationSuggestions({ ...base, lastGenerated: { at: base.lastGenerated!.at, modelVersion: 'im-gen-1.0.0' }, priorityChanges: changes });
    expect(old.map((x) => x.code)).toContain('model');
    expect(old.map((x) => x.code)).not.toContain('priority');
  });

  it('Modellversion aus der Änderungsbeschreibung', () => {
    expect(modelVersionFromDescription('Plan vorgeschlagen: 32 Wochen ab KW 48 (Regler 50, Modell im-gen-1.3.0)')).toBe('im-gen-1.3.0');
    expect(modelVersionFromDescription('Woche bearbeitet')).toBeUndefined();
  });
});
