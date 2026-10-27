// Modelo de datos de DRAXIVO. Todas las cargas y pesos se guardan en kilogramos
// y las longitudes en centímetros; la conversión a otras unidades es sólo visual.

export type ID = string;

export type MuscleGroup =
  | 'pecho'
  | 'espalda'
  | 'hombros'
  | 'biceps'
  | 'triceps'
  | 'antebrazos'
  | 'cuadriceps'
  | 'isquios'
  | 'gluteos'
  | 'gemelos'
  | 'abdominales'
  | 'cuerpo_completo'
  | 'cardio'
  | 'movilidad';

export type Equipment =
  | 'barra'
  | 'mancuernas'
  | 'maquina'
  | 'polea'
  | 'peso_corporal'
  | 'banda'
  | 'otros';

export type MovementType = 'compuesto' | 'aislamiento' | 'cardio' | 'movilidad';

/**
 * Determina qué datos se registran en cada serie y qué fórmulas son válidas.
 * - weight_reps: carga externa × repeticiones (admite volumen y 1RM).
 * - weighted_bodyweight: peso corporal + lastre (volumen y 1RM sobre el lastre).
 * - assisted_bodyweight: peso corporal con asistencia (se registra la asistencia).
 * - bodyweight_reps: sólo repeticiones.
 * - duration: sólo tiempo.
 * - distance_duration: distancia y tiempo.
 */
export type TrackingType =
  | 'weight_reps'
  | 'weighted_bodyweight'
  | 'assisted_bodyweight'
  | 'bodyweight_reps'
  | 'duration'
  | 'distance_duration';

export interface Exercise {
  id: ID;
  name: string;
  primaryMuscle: MuscleGroup;
  secondaryMuscles: MuscleGroup[];
  equipment: Equipment;
  movement: MovementType;
  tracking: TrackingType;
  instructions: string;
  notes: string;
  custom: boolean;
  archived: boolean;
  createdAt: number;
  updatedAt: number;
}

export type SetType = 'normal' | 'warmup' | 'drop' | 'failure';
export type EffortMetric = 'none' | 'rpe' | 'rir';

export interface PlannedSet {
  id: ID;
  type: SetType;
  repsMin: number | null;
  repsMax: number | null;
  weight: number | null;
  rpe: number | null;
  rir: number | null;
  durationSec: number | null;
  distanceM: number | null;
}

export interface RoutineExercise {
  id: ID;
  exerciseId: ID;
  sets: PlannedSet[];
  restSec: number | null;
  notes: string;
  supersetId: string | null;
  effort: EffortMetric;
}

export interface Folder {
  id: ID;
  name: string;
  order: number;
  createdAt: number;
  updatedAt: number;
}

export interface Routine {
  id: ID;
  name: string;
  description: string;
  goal: string;
  category: string;
  folderId: ID | null;
  exercises: RoutineExercise[];
  estimatedMin: number | null;
  notes: string;
  archived: boolean;
  isTemplate: boolean;
  variantOf: ID | null;
  order: number;
  createdAt: number;
  updatedAt: number;
}

export interface WorkoutSet {
  id: ID;
  type: SetType;
  weight: number | null;
  reps: number | null;
  rpe: number | null;
  rir: number | null;
  durationSec: number | null;
  distanceM: number | null;
  completed: boolean;
  completedAt: number | null;
  /** Objetivo heredado de la rutina, sólo como referencia visual. */
  target?: { repsMin: number | null; repsMax: number | null; weight: number | null } | null;
}

export interface WorkoutExercise {
  id: ID;
  exerciseId: ID;
  /** Instantáneas para que el historial siga siendo legible si se borra el ejercicio. */
  name: string;
  tracking: TrackingType;
  primaryMuscle: MuscleGroup;
  restSec: number | null;
  notes: string;
  supersetId: string | null;
  effort: EffortMetric;
  sets: WorkoutSet[];
}

export interface RestTimer {
  /** Momento real (ms) en que termina, si está corriendo. */
  endsAt: number | null;
  durationSec: number;
  /** Milisegundos restantes cuando está en pausa. */
  pausedRemainingMs: number | null;
  label: string;
}

