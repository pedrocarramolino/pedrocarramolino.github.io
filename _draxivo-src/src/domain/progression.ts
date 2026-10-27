// Sugerencias de progresión transparentes. Nunca modifican cargas por sí mismas.
import type { Equipment, Routine, RoutineExercise, Workout, WorkoutSet } from '../db/types';
import { lastPerformance } from './metrics';

export interface Suggestion {
  key: string;
  routineExerciseId: string;
  exerciseId: string;
  kind: 'increase' | 'hold';
  currentWeight: number;
  suggestedWeight: number | null;
  reasons: string[];
  workoutId: string;
}

export function weightIncrement(equipment: Equipment | undefined): number {
  switch (equipment) {
    case 'mancuernas':
      return 2;
    case 'barra':
      return 2.5;
    case 'maquina':
    case 'polea':
      return 2.5;
    default:
      return 1;
  }
}

function effortOk(s: WorkoutSet): { ok: boolean; note: string | null } {
  if (s.rpe != null) return { ok: s.rpe <= 8.5, note: `RPE ${s.rpe}` };
  if (s.rir != null) return { ok: s.rir >= 1.5, note: `RIR ${s.rir}` };
  return { ok: true, note: null };
}

/**
 * Sugiere valorar un incremento cuando, en la última sesión, todas las series de trabajo
 * se completaron con la misma carga alcanzando el máximo del rango objetivo y con un
 * esfuerzo registrado no máximo. Si faltan datos no se sugiere nada.
 */
export function suggestForExercise(
  re: RoutineExercise,
  workouts: Workout[],
  equipment: Equipment | undefined,
): Suggestion | null {
  const working = re.sets.filter((s) => s.type === 'normal');
  if (!working.length) return null;
  const repsMax = Math.min(...working.map((s) => s.repsMax ?? Infinity));
  const repsMin = Math.min(...working.map((s) => s.repsMin ?? Infinity));
  if (!Number.isFinite(repsMax)) return null;
  const last = lastPerformance(workouts, re.exerciseId);
  if (!last) return null;
  const tracking = last.workout.exercises.find((e) => e.exerciseId === re.exerciseId)?.tracking;
  if (tracking !== 'weight_reps' && tracking !== 'weighted_bodyweight') return null;
  const sets = last.sets.filter((s) => s.completed && s.type === 'normal');
  if (sets.length < working.length) return null;
  const weights = new Set(sets.map((s) => s.weight ?? 0));
  if (weights.size !== 1) return null;
  const weight = sets[0].weight ?? 0;
  if (weight <= 0) return null;
  const reps = sets.map((s) => s.reps ?? 0);
  const efforts = sets.map(effortOk);
  const effortNotes = efforts.map((e) => e.note).filter(Boolean) as string[];
  const allTop = reps.every((r) => r >= repsMax);
  const key = `${re.exerciseId}:${last.workout.id}`;
  const base = {
    key,
    routineExerciseId: re.id,
    exerciseId: re.exerciseId,
    currentWeight: weight,
    workoutId: last.workout.id,
  };
  if (allTop && efforts.every((e) => e.ok)) {
    const inc = weightIncrement(equipment);
    return {
      ...base,
      kind: 'increase',
      suggestedWeight: Math.round((weight + inc) * 100) / 100,
      reasons: [
        `En la última sesión completaste ${sets.length} series con ${weight} kg.`,
        `Repeticiones: ${reps.join(', ')} (rango objetivo ${Number.isFinite(repsMin) ? repsMin : '?'}–${repsMax}).`,
        effortNotes.length ? `Esfuerzo registrado: ${effortNotes.join(', ')}, sin llegar al máximo.` : 'No registraste RPE ni RIR; valora tu sensación antes de subir.',
        `Incremento propuesto: +${inc} kg, el menor habitual para este equipamiento.`,
      ],
    };
  }
  if (allTop && !efforts.every((e) => e.ok)) {
    return {
      ...base,
      kind: 'hold',
      suggestedWeight: null,
      reasons: [
        `Alcanzaste el máximo del rango (${repsMax}) con ${weight} kg, pero el esfuerzo fue muy alto (${effortNotes.join(', ')}).`,
        'Puede ser razonable mantener la carga hasta que el esfuerzo baje.',
      ],
    };
  }
  return null;
}

export function suggestionsForRoutine(r: Routine, workouts: Workout[], equipmentOf: (id: string) => Equipment | undefined, dismissed: Set<string>) {
  return r.exercises
    .map((re) => suggestForExercise(re, workouts, equipmentOf(re.exerciseId)))
    .filter((s): s is Suggestion => !!s && !dismissed.has(s.key));
}
