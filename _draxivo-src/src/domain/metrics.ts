// Cálculos de entrenamiento. Funciones puras, sin acceso a la base de datos.
import type { MuscleGroup, TrackingType, Workout, WorkoutExercise, WorkoutSet } from '../db/types';
import { supportsLoadMetrics, usesDistance, usesDuration } from '../lib/labels';
import { addDays, weekStart } from '../lib/dates';

/** Series que cuentan para métricas: completadas y que no son de calentamiento. */
export function isWorkingSet(s: WorkoutSet) {
  return s.completed && s.type !== 'warmup';
}

/** Volumen de una serie en kg (carga × repeticiones). Sólo para ejercicios con carga externa. */
export function setVolume(s: WorkoutSet, tracking: TrackingType): number {
  if (!isWorkingSet(s) || !supportsLoadMetrics(tracking)) return 0;
  const w = s.weight ?? 0;
  const r = s.reps ?? 0;
  if (w <= 0 || r <= 0) return 0;
  return w * r;
}

/**
 * 1RM estimado (fórmula de Epley). Sólo se calcula con 1–12 repeticiones y carga positiva,
 * porque por encima de ese rango la estimación pierde fiabilidad.
 */
export function estimate1RM(weight: number | null, reps: number | null): number | null {
  if (!weight || !reps || weight <= 0 || reps < 1 || reps > 12) return null;
  if (reps === 1) return weight;
  return Math.round(weight * (1 + reps / 30) * 10) / 10;
}

export function workoutDurationMs(w: Workout, now = Date.now()): number {
  // Si está en pausa, el tiempo se congela en el momento de la pausa.
  const end = w.endedAt ?? w.pausedAt ?? now;
  return Math.max(0, end - w.startedAt - w.pausedTotalMs);
}

export interface WorkoutStats {
  durationMs: number;
  exercises: number;
  sets: number;
  warmupSets: number;
  reps: number;
  volume: number;
  muscleSets: Partial<Record<MuscleGroup, number>>;
}

export function workoutStats(w: Workout, now = Date.now()): WorkoutStats {
  const st: WorkoutStats = { durationMs: workoutDurationMs(w, now), exercises: 0, sets: 0, warmupSets: 0, reps: 0, volume: 0, muscleSets: {} };
  for (const e of w.exercises) {
    const done = e.sets.filter((s) => s.completed);
    if (done.length) st.exercises++;
    for (const s of done) {
      if (s.type === 'warmup') {
        st.warmupSets++;
        continue;
      }
      st.sets++;
      st.reps += s.reps ?? 0;
      st.volume += setVolume(s, e.tracking);
      st.muscleSets[e.primaryMuscle] = (st.muscleSets[e.primaryMuscle] ?? 0) + 1;
    }
  }
  st.volume = Math.round(st.volume * 10) / 10;
  return st;
}

export interface ExerciseBest {
  maxWeight: number | null;
  e1rm: number | null;
  bestSetVolume: number | null;
  bestSet: WorkoutSet | null;
  maxReps: number | null;
  totalReps: number;
  volume: number;
  maxDuration: number | null;
  maxDistance: number | null;
  sets: number;
}

export function exerciseBest(e: Pick<WorkoutExercise, 'sets' | 'tracking'>): ExerciseBest {
  const b: ExerciseBest = { maxWeight: null, e1rm: null, bestSetVolume: null, bestSet: null, maxReps: null, totalReps: 0, volume: 0, maxDuration: null, maxDistance: null, sets: 0 };
  const load = supportsLoadMetrics(e.tracking);
  for (const s of e.sets) {
    if (!isWorkingSet(s)) continue;
    b.sets++;
    b.totalReps += s.reps ?? 0;
    if (s.reps != null && (b.maxReps == null || s.reps > b.maxReps)) b.maxReps = s.reps;
    if (usesDuration(e.tracking) && s.durationSec && (b.maxDuration == null || s.durationSec > b.maxDuration)) b.maxDuration = s.durationSec;
    if (usesDistance(e.tracking) && s.distanceM && (b.maxDistance == null || s.distanceM > b.maxDistance)) b.maxDistance = s.distanceM;
    if (load && s.weight && s.weight > 0 && s.reps && s.reps > 0) {
      if (b.maxWeight == null || s.weight > b.maxWeight) b.maxWeight = s.weight;
      const v = s.weight * s.reps;
      b.volume += v;
      if (b.bestSetVolume == null || v > b.bestSetVolume) b.bestSetVolume = v;
      const e1 = estimate1RM(s.weight, s.reps);
      if (e1 != null && (b.e1rm == null || e1 > b.e1rm)) {
        b.e1rm = e1;
        b.bestSet = s;
      }
      if (!b.bestSet) b.bestSet = s;
    }
    if (e.tracking === 'assisted_bodyweight' && s.reps) {
      // En asistidos la mejor serie es la de menor asistencia con más repeticiones.
      if (!b.bestSet || (s.weight ?? 0) < (b.bestSet.weight ?? 0) || ((s.weight ?? 0) === (b.bestSet.weight ?? 0) && s.reps > (b.bestSet.reps ?? 0))) b.bestSet = s;
    }
    if (!load && e.tracking !== 'assisted_bodyweight' && (!b.bestSet || (s.reps ?? 0) > (b.bestSet.reps ?? 0) || (s.durationSec ?? 0) > (b.bestSet.durationSec ?? 0))) {
      b.bestSet = s;
    }
  }
  b.volume = Math.round(b.volume * 10) / 10;
  return b;
}

