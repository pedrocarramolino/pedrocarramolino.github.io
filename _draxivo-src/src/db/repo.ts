// Repositorio: única capa que lee y escribe en IndexedDB. Los componentes
// visuales nunca acceden a la base de datos directamente.
import { getDB, notify, type StoreName } from './database';
import type {
  BodyWeight,
  Exercise,
  Folder,
  Measurement,
  PlanEntry,
  PlannedSet,
  ProgressPhoto,
  Routine,
  RoutineExercise,
  Settings,
  WeekGoal,
  WeeklyReview,
  Workout,
  WorkoutExercise,
  WorkoutSet,
} from './types';
import { LIBRARY_VERSION, seedExercises } from './seedExercises';
import { uid } from '../lib/id';
import { dateKey, deviceTimezone } from '../lib/dates';

// ---------- Configuración ----------
export function defaultSettings(now = Date.now()): Settings {
  return {
    id: 'settings',
    name: '',
    goal: '',
    experience: '',
    weightUnit: 'kg',
    lengthUnit: 'cm',
    trainingDays: [],
    weeklyGoal: 3,
    reviewEnabled: true,
    reviewDay: 6,
    defaultRestSec: 90,
    autoStartRest: true,
    restSound: true,
    restVibration: true,
    theme: 'auto',
    timezone: deviceTimezone(),
    weightGoalType: null,
    weightGoalKg: null,
    onboarded: false,
    createdAt: now,
    updatedAt: now,
  };
}

export async function getSettings(): Promise<Settings> {
  const db = await getDB();
  const s = await db.get('settings', 'settings');
  if (s) return { ...defaultSettings(s.createdAt), ...s };
  const fresh = defaultSettings();
  await db.put('settings', fresh);
  return fresh;
}

export async function updateSettings(patch: Partial<Settings>): Promise<Settings> {
  const db = await getDB();
  const cur = await getSettings();
  const next = { ...cur, ...patch, id: 'settings' as const, updatedAt: Date.now() };
  await db.put('settings', next);
  notify('settings');
  return next;
}

// ---------- Meta ----------
export async function getMeta<T>(key: string): Promise<T | undefined> {
  const db = await getDB();
  return (await db.get('meta', key))?.value as T | undefined;
}
export async function setMeta(key: string, value: unknown) {
  const db = await getDB();
  await db.put('meta', { key, value });
  notify('meta');
}

// ---------- Utilidades genéricas ----------
export async function getAll<S extends 'exercises' | 'folders' | 'routines' | 'workouts' | 'bodyweights' | 'measurements' | 'photos' | 'plan' | 'weekgoals' | 'reviews'>(
  store: S,
) {
  const db = await getDB();
  return db.getAll(store);
}

// ---------- Ejercicios ----------
export async function listExercises(includeArchived = false): Promise<Exercise[]> {
  const all = await getAll('exercises');
  return all
    .filter((e) => includeArchived || !e.archived)
    .sort((a, b) => a.name.localeCompare(b.name, 'es'));
}

export async function getExercise(id: string) {
  return (await getDB()).get('exercises', id);
}

export async function saveExercise(ex: Omit<Exercise, 'id' | 'createdAt' | 'updatedAt'> & Partial<Pick<Exercise, 'id' | 'createdAt'>>) {
  const db = await getDB();
  const now = Date.now();
  const name = ex.name.trim();
  if (!name) throw new Error('El nombre del ejercicio es obligatorio.');
  const all = await db.getAll('exercises');
  const dup = all.find((e) => e.id !== ex.id && !e.archived && e.name.trim().toLocaleLowerCase('es') === name.toLocaleLowerCase('es'));
  if (dup) throw new Error(`Ya existe un ejercicio llamado «${dup.name}».`);
  const record: Exercise = { ...ex, name, id: ex.id ?? uid(), createdAt: ex.createdAt ?? now, updatedAt: now } as Exercise;
  await db.put('exercises', record);
  notify('exercises');
  return record;
}

export async function deleteExercise(id: string): Promise<'deleted' | 'archived'> {
  const db = await getDB();
  const ex = await db.get('exercises', id);
  if (!ex) return 'deleted';
  // Si se usa en rutinas o historial lo archivamos para no romper referencias.
  const [routines, workouts] = await Promise.all([db.getAll('routines'), db.getAll('workouts')]);
  const used =
    routines.some((r) => r.exercises.some((e) => e.exerciseId === id)) ||
    workouts.some((w) => w.exercises.some((e) => e.exerciseId === id));
  if (used || !ex.custom) {
    await db.put('exercises', { ...ex, archived: true, updatedAt: Date.now() });
    notify('exercises');
    return 'archived';
  }
  await db.delete('exercises', id);
  notify('exercises');
  return 'deleted';
}

