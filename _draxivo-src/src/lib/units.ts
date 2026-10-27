// Conversión de unidades sólo para presentación. Internamente siempre kg y cm.
const LB = 2.2046226218;
const IN = 2.54;

let weightUnit: 'kg' | 'lb' = 'kg';
let lengthUnit: 'cm' | 'in' = 'cm';

export function setUnits(w: 'kg' | 'lb', l: 'cm' | 'in') {
  weightUnit = w;
  lengthUnit = l;
}
export const wUnit = () => weightUnit;
export const lUnit = () => lengthUnit;

const nf = (max: number) => new Intl.NumberFormat('es-ES', { maximumFractionDigits: max, minimumFractionDigits: 0 });
const nf1 = nf(1);
const nf2 = nf(2);
const nf0 = nf(0);

export function num(n: number, digits = 1): string {
  return (digits === 0 ? nf0 : digits === 2 ? nf2 : nf1).format(n);
}

/** kg → valor visible en la unidad configurada. */
export function toDisplayWeight(kg: number): number {
  return weightUnit === 'lb' ? Math.round(kg * LB * 10) / 10 : Math.round(kg * 100) / 100;
}
/** Valor introducido en la unidad configurada → kg. */
export function fromDisplayWeight(v: number): number {
  return weightUnit === 'lb' ? Math.round((v / LB) * 1000) / 1000 : v;
}
export function fmtWeight(kg: number | null | undefined, digits = 1): string {
  if (kg == null) return '—';
  return `${num(toDisplayWeight(kg), digits)} ${weightUnit}`;
}
export function fmtWeightNum(kg: number | null | undefined, digits = 1): string {
  if (kg == null) return '—';
  return num(toDisplayWeight(kg), digits);
}
export function fmtSigned(kg: number, digits = 1): string {
  const v = toDisplayWeight(kg);
  if (Math.abs(v) < 0.05) return `0 ${weightUnit}`;
  return `${v > 0 ? '+' : '−'}${num(Math.abs(v), digits)} ${weightUnit}`;
}
export function fmtVolume(kg: number): string {
  const v = toDisplayWeight(kg);
  if (v >= 10000) return weightUnit === 'kg' ? `${num(v / 1000, 1)} t` : `${num(v / 1000, 1)}k lb`;
  return `${num(v, 0)} ${weightUnit}`;
}

export function toDisplayLength(cm: number): number {
  return lengthUnit === 'in' ? Math.round((cm / IN) * 10) / 10 : cm;
}
export function fromDisplayLength(v: number): number {
  return lengthUnit === 'in' ? Math.round(v * IN * 10) / 10 : v;
}
export function fmtLength(cm: number): string {
  return `${num(toDisplayLength(cm), 1)} ${lengthUnit}`;
}

export function fmtDistance(m: number | null | undefined): string {
  if (!m) return '—';
  return m >= 1000 ? `${num(m / 1000, 2)} km` : `${num(m, 0)} m`;
}

/** Acepta coma o punto decimal. Devuelve null si está vacío o no es válido. */
export function parseNum(s: string): number | null {
  const t = s.trim().replace(',', '.');
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}
