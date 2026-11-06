/**
 * Capa de acceso a datos. Todas las operaciones pasan por aquí y usan el
 * cliente de Supabase del navegador; la RLS garantiza que cada profesor solo
 * accede a sus filas. Las funciones lanzan errores legibles en español.
 */
import type { PostgrestError } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase/client';
import type {
  ActivityEntry,
  Assignment,
  AssignmentStatus,
  Category,
  Goal,
  Group,
  GroupMember,
  Lesson,
  LessonSeries,
  Profile,
  ProgressNote,
  Student,
  Task,
  TaskWithAssignments,
} from '@/lib/types';

export class ApiError extends Error {
  constructor(message: string, public code?: string) {
    super(message);
  }
}

function humanize(e: PostgrestError | { message: string; code?: string }): ApiError {
  const code = 'code' in e ? e.code : undefined;
  const msg = e.message ?? '';
  if (code === '23505') return new ApiError('Ya existe un elemento con esos datos.', code);
  if (code === '23503') return new ApiError('El elemento relacionado ya no existe. Recarga la página.', code);
  if (code === '23514') return new ApiError('Algún dato no es válido. Revisa el formulario.', code);
  if (code === '42501' || /row-level security/i.test(msg)) return new ApiError('No tienes permiso para esta acción. Vuelve a iniciar sesión.', code);
  if (code === 'PGRST301' || /JWT/i.test(msg)) return new ApiError('Tu sesión ha caducado. Vuelve a iniciar sesión.', code);
  if (/fetch|network|Failed to fetch/i.test(msg)) return new ApiError('Sin conexión con el servidor. Comprueba tu conexión a internet.', code);
  return new ApiError(msg || 'Ha ocurrido un error inesperado.', code);
}

async function run<T>(p: PromiseLike<{ data: T | null; error: PostgrestError | null }>): Promise<T> {
  const { data, error } = await p;
  if (error) throw humanize(error);
  return data as T;
}

const sb = () => supabase();
const CHUNK = 150;
function chunks<T>(arr: T[], size = CHUNK): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

// ------------------------------------------------------------------ Perfil
export const profileApi = {
  get: async (): Promise<Profile | null> => {
    const rows = await run<Profile[]>(sb().from('profiles').select('*').limit(1));
    return rows[0] ?? null;
  },
  update: (id: string, patch: Partial<Profile>) => run<Profile>(sb().from('profiles').update(patch).eq('id', id).select().single()),
};

// ------------------------------------------------------------------ Categorías
export const categoryApi = {
  list: () => run<Category[]>(sb().from('task_categories').select('*').order('sort_order').order('name')),
  create: (c: Pick<Category, 'name' | 'color' | 'sort_order'>) => run<Category>(sb().from('task_categories').insert(c).select().single()),
  update: (id: string, patch: Partial<Category>) => run<Category>(sb().from('task_categories').update(patch).eq('id', id).select().single()),
  remove: (id: string) => run(sb().from('task_categories').delete().eq('id', id)),
};

// ------------------------------------------------------------------ Alumnos
export type StudentInput = Omit<Student, 'id' | 'owner_id' | 'created_at' | 'updated_at'>;
export const studentApi = {
  list: () => run<Student[]>(sb().from('students').select('*').order('first_name').order('last_name')),
  get: (id: string) => run<Student>(sb().from('students').select('*').eq('id', id).single()),
  create: (s: Partial<StudentInput>) => run<Student>(sb().from('students').insert(s).select().single()),
  update: (id: string, patch: Partial<StudentInput>) => run<Student>(sb().from('students').update(patch).eq('id', id).select().single()),
  remove: (id: string) => run(sb().from('students').delete().eq('id', id)),
  duplicate: (id: string) => run<string>(sb().rpc('duplicate_student', { p_student_id: id })),
};

