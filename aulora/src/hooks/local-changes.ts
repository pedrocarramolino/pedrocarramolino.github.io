'use client';
import type { Query, QueryClient } from '@tanstack/react-query';
import { toAppDoc, type LocalChange } from '@/services/api';
import type { Assignment, Category, Goal, Group, Lesson, ProgressNote, Student, TaskWithAssignments } from '@/lib/types';

/**
 * Aplica a la caché de React Query los cambios que se acaban de guardar en el
 * dispositivo, para que todas las pantallas los muestren al instante. Después,
 * las consultas se refrescan con el servidor como siempre.
 */
export function applyLocalChanges(qc: QueryClient, changes: LocalChange[]) {
  const refresh = new Set<string>();
  for (const c of changes) {
    if (c.value === 'refresh') {
      refresh.add(c.coll);
      continue;
    }
    const doc = c.value === null ? null : toAppDoc(c.coll, c.id, c.value);
    switch (c.coll) {
      case 'students':
        patchList<Student>(qc, (k) => k[0] === 'students', c.id, doc as Student | null, () => true, byName);
        break;
      case 'groups':
        patchList<Group>(qc, (k) => k[0] === 'groups', c.id, doc as Group | null, () => true, (a, b) => a.name.localeCompare(b.name, 'es'));
        break;
      case 'categories':
        patchList<Category>(qc, (k) => k[0] === 'categories', c.id, doc as Category | null, () => true, (a, b) => a.sort_order - b.sort_order);
        break;
      case 'lessons':
        applyLesson(qc, c.id, doc as Lesson | null);
        break;
      case 'tasks':
        applyTask(qc, c.id, doc as TaskWithAssignments | null);
        break;
      case 'notes': {
        const n = doc as ProgressNote | null;
        patchList<ProgressNote>(qc, (k) => k[0] === 'notes' || k[0] === 'all-notes', c.id, n, (k, x) => k[0] === 'all-notes' || k[1] === x.student_id, byNoted);
        break;
      }
      case 'goals': {
        const g = doc as Goal | null;
        patchList<Goal>(qc, (k) => k[0] === 'goals' || k[0] === 'all-goals', c.id, g, (k, x) => k[0] === 'all-goals' || k[1] === x.student_id);
        break;
      }
      default:
        refresh.add(c.coll);
    }
  }
  // lo que no se puede aplicar directamente se recarga
  if (refresh.size) {
    const roots: Record<string, string[]> = {
      students: ['students'],
      groups: ['groups'],
      lessons: ['lessons', 'lesson', 'lessons-for'],
      tasks: ['tasks-week', 'tasks-weeks', 'tasks-student', 'tasks-group', 'pending-assignments'],
      series: [],
      categories: ['categories'],
      notes: ['notes', 'all-notes'],
      goals: ['goals', 'all-goals'],
    };
    const keys = new Set([...refresh].flatMap((c) => roots[c] ?? []));
    if (keys.size) void qc.invalidateQueries({ predicate: (q) => keys.has(String(q.queryKey[0])) });
  }
}

type Key = readonly unknown[];

/**
 * Actualiza un elemento en todas las listas cacheadas que cumplan `which`:
 * lo sustituye, lo añade si ahora pertenece a la lista o lo quita si ya no.
 */
function patchList<T extends { id: string }>(
  qc: QueryClient,
  which: (k: Key) => boolean,
  id: string,
  item: T | null,
  belongs: (k: Key, item: T) => boolean,
  sort?: (a: T, b: T) => number,
) {
  for (const q of qc.getQueryCache().findAll({ predicate: (q: Query) => which(q.queryKey) })) {
    const list = q.state.data as T[] | undefined;
    if (!Array.isArray(list)) continue;
    const without = list.filter((x) => x.id !== id);
    const next = item && belongs(q.queryKey, item) ? [...without, item] : without;
    if (sort) next.sort(sort);
    qc.setQueryData(q.queryKey, next);
  }
}

const byName = (a: Student, b: Student) =>
  [a.first_name, a.last_name].join(' ').localeCompare([b.first_name, b.last_name].join(' '), 'es');
const byNoted = (a: ProgressNote, b: ProgressNote) => b.noted_on.localeCompare(a.noted_on) || b.created_at.localeCompare(a.created_at);

function applyLesson(qc: QueryClient, id: string, l: Lesson | null) {
  // rangos de la agenda: ['lessons', desde, hasta]
  patchList<Lesson>(
    qc,
    (k) => k[0] === 'lessons',
    id,
    l,
    (k, x) => x.starts_at >= new Date(String(k[1])).toISOString() && x.starts_at < new Date(String(k[2])).toISOString(),
    (a, b) => a.starts_at.localeCompare(b.starts_at),
  );
  // clases de un alumno/grupo: ['lessons-for', alumno, ...grupos]
  patchList<Lesson>(
    qc,
    (k) => k[0] === 'lessons-for',
    id,
    l,
    (k, x) => (x.student_id !== null && x.student_id === k[1]) || (x.group_id !== null && k.slice(2).includes(x.group_id)),
    (a, b) => b.starts_at.localeCompare(a.starts_at),
  );
  // ficha de una clase: ['lesson', id]
  if (l) qc.setQueryData(['lesson', id], l);
}

function applyTask(qc: QueryClient, id: string, t: TaskWithAssignments | null) {
  const byWeek = (a: TaskWithAssignments, b: TaskWithAssignments) => a.week_start.localeCompare(b.week_start) || a.created_at.localeCompare(b.created_at);
  const newestWeekFirst = (a: TaskWithAssignments, b: TaskWithAssignments) => b.week_start.localeCompare(a.week_start) || a.created_at.localeCompare(b.created_at);
  patchList<TaskWithAssignments>(qc, (k) => k[0] === 'tasks-week', id, t, (k, x) => x.week_start === k[1], byWeek);
  patchList<TaskWithAssignments>(qc, (k) => k[0] === 'tasks-weeks', id, t, (k, x) => x.week_start >= String(k[1]) && x.week_start <= String(k[2]), byWeek);
  patchList<TaskWithAssignments>(qc, (k) => k[0] === 'tasks-student', id, t, (k, x) => x.assignments.some((a) => a.student_id === k[1]), newestWeekFirst);
  patchList<TaskWithAssignments>(qc, (k) => k[0] === 'tasks-group', id, t, (k, x) => x.group_id === k[1], newestWeekFirst);
  // asignaciones pendientes (inicio y lista de alumnos)
  const pending = qc.getQueryData<Assignment[]>(['pending-assignments']);
  if (Array.isArray(pending)) {
    const others = pending.filter((a) => a.task_id !== id);
    const mine = t ? t.assignments.filter((a) => a.status === 'pending' || a.status === 'in_progress') : [];
    qc.setQueryData(['pending-assignments'], [...others, ...mine]);
  }
}
