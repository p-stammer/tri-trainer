/**
 * Schnittstellen des Plangenerators (docs/PLAN_MODEL.md). Reine Datentypen – die Engine ist eine reine Funktion
 * `generatePlan(input: PlanGeneratorInput): GeneratorResult` und läuft auch im Web Worker.
 */
import type { PrognosisSettings } from '../domain/prognosis';
import type { TrainingCamp } from '../domain/schemas';
import type { LocalDate } from '../domain/calendar';
import type {
  AthleteProfile,
  CompletedActivity,
  GeneratorSettings,
  PainIssue,
  PainObservation,
  PerformanceMetric,
  PrepRace,
  TargetRace,
  TrainingPause,
  WeekTargets,
  WeeklyWellnessCheckin,
} from '../domain/schemas';
import type { EnduranceSport, PhaseType, PlannedSport } from '../domain/sports';
import type { PhilosophyParams } from './params';

// ───────── Eingabe ─────────

export interface PlanGeneratorInput {
  /** Heutiger lokaler Tag (Europe/Berlin). */
  today: LocalDate;
  race: TargetRace;
  /** Erste zu planende Woche (Montag). Frühere Planwochen bleiben unverändert. */
  firstWeek: LocalDate;
  /** Alle Wochenanfänge des Plans bis einschließlich Wettkampfwoche. */
  planWeeks: readonly LocalDate[];
  profile: AthleteProfile | null;
  settings: GeneratorSettings;
  prepRaces: readonly PrepRace[];
  /** Trainingslager des Plans (seit 1.8.0). */
  camps?: readonly TrainingCamp[];
  metrics: readonly PerformanceMetric[];
  /** Erfasste Einheiten (mindestens die letzten 8 Wochen vor `firstWeek`). */
  history: readonly CompletedActivity[];
  /** Annahmen der Zielzeit-Prognose (Rad-Typ, Höhenmeter) – für die Gewichtung aus Teilzeiten (seit 1.7.0). */
  prognosisSettings?: PrognosisSettings;
  wellness: readonly WeeklyWellnessCheckin[];
  pauses: readonly TrainingPause[];
  painIssues: readonly PainIssue[];
  painObservations: readonly PainObservation[];
}

// ───────── Modul A ─────────

export type DataQuality = 'high' | 'medium' | 'low';

/** Ausgangsumfang einer Sportart je Woche. Fehlende Größen bleiben undefined – nichts wird geschätzt. */
export interface SportBaseline {
  sport: PlannedSport;
  durationSec?: number;
  distanceM?: number;
  sessions?: number;
  /** Längste Einheit der letzten 30 Tage (Laufen/Rad). */
  longestSec?: number;
  longestM?: number;
  source: 'profile' | 'history' | 'none';
  quality: DataQuality;
  /** Ausgangsumfang lag unter dem Einstiegsumfang (W9); geplant wird ab `entrySec`. */
  entry?: boolean;
}

export interface Baseline {
  bySport: Partial<Record<PlannedSport, SportBaseline>>;
  /** Zeitbudget pro Woche in Sekunden (harte Obergrenze, R20). */
  budgetSec: number;
  /** Alter in Jahren (für die Altersanpassung), falls bekannt. */
  age?: number;
}

export interface NeedsInput {
  code: 'budget' | 'baseline' | 'longest_run' | 'race_in_past' | 'no_weeks';
  sport?: PlannedSport;
  message: string;
}

// ───────── Modul B / C ─────────

export interface DisciplineAssessment {
  sport: EnduranceSport;
  /** Anteil am eigenen Ausgangsumfang (Dauer) vs. Grundgewicht (Rennzeitanteil). */
  volumeShare?: number;
  raceShare: number;
  /** Leistungswerte dieser Disziplin mit Alter in Wochen; kein Vergleich zwischen Disziplinen. */
  metrics: { kind: PerformanceMetric['kind']; value: number; ageWeeks: number; stale: boolean }[];
  quality: DataQuality;
  findings: string[];
  /** Veränderung zum Vortest (positiv = besser), nur wenn beide Tests ≤ 16 Wochen alt und ≥ 3 Wochen auseinander (seit 1.7.0). */
  trend?: { change: number; weeksApart: number };
  /** Anteil an der prognostizierten Zeit (Schwimmen + Rad + Laufen) und typischer Anteil [D2] (seit 1.7.0). */
  predictedShare?: number;
  referenceShare?: number;
}

