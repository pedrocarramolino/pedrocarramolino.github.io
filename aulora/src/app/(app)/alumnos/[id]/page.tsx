'use client';
import { Suspense, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { Archive, ArchiveRestore, ArrowLeft, CalendarPlus, Copy, History, Mail, MoreHorizontal, Pencil, Phone, Plus, Trash2, UserX } from 'lucide-react';
import { Badge, Button } from '@/components/ui/controls';
import { Avatar, Card, CardHeader, EmptyState, ListSkeleton, Skeleton, Tabs } from '@/components/ui/display';
import { Menu } from '@/components/ui/overlay';
import { useUi } from '@/components/layout/ui-store';
import { useStudentActions } from '@/components/students/useStudentActions';
import { QuickAddTask, TaskRow } from '@/components/tasks/parts';
import { DuplicateDialog } from '@/components/tasks/DuplicateDialog';
import { LessonList } from '@/components/lessons/LessonList';
import { StudentProgress } from '@/components/progress/StudentProgress';
import { studentName, useLessonsFor, useLookup, useStudentTasks } from '@/hooks/data';
import { STUDENT_STATUS, isDone } from '@/lib/labels';
import { cvar } from '@/lib/colors';
import { capitalize, durationLabel, fmt, fromDateKey, timeRange, weekKey, weekLabel } from '@/lib/dates';
import type { Student, TaskWithAssignments } from '@/lib/types';

type Tab = 'info' | 'agenda' | 'tareas' | 'seguimiento' | 'historial';

function StudentPage() {
  const { id } = useParams<{ id: string }>();
  const params = useSearchParams();
  const lookup = useLookup();
  const tab = (params.get('tab') as Tab) ?? 'info';
  const student = lookup.studentById.get(id);

  if (lookup.loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-20" />
        <Skeleton className="h-64" />
      </div>
    );
  }
  if (!student) {
    return (
      <EmptyState
        icon={UserX}
        title="Alumno no encontrado"
        description="Puede que se haya eliminado."
        action={
          <Link href="/alumnos" className="text-sm font-medium text-accent">
            Ver todos los alumnos
          </Link>
        }
      />
    );
  }
  return <StudentDetail student={student} tab={tab} />;
}

function StudentDetail({ student, tab }: { student: Student; tab: Tab }) {
  const router = useRouter();
  const ui = useUi();
  const lookup = useLookup();
  const actions = useStudentActions();
  const groupIds = lookup.groupsOf(student.id);
  const tasksQ = useStudentTasks(student.id);
  const lessonsQ = useLessonsFor(student.id, groupIds);
  const tasks = useMemo(() => tasksQ.data ?? [], [tasksQ.data]);
  const lessons = useMemo(() => lessonsQ.data ?? [], [lessonsQ.data]);
  const name = studentName(student);
  const now = new Date();
  const upcoming = lessons.filter((l) => new Date(l.ends_at) >= now && l.status === 'scheduled').sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  const past = lessons.filter((l) => new Date(l.ends_at) < now || l.status !== 'scheduled');
  const pending = tasks.filter((t) => t.assignments.some((a) => a.student_id === student.id && !isDone(a.status))).length;

  return (
    <div>
      <Link href="/alumnos" className="mb-3 inline-flex items-center gap-1 text-sm text-muted hover:text-fg">
        <ArrowLeft className="size-4" /> Alumnos
      </Link>
      <div className="mb-5 flex flex-wrap items-start gap-4">
        <Avatar name={name} photo={student.photo} color={student.color} size={64} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-[22px] font-semibold tracking-tight md:text-2xl">{name}</h1>
            {student.status !== 'active' ? <Badge>{STUDENT_STATUS[student.status]}</Badge> : null}
          </div>
          <p className="mt-0.5 text-sm text-muted">{[student.instrument, student.level].filter(Boolean).join(' · ') || 'Sin especialidad'}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {groupIds.map((gid) => {
              const g = lookup.groupById.get(gid);
              return g ? (
                <Link key={gid} href={`/grupos/${gid}`}>
                  <Badge style={cvar(g.color)} className="tint">
                    {g.name}
                  </Badge>
                </Link>
              ) : null;
            })}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => ui.openLesson({ studentId: student.id })}>
            <CalendarPlus className="size-4" /> <span className="hidden sm:inline">Programar clase</span>
          </Button>
          <Button variant="primary" onClick={() => ui.openTask({ studentIds: [student.id] })}>
            <Plus className="size-4" /> Tarea
          </Button>
          <Menu
            trigger={(p) => (
              <Button size="icon" aria-label="Más acciones" {...p}>
                <MoreHorizontal className="size-4" />
              </Button>
            )}
            items={[
              { label: 'Editar ficha', icon: Pencil, onSelect: () => ui.openStudent(student) },
              { label: 'Duplicar', icon: Copy, onSelect: async () => { const nid = await actions.duplicate(student); if (nid) router.push(`/alumnos/${nid}`); } },
              student.status === 'archived'
                ? { label: 'Reactivar', icon: ArchiveRestore, onSelect: () => actions.setStatus(student, 'active') }
                : { label: 'Archivar', icon: Archive, onSelect: () => actions.setStatus(student, 'archived') },
              'separator',
              { label: 'Eliminar', icon: Trash2, danger: true, onSelect: async () => (await actions.remove(student)) && router.push('/alumnos') },
            ]}
          />
        </div>
      </div>

      <Tabs
        value={tab}
        hrefFor={(v) => `/alumnos/${student.id}${v === 'info' ? '' : `?tab=${v}`}`}
        tabs={[
          { value: 'info', label: 'Información' },
          { value: 'agenda', label: 'Agenda', count: upcoming.length || undefined },
          { value: 'tareas', label: 'Tareas', count: pending || undefined },
          { value: 'seguimiento', label: 'Seguimiento' },
          { value: 'historial', label: 'Historial' },
        ]}
      />

      <div className="animate-rise mt-5" key={tab}>
        {tab === 'info' ? <InfoTab student={student} nextLesson={upcoming[0]} /> : null}
        {tab === 'agenda' ? (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader title="Próximas sesiones" count={upcoming.length} action={<Button size="sm" variant="ghost" onClick={() => ui.openLesson({ studentId: student.id })}><Plus className="size-3.5" /> Clase</Button>} />
              {lessonsQ.isPending ? <ListSkeleton rows={3} /> : <LessonList lessons={upcoming.slice(0, 30)} empty="No hay clases programadas." />}
            </Card>
            <Card>
              <CardHeader title="Clases anteriores" count={past.length} />
              {lessonsQ.isPending ? <ListSkeleton rows={3} /> : <LessonList lessons={past.slice(0, 30)} empty="Todavía no ha tenido clases." />}
            </Card>
          </div>
        ) : null}
        {tab === 'tareas' ? <TasksTab student={student} tasks={tasks} loading={tasksQ.isPending} /> : null}
        {tab === 'seguimiento' ? <StudentProgress studentId={student.id} tasks={tasks} lessons={lessons} /> : null}
        {tab === 'historial' ? <HistoryTab lessons={past} loading={lessonsQ.isPending} /> : null}
      </div>
    </div>
  );
}

