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

import { passwordIssues, validateNewPassword } from './password';

describe('contraseñas', () => {
  it('exige 8 caracteres, una letra y un número', () => {
    expect(passwordIssues('abc')).toEqual(['Al menos 8 caracteres', 'Al menos un número']);
    expect(passwordIssues('12345678')).toEqual(['Al menos una letra']);
    expect(passwordIssues('ñandú2026')).toEqual([]);
  });
  it('valida la confirmación', () => {
    expect(validateNewPassword('secreto123', 'secreto124')).toBe('Las contraseñas no coinciden.');
    expect(validateNewPassword('secreto123', 'secreto123')).toBeNull();
    expect(validateNewPassword('corta1', 'corta1')).toMatch(/no cumple/);
  });
});

describe('campos numéricos', () => {
  it('quita ceros a la izquierda y caracteres no numéricos', async () => {
    const { cleanDigits } = await import('@/components/ui/controls');
    expect(cleanDigits('045')).toBe('45');
    expect(cleanDigits('0')).toBe('0');
    expect(cleanDigits('')).toBe('');
    expect(cleanDigits('4a5')).toBe('45');
    expect(cleanDigits('00090', 3)).toBe('90');
  });
});

describe('aviso de sincronización', () => {
  it('reconoce los errores que impiden guardar en la nube', async () => {
    const { describeSyncError } = await import('./sync-status');
    expect(describeSyncError({ code: 'not-found', message: 'The database (default) does not exist for project aulora-f71ea' })?.message).toBe(
      'La base de datos en la nube no existe todavía.',
    );
    expect(describeSyncError({ code: 'permission-denied', message: 'Missing or insufficient permissions.' })?.message).toMatch(/reglas de Firestore/);
    // cortes de red pasajeros no son un error grave (se reintentan solos)
    expect(describeSyncError({ code: 'unavailable', message: 'offline' })).toBeNull();
  });
});