// ---------- Carpetas ----------
export async function listFolders(): Promise<Folder[]> {
  return (await getAll('folders')).sort((a, b) => a.order - b.order || a.name.localeCompare(b.name, 'es'));
}

export async function saveFolder(f: Partial<Folder> & { name: string }) {
  const db = await getDB();
  const now = Date.now();
  const name = f.name.trim();
  if (!name) throw new Error('La carpeta necesita un nombre.');
  const all = await db.getAll('folders');
  const rec: Folder = {
    id: f.id ?? uid(),
    name,
    order: f.order ?? all.length,
    createdAt: f.createdAt ?? now,
    updatedAt: now,
  };
  await db.put('folders', rec);
  notify('folders');
  return rec;
}

export async function deleteFolder(id: string) {
  const db = await getDB();
  const tx = db.transaction(['folders', 'routines'], 'readwrite');
  const routines = await tx.objectStore('routines').getAll();
  for (const r of routines) {
    if (r.folderId === id) await tx.objectStore('routines').put({ ...r, folderId: null, updatedAt: Date.now() });
  }
  await tx.objectStore('folders').delete(id);
  await tx.done;
  notify('folders', 'routines');
}

// ---------- Rutinas ----------
export function newPlannedSet(partial: Partial<PlannedSet> = {}): PlannedSet {
  return {
    id: uid(),
    type: 'normal',
    repsMin: 8,
    repsMax: 12,
    weight: null,
    rpe: null,
    rir: null,
    durationSec: null,
    distanceM: null,
    ...partial,
  };
}

export function newRoutineExercise(exercise: Exercise, sets = 3): RoutineExercise {
  const timed = exercise.tracking === 'duration' || exercise.tracking === 'distance_duration';
  return {
    id: uid(),
    exerciseId: exercise.id,
    sets: Array.from({ length: sets }, () =>
      newPlannedSet(timed ? { repsMin: null, repsMax: null, durationSec: exercise.tracking === 'duration' ? 60 : 600 } : {}),
    ),
    restSec: null,
    notes: '',
    supersetId: null,
    effort: 'none',
  };
}

export function emptyRoutine(partial: Partial<Routine> = {}): Routine {
  const now = Date.now();
  return {
    id: uid(),
    name: '',
    description: '',
    goal: '',
    category: '',
    folderId: null,
    exercises: [],
    estimatedMin: null,
    notes: '',
    archived: false,
    isTemplate: false,
    variantOf: null,
    order: now,
    createdAt: now,
    updatedAt: now,
    ...partial,
  };
}

export async function listRoutines(): Promise<Routine[]> {
  return (await getAll('routines')).sort((a, b) => a.order - b.order || a.name.localeCompare(b.name, 'es'));
}

export async function getRoutine(id: string) {
  return (await getDB()).get('routines', id);
}

export async function saveRoutine(r: Routine): Promise<Routine> {
  const name = r.name.trim();
  if (!name) throw new Error('La rutina necesita un nombre.');
  const rec = { ...r, name, updatedAt: Date.now() };
  await (await getDB()).put('routines', rec);
  notify('routines');
  return rec;
}

/** Copia profunda con identificadores nuevos (para duplicar, variantes o plantillas). */
export function cloneRoutine(r: Routine, patch: Partial<Routine>): Routine {
  const now = Date.now();
  const supersetMap = new Map<string, string>();
  return {
    ...r,
    id: uid(),
    exercises: r.exercises.map((e) => {
      let ss = e.supersetId;
      if (ss) {
        if (!supersetMap.has(ss)) supersetMap.set(ss, uid());
        ss = supersetMap.get(ss)!;
      }
      return { ...e, id: uid(), supersetId: ss, sets: e.sets.map((s) => ({ ...s, id: uid() })) };
    }),
    archived: false,
    order: now,
    createdAt: now,
    updatedAt: now,
    ...patch,
  };
}