export interface Workout {
  id: ID;
  routineId: ID | null;
  routineName: string | null;
  name: string;
  status: 'active' | 'completed';
  startedAt: number;
  endedAt: number | null;
  pausedAt: number | null;
  pausedTotalMs: number;
  /** Fecha local (YYYY-MM-DD) del entrenamiento, para agrupar por día/semana. */
  date: string;
  exercises: WorkoutExercise[];
  notes: string;
  rest: RestTimer | null;
  planEntryId: ID | null;
  createdAt: number;
  updatedAt: number;
}

export interface BodyWeight {
  id: ID;
  date: string;
  time: string | null;
  weightKg: number;
  note: string;
  createdAt: number;
  updatedAt: number;
}

export type MeasurementType =
  | 'cintura'
  | 'cadera'
  | 'pecho'
  | 'brazo'
  | 'antebrazo'
  | 'muslo'
  | 'gemelo'
  | 'cuello'
  | 'grasa';

export interface Measurement {
  id: ID;
  date: string;
  type: MeasurementType;
  /** cm, o % para grasa corporal. */
  value: number;
  unit: 'cm' | '%';
  note: string;
  createdAt: number;
  updatedAt: number;
}

export interface ProgressPhoto {
  id: ID;
  date: string;
  pose: 'frente' | 'lado' | 'espalda' | 'otra';
  blob: Blob;
  mime: string;
  note: string;
  createdAt: number;
  updatedAt: number;
}

export interface PlanEntry {
  id: ID;
  date: string;
  kind: 'routine' | 'rest';
  routineId: ID | null;
  note: string;
  createdAt: number;
  updatedAt: number;
}

export interface WeekGoal {
  /** Lunes de la semana (YYYY-MM-DD). */
  weekStart: string;
  sessions: number;
  updatedAt: number;
}

export interface ReviewMetrics {
  weekStart: string;
  weekEnd: string;
  plannedSessions: number | null;
  goalSessions: number;
  completedSessions: number;
  totalMinutes: number;
  sets: number;
  reps: number;
  volumeKg: number;
  muscleSets: Partial<Record<MuscleGroup, number>>;
  prs: { exercise: string; label: string; value: string }[];
  weightStart: number | null;
  weightEnd: number | null;
  weightEntries: number;
  weightAvg: number | null;
  prevWeightAvg: number | null;
  firstWeight: number | null;
  measurements: { type: MeasurementType; first: number | null; last: number | null; unit: string }[];
  prevCompletedSessions: number;
  prevVolumeKg: number;
}

export interface ReviewAnswers {
  week: number | null;
  energy: number | null;
  recovery: number | null;
  sleep: number | null;
  discomfort: string;
  bestThing: string;
  improve: string;
}

export interface ReviewConclusions {
  achievements: string[];
  evolution: string[];
  attention: string[];
  compliance: string;
}

export interface WeeklyReview {
  id: ID;
  weekStart: string;
  weekEnd: string;
  status: 'draft' | 'completed';
  metrics: ReviewMetrics;
  answers: ReviewAnswers;
  conclusions: ReviewConclusions;
  nextGoalSessions: number | null;
  nextGoalText: string;
  createdAt: number;
  updatedAt: number;
}

export type Theme = 'auto' | 'light' | 'dark';

export interface Settings {
  id: 'settings';
  name: string;
  goal: string;
  experience: 'principiante' | 'intermedio' | 'avanzado' | '';
  weightUnit: 'kg' | 'lb';
  lengthUnit: 'cm' | 'in';
  trainingDays: number[];
  weeklyGoal: number;
  reviewEnabled: boolean;
  /** 0 = lunes … 6 = domingo */
  reviewDay: number;
  defaultRestSec: number;
  autoStartRest: boolean;
  restSound: boolean;
  restVibration: boolean;
  theme: Theme;
  timezone: string;
  weightGoalType: 'perder' | 'ganar' | 'mantener' | null;
  weightGoalKg: number | null;
  onboarded: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface MetaEntry {
  key: string;
  value: unknown;
}
