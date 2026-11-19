/**
 * Modellparameter des Plangenerators (docs/PLAN_MODEL.md, Abschnitt 4.1).
 *
 * Jede Zahl trägt ihre Herkunft: Regel aus docs/TRAINING_SCIENCE.md (R…) oder H = Heuristik.
 * Ändert sich ein Wert, MUSS MODEL_VERSION steigen – Vorschläge speichern die Version, mit der sie gerechnet wurden.
 */
import type { PrepRaceSize } from '../domain/prepRace';
import type { PrepRacePriority } from '../domain/schemas';
import type { EnduranceSport, PlannedSport } from '../domain/sports';

export const MODEL_VERSION = 'im-gen-1.8.0';

/** Werte, die mit dem Philosophie-Regler φ (0 = konservativ/Langlebigkeit, 100 = aggressiv/zeitoptimiert) wandern. */
export interface PhilosophyParams {
  philosophy: number;
  /** Anteil Z1–Z2 an der gesamten Ausdauerzeit (3.2, R1). */
  lowIntensityShare: number;
  /** Anteil Z3 an der nicht niedrigen Zeit; Rest Z4–Z5 (3.2: pyramidal → polarisiert betont). */
  z3ShareOfNonLow: number;
  /** Anteil Z5 an Z4–Z5 (H). */
  z5ShareOfHigh: number;
  /** Höchste Wochensteigerung Laufen (R5, Festlegung 3.1). */
  runGrowth: number;
  /** Höchste Wochensteigerung Rad, Schwimmen, Kraft (R5, Entscheidung 3.4). */
  otherGrowth: number;
  /** Jede k-te Woche ist Entlastung (R4) – fest, nicht vom Regler abhängig (Produktentscheidung 17.11.2026); nur Alter verkürzt. */
  recoveryEvery: number;
  /** Entlastungstiefe: Umfang × (1 − r) (R4). */
  recoveryCut: number;
  /** Kraft-Einheiten in Belastungswochen (R9). */
  strengthSessions: number;
  /** Renntempo-Anteil an der Laufzeit in der spezifischen Phase (3.2; erst ab φ ≥ 60). */
  runRacePaceShare: number;
}

/** Wettkampfklasse für Umfangsnormen (R22). */
export type RaceClass = 'full' | 'half' | 'olympic' | 'sprint';

export function raceClass(race: { runM: number; bikeM: number }): RaceClass {
  if (race.runM >= 30_000 || race.bikeM >= 140_000) return 'full';
  if (race.runM >= 15_000 || race.bikeM >= 70_000) return 'half';
  if (race.runM >= 8_000 || race.bikeM >= 30_000) return 'olympic';
  return 'sprint';
}

/**
 * Umfangsnormen je Wettkampfklasse (R22), Stunden pro Woche inkl. Kraft – **unabhängig vom Regler** (Entscheidung 3.6:
 * „konservativ“ heißt weniger Intensität, nicht weniger Zeit).
 * Langdistanz: Freizeit-Finisher trainierten 13,9 ± 5,0 h/Woche [D3] → Obergrenze 19 h (≈ Mittel + 1 SD).
 * Mitteldistanz: 13,9 ± 5,4 h/Woche, ohne Unterschied zwischen schnellen und langsamen Gruppen [D5] → 16 h (≈ Mittel + 0,4 SD).
 * Olympisch/Sprint: keine passenden Studien gefunden → Heuristik (H).
 * Warnschwellen: Langdistanz unter Mittel − 1 SD (9 h) Hinweis, unter 6 h deutliche Warnung.
 */
export const VOLUME_NORMS: Record<RaceClass, { ceilingH: number; cautionBelowH: number; importantBelowH: number; evidence: string }> = {
  full: { ceilingH: 19, cautionBelowH: 9, importantBelowH: 6, evidence: 'D3' },
  half: { ceilingH: 16, cautionBelowH: 6, importantBelowH: 4, evidence: 'D5' },
  olympic: { ceilingH: 12, cautionBelowH: 4, importantBelowH: 3, evidence: 'H' },
  sprint: { ceilingH: 9, cautionBelowH: 3, importantBelowH: 2, evidence: 'H' },
};

