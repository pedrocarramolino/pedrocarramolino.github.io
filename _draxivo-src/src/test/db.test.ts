import { beforeEach, describe, expect, it } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { resetDBConnection } from '../db/database';
import * as repo from '../db/repo';
import { applyImport, exportBackup, exportCSV, planImport } from '../db/backup';

beforeEach(async () => {
  await resetDBConnection();
  globalThis.indexedDB = new IDBFactory();
});

describe('persistencia', () => {
  it('siembra la biblioteca una sola vez', async () => {
    const a = await repo.listExercises();
    expect(a.length).toBeGreaterThan(100);
    await resetDBConnection();
    const b = await repo.listExercises();
    expect(b.length).toBe(a.length);
  });

  it('rutinas ilimitadas, duplicar, archivar y eliminar sin perder historial', async () => {
    const ex = (await repo.listExercises())[0];
    for (let i = 0; i < 250; i++) await repo.saveRoutine(repo.emptyRoutine({ name: `R${i}`, exercises: [repo.newRoutineExercise(ex)] }));
    const all = await repo.listRoutines();
    expect(all.length).toBe(250);
    const r = all[0];
    const copy = await repo.duplicateRoutine(r.id, 'copy');
    expect(copy.id).not.toBe(r.id);
    expect(copy.exercises[0].id).not.toBe(r.exercises[0].id);
    const w = await repo.startWorkout({ routineId: r.id });
    w.exercises[0].sets[0] = { ...w.exercises[0].sets[0], weight: 50, reps: 10, completed: true };
    await repo.finishWorkout(w);
    await repo.setRoutineArchived(r.id, true);
    expect((await repo.getRoutine(r.id))?.archived).toBe(true);
    await repo.deleteRoutine(r.id);
    expect(await repo.getRoutine(r.id)).toBeUndefined();
    const hist = await repo.listWorkouts();
    expect(hist.length).toBe(1);
    expect(hist[0].routineName).toBe(r.name);
  });

  it('recupera sesión activa y descarta series incompletas al terminar', async () => {
    const ex = (await repo.listExercises())[0];
    const w = await repo.startWorkout();
    await expect(repo.startWorkout()).rejects.toThrow();
    w.exercises.push(repo.workoutExerciseFrom(ex, { sets: [repo.newWorkoutSet({ weight: 60, reps: 8, completed: true }), repo.newWorkoutSet()] }));
    await repo.saveWorkout(w);
    await resetDBConnection(); // simula recarga
    const recovered = await repo.getActiveWorkout();
    expect(recovered?.exercises[0].sets.length).toBe(2);
    const done = await repo.finishWorkout(recovered!);
    expect(done.status).toBe('completed');
    expect(done.exercises[0].sets.length).toBe(1);
    expect(await repo.getActiveWorkout()).toBeUndefined();
  });

  it('ejercicios personalizados: duplicados y archivado si se usan', async () => {
    const base = { primaryMuscle: 'pecho' as const, secondaryMuscles: [], equipment: 'otros' as const, movement: 'compuesto' as const, tracking: 'weight_reps' as const, instructions: '', notes: '', custom: true, archived: false };
    const e = await repo.saveExercise({ ...base, name: 'Mi press' });
    await expect(repo.saveExercise({ ...base, name: 'mi PRESS' })).rejects.toThrow();
    await repo.saveExercise({ ...e, notes: 'agarre medio' });
    expect((await repo.getExercise(e.id))?.notes).toBe('agarre medio');
    expect(await repo.deleteExercise(e.id)).toBe('deleted');
  });

  it('peso: corregir registros anteriores', async () => {
    const b = await repo.saveBodyWeight({ date: '2026-10-01', weightKg: 80 });
    await repo.saveBodyWeight({ ...b, weightKg: 79.4 });
    const all = await repo.listBodyWeights();
    expect(all.length).toBe(1);
    expect(all[0].weightKg).toBe(79.4);
    await expect(repo.saveBodyWeight({ date: '2026-10-01', weightKg: -1 })).rejects.toThrow();
  });

  it('exporta e importa sin duplicar ni borrar', async () => {
    await repo.saveBodyWeight({ date: '2026-10-01', weightKg: 80 });
    await repo.saveRoutine(repo.emptyRoutine({ name: 'A' }));
    await repo.saveReview({
      id: 'r1', weekStart: '2026-10-19', weekEnd: '2026-10-25', status: 'completed',
      metrics: { weekStart: '2026-10-19', weekEnd: '2026-10-25', plannedSessions: null, goalSessions: 3, completedSessions: 0, totalMinutes: 0, sets: 0, reps: 0, volumeKg: 0, muscleSets: {}, prs: [], weightStart: null, weightEnd: null, weightEntries: 0, weightAvg: null, prevWeightAvg: null, firstWeight: null, measurements: [], prevCompletedSessions: 0, prevVolumeKg: 0 },
      answers: { week: 3, energy: null, recovery: null, sleep: null, discomfort: '', bestThing: '', improve: '' },
      conclusions: { achievements: [], evolution: [], attention: [], compliance: '' }, nextGoalSessions: 3, nextGoalText: '', createdAt: 1, updatedAt: 1,
    });
    const backup = await exportBackup({ includePhotos: false });
    const text = JSON.stringify(backup);
    // Reimportar sobre los mismos datos: nada nuevo.
    const same = await planImport(text, { includeSettings: false });
    expect(same.ok && same.plan.total).toBe(0);
    // Base vacía: se importa todo.
    await resetDBConnection();
    globalThis.indexedDB = new IDBFactory();
    await repo.saveBodyWeight({ date: '2026-10-02', weightKg: 81 });
    const p = await planImport(text, { includeSettings: false });
    expect(p.ok).toBe(true);
    if (!p.ok) return;
    await applyImport(p.plan, { includeSettings: false });
    expect((await repo.listBodyWeights()).length).toBe(2);
    expect((await repo.listRoutines()).length).toBe(1);
    expect((await repo.listReviews()).length).toBe(1);
    // Archivo inválido: rechazado sin tocar nada.
    const bad = await planImport('{"app":"otra"}', { includeSettings: false });
    expect(bad.ok).toBe(false);
    const csv = await exportCSV('bodyweights');
    expect(csv).toContain('2026-10-02');
  });
});
