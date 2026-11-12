import type { AssignmentStatus, GoalStatus, LessonStatus, NoteKind, StudentStatus, TaskPriority } from './types';

export const STUDENT_STATUS: Record<StudentStatus, string> = {
  active: 'Activo',
  inactive: 'Inactivo',
  archived: 'Archivado',
};

export const LESSON_STATUS: Record<LessonStatus, string> = {
  scheduled: 'Programada',
  completed: 'Realizada',
  cancelled: 'Cancelada',
};

export const ASSIGNMENT_STATUS: Record<AssignmentStatus, string> = {
  pending: 'Pendiente',
  completed: 'Completa',
  not_completed: 'No completada',
};

/** Orden cíclico al pulsar el estado: Pendiente → Completa → No completada → Pendiente. */
export const ASSIGNMENT_ORDER: AssignmentStatus[] = ['pending', 'completed', 'not_completed'];

export function nextStatus(s: AssignmentStatus): AssignmentStatus {
  return ASSIGNMENT_ORDER[(ASSIGNMENT_ORDER.indexOf(s) + 1) % ASSIGNMENT_ORDER.length];
}

export function isDone(s: AssignmentStatus): boolean {
  return s === 'completed';
}

/** Aún por hacer (las no completadas pasan a la semana siguiente como pendientes). */
export function isPending(s: AssignmentStatus): boolean {
  return s === 'pending';
}

/**
 * Estados guardados con el sistema anterior: «En proceso» cuenta como
 * pendiente y «Revisada» como completa.
 */
export function normalizeStatus(s: unknown): AssignmentStatus {
  if (s === 'completed' || s === 'reviewed') return 'completed';
  if (s === 'not_completed') return 'not_completed';
  return 'pending';
}

export const PRIORITY: Record<TaskPriority, string> = {
  low: 'Baja',
  normal: 'Normal',
  high: 'Alta',
};

export const NOTE_KIND: Record<NoteKind, string> = {
  observation: 'Observación',
  achievement: 'Logro',
  difficulty: 'Dificultad',
  improvement: 'A mejorar',
};

export const GOAL_STATUS: Record<GoalStatus, string> = {
  active: 'En curso',
  achieved: 'Conseguido',
  dropped: 'Descartado',
};

export const LESSON_TYPES = ['Individual', 'Colectiva', 'Audición', 'Ensayo', 'Recuperación', 'Prueba'] as const;

export const LEVELS = [
  'Iniciación',
  'Elemental 1',
  'Elemental 2',
  'Elemental 3',
  'Elemental 4',
  'Profesional 1',
  'Profesional 2',
  'Profesional 3',
  'Profesional 4',
  'Profesional 5',
  'Profesional 6',
  'Superior',
  'Adulto',
] as const;
