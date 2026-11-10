'use client';
import { useEffect, useMemo } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient, type QueryClient, type UseQueryResult } from '@tanstack/react-query';
import { toast } from 'sonner';
import { allLessons, lessonApi, live, type LiveDef } from '@/services/api';
import { firebaseAuth } from '@/lib/firebase';
import { reportServerSeen, reportSyncError } from '@/lib/sync-status';
import type { Category, Group, Lesson, Student } from '@/lib/types';

export const qk = {
  profile: ['profile'] as const,
  categories: ['categories'] as const,
  students: ['students'] as const,
  groups: ['groups'] as const,
  members: ['members'] as const,
  lessons: (from: string, to: string) => ['lessons', from, to] as const,
  lesson: (id: string) => ['lesson', id] as const,
  lessonsFor: (studentId: string | null, groupIds: string[]) => ['lessons-for', studentId, ...groupIds] as const,
  tasksWeek: (week: string) => ['tasks-week', week] as const,
  tasksWeeks: (from: string, to: string) => ['tasks-weeks', from, to] as const,
  tasksStudent: (id: string) => ['tasks-student', id] as const,
  tasksGroup: (id: string) => ['tasks-group', id] as const,
  notes: (id: string) => ['notes', id] as const,
  goals: (id: string) => ['goals', id] as const,
  activity: ['activity'] as const,
  pending: ['pending-assignments'] as const,
};

/** Grupos de claves a refrescar tras cada tipo de cambio. */
export const affects = {
  students: ['students', 'members', 'activity', 'tasks-week', 'tasks-weeks', 'pending-assignments'],
  groups: ['groups', 'students', 'activity'],
  lessons: ['lessons', 'lesson', 'lessons-for', 'all-lessons', 'activity'],
  tasks: ['tasks-week', 'tasks-weeks', 'tasks-student', 'tasks-group', 'pending-assignments', 'activity', 'copies', 'search', 'palette'],
  progress: ['notes', 'goals', 'activity', 'all-goals', 'all-notes'],
  categories: ['categories'],
  profile: ['profile'],
};

export function useInvalidate() {
  const qc = useQueryClient();
  return (...groups: (keyof typeof affects)[]) => {
    const roots = new Set(groups.flatMap((g) => affects[g]));
    // las consultas en vivo se actualizan solas: no hace falta volver a pedirlas
    return qc.invalidateQueries({ predicate: (q) => roots.has(String(q.queryKey[0])) && !q.meta?.live });
  };
}

/**
 * Mutación con notificación de éxito/error e invalidación de caché.
 */
export function useAction<TArgs, TResult>(
  fn: (args: TArgs) => Promise<TResult>,
  opts: { success?: string | ((r: TResult, a: TArgs) => string | null); invalidate?: (keyof typeof affects)[]; onDone?: (r: TResult, a: TArgs) => void } = {},
) {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: fn,
    onSuccess: (r, a) => {
      // las listas se refrescan en segundo plano: no hace falta esperarlas para cerrar
      if (opts.invalidate) void invalidate(...opts.invalidate);
      const msg = typeof opts.success === 'function' ? opts.success(r, a) : opts.success;
      if (msg) toast.success(msg);
      opts.onDone?.(r, a);
    },
    onError: (e: Error) => toast.error(e.message || 'No se pudo guardar'),
  });
}

// -------------------------------------------------------------- consultas en vivo
/**
 * Un solo oyente de Firestore por consulta, compartido entre componentes.
 * Se mantiene unos segundos tras desmontar para no reabrirlo al navegar.
 */
const listeners = new Map<string, { count: number; unsub: () => void; timer?: ReturnType<typeof setTimeout> }>();