export async function duplicateRoutine(id: string, mode: 'copy' | 'variant' | 'template' | 'fromTemplate' = 'copy') {
  const r = await getRoutine(id);
  if (!r) throw new Error('Rutina no encontrada.');
  const patch: Partial<Routine> =
    mode === 'variant'
      ? { name: `${r.name} (variante)`, variantOf: r.id, isTemplate: false }
      : mode === 'template'
        ? { name: `${r.name} (plantilla)`, isTemplate: true, variantOf: null }
        : mode === 'fromTemplate'
          ? { name: r.name.replace(/ \(plantilla\)$/, ''), isTemplate: false, variantOf: null }
          : { name: `${r.name} (copia)`, variantOf: r.variantOf, isTemplate: r.isTemplate };
  return saveRoutine(cloneRoutine(r, patch));
}

export async function setRoutineArchived(id: string, archived: boolean) {
  const r = await getRoutine(id);
  if (!r) return;
  await saveRoutine({ ...r, archived });
}

/** Elimina la rutina. Las sesiones realizadas se conservan con el nombre guardado. */
export async function deleteRoutine(id: string) {
  const db = await getDB();
  const tx = db.transaction(['routines', 'plan'], 'readwrite');
  await tx.objectStore('routines').delete(id);
  const plan = await tx.objectStore('plan').getAll();
  for (const p of plan) if (p.routineId === id && p.date >= dateKey()) await tx.objectStore('plan').delete(p.id);
  await tx.done;
  notify('routines', 'plan');
}

export async function copyExercisesToRoutine(targetId: string, items: RoutineExercise[]) {
  const r = await getRoutine(targetId);
  if (!r) throw new Error('Rutina de destino no encontrada.');
  const copies = items.map((e) => ({ ...e, id: uid(), supersetId: null, sets: e.sets.map((s) => ({ ...s, id: uid() })) }));
  await saveRoutine({ ...r, exercises: [...r.exercises, ...copies] });
}

export function estimateRoutineMinutes(r: Routine, defaultRest: number): number {
  let sec = 0;
  for (const e of r.exercises) {
    for (const s of e.sets) {
      sec += s.durationSec ?? 45;
      sec += e.restSec ?? defaultRest;
    }
  }
  return Math.max(5, Math.round(sec / 60 / 5) * 5);
}

// ---------- Entrenamientos ----------
export async function listWorkouts(): Promise<Workout[]> {
  return (await getAll('workouts'))
    .filter((w) => w.status === 'completed')
    .sort((a, b) => b.startedAt - a.startedAt);
}

export async function getWorkout(id: string) {
  return (await getDB()).get('workouts', id);
}

export async function getActiveWorkout(): Promise<Workout | undefined> {
  const db = await getDB();
  const active = await db.getAllFromIndex('workouts', 'status', 'active');
  return active.sort((a, b) => b.startedAt - a.startedAt)[0];
}

export function newWorkoutSet(partial: Partial<WorkoutSet> = {}): WorkoutSet {
  return {
    id: uid(),
    type: 'normal',
    weight: null,
    reps: null,
    rpe: null,
    rir: null,
    durationSec: null,
    distanceM: null,
    completed: false,
    completedAt: null,
    target: null,
    ...partial,
  };
}

export function workoutExerciseFrom(ex: Exercise, partial: Partial<WorkoutExercise> = {}): WorkoutExercise {
  return {
    id: uid(),
    exerciseId: ex.id,
    name: ex.name,
    tracking: ex.tracking,
    primaryMuscle: ex.primaryMuscle,
    restSec: null,
    notes: '',
    supersetId: null,
    effort: 'none',
    sets: [newWorkoutSet()],
    ...partial,
  };
}