/** Höchster Wochenumfang (Spitzenwoche, inkl. Kraft) für die Wettkampfklasse. */
export function volumeCeilingSec(cls: RaceClass): number {
  return Math.round(VOLUME_NORMS[cls].ceilingH * 3600);
}

/** Feste Modellwerte (unabhängig von φ). */
export const FIXED = {
  /** H (1.6.0): lockeres Lauftempo ≈ Schwellenpace × 1,4 (Mitte der Grundlage-Zone 128–150 %), wenn kein eigenes Tempo bekannt ist (nur für Distanzschätzung). Bis 1.5.0: × 1,25 (zu schnell). */
  runEasyPaceFactor: 1.4,
  /** H (1.4.0): Schwimmen inkl. Pausen ≈ CSS × 1,25 pro 100 m (nur für Distanzschätzung). */
  swimSessionPaceFactor: 1.25,
  /** R5, 3.4/3.6: Steigerung Rad/Schwimmen/Kraft, unabhängig vom Regler (Obergrenze laut Festlegung +20 %). */
  otherGrowth: 0.15,
  /** R4, 3.6: Entlastungstiefe, unabhängig vom Regler. */
  recoveryCut: 0.3,
  /** R6: längster Lauf höchstens +10 % gegenüber den vorangehenden 4 Wochen. */
  longRunGrowth: 0.1,
  longRunLookbackWeeks: 4,
  /** H: langer Lauf wächst nur mit, solange er ≤ 50 % des Wochen-Laufumfangs bleibt. */
  longRunShareOfWeek: 0.5,
  /** H: Obergrenzen langer Lauf. */
  longRunMaxSec: 3 * 3600,
  longRunMaxM: 32_000,
  /** H: lange Ausfahrt. */
  longRideShareOfWeek: 0.6,
  longRideMaxSec: 6 * 3600,
  /**
   * Trainingslager (1.8.0, PLAN_MODEL Änderung 26; Grundlage TRAINING_SCIENCE 2.16, Werte H):
   * Mehrumfang je Camp-Woche (anteilig nach Camp-Tagen) auf die normale Steigerungsgrenze – Rad × 1,5, Schwimmen × 1,4
   * (gegenüber der letzten Belastungswoche also bis ≈ +70 % bzw. +60 %); Laufen nach den normalen Grenzen.
   * Insgesamt ergibt das typischerweise ≈ +50 % – Studien: Belastung im Camp im Mittel ≈ +48–49 %.
   * Danach Erholungswoche × 0,6 (Camp ≥ 7 Tage) bzw. × 0,7; Studie: −56 ± 23 % in 10 Tagen nach dem Camp.
   */
  camp: {
    growth: { bike: 0.5, swim: 0.4, run: 0 },
    postFactorLong: 0.6,
    postFactorShort: 0.7,
    /** Lange Ausfahrt im Camp: bis 1,5 × bisherige längste, höchstens 40 % des Rad-Wochenumfangs (und 6 h). */
    longRideGrowth: 0.5,
    longRideShareOfWeek: 0.4,
    /** Camp-Woche zählt die Ausfahrt für die Folgewochen höchstens mit der normalen Steigerung. */
  },
  /** R20: Spitzenwochen ≈ 90 % des Zeitbudgets. */
  peakBudgetShare: 0.9,
  /** R10: Grundgewichte nach Rennzeitanteil. */
  baseWeights: { swim: 0.1, bike: 0.5, run: 0.4 } as Record<EnduranceSport, number>,
  /** H: Prioritätsfaktor je Stufe 1…5. */
  priorityFactor: [0.8, 0.9, 1.0, 1.15, 1.3] as const,
  /** R11, H. */
  swimMinSessions: 2,
  swimLongTargetM: 3800,
  /** R3, H: Phasenanteile vor dem Taper. */
  phaseShares: { base: 0.4, build: 0.35, specific: 0.25 },
  minSpecificWeeks: 3,
  /** R8: Faktor auf Spitzenumfang je Taperwoche (letzte = Wettkampfwoche ohne Rennen). */
  taperFactors: { 1: [0.5], 2: [0.7, 0.45], 3: [0.8, 0.65, 0.45] } as Record<1 | 2 | 3, readonly number[]>,
  /** R8: Intensitätsminuten im Taper mindestens 80 % der Vorwoche. */
  taperIntensityKeep: 0.8,
  /** H: typische Einheitendauer und Spannen für die Einheitenzahl. */
  typicalSessionSec: { swim: 50 * 60, bike: 75 * 60, run: 45 * 60 } as Record<EnduranceSport, number>,
  sessionRange: { swim: [2, 4], bike: [2, 5], run: [2, 5] } as Record<EnduranceSport, readonly [number, number]>,
  strengthDefaultSessionSec: 45 * 60,
  /** H: Intensität außerhalb des Laufens (4.7). */
  bikeMaxZ3Share: 0.35,
  swimMaxNonLowShare: 0.3,
  /** H: Altersanpassung. */
  olderAthleteAge: 50,
  /** Weiche Ziele / Warnschwellen (PLAN_MODEL 5, 6). */
  longRunSoftTargetSec: 2.5 * 3600,
  longRunSoftTargetM: 28_000,
  staleBaselineWeeks: 8,
  /** R13: Frische ≤ 3 → Entlastung; Check-in höchstens 14 Tage alt. */
  lowFreshness: 3,
  freshnessMaxAgeDays: 14,
  /** 4.4: Laufbeschwerde ab diesem Schmerzwert friert den Laufumfang ein. */
  painFreezeThreshold: 4,
  /** Wochen, in denen eine aktive Beschwerde / niedrige Frische die Steigerung stoppt (danach neu berechnen). */
  freezeWeeks: 2,
  /** H (1.1.0): Einstiegsumfang je Woche, falls der Ausgangsumfang darunter liegt oder fehlt (W9). */
  entrySec: { swim: 60 * 60, bike: 90 * 60, run: 40 * 60 } as Record<EnduranceSport, number>,
  /** H (1.1.0): Einstieg ohne bisherigen langen Lauf / lange Ausfahrt. */
  entryLongRunSec: 20 * 60,
  /** H (1.1.0, R11): Schwimm-Spitzenwoche mindestens k × Renndistanz (k = 1,5…2,5 nach Priorität, 1.4.0), höchstens 25 % der Ausdauerzeit der Spitzenwoche. */
  swimPeakRaceMultiple: 2.5,
  swimPeakMaxShare: 0.25,
  /** Ohne eigenes Tempo (nur Dauer bekannt): 2:30 h für 3,8 km, anteilig, mindestens 1 h. */
  swimPeakFallbackSecPer3800: 2.5 * 3600,
  /** H: Mindestumfang Schwimmen, unter den bei Budgetknappheit nicht gekürzt wird (2 × 30 min). */
  swimMinSec: 60 * 60,
  /** H: lange Einheiten in Entlastungs-/Taper-/Rennwochen. */
  reducedLongFactor: 0.75,
  reducedLongShareOfWeek: 0.6,
  /** H: Intensität (nicht niedrig) in Grundlage, Entlastung und Rennwochen halbiert (4.7). */
  reducedIntensityFactor: 0.5,
  /** H: Koppellauf-Dauer in der spezifischen Phase. */
  brickRunSec: 15 * 60,
  /** Rundung der Zonenziele. */
  zoneRoundSec: 5 * 60,
} as const;