export type PRKind = 'maxWeight' | 'e1rm' | 'bestSetVolume' | 'maxReps' | 'maxDuration' | 'maxDistance';
export const PR_LABELS: Record<PRKind, string> = {
  maxWeight: 'Peso máximo',
  e1rm: '1RM estimado',
  bestSetVolume: 'Mejor volumen en una serie',
  maxReps: 'Máximo de repeticiones',
  maxDuration: 'Mayor duración',
  maxDistance: 'Mayor distancia',
};

function prKindsFor(t: TrackingType): PRKind[] {
  switch (t) {
    case 'weight_reps':
    case 'weighted_bodyweight':
      return ['maxWeight', 'e1rm', 'bestSetVolume'];
    case 'bodyweight_reps':
    case 'assisted_bodyweight':
      return ['maxReps'];
    case 'duration':
      return ['maxDuration'];
    case 'distance_duration':
      return ['maxDistance', 'maxDuration'];
  }
}

export interface PR {
  exerciseId: string;
  exerciseName: string;
  kind: PRKind;
  value: number;
  previous: number;
  workoutId: string;
  date: string;
}

/** Récords que mejora un entrenamiento respecto al historial anterior (requiere historial previo). */
export function prsInWorkout(w: Workout, history: Workout[]): PR[] {
  const previous = history.filter((h) => h.id !== w.id && h.status === 'completed' && h.startedAt < w.startedAt);
  const out: PR[] = [];
  const seen = new Set<string>();
  for (const e of w.exercises) {
    if (seen.has(e.exerciseId)) continue;
    seen.add(e.exerciseId);
    const merged = { tracking: e.tracking, sets: w.exercises.filter((x) => x.exerciseId === e.exerciseId).flatMap((x) => x.sets) };
    const cur = exerciseBest(merged);
    const prevSets = previous.flatMap((h) => h.exercises.filter((x) => x.exerciseId === e.exerciseId).flatMap((x) => x.sets));
    if (!prevSets.some(isWorkingSet)) continue;
    const prev = exerciseBest({ tracking: e.tracking, sets: prevSets });
    for (const k of prKindsFor(e.tracking)) {
      const c = cur[k];
      const p = prev[k];
      if (c != null && p != null && c > p) out.push({ exerciseId: e.exerciseId, exerciseName: e.name, kind: k, value: c, previous: p, workoutId: w.id, date: w.date });
    }
  }
  return out;
}

/** Récords personales absolutos por ejercicio a lo largo del historial. */
export function personalRecords(workouts: Workout[], exerciseId: string) {
  const res: Partial<Record<PRKind, { value: number; date: string; workoutId: string }>> = {};
  for (const w of workouts) {
    if (w.status !== 'completed') continue;
    const exs = w.exercises.filter((x) => x.exerciseId === exerciseId);
    if (!exs.length) continue;
    const b = exerciseBest({ tracking: exs[0].tracking, sets: exs.flatMap((x) => x.sets) });
    for (const k of prKindsFor(exs[0].tracking)) {
      const v = b[k];
      if (v != null && (!res[k] || v > res[k]!.value)) res[k] = { value: v, date: w.date, workoutId: w.id };
    }
  }
  return res;
}

/** Última sesión completada que contiene el ejercicio (antes de un instante dado). */
export function lastPerformance(workouts: Workout[], exerciseId: string, before = Infinity): { workout: Workout; sets: WorkoutSet[] } | null {
  let best: Workout | null = null;
  for (const w of workouts) {
    if (w.status !== 'completed' || w.startedAt >= before) continue;
    if (!w.exercises.some((e) => e.exerciseId === exerciseId)) continue;
    if (!best || w.startedAt > best.startedAt) best = w;
  }
  if (!best) return null;
  return { workout: best, sets: best.exercises.filter((e) => e.exerciseId === exerciseId).flatMap((e) => e.sets) };
}

/** Sesión anterior equivalente: misma rutina si existe; si no, la última sesión. */
export function previousEquivalent(workouts: Workout[], w: Workout): Workout | null {
  const prev = workouts
    .filter((x) => x.status === 'completed' && x.id !== w.id && x.startedAt < w.startedAt)
    .sort((a, b) => b.startedAt - a.startedAt);
  if (w.routineId) return prev.find((x) => x.routineId === w.routineId) ?? null;
  return null;
}

