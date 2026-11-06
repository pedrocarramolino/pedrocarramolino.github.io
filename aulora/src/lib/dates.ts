import {
  addDays,
  addWeeks,
  differenceInMinutes,
  format,
  isSameDay,
  isSameMonth,
  parseISO,
  startOfDay,
  startOfWeek,
} from 'date-fns';
import { es } from 'date-fns/locale';

export { addDays, addWeeks, isSameDay, isSameMonth, startOfDay, differenceInMinutes };

export const WEEKDAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'] as const;
export const WEEKDAYS_SHORT = ['L', 'M', 'X', 'J', 'V', 'S', 'D'] as const;

/** Fecha local → 'yyyy-MM-dd' (sin desplazamientos de zona horaria). */
export function toDateKey(d: Date): string {
  return format(d, 'yyyy-MM-dd');
}

/** 'yyyy-MM-dd' → Date local a medianoche. */
export function fromDateKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** Lunes de la semana de la fecha dada. */
export function weekStartOf(d: Date): Date {
  return startOfWeek(d, { weekStartsOn: 1 });
}

export function weekKey(d: Date): string {
  return toDateKey(weekStartOf(d));
}

/** Día ISO de la semana: 1 = lunes … 7 = domingo. */
export function isoWeekday(d: Date): number {
  const w = d.getDay();
  return w === 0 ? 7 : w;
}

export function fmt(d: Date | string, pattern: string): string {
  const date = typeof d === 'string' ? parseISO(d) : d;
  return format(date, pattern, { locale: es });
}

export function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** «Semana del 9 al 15 de noviembre» */
export function weekLabel(weekStart: Date): string {
  const end = addDays(weekStart, 6);
  if (weekStart.getMonth() === end.getMonth()) {
    return `Semana del ${format(weekStart, 'd')} al ${format(end, "d 'de' MMMM", { locale: es })}`;
  }
  return `Semana del ${format(weekStart, "d 'de' MMMM", { locale: es })} al ${format(end, "d 'de' MMMM", { locale: es })}`;
}

export function shortWeekLabel(weekStart: Date): string {
  const end = addDays(weekStart, 6);
  return `${format(weekStart, 'd MMM', { locale: es })} – ${format(end, 'd MMM', { locale: es })}`;
}

export function timeOf(iso: string): string {
  return format(parseISO(iso), 'HH:mm');
}

export function timeRange(startIso: string, endIso: string): string {
  return `${timeOf(startIso)}–${timeOf(endIso)}`;
}

export function durationLabel(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

/** Combina una fecha local con 'HH:mm' y devuelve un Date local. */
export function atTime(day: Date, hhmm: string): Date {
  const [h, m] = hhmm.split(':').map(Number);
  return new Date(day.getFullYear(), day.getMonth(), day.getDate(), h, m || 0, 0, 0);
}

export function hhmm(d: Date): string {
  return format(d, 'HH:mm');
}

export function relativeDay(d: Date, now = new Date()): string {
  if (isSameDay(d, now)) return 'Hoy';
  if (isSameDay(d, addDays(now, 1))) return 'Mañana';
  if (isSameDay(d, addDays(now, -1))) return 'Ayer';
  return capitalize(format(d, "EEEE d 'de' MMMM", { locale: es }));
}

export function timeAgo(iso: string, now = new Date()): string {
  const mins = differenceInMinutes(now, parseISO(iso));
  if (mins < 1) return 'ahora';
  if (mins < 60) return `hace ${mins} min`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `hace ${d} ${d === 1 ? 'día' : 'días'}`;
  return format(parseISO(iso), "d MMM", { locale: es });
}

export { parseISO };