function InfoTab({ student, nextLesson }: { student: Student; nextLesson?: { starts_at: string; ends_at: string; id: string } }) {
  const ui = useUi();
  const rows: [string, React.ReactNode][] = [
    ['Instrumento o especialidad', student.instrument],
    ['Nivel musical', student.level],
    ['Horario habitual', student.usual_schedule],
    ['Duración de la clase', durationLabel(student.lesson_minutes)],
    ['Fecha de incorporación', student.joined_on ? fmt(student.joined_on, "d 'de' MMMM yyyy") : ''],
    ['Estado', STUDENT_STATUS[student.status]],
  ];
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_340px]">
      <Card>
        <CardHeader title="Datos" action={<Button size="sm" variant="ghost" onClick={() => ui.openStudent(student)}><Pencil className="size-3.5" /> Editar</Button>} />
        <dl className="grid grid-cols-1 gap-x-6 gap-y-3 px-4 pb-4 sm:grid-cols-2">
          {rows.map(([k, v]) => (
            <div key={k}>
              <dt className="text-xs text-muted">{k}</dt>
              <dd className="mt-0.5 text-sm">{v || <span className="text-muted">—</span>}</dd>
            </div>
          ))}
        </dl>
        <div className="border-t border-border px-4 py-3">
          <div className="text-xs text-muted">Observaciones personales</div>
          <p className="mt-1 text-sm whitespace-pre-wrap">{student.notes || <span className="text-muted">Sin observaciones.</span>}</p>
        </div>
      </Card>
      <div className="space-y-4">
        <Card className="p-4">
          <div className="mb-2 text-[13px] font-semibold">Contacto</div>
          {student.phone || student.email ? (
            <div className="space-y-2 text-sm">
              {student.phone ? (
                <a href={`tel:${student.phone}`} className="flex items-center gap-2 text-accent">
                  <Phone className="size-4" /> {student.phone}
                </a>
              ) : null}
              {student.email ? (
                <a href={`mailto:${student.email}`} className="flex items-center gap-2 break-all text-accent">
                  <Mail className="size-4 shrink-0" /> {student.email}
                </a>
              ) : null}
            </div>
          ) : (
            <p className="text-sm text-muted">Sin datos de contacto.</p>
          )}
        </Card>
        <Card className="p-4">
          <div className="mb-1 text-[13px] font-semibold">Próxima clase</div>
          {nextLesson ? (
            <Link href={`/clases/${nextLesson.id}`} className="text-sm hover:text-accent">
              {capitalize(fmt(nextLesson.starts_at, "EEEE d 'de' MMMM"))} · {timeRange(nextLesson.starts_at, nextLesson.ends_at)}
            </Link>
          ) : (
            <p className="text-sm text-muted">No hay clases programadas.</p>
          )}
        </Card>
      </div>
    </div>
  );
}

