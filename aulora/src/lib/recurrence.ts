import { addDays } from 'date-fns';
import { atTime, fromDateKey, isoWeekday } from './dates';

export interface RecurrenceRule {
  weekdays: number[]; // 1 = lunes … 7 = domingo
  startTime: string; // 'HH:mm'
  startDate: string; // 'yyyy-MM-dd'
  endDate: string; // 'yyyy-MM-dd'
}

export const MAX_OCCURRENCES = 400;

/**
 * Genera las fechas/horas locales de cada sesión de una serie recurrente.
 * Se calculan en hora local, por lo que los cambios de horario (DST) mantienen
 * la misma hora de reloj.
 */
export function generateOccurrences(rule: RecurrenceRule): Date[] {
  const start = fromDateKey(rule.startDate);
  const end = fromDateKey(rule.endDate);
  if (end < start || rule.weekdays.length === 0) return [];
  const days = new Set(rule.weekdays);
  const out: Date[] = [];
  for (let d = start; d <= end && out.length < MAX_OCCURRENCES; d = addDays(d, 1)) {
    if (days.has(isoWeekday(d))) out.push(atTime(d, rule.startTime));
  }
  return out;
}

/** Aplica una nueva hora de reloj a una fecha conservando el día. */
export function withClockTime(iso: string, hhmm: string): Date {
  return atTime(new Date(iso), hhmm);
}
