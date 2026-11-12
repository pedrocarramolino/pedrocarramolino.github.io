'use client';
import { useMemo } from 'react';
import Link from 'next/link';
import { addDays } from 'date-fns';
import { Activity, AlertCircle, CalendarDays, CalendarPlus, CheckSquare, ChevronRight, Clock, ListTodo, Plus, Sparkles, Users, UsersRound } from 'lucide-react';
import { Button } from '@/components/ui/controls';
import { Avatar, Card, CardHeader, EmptyState, ListSkeleton, Stat } from '@/components/ui/display';
import { cn } from '@/components/ui/cn';
import { useUi } from '@/components/layout/ui-store';
import { studentName, useActivity, useLessonsRange, useLookup, usePendingAssignments, useProfile, useTasksWeek } from '@/hooks/data';
import { isPending } from '@/lib/labels';
import { cvar } from '@/lib/colors';
import { WEEKDAYS_SHORT, capitalize, durationLabel, fmt, hhmm, isSameDay, relativeDay, startOfDay, timeAgo, weekKey, weekStartOf } from '@/lib/dates';
import type { ActivityEntry, Lesson, TaskWithAssignments } from '@/lib/types';

const ENTITY: Record<string, [string, 'm' | 'f']> = {
  students: ['Alumno', 'm'],
  groups: ['Grupo', 'm'],
  lessons: ['Clase', 'f'],
  lesson_series: ['Serie de clases', 'f'],
  tasks: ['Tarea', 'f'],
  goals: ['Objetivo', 'm'],
};
const ACTION: Record<ActivityEntry['action'], string> = { created: 'cread', updated: 'modificad', deleted: 'eliminad' };
function activityLabel(a: ActivityEntry) {
  const [noun, g] = ENTITY[a.entity] ?? [a.entity, 'm'];
  return `${noun} ${ACTION[a.action]}${g === 'f' ? 'a' : 'o'}`;
}

function greeting(d: Date) {
  const h = d.getHours();
  return h < 6 ? 'Buenas noches' : h < 14 ? 'Buenos días' : h < 21 ? 'Buenas tardes' : 'Buenas noches';
}