function attach<T>(qc: QueryClient, key: readonly unknown[], def: () => LiveDef<T>) {
  const hash = JSON.stringify(key);
  let entry = listeners.get(hash);
  if (entry?.timer) clearTimeout(entry.timer);
  if (!entry) {
    let unsub = () => {};
    try {
      unsub = def().subscribe(
        (data, meta) => {
          if (!meta.fromCache) {
            markWarm();
            reportServerSeen();
          }
          // una caché vacía solo se muestra si el dispositivo ya estaba sincronizado
          if (meta.fromCache && meta.empty && !cacheIsWarm()) return;
          qc.setQueryData(key, data);
        },
        (e) => reportSyncError(e),
      );
    } catch {
      // sin sesión todavía
    }
    entry = { count: 0, unsub };
    listeners.set(hash, entry);
  }
  entry.count++;
  return () => {
    const e = listeners.get(hash);
    if (!e) return;
    e.count--;
    if (e.count <= 0) {
      e.timer = setTimeout(() => {
        if (e.count <= 0) {
          e.unsub();
          listeners.delete(hash);
        }
      }, 30_000);
    }
  };
}

/**
 * ¿Este dispositivo ya ha sincronizado antes con la cuenta actual? Entonces su
 * caché está completa y una lista vacía en caché es fiable (se muestra al
 * instante; si no lo fuera, el oyente en vivo la corrige al llegar el servidor).
 * Se guarda solo una marca (no datos) en localStorage.
 */
const WARM_KEY = 'aulora-cache-warm';
function cacheIsWarm() {
  try {
    const uid = firebaseAuth().currentUser?.uid;
    return !!uid && localStorage.getItem(WARM_KEY) === uid;
  } catch {
    return false;
  }
}
function markWarm() {
  try {
    const uid = firebaseAuth().currentUser?.uid;
    if (uid && localStorage.getItem(WARM_KEY) !== uid) localStorage.setItem(WARM_KEY, uid);
  } catch {
    // sin almacenamiento
  }
}

/** Primera respuesta de una consulta en vivo (caché si tiene datos; si no, servidor). */
function firstValue<T>(def: () => LiveDef<T>, emptyValue: T): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    let done = false;
    let cached: T | undefined;
    let unsub: () => void = () => {};
    const finish = (fn: () => void) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      fn();
      queueMicrotask(() => unsub());
    };
    // sin conexión: no dejar la pantalla cargando indefinidamente
    const timer = setTimeout(() => finish(() => resolve(cached ?? emptyValue)), 6000);
    try {
      unsub = def().subscribe(
        (data, meta) => {
          if (!meta.fromCache) markWarm();
          if (meta.fromCache && meta.empty && !cacheIsWarm()) {
            cached = data;
            return;
          }
          finish(() => resolve(data));
        },
        (e) => {
          reportSyncError(e);
          finish(() => reject(e));
        },
      );
    } catch (e) {
      finish(() => reject(e));
    }
  });
}

function useLive<T>(
  key: readonly unknown[],
  def: () => LiveDef<T>,
  emptyValue: NoInfer<T>,
  opts: { enabled?: boolean; keepPrevious?: boolean } = {},
): UseQueryResult<T, Error> {
  const qc = useQueryClient();
  const enabled = opts.enabled ?? true;
  const hash = JSON.stringify(key);
  useEffect(() => {
    if (!enabled) return;
    return attach(qc, key, def);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hash, enabled, qc]);
  return useQuery<T, Error, T>({
    queryKey: key,
    queryFn: () => firstValue(def, emptyValue),
    enabled,
    staleTime: Infinity,
    meta: { live: true },
    // al cambiar de semana o de rango se mantiene lo anterior mientras llega lo nuevo
    placeholderData: opts.keepPrevious ? keepPreviousData : undefined,
  });
}

const EMPTY: never[] = [];

