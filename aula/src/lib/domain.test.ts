import { describe, expect, it } from 'vitest';
import { generateOccurrences } from './recurrence';
import { findConflicts, overlaps } from './conflicts';
import { weekKey, weekLabel, fromDateKey, toDateKey, durationLabel, isoWeekday } from './dates';
import { nextStatus } from './labels';

describe('recurrencia', () => {
  it('genera solo los días elegidos entre inicio y fin (ambos incluidos)', () => {
    const occ = generateOccurrences({ weekdays: [1, 3], startTime: '17:30', startDate: '2026-11-09', endDate: '2026-11-23' });
    expect(occ.map((d) => `${toDateKey(d)} ${d.getHours()}:${d.getMinutes()}`)).toEqual([
      '2026-11-09 17:30',
      '2026-11-11 17:30',
      '2026-11-16 17:30',
      '2026-11-18 17:30',
      '2026-11-23 17:30',
    ]);
  });
  it('mantiene la hora de reloj al cruzar un cambio de horario', () => {
    const occ = generateOccurrences({ weekdays: [7], startTime: '10:00', startDate: '2026-10-18', endDate: '2026-11-01' });
    expect(occ.every((d) => d.getHours() === 10)).toBe(true);
    expect(occ).toHaveLength(3);
  });
  it('devuelve vacío con fin anterior al inicio o sin días', () => {
    expect(generateOccurrences({ weekdays: [1], startTime: '10:00', startDate: '2026-11-10', endDate: '2026-11-01' })).toEqual([]);
    expect(generateOccurrences({ weekdays: [], startTime: '10:00', startDate: '2026-11-01', endDate: '2026-12-01' })).toEqual([]);
  });
});

describe('conflictos', () => {
  const d = (h: number, m = 0) => new Date(2026, 10, 9, h, m);
  const lesson = (id: string, s: Date, e: Date, status = 'scheduled') => ({ id, starts_at: s.toISOString(), ends_at: e.toISOString(), status });

  it('detecta solapes y no cuenta los bordes', () => {
    expect(overlaps({ start: d(17), end: d(18) }, { start: d(17, 30), end: d(18, 30) })).toBe(true);
    expect(overlaps({ start: d(17), end: d(18) }, { start: d(18), end: d(19) })).toBe(false);
  });
  it('ignora canceladas y la propia clase', () => {
    const existing = [lesson('a', d(17), d(18)), lesson('b', d(17), d(18), 'cancelled')];
    expect(findConflicts([{ start: d(17, 15), end: d(17, 45) }], existing)).toHaveLength(1);
    expect(findConflicts([{ start: d(17, 15), end: d(17, 45) }], existing, new Set(['a']))).toHaveLength(0);
  });
});

describe('fechas', () => {
  it('la semana empieza en lunes', () => {
    expect(weekKey(new Date(2026, 10, 15))).toBe('2026-11-09'); // domingo
    expect(weekKey(new Date(2026, 10, 9))).toBe('2026-11-09');
    expect(isoWeekday(new Date(2026, 10, 15))).toBe(7);
  });
  it('etiqueta de semana en español', () => {
    expect(weekLabel(fromDateKey('2026-11-09'))).toBe('Semana del 9 al 15 de noviembre');
    expect(weekLabel(fromDateKey('2026-11-30'))).toBe('Semana del 30 de noviembre al 6 de diciembre');
  });
  it('duraciones legibles', () => {
    expect(durationLabel(45)).toBe('45 min');
    expect(durationLabel(90)).toBe('1 h 30 min');
    expect(durationLabel(120)).toBe('2 h');
  });
});

describe('estados de tarea', () => {
  it('avanza en ciclo', () => {
    expect(nextStatus('pending')).toBe('in_progress');
    expect(nextStatus('in_progress')).toBe('completed');
    expect(nextStatus('completed')).toBe('reviewed');
    expect(nextStatus('reviewed')).toBe('pending');
  });
});