// ------------------------------------------------------------------ Grupos
export type GroupInput = Omit<Group, 'id' | 'owner_id' | 'created_at' | 'updated_at'>;
export const groupApi = {
  list: () => run<Group[]>(sb().from('groups').select('*').order('name')),
  create: (g: Partial<GroupInput>) => run<Group>(sb().from('groups').insert(g).select().single()),
  update: (id: string, patch: Partial<GroupInput>) => run<Group>(sb().from('groups').update(patch).eq('id', id).select().single()),
  remove: (id: string) => run(sb().from('groups').delete().eq('id', id)),
  members: () => run<GroupMember[]>(sb().from('group_members').select('group_id,student_id,owner_id')),
  setMembers: async (groupId: string, studentIds: string[], current: string[]) => {
    const add = studentIds.filter((id) => !current.includes(id));
    const del = current.filter((id) => !studentIds.includes(id));
    if (add.length) await run(sb().from('group_members').insert(add.map((student_id) => ({ group_id: groupId, student_id }))));
    if (del.length) await run(sb().from('group_members').delete().eq('group_id', groupId).in('student_id', del));
  },
  setStudentGroups: async (studentId: string, groupIds: string[], current: string[]) => {
    const add = groupIds.filter((id) => !current.includes(id));
    const del = current.filter((id) => !groupIds.includes(id));
    if (add.length) await run(sb().from('group_members').insert(add.map((group_id) => ({ group_id, student_id: studentId }))));
    if (del.length) await run(sb().from('group_members').delete().eq('student_id', studentId).in('group_id', del));
  },
};

// ------------------------------------------------------------------ Clases
export type LessonInput = Partial<Omit<Lesson, 'id' | 'owner_id' | 'ends_at' | 'created_at' | 'updated_at'>>;
export const lessonApi = {
  range: (fromIso: string, toIso: string) =>
    run<Lesson[]>(sb().from('lessons').select('*').gte('starts_at', fromIso).lt('starts_at', toIso).order('starts_at')),
  get: (id: string) => run<Lesson>(sb().from('lessons').select('*').eq('id', id).single()),
  forTarget: (studentId: string | null, groupIds: string[]) => {
    const conds = [studentId ? `student_id.eq.${studentId}` : null, groupIds.length ? `group_id.in.(${groupIds.join(',')})` : null].filter(Boolean);
    if (!conds.length) return Promise.resolve([] as Lesson[]);
    return run<Lesson[]>(sb().from('lessons').select('*').or(conds.join(',')).order('starts_at', { ascending: false }).limit(500));
  },
  create: (l: LessonInput) => run<Lesson>(sb().from('lessons').insert(l).select().single()),
  createMany: async (rows: LessonInput[]) => {
    const out: Lesson[] = [];
    for (const part of chunks(rows)) out.push(...(await run<Lesson[]>(sb().from('lessons').insert(part).select())));
    return out;
  },
  update: (id: string, patch: LessonInput) => run<Lesson>(sb().from('lessons').update(patch).eq('id', id).select().single()),
  remove: (id: string) => run(sb().from('lessons').delete().eq('id', id)),
  conflicts: (startsIso: string, endsIso: string, exclude: string[] = []) =>
    run<Lesson[]>(sb().rpc('find_conflicts', { p_starts: startsIso, p_ends: endsIso, p_exclude: exclude })),
  /** Clases futuras (desde una fecha) de una serie que no se han modificado individualmente. */
  seriesFollowing: (seriesId: string, fromIso: string) =>
    run<Lesson[]>(sb().from('lessons').select('*').eq('series_id', seriesId).gte('starts_at', fromIso).eq('status', 'scheduled').order('starts_at')),
  removeMany: async (ids: string[]) => {
    for (const part of chunks(ids)) await run(sb().from('lessons').delete().in('id', part));
  },
};

export const seriesApi = {
  create: (s: Omit<LessonSeries, 'id' | 'owner_id'>) => run<LessonSeries>(sb().from('lesson_series').insert(s).select().single()),
  get: (id: string) => run<LessonSeries>(sb().from('lesson_series').select('*').eq('id', id).single()),
  update: (id: string, patch: Partial<LessonSeries>) => run<LessonSeries>(sb().from('lesson_series').update(patch).eq('id', id).select().single()),
  remove: (id: string) => run(sb().from('lesson_series').delete().eq('id', id)),
};

// ------------------------------------------------------------------ Tareas
export type TaskInput = Partial<Omit<Task, 'id' | 'owner_id' | 'created_at' | 'updated_at' | 'copied_from'>>;

async function attachAssignments(tasks: Task[]): Promise<TaskWithAssignments[]> {
  if (!tasks.length) return [];
  const all: Assignment[] = [];
  for (const part of chunks(tasks.map((t) => t.id))) {
    all.push(...(await run<Assignment[]>(sb().from('task_assignments').select('*').in('task_id', part))));
  }
  const by = new Map<string, Assignment[]>();
  for (const a of all) by.set(a.task_id, [...(by.get(a.task_id) ?? []), a]);
  return tasks.map((t) => ({ ...t, assignments: by.get(t.id) ?? [] }));
}