/**
 * Vorbereitungsrennen (4.2, H; 1.5.0): Faktoren für Woche davor, Rennwoche (Rennen zählt mit), Woche danach –
 * nach Größe **und Wichtigkeit**. Ein Trainingswettkampf (niedrig) über 5/10 km lässt den Plan unverändert;
 * lange Rennen brauchen auch bei niedriger Wichtigkeit Erholung (physiologische Belastung des Rennens selbst).
 */
export type PrepRaceFactor = { before: number; raceWeek: number; after: number };
export const PREP_RACE_FACTORS: Record<PrepRaceSize, Record<PrepRacePriority, PrepRaceFactor>> = {
  short: {
    low: { before: 1, raceWeek: 1, after: 1 },
    medium: { before: 1, raceWeek: 0.9, after: 1 },
    high: { before: 1, raceWeek: 0.8, after: 0.9 },
  },
  medium: {
    low: { before: 1, raceWeek: 0.9, after: 0.95 },
    medium: { before: 1, raceWeek: 0.8, after: 0.9 },
    high: { before: 0.9, raceWeek: 0.7, after: 0.85 },
  },
  long: {
    low: { before: 1, raceWeek: 0.8, after: 0.8 },
    medium: { before: 0.9, raceWeek: 0.7, after: 0.75 },
    high: { before: 0.85, raceWeek: 0.6, after: 0.7 },
  },
};
export function prepRaceFactor(size: PrepRaceSize, priority: PrepRacePriority | undefined): PrepRaceFactor {
  return PREP_RACE_FACTORS[size][priority ?? 'low'];
}
export type { PrepRaceSize };

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Der Regler steuert vor allem die **Intensität** (Verteilung, Anteil Z5, Renntempo im Laufen) und die Laufsteigerung.
 * Trainingszeit (Obergrenze, Rad/Schwimm-Steigerung, langer Lauf, Entlastungstiefe) hängt nicht vom Regler ab (3.6).
 *
 * Reglerkurve (1.2.0): in der Mitte flach, an den Enden steil – die Extreme wirken deutlich stärker.
 * f(0) = 0, f(0,5) = 0,5, f(1) = 1; Steigung an den Enden 1,8, in der Mitte 0,4.
 */
