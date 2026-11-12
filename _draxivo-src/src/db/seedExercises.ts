import type { Exercise } from './types';
import { CATALOG } from '../data/catalog';

/**
 * Versión de la biblioteca inicial. Al aumentarla se añaden los ejercicios nuevos sin duplicar
 * y sin tocar los existentes (salvo las migraciones explícitas de `ensureLibrary`).
 * 3: biblioteca ampliada (224 ejercicios) y material «kettlebell».
 */
export const LIBRARY_VERSION = 3;

/** Ejercicios de la biblioteca que en versiones anteriores tenían el material «otros». */
export const KETTLEBELL_MIGRATION = ['ex-kettlebell-swing', 'ex-turkish-getup'];

export function seedExercises(now = Date.now()): Exercise[] {
  return CATALOG.map((e) => ({
    id: `ex-${e.id}`,
    name: e.name,
    primaryMuscle: e.primary,
    secondaryMuscles: e.secondary,
    equipment: e.equipment,
    movement: e.movement,
    tracking: e.tracking,
    instructions: e.steps.join(' '),
    notes: '',
    custom: false,
    archived: false,
    createdAt: now,
    updatedAt: now,
  }));
}
