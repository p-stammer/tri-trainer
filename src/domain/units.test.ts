import { describe, expect, it } from 'vitest';
import {
  formatDistance,
  formatDurationLong,
  formatDurationShort,
  formatPace,
  kmToMeters,
  pacePer100m,
  pacePerKm,
  parseDecimal,
  parsePace,
  speedKmh,
} from './units';

describe('Einheiten', () => {
  it('Dauerformat', () => {
    expect(formatDurationShort(6.5 * 3600)).toBe('6:30 h');
    expect(formatDurationLong(6.5 * 3600)).toBe('6 h 30 min');
    expect(formatDurationLong(45 * 60)).toBe('45 min');
    expect(formatDurationLong(2 * 3600)).toBe('2 h');
    expect(formatDurationShort(59 * 60 + 40)).toBe('1:00 h');
  });

  it('Pace-Umrechnung und Rundung', () => {
    expect(pacePerKm(50 * 60, 10_000)).toBe(300);
    expect(formatPace(275)).toBe('4:35');
    expect(formatPace(299.6)).toBe('5:00');
    expect(pacePer100m(30 * 60, 2000)).toBe(90);
    expect(pacePerKm(3600, undefined)).toBeNull();
    expect(pacePerKm(3600, 0)).toBeNull();
    expect(speedKmh(3600, 32_000)).toBe(32);
  });

  it('Eingaben parsen', () => {
    expect(parsePace('4:35')).toBe(275);
    expect(parsePace('1:30')).toBe(90);
    expect(parsePace('4:75')).toBeNull();
    expect(parseDecimal('2,5')).toBe(2.5);
    expect(parseDecimal('2.5')).toBe(2.5);
    expect(parseDecimal('abc')).toBeNull();
    expect(parseDecimal('')).toBeNull();
    expect(kmToMeters(2.4)).toBe(2400);
    expect(kmToMeters(42.195)).toBe(42195);
  });

  it('Distanzformat', () => {
    expect(formatDistance(2400, 'auto-swim')).toBe('2.400 m');
    expect(formatDistance(42195)).toBe('42,2 km');
  });
});
