import { describe, expect, it } from 'vitest';
import { PREP_RACE_PRESETS, prepRaceIssues, prepRaceIssueText, prepRaceSize } from './prepRace';
import { prepRaceSchema } from './schemas';

describe('Vorbereitungswettkämpfe', () => {
  it('Vorlagen werden nach PLAN_MODEL 4.2 eingestuft', () => {
    const size = (k: string) => prepRaceSize(PREP_RACE_PRESETS[k]!);
    expect(size('tri_sprint')).toBe('short');
    expect(size('tri_olympic')).toBe('short');
    expect(size('run_10k')).toBe('short');
    expect(size('run_half')).toBe('medium');
    expect(size('bike_long')).toBe('medium');
    expect(size('swim_long')).toBe('medium');
    expect(size('tri_half')).toBe('long');
    expect(size('run_marathon')).toBe('long');
    expect(prepRaceSize({ kind: 'other' })).toBe('medium');
    expect(prepRaceSize({ kind: 'run', runM: 15_000 })).toBe('medium');
  });

  it('jede Vorlage ist ein gültiger Datensatz', () => {
    for (const p of Object.values(PREP_RACE_PRESETS)) {
      const { label, ...rest } = p;
      const r = prepRaceSchema.safeParse({ ...rest, id: 'x', planId: 'p', name: label, date: '2027-04-11', createdAt: 'x1234567890', updatedAt: 'x1234567890' });
      expect(r.success).toBe(true);
    }
  });

  it('ohne Distanz nur bei „Sonstiges“ erlaubt', () => {
    const base = { id: 'x', planId: 'p', name: 'Lauf', date: '2027-04-11', createdAt: 'x1234567890', updatedAt: 'x1234567890' };
    expect(prepRaceSchema.safeParse({ ...base, kind: 'run' }).success).toBe(false);
    expect(prepRaceSchema.safeParse({ ...base, kind: 'other' }).success).toBe(true);
  });

  it('Hinweise: Vergangenheit, nach/kurz vor dem Hauptwettkampf, zwei Rennen in einer Woche', () => {
    const others = [{ id: 'b', date: '2027-04-14', name: 'Radrennen' }];
    const codes = (date: string, id = 'a') => prepRaceIssues({ id, date }, '2027-06-27', '2026-11-17', others).map((i) => i.code);
    expect(codes('2027-03-01')).toEqual([]);
    expect(codes('2026-11-01')).toEqual(['in_past']);
    expect(codes('2027-06-27')).toEqual(['after_main_race']);
    expect(codes('2027-06-13')).toEqual(['close_to_main_race']);
    expect(codes('2027-04-11')).toEqual(['same_week']);
    expect(codes('2027-04-14', 'b')).toEqual([]);
    for (const i of prepRaceIssues({ id: 'a', date: '2027-06-20' }, '2027-06-27', '2026-11-17', [])) expect(prepRaceIssueText(i)).toMatch(/7 Tage/);
  });
});
