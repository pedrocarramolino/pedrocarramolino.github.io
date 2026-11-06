'use client';
import { Suspense, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { Archive, ArchiveRestore, ArrowLeft, CalendarPlus, ChevronDown, Clock, Copy, MapPin, MoreHorizontal, Pencil, Plus, Trash2, UserPlus, Users } from 'lucide-react';
import { Badge, Button } from '@/components/ui/controls';
import { Avatar, Card, CardHeader, EmptyState, ListSkeleton, Skeleton, Tabs } from '@/components/ui/display';
import { Dialog, Menu, useConfirm } from '@/components/ui/overlay';
import { StudentMultiPicker } from '@/components/ui/pickers';
import { useUi } from '@/components/layout/ui-store';
import { QuickAddTask, StatusButton, TaskRow } from '@/components/tasks/parts';
import { DuplicateDialog } from '@/components/tasks/DuplicateDialog';
import { LessonList } from '@/components/lessons/LessonList';
import { studentName, useAction, useGroupTasks, useInvalidate, useLessonsFor, useLookup } from '@/hooks/data';
import { groupApi } from '@/services/api';
import { isDone } from '@/lib/labels';
import { cvar } from '@/lib/colors';
import { WEEKDAYS, durationLabel, fromDateKey, weekKey, weekLabel } from '@/lib/dates';
import type { Group, TaskWithAssignments } from '@/lib/types';

type Tab = 'tareas' | 'integrantes' | 'agenda' | 'info';

function GroupPage() {
  const { id } = useParams<{ id: string }>();
  const params = useSearchParams();
  const lookup = useLookup();
  const group = lookup.groupById.get(id);
  const tab = (params.get('tab') as Tab) ?? 'tareas';
  if (lookup.loading) return <Skeleton className="h-64" />;
  if (!group)
    return (
      <EmptyState
        icon={Users}
        title="Grupo no encontrado"
        action={
          <Link href="/grupos" className="text-sm font-medium text-accent">
            Ver grupos
          </Link>
        }
      />
    );
  return <GroupDetail group={group} tab={tab} />;
}

function GroupDetail({ group, tab }: { group: Group; tab: Tab }) {
  const router = useRouter();
  const ui = useUi();
  const lookup = useLookup();
  const confirm = useConfirm();
  const invalidate = useInvalidate();
  const memberIds = lookup.membersOf(group.id);
  const tasksQ = useGroupTasks(group.id);
  const lessonsQ = useLessonsFor(null, [group.id]);
  const [managing, setManaging] = useState(false);
  const now = new Date();
  const lessons = lessonsQ.data ?? [];
  const upcoming = lessons.filter((l) => new Date(l.ends_at) >= now && l.status === 'scheduled').sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  const past = lessons.filter((l) => new Date(l.ends_at) < now || l.status !== 'scheduled');

  const archive = useAction(() => groupApi.update(group.id, { archived: !group.archived }), {
    invalidate: ['groups'],
    success: group.archived ? 'Grupo reactivado' : 'Grupo archivado',
  });
  const remove = async () => {
    const ok = await confirm({
      title: `¿Eliminar «${group.name}»?`,
      description: 'Se eliminarán sus clases y las tareas asignadas al grupo. Los alumnos no se borran.',
      confirmLabel: 'Eliminar grupo',
      danger: true,
    });
    if (!ok) return;
    try {
      await groupApi.remove(group.id);
      await invalidate('groups', 'lessons', 'tasks');
      toast.success('Grupo eliminado');
      router.push('/grupos');
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <div>
      <Link href="/grupos" className="mb-3 inline-flex items-center gap-1 text-sm text-muted hover:text-fg">
        <ArrowLeft className="size-4" /> Grupos
      </Link>
      <div className="mb-5 flex flex-wrap items-start gap-4">
        <span style={cvar(group.color)} className="tint-strong flex size-14 shrink-0 items-center justify-center rounded-2xl">
          <Users className="size-6" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-[22px] font-semibold tracking-tight md:text-2xl">{group.name}</h1>
            {group.archived ? <Badge>Archivado</Badge> : null}
          </div>
          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-fg-2">
            <span>{group.subject || 'Clase colectiva'}</span>
            {group.usual_weekday ? (
              <span className="flex items-center gap-1">
                <Clock className="size-4 text-muted" />
                {WEEKDAYS[group.usual_weekday - 1]} {group.usual_time?.slice(0, 5)} · {durationLabel(group.lesson_minutes)}
              </span>
            ) : null}
            {group.location ? (
              <span className="flex items-center gap-1">
                <MapPin className="size-4 text-muted" />
                {group.location}
              </span>
            ) : null}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => ui.openLesson({ groupId: group.id })}>
            <CalendarPlus className="size-4" /> <span className="hidden sm:inline">Programar clase</span>
          </Button>
          <Button variant="primary" onClick={() => ui.openTask({ groupId: group.id })}>
            <Plus className="size-4" /> Tarea al grupo
          </Button>
          <Menu
            trigger={(p) => (
              <Button size="icon" aria-label="Más acciones" {...p}>
                <MoreHorizontal className="size-4" />
              </Button>
            )}
            items={[
              { label: 'Editar grupo', icon: Pencil, onSelect: () => ui.openGroup(group) },
              { label: 'Gestionar integrantes', icon: UserPlus, onSelect: () => setManaging(true) },
              group.archived
                ? { label: 'Reactivar', icon: ArchiveRestore, onSelect: () => archive.mutate(undefined) }
                : { label: 'Archivar', icon: Archive, onSelect: () => archive.mutate(undefined) },
              'separator',
              { label: 'Eliminar', icon: Trash2, danger: true, onSelect: remove },
            ]}
          />
        </div>
      </div>

      <Tabs
        value={tab}
        hrefFor={(v) => `/grupos/${group.id}${v === 'tareas' ? '' : `?tab=${v}`}`}
        tabs={[
          { value: 'tareas', label: 'Tareas' },
          { value: 'integrantes', label: 'Integrantes', count: memberIds.length },
          { value: 'agenda', label: 'Agenda', count: upcoming.length || undefined },
          { value: 'info', label: 'Información' },
        ]}
      />

      <div className="animate-rise mt-5" key={tab}>
        {tab === 'tareas' ? <GroupTasks group={group} tasks={tasksQ.data ?? []} loading={tasksQ.isPending} /> : null}
        {tab === 'integrantes' ? (
          <Card>
            <CardHeader
              title="Integrantes"
              count={memberIds.length}
              action={
                <Button size="sm" variant="ghost" onClick={() => setManaging(true)}>
                  <UserPlus className="size-3.5" /> Gestionar
                </Button>
              }
            />
            {memberIds.length ? (
              <ul className="divide-y divide-border">
                {memberIds.map((sid) => {
                  const s = lookup.studentById.get(sid);
                  const others = lookup.groupsOf(sid).filter((g) => g !== group.id);
                  return (
                    <li key={sid} className="flex items-center gap-3 px-4 py-2.5">
                      <Link href={`/alumnos/${sid}`} className="flex min-w-0 flex-1 items-center gap-3">
                        <Avatar name={studentName(s)} photo={s?.photo} color={s?.color} size={32} />
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium">{studentName(s)}</div>
                          <div className="truncate text-xs text-muted">
                            {[s?.instrument, s?.level].filter(Boolean).join(' · ')}
                            {others.length ? ` · también en ${others.map((g) => lookup.groupById.get(g)?.name).join(', ')}` : ''}
                          </div>
                        </div>
                      </Link>
                      <Button size="sm" variant="ghost" onClick={() => ui.openTask({ studentIds: [sid] })} title="Asignar una tarea solo a este alumno">
                        <Plus className="size-3.5" /> Tarea individual
                      </Button>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <EmptyState compact icon={Users} title="Sin integrantes" action={<Button size="sm" onClick={() => setManaging(true)}>Añadir alumnos</Button>} />
            )}
          </Card>
        ) : null}
        {tab === 'agenda' ? (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader title="Próximas clases" count={upcoming.length} />
              {lessonsQ.isPending ? <ListSkeleton rows={3} /> : <LessonList lessons={upcoming.slice(0, 30)} empty="No hay clases programadas." />}
            </Card>
            <Card>
              <CardHeader title="Historial" count={past.length} />
              {lessonsQ.isPending ? <ListSkeleton rows={3} /> : <LessonList lessons={past.slice(0, 30)} empty="Aún no hay clases realizadas." />}
            </Card>
          </div>
        ) : null}
        {tab === 'info' ? (
          <Card className="space-y-4 p-4">
            <div>
              <div className="text-xs text-muted">Descripción</div>
              <p className="mt-1 text-sm whitespace-pre-wrap">{group.description || <span className="text-muted">—</span>}</p>
            </div>
            <div>
              <div className="text-xs text-muted">Observaciones</div>
              <p className="mt-1 text-sm whitespace-pre-wrap">{group.notes || <span className="text-muted">—</span>}</p>
            </div>
            <Button size="sm" onClick={() => ui.openGroup(group)}>
              <Pencil className="size-3.5" /> Editar
            </Button>
          </Card>
        ) : null}
      </div>
      {managing ? <MembersDialog group={group} onClose={() => setManaging(false)} /> : null}
    </div>
  );
}

function MembersDialog({ group, onClose }: { group: Group; onClose: () => void }) {
  const lookup = useLookup();
  const current = lookup.membersOf(group.id);
  const [ids, setIds] = useState(current);
  const save = useAction(() => groupApi.setMembers(group.id, ids, current), { invalidate: ['groups', 'students'], success: 'Integrantes actualizados', onDone: onClose });
  return (
    <Dialog
      open
      onClose={onClose}
      title={`Integrantes de ${group.name}`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={() => save.mutate(undefined)} loading={save.isPending}>
            Guardar ({ids.length})
          </Button>
        </>
      }
    >
      <StudentMultiPicker students={lookup.students.filter((s) => s.status !== 'archived' || ids.includes(s.id))} value={ids} onChange={setIds} maxHeight={360} />
    </Dialog>
  );
}

function GroupTasks({ group, tasks, loading }: { group: Group; tasks: TaskWithAssignments[]; loading: boolean }) {
  const current = weekKey(new Date());
  const [dup, setDup] = useState<{ week: string; tasks: TaskWithAssignments[] } | null>(null);
  const weeks = useMemo(() => {
    const m = new Map<string, TaskWithAssignments[]>();
    m.set(current, []);
    for (const t of tasks) m.set(t.week_start, [...(m.get(t.week_start) ?? []), t]);
    return [...m].sort((a, b) => b[0].localeCompare(a[0]));
  }, [tasks, current]);
  if (loading) return <Card><ListSkeleton rows={4} /></Card>;
  return (
    <div className="space-y-3">
      {weeks.map(([w, ts]) => (
        <Card key={w}>
          <CardHeader
            title={
              <span className="flex items-center gap-2">
                {weekLabel(fromDateKey(w))}
                {w === current ? <Badge className="bg-accent-soft text-accent">Esta semana</Badge> : null}
              </span>
            }
            action={
              ts.length ? (
                <Button size="sm" variant="ghost" onClick={() => setDup({ week: w, tasks: ts })}>
                  <Copy className="size-3.5" /> Copiar
                </Button>
              ) : null
            }
          />
          <div className="px-2.5 pb-2">
            {ts.map((t) => (
              <GroupTaskRow key={t.id} task={t} />
            ))}
            {w >= current ? <QuickAddTask groupId={group.id} week={w} placeholder="Añadir tarea al grupo…" /> : null}
          </div>
        </Card>
      ))}
      {dup ? <DuplicateDialog tasks={dup.tasks} fromWeek={dup.week} title={`Copiar tareas de ${group.name}`} onClose={() => setDup(null)} /> : null}
    </div>
  );
}

/** Tarea de grupo con desglose del estado de cada integrante. */
function GroupTaskRow({ task }: { task: TaskWithAssignments }) {
  const lookup = useLookup();
  const [open, setOpen] = useState(false);
  const done = task.assignments.filter((a) => isDone(a.status)).length;
  return (
    <div>
      <div className="flex items-start">
        <div className="min-w-0 flex-1">
          <TaskRow task={task} />
        </div>
        {task.assignments.length ? (
          <button onClick={() => setOpen((o) => !o)} className="mt-1.5 flex h-7 items-center gap-1 rounded-md px-2 text-xs text-muted hover:bg-surface-2" aria-expanded={open}>
            {done}/{task.assignments.length}
            <ChevronDown className={`size-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
          </button>
        ) : null}
      </div>
      {open ? (
        <div className="animate-rise mb-2 ml-10 grid gap-0.5 sm:grid-cols-2">
          {task.assignments.map((a) => {
            const s = lookup.studentById.get(a.student_id);
            return (
              <div key={a.id} className="flex items-center gap-2 rounded-md py-0.5 pr-2">
                <StatusButton assignments={[a]} size="sm" />
                <Avatar name={studentName(s)} photo={s?.photo} color={s?.color} size={20} />
                <span className="truncate text-sm">{studentName(s)}</span>
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

export default function Page() {
  return (
    <Suspense>
      <GroupPage />
    </Suspense>
  );
}