export function sliderCurve(t: number): number {
  const u = 2 * Math.min(1, Math.max(0, t)) - 1;
  return 0.5 + 0.5 * (0.4 * u + 0.6 * u * u * u);
}

/** Parameter für eine Reglerstellung. Werte außerhalb 0…100 werden begrenzt. */
export function resolveParams(philosophy: number, age?: number): PhilosophyParams {
  const phi = Math.min(100, Math.max(0, Number.isFinite(philosophy) ? philosophy : 50));
  const t = sliderCurve(phi / 100);
  const recoveryEvery = age !== undefined && age >= FIXED.olderAthleteAge ? 3 : 4;
  return {
    philosophy: phi,
    lowIntensityShare: lerp(0.9, 0.7, t),
    z3ShareOfNonLow: lerp(0.75, 0.2, t),
    z5ShareOfHigh: lerp(0.2, 0.5, t),
    runGrowth: lerp(0.05, 0.1, t),
    otherGrowth: FIXED.otherGrowth,
    recoveryEvery,
    recoveryCut: FIXED.recoveryCut,
    strengthSessions: phi >= 67 ? 1 : 2,
    runRacePaceShare: phi >= 60 ? lerp(0, 0.06, (phi - 60) / 40) : 0,
  };
}

/** Wachstumsgrenze je Sportart. */
export function growthFor(sport: PlannedSport, p: PhilosophyParams): number {
  return sport === 'run' ? p.runGrowth : p.otherGrowth;
}

/** Normierte Disziplingewichte aus Grundgewicht × Prioritätsfaktor (4.3). Priorität 1…5, Standard 3. */
export function disciplineWeights(priorities: Partial<Record<EnduranceSport, number>>): Record<EnduranceSport, number> {
  const raw = {} as Record<EnduranceSport, number>;
  let sum = 0;
  for (const s of ['swim', 'bike', 'run'] as const) {
    const prio = Math.min(5, Math.max(1, Math.round(priorities[s] ?? 3)));
    raw[s] = FIXED.baseWeights[s] * (FIXED.priorityFactor[prio - 1] ?? 1);
    sum += raw[s];
  }
  return { swim: raw.swim / sum, bike: raw.bike / sum, run: raw.run / sum };
}
