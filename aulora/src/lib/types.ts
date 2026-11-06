// Tipos de las filas de la base de datos (reflejan supabase/migrations).

export type StudentStatus = 'active' | 'inactive' | 'archived';
export type LessonStatus = 'scheduled' | 'completed' | 'cancelled';
export type TaskPriority = 'low' | 'normal' | 'high';
export type AssignmentStatus = 'pending' | 'in_progress' | 'completed' | 'reviewed';
export type NoteKind = 'observation' | 'achievement' | 'difficulty' | 'improvement';
export type GoalStatus = 'active' | 'achieved' | 'dropped';

export interface Profile {
  id: string;
  display_name: string;
  default_lesson_minutes: number;
  day_start_hour: number;
  day_end_hour: number;
}

export interface Category {
  id: string;
  owner_id: string;
  name: string;
  color: string;
  sort_order: number;
}

export interface Student {
  id: string;
  owner_id: string;
  first_name: string;
  last_name: string;
  photo: string | null;
  instrument: string;
  phone: string;
  email: string;
  joined_on: string | null;
  usual_schedule: string;
  lesson_minutes: number;
  level: string;
  notes: string;
  status: StudentStatus;
  color: string;
  /** Grupos a los que pertenece (relación N:M guardada en el alumno). */
  group_ids: string[];
  created_at: string;
  updated_at: string;
}

export interface Group {
  id: string;
  owner_id: string;
  name: string;
  description: string;
  subject: string;
  usual_weekday: number | null;
  usual_time: string | null;
  lesson_minutes: number;
  location: string;
  notes: string;
  color: string;
  archived: boolean;
  created_at: string;
  updated_at: string;
}

export interface GroupMember {
  group_id: string;
  student_id: string;
  owner_id: string;
}

export interface LessonSeries {
  id: string;
  owner_id: string;
  student_id: string | null;
  group_id: string | null;
  lesson_type: string;
  weekdays: number[];
  start_time: string;
  duration_minutes: number;
  start_date: string;
  end_date: string;
  location: string;
}

export interface Lesson {
  id: string;
  owner_id: string;
  series_id: string | null;
  student_id: string | null;
  group_id: string | null;
  starts_at: string;
  duration_minutes: number;
  ends_at: string;
  lesson_type: string;
  status: LessonStatus;
  location: string;
  plan: string;
  notes: string;
  summary: string;
  next_goals: string;
  is_modified: boolean;
  original_starts_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Task {
  id: string;
  owner_id: string;
  title: string;
  description: string;
  category_id: string | null;
  priority: TaskPriority;
  week_start: string;
  assigned_on: string;
  due_on: string | null;
  notes: string;
  group_id: string | null;
  lesson_id: string | null;
  copied_from: string | null;
  copy_key?: string | null;
  created_at: string;
  updated_at: string;
}

export interface Assignment {
  id: string;
  owner_id: string;
  task_id: string;
  student_id: string;
  status: AssignmentStatus;
  feedback: string;
  completed_at: string | null;
  reviewed_at: string | null;
  updated_at: string;
}

/** Tarea junto con sus asignaciones. */
export interface TaskWithAssignments extends Task {
  assignments: Assignment[];
}

export interface ProgressNote {
  id: string;
  owner_id: string;
  student_id: string;
  lesson_id: string | null;
  kind: NoteKind;
  category_id: string | null;
  body: string;
  noted_on: string;
  created_at: string;
}

export interface Goal {
  id: string;
  owner_id: string;
  student_id: string;
  title: string;
  description: string;
  category_id: string | null;
  status: GoalStatus;
  target_date: string | null;
  achieved_on: string | null;
  created_at: string;
}

export interface ActivityEntry {
  id: string;
  entity: string;
  entity_id: string | null;
  action: 'created' | 'updated' | 'deleted';
  label: string;
  created_at: string;
}

/** Destinatario de una clase o tarea. */
export type Target = { kind: 'student'; id: string } | { kind: 'group'; id: string };
