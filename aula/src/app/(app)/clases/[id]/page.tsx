'use client';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { addWeeks } from 'date-fns';
import { ArrowLeft, Ban, CalendarClock, CheckCircle2, ChevronDown, Clock, MapPin, Pencil, Phone, RotateCcw, Trash2, Users } from 'lucide-react';
import { Badge, Button, Select, Textarea } from '@/components/ui/controls';
import { Avatar, Card, CardHeader, EmptyState, Skeleton } from '@/components/ui/display';
import { AutoSaveText } from '@/components/ui/AutoSaveText';
import { QuickAddTask, TaskRow } from '@/components/tasks/parts';
import { useLessonActions } from '@/components/agenda/useLessonActions';
import { useUi } from '@/components/layout/ui-store';
import { studentName, useAction, useInvalidate, useLesson, useLessonsRange, useLookup, useTasksWeeks } from '@/hooks/data';
import { lessonApi, noteApi } from '@/services/api';
import { LESSON_STATUS, NOTE_KIND } from '@/lib/labels';
import { capitalize, durationLabel, fmt, fromDateKey, timeRange, toDateKey, weekKey, weekLabel } from '@/lib/dates';
import { cvar } from '@/lib/colors';
import type { Lesson, NoteKind } from '@/lib/types';

export default function LessonPage() {
  const { id } = useParams<{ id: string }>();
  const q = useLesson(id);
  if (q.isPending) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-16" />
        <Skeleton className="h-64" />
      </div>
    );
  }
  if (q.error || !q.data) {
    return (
      <EmptyState
        icon={CalendarClock}
        title="No se encontró la clase"
        description="Puede que se haya eliminado."
        action={
          <Link href="/agenda" className="text-sm font-medium text-accent">
            Volver a la agenda
          </Link>
        }
      />
    );
  }
  return <LessonDetail lesson={q.data} />;
}

