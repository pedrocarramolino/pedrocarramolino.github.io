// Catálogo completo de ejercicios de la biblioteca y utilidades de consulta.
import type { Exercise, MuscleGroup } from '../../db/types';
import { BICEPS, FOREARMS, TRICEPS } from './arms';
import { CARDIO, CORE, FULL_BODY, MOBILITY } from './core';
import { CALVES, GLUTES, HAMSTRINGS, QUADS } from './legs';
import { PATTERN_GUIDE } from './patterns';
import { BACK, CHEST, SHOULDERS } from './upper';
import type { CatalogEntry, Level } from './types';

export type { CatalogEntry, Level, Pattern, Role } from './types';
export { PATTERN_LABEL } from './patterns';

export const CATALOG: CatalogEntry[] = [...CHEST, ...BACK, ...SHOULDERS, ...BICEPS, ...TRICEPS, ...FOREARMS, ...QUADS, ...HAMSTRINGS, ...GLUTES, ...CALVES, ...CORE, ...FULL_BODY, ...CARDIO, ...MOBILITY];

const BY_ID = new Map(CATALOG.map((e) => [e.id, e]));

/** Entrada del catálogo para un ejercicio (null en ejercicios personalizados). */
export function catalogEntry(ex: Pick<Exercise, 'id'> | string): CatalogEntry | null {
  const id = (typeof ex === 'string' ? ex : ex.id).replace(/^ex-/, '');
  return BY_ID.get(id) ?? null;
}

export const LEVELS: Record<Level, string> = { principiante: 'Principiante', intermedio: 'Intermedio', avanzado: 'Avanzado' };

/** Grupos para filtrar: «Piernas» reúne cuádriceps e isquiotibiales. */
export const FILTER_GROUPS: { value: string; label: string; muscles: MuscleGroup[] }[] = [
  { value: 'pecho', label: 'Pecho', muscles: ['pecho'] },
  { value: 'espalda', label: 'Espalda', muscles: ['espalda'] },
  { value: 'hombros', label: 'Hombros', muscles: ['hombros'] },
  { value: 'biceps', label: 'Bíceps', muscles: ['biceps'] },
  { value: 'triceps', label: 'Tríceps', muscles: ['triceps'] },
  { value: 'piernas', label: 'Piernas', muscles: ['cuadriceps', 'isquios'] },
  { value: 'cuadriceps', label: 'Cuádriceps', muscles: ['cuadriceps'] },
  { value: 'isquios', label: 'Isquiotibiales', muscles: ['isquios'] },
  { value: 'gluteos', label: 'Glúteos', muscles: ['gluteos'] },
  { value: 'abdominales', label: 'Core y abdomen', muscles: ['abdominales'] },
  { value: 'gemelos', label: 'Gemelos', muscles: ['gemelos'] },
  { value: 'antebrazos', label: 'Antebrazos', muscles: ['antebrazos'] },
  { value: 'cuerpo_completo', label: 'Cuerpo completo', muscles: ['cuerpo_completo'] },
  { value: 'cardio', label: 'Cardio', muscles: ['cardio'] },
  { value: 'movilidad', label: 'Movilidad', muscles: ['movilidad'] },
];

/** Nivel de un ejercicio: el del catálogo o, en personalizados, el que se deduce del movimiento. */
export function levelOf(ex: Pick<Exercise, 'id' | 'movement'>): Level {
  return catalogEntry(ex)?.level ?? 'principiante';
}

/** Guía completa: pasos, consejos y errores (propios + los del patrón). */
export function guideFor(ex: Pick<Exercise, 'id'>) {
  const e = catalogEntry(ex);
  if (!e) return null;
  const p = PATTERN_GUIDE[e.pattern];
  return { entry: e, steps: e.steps, tips: [...e.tips, ...p.tips], mistakes: [...e.mistakes, ...p.mistakes] };
}

/**
 * Variantes y sustituciones equivalentes: primero las explícitas, después las del mismo patrón
 * (con otro material antes que el mismo) y, si faltan, del mismo músculo y tipo de movimiento.
 */
export function alternativesFor<E extends Pick<Exercise, 'id' | 'primaryMuscle' | 'movement' | 'equipment' | 'archived'>>(ex: E, all: E[], limit = 6): E[] {
  const me = catalogEntry(ex);
  const byId = new Map(all.map((a) => [a.id, a]));
  const out: E[] = [];
  const push = (a: E | undefined) => {
    if (a && a.id !== ex.id && !a.archived && !out.includes(a)) out.push(a);
  };
  for (const id of me?.alt ?? []) push(byId.get(`ex-${id}`));
  if (me) {
    const same = all.filter((a) => catalogEntry(a)?.pattern === me.pattern && a.primaryMuscle === ex.primaryMuscle);
    same.sort((a, b) => Number(a.equipment === ex.equipment) - Number(b.equipment === ex.equipment));
    same.forEach(push);
    all.filter((a) => catalogEntry(a)?.pattern === me.pattern).forEach(push);
  }
  all.filter((a) => a.primaryMuscle === ex.primaryMuscle && a.movement === ex.movement).forEach(push);
  return out.slice(0, limit);
}

/** Texto de búsqueda normalizado: nombre, alias, músculos y material. */
export function searchText(ex: Pick<Exercise, 'id' | 'name'>): string {
  const e = catalogEntry(ex);
  return [ex.name, ...(e?.aka ?? [])].join(' ');
}
