import { beforeEach, describe, expect, it } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { getDB, resetDBConnection } from '../db/database';
import * as repo from '../db/repo';
import { CATALOG, FILTER_GROUPS, alternativesFor, catalogEntry, guideFor } from '../data/catalog';
import { LEGACY_INSTRUCTIONS } from '../data/catalog/legacy';
import { TEMPLATES } from '../ui/figures/templates';
import { templateKeyFor } from '../ui/ExerciseArt';
import { EQUIPMENT, MUSCLES } from '../lib/labels';
import { seedExercises } from '../db/seedExercises';
import type { Equipment, MuscleGroup } from '../db/types';

beforeEach(async () => {
  await resetDBConnection();
  globalThis.indexedDB = new IDBFactory();
});

describe('catálogo de ejercicios', () => {
  it('tiene al menos 200 ejercicios con identificadores únicos', () => {
    const ids = CATALOG.map((e) => e.id);
    expect(CATALOG.length).toBeGreaterThanOrEqual(200);
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(CATALOG.map((e) => e.name)).size).toBe(CATALOG.length);
  });

  it('conserva todos los ejercicios anteriores con el mismo identificador', () => {
    for (const id of Object.keys(LEGACY_INSTRUCTIONS)) expect(catalogEntry(id), id).not.toBeNull();
  });

  it('cada ejercicio tiene datos completos, ilustración local, guía y sustituciones', () => {
    const all = seedExercises();
    for (const e of CATALOG) {
      expect(e.name.trim().length, e.id).toBeGreaterThan(3);
      expect(MUSCLES[e.primary], e.id).toBeTruthy();
      e.secondary.forEach((m) => expect(MUSCLES[m], `${e.id} ${m}`).toBeTruthy());
      expect(EQUIPMENT[e.equipment], e.id).toBeTruthy();
      expect(e.steps.length, e.id).toBeGreaterThanOrEqual(3);
      expect(TEMPLATES[e.art], e.id).toBeTruthy();
      const g = guideFor(e)!;
      expect(g.tips.length, e.id).toBeGreaterThanOrEqual(2);
      expect(g.mistakes.length, e.id).toBeGreaterThanOrEqual(2);
      e.alt.forEach((a) => expect(catalogEntry(a), `${e.id} → ${a}`).not.toBeNull());
      const ex = all.find((x) => x.id === `ex-${e.id}`)!;
      expect(templateKeyFor(ex)).toBe(e.art);
      expect(alternativesFor(ex, all).length, e.id).toBeGreaterThanOrEqual(2);
    }
  });

  it('cubre cada grupo muscular con material variado y los tres niveles', () => {
    const groups: [string, MuscleGroup[]][] = [
      ['pecho', ['pecho']],
      ['espalda', ['espalda']],
      ['hombros', ['hombros']],
      ['bíceps', ['biceps']],
      ['tríceps', ['triceps']],
      ['piernas', ['cuadriceps', 'isquios']],
      ['glúteos', ['gluteos']],
      ['core', ['abdominales']],
      ['gemelos', ['gemelos']],
      ['antebrazos', ['antebrazos']],
      ['cuerpo completo', ['cuerpo_completo']],
    ];
    for (const [name, muscles] of groups) {
      const list = CATALOG.filter((e) => muscles.includes(e.primary));
      const equip = new Set<Equipment>(list.map((e) => e.equipment));
      expect(list.length, name).toBeGreaterThanOrEqual(name === 'antebrazos' || name === 'cuerpo completo' ? 7 : 8);
      expect(equip.size, `${name}: ${[...equip]}`).toBeGreaterThanOrEqual(3);
      expect(list.some((e) => e.home), `${name} en casa`).toBe(true);
    }
    for (const l of ['principiante', 'intermedio', 'avanzado']) expect(CATALOG.some((e) => e.level === l)).toBe(true);
    expect(CATALOG.filter((e) => e.equipment === 'kettlebell').length).toBeGreaterThanOrEqual(12);
    expect(FILTER_GROUPS.find((g) => g.value === 'piernas')!.muscles).toEqual(['cuadriceps', 'isquios']);
  });

  it('incluye los básicos más populares', () => {
    for (const id of ['press-banca', 'sentadilla', 'peso-muerto', 'dominadas', 'remo-barra', 'press-militar', 'hip-thrust', 'zancadas', 'curl-barra', 'extension-polea', 'elevaciones-laterales', 'plancha', 'crunch'])
      expect(catalogEntry(id), id).not.toBeNull();
  });
});

describe('actualización de la biblioteca sin perder datos', () => {
  it('añade los ejercicios nuevos y respeta rutinas, historial, personalizados y ediciones', async () => {
    // Estado de una instalación con la biblioteca v2.
    const db = await getDB();
    const custom = await repo.saveExercise({ name: 'Mi press raro', primaryMuscle: 'pecho', secondaryMuscles: [], equipment: 'otros', movement: 'compuesto', tracking: 'weight_reps', instructions: '', notes: '', custom: true, archived: false } as never);
    const bench = (await db.get('exercises', 'ex-press-banca'))!;
    await db.put('exercises', { ...bench, instructions: 'Mis propias instrucciones.', notes: 'Agarre 81 cm' });
    const swing = (await db.get('exercises', 'ex-kettlebell-swing'))!;
    await db.put('exercises', { ...swing, equipment: 'otros' });
    const newIds = CATALOG.filter((e) => !(e.id in LEGACY_INSTRUCTIONS)).map((e) => `ex-${e.id}`);
    for (const id of newIds) await db.delete('exercises', id);
    await db.put('meta', { key: 'libraryVersion', value: 2 });
    const r = await repo.saveRoutine(repo.emptyRoutine({ name: 'Torso', exercises: [repo.newRoutineExercise(bench), repo.newRoutineExercise(custom)] }));
    const w = await repo.startWorkout({ routineId: r.id });
    w.exercises[0].sets[0] = { ...w.exercises[0].sets[0], weight: 80, reps: 5, completed: true };
    await repo.finishWorkout(w);
    expect((await repo.listExercises()).length).toBe(Object.keys(LEGACY_INSTRUCTIONS).length + 1);

    // Nueva versión de la app.
    await resetDBConnection();
    const all = await repo.listExercises();
    expect(all.length).toBe(CATALOG.length + 1);
    const b2 = all.find((e) => e.id === 'ex-press-banca')!;
    expect(b2.instructions).toBe('Mis propias instrucciones.');
    expect(b2.notes).toBe('Agarre 81 cm');
    expect(all.find((e) => e.id === 'ex-kettlebell-swing')!.equipment).toBe('kettlebell');
    expect(all.find((e) => e.id === custom.id)).toMatchObject({ name: 'Mi press raro', custom: true });
    const r2 = (await repo.getRoutine(r.id))!;
    expect(r2.exercises.map((e) => e.exerciseId)).toEqual(['ex-press-banca', custom.id]);
    const hist = await repo.listWorkouts();
    expect(hist).toHaveLength(1);
    expect(hist[0].exercises[0].sets[0]).toMatchObject({ weight: 80, reps: 5, completed: true });
    // Una segunda apertura no duplica nada.
    await resetDBConnection();
    expect((await repo.listExercises()).length).toBe(CATALOG.length + 1);
  });
});
