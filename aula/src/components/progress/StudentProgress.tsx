'use client';
import { useMemo, useState } from 'react';
import { addWeeks } from 'date-fns';
import { AlertCircle, Check, Lightbulb, MessageSquareText, MoreHorizontal, Plus, Target, Trash2, Trophy, Undo2 } from 'lucide-react';
import { Badge, Button, Input, Select, Textarea } from '@/components/ui/controls';
import { Card, CardHeader, EmptyState, ProgressBar, Stat } from '@/components/ui/display';
import { Menu, useConfirm } from '@/components/ui/overlay';
import { cn } from '@/components/ui/cn';
import { useAction, useGoals, useLookup, useNotes } from '@/hooks/data';
import { goalApi, noteApi } from '@/services/api';
import { GOAL_STATUS, NOTE_KIND, isDone } from '@/lib/labels';
import { colorHex } from '@/lib/colors';
import { fmt, fromDateKey, toDateKey, weekKey, shortWeekLabel } from '@/lib/dates';
import type { Lesson, NoteKind, TaskWithAssignments } from '@/lib/types';

const KIND_ICON: Record<NoteKind, React.ComponentType<{ className?: string }>> = {
  observation: MessageSquareText,
  achievement: Trophy,
  difficulty: AlertCircle,
  improvement: Lightbulb,
};
const KIND_TONE: Record<NoteKind, string> = {
  observation: 'bg-surface-2 text-fg-2',
  achievement: 'bg-success-soft text-success',
  difficulty: 'bg-danger-soft text-danger',
  improvement: 'bg-warning-soft text-warning',
};

