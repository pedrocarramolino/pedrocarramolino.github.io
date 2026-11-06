import type { Lesson } from '@/lib/types';

export interface Positioned {
  lesson: Lesson;
  col: number;
  cols: number;
}

/**
 * Reparte en columnas las clases que se solapan dentro de un mismo día
 * (como en Apple Calendar): cada grupo de solapes comparte el ancho.
 */
export function layoutDay(lessons: Lesson[]): Positioned[] {
  const sorted = [...lessons].sort((a, b) => a.starts_at.localeCompare(b.starts_at) || b.duration_minutes - a.duration_minutes);
  const out: Positioned[] = [];
  let cluster: { lesson: Lesson; col: number }[] = [];
  let clusterEnd = 0;
  let colEnds: number[] = [];

  const flush = () => {
    const cols = Math.max(1, colEnds.length);
    for (const c of cluster) out.push({ lesson: c.lesson, col: c.col, cols });
    cluster = [];
    colEnds = [];
  };

  for (const l of sorted) {
    const s = new Date(l.starts_at).getTime();
    const e = new Date(l.ends_at).getTime();
    if (cluster.length && s >= clusterEnd) flush();
    let col = colEnds.findIndex((end) => end <= s);
    if (col === -1) {
      col = colEnds.length;
      colEnds.push(e);
    } else colEnds[col] = e;
    cluster.push({ lesson: l, col });
    clusterEnd = Math.max(clusterEnd, e);
  }
  flush();
  return out;
}
