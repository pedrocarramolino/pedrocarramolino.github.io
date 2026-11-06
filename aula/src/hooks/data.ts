'use client';
import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  activityApi,
  categoryApi,
  goalApi,
  groupApi,
  lessonApi,
  noteApi,
  profileApi,
  studentApi,
  taskApi,
} from '@/services/api';
import type { Category, Group, Student } from '@/lib/types';

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
  groups: ['groups', 'members', 'activity'],
  lessons: ['lessons', 'lesson', 'lessons-for', 'activity'],
  tasks: ['tasks-week', 'tasks-weeks', 'tasks-student', 'tasks-group', 'pending-assignments', 'activity', 'copies', 'search', 'palette'],
  progress: ['notes', 'goals', 'activity', 'all-goals', 'all-notes'],
  categories: ['categories'],
  profile: ['profile'],
};

export function useInvalidate() {
  const qc = useQueryClient();
  return (...groups: (keyof typeof affects)[]) => {
    const roots = new Set(groups.flatMap((g) => affects[g]));
    return qc.invalidateQueries({ predicate: (q) => roots.has(String(q.queryKey[0])) });
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
    onSuccess: async (r, a) => {
      if (opts.invalidate) await invalidate(...opts.invalidate);
      const msg = typeof opts.success === 'function' ? opts.success(r, a) : opts.success;
      if (msg) toast.success(msg);
      opts.onDone?.(r, a);
    },
    onError: (e: Error) => toast.error(e.message || 'No se pudo guardar'),
  });
}

// -------------------------------------------------------------- consultas
export const useProfile = () => useQuery({ queryKey: qk.profile, queryFn: profileApi.get, staleTime: 5 * 60_000 });
export const useCategories = () => useQuery({ queryKey: qk.categories, queryFn: categoryApi.list, staleTime: 5 * 60_000 });
export const useStudents = () => useQuery({ queryKey: qk.students, queryFn: studentApi.list });
export const useGroups = () => useQuery({ queryKey: qk.groups, queryFn: groupApi.list });
export const useMembers = () => useQuery({ queryKey: qk.members, queryFn: groupApi.members });
export const useLessonsRange = (from: string, to: string) =>
  useQuery({ queryKey: qk.lessons(from, to), queryFn: () => lessonApi.range(from, to), placeholderData: (prev) => prev });
export const useLesson = (id: string) => useQuery({ queryKey: qk.lesson(id), queryFn: () => lessonApi.get(id) });
export const useTasksWeek = (week: string) =>
  useQuery({ queryKey: qk.tasksWeek(week), queryFn: () => taskApi.week(week), placeholderData: (prev) => prev });
export const useTasksWeeks = (from: string, to: string) => useQuery({ queryKey: qk.tasksWeeks(from, to), queryFn: () => taskApi.weeks(from, to) });
export const useStudentTasks = (id: string) => useQuery({ queryKey: qk.tasksStudent(id), queryFn: () => taskApi.forStudent(id) });
export const useGroupTasks = (id: string) => useQuery({ queryKey: qk.tasksGroup(id), queryFn: () => taskApi.forGroup(id) });
export const useNotes = (id: string) => useQuery({ queryKey: qk.notes(id), queryFn: () => noteApi.forStudent(id) });
export const useGoals = (id: string) => useQuery({ queryKey: qk.goals(id), queryFn: () => goalApi.forStudent(id) });
export const useActivity = () => useQuery({ queryKey: qk.activity, queryFn: () => activityApi.recent(12) });
export const usePendingAssignments = () => useQuery({ queryKey: qk.pending, queryFn: taskApi.pendingAssignments });
export const useAllGoals = () => useQuery({ queryKey: ['all-goals'], queryFn: goalApi.all });
export const useAllNotes = () => useQuery({ queryKey: ['all-notes'], queryFn: noteApi.recent });
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
  const members = useMembers();
  const categories = useCategories();

  return useMemo(() => {
    const studentById = new Map<string, Student>((students.data ?? []).map((s) => [s.id, s]));
    const groupById = new Map<string, Group>((groups.data ?? []).map((g) => [g.id, g]));
    const categoryById = new Map<string, Category>((categories.data ?? []).map((c) => [c.id, c]));
    const membersOf = new Map<string, string[]>();
    const groupsOf = new Map<string, string[]>();
    for (const m of members.data ?? []) {
      membersOf.set(m.group_id, [...(membersOf.get(m.group_id) ?? []), m.student_id]);
      groupsOf.set(m.student_id, [...(groupsOf.get(m.student_id) ?? []), m.group_id]);
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
      loading: students.isPending || groups.isPending || members.isPending || categories.isPending,
      error: students.error || groups.error || members.error || categories.error,
    };
  }, [students.data, groups.data, members.data, categories.data, students.isPending, groups.isPending, members.isPending, categories.isPending, students.error, groups.error, members.error, categories.error]);
}

export type Lookup = ReturnType<typeof useLookup>;