export default function Dashboard() {
  const ui = useUi();
  const lookup = useLookup();
  const profile = useProfile();
  const now = new Date();
  const today = startOfDay(now);
  const weekStart = weekStartOf(now);
  const week = weekKey(now);
  const rangeFrom = (weekStart < today ? weekStart : today).toISOString();
  const rangeTo = addDays(today, 8).toISOString();
  const lessonsQ = useLessonsRange(rangeFrom, rangeTo);
  const tasksQ = useTasksWeek(week);
  const pendingQ = usePendingAssignments();
  const activityQ = useActivity();

  const lessons = useMemo(() => (lessonsQ.data ?? []).filter((l) => l.status !== 'cancelled'), [lessonsQ.data]);
  const todays = lessons.filter((l) => isSameDay(new Date(l.starts_at), now));
  const upcoming = lessons.filter((l) => new Date(l.starts_at) >= addDays(today, 1)).slice(0, 6);
  const tasks = useMemo(() => tasksQ.data ?? [], [tasksQ.data]);
  const weekAsg = tasks.flatMap((t) => t.assignments);
  const weekPending = weekAsg.filter((a) => isPending(a.status)).length;

  // clases próximas (7 días) sin contenido previsto ni tareas para esa semana
  const toPrepare = useMemo(() => {
    const targetsWithTasks = new Set<string>();
    for (const t of tasks) {
      if (t.group_id) targetsWithTasks.add('g' + t.group_id);
      for (const a of t.assignments) targetsWithTasks.add('s' + a.student_id);
    }
    return lessons
      .filter((l) => new Date(l.starts_at) >= now && l.status === 'scheduled' && !l.plan.trim())
      .filter((l) => weekKey(new Date(l.starts_at)) !== week || !targetsWithTasks.has(l.group_id ? 'g' + l.group_id : 's' + l.student_id))
      .slice(0, 6);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lessons, tasks, week]);

  const pendingStudents = useMemo(() => {
    const m = new Map<string, number>();
    for (const a of pendingQ.data ?? []) m.set(a.student_id, (m.get(a.student_id) ?? 0) + 1);
    return [...m]
      .map(([id, n]) => ({ s: lookup.studentById.get(id), n }))
      .filter((x) => x.s && x.s.status === 'active')
      .sort((a, b) => b.n - a.n)
      .slice(0, 8);
  }, [pendingQ.data, lookup.studentById]);

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const name = profile.data?.display_name?.split(' ')[0];
  const isEmpty = !lookup.loading && !lookup.students.length && !lookup.groups.length;

  return (
    <div className="space-y-5 md:space-y-6">
      <div className="flex flex-wrap items-end gap-3">
        <div className="mr-auto">
          <p className="text-sm text-muted">{capitalize(fmt(now, "EEEE d 'de' MMMM"))}</p>
          <h1 className="text-[22px] font-semibold tracking-tight md:text-[26px]">
            {greeting(now)}
            {name ? `, ${name}` : ''}
          </h1>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => ui.openLesson()}>
            <CalendarPlus className="size-4" /> Clase
          </Button>
          <Button variant="primary" onClick={() => ui.openTask()}>
            <Plus className="size-4" /> Tarea
          </Button>
        </div>
      </div>

      {isEmpty ? (
        <Card className="overflow-hidden">
          <div className="flex flex-col gap-4 p-6 md:flex-row md:items-center">
            <div className="flex size-12 items-center justify-center rounded-xl bg-accent-soft text-accent">
              <Sparkles className="size-5" />
            </div>
            <div className="flex-1">
              <h2 className="font-semibold">Bienvenido a Aulora</h2>
              <p className="mt-1 text-sm text-muted">Empieza añadiendo a tus alumnos y grupos. Después programa sus clases y asígnales tareas semana a semana.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="primary" onClick={() => ui.openStudent()}>
                <Plus className="size-4" /> Primer alumno
              </Button>
              <Button onClick={() => ui.openGroup()}>
                <UsersRound className="size-4" /> Crear grupo
              </Button>
            </div>
          </div>
        </Card>
      ) : null}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Alumnos activos" icon={Users} value={lookup.loading ? '–' : lookup.activeStudents.length} hint={`${lookup.students.length} en total`} href="/alumnos" />
        <Stat label="Grupos" icon={UsersRound} value={lookup.loading ? '–' : lookup.activeGroups.length} hint="Clases colectivas" href="/grupos" />
        <Stat label="Clases hoy" icon={CalendarDays} value={lessonsQ.isPending ? '–' : todays.length} hint={todays[0] ? `Primera a las ${hhmm(new Date(todays[0].starts_at))}` : 'Día libre'} href="/agenda?vista=dia" />
        <Stat
          label="Tareas esta semana"
          icon={CheckSquare}
          value={tasksQ.isPending ? '–' : tasks.length}
          hint={weekAsg.length ? `${weekPending} pendientes de ${weekAsg.length} asignaciones` : 'Sin asignar todavía'}
          href="/tareas"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.4fr_1fr]">
        {/* HOY */}
        <Card>
          <CardHeader
            title="Hoy"
            icon={Clock}
            count={todays.length}
            action={
              <Link href="/agenda?vista=dia" className="text-xs font-medium text-accent">
                Ver agenda
              </Link>
            }
          />
          {lessonsQ.isPending ? (
            <ListSkeleton rows={3} />
          ) : todays.length ? (
            <ul className="px-2 pb-2">
              {todays.map((l) => (
                <TodayItem key={l.id} lesson={l} tasks={tasks} />
              ))}
            </ul>
          ) : (
            <EmptyState compact icon={CalendarDays} title="No hay clases hoy" description="Disfruta del día o programa una clase." action={<Button size="sm" onClick={() => ui.openLesson()}>Programar clase</Button>} />
          )}
        </Card>

        <div className="space-y-4">
          {/* ESTA SEMANA */}
          <Card>
            <CardHeader title="Esta semana" icon={CalendarDays} action={<Link href="/agenda" className="text-xs font-medium text-accent">Semana</Link>} />
            <div className="grid grid-cols-7 gap-1 px-3 pb-3">
              {weekDays.map((d, i) => {
                const n = lessons.filter((l) => isSameDay(new Date(l.starts_at), d)).length;
                const isToday = isSameDay(d, now);
                const past = d < today;
                return (
                  <Link key={i} href={`/agenda?vista=dia&fecha=${fmt(d, 'yyyy-MM-dd')}`} className={cn('flex flex-col items-center gap-1 rounded-lg py-2 transition-colors hover:bg-surface-2', isToday && 'bg-accent-soft')}>
                    <span className={cn('text-[11px] font-medium', isToday ? 'text-accent' : 'text-muted')}>{WEEKDAYS_SHORT[i]}</span>
                    <span className={cn('text-sm font-semibold tabular-nums', past && !isToday && 'text-muted')}>{d.getDate()}</span>
                    <span className={cn('h-4 min-w-4 rounded-full px-1 text-center text-[10px] leading-4 font-semibold tabular-nums', n ? 'bg-accent text-accent-fg' : 'text-muted')}>{n || '·'}</span>
                  </Link>
                );
              })}
            </div>
            <div className="grid grid-cols-3 border-t border-border text-center">
              <MiniStat label="Clases" value={lessons.filter((l) => new Date(l.starts_at) >= weekStart && new Date(l.starts_at) < addDays(weekStart, 7)).length} />
              <MiniStat label="Tareas" value={tasks.length} />
              <MiniStat label="Completadas" value={weekAsg.length ? `${Math.round(((weekAsg.length - weekPending) / weekAsg.length) * 100)}%` : '—'} />
            </div>
          </Card>

          {/* POR PREPARAR */}
          <Card>
            <CardHeader title="Clases por preparar" icon={ListTodo} count={toPrepare.length} />
            {toPrepare.length ? (
              <ul className="px-2 pb-2">
                {toPrepare.map((l) => (
                  <li key={l.id}>
                    <Link href={`/clases/${l.id}`} className="flex items-center gap-2.5 rounded-lg px-2 py-2 hover:bg-surface-2">
                      <span style={cvar(lookup.targetColor(l))} className="dot size-2 rounded-full" />
                      <span className="min-w-0 flex-1 truncate text-sm">{lookup.targetName(l)}</span>
                      <span className="text-xs text-muted">
                        {relativeDay(new Date(l.starts_at))} · {hhmm(new Date(l.starts_at))}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-4 pb-4 text-sm text-muted">{lessonsQ.isPending ? 'Cargando…' : 'Todas las próximas clases tienen contenido o tareas.'}</p>
            )}
          </Card>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader title="Próximas clases" icon={CalendarDays} count={upcoming.length} />
          {upcoming.length ? (
            <ul className="px-2 pb-2">
              {upcoming.map((l) => (
                <li key={l.id}>
                  <Link href={`/clases/${l.id}`} className="flex items-center gap-2.5 rounded-lg px-2 py-2 hover:bg-surface-2">
                    <span style={cvar(lookup.targetColor(l))} className="dot size-2 rounded-full" />
                    <span className="min-w-0 flex-1 truncate text-sm">{lookup.targetName(l)}</span>
                    <span className="shrink-0 text-xs text-muted">
                      {relativeDay(new Date(l.starts_at)).replace(/ de .*/, '')} · {hhmm(new Date(l.starts_at))}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-4 pb-4 text-sm text-muted">No hay clases en los próximos días.</p>
          )}
        </Card>

        <Card>
          <CardHeader title="Alumnos con tareas pendientes" icon={AlertCircle} count={pendingStudents.length} action={<Link href="/tareas?ver=pending" className="text-xs font-medium text-accent">Ver</Link>} />
          {pendingStudents.length ? (
            <ul className="px-2 pb-2">
              {pendingStudents.map(({ s, n }) => (
                <li key={s!.id}>
                  <Link href={`/alumnos/${s!.id}?tab=tareas`} className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-surface-2">
                    <Avatar name={studentName(s)} photo={s!.photo} color={s!.color} size={26} />
                    <span className="min-w-0 flex-1 truncate text-sm">{studentName(s)}</span>
                    <span className="rounded-md bg-warning-soft px-1.5 py-0.5 text-[11px] font-medium text-warning tabular-nums">{n}</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-4 pb-4 text-sm text-muted">{pendingQ.isPending ? 'Cargando…' : 'Nadie tiene tareas pendientes.'}</p>
          )}
        </Card>

        <Card>
          <CardHeader title="Actividad reciente" icon={Activity} />
          {activityQ.data?.length ? (
            <ul className="space-y-0.5 px-4 pb-3">
              {activityQ.data.map((a) => (
                <li key={a.id} className="flex items-baseline gap-2 py-1 text-sm">
                  <span className={cn('size-1.5 shrink-0 translate-y-[-2px] rounded-full', a.action === 'created' ? 'bg-success' : a.action === 'deleted' ? 'bg-danger' : 'bg-accent')} />
                  <span className="min-w-0 flex-1 truncate">
                    <span className="text-muted">{activityLabel(a)}: </span>
                    {a.label}
                  </span>
                  <span className="shrink-0 text-[11px] text-muted">{timeAgo(a.created_at)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-4 pb-4 text-sm text-muted">{activityQ.isPending ? 'Cargando…' : 'Sin actividad todavía.'}</p>
          )}
        </Card>
      </div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="border-l border-border py-2.5 first:border-l-0">
      <div className="text-base font-semibold tabular-nums">{value}</div>
      <div className="text-[11px] text-muted">{label}</div>
    </div>
  );
}

function TodayItem({ lesson, tasks }: { lesson: Lesson; tasks: TaskWithAssignments[] }) {
  const lookup = useLookup();
  const start = new Date(lesson.starts_at);
  const end = new Date(lesson.ends_at);
  const now = new Date();
  const live = start <= now && now < end;
  const past = end <= now;
  const related = tasks.filter((t) => (lesson.group_id ? t.group_id === lesson.group_id : t.assignments.some((a) => a.student_id === lesson.student_id)));
  return (
    <li>
      <Link href={`/clases/${lesson.id}`} className={cn('flex gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-surface-2', past && lesson.status !== 'completed' && 'opacity-70')}>
        <div className="w-12 shrink-0 text-right">
          <div className="text-sm font-semibold tabular-nums">{hhmm(start)}</div>
          <div className="text-[11px] text-muted tabular-nums">{hhmm(end)}</div>
        </div>
        <span style={cvar(lookup.targetColor(lesson))} className="dot w-[3px] shrink-0 rounded-full" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-medium">{lookup.targetName(lesson)}</span>
            {live ? <span className="rounded bg-danger px-1 text-[10px] font-semibold text-white">AHORA</span> : null}
            {lesson.status === 'completed' ? <span className="text-[11px] font-medium text-success">Realizada</span> : null}
          </div>
          <div className="text-xs text-muted">
            {lesson.lesson_type} · {durationLabel(lesson.duration_minutes)}
            {lesson.location ? ` · ${lesson.location}` : ''}
          </div>
          {lesson.plan ? <div className="mt-1 line-clamp-2 text-xs text-fg-2">{lesson.plan}</div> : null}
          {related.length ? (
            <div className="mt-1 truncate text-xs text-fg-2">
              <CheckSquare className="mr-1 inline size-3 text-muted" />
              {related.map((t) => t.title).join(' · ')}
            </div>
          ) : null}
        </div>
        <ChevronRight className="size-4 shrink-0 self-center text-muted" />
      </Link>
    </li>
  );
}
