/**
 * Zielzeit-Prognose Langdistanz (Version 2.0, R15 erweitert am 18.11.2026 auf Nutzerwunsch):
 * je Teildisziplin mehrere unabhängige Schätzwege – Leistungswert (FTP, Schwellenpace, CSS), Bestzeit und
 * **absolviertes Training** – jeweils als Spanne. Dazu Gesamtformeln aus Bestzeiten zum Vergleich.
 *
 * Grundsätze:
 * - Immer Spannen, nie eine Punktzahl allein. Stand heute, keine Annahme über künftige Fortschritte.
 * - Jeder Faktor hat eine Quelle oder ist als Heuristik (H) markiert (docs/TRAINING_SCIENCE.md 2.11, docs/PROGNOSIS_MODEL.md).
 * - Fehlt für eine Disziplin jede Grundlage, gibt es keine Gesamtzahl, sondern einen Hinweis, was fehlt.
 */
import { diffDays, type LocalDate } from './calendar';
import type { AthleteProfile, CompletedActivity, PerformanceMetric, TargetRace } from './schemas';

export const PROGNOSIS_MODEL_VERSION = 'im-prog-1.1.0';

export type SplitKey = 'swim' | 'bike' | 'run' | 'transitions';
export type MethodBasis = 'metric' | 'best' | 'training' | 'assumption';

export interface Range {
  lo: number;
  hi: number;
}

export interface MethodEstimate extends Range {
  id: string;
  basis: MethodBasis;
  label: string;
  /** Kurze Begründung mit Eingabewerten */
  detail: string;
  source: string;
}

export interface SplitEstimate {
  split: SplitKey;
  methods: MethodEstimate[];
  /** Mittel der Methoden (lo und hi je gemittelt); null ohne Methode */
  combined: Range | null;
  missing?: string;
}

export interface TotalFormula extends Range {
  id: string;
  label: string;
  detail: string;
  source: string;
}

export interface Prognosis {
  supported: boolean;
  /** Ohne Race-Setup im Profil keine Prognose (seit 1.1.0). */
  needsSetup: boolean;
  splits: SplitEstimate[];
  /** Summe der Teilspannen (bewusst breit: Fehler der Teilzeiten hängen zusammen) */
  total: (Range & { mid: number }) | null;
  formulas: TotalFormula[];
  /** Kontext zum absolvierten Training */
  trainingWeeklySec: number | null;
  notes: string[];
}

export interface PrognosisSettings {
  /** veraltet (bis 0.20.0) – ersetzt durch das Race-Setup im Profil */
  bikeType?: 'tt' | 'road_aero' | 'road';
  bikeElevationM?: number;
}

export type RaceSetup = NonNullable<AthleteProfile['raceSetup']>;

export interface PrognosisInput {
  today: LocalDate;
  race: Pick<TargetRace, 'swimM' | 'bikeM' | 'runM'>;
  profile: Pick<AthleteProfile, 'weightKg' | 'sex' | 'bestTimes' | 'raceSetup'> | undefined;
  metrics: readonly PerformanceMetric[];
  activities: readonly Pick<CompletedActivity, 'sport' | 'date' | 'durationSec' | 'distanceM'>[];
  settings: PrognosisSettings;
}

// ───────────── Annahmen (Quellen in docs/PROGNOSIS_MODEL.md) ─────────────

/** Schwimmen: Langdistanz-Tempo = CSS + 4…12 s/100 m (Swim Smooth: 5 km +2–4, 10 km +6–10; Freiwasser, Navigation). */
export const SWIM_CSS_OFFSET: Range = { lo: 4, hi: 12 };
/** Schwimmen aus Training: Ø-Pace der Einheiten enthält Pausen → Renntempo 0,88…1,0 × (H). */
export const SWIM_TRAINING_FACTOR: Range = { lo: 0.88, hi: 1.0 };
/** Rad: Intensitätsfaktor 0,65…0,75 der FTP (Altersklasse Langdistanz; Median ≈ 0,70). */
export const BIKE_IF: Range = { lo: 0.65, hi: 0.75 };
/**
 * Race-Setup → Luft- und Rollwiderstand (1.1.0, Werte H aus Praxisquellen, PROGNOSIS_MODEL 2a):
 * CdA-Grundspanne nach Rad und Aufleger (mit Tri-Einteiler, normalem Helm, Standard-Laufrädern),
 * dann Faktoren für Kleidung/Helm und Laufräder; Crr nach Reifen (Gravelrad + 0,0015).
 */