export async function startWorkout(opts: { routineId?: string | null; planEntryId?: string | null } = {}): Promise<Workout> {
  const db = await getDB();
  const existing = await getActiveWorkout();
  if (existing) throw new Error('Ya hay un entrenamiento en curso. Finalízalo o descártalo antes de empezar otro.');
  const now = Date.now();
  let exercises: WorkoutExercise[] = [];
  let routine: Routine | undefined;
  if (opts.routineId) {
    routine = await db.get('routines', opts.routineId);
    if (!routine) throw new Error('La rutina ya no existe.');
    const all = await db.getAll('exercises');
    const byId = new Map(all.map((e) => [e.id, e]));
    const ssMap = new Map<string, string>();
    exercises = routine.exercises
      .filter((re) => byId.has(re.exerciseId))
      .map((re) => {
        const ex = byId.get(re.exerciseId)!;
        let ss = re.supersetId;
        if (ss) {
          if (!ssMap.has(ss)) ssMap.set(ss, uid());
          ss = ssMap.get(ss)!;
        }
        return workoutExerciseFrom(ex, {
          restSec: re.restSec,
          notes: re.notes,
          supersetId: ss,
          effort: re.effort,
          sets: re.sets.map((ps) =>
            newWorkoutSet({
              type: ps.type,
              target: { repsMin: ps.repsMin, repsMax: ps.repsMax, weight: ps.weight },
              durationSec: ps.durationSec,
              distanceM: ps.distanceM,
            }),
          ),
        });
      });
  }
  const w: Workout = {
    id: uid(),
    routineId: routine?.id ?? null,
    routineName: routine?.name ?? null,
    name: routine?.name ?? 'Entrenamiento libre',
    status: 'active',
    startedAt: now,
    endedAt: null,
    pausedAt: null,
    pausedTotalMs: 0,
    date: dateKey(now),
    exercises,
    notes: '',
    rest: null,
    planEntryId: opts.planEntryId ?? null,
    createdAt: now,
    updatedAt: now,
  };
  await db.put('workouts', w);
  notify('workouts');
  return w;
}

export async function saveWorkout(w: Workout, opts: { silent?: boolean } = {}) {
  const rec = { ...w, updatedAt: Date.now() };
  await (await getDB()).put('workouts', rec);
  if (!opts.silent) notify('workouts');
  return rec;
}

/** Guarda el entrenamiento como completado. Elimina las series no completadas. */
export async function finishWorkout(w: Workout): Promise<Workout> {
  const now = Date.now();
  const endedAt = w.pausedAt ?? now;
  const exercises = w.exercises
    .map((e) => ({ ...e, sets: e.sets.filter((s) => s.completed) }))
    .filter((e) => e.sets.length > 0);
  const rec: Workout = {
    ...w,
    status: 'completed',
    endedAt,
    pausedTotalMs: w.pausedTotalMs,
    pausedAt: null,
    rest: null,
    exercises,
    date: dateKey(w.startedAt),
    updatedAt: now,
  };
  const db = await getDB();
  await db.put('workouts', rec);
  // Verifica que la escritura se ha confirmado antes de devolver el resultado.
  const check = await db.get('workouts', rec.id);
  if (!check || check.status !== 'completed') throw new Error('No se pudo confirmar el guardado del entrenamiento.');
  notify('workouts');
  return rec;
}

export async function deleteWorkout(id: string) {
  await (await getDB()).delete('workouts', id);
  notify('workouts');
}

// ---------- Peso corporal ----------
export async function listBodyWeights(): Promise<BodyWeight[]> {
  return (await getAll('bodyweights')).sort((a, b) => (a.date + (a.time ?? '')).localeCompare(b.date + (b.time ?? '')));
}

export async function saveBodyWeight(b: Partial<BodyWeight> & { date: string; weightKg: number }) {
  if (!(b.weightKg > 0 && b.weightKg < 700)) throw new Error('Introduce un peso válido.');
  const now = Date.now();
  const rec: BodyWeight = {
    id: b.id ?? uid(),
    date: b.date,
    time: b.time || null,
    weightKg: Math.round(b.weightKg * 100) / 100,
    note: b.note?.trim() ?? '',
    createdAt: b.createdAt ?? now,
    updatedAt: now,
  };
  await (await getDB()).put('bodyweights', rec);
  notify('bodyweights');
  return rec;
}

export async function deleteBodyWeight(id: string) {
  await (await getDB()).delete('bodyweights', id);
  notify('bodyweights');
}

// ---------- Medidas ----------
export async function listMeasurements(): Promise<Measurement[]> {
  return (await getAll('measurements')).sort((a, b) => a.date.localeCompare(b.date) || a.createdAt - b.createdAt);
}

export async function saveMeasurement(m: Partial<Measurement> & Pick<Measurement, 'date' | 'type' | 'value'>) {
  if (!(m.value > 0 && m.value < 1000)) throw new Error('Introduce un valor válido.');
  if (m.type === 'grasa' && m.value >= 80) throw new Error('El porcentaje de grasa debe ser menor que 80 %.');
  const now = Date.now();
  const rec: Measurement = {
    id: m.id ?? uid(),
    date: m.date,
    type: m.type,
    value: Math.round(m.value * 10) / 10,
    unit: m.type === 'grasa' ? '%' : 'cm',
    note: m.note?.trim() ?? '',
    createdAt: m.createdAt ?? now,
    updatedAt: now,
  };
  await (await getDB()).put('measurements', rec);
  notify('measurements');
  return rec;
}