export const taskApi = {
  week: async (weekStart: string) =>
    attachAssignments(await run<Task[]>(sb().from('tasks').select('*').eq('week_start', weekStart).order('created_at'))),
  weeks: async (fromWeek: string, toWeek: string) =>
    attachAssignments(
      await run<Task[]>(sb().from('tasks').select('*').gte('week_start', fromWeek).lte('week_start', toWeek).order('week_start').order('created_at')),
    ),
  forStudent: async (studentId: string) => {
    const asg = await run<Assignment[]>(sb().from('task_assignments').select('*').eq('student_id', studentId));
    if (!asg.length) return [] as TaskWithAssignments[];
    const tasks: Task[] = [];
    for (const part of chunks(asg.map((a) => a.task_id))) tasks.push(...(await run<Task[]>(sb().from('tasks').select('*').in('id', part))));
    tasks.sort((a, b) => (a.week_start < b.week_start ? 1 : a.week_start > b.week_start ? -1 : a.created_at.localeCompare(b.created_at)));
    return attachAssignments(tasks);
  },
  forGroup: async (groupId: string) =>
    attachAssignments(await run<Task[]>(sb().from('tasks').select('*').eq('group_id', groupId).order('week_start', { ascending: false }).order('created_at'))),
  search: async (filters: { q?: string; categoryId?: string; fromWeek?: string; toWeek?: string; groupId?: string }) => {
    let q = sb().from('tasks').select('*');
    if (filters.q) {
      const term = filters.q.replace(/[,()*]/g, ' ').trim();
      q = q.or(`title.ilike.*${term}*,description.ilike.*${term}*,notes.ilike.*${term}*`);
    }
    if (filters.categoryId) q = q.eq('category_id', filters.categoryId);
    if (filters.groupId) q = q.eq('group_id', filters.groupId);
    if (filters.fromWeek) q = q.gte('week_start', filters.fromWeek);
    if (filters.toWeek) q = q.lte('week_start', filters.toWeek);
    return attachAssignments(await run<Task[]>(q.order('week_start', { ascending: false }).limit(300)));
  },

  /**
   * Crea una tarea y la asigna a alumnos y/o a un grupo completo.
   * Si falla la asignación se elimina la tarea para no dejar datos huérfanos.
   */
  create: async (task: TaskInput, studentIds: string[], groupId: string | null) => {
    const created = await run<Task>(sb().from('tasks').insert({ ...task, group_id: null }).select().single());
    try {
      if (groupId) await run(sb().rpc('assign_task_to_group', { p_task_id: created.id, p_group_id: groupId }));
      const extra = [...new Set(studentIds)];
      if (extra.length) {
        await run(
          sb()
            .from('task_assignments')
            .upsert(extra.map((student_id) => ({ task_id: created.id, student_id })), { onConflict: 'task_id,student_id', ignoreDuplicates: true }),
        );
      }
    } catch (e) {
      await sb().from('tasks').delete().eq('id', created.id);
      throw e;
    }
    return created;
  },
  update: (id: string, patch: TaskInput) => run<Task>(sb().from('tasks').update(patch).eq('id', id).select().single()),
  /** Ajusta los alumnos asignados de una tarea (añade y quita). */
  setStudents: async (taskId: string, studentIds: string[], current: string[]) => {
    const add = studentIds.filter((id) => !current.includes(id));
    const del = current.filter((id) => !studentIds.includes(id));
    if (add.length) await run(sb().from('task_assignments').insert(add.map((student_id) => ({ task_id: taskId, student_id }))));
    if (del.length) await run(sb().from('task_assignments').delete().eq('task_id', taskId).in('student_id', del));
  },
  assignGroup: (taskId: string, groupId: string) => run<number>(sb().rpc('assign_task_to_group', { p_task_id: taskId, p_group_id: groupId })),
  remove: (id: string) => run(sb().from('tasks').delete().eq('id', id)),
  removeAssignment: (id: string) => run(sb().from('task_assignments').delete().eq('id', id)),
  setStatus: (assignmentIds: string[], status: AssignmentStatus) =>
    run<Assignment[]>(sb().from('task_assignments').update({ status }).in('id', assignmentIds).select()),
  setStatusForTasks: (taskIds: string[], status: AssignmentStatus) =>
    run<Assignment[]>(sb().from('task_assignments').update({ status }).in('task_id', taskIds).select()),
  setFeedback: (assignmentId: string, feedback: string) =>
    run<Assignment>(sb().from('task_assignments').update({ feedback }).eq('id', assignmentId).select().single()),
  duplicate: (taskIds: string[], targetWeek: string, studentId: string | null = null) =>
    run<number>(sb().rpc('duplicate_tasks', { p_task_ids: taskIds, p_target_week: targetWeek, p_student_id: studentId })),
  /** Claves de copia existentes en una semana destino (para avisar de duplicados). */
  copiesIn: (targetWeek: string) =>
    run<{ copied_from: string | null; copy_key: string | null }[]>(
      sb().from('tasks').select('copied_from,copy_key').eq('week_start', targetWeek).not('copy_key', 'is', null),
    ),
  assignmentsForStudents: (studentIds: string[]) =>
    studentIds.length ? run<Assignment[]>(sb().from('task_assignments').select('*').in('student_id', studentIds)) : Promise.resolve([] as Assignment[]),
  pendingAssignments: () => run<Assignment[]>(sb().from('task_assignments').select('*').in('status', ['pending', 'in_progress'])),
};

