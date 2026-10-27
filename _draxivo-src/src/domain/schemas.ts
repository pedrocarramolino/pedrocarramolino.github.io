// Esquemas de validación para importar copias de seguridad.
import { z } from 'zod';

const id = z.string().min(1).max(200);
const dateKey = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const ts = z.number().finite();
const nnum = z.number().finite().nullable();
const muscle = z.enum(['pecho', 'espalda', 'hombros', 'biceps', 'triceps', 'antebrazos', 'cuadriceps', 'isquios', 'gluteos', 'gemelos', 'abdominales', 'cuerpo_completo', 'cardio', 'movilidad']);
const equipment = z.enum(['barra', 'mancuernas', 'maquina', 'polea', 'peso_corporal', 'banda', 'otros']);
const tracking = z.enum(['weight_reps', 'weighted_bodyweight', 'assisted_bodyweight', 'bodyweight_reps', 'duration', 'distance_duration']);
const setType = z.enum(['normal', 'warmup', 'drop', 'failure']);
const effort = z.enum(['none', 'rpe', 'rir']);

export const exerciseSchema = z.object({
  id,
  name: z.string().min(1).max(200),
  primaryMuscle: muscle,
  secondaryMuscles: z.array(muscle),
  equipment,
  movement: z.enum(['compuesto', 'aislamiento', 'cardio', 'movilidad']),
  tracking,
  instructions: z.string().max(5000),
  notes: z.string().max(5000),
  custom: z.boolean(),
  archived: z.boolean(),
  createdAt: ts,
  updatedAt: ts,
});

const plannedSet = z.object({ id, type: setType, repsMin: nnum, repsMax: nnum, weight: nnum, rpe: nnum, rir: nnum, durationSec: nnum, distanceM: nnum });

export const routineSchema = z.object({
  id,
  name: z.string().min(1).max(200),
  description: z.string().max(5000),
  goal: z.string().max(200),
  category: z.string().max(200),
  folderId: id.nullable(),
  exercises: z.array(
    z.object({ id, exerciseId: id, sets: z.array(plannedSet), restSec: nnum, notes: z.string().max(5000), supersetId: z.string().nullable(), effort }),
  ),
  estimatedMin: nnum,
  notes: z.string().max(5000),
  archived: z.boolean(),
  isTemplate: z.boolean(),
  variantOf: id.nullable(),
  order: z.number(),
  createdAt: ts,
  updatedAt: ts,
});

export const folderSchema = z.object({ id, name: z.string().min(1).max(200), order: z.number(), createdAt: ts, updatedAt: ts });

const workoutSet = z.object({
  id,
  type: setType,
  weight: nnum,
  reps: nnum,
  rpe: nnum,
  rir: nnum,
  durationSec: nnum,
  distanceM: nnum,
  completed: z.boolean(),
  completedAt: nnum,
  target: z.object({ repsMin: nnum, repsMax: nnum, weight: nnum }).nullable().optional(),
});

export const workoutSchema = z.object({
  id,
  routineId: id.nullable(),
  routineName: z.string().nullable(),
  name: z.string().max(200),
  status: z.enum(['active', 'completed']),
  startedAt: ts,
  endedAt: nnum,
  pausedAt: nnum,
  pausedTotalMs: z.number(),
  date: dateKey,
  exercises: z.array(
    z.object({
      id,
      exerciseId: id,
      name: z.string(),
      tracking,
      primaryMuscle: muscle,
      restSec: nnum,
      notes: z.string(),
      supersetId: z.string().nullable(),
      effort,
      sets: z.array(workoutSet),
    }),
  ),
  notes: z.string(),
  rest: z.any().nullable(),
  planEntryId: id.nullable(),
  createdAt: ts,
  updatedAt: ts,
});

export const bodyWeightSchema = z.object({ id, date: dateKey, time: z.string().regex(/^\d{2}:\d{2}$/).nullable(), weightKg: z.number().positive().max(700), note: z.string().max(2000), createdAt: ts, updatedAt: ts });

export const measurementSchema = z.object({
  id,
  date: dateKey,
  type: z.enum(['cintura', 'cadera', 'pecho', 'brazo', 'antebrazo', 'muslo', 'gemelo', 'cuello', 'grasa']),
  value: z.number().positive().max(1000),
  unit: z.enum(['cm', '%']),
  note: z.string().max(2000),
  createdAt: ts,
  updatedAt: ts,
});

export const photoSchema = z.object({
  id,
  date: dateKey,
  pose: z.enum(['frente', 'lado', 'espalda', 'otra']),
  dataUrl: z.string().startsWith('data:image/'),
  mime: z.string(),
  note: z.string().max(2000),
  createdAt: ts,
  updatedAt: ts,
});

export const planSchema = z.object({ id, date: dateKey, kind: z.enum(['routine', 'rest']), routineId: id.nullable(), note: z.string().max(2000), createdAt: ts, updatedAt: ts });
export const weekGoalSchema = z.object({ weekStart: dateKey, sessions: z.number().int().min(0).max(21), updatedAt: ts });

export const reviewSchema = z.object({
  id,
  weekStart: dateKey,
  weekEnd: dateKey,
  status: z.enum(['draft', 'completed']),
  metrics: z.record(z.string(), z.any()),
  answers: z.object({
    week: nnum,
    energy: nnum,
    recovery: nnum,
    sleep: nnum,
    discomfort: z.string(),
    bestThing: z.string(),
    improve: z.string(),
  }),
  conclusions: z.object({ achievements: z.array(z.string()), evolution: z.array(z.string()), attention: z.array(z.string()), compliance: z.string() }),
  nextGoalSessions: nnum,
  nextGoalText: z.string(),
  createdAt: ts,
  updatedAt: ts,
});

export const settingsSchema = z.object({
  id: z.literal('settings'),
  name: z.string().max(100),
  goal: z.string().max(200),
  experience: z.enum(['principiante', 'intermedio', 'avanzado', '']),
  weightUnit: z.enum(['kg', 'lb']),
  lengthUnit: z.enum(['cm', 'in']),
  trainingDays: z.array(z.number().int().min(0).max(6)),
  weeklyGoal: z.number().int().min(0).max(21),
  reviewEnabled: z.boolean(),
  reviewDay: z.number().int().min(0).max(6),
  defaultRestSec: z.number().int().min(0).max(3600),
  autoStartRest: z.boolean(),
  restSound: z.boolean(),
  restVibration: z.boolean(),
  theme: z.enum(['auto', 'light', 'dark']),
  timezone: z.string(),
  weightGoalType: z.enum(['perder', 'ganar', 'mantener']).nullable(),
  weightGoalKg: nnum,
  onboarded: z.boolean(),
  createdAt: ts,
  updatedAt: ts,
});

export const backupSchema = z.object({
  app: z.literal('draxivo'),
  format: z.literal(1),
  schemaVersion: z.number().int(),
  exportedAt: z.string(),
  data: z.object({
    settings: z.array(settingsSchema).max(1).default([]),
    exercises: z.array(exerciseSchema).default([]),
    folders: z.array(folderSchema).default([]),
    routines: z.array(routineSchema).default([]),
    workouts: z.array(workoutSchema).default([]),
    bodyweights: z.array(bodyWeightSchema).default([]),
    measurements: z.array(measurementSchema).default([]),
    photos: z.array(photoSchema).default([]),
    plan: z.array(planSchema).default([]),
    weekgoals: z.array(weekGoalSchema).default([]),
    reviews: z.array(reviewSchema).default([]),
  }),
});

export type BackupFile = z.infer<typeof backupSchema>;
