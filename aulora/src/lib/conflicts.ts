export interface Interval {
  id?: string;
  start: Date;
  end: Date;
}

export interface Occupied {
  id: string;
  starts_at: string;
  ends_at: string;
  status: string;
}

/** Dos intervalos se solapan si uno empieza antes de que termine el otro (bordes no cuentan). */
export function overlaps(a: Interval, b: Interval): boolean {
  return a.start < b.end && b.start < a.end;
}

/**
 * Devuelve, para cada intervalo candidato, las clases existentes que lo pisan.
 * Las clases canceladas y las excluidas (p. ej. la propia clase que se mueve) no cuentan.
 */
export function findConflicts<T extends Occupied>(
  candidates: Interval[],
  existing: T[],
  exclude: Set<string> = new Set(),
): { candidate: Interval; with: T[] }[] {
  const active = existing
    .filter((l) => l.status !== 'cancelled' && !exclude.has(l.id))
    .map((l) => ({ l, start: new Date(l.starts_at), end: new Date(l.ends_at) }));
  const result: { candidate: Interval; with: T[] }[] = [];
  for (const c of candidates) {
    const hits = active.filter((a) => overlaps(c, a)).map((a) => a.l);
    if (hits.length) result.push({ candidate: c, with: hits });
  }
  return result;
}