export const SETUP_CDA: Record<RaceSetup['bikeType'], { clipOns: Range; hoods: Range }> = {
  tt: { clipOns: { lo: 0.24, hi: 0.29 }, hoods: { lo: 0.24, hi: 0.29 } },
  aero_road: { clipOns: { lo: 0.27, hi: 0.32 }, hoods: { lo: 0.31, hi: 0.36 } },
  road: { clipOns: { lo: 0.28, hi: 0.33 }, hoods: { lo: 0.32, hi: 0.38 } },
  gravel: { clipOns: { lo: 0.3, hi: 0.35 }, hoods: { lo: 0.34, hi: 0.4 } },
};
export const KIT_CDA_FACTOR: Record<RaceSetup['kit'], number> = { aero: 0.95, normal: 1, loose: 1.08 };
export const WHEELS_CDA_FACTOR: Record<RaceSetup['wheels'], number> = { deep: 0.975, standard: 1 };
export const TIRE_CRR: Record<RaceSetup['tires'], number> = { race: 0.0035, training: 0.005 };
export const GRAVEL_CRR_EXTRA = 0.0015;
/** Neoprenanzug: 3–7 % schneller (Feld- und Laborstudien; Widerstand −12 bis −14 %). */
export const WETSUIT_FACTOR: Range = { lo: 0.93, hi: 0.97 };
/** Carbon-Laufschuhe: Laufökonomie ≈ +2,5–4 %, Marathonleistung ≈ 1–2 % (Metaanalysen) → Laufzeit × 0,98…0,995. */
export const CARBON_SHOE_FACTOR: Range = { lo: 0.98, hi: 0.995 };

export const BIKE_PHYSICS = { rho: 1.2, crr: 0.004, efficiency: 0.975, bikeAndGearKg: 10, defaultRiderKg: 75 };

/** Vorbelegung des Race-Setups aus der alten Rad-Einstellung (bis 0.20.0); auch Annahme des Planers, solange kein Setup hinterlegt ist. */
export function defaultRaceSetup(settings?: PrognosisSettings): RaceSetup {
  const bt = settings?.bikeType ?? 'tt';
  return {
    bikeType: bt === 'tt' ? 'tt' : 'road',
    clipOns: bt !== 'road',
    wheels: 'standard',
    tires: 'race',
    kit: 'normal',
    runShoes: 'training',
    wetsuit: 'unknown',
  };
}

/** Profil mit Race-Setup – für den Planer, der die Teilzeit-Anteile auch ohne hinterlegtes Setup braucht. */
export function withAssumedSetup<P extends PrognosisInput['profile']>(profile: P, settings?: PrognosisSettings): NonNullable<PrognosisInput['profile']> {
  return { ...(profile ?? {}), raceSetup: profile?.raceSetup ?? defaultRaceSetup(settings) } as NonNullable<PrognosisInput['profile']>;
}

export function setupCda(setup: RaceSetup): Range {
  const base = setup.bikeType === 'tt' || setup.clipOns ? SETUP_CDA[setup.bikeType].clipOns : SETUP_CDA[setup.bikeType].hoods;
  const f = KIT_CDA_FACTOR[setup.kit] * WHEELS_CDA_FACTOR[setup.wheels];
  return { lo: base.lo * f, hi: base.hi * f };
}

export function setupCrr(setup: RaceSetup): number {
  return TIRE_CRR[setup.tires] + (setup.bikeType === 'gravel' ? GRAVEL_CRR_EXTRA : 0);
}