function TasksTab({ student, tasks, loading }: { student: Student; tasks: TaskWithAssignments[]; loading: boolean }) {
  const current = weekKey(new Date());
  const [dup, setDup] = useState<{ week: string; tasks: TaskWithAssignments[] } | null>(null);
  const weeks = useMemo(() => {
    const m = new Map<string, TaskWithAssignments[]>();
    m.set(current, []);
    for (const t of tasks) m.set(t.week_start, [...(m.get(t.week_start) ?? []), t]);
    return [...m].sort((a, b) => b[0].localeCompare(a[0]));
  }, [tasks, current]);

  if (loading) return <Card><ListSkeleton rows={5} /></Card>;
  return (
    <div className="space-y-3">
      {weeks.map(([w, ts]) => {
        const own = ts.map((t) => t.assignments.find((a) => a.student_id === student.id)!).filter(Boolean);
        const done = own.filter((a) => isDone(a.status)).length;
        return (
          <Card key={w}>
            <CardHeader
              title={
                <span className="flex items-center gap-2">
                  {weekLabel(fromDateKey(w))}
                  {w === current ? <Badge className="bg-accent-soft text-accent">Esta semana</Badge> : null}
                </span>
              }
              count={ts.length ? undefined : 0}
              action={
                <>
                  {ts.length ? <span className="mr-1 text-xs text-muted tabular-nums">{done}/{ts.length}</span> : null}
                  {ts.some((t) => !t.group_id) ? (
                    <Button size="sm" variant="ghost" onClick={() => setDup({ week: w, tasks: ts.filter((t) => !t.group_id) })}>
                      <Copy className="size-3.5" /> Copiar
                    </Button>
                  ) : null}
                </>
              }
            />
            <div className="px-2.5 pb-2">
              {ts.map((t) => (
                <TaskRow key={t.id} task={t} forStudent={student.id} />
              ))}
              {w >= current ? <QuickAddTask studentId={student.id} week={w} placeholder={w === current ? 'Añadir tarea esta semana…' : 'Añadir tarea…'} /> : null}
            </div>
          </Card>
        );
      })}
      {dup ? <DuplicateDialog tasks={dup.tasks} fromWeek={dup.week} studentId={student.id} title={`Copiar tareas de ${student.first_name}`} onClose={() => setDup(null)} /> : null}
    </div>
  );
}

function HistoryTab({ lessons, loading }: { lessons: import('@/lib/types').Lesson[]; loading: boolean }) {
  const lookup = useLookup();
  if (loading) return <Card><ListSkeleton rows={4} /></Card>;
  if (!lessons.length) return <Card><EmptyState icon={History} title="Sin historial todavía" description="Aquí aparecerán las clases realizadas con su resumen." /></Card>;
  return (
    <ol className="relative space-y-3 border-l border-border pl-5 md:ml-2">
      {lessons.map((l) => (
        <li key={l.id} className="relative">
          <span
            className={`absolute top-4 -left-[25px] size-2.5 rounded-full ring-4 ring-bg ${l.status === 'completed' ? 'bg-success' : l.status === 'cancelled' ? 'bg-danger' : 'bg-border-strong'}`}
          />
          <Link href={`/clases/${l.id}`}>
            <Card className="p-4 transition-colors hover:border-border-strong">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold">{capitalize(fmt(l.starts_at, "EEEE d 'de' MMMM yyyy"))}</span>
                <span className="text-xs text-muted tabular-nums">{timeRange(l.starts_at, l.ends_at)}</span>
                <Badge>{l.lesson_type}</Badge>
                {l.group_id ? <Badge>{lookup.targetName(l)}</Badge> : null}
                {l.status === 'cancelled' ? <Badge className="bg-danger-soft text-danger">Cancelada</Badge> : null}
                {l.status === 'scheduled' ? <Badge>Sin cerrar</Badge> : null}
              </div>
              {l.summary ? <p className="mt-2 text-sm whitespace-pre-wrap">{l.summary}</p> : null}
              {l.notes ? <p className="mt-1.5 text-sm whitespace-pre-wrap text-fg-2"><span className="text-muted">Observaciones: </span>{l.notes}</p> : null}
              {l.next_goals ? <p className="mt-1.5 text-sm text-fg-2"><span className="text-muted">Próximos objetivos: </span>{l.next_goals}</p> : null}
              {!l.summary && !l.notes && !l.next_goals && l.status !== 'cancelled' ? <p className="mt-1 text-sm text-muted">Sin resumen.</p> : null}
            </Card>
          </Link>
        </li>
      ))}
    </ol>
  );
}

export default function Page() {
  return (
    <Suspense>
      <StudentPage />
    </Suspense>
  );
}