export const useProfile = () => useLive(qk.profile, live.profile, null);
export const useCategories = () => useLive(qk.categories, live.categories, EMPTY);
export const useStudents = () => useLive(qk.students, live.students, EMPTY);
export const useGroups = () => useLive(qk.groups, live.groups, EMPTY);
export const useLessonsRange = (from: string, to: string) => useLive(qk.lessons(from, to), () => live.lessonsRange(from, to), EMPTY, { keepPrevious: true });
export const useLesson = (id: string) => useLive<Lesson>(qk.lesson(id), () => live.lesson(id), null as unknown as Lesson);
export const useTasksWeek = (week: string) => useLive(qk.tasksWeek(week), () => live.tasksWeek(week), EMPTY, { keepPrevious: true });
export const useTasksWeeks = (from: string, to: string) => useLive(qk.tasksWeeks(from, to), () => live.tasksWeeks(from, to), EMPTY);
export const useStudentTasks = (id: string) => useLive(qk.tasksStudent(id), () => live.tasksStudent(id), EMPTY);
export const useGroupTasks = (id: string) => useLive(qk.tasksGroup(id), () => live.tasksGroup(id), EMPTY);
export const useNotes = (id: string) => useLive(qk.notes(id), () => live.notes(id), EMPTY);
export const useGoals = (id: string) => useLive(qk.goals(id), () => live.goals(id), EMPTY);
export const useActivity = () => useLive(qk.activity, () => live.activity(12), EMPTY);
export const usePendingAssignments = () => useLive(qk.pending, live.pending, EMPTY);
export const useAllGoals = () => useLive(['all-goals'], live.allGoals, EMPTY);
export const useAllNotes = () => useLive(['all-notes'], live.allNotes, EMPTY);
export const useAllTasks = (enabled = true) => useLive(['all-tasks'], live.allTasks, EMPTY, { enabled });
/** Todas las clases (búsqueda): una lectura y se reutiliza unos minutos. */
export const useAllLessons = (enabled = true) => useQuery({ queryKey: ['all-lessons'], queryFn: allLessons, enabled, staleTime: 5 * 60_000 });
export const useLessonsFor = (studentId: string | null, groupIds: string[]) =>
  useQuery({ queryKey: qk.lessonsFor(studentId, groupIds), queryFn: () => lessonApi.forTarget(studentId, groupIds) });

export function studentName(s: Pick<Student, 'first_name' | 'last_name'> | undefined | null) {
  if (!s) return 'Alumno eliminado';
  return [s.first_name, s.last_name].filter(Boolean).join(' ');
}

/**
 * Índices en memoria de alumnos, grupos, pertenencias y categorías.
 * Los usan casi todas las pantallas para resolver nombres y colores.
 */
export function useLookup() {
  const students = useStudents();
  const groups = useGroups();
  const categories = useCategories();

  return useMemo(() => {
    const studentById = new Map<string, Student>((students.data ?? []).map((s) => [s.id, s]));
    const groupById = new Map<string, Group>((groups.data ?? []).map((g) => [g.id, g]));
    const categoryById = new Map<string, Category>((categories.data ?? []).map((c) => [c.id, c]));
    const membersOf = new Map<string, string[]>();
    const groupsOf = new Map<string, string[]>();
    // pertenencias guardadas en cada alumno (group_ids)
    for (const s of students.data ?? []) {
      for (const gid of s.group_ids ?? []) {
        membersOf.set(gid, [...(membersOf.get(gid) ?? []), s.id]);
        groupsOf.set(s.id, [...(groupsOf.get(s.id) ?? []), gid]);
      }
    }
    const targetName = (t: { student_id?: string | null; group_id?: string | null }) =>
      t.group_id ? (groupById.get(t.group_id)?.name ?? 'Grupo eliminado') : studentName(studentById.get(t.student_id ?? ''));
    const targetColor = (t: { student_id?: string | null; group_id?: string | null }) =>
      t.group_id ? groupById.get(t.group_id)?.color : studentById.get(t.student_id ?? '')?.color;
    return {
      students: students.data ?? [],
      groups: groups.data ?? [],
      categories: categories.data ?? [],
      activeStudents: (students.data ?? []).filter((s) => s.status === 'active'),
      activeGroups: (groups.data ?? []).filter((g) => !g.archived),
      studentById,
      groupById,
      categoryById,
      membersOf: (gid: string) => membersOf.get(gid) ?? [],
      groupsOf: (sid: string) => groupsOf.get(sid) ?? [],
      targetName,
      targetColor,
      loading: students.isPending || groups.isPending || categories.isPending,
      error: students.error || groups.error || categories.error,
    };
  }, [students.data, groups.data, categories.data, students.isPending, groups.isPending, categories.isPending, students.error, groups.error, categories.error]);
}

export type Lookup = ReturnType<typeof useLookup>;