/** Realer Kurs (Wind, Kurven, Verpflegung) gegenüber idealer Physik: +0…5 % Zeit (H). */
export const BIKE_REAL_WORLD: Range = { lo: 1.0, hi: 1.05 };
/** Rad aus Training: Renn-Ø gegenüber Ø der längsten Ausfahrten 1,0…1,12 (H: gleichmäßiger, aero, gesperrte Straßen, Taper). */
export const BIKE_TRAINING_SPEED_FACTOR: Range = { lo: 1.0, hi: 1.12 };
/** Laufen: Ironman-Marathontempo = Schwellenpace × 1,18…1,35 (TRAINING_SCIENCE 2.10, Gehpausen am langsamen Ende). */
export const RUN_THRESHOLD_FACTOR: Range = { lo: 1.18, hi: 1.35 };
/** Laufen aus Marathon-Bestzeit: +20…45 min (TrainingPeaks; Runna 25–45 min). */
export const RUN_MARATHON_ADD_SEC: Range = { lo: 20 * 60, hi: 45 * 60 };
/** Riegel (1981): T2 = T1 · (D2/D1)^1,06. */
export const RIEGEL_EXP = 1.06;
/** Laufen aus Training: Marathontempo = Pace der langen Läufe × 0,98…1,12 (H). */
export const RUN_TRAINING_FACTOR: Range = { lo: 0.98, hi: 1.12 };
/** Wechsel T1 + T2 zusammen (H). */
export const TRANSITIONS_SEC: Range = { lo: 6 * 60, hi: 14 * 60 };
/** 70.3 → Langdistanz: 2 × Zeit × 1,03…1,10 (trirating: Ø 5,35 % langsamer). */
export const HALF_TO_FULL_FACTOR: Range = { lo: 1.03, hi: 1.1 };

/** Trainingsdaten: letzte 8 Wochen. */
export const TRAINING_WINDOW_DAYS = 56;

// ───────────── Hilfen ─────────────

