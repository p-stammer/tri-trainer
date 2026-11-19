/**
 * Harte Grenzen des Plangenerators als reine Funktionen (docs/PLAN_MODEL.md 4.4, 4.5, Abschnitt 5).
 * Werden von Modul E (Projektion) und Modul H (zweite Prüfung) gemeinsam verwendet.
 */
import { FIXED } from './params';

/**
 * Mittel der drei Vorwochen. Fehlende Vorwochen (Planbeginn) zählen mit dem Ausgangsumfang.
 * `previous` = geplante Werte der bisherigen Planwochen in zeitlicher Reihenfolge.
 */
export function trailingMean(previous: readonly number[], baseline: number, window = 3): number {
  const vals: number[] = [];
  for (let k = 1; k <= window; k++) {
    const v = previous[previous.length - k];
    vals.push(v ?? baseline);
  }
  return vals.reduce((a, b) => a + b, 0) / window;
}

/**
 * H1/H3 (1.4.0): höchster zulässiger Umfang einer Belastungswoche = (1 + g) × Bezug.
 * Bezug = letzte Belastungswoche, nach Pausen aber mindestens das Mittel der letzten drei (sanfter Wiedereinstieg).
 * So wächst der Umfang tatsächlich um g pro Belastungswoche (vorher: nur g gegenüber dem Mittel → effektiv etwa g/2).
 * `previous` = Umfänge der bisherigen Belastungswochen (ohne geplante Entlastung/Taper/Rennwochen).
 */
export function progressionRef(previous: readonly number[], baseline: number): number {
  return Math.max(previous[previous.length - 1] ?? baseline, trailingMean(previous, baseline));
}

export function progressionCap(previous: readonly number[], baseline: number, growth: number): number {
  return (1 + growth) * progressionRef(previous, baseline);
}

/**
 * H2 / 4.5: längste Einheit. `ref` = längste Einheit der vorangehenden Wochen (Lookback), in Woche 1 der Ausgangswert.
 * Der Wochenanteil bremst nur das Wachstum, drückt aber nicht unter `ref`.
 */
export function longSessionCap(ref: number, weekVolume: number, growth: number, shareOfWeek: number, absoluteMax: number): number {
  return Math.min((1 + growth) * ref, Math.max(ref, shareOfWeek * weekVolume), absoluteMax);
}

/** Langer Lauf (Dauer in s oder Distanz in m, je nach übergebener Größe). */
export function longRunCap(ref: number, weekVolume: number, unit: 'sec' | 'm', max?: { sec: number; m: number }): number {
  const absMax = unit === 'sec' ? (max?.sec ?? FIXED.longRunMaxSec) : (max?.m ?? FIXED.longRunMaxM);
  return longSessionCap(ref, weekVolume, FIXED.longRunGrowth, FIXED.longRunShareOfWeek, absMax);
}

/** Referenz für die längste Einheit: Maximum der letzten `lookback` Wochen, sonst Ausgangswert. */
export function longSessionRef(previousLongest: readonly number[], baselineLongest: number, lookback: number = FIXED.longRunLookbackWeeks): number {
  const recent = previousLongest.slice(-lookback);
  // Fehlen Vorwochen, gilt der Ausgangswert mit – Planwochen ersetzen ihn erst nach `lookback` Wochen vollständig.
  return Math.max(...recent, recent.length < lookback ? baselineLongest : 0);
}

/** Umfang einer Entlastungswoche bezogen auf die letzte Belastungswoche (R4). */
export function recoveryVolume(lastLoadingWeek: number, cut: number): number {
  return lastLoadingWeek * (1 - cut);
}

/**
 * Geplante Werte werden **abgerundet** (Dauer auf 1 min, Distanz auf 100 m), damit Runden nie eine harte Grenze verletzt.
 * Die abgerundeten Werte sind die Grundlage für die Grenzen der Folgewochen.
 */
export function floorVolume(value: number, unit: 'sec' | 'm'): number {
  const step = unit === 'sec' ? 60 : 100;
  return Math.floor(value / step + 1e-9) * step;
}