/** Seguimiento de un alumno: indicadores, evolución por categorías, objetivos y anotaciones. */
export function StudentProgress({ studentId, tasks, lessons }: { studentId: string; tasks: TaskWithAssignments[]; lessons: Lesson[] }) {
  const lookup = useLookup();
  const own = useMemo(
    () => tasks.map((t) => ({ t, a: t.assignments.find((a) => a.student_id === studentId)! })).filter((x) => x.a),
    [tasks, studentId],
  );
  const done = own.filter((x) => isDone(x.a.status)).length;
  const now = new Date();
  const past = lessons.filter((l) => new Date(l.starts_at) < now);
  const held = past.filter((l) => l.status === 'completed').length;
  const cancelled = past.filter((l) => l.status === 'cancelled').length;

  // evolución por categorías
  const byCategory = useMemo(() => {
    const m = new Map<string, { total: number; done: number }>();
    for (const { t, a } of own) {
      const k = t.category_id ?? 'none';
      const e = m.get(k) ?? { total: 0, done: 0 };
      e.total++;
      if (isDone(a.status)) e.done++;
      m.set(k, e);
    }
    return [...m].sort((a, b) => b[1].total - a[1].total);
  }, [own]);

  // últimas 8 semanas
  const weeks = useMemo(() => {
    const cur = fromDateKey(weekKey(now));
    return Array.from({ length: 8 }, (_, i) => {
      const w = toDateKey(addWeeks(cur, i - 7));
      const items = own.filter((x) => x.t.week_start === w);
      return { w, total: items.length, done: items.filter((x) => isDone(x.a.status)).length };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [own]);
  const maxWeek = Math.max(1, ...weeks.map((w) => w.total));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Clases realizadas" value={held} hint={cancelled ? `${cancelled} canceladas` : undefined} />
        <Stat label="Tareas asignadas" value={own.length} />
        <Stat label="Completadas" value={own.length ? `${Math.round((done / own.length) * 100)}%` : '—'} hint={`${done} de ${own.length}`} />
        <Stat label="Pendientes" value={own.length - done} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Evolución por categorías" />
          <div className="space-y-3 px-4 pb-4">
            {!byCategory.length ? <p className="text-sm text-muted">Aún no hay tareas asignadas.</p> : null}
            {byCategory.map(([cid, v]) => {
              const c = lookup.categoryById.get(cid);
              return (
                <div key={cid}>
                  <div className="mb-1 flex justify-between text-sm">
                    <span>{c?.name ?? 'Sin categoría'}</span>
                    <span className="text-muted tabular-nums">
                      {v.done}/{v.total}
                    </span>
                  </div>
                  <ProgressBar value={v.done / v.total} color={colorHex(c?.color)} />
                </div>
              );
            })}
          </div>
        </Card>
        <Card>
          <CardHeader title="Últimas 8 semanas" />
          <div className="flex h-40 items-end gap-2 px-4 pb-4">
            {weeks.map((w) => (
              <div key={w.w} className="flex flex-1 flex-col items-center gap-1" title={`${shortWeekLabel(fromDateKey(w.w))}: ${w.done}/${w.total}`}>
                <div className="relative w-full flex-1">
                  <div className="absolute inset-x-0 bottom-0 overflow-hidden rounded-md bg-surface-3" style={{ height: `${(w.total / maxWeek) * 100}%`, minHeight: w.total ? 6 : 2 }}>
                    <div className="absolute inset-x-0 bottom-0 bg-accent" style={{ height: w.total ? `${(w.done / w.total) * 100}%` : 0 }} />
                  </div>
                </div>
                <span className="text-[10px] text-muted tabular-nums">{fmt(fromDateKey(w.w), 'd/M')}</span>
              </div>
            ))}
          </div>
          <p className="-mt-2 px-4 pb-3 text-[11px] text-muted">Barra: tareas asignadas · relleno: completadas</p>
        </Card>
      </div>

      <Goals studentId={studentId} />
      <Notes studentId={studentId} />
    </div>
  );
}

function Goals({ studentId }: { studentId: string }) {
  const lookup = useLookup();
  const goals = useGoals(studentId);
  const confirm = useConfirm();
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('');
  const [target, setTarget] = useState('');
  const add = useAction(
    () => goalApi.create({ student_id: studentId, title: title.trim(), category_id: category || null, target_date: target || null }),
    { invalidate: ['progress'], success: 'Objetivo añadido', onDone: () => { setTitle(''); setTarget(''); } },
  );
  const update = useAction(({ id, status }: { id: string; status: 'active' | 'achieved' | 'dropped' }) =>
    goalApi.update(id, { status, achieved_on: status === 'achieved' ? toDateKey(new Date()) : null }), { invalidate: ['progress'] });
  const remove = useAction((id: string) => goalApi.remove(id), { invalidate: ['progress'], success: 'Objetivo eliminado' });
  const list = goals.data ?? [];

  return (
    <Card>
      <CardHeader title="Objetivos" icon={Target} count={list.filter((g) => g.status === 'active').length} />
      <div className="px-2.5">
        {list.map((g) => (
          <div key={g.id} className="group flex items-center gap-2 rounded-lg px-1.5 py-1.5 hover:bg-surface-2/60">
            <button
              onClick={() => update.mutate({ id: g.id, status: g.status === 'achieved' ? 'active' : 'achieved' })}
              aria-label={g.status === 'achieved' ? 'Marcar en curso' : 'Marcar conseguido'}
              className={cn('flex size-6 shrink-0 items-center justify-center rounded-full border transition-colors', g.status === 'achieved' ? 'border-success bg-success text-white' : 'border-border-strong hover:border-success')}
            >
              {g.status === 'achieved' ? <Check className="size-3.5" strokeWidth={3} /> : null}
            </button>
            <div className="min-w-0 flex-1">
              <div className={cn('text-sm', g.status !== 'active' && 'text-muted line-through')}>{g.title}</div>
              <div className="flex flex-wrap gap-1.5 text-[11px] text-muted">
                {g.category_id ? <span>{lookup.categoryById.get(g.category_id)?.name}</span> : null}
                {g.target_date ? <span>Para el {fmt(g.target_date, 'd MMM yyyy')}</span> : null}
                {g.achieved_on ? <span className="text-success">Conseguido el {fmt(g.achieved_on, 'd MMM yyyy')}</span> : null}
                {g.status === 'dropped' ? <span>{GOAL_STATUS.dropped}</span> : null}
              </div>
            </div>
            <Menu
              trigger={(p) => (
                <Button variant="ghost" size="icon-sm" aria-label="Opciones del objetivo" className="opacity-60 group-hover:opacity-100" {...p}>
                  <MoreHorizontal className="size-4" />
                </Button>
              )}
              items={[
                g.status === 'dropped'
                  ? { label: 'Reactivar', icon: Undo2, onSelect: () => update.mutate({ id: g.id, status: 'active' }) }
                  : { label: 'Descartar', icon: Undo2, onSelect: () => update.mutate({ id: g.id, status: 'dropped' }) },
                {
                  label: 'Eliminar',
                  icon: Trash2,
                  danger: true,
                  onSelect: async () => (await confirm({ title: '¿Eliminar objetivo?', description: g.title, confirmLabel: 'Eliminar', danger: true })) && remove.mutate(g.id),
                },
              ]}
            />
          </div>
        ))}
        {!goals.isPending && !list.length ? <p className="px-1.5 py-1 text-sm text-muted">Define objetivos para medir su progreso.</p> : null}
      </div>
      <form
        className="flex flex-wrap gap-2 border-t border-border p-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (title.trim()) add.mutate(undefined);
        }}
      >
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Nuevo objetivo (p. ej. tocar el concierto de memoria)" className="min-w-48 flex-1" aria-label="Nuevo objetivo" />
        <Select value={category} onChange={(e) => setCategory(e.target.value)} className="w-auto" aria-label="Categoría del objetivo">
          <option value="">Categoría</option>
          {lookup.categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
        <Input type="date" value={target} onChange={(e) => setTarget(e.target.value)} className="w-auto" aria-label="Fecha objetivo" />
        <Button type="submit" variant="primary" disabled={!title.trim()} loading={add.isPending}>
          <Plus className="size-4" /> Añadir
        </Button>
      </form>
    </Card>
  );
}

function Notes({ studentId }: { studentId: string }) {
  const notes = useNotes(studentId);
  const confirm = useConfirm();
  const [kind, setKind] = useState<NoteKind>('observation');
  const [body, setBody] = useState('');
  const [filter, setFilter] = useState<NoteKind | ''>('');
  const add = useAction(() => noteApi.create({ student_id: studentId, kind, body: body.trim() }), {
    invalidate: ['progress'],
    success: 'Anotación guardada',
    onDone: () => setBody(''),
  });
  const remove = useAction((id: string) => noteApi.remove(id), { invalidate: ['progress'], success: 'Anotación eliminada' });
  const list = (notes.data ?? []).filter((n) => !filter || n.kind === filter);
  const counts = Object.fromEntries((Object.keys(NOTE_KIND) as NoteKind[]).map((k) => [k, (notes.data ?? []).filter((n) => n.kind === k).length]));

  return (
    <Card>
      <CardHeader title="Anotaciones del profesor" icon={MessageSquareText} count={notes.data?.length} />
      <div className="flex flex-wrap gap-1.5 px-4 pb-2">
        <button onClick={() => setFilter('')} className={cn('h-7 rounded-md px-2 text-xs font-medium', !filter ? 'bg-fg text-bg' : 'bg-surface-2 text-fg-2')}>
          Todas
        </button>
        {(Object.keys(NOTE_KIND) as NoteKind[]).map((k) => (
          <button key={k} onClick={() => setFilter(k)} className={cn('h-7 rounded-md px-2 text-xs font-medium', filter === k ? 'bg-fg text-bg' : 'bg-surface-2 text-fg-2')}>
            {NOTE_KIND[k]} {counts[k] ? <span className="opacity-60">{counts[k]}</span> : null}
          </button>
        ))}
      </div>
      <form
        className="space-y-2 border-y border-border bg-surface-2/40 p-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (body.trim()) add.mutate(undefined);
        }}
      >
        <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={2} placeholder="Escribe una observación, logro, dificultad o aspecto a mejorar…" aria-label="Nueva anotación" />
        <div className="flex flex-wrap items-center gap-2">
          {(Object.keys(NOTE_KIND) as NoteKind[]).map((k) => {
            const Icon = KIND_ICON[k];
            return (
              <button key={k} type="button" onClick={() => setKind(k)} aria-pressed={kind === k} className={cn('flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium transition-colors', kind === k ? KIND_TONE[k] + ' ring-1 ring-current/30' : 'text-muted hover:bg-surface-2')}>
                <Icon className="size-3.5" />
                {NOTE_KIND[k]}
              </button>
            );
          })}
          <Button type="submit" size="sm" variant="primary" className="ml-auto" disabled={!body.trim()} loading={add.isPending}>
            Guardar
          </Button>
        </div>
      </form>
      <div className="divide-y divide-border">
        {list.map((n) => {
          const Icon = KIND_ICON[n.kind];
          return (
            <div key={n.id} className="group flex gap-3 px-4 py-3">
              <span className={cn('mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg', KIND_TONE[n.kind])}>
                <Icon className="size-3.5" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="mb-0.5 flex items-center gap-2 text-[11px] text-muted">
                  <Badge className={KIND_TONE[n.kind]}>{NOTE_KIND[n.kind]}</Badge>
                  {fmt(n.noted_on, "d 'de' MMMM yyyy")}
                </div>
                <p className="text-sm whitespace-pre-wrap">{n.body}</p>
              </div>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Eliminar anotación"
                className="opacity-0 group-hover:opacity-100 focus:opacity-100 max-md:opacity-60"
                onClick={async () => (await confirm({ title: '¿Eliminar anotación?', confirmLabel: 'Eliminar', danger: true })) && remove.mutate(n.id)}
              >
                <Trash2 className="size-3.5" />
              </Button>
            </div>
          );
        })}
        {!notes.isPending && !list.length ? <EmptyState compact title={filter ? 'Sin anotaciones de este tipo' : 'Sin anotaciones todavía'} /> : null}
      </div>
    </Card>
  );
}
