'use client';
import { Suspense, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { CheckSquare, Copy, Filter, Inbox, MoreHorizontal, Plus, Search, Users, X } from 'lucide-react';
import { Button, Input, Segmented, Select } from '@/components/ui/controls';
import { Avatar, Card, EmptyState, ListSkeleton, PageHeader, ProgressBar } from '@/components/ui/display';
import { Menu } from '@/components/ui/overlay';
import { cn } from '@/components/ui/cn';
import { QuickAddTask, TaskRow, WeekNav, aggregateStatus } from '@/components/tasks/parts';
import { DuplicateDialog } from '@/components/tasks/DuplicateDialog';
import { useUi } from '@/components/layout/ui-store';
import { studentName, useLookup, useTasksWeek } from '@/hooks/data';
import { ASSIGNMENT_STATUS, isDone } from '@/lib/labels';
import { cvar } from '@/lib/colors';
import { matches } from '@/lib/search';
import { weekKey, weekLabel, fromDateKey } from '@/lib/dates';
import type { AssignmentStatus, Group, Student, TaskWithAssignments } from '@/lib/types';

type Overview = 'all' | 'with' | 'pending' | 'none';

function TasksPage() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const ui = useUi();
  const lookup = useLookup();
  const week = params.get('semana') ?? weekKey(new Date());
  const view = (params.get('vista') as 'alumnos' | 'lista') ?? 'alumnos';
  const overview = (params.get('ver') as Overview) ?? 'all';
  const [q, setQ] = useState('');
  const [category, setCategory] = useState('');
  const [status, setStatus] = useState<AssignmentStatus | ''>('');
  const [who, setWho] = useState('');
  const [dup, setDup] = useState<{ tasks: TaskWithAssignments[]; studentId?: string; title?: string } | null>(null);
  const tasksQ = useTasksWeek(week);
  const tasks = useMemo(() => tasksQ.data ?? [], [tasksQ.data]);

  const setParam = (k: string, v: string | null) => {
    const p = new URLSearchParams(params.toString());
    if (v) p.set(k, v);
    else p.delete(k);
    router.replace(`${pathname}?${p.toString()}`, { scroll: false });
  };

  // filtros de contenido
  const filtered = useMemo(
    () =>
      tasks.filter((t) => {
        if (q && !matches(`${t.title} ${t.description} ${t.notes}`, q)) return false;
        if (category && t.category_id !== category) return false;
        if (status && !t.assignments.some((a) => a.status === status)) return false;
        if (who.startsWith('g:') && t.group_id !== who.slice(2)) return false;
        if (who.startsWith('s:') && !t.assignments.some((a) => a.student_id === who.slice(2))) return false;
        return true;
      }),
    [tasks, q, category, status, who],
  );
  const hasFilters = !!(q || category || status || who);

  // resumen por alumno (todas las tareas de la semana, sin filtros)
  const perStudent = useMemo(() => {
    const m = new Map<string, { total: number; pending: number }>();
    for (const t of tasks)
      for (const a of t.assignments) {
        const e = m.get(a.student_id) ?? { total: 0, pending: 0 };
        e.total++;
        if (!isDone(a.status)) e.pending++;
        m.set(a.student_id, e);
      }
    return m;
  }, [tasks]);
  const active = lookup.activeStudents;
  const withTasks = active.filter((s) => perStudent.get(s.id)?.total);
  const withPending = active.filter((s) => perStudent.get(s.id)?.pending);
  const without = active.filter((s) => !perStudent.get(s.id)?.total);
  const totalAsg = tasks.reduce((n, t) => n + t.assignments.length, 0);
  const doneAsg = tasks.reduce((n, t) => n + t.assignments.filter((a) => isDone(a.status)).length, 0);

  const studentsToShow = (() => {
    let list = active;
    if (overview === 'with') list = withTasks;
    if (overview === 'pending') list = withPending;
    if (overview === 'none') list = without;
    if (who.startsWith('s:')) list = list.filter((s) => s.id === who.slice(2));
    if (who.startsWith('g:')) list = [];
    return list;
  })();
  const groupsToShow = (() => {
    if (overview === 'none' || who.startsWith('s:')) return [];
    let list = lookup.activeGroups;
    if (who.startsWith('g:')) list = list.filter((g) => g.id === who.slice(2));
    if (overview !== 'all' || hasFilters) list = list.filter((g) => filtered.some((t) => t.group_id === g.id));
    return list;
  })();

  const individualTasksOf = (sid: string) => filtered.filter((t) => !t.group_id && t.assignments.some((a) => a.student_id === sid));
  const groupTasksOf = (sid: string) => tasks.filter((t) => t.group_id && t.assignments.some((a) => a.student_id === sid));

  const overviewCards: { key: Overview; label: string; value: number; tone: string }[] = [
    { key: 'with', label: 'Con tareas', value: withTasks.length, tone: 'text-fg' },
    { key: 'pending', label: 'Con pendientes', value: withPending.length, tone: 'text-warning' },
    { key: 'none', label: 'Sin tareas', value: without.length, tone: 'text-muted' },
  ];

  return (
    <div>
      <PageHeader
        title="Tareas"
        subtitle={weekLabel(fromDateKey(week))}
        actions={
          <>
            <Button onClick={() => setDup({ tasks })} disabled={!tasks.length}>
              <Copy className="size-4" /> <span className="hidden sm:inline">Copiar semana</span>
            </Button>
            <Button variant="primary" onClick={() => ui.openTask({ week })}>
              <Plus className="size-4" /> Nueva tarea
            </Button>
          </>
        }
      >
        <WeekNav week={week} onChange={(w) => setParam('semana', w)} />
      </PageHeader>

      {/* Vista general de la semana */}
      <div className="mb-5 grid grid-cols-3 gap-2 md:grid-cols-4 md:gap-3">
        {overviewCards.map((c) => (
          <button
            key={c.key}
            onClick={() => setParam('ver', overview === c.key ? null : c.key)}
            aria-pressed={overview === c.key}
            className={cn(
              'rounded-xl border bg-surface px-3 py-3 text-left shadow-sm transition-colors md:px-4',
              overview === c.key ? 'border-accent ring-3 ring-[var(--ring)]' : 'border-border hover:border-border-strong',
            )}
          >
            <div className="text-[11px] font-medium text-muted md:text-xs">{c.label}</div>
            <div className={cn('mt-1 text-xl font-semibold tabular-nums md:text-2xl', c.tone)}>{c.value}</div>
            <div className="text-[11px] text-muted">{c.value === 1 ? 'alumno' : 'alumnos'}</div>
          </button>
        ))}
        <div className="col-span-3 rounded-xl border border-border bg-surface px-4 py-3 shadow-sm md:col-span-1">
          <div className="text-xs font-medium text-muted">Progreso de la semana</div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-xl font-semibold tabular-nums md:text-2xl">{totalAsg ? Math.round((doneAsg / totalAsg) * 100) : 0}%</span>
            <span className="text-xs text-muted tabular-nums">
              {doneAsg}/{totalAsg} completadas
            </span>
          </div>
          <ProgressBar value={totalAsg ? doneAsg / totalAsg : 0} className="mt-2" />
        </div>
      </div>

      {/* Filtros */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Segmented
          value={view}
          onChange={(v) => setParam('vista', v === 'alumnos' ? null : v)}
          options={[
            { value: 'alumnos', label: 'Por alumno' },
            { value: 'lista', label: 'Lista' },
          ]}
        />
        <div className="relative min-w-40 flex-1 md:max-w-60">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filtrar tareas…" className="pl-8" aria-label="Filtrar tareas" />
        </div>
        <Select value={who} onChange={(e) => setWho(e.target.value)} className="w-auto max-w-48" aria-label="Alumno o grupo">
          <option value="">Todos</option>
          <optgroup label="Grupos">
            {lookup.activeGroups.map((g) => (
              <option key={g.id} value={'g:' + g.id}>
                {g.name}
              </option>
            ))}
          </optgroup>
          <optgroup label="Alumnos">
            {active.map((s) => (
              <option key={s.id} value={'s:' + s.id}>
                {studentName(s)}
              </option>
            ))}
          </optgroup>
        </Select>
        <Select value={category} onChange={(e) => setCategory(e.target.value)} className="w-auto" aria-label="Categoría">
          <option value="">Categoría</option>
          {lookup.categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
        <Select value={status} onChange={(e) => setStatus(e.target.value as AssignmentStatus | '')} className="w-auto" aria-label="Estado">
          <option value="">Estado</option>
          {Object.entries(ASSIGNMENT_STATUS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </Select>
        {hasFilters || overview !== 'all' ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setQ('');
              setCategory('');
              setStatus('');
              setWho('');
              setParam('ver', null);
            }}
          >
            <X className="size-3.5" /> Limpiar
          </Button>
        ) : null}
      </div>

      {tasksQ.isPending || lookup.loading ? (
        <Card>
          <ListSkeleton rows={6} />
        </Card>
      ) : tasksQ.error ? (
        <Card>
          <EmptyState icon={Filter} title="No se pudieron cargar las tareas" description={(tasksQ.error as Error).message} action={<Button onClick={() => tasksQ.refetch()}>Reintentar</Button>} />
        </Card>
      ) : !active.length && !lookup.activeGroups.length ? (
        <Card>
          <EmptyState
            icon={Users}
            title="Primero añade a tus alumnos"
            description="Las tareas se asignan a alumnos o a grupos completos."
            action={
              <Button variant="primary" onClick={() => ui.openStudent()}>
                <Plus className="size-4" /> Nuevo alumno
              </Button>
            }
          />
        </Card>
      ) : view === 'lista' ? (
        <Card className="p-2">
          {filtered.length ? (
            filtered.map((t) => <TaskRow key={t.id} task={t} showTarget />)
          ) : (
            <EmptyState icon={CheckSquare} title={hasFilters ? 'Ninguna tarea coincide con los filtros' : 'No hay tareas esta semana'} compact />
          )}
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 2xl:grid-cols-3">
          {groupsToShow.map((g) => (
            <GroupCard key={g.id} group={g} tasks={filtered.filter((t) => t.group_id === g.id)} week={week} onCopy={(ts) => setDup({ tasks: ts, title: `Copiar tareas de ${g.name}` })} />
          ))}
          {studentsToShow.map((s) => (
            <StudentCard
              key={s.id}
              student={s}
              tasks={individualTasksOf(s.id)}
              groupTasks={groupTasksOf(s.id)}
              week={week}
              hideEmpty={hasFilters}
              onCopy={(ts) => setDup({ tasks: ts, studentId: s.id, title: `Copiar tareas de ${s.first_name}` })}
            />
          ))}
          {!groupsToShow.length && !studentsToShow.length ? (
            <Card className="lg:col-span-2 2xl:col-span-3">
              <EmptyState
                icon={Inbox}
                compact
                title={overview === 'none' ? 'Todos los alumnos tienen tareas esta semana' : overview === 'pending' ? 'Nadie tiene tareas pendientes' : 'Nada que mostrar con estos filtros'}
              />
            </Card>
          ) : null}
        </div>
      )}

      {dup ? <DuplicateDialog tasks={dup.tasks} fromWeek={week} studentId={dup.studentId} title={dup.title} onClose={() => setDup(null)} /> : null}
    </div>
  );
}

function CardMenu({ onCopy, onDetails, disabled }: { onCopy: () => void; onDetails: () => void; disabled: boolean }) {
  return (
    <Menu
      trigger={(p) => (
        <Button variant="ghost" size="icon-sm" aria-label="Opciones" {...p}>
          <MoreHorizontal className="size-4" />
        </Button>
      )}
      items={[
        { label: 'Copiar a otra semana…', icon: Copy, onSelect: onCopy, disabled },
        { label: 'Tarea con detalles', icon: Plus, onSelect: onDetails },
      ]}
    />
  );
}

function GroupCard({ group, tasks, week, onCopy }: { group: Group; tasks: TaskWithAssignments[]; week: string; onCopy: (t: TaskWithAssignments[]) => void }) {
  const lookup = useLookup();
  const ui = useUi();
  const members = lookup.membersOf(group.id).length;
  const done = tasks.filter((t) => t.assignments.length && isDone(aggregateStatus(t.assignments))).length;
  return (
    <Card className="flex flex-col">
      <div className="flex items-center gap-2.5 px-3.5 pt-3 pb-1.5">
        <span style={cvar(group.color)} className="tint-strong flex size-8 items-center justify-center rounded-lg">
          <Users className="size-4" />
        </span>
        <Link href={`/grupos/${group.id}`} className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold hover:underline">{group.name}</div>
          <div className="text-xs text-muted">
            Grupo · {members} {members === 1 ? 'integrante' : 'integrantes'}
            {tasks.length ? ` · ${done}/${tasks.length} completadas` : ''}
          </div>
        </Link>
        <CardMenu onCopy={() => onCopy(tasks)} onDetails={() => ui.openTask({ groupId: group.id, week })} disabled={!tasks.length} />
      </div>
      <div className="flex-1 px-1.5 pb-1">
        {tasks.map((t) => (
          <TaskRow key={t.id} task={t} />
        ))}
      </div>
      <div className="border-t border-border px-1.5 py-1.5">
        <QuickAddTask groupId={group.id} week={week} placeholder="Añadir tarea al grupo…" />
      </div>
    </Card>
  );
}

function StudentCard({
  student,
  tasks,
  groupTasks,
  week,
  hideEmpty,
  onCopy,
}: {
  student: Student;
  tasks: TaskWithAssignments[];
  groupTasks: TaskWithAssignments[];
  week: string;
  hideEmpty: boolean;
  onCopy: (t: TaskWithAssignments[]) => void;
}) {
  const lookup = useLookup();
  const ui = useUi();
  if (hideEmpty && !tasks.length) return null;
  const own = (t: TaskWithAssignments) => t.assignments.filter((a) => a.student_id === student.id);
  const all = [...tasks, ...groupTasks];
  const pending = all.filter((t) => own(t).some((a) => !isDone(a.status))).length;
  const byGroup = new Map<string, number>();
  for (const t of groupTasks) byGroup.set(t.group_id!, (byGroup.get(t.group_id!) ?? 0) + 1);

  return (
    <Card className="flex flex-col">
      <div className="flex items-center gap-2.5 px-3.5 pt-3 pb-1.5">
        <Avatar name={studentName(student)} photo={student.photo} color={student.color} size={32} />
        <Link href={`/alumnos/${student.id}?tab=tareas`} className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold hover:underline">{studentName(student)}</div>
          <div className="text-xs text-muted">
            {student.instrument || 'Alumno'}
            {all.length ? ` · ${pending ? `${pending} pendiente${pending > 1 ? 's' : ''}` : 'todo completado'}` : ' · sin tareas'}
          </div>
        </Link>
        <CardMenu onCopy={() => onCopy(tasks)} onDetails={() => ui.openTask({ studentIds: [student.id], week })} disabled={!tasks.length} />
      </div>
      <div className="flex-1 px-1.5 pb-1">
        {tasks.map((t) => (
          <TaskRow key={t.id} task={t} forStudent={student.id} />
        ))}
        {byGroup.size ? (
          <div className="flex flex-wrap gap-1.5 px-2.5 py-1.5 text-xs text-muted">
            {[...byGroup].map(([gid, n]) => (
              <Link key={gid} href={`/grupos/${gid}`} className="inline-flex items-center gap-1 hover:text-fg">
                <Users className="size-3" />
                {n} {n === 1 ? 'tarea' : 'tareas'} de {lookup.groupById.get(gid)?.name}
              </Link>
            ))}
          </div>
        ) : null}
      </div>
      <div className="border-t border-border px-1.5 py-1.5">
        <QuickAddTask studentId={student.id} week={week} placeholder={`Añadir tarea a ${student.first_name}…`} />
      </div>
    </Card>
  );
}

export default function Page() {
  return (
    <Suspense>
      <TasksPage />
    </Suspense>
  );
}