const mid = (r: Range) => (r.lo + r.hi) / 2;
const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const n = s.length;
  return n % 2 ? s[(n - 1) / 2]! : (s[n / 2 - 1]! + s[n / 2]!) / 2;
};
const hm = (sec: number) => {
  const m = Math.round(sec / 60);
  return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')} h`;
};
const pace = (sec: number) => {
  const s = Math.round(sec);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

/**
 * Geschwindigkeit (m/s) bei gegebener Leistung (W) auf konstanter Steigung `grade` (z. B. 0,013),
 * ohne Wind: P·η = ½ρ·CdA·v³ + Crr·m·g·v + m·g·grade·v. Lösung per Bisektion.
 */
export function speedForPower(watts: number, cda: number, massKg: number, grade = 0, crr: number = BIKE_PHYSICS.crr): number {
  const { rho, efficiency } = BIKE_PHYSICS;
  const p = watts * efficiency;
  const f = (v: number) => 0.5 * rho * cda * v ** 3 + crr * massKg * 9.81 * v + massKg * 9.81 * grade * v - p;
  let lo = 0.1;
  let hi = 30;
  if (f(lo) > 0) return lo; // zu steil für die Leistung (nur theoretisch)
  for (let i = 0; i < 80; i++) {
    const m = (lo + hi) / 2;
    if (f(m) > 0) hi = m;
    else lo = m;
  }
  return (lo + hi) / 2;
}

/** Radzeit (s) bei konstanter Leistung; Höhenmeter als je halbe Strecke gleichmäßig bergauf und bergab. */
export function bikeTimeSec(distanceM: number, watts: number, cda: number, massKg: number, elevationM = 0, crr: number = BIKE_PHYSICS.crr): number {
  if (elevationM <= 0) return distanceM / speedForPower(watts, cda, massKg, 0, crr);
  const half = distanceM / 2;
  const grade = elevationM / half;
  return half / speedForPower(watts, cda, massKg, grade, crr) + half / speedForPower(watts, cda, massKg, -grade, crr);
}

function latestMetric(metrics: readonly PerformanceMetric[], kind: PerformanceMetric['kind']) {
  return [...metrics].filter((m) => m.kind === kind).sort((a, b) => (a.date === b.date ? b.createdAt.localeCompare(a.createdAt) : b.date.localeCompare(a.date)))[0];
}

function recent<T extends { date: LocalDate }>(xs: readonly T[], today: LocalDate): T[] {
  return xs.filter((a) => {
    const ago = diffDays(a.date, today);
    return ago >= 0 && ago < TRAINING_WINDOW_DAYS;
  });
}

// ───────────── Teildisziplinen ─────────────

function swimSplit(input: PrognosisInput): SplitEstimate {
  const d100 = input.race.swimM / 100;
  const methods: MethodEstimate[] = [];
  const css = latestMetric(input.metrics, 'swim_css_s_per_100m');
  if (css) {
    methods.push({
      id: 'swim_css',
      basis: 'metric',
      label: 'aus deiner CSS',
      lo: (css.value + SWIM_CSS_OFFSET.lo) * d100,
      hi: (css.value + SWIM_CSS_OFFSET.hi) * d100,
      detail: `CSS ${pace(css.value)} /100 m + ${SWIM_CSS_OFFSET.lo}–${SWIM_CSS_OFFSET.hi} s für Langdistanz und Freiwasser`,
      source: 'Swim Smooth (Tempo je Distanz relativ zur CSS), H',
    });
  }
  const swims = recent(input.activities, input.today).filter((a) => a.sport === 'swim' && a.distanceM && a.distanceM >= 1000 && a.durationSec >= 1200);
  if (swims.length >= 3) {
    const p = median(swims.map((a) => a.durationSec / (a.distanceM! / 100)));
    if (p > 50 && p < 300) {
      methods.push({
        id: 'swim_training',
        basis: 'training',
        label: 'aus deinem Schwimmtraining',
        lo: p * SWIM_TRAINING_FACTOR.lo * d100,
        hi: p * SWIM_TRAINING_FACTOR.hi * d100,
        detail: `Median ${pace(p)} /100 m aus ${swims.length} Einheiten (letzte 8 Wochen, inkl. Pausen)`,
        source: 'H',
      });
    }
  }
  const ws = input.profile?.raceSetup?.wetsuit ?? 'no';
  if (ws !== 'no') {
    const lo = WETSUIT_FACTOR.lo;
    const hi = ws === 'yes' ? WETSUIT_FACTOR.hi : 1;
    for (const m of methods) {
      m.lo *= lo;
      m.hi *= hi;
      m.detail += ws === 'yes' ? '; mit Neo 3–7 % schneller' : '; Neo noch offen: Spanne von mit bis ohne Neo';
    }
  }
  return combine('swim', methods, 'CSS-Test oder mindestens 3 Schwimmeinheiten (≥ 1 km) mit Distanz in den letzten 8 Wochen');
}

function bikeSplit(input: PrognosisInput): SplitEstimate {
  const methods: MethodEstimate[] = [];
  const ftp = latestMetric(input.metrics, 'bike_ftp_w');
  const rider = input.profile?.weightKg ?? BIKE_PHYSICS.defaultRiderKg;
  const mass = rider + BIKE_PHYSICS.bikeAndGearKg;
  const elev = input.settings.bikeElevationM ?? 0;
  const setup = input.profile?.raceSetup;
  if (ftp && setup) {
    const cda = setupCda(setup);
    const crr = setupCrr(setup);
    const fast = bikeTimeSec(input.race.bikeM, ftp.value * BIKE_IF.hi, cda.lo, mass, elev, crr) * BIKE_REAL_WORLD.lo;
    const slow = bikeTimeSec(input.race.bikeM, ftp.value * BIKE_IF.lo, cda.hi, mass, elev, crr) * BIKE_REAL_WORLD.hi;
    methods.push({
      id: 'bike_ftp',
      basis: 'metric',
      label: 'aus deiner FTP',
      lo: fast,
      hi: slow,
      detail:
        `${Math.round(ftp.value * BIKE_IF.lo)}–${Math.round(ftp.value * BIKE_IF.hi)} W (65–75 % von ${Math.round(ftp.value)} W), ` +
        `CdA ${cda.lo.toFixed(3).replace('.', ',')}–${cda.hi.toFixed(3).replace('.', ',')} m², Crr ${crr.toFixed(4).replace('.', ',')}, ${Math.round(mass)} kg mit Rad` +
        (input.profile?.weightKg ? '' : ' (Gewicht angenommen)') +
        (elev > 0 ? `, ${elev} Hm` : ', flach gerechnet'),
      source: 'Leistungsmodell (Luft- und Rollwiderstand); IF-Spanne aus Praxisquellen; CdA/Crr aus deinem Race-Setup (Praxiswerte, H)',
    });
  }
  const rides = recent(input.activities, input.today)
    .filter((a) => a.sport === 'bike' && a.distanceM && a.durationSec >= 5400)
    .map((a) => ({ ...a, v: a.distanceM! / a.durationSec }))
    .filter((a) => a.v * 3.6 >= 18 && a.v * 3.6 <= 45)
    .sort((a, b) => b.durationSec - a.durationSec)
    .slice(0, 3);
  if (rides.length >= 2) {
    const v = rides.reduce((s, a) => s + a.v, 0) / rides.length;
    methods.push({
      id: 'bike_training',
      basis: 'training',
      label: 'aus deinen langen Ausfahrten',
      lo: input.race.bikeM / (v * BIKE_TRAINING_SPEED_FACTOR.hi),
      hi: input.race.bikeM / (v * BIKE_TRAINING_SPEED_FACTOR.lo),
      detail: `Ø ${(v * 3.6).toFixed(1).replace('.', ',')} km/h aus den ${rides.length} längsten Ausfahrten (≥ 1:30 h, letzte 8 Wochen)`,
      source: 'H (Indoor-Fahrten mit virtueller Geschwindigkeit können verzerren)',
    });
  }
  return combine('bike', methods, 'FTP-Test oder mindestens 2 Ausfahrten über 1:30 h mit Distanz in den letzten 8 Wochen');
}

function runSplit(input: PrognosisInput): SplitEstimate {
  const km = input.race.runM / 1000;
  const methods: MethodEstimate[] = [];
  const tp = latestMetric(input.metrics, 'run_threshold_pace_s_per_km');
  if (tp) {
    methods.push({
      id: 'run_threshold',
      basis: 'metric',
      label: 'aus deiner Schwellenpace',
      lo: tp.value * RUN_THRESHOLD_FACTOR.lo * km,
      hi: tp.value * RUN_THRESHOLD_FACTOR.hi * km,
      detail: `Schwellenpace ${pace(tp.value)} /km × 1,18–1,35 → ${pace(tp.value * RUN_THRESHOLD_FACTOR.lo)}–${pace(tp.value * RUN_THRESHOLD_FACTOR.hi)} /km`,
      source: 'Daniels (Marathontempo), Ironman-Zuschlag 20–45 min (Praxis); TRAINING_SCIENCE 2.10',
    });
  }
  const bt = input.profile?.bestTimes;
  const marathonFrom = (sec: number, distKm: number) => sec * (42.195 / distKm) ** RIEGEL_EXP;
  const best = bt?.runMarathon
    ? { m: bt.runMarathon.timeSec, from: 'Marathon', year: bt.runMarathon.year }
    : bt?.runHalf
      ? { m: marathonFrom(bt.runHalf.timeSec, 21.0975), from: 'Halbmarathon (Riegel)', year: bt.runHalf.year }
      : bt?.run10k
        ? { m: marathonFrom(bt.run10k.timeSec, 10), from: '10 km (Riegel)', year: bt.run10k.year }
        : null;
  if (best) {
    const scale = km / 42.195;
    methods.push({
      id: 'run_best',
      basis: 'best',
      label: `aus deiner Bestzeit (${best.from})`,
      lo: (best.m + RUN_MARATHON_ADD_SEC.lo) * scale,
      hi: (best.m + RUN_MARATHON_ADD_SEC.hi) * scale,
      detail: `Marathon-Äquivalent ${hm(best.m)}${best.year ? ` (${best.year})` : ''} + 20–45 min`,
      source: 'TrainingPeaks, Runna (Ironman-Marathon vs. offener Marathon); Riegel 1981',
    });
  }
  const runs = recent(input.activities, input.today).filter((a) => a.sport === 'run' && a.distanceM && a.durationSec >= 4500);
  if (runs.length >= 2) {
    const p = median(runs.map((a) => a.durationSec / (a.distanceM! / 1000)));
    if (p > 180 && p < 600) {
      const longest = Math.max(...runs.map((a) => a.durationSec));
      // ohne Läufe ≥ 2 h ist ein durchgelaufener Marathon unsicher → langsames Ende +5 % (H)
      const extra = longest < 7200 ? 0.05 : 0;
      methods.push({
        id: 'run_training',
        basis: 'training',
        label: 'aus deinen langen Läufen',
        lo: p * RUN_TRAINING_FACTOR.lo * km,
        hi: p * (RUN_TRAINING_FACTOR.hi + extra) * km,
        detail: `Median ${pace(p)} /km aus ${runs.length} Läufen ≥ 1:15 h (letzte 8 Wochen)` + (extra ? ', längster unter 2 h → langsames Ende +5 %' : ''),
        source: 'H',
      });
    }
  }
  if (input.profile?.raceSetup?.runShoes === 'carbon') {
    for (const m of methods) {
      // Bestzeiten sind oft schon in Carbonschuhen gelaufen → dort nur das schnelle Ende verschieben
      m.lo *= CARBON_SHOE_FACTOR.lo;
      if (m.basis !== 'best') m.hi *= CARBON_SHOE_FACTOR.hi;
      m.detail += '; Carbon-Laufschuhe ≈ 1–2 % schneller';
    }
  }
  return combine('run', methods, 'Schwellenpace-Test, Lauf-Bestzeit oder mindestens 2 Läufe über 1:15 h mit Distanz in den letzten 8 Wochen');
}

function combine(split: SplitKey, methods: MethodEstimate[], missing: string): SplitEstimate {
  if (methods.length === 0) return { split, methods, combined: null, missing };
  const lo = methods.reduce((s, m) => s + m.lo, 0) / methods.length;
  const hi = methods.reduce((s, m) => s + m.hi, 0) / methods.length;
  return { split, methods, combined: { lo, hi } };
}

function formulas(input: PrognosisInput): TotalFormula[] {
  const out: TotalFormula[] = [];
  const bt = input.profile?.bestTimes;
  const mar = bt?.runMarathon?.timeSec;
  const oly = bt?.triOlympic?.timeSec;
  if (mar && oly) {
    const m = mar / 60;
    const o = oly / 60;
    if (input.profile?.sex === 'female') {
      const t = (186.3 + 1.595 * o + 1.318 * m) * 60;
      out.push({ id: 'ruest_f', label: 'Formel Freizeit-Triathletinnen', lo: t - 3600, hi: t + 3600, detail: '186,3 + 1,595 × olympisch + 1,318 × Marathon (min); r² = 0,53, n = 28; Spanne ± 1 h (H)', source: 'Rüst et al. 2012 [D7]' });
    } else {
      const t = (152.1 + 1.332 * m + 1.964 * o) * 60;
      out.push({ id: 'ruest_m', label: 'Formel Freizeit-Triathleten', lo: t - 56.8 * 60, hi: t + 56.8 * 60, detail: '152,1 + 1,332 × Marathon + 1,964 × olympisch (min); Standardschätzfehler 56,8 min' + (input.profile?.sex === 'male' ? '' : '; Stichprobe nur Männer'), source: 'Rüst et al. 2011 [D3]' });
    }
  }
  if (bt?.tri703) {
    const t = bt.tri703.timeSec * 2;
    out.push({ id: 'half_double', label: 'aus deiner 70.3-Bestzeit', lo: t * HALF_TO_FULL_FACTOR.lo, hi: t * HALF_TO_FULL_FACTOR.hi, detail: `2 × ${hm(bt.tri703.timeSec)} × 1,03–1,10`, source: 'trirating (Ø 5,35 % Verlangsamung 70.3 → Langdistanz), H' });
  }
  return out;
}

export function isFullDistance(race: Pick<TargetRace, 'bikeM' | 'runM'>): boolean {
  return race.runM >= 30_000 || race.bikeM >= 140_000;
}

export function computePrognosis(input: PrognosisInput): Prognosis {
  const weeks = TRAINING_WINDOW_DAYS / 7;
  const recentActs = recent(input.activities, input.today);
  const trainingWeeklySec = recentActs.length ? recentActs.reduce((s, a) => s + a.durationSec, 0) / weeks : null;
  if (!isFullDistance(input.race)) {
    return { supported: false, needsSetup: false, splits: [], total: null, formulas: [], trainingWeeklySec, notes: ['Die Prognose ist bisher nur für die Langdistanz kalibriert.'] };
  }
  if (!input.profile?.raceSetup) {
    return {
      supported: true,
      needsSetup: true,
      splits: [],
      total: null,
      formulas: [],
      trainingWeeklySec,
      notes: ['Für eine Prognose bitte im Profil dein Race-Setup hinterlegen (Rad, Aufleger, Laufräder, Reifen, Kleidung/Helm, Laufschuhe, Neo).'],
    };
  }
  const transitions: SplitEstimate = {
    split: 'transitions',
    methods: [{ id: 'transitions', basis: 'assumption', label: 'Annahme', ...TRANSITIONS_SEC, detail: 'Wechsel T1 + T2 zusammen 6–14 min', source: 'H' }],
    combined: { ...TRANSITIONS_SEC },
  };
  const splits = [swimSplit(input), bikeSplit(input), runSplit(input), transitions];
  const complete = splits.every((s) => s.combined);
  const total = complete
    ? (() => {
        const lo = splits.reduce((s, x) => s + x.combined!.lo, 0);
        const hi = splits.reduce((s, x) => s + x.combined!.hi, 0);
        return { lo, hi, mid: splits.reduce((s, x) => s + mid(x.combined!), 0) };
      })()
    : null;
  const notes = [
    'Stand heute: Die Prognose rechnet mit deinen aktuellen Werten, nicht mit Fortschritten bis zum Rennen.',
    'Hitze, Wind, Kurs und Tagesform können die Zeit deutlich verschieben; die Spanne ist bewusst breit.',
  ];
  return { supported: true, needsSetup: false, splits, total, formulas: formulas(input), trainingWeeklySec, notes };
}

/** Auf 5 Minuten gerundet (Anzeige). */
export function round5(sec: number): number {
  return Math.round(sec / 300) * 300;
}

// ───────────── Verlauf und Szenarien (M4.4) ─────────────

export interface PrognosisPoint {
  date: LocalDate;
  total: (Range & { mid: number }) | null;
}

/**
 * Prognose rückwirkend zu früheren Stichtagen: nur Werte und Einheiten, die es an dem Tag schon gab.
 * Deterministisch, nichts wird gespeichert.
 */
export function prognosisHistory(input: PrognosisInput, dates: readonly LocalDate[]): PrognosisPoint[] {
  return dates.map((date) => {
    const p = computePrognosis({
      ...input,
      today: date,
      metrics: input.metrics.filter((m) => m.date <= date),
      activities: input.activities.filter((a) => a.date <= date),
    });
    return { date, total: p.total };
  });
}

/** Stichtage alle 2 Wochen rückwärts ab heute, höchstens `max`, nicht vor `from`. */
export function historyDates(today: LocalDate, from: LocalDate, max = 12): LocalDate[] {
  const out: LocalDate[] = [];
  for (let i = 0; i < max; i++) {
    const d = addDaysLocal(today, -14 * i);
    if (d < from) break;
    out.unshift(d);
  }
  return out;
}

function addDaysLocal(d: LocalDate, n: number): LocalDate {
  const t = Date.UTC(Number(d.slice(0, 4)), Number(d.slice(5, 7)) - 1, Number(d.slice(8, 10))) + n * 86400000;
  return new Date(t).toISOString().slice(0, 10) as LocalDate;
}

export interface Scenario {
  /** FTP-Änderung in Watt */
  ftpW?: number;
  /** Schwellenpace-Änderung in s/km (negativ = schneller) */
  runPaceSec?: number;
  /** CSS-Änderung in s/100 m (negativ = schneller) */
  cssSec?: number;
}

/** „Was wäre wenn“: verändert die jeweils aktuellen Leistungswerte (fehlt ein Wert, bleibt die Disziplin unverändert). */
export function scenarioMetrics(metrics: readonly PerformanceMetric[], s: Scenario, today: LocalDate): PerformanceMetric[] {
  const out = [...metrics];
  const bump = (kind: PerformanceMetric['kind'], delta: number | undefined) => {
    if (!delta) return;
    const last = latestMetric(metrics, kind);
    if (!last) return;
    out.push({ ...last, id: `${last.id}-szenario`, value: Math.max(1, last.value + delta), date: today > last.date ? today : last.date, createdAt: '9999-12-31T00:00:00.000Z' });
  };
  bump('bike_ftp_w', s.ftpW);
  bump('run_threshold_pace_s_per_km', s.runPaceSec);
  bump('swim_css_s_per_100m', s.cssSec);
  return out;
}