export type PriorityMode = 'auto' | 'hybrid' | 'manual';

/** Getrennte Speicherung von vorgeschlagener, gewünschter und verwendeter Priorität (Anforderung 21). */
export interface AppliedPriority {
  sport: EnduranceSport;
  suggested: number;
  user?: number;
  applied: number;
  mode: PriorityMode;
  reason: string;
  /** Einzelne Gründe des Vorschlags (seit 1.7.0) */
  factors?: string[];
}

// ───────── Modul D ─────────

export type WeekKind = 'loading' | 'recovery' | 'taper' | 'prep_race' | 'post_race' | 'camp' | 'post_camp';

export interface WeekFrame {
  weekStart: LocalDate;
  index: number;
  phase: PhaseType;
  kind: WeekKind;
  /** Faktor auf den Umfang der letzten Belastungswoche (Entlastung, Taper, Rennen). 1 = normal. */
  factor: number;
  /** Anteil nicht pausierter Tage je Sportart (Pausen, 0…1). */
  availability: Record<PlannedSport, number>;
  /** Keine Steigerung (Beschwerde, niedrige Frische). */
  freeze: PlannedSport[];
  prepRaceIds: string[];
  /** Trainingslager in dieser Woche (seit 1.8.0): Tage im Camp und verfügbare Stunden pro Camp-Tag. */
  camp?: { id: string; name: string; days: number; hoursPerDay: number };
  reasons: string[];
}

// ───────── Ausgabe ─────────

export interface Explanation {
  /** Betroffene Woche oder ganzer Plan. */
  weekStart?: LocalDate;
  sport?: PlannedSport;
  text: string;
  /** Regeln aus TRAINING_SCIENCE.md, z. B. ['R0', 'R5']. */
  rules: string[];
  /** Eingaben, auf die sich die Aussage stützt, z. B. ['profile.baseline.run', 'settings.philosophy']. */
  inputs: string[];
}

export type WarningCode = 'W1' | 'W2' | 'W3' | 'W4' | 'W5' | 'W6' | 'W7' | 'W8' | 'W9' | 'W10' | 'W11' | 'W12';

export interface Warning {
  code: WarningCode;
  severity: 'info' | 'caution' | 'important';
  weekStart?: LocalDate;
  sport?: PlannedSport;
  text: string;
}

export interface Uncertainty {
  topic: string;
  text: string;
}

export interface ProposedWeek {
  weekStart: LocalDate;
  kind: WeekKind;
  phase: PhaseType;
  /** Kurze Gründe für diese Woche (Entlastung, Rennen, Pause, Kürzungen). */
  reasons: string[];
  targets: WeekTargets;
  /** Längste geplante Einheit (für R6/H2 und die Anzeige). */
  longRun?: { durationSec?: number; distanceM?: number };
  longRide?: { durationSec?: number };
}

/** Verletzung einer harten Grenze in der zweiten Prüfung (Modul H). Muss immer leer sein. */
export interface Violation {
  rule: 'H1' | 'H2' | 'H3' | 'H4' | 'H5' | 'H6' | 'H7' | 'H10';
  weekStart: LocalDate;
  sport?: PlannedSport;
  detail: string;
}

export interface PlanProposal {
  modelVersion: string;
  firstWeek: LocalDate;
  params: PhilosophyParams;
  baseline: Baseline;
  weeks: ProposedWeek[];
  assessments: DisciplineAssessment[];
  priorities: AppliedPriority[];
  rationale: Explanation[];
  warnings: Warning[];
  uncertainties: Uncertainty[];
  violations: Violation[];
}

export type GeneratorResult = { ok: true; proposal: PlanProposal } | { ok: false; needs: NeedsInput[] };
