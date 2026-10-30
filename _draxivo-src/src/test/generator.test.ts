import { describe, expect, it } from 'vitest';
import { seedExercises } from '../db/seedExercises';
import { estimatePlanMinutes, generatePlan, parseRequest, planToRoutine } from '../domain/generator';

const exercises = seedExercises();
const byId = new Map(exercises.map((e) => [e.id, e]));

describe('interpretación del texto', () => {
  it('reconoce músculos, tiempo, material y nivel en frases naturales', () => {
    expect(parseRequest('Quiero entrenar bíceps y tríceps durante 45 minutos')).toMatchObject({ muscles: ['biceps', 'triceps'], minutes: 45 });
    expect(parseRequest('hoy quiero darle a pecho y hombro').muscles).toEqual(['pecho', 'hombros']);
    expect(parseRequest('pierna una hora en casa sin material')).toMatchObject({ muscles: ['cuadriceps', 'isquios', 'gluteos', 'gemelos'], minutes: 60, equipment: ['peso_corporal'] });
    expect(parseRequest('espalda y abs 30 min con mancuernas, soy principiante')).toMatchObject({ muscles: ['espalda', 'abdominales'], minutes: 30, equipment: ['mancuernas'], level: 'principiante' });
    expect(parseRequest('full body hora y media').minutes).toBe(90);
    expect(parseRequest('brazos media hora').minutes).toBe(30);
  });
});

describe('generación', () => {
  it('bíceps y tríceps en 45 min: sólo ejercicios de esos músculos y duración ajustada', () => {
    const plan = generatePlan({ muscles: ['biceps', 'triceps'], minutes: 45, equipment: ['gym'], level: 'intermedio', seed: 1 }, exercises);
    const muscles = new Set(plan.items.map((i) => byId.get(i.exerciseId)!.primaryMuscle));
    expect([...muscles].sort()).toEqual(['biceps', 'triceps']);
    expect(plan.items.length).toBeGreaterThanOrEqual(4);
    const min = estimatePlanMinutes(plan.items);
    expect(min).toBeLessThanOrEqual(47);
    expect(min).toBeGreaterThanOrEqual(35);
    // Sin ejercicios repetidos.
    expect(new Set(plan.items.map((i) => i.exerciseId)).size).toBe(plan.items.length);
  });

  it('pecho 20 min con mancuernas: material respetado y no excede el tiempo', () => {
    const plan = generatePlan({ muscles: ['pecho'], minutes: 20, equipment: ['mancuernas'], level: 'intermedio', seed: 3 }, exercises);
    expect(plan.items.length).toBeGreaterThanOrEqual(2);
    for (const i of plan.items) {
      const ex = byId.get(i.exerciseId)!;
      expect(ex.primaryMuscle).toBe('pecho');
      expect(['mancuernas', 'peso_corporal']).toContain(ex.equipment);
    }
    expect(estimatePlanMinutes(plan.items)).toBeLessThanOrEqual(21);
  });

  it('nunca supera claramente el tiempo disponible', () => {
    for (const minutes of [15, 20, 30, 45, 60, 90]) {
      for (const muscles of [['pecho', 'espalda'], ['cuadriceps', 'isquios', 'gluteos', 'gemelos'], ['cuerpo_completo'], ['hombros']] as const) {
        const plan = generatePlan({ muscles: [...muscles], minutes, equipment: ['gym'], level: 'intermedio', seed: 7 }, exercises);
        expect(plan.items.length).toBeGreaterThan(0);
        expect(estimatePlanMinutes(plan.items)).toBeLessThanOrEqual(Math.round(minutes * 1.08) + 1);
      }
    }
  });

  it('principiante evita ejercicios técnicos y genera rutina guardable', () => {
    const plan = generatePlan({ muscles: ['cuerpo_completo'], minutes: 60, equipment: ['gym'], level: 'principiante', seed: 2 }, exercises);
    const ids = plan.items.map((i) => i.exerciseId);
    expect(ids).not.toContain('ex-arrancada');
    expect(ids).not.toContain('ex-sentadilla-frontal');
    const r = planToRoutine(plan, byId, 'Prueba');
    expect(r.exercises.length).toBe(plan.items.length);
    expect(r.estimatedMin).toBeGreaterThan(0);
  });

  it('peso corporal sin barra de dominadas no propone dominadas ni fondos', () => {
    const plan = generatePlan({ muscles: ['espalda', 'pecho'], minutes: 30, equipment: ['peso_corporal'], level: 'intermedio' }, exercises);
    const ids = plan.items.map((i) => i.exerciseId);
    expect(ids.some((i) => i.includes('dominadas') || i.includes('fondos-pecho'))).toBe(false);
  });
});