export interface ExercisePoint {
  date: string;
  workoutId: string;
  maxWeight: number | null;
  e1rm: number | null;
  bestSetVolume: number | null;
  volume: number;
  totalReps: number;
  maxReps: number | null;
  maxDuration: number | null;
  maxDistance: number | null;
  bestSet: WorkoutSet | null;
  sets: number;
}

export function exerciseHistory(workouts: Workout[], exerciseId: string): ExercisePoint[] {
  const out: ExercisePoint[] = [];
  for (const w of [...workouts].sort((a, b) => a.startedAt - b.startedAt)) {
    if (w.status !== 'completed') continue;
    const exs = w.exercises.filter((x) => x.exerciseId === exerciseId);
    if (!exs.length) continue;
    const b = exerciseBest({ tracking: exs[0].tracking, sets: exs.flatMap((x) => x.sets) });
    if (!b.sets) continue;
    out.push({ date: w.date, workoutId: w.id, ...b });
  }
  return out;
}

export interface PeriodStats {
  workouts: number;
  minutes: number;
  sets: number;
  reps: number;
  volume: number;
  muscleSets: Partial<Record<MuscleGroup, number>>;
  avgMinutes: number;
}

export function periodStats(workouts: Workout[], from: string, to: string): PeriodStats {
  const st: PeriodStats = { workouts: 0, minutes: 0, sets: 0, reps: 0, volume: 0, muscleSets: {}, avgMinutes: 0 };
  for (const w of workouts) {
    if (w.status !== 'completed' || w.date < from || w.date > to) continue;
    const s = workoutStats(w);
    st.workouts++;
    st.minutes += s.durationMs / 60000;
    st.sets += s.sets;
    st.reps += s.reps;
    st.volume += s.volume;
    for (const [m, n] of Object.entries(s.muscleSets)) st.muscleSets[m as MuscleGroup] = (st.muscleSets[m as MuscleGroup] ?? 0) + (n ?? 0);
  }
  st.volume = Math.round(st.volume);
  st.avgMinutes = st.workouts ? st.minutes / st.workouts : 0;
  return st;
}

export interface WeekBucket {
  weekStart: string;
  workouts: number;
  minutes: number;
  volume: number;
  sets: number;
}

export function weeklyBuckets(workouts: Workout[], from: string, to: string): WeekBucket[] {
  const out: WeekBucket[] = [];
  const idx = new Map<string, WeekBucket>();
  for (let k = weekStart(from); k <= to; k = addDays(k, 7)) {
    const b = { weekStart: k, workouts: 0, minutes: 0, volume: 0, sets: 0 };
    out.push(b);
    idx.set(k, b);
  }
  for (const w of workouts) {
    if (w.status !== 'completed' || w.date < from || w.date > to) continue;
    const b = idx.get(weekStart(w.date));
    if (!b) continue;
    const s = workoutStats(w);
    b.workouts++;
    b.minutes += s.durationMs / 60000;
    b.volume += s.volume;
    b.sets += s.sets;
  }
  return out;
}

export interface MonthBucket {
  month: string;
  workouts: number;
  volume: number;
}

export function monthlyBuckets(workouts: Workout[], from: string, to: string): MonthBucket[] {
  const out: MonthBucket[] = [];
  const idx = new Map<string, MonthBucket>();
  let [y, m] = from.split('-').map(Number);
  const [ty, tm] = to.split('-').map(Number);
  while (y < ty || (y === ty && m <= tm)) {
    const key = `${y}-${String(m).padStart(2, '0')}`;
    const b = { month: key, workouts: 0, volume: 0 };
    out.push(b);
    idx.set(key, b);
    m++;
    if (m > 12) {
      m = 1;
      y++;
    }
  }
  for (const w of workouts) {
    if (w.status !== 'completed' || w.date < from || w.date > to) continue;
    const b = idx.get(w.date.slice(0, 7));
    if (!b) continue;
    b.workouts++;
    b.volume += workoutStats(w).volume;
  }
  return out;
}

/** Porcentaje de semanas que alcanzan el objetivo de sesiones. Excluye la semana en curso si no ha terminado. */
export function consistency(buckets: WeekBucket[], goalFor: (weekStart: string) => number, todayKey: string) {
  const closed = buckets.filter((b) => addDays(b.weekStart, 6) < todayKey);
  if (!closed.length) return null;
  const met = closed.filter((b) => b.workouts >= Math.max(1, goalFor(b.weekStart))).length;
  return { met, total: closed.length, pct: Math.round((met / closed.length) * 100) };
}

export function compareWorkouts(a: Workout, b: Workout) {
  const sa = workoutStats(a);
  const sb = workoutStats(b);
  return {
    volume: sa.volume - sb.volume,
    sets: sa.sets - sb.sets,
    reps: sa.reps - sb.reps,
    durationMs: sa.durationMs - sb.durationMs,
  };
}