export async function deleteMeasurement(id: string) {
  await (await getDB()).delete('measurements', id);
  notify('measurements');
}

// ---------- Fotos ----------
export async function listPhotos(): Promise<ProgressPhoto[]> {
  return (await getAll('photos')).sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt);
}

export async function savePhoto(p: Partial<ProgressPhoto> & Pick<ProgressPhoto, 'date' | 'blob' | 'pose'>) {
  const now = Date.now();
  const rec: ProgressPhoto = {
    id: p.id ?? uid(),
    date: p.date,
    pose: p.pose,
    blob: p.blob,
    mime: p.mime ?? p.blob.type ?? 'image/jpeg',
    note: p.note ?? '',
    createdAt: p.createdAt ?? now,
    updatedAt: now,
  };
  await (await getDB()).put('photos', rec);
  notify('photos');
  return rec;
}

export async function deletePhoto(id: string) {
  await (await getDB()).delete('photos', id);
  notify('photos');
}

// ---------- Planificación ----------
export async function listPlan(): Promise<PlanEntry[]> {
  return (await getAll('plan')).sort((a, b) => a.date.localeCompare(b.date) || a.createdAt - b.createdAt);
}

export async function savePlanEntry(p: Partial<PlanEntry> & Pick<PlanEntry, 'date' | 'kind'>) {
  const now = Date.now();
  const db = await getDB();
  if (p.kind === 'routine' && !p.routineId) throw new Error('Selecciona una rutina.');
  if (!p.id) {
    // Evita duplicados exactos el mismo día.
    const sameDay = await db.getAllFromIndex('plan', 'date', p.date);
    const dup = sameDay.find((x) => x.kind === p.kind && x.routineId === (p.routineId ?? null));
    if (dup) return dup;
  }
  const rec: PlanEntry = {
    id: p.id ?? uid(),
    date: p.date,
    kind: p.kind,
    routineId: p.kind === 'rest' ? null : (p.routineId ?? null),
    note: p.note ?? '',
    createdAt: p.createdAt ?? now,
    updatedAt: now,
  };
  await db.put('plan', rec);
  notify('plan');
  return rec;
}

export async function deletePlanEntry(id: string) {
  await (await getDB()).delete('plan', id);
  notify('plan');
}

export async function listWeekGoals(): Promise<WeekGoal[]> {
  return getAll('weekgoals');
}

export async function setWeekGoal(weekStart: string, sessions: number | null) {
  const db = await getDB();
  if (sessions === null) await db.delete('weekgoals', weekStart);
  else await db.put('weekgoals', { weekStart, sessions, updatedAt: Date.now() });
  notify('weekgoals');
}

// ---------- Revisiones ----------
export async function listReviews(): Promise<WeeklyReview[]> {
  return (await getAll('reviews')).sort((a, b) => b.weekStart.localeCompare(a.weekStart));
}

export async function getReview(id: string) {
  return (await getDB()).get('reviews', id);
}

export async function saveReview(r: WeeklyReview) {
  const db = await getDB();
  // Una revisión por semana: si ya existe otra para la misma semana, se reutiliza su id.
  const same = await db.getAllFromIndex('reviews', 'weekStart', r.weekStart);
  const other = same.find((x) => x.id !== r.id);
  const rec = { ...r, id: other?.id ?? r.id, createdAt: other?.createdAt ?? r.createdAt, updatedAt: Date.now() };
  await db.put('reviews', rec);
  notify('reviews');
  return rec;
}

export async function deleteReview(id: string) {
  await (await getDB()).delete('reviews', id);
  notify('reviews');
}

// ---------- Borrado total ----------
export async function wipeAllData() {
  const db = await getDB();
  const stores: StoreName[] = ['settings', 'meta', 'exercises', 'folders', 'routines', 'workouts', 'bodyweights', 'measurements', 'photos', 'plan', 'weekgoals', 'reviews'];
  const tx = db.transaction(stores, 'readwrite');
  for (const s of stores) await tx.objectStore(s).clear();
  // Restaura la biblioteca inicial de ejercicios.
  for (const ex of seedExercises()) await tx.objectStore('exercises').put(ex);
  await tx.objectStore('meta').put({ key: 'libraryVersion', value: LIBRARY_VERSION });
  await tx.done;
  notify(...stores);
}
