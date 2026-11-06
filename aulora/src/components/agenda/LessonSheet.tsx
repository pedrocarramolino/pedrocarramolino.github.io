'use client';
import Link from 'next/link';
import { Ban, CalendarClock, CheckCircle2, Clock, FileText, MapPin, MoreHorizontal, Pencil, Repeat, RotateCcw, Trash2, Users } from 'lucide-react';
import { Dialog, Menu } from '@/components/ui/overlay';
import { Badge, Button, buttonStyles } from '@/components/ui/controls';
import { Avatar } from '@/components/ui/display';
import { QuickAddTask, TaskRow } from '@/components/tasks/parts';
import { useUi } from '@/components/layout/ui-store';
import { studentName, useLookup, useTasksWeek } from '@/hooks/data';
import { LESSON_STATUS } from '@/lib/labels';
import { capitalize, durationLabel, fmt, timeRange, weekKey } from '@/lib/dates';
import { cvar } from '@/lib/colors';
import { useLessonActions } from './useLessonActions';
import type { Lesson } from '@/lib/types';

/** Panel lateral con el resumen de una clase y sus tareas de la semana. */
export function LessonSheet({ lesson, onClose }: { lesson: Lesson; onClose: () => void }) {
  const lookup = useLookup();
  const ui = useUi();
  const actions = useLessonActions();
  const week = weekKey(new Date(lesson.starts_at));
  const tasksQ = useTasksWeek(week);
  const student = lesson.student_id ? lookup.studentById.get(lesson.student_id) : undefined;
  const group = lesson.group_id ? lookup.groupById.get(lesson.group_id) : undefined;
  const tasks = (tasksQ.data ?? []).filter((t) =>
    lesson.group_id ? t.group_id === lesson.group_id : t.assignments.some((a) => a.student_id === lesson.student_id),
  );
  const name = lookup.targetName(lesson);
  const statusTone = lesson.status === 'completed' ? 'bg-success-soft text-success' : lesson.status === 'cancelled' ? 'bg-danger-soft text-danger' : 'bg-surface-2 text-fg-2';

  return (
    <Dialog open onClose={onClose} side title={null}>
      <div className="flex items-start gap-3 pt-4 md:pt-5">
        {group ? (
          <span style={cvar(group.color)} className="tint-strong flex size-11 shrink-0 items-center justify-center rounded-xl">
            <Users className="size-5" />
          </span>
        ) : (
          <Avatar name={name} photo={student?.photo} color={student?.color} size={44} />
        )}
        <div className="min-w-0 flex-1">
          <Link href={group ? `/grupos/${group.id}` : `/alumnos/${lesson.student_id}`} className="block truncate text-lg font-semibold tracking-tight hover:underline">
            {name}
          </Link>
          <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
            <Badge className={statusTone}>{LESSON_STATUS[lesson.status]}</Badge>
            <Badge>{lesson.lesson_type}</Badge>
            {lesson.series_id ? (
              <Badge>
                <Repeat className="size-3" /> {lesson.is_modified ? 'Serie · modificada' : 'Serie'}
              </Badge>
            ) : null}
          </div>
        </div>
        <Menu
          trigger={(p) => (
            <Button variant="ghost" size="icon-sm" aria-label="Más acciones" {...p}>
              <MoreHorizontal className="size-4" />
            </Button>
          )}
          items={[
            { label: 'Editar o reprogramar', icon: Pencil, onSelect: () => ui.openLesson({ lesson }) },
            lesson.status === 'cancelled'
              ? { label: 'Restaurar sesión', icon: RotateCcw, onSelect: () => actions.setStatus(lesson, 'scheduled').catch(() => {}) }
              : { label: 'Cancelar sesión', icon: Ban, onSelect: () => actions.setStatus(lesson, 'cancelled').catch(() => {}) },
            'separator',
            { label: lesson.series_id ? 'Eliminar solo esta' : 'Eliminar', icon: Trash2, danger: true, onSelect: async () => (await actions.remove(lesson)) && onClose() },
            ...(lesson.series_id
              ? [{ label: 'Eliminar esta y siguientes', icon: Trash2, danger: true, onSelect: async () => (await actions.removeFollowing(lesson)) && onClose() }]
              : []),
          ]}
        />
      </div>

      <div className="mt-4 space-y-1.5 text-sm text-fg-2">
        <div className="flex items-center gap-2">
          <CalendarClock className="size-4 text-muted" />
          {capitalize(fmt(lesson.starts_at, "EEEE d 'de' MMMM"))}
        </div>
        <div className="flex items-center gap-2">
          <Clock className="size-4 text-muted" />
          {timeRange(lesson.starts_at, lesson.ends_at)} · {durationLabel(lesson.duration_minutes)}
        </div>
        {lesson.location ? (
          <div className="flex items-center gap-2">
            <MapPin className="size-4 text-muted" />
            {lesson.location}
          </div>
        ) : null}
        {lesson.original_starts_at ? <div className="text-xs text-muted">Reprogramada · hora original {fmt(lesson.original_starts_at, "EEE d MMM, HH:mm")}</div> : null}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <Link href={`/clases/${lesson.id}`} onClick={onClose} className={buttonStyles('primary', 'md', 'col-span-2 sm:col-span-1')}>
          <FileText className="size-4" /> Abrir ficha de clase
        </Link>
        {lesson.status === 'scheduled' ? (
          <Button onClick={() => actions.setStatus(lesson, 'completed').catch(() => {})} className="col-span-2 sm:col-span-1">
            <CheckCircle2 className="size-4" /> Marcar realizada
          </Button>
        ) : (
          <Button onClick={() => actions.setStatus(lesson, 'scheduled').catch(() => {})} className="col-span-2 sm:col-span-1">
            <RotateCcw className="size-4" /> Volver a programada
          </Button>
        )}
      </div>

      {lesson.plan ? (
        <section className="mt-5">
          <h3 className="mb-1 text-xs font-semibold tracking-wide text-muted uppercase">Contenido previsto</h3>
          <p className="text-sm whitespace-pre-wrap text-fg-2">{lesson.plan}</p>
        </section>
      ) : null}
      {lesson.notes ? (
        <section className="mt-4">
          <h3 className="mb-1 text-xs font-semibold tracking-wide text-muted uppercase">Anotaciones</h3>
          <p className="text-sm whitespace-pre-wrap text-fg-2">{lesson.notes}</p>
        </section>
      ) : null}

      <section className="mt-5">
        <h3 className="mb-1 text-xs font-semibold tracking-wide text-muted uppercase">Tareas de la semana</h3>
        <div className="-mx-1.5">
          {tasksQ.isPending ? <p className="px-2 py-2 text-sm text-muted">Cargando…</p> : null}
          {tasks.map((t) => (
            <TaskRow key={t.id} task={t} forStudent={lesson.student_id ?? undefined} />
          ))}
          {!tasksQ.isPending && !tasks.length ? <p className="px-2 py-1 text-sm text-muted">Sin tareas asignadas esta semana.</p> : null}
          <QuickAddTask studentId={lesson.student_id ?? undefined} groupId={lesson.group_id ?? undefined} week={week} lessonId={lesson.id} />
        </div>
        {student ? (
          <p className="mt-2 text-xs text-muted">
            {student.instrument ? `${student.instrument}` : ''}
            {student.level ? ` · ${student.level}` : ''}
            {student.phone ? ` · ${student.phone}` : ''}
          </p>
        ) : group ? (
          <p className="mt-2 text-xs text-muted">{lookup.membersOf(group.id).map((id) => studentName(lookup.studentById.get(id))).join(', ') || 'Sin integrantes'}</p>
        ) : null}
      </section>
    </Dialog>
  );
}