function LessonDetail({ lesson }: { lesson: Lesson }) {
  const router = useRouter();
  const lookup = useLookup();
  const ui = useUi();
  const actions = useLessonActions();
  const invalidate = useInvalidate();
  const week = weekKey(new Date(lesson.starts_at));
  const prevFrom = toDateKey(addWeeks(fromDateKey(week), -4));
  const tasksQ = useTasksWeeks(prevFrom, week);
  const [showPrev, setShowPrev] = useState(true);
  const student = lesson.student_id ? lookup.studentById.get(lesson.student_id) : undefined;
  const group = lesson.group_id ? lookup.groupById.get(lesson.group_id) : undefined;
  const name = lookup.targetName(lesson);

  const relevant = useMemo(
    () =>
      (tasksQ.data ?? []).filter((t) => (lesson.group_id ? t.group_id === lesson.group_id : t.assignments.some((a) => a.student_id === lesson.student_id))),
    [tasksQ.data, lesson.group_id, lesson.student_id],
  );
  const thisWeek = relevant.filter((t) => t.week_start === week);
  const previous = relevant.filter((t) => t.week_start < week).sort((a, b) => b.week_start.localeCompare(a.week_start));
  const prevByWeek = useMemo(() => {
    const m = new Map<string, typeof previous>();
    for (const t of previous) m.set(t.week_start, [...(m.get(t.week_start) ?? []), t]);
    return [...m];
  }, [previous]);

  const saveField = (field: 'plan' | 'notes' | 'summary' | 'next_goals') => async (v: string) => {
    await lessonApi.update(lesson.id, { [field]: v });
    invalidate('lessons');
  };

  const [summary, setSummary] = useState(lesson.summary);
  const finish = useAction(
    () => lessonApi.update(lesson.id, { status: 'completed', summary, is_modified: lesson.series_id ? true : lesson.is_modified }),
    { invalidate: ['lessons'], success: 'Sesión finalizada · resumen guardado en el historial' },
  );

  const statusTone = lesson.status === 'completed' ? 'bg-success-soft text-success' : lesson.status === 'cancelled' ? 'bg-danger-soft text-danger' : 'bg-surface-2 text-fg-2';
  const forStudent = lesson.student_id ?? undefined;

  return (
    <div>
      <button onClick={() => router.back()} className="mb-3 flex items-center gap-1 text-sm text-muted hover:text-fg">
        <ArrowLeft className="size-4" /> Volver
      </button>

      <div className="mb-6 flex flex-wrap items-start gap-4">
        {group ? (
          <span style={cvar(group.color)} className="tint-strong flex size-14 items-center justify-center rounded-2xl">
            <Users className="size-6" />
          </span>
        ) : (
          <Avatar name={name} photo={student?.photo} color={student?.color} size={56} />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Link href={group ? `/grupos/${group.id}` : `/alumnos/${lesson.student_id}`} className="text-[22px] font-semibold tracking-tight hover:underline md:text-2xl">
              {name}
            </Link>
            <Badge className={statusTone}>{LESSON_STATUS[lesson.status]}</Badge>
          </div>
          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-fg-2">
            <span className="flex items-center gap-1.5">
              <CalendarClock className="size-4 text-muted" />
              {capitalize(fmt(lesson.starts_at, "EEEE d 'de' MMMM yyyy"))}
            </span>
            <span className="flex items-center gap-1.5">
              <Clock className="size-4 text-muted" />
              {timeRange(lesson.starts_at, lesson.ends_at)} · {durationLabel(lesson.duration_minutes)} · {lesson.lesson_type}
            </span>
            {lesson.location ? (
              <span className="flex items-center gap-1.5">
                <MapPin className="size-4 text-muted" />
                {lesson.location}
              </span>
            ) : null}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => ui.openLesson({ lesson })}>
            <Pencil className="size-4" /> Editar
          </Button>
          {lesson.status === 'cancelled' ? (
            <Button onClick={() => actions.setStatus(lesson, 'scheduled').catch(() => {})}>
              <RotateCcw className="size-4" /> Restaurar
            </Button>
          ) : lesson.status === 'scheduled' ? (
            <Button onClick={() => actions.setStatus(lesson, 'cancelled').catch(() => {})}>
              <Ban className="size-4" /> Cancelar sesión
            </Button>
          ) : null}
          <Button variant="ghost" size="icon" aria-label="Eliminar clase" onClick={async () => (await actions.remove(lesson)) && router.push('/agenda')}>
            <Trash2 className="size-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_380px]">
        <div className="space-y-4">
          <Card className="p-4">
            <AutoSaveText label="Contenido previsto" value={lesson.plan} onSave={saveField('plan')} placeholder="¿Qué vais a trabajar hoy?" rows={3} />
          </Card>

          <Card>
            <CardHeader title={`Tareas · ${weekLabel(fromDateKey(week))}`} count={thisWeek.length} />
            <div className="px-2.5 pb-2">
              {tasksQ.isPending ? <p className="px-2 py-2 text-sm text-muted">Cargando…</p> : null}
              {thisWeek.map((t) => (
                <TaskRow key={t.id} task={t} forStudent={forStudent} />
              ))}
              {!tasksQ.isPending && !thisWeek.length ? <p className="px-2 py-1 text-sm text-muted">Sin tareas para esta semana.</p> : null}
              <QuickAddTask studentId={forStudent} groupId={lesson.group_id ?? undefined} week={week} lessonId={lesson.id} placeholder="Nueva tarea para esta semana…" />
              <QuickAddTask
                studentId={forStudent}
                groupId={lesson.group_id ?? undefined}
                week={toDateKey(addWeeks(fromDateKey(week), 1))}
                lessonId={lesson.id}
                placeholder="Tarea para la próxima semana…"
              />
            </div>
          </Card>

          <Card>
            <button className="flex w-full items-center gap-2 px-4 pt-3.5 pb-2 text-left" onClick={() => setShowPrev((s) => !s)}>
              <h2 className="text-[13px] font-semibold tracking-tight">Tareas de semanas anteriores</h2>
              <span className="text-xs text-muted">{previous.length}</span>
              <ChevronDown className={`ml-auto size-4 text-muted transition-transform ${showPrev ? '' : '-rotate-90'}`} />
            </button>
            {showPrev ? (
              <div className="px-2.5 pb-2">
                {!prevByWeek.length ? <p className="px-2 pb-2 text-sm text-muted">Nada en las últimas 4 semanas.</p> : null}
                {prevByWeek.map(([w, ts]) => (
                  <div key={w} className="mb-1">
                    <div className="px-2 pt-1 text-[11px] font-medium text-muted">{weekLabel(fromDateKey(w))}</div>
                    {ts.map((t) => (
                      <TaskRow key={t.id} task={t} forStudent={forStudent} />
                    ))}
                  </div>
                ))}
              </div>
            ) : null}
          </Card>

          <Card className="space-y-4 p-4">
            <AutoSaveText label="Observaciones de la sesión" value={lesson.notes} onSave={saveField('notes')} placeholder="Cómo ha ido, actitud, aspectos técnicos…" />
            <AutoSaveText label="Objetivos para la próxima clase" value={lesson.next_goals} onSave={saveField('next_goals')} rows={2} />
          </Card>

          <Card className="p-4">
            <div className="mb-1.5 flex items-center justify-between">
              <label className="text-[13px] font-medium text-fg-2">Resumen de lo trabajado</label>
              {lesson.status === 'completed' && lesson.completed_at ? <span className="text-[11px] text-muted">Finalizada {fmt(lesson.completed_at, "d MMM, HH:mm")}</span> : null}
            </div>
            <Textarea value={summary} onChange={(e) => setSummary(e.target.value)} rows={3} placeholder="Este resumen quedará en el historial del alumno." aria-label="Resumen de lo trabajado" />
            <div className="mt-3 flex flex-wrap justify-end gap-2">
              {lesson.status === 'completed' ? (
                <Button onClick={() => finish.mutate(undefined)} loading={finish.isPending} disabled={summary === lesson.summary}>
                  Guardar resumen
                </Button>
              ) : (
                <Button variant="primary" onClick={() => finish.mutate(undefined)} loading={finish.isPending}>
                  <CheckCircle2 className="size-4" /> Finalizar sesión
                </Button>
              )}
            </div>
          </Card>
        </div>

        <div className="space-y-4">
          {student ? (
            <Card className="p-4">
              <div className="mb-2 text-[13px] font-semibold">Alumno</div>
              <dl className="space-y-1.5 text-sm">
                <Row label="Instrumento" value={student.instrument} />
                <Row label="Nivel" value={student.level} />
                <Row label="Horario" value={student.usual_schedule} />
                {student.phone ? (
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted">Teléfono</dt>
                    <dd>
                      <a href={`tel:${student.phone}`} className="flex items-center gap-1 text-accent">
                        <Phone className="size-3.5" />
                        {student.phone}
                      </a>
                    </dd>
                  </div>
                ) : null}
              </dl>
              {student.notes ? <p className="mt-3 rounded-lg bg-surface-2 px-3 py-2 text-sm whitespace-pre-wrap text-fg-2">{student.notes}</p> : null}
              <Link href={`/alumnos/${student.id}?tab=seguimiento`} className="mt-3 inline-block text-sm font-medium text-accent">
                Ver seguimiento →
              </Link>
            </Card>
          ) : group ? (
            <Card className="p-4">
              <div className="mb-2 text-[13px] font-semibold">Integrantes</div>
              <div className="space-y-1.5">
                {lookup.membersOf(group.id).map((sid) => {
                  const s = lookup.studentById.get(sid);
                  return (
                    <Link key={sid} href={`/alumnos/${sid}`} className="flex items-center gap-2 rounded-md py-0.5 text-sm hover:text-accent">
                      <Avatar name={studentName(s)} photo={s?.photo} color={s?.color} size={22} />
                      {studentName(s)}
                    </Link>
                  );
                })}
                {!lookup.membersOf(group.id).length ? <p className="text-sm text-muted">Sin integrantes.</p> : null}
              </div>
            </Card>
          ) : null}

          {student ? <QuickNote studentId={student.id} lessonId={lesson.id} /> : null}
          <PreviousLesson lesson={lesson} />
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-muted">{label}</dt>
      <dd className="text-right">{value}</dd>
    </div>
  );
}

function QuickNote({ studentId, lessonId }: { studentId: string; lessonId: string }) {
  const [kind, setKind] = useState<NoteKind>('observation');
  const [body, setBody] = useState('');
  const add = useAction(() => noteApi.create({ student_id: studentId, lesson_id: lessonId, kind, body: body.trim() }), {
    invalidate: ['progress'],
    success: 'Anotación añadida al seguimiento',
    onDone: () => setBody(''),
  });
  return (
    <Card className="p-4">
      <div className="mb-2 text-[13px] font-semibold">Anotación de seguimiento</div>
      <Select value={kind} onChange={(e) => setKind(e.target.value as NoteKind)} className="mb-2" aria-label="Tipo de anotación">
        {Object.entries(NOTE_KIND).map(([k, v]) => (
          <option key={k} value={k}>
            {v}
          </option>
        ))}
      </Select>
      <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={2} placeholder="Logro, dificultad, aspecto a mejorar…" aria-label="Anotación" />
      <div className="mt-2 flex justify-end">
        <Button size="sm" variant="primary" disabled={!body.trim()} loading={add.isPending} onClick={() => add.mutate(undefined)}>
          Añadir
        </Button>
      </div>
    </Card>
  );
}

/** Resumen de la clase anterior del mismo alumno o grupo, para dar continuidad. */
function PreviousLesson({ lesson }: { lesson: Lesson }) {
  const lookup = useLookup();
  const from = new Date(new Date(lesson.starts_at).getTime() - 60 * 86400_000).toISOString();
  const q = useMemo(() => ({ from, to: lesson.starts_at }), [from, lesson.starts_at]);
  const { data } = useLessonsRange(q.from, q.to);
  const prev = (data ?? [])
    .filter((l) => l.id !== lesson.id && l.status === 'completed' && (lesson.group_id ? l.group_id === lesson.group_id : l.student_id === lesson.student_id))
    .sort((a, b) => b.starts_at.localeCompare(a.starts_at))[0];
  if (!prev) return null;
  return (
    <Card className="p-4">
      <div className="mb-1 text-[13px] font-semibold">Clase anterior</div>
      <Link href={`/clases/${prev.id}`} className="text-xs text-muted hover:text-accent">
        {capitalize(fmt(prev.starts_at, "EEEE d 'de' MMMM"))} · {lookup.targetName(prev)}
      </Link>
      {prev.summary ? <p className="mt-2 text-sm whitespace-pre-wrap text-fg-2">{prev.summary}</p> : null}
      {prev.next_goals ? (
        <div className="mt-2 rounded-lg bg-accent-soft px-3 py-2 text-sm text-fg-2">
          <span className="font-medium text-accent">Objetivos marcados: </span>
          {prev.next_goals}
        </div>
      ) : null}
      {!prev.summary && !prev.next_goals ? <p className="mt-1 text-sm text-muted">Sin resumen.</p> : null}
    </Card>
  );
}

