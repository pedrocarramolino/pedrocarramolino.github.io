import type { BodyWeight } from '../db/types';
import { addDays, diffDays } from '../lib/dates';

export interface DayWeight {
  date: string;
  weight: number;
  count: number;
}

/** Promedio diario (si hay varias mediciones el mismo día). Ordenado por fecha. */
export function dailyWeights(entries: BodyWeight[]): DayWeight[] {
  const map = new Map<string, { sum: number; count: number }>();
  for (const e of entries) {
    const m = map.get(e.date) ?? { sum: 0, count: 0 };
    m.sum += e.weightKg;
    m.count++;
    map.set(e.date, m);
  }
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, { sum, count }]) => ({ date, weight: round2(sum / count), count }));
}

/** Media móvil de los últimos 7 días naturales para suavizar fluctuaciones diarias. */
export function trend(days: DayWeight[], windowDays = 7): { date: string; value: number }[] {
  const out: { date: string; value: number }[] = [];
  for (let i = 0; i < days.length; i++) {
    const from = addDays(days[i].date, -(windowDays - 1));
    let sum = 0;
    let n = 0;
    for (let j = i; j >= 0 && days[j].date >= from; j--) {
      sum += days[j].weight;
      n++;
    }
    out.push({ date: days[i].date, value: round2(sum / n) });
  }
  return out;
}

/**
 * Cambio respecto a la medición más cercana a `days` días antes del último registro.
 * Requiere una medición en una ventana razonable; si no la hay devuelve null (datos insuficientes).
 */
export function changeOver(days: DayWeight[], span: number, tolerance = Math.ceil(span / 2)) {
  if (days.length < 2) return null;
  const last = days[days.length - 1];
  const target = addDays(last.date, -span);
  let ref: DayWeight | null = null;
  for (const d of days) {
    if (d.date === last.date) continue;
    const dist = Math.abs(diffDays(d.date, target));
    if (dist <= tolerance && (!ref || dist < Math.abs(diffDays(ref.date, target)))) ref = d;
  }
  if (!ref) return null;
  return { from: ref, to: last, delta: round2(last.weight - ref.weight) };
}

export function averageIn(days: DayWeight[], from: string, to: string): number | null {
  const inRange = days.filter((d) => d.date >= from && d.date <= to);
  if (!inRange.length) return null;
  return round2(inRange.reduce((s, d) => s + d.weight, 0) / inRange.length);
}

export function weightSummary(entries: BodyWeight[]) {
  const days = dailyWeights(entries);
  const sorted = [...entries].sort((a, b) => (a.date + (a.time ?? '')).localeCompare(b.date + (b.time ?? '')) || a.createdAt - b.createdAt);
  const latest = sorted[sorted.length - 1] ?? null;
  const previous = sorted[sorted.length - 2] ?? null;
  const initial = sorted[0] ?? null;
  return {
    days,
    latest,
    previous,
    initial,
    diffPrevious: latest && previous ? round2(latest.weightKg - previous.weightKg) : null,
    weekly: changeOver(days, 7, 3),
    monthly: changeOver(days, 30, 10),
    trend: trend(days),
  };
}

export function round2(n: number) {
  return Math.round(n * 100) / 100;
}
