'use client';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { addDays, addWeeks } from 'date-fns';
import { AlertCircle, ChevronRight, LineChart, Search, Target, Trophy } from 'lucide-react';
import { Input, Select } from '@/components/ui/controls';
import { Avatar, Card, EmptyState, ListSkeleton, PageHeader, ProgressBar, Stat } from '@/components/ui/display';
import { studentName, useAllGoals, useAllNotes, useLessonsRange, useLookup, useTasksWeeks } from '@/hooks/data';
import { isDone } from '@/lib/labels';
import { fmt, fromDateKey, startOfDay, timeAgo, toDateKey, weekKey } from '@/lib/dates';
import { matches } from '@/lib/search';

type Sort = 'name' | 'completion' | 'pending' | 'last';

export default function ProgressPage() {
  const lookup = useLookup();
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<Sort>('name');
  const today = startOfDay(new Date());
  const from30 = addDays(today, -30).toISOString();
  const to = addDays(today, 1).toISOString();
  const curWeek = weekKey(new Date());
  const fromWeek = toDateKey(addWeeks(fromDateKey(curWeek), -3));
  const lessonsQ = useLessonsRange(from30, to);
  const tasksQ = useTasksWeeks(fromWeek, curWeek);
  const goalsQ = useAllGoals();
  const notesQ = useAllNotes();

  const rows = useMemo(() => {
    const lessons = lessonsQ.data ?? [];
    const tasks = tasksQ.data ?? [];
    return lookup.activeStudents.map((s) => {
      const groups = lookup.groupsOf(s.id);
      const mine = lessons.filter((l) => l.status === 'completed' && (l.student_id === s.id || (l.group_id && groups.includes(l.group_id))));
      const asg = tasks.flatMap((t) => t.assignments.filter((a) => a.student_id === s.id));
      const done = asg.filter((a) => isDone(a.status)).length;
      const goals = (goalsQ.data ?? []).filter((g) => g.student_id === s.id);
      const notes = (notesQ.data ?? []).filter((n) => n.student_id === s.id);
      const last = mine.map((l) => l.starts_at).sort().at(-1);
      return {
        s,
        classes: mine.length,
        total: asg.length,
        done,
        pending: asg.length - done,
        rate: asg.length ? done / asg.length : -1,
        goalsActive: goals.filter((g) => g.status === 'active').length,
        goalsDone: goals.filter((g) => g.status === 'achieved').length,
        difficulties: notes.filter((n) => n.kind === 'difficulty' && new Date(n.noted_on) >= addDays(today, -30)).length,
        lastNote: notes[0],
        last,
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lookup, lessonsQ.data, tasksQ.data, goalsQ.data, notesQ.data]);

  const visible = rows
    .filter((r) => !q || matches(`${studentName(r.s)} ${r.s.instrument} ${r.s.level}`, q))
    .sort((a, b) =>
      sort === 'completion' ? b.rate - a.rate : sort === 'pending' ? b.pending - a.pending : sort === 'last' ? (b.last ?? '').localeCompare(a.last ?? '') : studentName(a.s).localeCompare(studentName(b.s)),
    );

  const totals = rows.reduce((t, r) => ({ total: t.total + r.total, done: t.done + r.done, goals: t.goals + r.goalsDone, classes: t.classes + r.classes }), { total: 0, done: 0, goals: 0, classes: 0 });
  const loading = lookup.loading || lessonsQ.isPending || tasksQ.isPending;

  return (
    <div>
      <PageHeader title="Seguimiento" subtitle="Evolución de tus alumnos en las últimas semanas" />
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Clases realizadas · 30 días" value={loading ? '–' : totals.classes} />
        <Stat label="Tareas completadas · 4 semanas" value={loading ? '–' : totals.total ? `${Math.round((totals.done / totals.total) * 100)}%` : '—'} hint={`${totals.done} de ${totals.total}`} />
        <Stat label="Objetivos conseguidos" icon={Trophy} value={goalsQ.isPending ? '–' : totals.goals} />
        <Stat label="Dificultades anotadas · 30 días" icon={AlertCircle} value={notesQ.isPending ? '–' : rows.reduce((n, r) => n + r.difficulties, 0)} />
      </div>

      <div className="mb-3 flex flex-wrap gap-2">
        <div className="relative min-w-48 flex-1 md:max-w-72">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar alumno…" className="pl-8" aria-label="Buscar alumno" />
        </div>
        <Select value={sort} onChange={(e) => setSort(e.target.value as Sort)} className="w-auto" aria-label="Ordenar">
          <option value="name">Ordenar por nombre</option>
          <option value="completion">Mayor cumplimiento</option>
          <option value="pending">Más pendientes</option>
          <option value="last">Clase más reciente</option>
        </Select>
      </div>

      <Card>
        {loading ? (
          <ListSkeleton rows={6} />
        ) : !visible.length ? (
          <EmptyState icon={LineChart} title={rows.length ? 'Ningún alumno coincide' : 'Sin alumnos activos'} compact />
        ) : (
          <>
            <div className="hidden grid-cols-[minmax(0,2fr)_90px_minmax(0,1.4fr)_100px_minmax(0,1.6fr)_20px] gap-4 border-b border-border px-4 py-2 text-[11px] font-medium text-muted uppercase md:grid">
              <span>Alumno</span>
              <span>Clases</span>
              <span>Tareas (4 sem.)</span>
              <span>Objetivos</span>
              <span>Última anotación</span>
              <span />
            </div>
            <ul className="divide-y divide-border">
              {visible.map((r) => (
                <li key={r.s.id}>
                  <Link
                    href={`/alumnos/${r.s.id}?tab=seguimiento`}
                    className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 px-4 py-3 transition-colors hover:bg-surface-2/50 md:grid-cols-[minmax(0,2fr)_90px_minmax(0,1.4fr)_100px_minmax(0,1.6fr)_20px]"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <Avatar name={studentName(r.s)} photo={r.s.photo} color={r.s.color} size={32} />
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium">{studentName(r.s)}</div>
                        <div className="truncate text-xs text-muted">
                          {[r.s.instrument, r.s.level].filter(Boolean).join(' · ') || '—'}
                          {r.last ? ` · última clase ${fmt(r.last, 'd MMM')}` : ''}
                        </div>
                      </div>
                    </div>
                    <div className="text-sm tabular-nums md:block">
                      <span className="md:hidden text-xs text-muted">Clases: </span>
                      {r.classes}
                    </div>
                    <div className="col-span-2 md:col-span-1">
                      <div className="mb-1 flex justify-between text-xs">
                        <span className="text-fg-2 tabular-nums">{r.total ? `${r.done}/${r.total}` : 'Sin tareas'}</span>
                        {r.pending ? <span className="text-warning tabular-nums">{r.pending} pend.</span> : null}
                      </div>
                      <ProgressBar value={r.rate < 0 ? 0 : r.rate} />
                    </div>
                    <div className="flex items-center gap-1 text-sm tabular-nums">
                      <Target className="size-3.5 text-muted" />
                      {r.goalsActive}
                      {r.goalsDone ? <span className="text-xs text-success">· {r.goalsDone} ✓</span> : null}
                      {r.difficulties ? (
                        <span className="ml-1 flex items-center gap-0.5 text-xs text-danger" title="Dificultades en los últimos 30 días">
                          <AlertCircle className="size-3" />
                          {r.difficulties}
                        </span>
                      ) : null}
                    </div>
                    <div className="col-span-2 truncate text-xs text-muted md:col-span-1">{r.lastNote ? `${r.lastNote.body} · ${timeAgo(r.lastNote.created_at)}` : '—'}</div>
                    <ChevronRight className="hidden size-4 text-muted md:block" />
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}
      </Card>
    </div>
  );
}
