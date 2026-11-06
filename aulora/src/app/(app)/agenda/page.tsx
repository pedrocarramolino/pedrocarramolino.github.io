'use client';
import { Suspense, useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { addDays, addMonths } from 'date-fns';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { Button, Segmented, Select } from '@/components/ui/controls';
import { Skeleton } from '@/components/ui/display';
import { TimeGrid } from '@/components/agenda/TimeGrid';
import { MonthView, monthGrid } from '@/components/agenda/MonthView';
import { LessonSheet } from '@/components/agenda/LessonSheet';
import { useLessonActions } from '@/components/agenda/useLessonActions';
import { useUi } from '@/components/layout/ui-store';
import { studentName, useLessonsRange, useLookup, useProfile } from '@/hooks/data';
import { capitalize, fmt, fromDateKey, startOfDay, toDateKey, weekStartOf } from '@/lib/dates';
import type { Lesson } from '@/lib/types';

type View = 'dia' | 'semana' | 'mes';

function AgendaPage() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const ui = useUi();
  const lookup = useLookup();
  const profile = useProfile();
  const actions = useLessonActions();
  const [defaultView, setDefaultView] = useState<View>('semana');
  useEffect(() => {
    if (window.matchMedia('(max-width: 639px)').matches) setDefaultView('dia');
  }, []);
  const view = (params.get('vista') as View) ?? defaultView;
  const anchor = params.get('fecha') ? fromDateKey(params.get('fecha')!) : startOfDay(new Date());
  const [open, setOpen] = useState<Lesson | null>(null);
  const [filter, setFilter] = useState('');

  const set = (patch: Record<string, string | null>) => {
    const p = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v) p.set(k, v);
      else p.delete(k);
    }
    router.replace(`${pathname}?${p.toString()}`, { scroll: false });
  };

  const { days, from, to } = useMemo(() => {
    if (view === 'dia') return { days: [anchor], from: anchor, to: addDays(anchor, 1) };
    if (view === 'semana') {
      const s = weekStartOf(anchor);
      const ds = Array.from({ length: 7 }, (_, i) => addDays(s, i));
      return { days: ds, from: s, to: addDays(s, 7) };
    }
    const grid = monthGrid(anchor);
    return { days: grid, from: grid[0], to: addDays(grid[grid.length - 1], 1) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, anchor.getTime()]);

  const lessonsQ = useLessonsRange(from.toISOString(), to.toISOString());
  const lessons = useMemo(() => {
    const all = lessonsQ.data ?? [];
    if (!filter) return all;
    if (filter.startsWith('g:')) return all.filter((l) => l.group_id === filter.slice(2));
    const sid = filter.slice(2);
    const groups = lookup.groupsOf(sid);
    return all.filter((l) => l.student_id === sid || (l.group_id && groups.includes(l.group_id)));
  }, [lessonsQ.data, filter, lookup]);

  // mantiene el panel sincronizado con los datos más recientes
  const openLesson = open ? (lessonsQ.data?.find((l) => l.id === open.id) ?? open) : null;

  const step = (dir: 1 | -1) => {
    const next = view === 'dia' ? addDays(anchor, dir) : view === 'semana' ? addDays(anchor, 7 * dir) : addMonths(anchor, dir);
    set({ fecha: toDateKey(next) });
  };

  const title =
    view === 'dia'
      ? capitalize(fmt(anchor, "EEEE d 'de' MMMM"))
      : view === 'semana'
        ? (() => {
            const s = weekStartOf(anchor);
            const e = addDays(s, 6);
            return s.getMonth() === e.getMonth() ? capitalize(fmt(s, 'MMMM yyyy')) : `${capitalize(fmt(s, 'MMM'))} – ${fmt(e, 'MMM yyyy')}`;
          })()
        : capitalize(fmt(anchor, 'MMMM yyyy'));

  const count = (lessonsQ.data ?? []).filter((l) => l.status !== 'cancelled').length;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2 md:mb-5">
        <div className="mr-auto min-w-0">
          <h1 className="truncate text-[22px] font-semibold tracking-tight md:text-2xl">{title}</h1>
          <p className="text-sm text-muted">
            {lessonsQ.isPending ? 'Cargando…' : `${count} ${count === 1 ? 'clase' : 'clases'}${view === 'dia' ? '' : view === 'semana' ? ' esta semana' : ' este mes'}`}
          </p>
        </div>
        <Button variant="primary" onClick={() => ui.openLesson({ start: view === 'dia' ? defaultStart(anchor) : undefined })}>
          <Plus className="size-4" /> <span className="hidden sm:inline">Nueva clase</span>
          <span className="sm:hidden">Clase</span>
        </Button>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="flex items-center rounded-lg border border-border bg-surface shadow-sm">
          <button className="flex size-9 items-center justify-center rounded-l-lg hover:bg-surface-2" onClick={() => step(-1)} aria-label="Anterior">
            <ChevronLeft className="size-4" />
          </button>
          <button className="h-9 border-x border-border px-3 text-sm font-medium hover:bg-surface-2" onClick={() => set({ fecha: null })}>
            Hoy
          </button>
          <button className="flex size-9 items-center justify-center rounded-r-lg hover:bg-surface-2" onClick={() => step(1)} aria-label="Siguiente">
            <ChevronRight className="size-4" />
          </button>
        </div>
        <Segmented
          value={view}
          onChange={(v) => set({ vista: v })}
          options={[
            { value: 'dia', label: 'Día' },
            { value: 'semana', label: 'Semana' },
            { value: 'mes', label: 'Mes' },
          ]}
        />
        <label className="relative">
          <span className="sr-only">Ir a una fecha</span>
          <input
            type="date"
            value={toDateKey(anchor)}
            onChange={(e) => e.target.value && set({ fecha: e.target.value })}
            className="h-9 rounded-lg border border-border bg-surface px-2 text-sm text-fg-2 shadow-sm"
          />
        </label>
        <Select value={filter} onChange={(e) => setFilter(e.target.value)} className="w-auto max-w-44" aria-label="Filtrar agenda">
          <option value="">Todas las clases</option>
          <optgroup label="Grupos">
            {lookup.activeGroups.map((g) => (
              <option key={g.id} value={'g:' + g.id}>
                {g.name}
              </option>
            ))}
          </optgroup>
          <optgroup label="Alumnos">
            {lookup.activeStudents.map((s) => (
              <option key={s.id} value={'s:' + s.id}>
                {studentName(s)}
              </option>
            ))}
          </optgroup>
        </Select>
      </div>

      {lessonsQ.isPending && !lessonsQ.data ? (
        <Skeleton className="h-[60vh] rounded-xl" />
      ) : lessonsQ.error ? (
        <div className="rounded-xl border border-border bg-surface p-6 text-center text-sm text-danger">
          {(lessonsQ.error as Error).message}{' '}
          <Button size="sm" className="ml-2" onClick={() => lessonsQ.refetch()}>
            Reintentar
          </Button>
        </div>
      ) : view === 'mes' ? (
        <MonthView anchor={anchor} lessons={lessons} onDay={(d) => set({ vista: 'dia', fecha: toDateKey(d) })} onOpen={setOpen} />
      ) : (
        <TimeGrid
          days={days}
          lessons={lessons}
          startHour={profile.data?.day_start_hour ?? 8}
          endHour={profile.data?.day_end_hour ?? 22}
          onSlot={(start) => ui.openLesson({ start })}
          onOpen={setOpen}
          onMove={actions.move}
        />
      )}
      {view !== 'mes' ? <p className="mt-2 hidden text-xs text-muted md:block">Arrastra una clase para moverla o su borde inferior para cambiar la duración. Haz clic en un hueco para crear una clase.</p> : null}
      {view !== 'mes' ? <p className="mt-2 text-xs text-muted md:hidden">Toca un hueco para crear una clase · mantén pulsada una clase para moverla.</p> : null}

      {openLesson ? <LessonSheet lesson={openLesson} onClose={() => setOpen(null)} /> : null}
    </div>
  );
}

function defaultStart(day: Date) {
  const d = new Date(day);
  d.setHours(17, 0, 0, 0);
  return d;
}

export default function Page() {
  return (
    <Suspense>
      <AgendaPage />
    </Suspense>
  );
}
