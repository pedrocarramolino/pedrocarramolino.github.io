'use client';
import { useState } from 'react';
import { CalendarClock, Check, CheckCheck, ChevronLeft, ChevronRight, Circle, CircleDot, Copy, Flag, MoreHorizontal, Pencil, Plus, Trash2, Users } from 'lucide-react';
import { addWeeks } from 'date-fns';
import { Button, Input, Badge } from '@/components/ui/controls';
import { Menu, useConfirm } from '@/components/ui/overlay';
import { cn } from '@/components/ui/cn';
import { useAction, useLookup, type Lookup } from '@/hooks/data';
import { taskApi } from '@/services/api';
import { ASSIGNMENT_STATUS, isDone, nextStatus } from '@/lib/labels';
import { cvar } from '@/lib/colors';
import { fmt, fromDateKey, toDateKey, weekKey, weekLabel } from '@/lib/dates';
import type { Assignment, AssignmentStatus, TaskWithAssignments } from '@/lib/types';
import { useUi } from '@/components/layout/ui-store';

const STATUS_STYLE: Record<AssignmentStatus, string> = {
  pending: 'text-muted',
  in_progress: 'text-warning',
  completed: 'text-success',
  reviewed: 'text-accent',
};

export function StatusIcon({ status, className }: { status: AssignmentStatus; className?: string }) {
  const Icon = status === 'pending' ? Circle : status === 'in_progress' ? CircleDot : status === 'completed' ? Check : CheckCheck;
  return <Icon className={cn('size-[18px]', STATUS_STYLE[status], className)} strokeWidth={status === 'completed' || status === 'reviewed' ? 2.6 : 2} />;
}

/**
 * Botón de estado: un toque avanza al siguiente estado
 * (Pendiente → En proceso → Completada → Revisada → Pendiente).
 */
export function StatusButton({ assignments, size = 'md' }: { assignments: Assignment[]; size?: 'sm' | 'md' }) {
  const status = aggregateStatus(assignments);
  const action = useAction((s: AssignmentStatus) => taskApi.setStatus(assignments.map((a) => a.id), s), { invalidate: ['tasks'] });
  if (!assignments.length) return <span className="flex size-8 items-center justify-center text-muted" title="Sin alumnos asignados"><Circle className="size-[18px] opacity-40" /></span>;
  const target = nextStatus(status);
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        action.mutate(target);
      }}
      disabled={action.isPending}
      title={`${ASSIGNMENT_STATUS[status]} · tocar para marcar «${ASSIGNMENT_STATUS[target]}»`}
      aria-label={`Estado: ${ASSIGNMENT_STATUS[status]}. Cambiar a ${ASSIGNMENT_STATUS[target]}`}
      className={cn(
        'flex shrink-0 items-center justify-center rounded-full transition-transform active:scale-90 disabled:opacity-50',
        size === 'sm' ? 'size-7' : 'size-8',
        'hover:bg-surface-2',
      )}
    >
      <StatusIcon status={action.isPending ? target : status} />
    </button>
  );
}

export function aggregateStatus(asg: Assignment[]): AssignmentStatus {
  if (!asg.length) return 'pending';
  if (asg.every((a) => a.status === 'reviewed')) return 'reviewed';
  if (asg.every((a) => isDone(a.status))) return 'completed';
  if (asg.some((a) => a.status !== 'pending')) return 'in_progress';
  return 'pending';
}

export function CategoryBadge({ id, lookup }: { id: string | null; lookup: Lookup }) {
  const c = id ? lookup.categoryById.get(id) : undefined;
  if (!c) return null;
  return (
    <Badge style={cvar(c.color)} className="tint">
      {c.name}
    </Badge>
  );
}

/**
 * Fila de tarea. `forStudent` limita las asignaciones mostradas a un alumno
 * (en su ficha o en la vista por alumno).
 */
