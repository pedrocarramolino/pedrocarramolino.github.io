import { describe, expect, it } from 'vitest';
import type { Settings, Workout, WorkoutExercise, WorkoutSet } from '../db/types';
import { estimate1RM, exerciseBest, periodStats, prsInWorkout, setVolume, workoutStats, weeklyBuckets, consistency } from '../domain/metrics';
import { addDays, addMonths, isoWeek, weekStart, weekday, diffDays, localToMs, dateKey, setTimezone } from '../lib/dates';
import { changeOver, dailyWeights, trend, weightSummary } from '../domain/weight';
import { buildConclusions, computeReviewMetrics, emptyAnswers, pendingReviewWeek, reviewTargetWeek } from '../domain/review';
import { suggestForExercise } from '../domain/progression';
import { defaultSettings } from '../db/repo';

const set = (p: Partial<WorkoutSet>): WorkoutSet => ({ id: Math.random().toString(), type: 'normal', weight: null, reps: null, rpe: null, rir: null, durationSec: null, distanceM: null, completed: true, completedAt: 1, ...p });
const ex = (p: Partial<WorkoutExercise>): WorkoutExercise => ({ id: Math.random().toString(), exerciseId: 'ex-press-banca', name: 'Press', tracking: 'weight_reps', primaryMuscle: 'pecho', restSec: null, notes: '', supersetId: null, effort: 'none', sets: [], ...p });
const wo = (p: Partial<Workout>): Workout => ({ id: Math.random().toString(), routineId: null, routineName: null, name: 'W', status: 'completed', startedAt: 0, endedAt: 3600000, pausedAt: null, pausedTotalMs: 0, date: '2026-10-05', exercises: [], notes: '', rest: null, planEntryId: null, createdAt: 0, updatedAt: 0, ...p });

describe('volumen y 1RM', () => {
  it('calcula volumen sólo de series efectivas con carga', () => {
    expect(setVolume(set({ weight: 100, reps: 5 }), 'weight_reps')).toBe(500);
    expect(setVolume(set({ weight: 100, reps: 5, type: 'warmup' }), 'weight_reps')).toBe(0);
    expect(setVolume(set({ weight: 100, reps: 5, completed: false }), 'weight_reps')).toBe(0);
    expect(setVolume(set({ weight: 20, reps: 10 }), 'assisted_bodyweight')).toBe(0);
    expect(setVolume(set({ reps: 10 }), 'bodyweight_reps')).toBe(0);
    expect(setVolume(set({ durationSec: 600, distanceM: 2000 }), 'distance_duration')).toBe(0);
  });
  it('Epley con límites de fiabilidad', () => {
    expect(estimate1RM(100, 1)).toBe(100);
    expect(estimate1RM(100, 5)).toBe(116.7);
    expect(estimate1RM(100, 10)).toBe(133.3);
    expect(estimate1RM(100, 13)).toBeNull();
    expect(estimate1RM(0, 5)).toBeNull();
    expect(estimate1RM(null, 5)).toBeNull();
  });
  it('estadísticas de la sesión y mejor serie', () => {
    const w = wo({ exercises: [ex({ sets: [set({ type: 'warmup', weight: 40, reps: 10 }), set({ weight: 80, reps: 8 }), set({ weight: 85, reps: 6 }), set({ weight: 90, reps: 3, completed: false })] })] });
    const st = workoutStats(w);
    expect(st.volume).toBe(80 * 8 + 85 * 6);
    expect(st.sets).toBe(2);
    expect(st.warmupSets).toBe(1);
    expect(st.reps).toBe(14);
    expect(st.muscleSets.pecho).toBe(2);
    expect(st.durationMs).toBe(3600000);
    const b = exerciseBest(w.exercises[0]);
    expect(b.maxWeight).toBe(85);
    expect(b.e1rm).toBe(estimate1RM(85, 6));
  });
  it('no aplica fórmulas de fuerza al cardio', () => {
    const b = exerciseBest({ tracking: 'distance_duration', sets: [set({ distanceM: 5000, durationSec: 1500 })] });
    expect(b.e1rm).toBeNull();
    expect(b.maxWeight).toBeNull();
    expect(b.maxDistance).toBe(5000);
  });
  it('detecta récords sólo con historial previo', () => {
    const a = wo({ startedAt: 1000, exercises: [ex({ sets: [set({ weight: 80, reps: 5 })] })] });
    const b = wo({ startedAt: 2000, exercises: [ex({ sets: [set({ weight: 85, reps: 5 })] })] });
    expect(prsInWorkout(a, [a, b])).toEqual([]);
    const prs = prsInWorkout(b, [a, b]);
    expect(prs.map((p) => p.kind).sort()).toEqual(['bestSetVolume', 'e1rm', 'maxWeight']);
  });
});

describe('fechas', () => {
  it('semanas lunes-domingo y cambios de mes/año', () => {
    expect(weekday('2026-10-26')).toBe(0); // lunes
    expect(weekStart('2026-11-01')).toBe('2026-10-26'); // domingo
    expect(weekStart('2027-01-01')).toBe('2026-12-28');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
    expect(diffDays('2027-01-02', '2026-12-30')).toBe(3);
    expect(isoWeek('2026-12-31')).toEqual({ year: 2026, week: 53 });
    expect(isoWeek('2027-01-04')).toEqual({ year: 2027, week: 1 });
  });
  it('zona horaria y cambio de hora', () => {
    setTimezone('Europe/Madrid');
    // 25 oct 2026: cambio de horario en Europa.
    const ms = localToMs('2026-10-25', '23:30');
    expect(dateKey(ms)).toBe('2026-10-25');
    expect(dateKey(Date.UTC(2026, 11, 31, 23, 30))).toBe('2027-01-01');
    setTimezone(undefined);
  });
});

