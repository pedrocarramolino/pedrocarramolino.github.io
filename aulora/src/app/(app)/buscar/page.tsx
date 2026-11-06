'use client';
import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { replaceUrl } from '@/lib/url';
import { CalendarDays, CheckSquare, FileText, Search, Users, X } from 'lucide-react';
import { Button, Field, Input, Segmented, Select, Spinner } from '@/components/ui/controls';
import { Avatar, Card, CardHeader, EmptyState, PageHeader } from '@/components/ui/display';
import { TaskRow } from '@/components/tasks/parts';
import { LessonList } from '@/components/lessons/LessonList';
import { studentName, useAllLessons, useAllNotes, useAllTasks, useLookup } from '@/hooks/data';
import { ASSIGNMENT_STATUS, NOTE_KIND } from '@/lib/labels';
import { matches, serverTerm } from '@/lib/search';
import { addDays, fmt, fromDateKey, toDateKey, weekKey, weekLabel } from '@/lib/dates';
import { cvar } from '@/lib/colors';
import type { AssignmentStatus } from '@/lib/types';

type Kind = 'all' | 'students' | 'groups' | 'lessons' | 'tasks' | 'notes';

function SearchPage() {
  const params = useSearchParams();
  const pathname = usePathname();
  const lookup = useLookup();
  const [q, setQ] = useState(params.get('q') ?? '');
  const [kind, setKind] = useState<Kind>('all');
  const [student, setStudent] = useState('');
  const [group, setGroup] = useState('');
  const [week, setWeek] = useState('');
  const [category, setCategory] = useState('');
  const [status, setStatus] = useState<AssignmentStatus | ''>('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [dq, setDq] = useState(q);

  useEffect(() => {
    const t = setTimeout(() => {
      setDq(q.trim());
      const p = new URLSearchParams(params.toString());
      if (q.trim()) p.set('q', q.trim());
      else p.delete('q');
      replaceUrl(`${pathname}?${p}`);
    }, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const term = serverTerm(dq);
  const filtersOn = !!(student || group || week || category || status || from || to);
  const enabled = term.length >= 2 || filtersOn;
  // rango de fechas efectivo (semana o desde/hasta)
  const range = week ? { from: week, to: toDateKey(addDays(fromDateKey(week), 6)) } : { from, to };

  // todo se filtra en el dispositivo: tareas y notas en vivo, clases leídas una vez
  const allTasks = useAllTasks(enabled);
  const allNotes = useAllNotes();
  const allLessonsQ = useAllLessons(enabled);
  const remote = {
    isFetching: allTasks.isFetching || allLessonsQ.isFetching,
    data: enabled ? { tasks: allTasks.data ?? [], lessons: allLessonsQ.data ?? [], notes: allNotes.data ?? [] } : undefined,
  };

  const inRange = (d: string) => (!range.from || d >= range.from) && (!range.to || d <= range.to);
  const studentGroups = student ? lookup.groupsOf(student) : [];

  const results = useMemo(() => {
    const query = dq;
    const students = lookup.students.filter((s) => (!query || matches(`${studentName(s)} ${s.instrument} ${s.level} ${s.notes} ${s.email}`, query)) && (!group || lookup.groupsOf(s.id).includes(group)) && (!student || s.id === student));
    const groups = lookup.groups.filter((g) => (!query || matches(`${g.name} ${g.subject} ${g.description} ${g.notes} ${g.location}`, query)) && (!group || g.id === group) && (!student || studentGroups.includes(g.id)));
    const tasks = (remote.data?.tasks ?? []).filter(
      (t) =>
        (!query || matches(`${t.title} ${t.description} ${t.notes}`, query)) &&
        (!category || t.category_id === category) &&
        (!group || t.group_id === group) &&
        (!student || t.assignments.some((a) => a.student_id === student)) &&
        (!status || t.assignments.some((a) => a.status === status && (!student || a.student_id === student))) &&
        (inRange(t.week_start) || (!!t.due_on && inRange(t.due_on))),
    );
    const lessons = (remote.data?.lessons ?? []).filter(
      (l) =>
        (!query || matches(`${l.plan} ${l.notes} ${l.summary} ${l.next_goals} ${l.lesson_type} ${l.location} ${lookup.targetName(l)}`, query)) &&
        (!student || l.student_id === student || (l.group_id && studentGroups.includes(l.group_id))) &&
        (!group || l.group_id === group) &&
        inRange(toDateKey(new Date(l.starts_at))),
    );
    const notes = (remote.data?.notes ?? []).filter((n) => (!query || matches(n.body, query)) && (!student || n.student_id === student) && (!group || lookup.groupsOf(n.student_id).includes(group)) && inRange(n.noted_on));
    const onlyTaskFilters = !!(category || status);
    return {
      students: onlyTaskFilters || week || from || to ? [] : students,
      groups: onlyTaskFilters || week || from || to ? [] : groups,
      tasks,
      lessons: onlyTaskFilters ? [] : lessons,
      notes: onlyTaskFilters ? [] : notes,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dq, lookup, remote.data, student, group, status, category, week, from, to]);

  const counts = { students: results.students.length, groups: results.groups.length, lessons: results.lessons.length, tasks: results.tasks.length, notes: results.notes.length };
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const show = (k: Kind) => kind === 'all' || kind === k;
  const clear = () => {
    setStudent('');
    setGroup('');
    setWeek('');
    setCategory('');
    setStatus('');
    setFrom('');
    setTo('');
  };

  return (
    <div>
      <PageHeader title="Buscar" subtitle="Alumnos, grupos, clases, tareas y notas" />
      <div className="relative mb-3">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4.5 -translate-y-1/2 text-muted" />
        <Input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Escribe para buscar…" className="h-11 pl-10 text-[15px]" aria-label="Buscar" />
        {remote.isFetching ? <Spinner className="absolute top-1/2 right-3 -translate-y-1/2" /> : null}
      </div>

      <Card className="mb-4 p-3">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
          <Field label="Alumno">
            <Select value={student} onChange={(e) => setStudent(e.target.value)}>
              <option value="">Todos</option>
              {lookup.students.map((s) => (
                <option key={s.id} value={s.id}>
                  {studentName(s)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Grupo">
            <Select value={group} onChange={(e) => setGroup(e.target.value)}>
              <option value="">Todos</option>
              {lookup.groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Semana" hint={week ? weekLabel(fromDateKey(week)) : undefined}>
            <Input type="date" value={week} onChange={(e) => setWeek(e.target.value ? weekKey(fromDateKey(e.target.value)) : '')} />
          </Field>
          <Field label="Categoría">
            <Select value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="">Todas</option>
              {lookup.categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Estado de la tarea">
            <Select value={status} onChange={(e) => setStatus(e.target.value as AssignmentStatus | '')}>
              <option value="">Todos</option>
              {Object.entries(ASSIGNMENT_STATUS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Desde">
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} disabled={!!week} />
          </Field>
          <Field label="Hasta">
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} disabled={!!week} />
          </Field>
        </div>
        {filtersOn ? (
          <Button size="sm" variant="ghost" className="mt-2" onClick={clear}>
            <X className="size-3.5" /> Quitar filtros
          </Button>
        ) : null}
      </Card>

      {!enabled && !dq ? (
        <Card>
          <EmptyState icon={Search} title="Busca en toda tu información" description="Escribe al menos dos letras o usa los filtros. Atajo: ⌘K desde cualquier pantalla." />
        </Card>
      ) : (
        <>
          <div className="scrollbar-none mb-3 overflow-x-auto">
            <Segmented
              value={kind}
              onChange={setKind}
              options={[
                { value: 'all', label: `Todo ${total}` },
                { value: 'students', label: `Alumnos ${counts.students}` },
                { value: 'groups', label: `Grupos ${counts.groups}` },
                { value: 'lessons', label: `Clases ${counts.lessons}` },
                { value: 'tasks', label: `Tareas ${counts.tasks}` },
                { value: 'notes', label: `Notas ${counts.notes}` },
              ]}
            />
          </div>
          {!total && !remote.isFetching ? (
            <Card>
              <EmptyState compact icon={Search} title="Sin resultados" description="Prueba con otras palabras o quita algún filtro." />
            </Card>
          ) : null}
          <div className="space-y-4">
            {show('students') && counts.students ? (
              <Card>
                <CardHeader title="Alumnos" icon={Users} count={counts.students} />
                <ul className="px-2 pb-2">
                  {results.students.slice(0, 50).map((s) => (
                    <li key={s.id}>
                      <Link href={`/alumnos/${s.id}`} className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-surface-2">
                        <Avatar name={studentName(s)} photo={s.photo} color={s.color} size={28} />
                        <span className="text-sm">{studentName(s)}</span>
                        <span className="truncate text-xs text-muted">{[s.instrument, s.level].filter(Boolean).join(' · ')}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </Card>
            ) : null}
            {show('groups') && counts.groups ? (
              <Card>
                <CardHeader title="Grupos" icon={Users} count={counts.groups} />
                <ul className="px-2 pb-2">
                  {results.groups.map((g) => (
                    <li key={g.id}>
                      <Link href={`/grupos/${g.id}`} className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-surface-2">
                        <span style={cvar(g.color)} className="dot size-2.5 rounded-full" />
                        <span className="text-sm">{g.name}</span>
                        <span className="text-xs text-muted">{g.subject}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </Card>
            ) : null}
            {show('tasks') && counts.tasks ? (
              <Card>
                <CardHeader title="Tareas" icon={CheckSquare} count={counts.tasks} />
                <div className="px-2 pb-2">
                  {results.tasks.slice(0, 100).map((t) => (
                    <TaskRow key={t.id} task={t} showTarget showWeek forStudent={student || undefined} />
                  ))}
                </div>
              </Card>
            ) : null}
            {show('lessons') && counts.lessons ? (
              <Card>
                <CardHeader title="Clases" icon={CalendarDays} count={counts.lessons} />
                <LessonList lessons={results.lessons.slice(0, 100)} showTarget />
              </Card>
            ) : null}
            {show('notes') && counts.notes ? (
              <Card>
                <CardHeader title="Notas de seguimiento" icon={FileText} count={counts.notes} />
                <ul className="divide-y divide-border">
                  {results.notes.slice(0, 50).map((n) => (
                    <li key={n.id}>
                      <Link href={`/alumnos/${n.student_id}?tab=seguimiento`} className="block px-4 py-2.5 hover:bg-surface-2/50">
                        <div className="text-xs text-muted">
                          {studentName(lookup.studentById.get(n.student_id))} · {NOTE_KIND[n.kind]} · {fmt(n.noted_on, 'd MMM yyyy')}
                        </div>
                        <p className="line-clamp-2 text-sm">{n.body}</p>
                      </Link>
                    </li>
                  ))}
                </ul>
              </Card>
            ) : null}
          </div>
        </>
      )}
    </div>
  );
}

export default function Page() {
  return (
    <Suspense>
      <SearchPage />
    </Suspense>
  );
}