export function TaskRow({
  task,
  forStudent,
  showTarget = false,
  showWeek = false,
}: {
  task: TaskWithAssignments;
  forStudent?: string;
  showTarget?: boolean;
  showWeek?: boolean;
}) {
  const lookup = useLookup();
  const ui = useUi();
  const confirm = useConfirm();
  const asg = forStudent ? task.assignments.filter((a) => a.student_id === forStudent) : task.assignments;
  const status = aggregateStatus(asg);
  const done = asg.length > 0 && isDone(status);
  const total = asg.length;
  const doneCount = asg.filter((a) => isDone(a.status)).length;

  const remove = useAction(
    async () => {
      // en la ficha de un alumno de una tarea compartida, solo se quita su asignación
      if (forStudent && task.assignments.length > 1) {
        await taskApi.removeAssignment(asg[0].id);
        return 'Tarea quitada a este alumno';
      }
      await taskApi.remove(task.id);
      return 'Tarea eliminada';
    },
    { invalidate: ['tasks'], success: (m) => m },
  );
  const copyNext = useAction(
    () => taskApi.duplicate([task.id], toDateKey(addWeeks(fromDateKey(task.week_start), 1)), forStudent && task.assignments.length > 1 ? forStudent : null),
    { invalidate: ['tasks'], success: (n) => (n ? 'Copiada a la semana siguiente' : 'Ya estaba copiada en la semana siguiente') },
  );

  const target = task.group_id
    ? lookup.groupById.get(task.group_id)?.name
    : task.assignments
        .map((a) => lookup.studentById.get(a.student_id))
        .filter(Boolean)
        .map((s) => s!.first_name)
        .join(', ');

  return (
    <div className="group flex items-start gap-1.5 rounded-lg px-1.5 py-1 transition-colors hover:bg-surface-2/60">
      <StatusButton assignments={asg} />
      <button type="button" onClick={() => ui.openTask({ task })} className="min-w-0 flex-1 py-1 text-left">
        <div className={cn('text-sm leading-snug', done && 'text-muted line-through decoration-border-strong')}>{task.title}</div>
        <div className="mt-1 flex flex-wrap items-center gap-1.5 empty:hidden">
          <CategoryBadge id={task.category_id} lookup={lookup} />
          {task.priority === 'high' ? (
            <Badge className="bg-danger-soft text-danger">
              <Flag className="size-3" /> Alta
            </Badge>
          ) : null}
          {status !== 'pending' && !done ? <Badge className="bg-warning-soft text-warning">En proceso</Badge> : null}
          {status === 'reviewed' ? <Badge className="bg-accent-soft text-accent">Revisada</Badge> : null}
          {task.due_on ? (
            <span className="inline-flex items-center gap-1 text-[11px] text-muted">
              <CalendarClock className="size-3" />
              {fmt(task.due_on, 'EEE d MMM')}
            </span>
          ) : null}
          {showWeek ? <span className="text-[11px] text-muted">{weekLabel(fromDateKey(task.week_start))}</span> : null}
          {showTarget && target ? (
            <span className="inline-flex items-center gap-1 text-[11px] text-muted">
              {task.group_id ? <Users className="size-3" /> : null}
              {target}
            </span>
          ) : null}
          {!forStudent && total > 1 ? (
            <span className="text-[11px] text-muted tabular-nums">
              {doneCount}/{total} completadas
            </span>
          ) : null}
          {task.description ? <span className="line-clamp-1 max-w-full text-[12px] text-muted">{task.description}</span> : null}
        </div>
      </button>
      <Menu
        trigger={(p) => (
          <Button variant="ghost" size="icon-sm" aria-label="Opciones de la tarea" className="mt-0.5 opacity-60 group-hover:opacity-100" {...p}>
            <MoreHorizontal className="size-4" />
          </Button>
        )}
        items={[
          { label: 'Editar', icon: Pencil, onSelect: () => ui.openTask({ task }) },
          { label: 'Copiar a la semana siguiente', icon: Copy, onSelect: () => copyNext.mutate(undefined) },
          'separator',
          {
            label: forStudent && task.assignments.length > 1 ? 'Quitar a este alumno' : 'Eliminar',
            icon: Trash2,
            danger: true,
            onSelect: async () => {
              const ok = await confirm({
                title: forStudent && task.assignments.length > 1 ? '¿Quitar la tarea a este alumno?' : '¿Eliminar la tarea?',
                description:
                  task.assignments.length > 1 && !(forStudent && task.assignments.length > 1)
                    ? `«${task.title}» está asignada a ${task.assignments.length} alumnos. Se eliminará para todos.`
                    : `«${task.title}» se eliminará definitivamente.`,
                confirmLabel: 'Eliminar',
                danger: true,
              });
              if (ok) remove.mutate(undefined);
            },
          },
        ]}
      />
    </div>
  );
}

