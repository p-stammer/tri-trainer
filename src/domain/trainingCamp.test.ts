import { describe, expect, it } from 'vitest';
import { campDays, campIssues } from './trainingCamp';
import { trainingCampSchema } from './schemas';

const c = (startDate: string, endDate: string, id = 'a', name = 'Camp') => ({ id, name, startDate, endDate });

describe('Trainingslager', () => {
  it('Dauer und Hinweise', () => {
    expect(campDays(c('2027-03-01', '2027-03-07'))).toBe(7);
    expect(campIssues(c('2027-03-01', '2027-03-07'), '2027-07-04', '2026-11-19', []).map((i) => i.code)).toEqual([]);
    expect(campIssues(c('2027-06-20', '2027-06-25'), '2027-07-04', '2026-11-19', []).map((i) => i.code)).toEqual(['near_race']);
    expect(campIssues(c('2026-10-01', '2026-10-05'), '2027-07-04', '2026-11-19', []).map((i) => i.code)).toEqual(['past']);
    expect(campIssues(c('2027-03-01', '2027-03-20'), '2027-07-04', '2026-11-19', [c('2027-03-05', '2027-03-06', 'b', 'Kurz')]).map((i) => i.code)).toEqual(['overlap', 'long']);
  });

  it('Schema: Ende nicht vor Beginn, höchstens 4 Wochen, 0,5–8 h pro Tag', () => {
    const base = { id: 'x', planId: 'p', name: 'Camp', startDate: '2027-03-01', endDate: '2027-03-07', hoursPerDay: 4, createdAt: 'x1234567890', updatedAt: 'x1234567890' };
    expect(trainingCampSchema.safeParse(base).success).toBe(true);
    expect(trainingCampSchema.safeParse({ ...base, endDate: '2027-02-28' }).success).toBe(false);
    expect(trainingCampSchema.safeParse({ ...base, endDate: '2027-03-29' }).success).toBe(false);
    expect(trainingCampSchema.safeParse({ ...base, endDate: '2027-03-28' }).success).toBe(true);
    expect(trainingCampSchema.safeParse({ ...base, hoursPerDay: 9 }).success).toBe(false);
  });
});