// ------------------------------------------------------------------ Seguimiento
export const noteApi = {
  forStudent: (studentId: string) =>
    run<ProgressNote[]>(sb().from('progress_notes').select('*').eq('student_id', studentId).order('noted_on', { ascending: false }).order('created_at', { ascending: false })),
  recent: () => run<ProgressNote[]>(sb().from('progress_notes').select('*').order('noted_on', { ascending: false }).limit(300)),
  create: (n: Partial<ProgressNote>) => run<ProgressNote>(sb().from('progress_notes').insert(n).select().single()),
  update: (id: string, patch: Partial<ProgressNote>) => run<ProgressNote>(sb().from('progress_notes').update(patch).eq('id', id).select().single()),
  remove: (id: string) => run(sb().from('progress_notes').delete().eq('id', id)),
  search: (q: string) => {
    const term = q.replace(/[,()*]/g, ' ').trim();
    return run<ProgressNote[]>(sb().from('progress_notes').select('*').ilike('body', `*${term}*`).order('noted_on', { ascending: false }).limit(50));
  },
};

export const goalApi = {
  forStudent: (studentId: string) =>
    run<Goal[]>(sb().from('goals').select('*').eq('student_id', studentId).order('status').order('created_at', { ascending: false })),
  all: () => run<Goal[]>(sb().from('goals').select('*')),
  create: (g: Partial<Goal>) => run<Goal>(sb().from('goals').insert(g).select().single()),
  update: (id: string, patch: Partial<Goal>) => run<Goal>(sb().from('goals').update(patch).eq('id', id).select().single()),
  remove: (id: string) => run(sb().from('goals').delete().eq('id', id)),
};

// ------------------------------------------------------------------ Actividad y búsqueda
export const activityApi = {
  recent: (limit = 12) => run<ActivityEntry[]>(sb().from('activity_log').select('*').order('id', { ascending: false }).limit(limit)),
};

export const searchApi = {
  lessons: (q: string) => {
    const term = q.replace(/[,()*]/g, ' ').trim();
    return run<Lesson[]>(
      sb()
        .from('lessons')
        .select('*')
        .or(`plan.ilike.*${term}*,notes.ilike.*${term}*,summary.ilike.*${term}*,next_goals.ilike.*${term}*,lesson_type.ilike.*${term}*,location.ilike.*${term}*`)
        .order('starts_at', { ascending: false })
        .limit(50),
    );
  },
};

/** Exporta todos los datos del profesor (copia de seguridad en JSON). */
export async function exportAll() {
  const tables = ['profiles', 'task_categories', 'students', 'groups', 'group_members', 'lesson_series', 'lessons', 'tasks', 'task_assignments', 'progress_notes', 'goals'] as const;
  const out: Record<string, unknown[]> = {};
  for (const t of tables) out[t] = await run<unknown[]>(sb().from(t).select('*'));
  return { exported_at: new Date().toISOString(), app: 'Aula', version: 1, data: out };
}