/** Añadir tarea en línea: escribir y pulsar Intro. */
export function QuickAddTask({
  studentId,
  groupId,
  week,
  lessonId,
  placeholder = 'Añadir tarea…',
  autoFocus,
}: {
  studentId?: string;
  groupId?: string;
  week: string;
  lessonId?: string;
  placeholder?: string;
  autoFocus?: boolean;
}) {
  const lookup = useLookup();
  const ui = useUi();
  const [title, setTitle] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const today = toDateKey(new Date());
  const add = useAction(
    (t: string) =>
      taskApi.create(
        { title: t, week_start: week, assigned_on: week > today ? week : today, category_id: categoryId ?? lookup.categories[0]?.id ?? null, lesson_id: lessonId ?? null },
        studentId ? [studentId] : [],
        groupId ?? null,
      ),
    { invalidate: ['tasks'] },
  );
  const submit = () => {
    const t = title.trim();
    if (!t) return;
    setTitle('');
    add.mutate(t);
  };
  return (
    <div className="flex items-center gap-1.5 pl-1.5">
      <span className="flex size-8 shrink-0 items-center justify-center text-muted">
        <Plus className="size-4" />
      </span>
      <Input
        value={title}
        autoFocus={autoFocus}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            submit();
          }
        }}
        placeholder={placeholder}
        aria-label={placeholder}
        className="h-8 border-transparent bg-transparent px-1 shadow-none hover:border-border focus:bg-surface"
        enterKeyHint="done"
      />
      {title ? (
        <select
          aria-label="Categoría"
          value={categoryId ?? lookup.categories[0]?.id ?? ''}
          onChange={(e) => setCategoryId(e.target.value)}
          className="h-8 max-w-28 rounded-md border border-border bg-surface px-1.5 text-xs text-fg-2"
        >
          {lookup.categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      ) : null}
      {title ? (
        <Button size="sm" variant="primary" onClick={submit} loading={add.isPending}>
          Añadir
        </Button>
      ) : (
        <Button
          size="icon-sm"
          variant="ghost"
          title="Tarea con más detalles"
          aria-label="Tarea con más detalles"
          onClick={() => ui.openTask({ studentIds: studentId ? [studentId] : [], groupId, week, lessonId })}
        >
          <Pencil className="size-3.5" />
        </Button>
      )}
    </div>
  );
}

/** Navegador de semanas: flechas, «Esta semana» y selector de fecha. */
export function WeekNav({ week, onChange }: { week: string; onChange: (w: string) => void }) {
  const current = weekKey(new Date());
  const start = fromDateKey(week);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex items-center rounded-lg border border-border bg-surface shadow-sm">
        <button className="flex size-9 items-center justify-center rounded-l-lg hover:bg-surface-2" onClick={() => onChange(toDateKey(addWeeks(start, -1)))} aria-label="Semana anterior">
          <ChevronLeft className="size-4" />
        </button>
        <label className="relative flex h-9 cursor-pointer items-center border-x border-border px-3 text-sm font-medium hover:bg-surface-2">
          <span>{weekLabel(start)}</span>
          <input
            type="date"
            value={week}
            onChange={(e) => e.target.value && onChange(weekKey(fromDateKey(e.target.value)))}
            className="absolute inset-0 cursor-pointer opacity-0"
            aria-label="Elegir semana"
          />
        </label>
        <button className="flex size-9 items-center justify-center rounded-r-lg hover:bg-surface-2" onClick={() => onChange(toDateKey(addWeeks(start, 1)))} aria-label="Semana siguiente">
          <ChevronRight className="size-4" />
        </button>
      </div>
      {week !== current ? (
        <Button size="sm" variant="ghost" onClick={() => onChange(current)}>
          Esta semana
        </Button>
      ) : null}
    </div>
  );
}
