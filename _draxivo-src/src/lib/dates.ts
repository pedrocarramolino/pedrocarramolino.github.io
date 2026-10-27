// Utilidades de fechas. Las fechas de calendario se representan como claves
// "YYYY-MM-DD" y se operan en UTC para evitar errores por cambios de horario.

let currentTz: string | undefined;

export function setTimezone(tz: string | undefined) {
  currentTz = tz || undefined;
}

export function deviceTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

const dtfCache = new Map<string, Intl.DateTimeFormat>();
function partsFormatter(tz: string | undefined) {
  const k = tz ?? '__local';
  let f = dtfCache.get(k);
  if (!f) {
    try {
      f = new Intl.DateTimeFormat('en-CA', {
        timeZone: tz,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
      });
    } catch {
      f = new Intl.DateTimeFormat('en-CA', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
      });
    }
    dtfCache.set(k, f);
  }
  return f;
}

function parts(ms: number, tz = currentTz) {
  const out: Record<string, string> = {};
  for (const p of partsFormatter(tz).formatToParts(new Date(ms))) out[p.type] = p.value;
  return out;
}

/** Clave de fecha local (según la zona horaria configurada) de un instante. */
export function dateKey(ms: number = Date.now(), tz = currentTz): string {
  const p = parts(ms, tz);
  return `${p.year}-${p.month}-${p.day}`;
}

export function timeKey(ms: number = Date.now(), tz = currentTz): string {
  const p = parts(ms, tz);
  return `${p.hour}:${p.minute}`;
}

export function today(): string {
  return dateKey(Date.now());
}

export function isDateKey(s: unknown): s is string {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = keyToUTC(s);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

export function keyToUTC(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export function utcToKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function addDays(key: string, n: number): string {
  const d = keyToUTC(key);
  d.setUTCDate(d.getUTCDate() + n);
  return utcToKey(d);
}

export function addMonths(key: string, n: number): string {
  const d = keyToUTC(key);
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + n);
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, last));
  return utcToKey(d);
}

export function diffDays(a: string, b: string): number {
  return Math.round((keyToUTC(a).getTime() - keyToUTC(b).getTime()) / 86400000);
}

/** 0 = lunes … 6 = domingo */
export function weekday(key: string): number {
  return (keyToUTC(key).getUTCDay() + 6) % 7;
}

/** Lunes de la semana natural (lunes a domingo) que contiene la fecha. */
export function weekStart(key: string): string {
  return addDays(key, -weekday(key));
}

export function weekEnd(key: string): string {
  return addDays(weekStart(key), 6);
}

export function monthStart(key: string): string {
  return key.slice(0, 8) + '01';
}

export function daysInMonth(key: string): number {
  const [y, m] = key.split('-').map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

export function rangeKeys(from: string, to: string): string[] {
  const out: string[] = [];
  for (let k = from; k <= to; k = addDays(k, 1)) out.push(k);
  return out;
}

/** Semana ISO-8601 (lunes como primer día). */
export function isoWeek(key: string): { year: number; week: number } {
  const d = keyToUTC(key);
  const day = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - day + 3);
  const firstThursday = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  const week =
    1 + Math.round(((d.getTime() - firstThursday.getTime()) / 86400000 - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7);
  return { year: d.getUTCFullYear(), week };
}

const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const MONTHS_SHORT = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sept', 'oct', 'nov', 'dic'];
export const WEEKDAYS = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];
export const WEEKDAYS_SHORT = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
export const WEEKDAYS_ABBR = ['lun', 'mar', 'mié', 'jue', 'vie', 'sáb', 'dom'];

export function monthName(m: number) {
  return MONTHS[m];
}

export function fmtDateLong(key: string): string {
  const [y, m, d] = key.split('-').map(Number);
  return `${WEEKDAYS[weekday(key)]}, ${d} de ${MONTHS[m - 1]}${y !== Number(today().slice(0, 4)) ? ` de ${y}` : ''}`;
}

export function fmtDate(key: string, withYear?: boolean): string {
  const [y, m, d] = key.split('-').map(Number);
  const showYear = withYear ?? y !== Number(today().slice(0, 4));
  return `${d} ${MONTHS_SHORT[m - 1]}${showYear ? ` ${y}` : ''}`;
}

export function fmtDateShort(key: string): string {
  const [, m, d] = key.split('-').map(Number);
  return `${d}/${m}`;
}

export function fmtMonth(key: string): string {
  const [y, m] = key.split('-').map(Number);
  return `${MONTHS[m - 1]} ${y}`;
}

export function fmtRange(a: string, b: string): string {
  const [ya, ma, da] = a.split('-').map(Number);
  const [yb, mb, db] = b.split('-').map(Number);
  if (ya === yb && ma === mb) return `${da}–${db} ${MONTHS_SHORT[mb - 1]}${ya !== Number(today().slice(0, 4)) ? ` ${ya}` : ''}`;
  if (ya === yb) return `${da} ${MONTHS_SHORT[ma - 1]} – ${db} ${MONTHS_SHORT[mb - 1]}`;
  return `${da} ${MONTHS_SHORT[ma - 1]} ${ya} – ${db} ${MONTHS_SHORT[mb - 1]} ${yb}`;
}

export function relativeDay(key: string): string {
  const diff = diffDays(today(), key);
  if (diff === 0) return 'Hoy';
  if (diff === 1) return 'Ayer';
  if (diff > 1 && diff < 7) return `Hace ${diff} días`;
  if (diff === -1) return 'Mañana';
  return fmtDate(key);
}

export function fmtDuration(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function fmtMinutes(min: number): string {
  const m = Math.round(min);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r ? `${h} h ${r} min` : `${h} h`;
}

export function fmtSeconds(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, '0')}`;
}

/** Convierte una fecha y hora local (en la zona configurada) a milisegundos. */
export function localToMs(date: string, time = '12:00', tz = currentTz): number {
  const [y, mo, d] = date.split('-').map(Number);
  const [h, mi] = time.split(':').map(Number);
  const guess = Date.UTC(y, mo - 1, d, h, mi);
  // Ajuste por desfase de la zona horaria (dos iteraciones cubren cambios de horario).
  let ms = guess;
  for (let i = 0; i < 2; i++) {
    const p = parts(ms, tz);
    const asUTC = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute);
    ms += guess - asUTC;
  }
  return ms;
}
