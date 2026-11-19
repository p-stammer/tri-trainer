/** Sportarten, Zonen, Einheitsschwerpunkte und Phasen – zentrale Stammdaten. */

export const SPORTS = ['swim', 'bike', 'run', 'strength', 'other'] as const;
export type Sport = (typeof SPORTS)[number];

/** Sportarten, für die Wochenziele geplant werden. */
export const PLANNED_SPORTS = ['swim', 'bike', 'run', 'strength'] as const;
export type PlannedSport = (typeof PLANNED_SPORTS)[number];

/** Ausdauersportarten mit Intensitätszonen. */
export const ENDURANCE_SPORTS = ['swim', 'bike', 'run'] as const;
export type EnduranceSport = (typeof ENDURANCE_SPORTS)[number];

export function isEnduranceSport(s: Sport): s is EnduranceSport {
  return s === 'swim' || s === 'bike' || s === 'run';
}

export const SPORT_LABEL: Record<Sport, string> = {
  swim: 'Schwimmen',
  bike: 'Radfahren',
  run: 'Laufen',
  strength: 'Krafttraining',
  other: 'Sonstiges / Cardio',
};

/** Vorschläge für „Sonstiges / Cardio“ – zählt zur Gesamtzeit und Belastung, nicht zu den Wochenzielen. */
export const OTHER_ACTIVITY_PRESETS = ['Wandern', 'Cardio-Gerät', 'Skilanglauf', 'Rudern', 'Ballsport', 'Klettern', 'Yoga / Mobility'] as const;

export const SPORT_SHORT: Record<Sport, string> = {
  swim: 'Schwimmen',
  bike: 'Rad',
  run: 'Laufen',
  strength: 'Kraft',
  other: 'Sonstiges',
};

export const ZONES = ['z1', 'z2', 'z3', 'z4', 'z5'] as const;
export type Zone = (typeof ZONES)[number];

export const ZONE_LABEL: Record<Zone, string> = {
  z1: 'Z1 Regeneration',
  z2: 'Z2 Grundlage',
  z3: 'Z3 Tempo',
  z4: 'Z4 Schwelle',
  z5: 'Z5 VO2max',
};

/** Zonenzeiten in Sekunden; fehlende Schlüssel bedeuten "nicht erfasst", nicht 0. */
export type ZoneSeconds = Partial<Record<Zone, number>>;

/**
 * Einheitsfokus = Absicht/Charakter einer Einheit.
 * Er ist bewusst getrennt von tatsächlich gemessener Zonenzeit:
 * Eine "VO2max"-Einheit von 60 min enthält z. B. nur 18 min in Z5.
 */
export const SESSION_FOCUSES = [
  'recovery',
  'endurance',
  'long',
  'tempo',
  'threshold',
  'vo2max',
  'race_pace',
  'technique',
  'brick',
  'strength',
  'test',
  'other',
] as const;
export type SessionFocus = (typeof SESSION_FOCUSES)[number];

export const SESSION_FOCUS_LABEL: Record<SessionFocus, string> = {
  recovery: 'Regeneration',
  endurance: 'Grundlage',
  long: 'Lange Einheit',
  tempo: 'Tempo',
  threshold: 'Schwelle',
  vo2max: 'VO2max',
  race_pace: 'Wettkampftempo',
  technique: 'Technik',
  brick: 'Koppeltraining',
  strength: 'Kraft',
  test: 'Leistungstest',
  other: 'Sonstiges',
};

/** Sinnvolle Fokus-Auswahl je Sportart (für die Erfassungsmaske). */
export const FOCUSES_BY_SPORT: Record<Sport, readonly SessionFocus[]> = {
  swim: ['endurance', 'technique', 'threshold', 'vo2max', 'long', 'race_pace', 'recovery', 'test', 'other'],
  bike: ['endurance', 'long', 'tempo', 'threshold', 'vo2max', 'race_pace', 'brick', 'recovery', 'test', 'other'],
  run: ['endurance', 'long', 'tempo', 'threshold', 'vo2max', 'race_pace', 'brick', 'recovery', 'test', 'other'],
  strength: ['strength', 'other'],
  other: ['other', 'recovery', 'endurance'],
};

export const PHASE_TYPES = ['base', 'build', 'specific', 'recovery', 'taper', 'race', 'transition'] as const;
export type PhaseType = (typeof PHASE_TYPES)[number];

export const PHASE_LABEL: Record<PhaseType, string> = {
  base: 'Grundlagenphase',
  build: 'Aufbauphase',
  specific: 'Spezifische Vorbereitung',
  recovery: 'Entlastungswoche',
  taper: 'Tapering',
  race: 'Wettkampfwoche',
  transition: 'Übergang',
};

export type PrimaryMetric = 'duration' | 'distance';
