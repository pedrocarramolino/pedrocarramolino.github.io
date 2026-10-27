import type { Equipment, MeasurementType, MovementType, MuscleGroup, SetType, TrackingType } from '../db/types';

export const MUSCLES: Record<MuscleGroup, string> = {
  pecho: 'Pecho',
  espalda: 'Espalda',
  hombros: 'Hombros',
  biceps: 'Bíceps',
  triceps: 'Tríceps',
  antebrazos: 'Antebrazos',
  cuadriceps: 'Cuádriceps',
  isquios: 'Isquiotibiales',
  gluteos: 'Glúteos',
  gemelos: 'Gemelos',
  abdominales: 'Abdominales',
  cuerpo_completo: 'Cuerpo completo',
  cardio: 'Cardio',
  movilidad: 'Movilidad',
};

export const EQUIPMENT: Record<Equipment, string> = {
  barra: 'Barra',
  mancuernas: 'Mancuernas',
  maquina: 'Máquinas',
  polea: 'Poleas',
  peso_corporal: 'Peso corporal',
  banda: 'Bandas elásticas',
  otros: 'Otros',
};

export const MOVEMENTS: Record<MovementType, string> = {
  compuesto: 'Compuesto',
  aislamiento: 'Aislamiento',
  cardio: 'Cardio',
  movilidad: 'Movilidad',
};

export const TRACKING: Record<TrackingType, string> = {
  weight_reps: 'Peso y repeticiones',
  weighted_bodyweight: 'Peso corporal + lastre',
  assisted_bodyweight: 'Peso corporal asistido',
  bodyweight_reps: 'Sólo repeticiones',
  duration: 'Duración',
  distance_duration: 'Distancia y duración',
};

export const SET_TYPES: Record<SetType, { label: string; short: string }> = {
  normal: { label: 'Normal', short: '' },
  warmup: { label: 'Calentamiento', short: 'C' },
  drop: { label: 'Descendente', short: 'D' },
  failure: { label: 'Al fallo', short: 'F' },
};

export const MEASUREMENTS: Record<MeasurementType, string> = {
  cintura: 'Cintura',
  cadera: 'Cadera',
  pecho: 'Pecho',
  brazo: 'Brazo',
  antebrazo: 'Antebrazo',
  muslo: 'Muslo',
  gemelo: 'Gemelo',
  cuello: 'Cuello',
  grasa: 'Grasa corporal',
};

export const GOALS = ['Fuerza', 'Hipertrofia', 'Pérdida de grasa', 'Salud general', 'Rendimiento', 'Resistencia'];
export const CATEGORIES = ['Fuerza', 'Hipertrofia', 'Cuerpo completo', 'Torso', 'Pierna', 'Empuje', 'Tirón', 'Cardio', 'Movilidad', 'Otra'];

export function usesWeight(t: TrackingType) {
  return t === 'weight_reps' || t === 'weighted_bodyweight' || t === 'assisted_bodyweight';
}
export function usesReps(t: TrackingType) {
  return t !== 'duration' && t !== 'distance_duration';
}
export function usesDuration(t: TrackingType) {
  return t === 'duration' || t === 'distance_duration';
}
export function usesDistance(t: TrackingType) {
  return t === 'distance_duration';
}
/** Sólo los ejercicios con carga externa admiten volumen (kg) y estimación de 1RM. */
export function supportsLoadMetrics(t: TrackingType) {
  return t === 'weight_reps' || t === 'weighted_bodyweight';
}
export function weightColumnLabel(t: TrackingType) {
  if (t === 'weighted_bodyweight') return '+ Lastre';
  if (t === 'assisted_bodyweight') return '− Asist.';
  return 'Peso';
}
