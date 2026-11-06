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
  in_progress: 'En proceso',
  completed: 'Completada',
  reviewed: 'Revisada',
};

export const ASSIGNMENT_ORDER: AssignmentStatus[] = ['pending', 'in_progress', 'completed', 'reviewed'];

export function nextStatus(s: AssignmentStatus): AssignmentStatus {
  return ASSIGNMENT_ORDER[(ASSIGNMENT_ORDER.indexOf(s) + 1) % ASSIGNMENT_ORDER.length];
}

export function isDone(s: AssignmentStatus): boolean {
  return s === 'completed' || s === 'reviewed';
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