describe('peso corporal', () => {
  const bw = (date: string, weightKg: number) => ({ id: date + weightKg, date, time: null, weightKg, note: '', createdAt: 0, updatedAt: 0 });
  it('promedios diarios, tendencia y variaciones', () => {
    const entries = [bw('2026-10-01', 80), bw('2026-10-01', 81), bw('2026-10-08', 79.5), bw('2026-10-15', 79)];
    const days = dailyWeights(entries);
    expect(days[0]).toEqual({ date: '2026-10-01', weight: 80.5, count: 2 });
    expect(changeOver(days, 7, 3)?.delta).toBe(-0.5);
    expect(trend(days).length).toBe(3);
    const s = weightSummary(entries);
    expect(s.latest?.weightKg).toBe(79);
    expect(s.diffPrevious).toBe(-0.5);
    expect(s.initial?.date).toBe('2026-10-01');
  });
  it('sin datos suficientes no hay variación semanal', () => {
    expect(changeOver(dailyWeights([bw('2026-10-01', 80), bw('2026-10-02', 79)]), 7, 3)).toBeNull();
  });
});

describe('revisión semanal', () => {
  const settings: Settings = { ...defaultSettings(Date.UTC(2026, 0, 1)), weeklyGoal: 3, reviewDay: 6 };
  it('semana objetivo según el día de revisión', () => {
    expect(reviewTargetWeek('2026-11-01', 6).weekStart).toBe('2026-10-26'); // domingo: semana en curso
    expect(reviewTargetWeek('2026-10-28', 6).weekStart).toBe('2026-10-19'); // miércoles: semana anterior
    expect(reviewTargetWeek('2026-10-27', 0).weekStart).toBe('2026-10-19'); // revisión en lunes: semana anterior
  });
  it('pendiente hasta completarse y posponible', () => {
    expect(pendingReviewWeek('2026-10-28', settings, [], undefined)).toBe('2026-10-19');
    expect(pendingReviewWeek('2026-10-28', settings, [{ weekStart: '2026-10-19', status: 'completed' }], undefined)).toBeNull();
    expect(pendingReviewWeek('2026-10-28', settings, [], '2026-10-29')).toBeNull();
    expect(pendingReviewWeek('2026-10-28', { ...settings, reviewEnabled: false }, [], undefined)).toBeNull();
  });
  it('métricas e informe sin inventar datos', () => {
    const workouts = [wo({ date: '2026-10-20', startedAt: Date.UTC(2026, 9, 20), endedAt: Date.UTC(2026, 9, 20, 1), exercises: [ex({ sets: [set({ weight: 50, reps: 10 })] })] })];
    const m = computeReviewMetrics('2026-10-19', { workouts, bodyweights: [], measurements: [], plan: [], settings, weekGoals: [] });
    expect(m.completedSessions).toBe(1);
    expect(m.volumeKg).toBe(500);
    expect(m.weightAvg).toBeNull();
    const c = buildConclusions(m, emptyAnswers(), (k) => `${k} kg`);
    expect(c.evolution.join(' ')).toContain('No hay registros de peso');
    expect(c.attention.join(' ')).toContain('1 de 3');
    expect(c.compliance).toContain('1/3');
  });
});

describe('progresión', () => {
  it('sugiere incremento sólo con todas las series en el máximo del rango', () => {
    const re = { id: 're', exerciseId: 'ex-press-banca', restSec: null, notes: '', supersetId: null, effort: 'rpe' as const, sets: [1, 2, 3].map((i) => ({ id: String(i), type: 'normal' as const, repsMin: 8, repsMax: 10, weight: 80, rpe: null, rir: null, durationSec: null, distanceM: null })) };
    const ok = wo({ exercises: [ex({ sets: [10, 10, 10].map((r) => set({ weight: 80, reps: r, rpe: 8 })) })] });
    const s = suggestForExercise(re, [ok], 'barra');
    expect(s?.kind).toBe('increase');
    expect(s?.suggestedWeight).toBe(82.5);
    const hard = wo({ exercises: [ex({ sets: [10, 10, 10].map((r) => set({ weight: 80, reps: r, rpe: 10 })) })] });
    expect(suggestForExercise(re, [hard], 'barra')?.kind).toBe('hold');
    const short = wo({ exercises: [ex({ sets: [10, 9, 8].map((r) => set({ weight: 80, reps: r })) })] });
    expect(suggestForExercise(re, [short], 'barra')).toBeNull();
    expect(suggestForExercise(re, [], 'barra')).toBeNull();
  });
});

describe('buckets', () => {
  it('semanas y consistencia', () => {
    const ws = [wo({ date: '2026-10-05' }), wo({ date: '2026-10-07' }), wo({ date: '2026-10-14' })];
    const b = weeklyBuckets(ws, '2026-10-05', '2026-10-18');
    expect(b.map((x) => x.workouts)).toEqual([2, 1]);
    expect(consistency(b, () => 2, '2026-10-27')).toEqual({ met: 1, total: 2, pct: 50 });
    expect(periodStats(ws, '2026-10-06', '2026-10-31').workouts).toBe(2);
  });
});
