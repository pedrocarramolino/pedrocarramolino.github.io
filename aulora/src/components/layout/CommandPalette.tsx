'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, CalendarDays, CalendarPlus, CheckSquare, FileText, Search, UserPlus, Users, UsersRound } from 'lucide-react';
import { Avatar } from '@/components/ui/display';
import { Kbd, Spinner } from '@/components/ui/controls';
import { cn } from '@/components/ui/cn';
import { studentName, useLookup } from '@/hooks/data';
import { noteApi, searchApi, taskApi } from '@/services/api';
import { matches, serverTerm } from '@/lib/search';
import { fmt, shortWeekLabel, fromDateKey } from '@/lib/dates';
import { NAV } from './nav';
import { useUi } from './ui-store';

type Item = {
  id: string;
  section: string;
  label: string;
  sub?: string;
  icon?: React.ReactNode;
  run: () => void;
};

function useDebounced<T>(v: T, ms = 220) {
  const [d, setD] = useState(v);
  useEffect(() => {
    const t = setTimeout(() => setD(v), ms);
    return () => clearTimeout(t);
  }, [v, ms]);
  return d;
}

export function CommandPalette({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const ui = useUi();
  const lookup = useLookup();
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const dq = useDebounced(q.trim());
  const term = serverTerm(dq);

  const remote = useQuery({
    queryKey: ['palette', term],
    enabled: term.length >= 2,
    queryFn: async () => {
      const [tasks, notes, lessons] = await Promise.all([taskApi.search({ q: term }), noteApi.search(term), searchApi.lessons(term)]);
      return { tasks: tasks.slice(0, 6), notes: notes.slice(0, 4), lessons: lessons.slice(0, 4) };
    },
    staleTime: 10_000,
  });

  const go = (href: string) => {
    onClose();
    router.push(href);
  };

  const items = useMemo<Item[]>(() => {
    const query = q.trim();
    const out: Item[] = [];
    if (!query) {
      out.push(
        { id: 'a-task', section: 'Acciones', label: 'Nueva tarea', icon: <CheckSquare className="size-4" />, run: () => ui.openTask() },
        { id: 'a-lesson', section: 'Acciones', label: 'Nueva clase', icon: <CalendarPlus className="size-4" />, run: () => ui.openLesson() },
        { id: 'a-student', section: 'Acciones', label: 'Nuevo alumno', icon: <UserPlus className="size-4" />, run: () => ui.openStudent() },
        { id: 'a-group', section: 'Acciones', label: 'Nuevo grupo', icon: <UsersRound className="size-4" />, run: () => ui.openGroup() },
      );
      for (const n of NAV) out.push({ id: 'nav' + n.href, section: 'Ir a', label: n.label, icon: <n.icon className="size-4" />, run: () => go(n.href) });
      return out;
    }
    for (const s of lookup.students.filter((s) => matches(`${studentName(s)} ${s.instrument} ${s.level} ${s.email} ${s.phone}`, query)).slice(0, 6)) {
      out.push({
        id: 's' + s.id,
        section: 'Alumnos',
        label: studentName(s),
        sub: [s.instrument, s.level, s.status === 'archived' ? 'Archivado' : s.status === 'inactive' ? 'Inactivo' : ''].filter(Boolean).join(' · '),
        icon: <Avatar name={studentName(s)} photo={s.photo} color={s.color} size={22} />,
        run: () => go(`/alumnos/${s.id}`),
      });
    }
    for (const g of lookup.groups.filter((g) => matches(`${g.name} ${g.subject} ${g.location} ${g.description}`, query)).slice(0, 4)) {
      out.push({ id: 'g' + g.id, section: 'Grupos', label: g.name, sub: g.subject, icon: <Users className="size-4" />, run: () => go(`/grupos/${g.id}`) });
    }
    if (remote.data && term === serverTerm(query)) {
      for (const t of remote.data.tasks.filter((t) => matches(`${t.title} ${t.description} ${t.notes}`, query))) {
        const who = t.group_id ? lookup.groupById.get(t.group_id)?.name : t.assignments.map((a) => lookup.studentById.get(a.student_id)?.first_name).filter(Boolean).join(', ');
        out.push({
          id: 't' + t.id,
          section: 'Tareas',
          label: t.title,
          sub: [who, shortWeekLabel(fromDateKey(t.week_start))].filter(Boolean).join(' · '),
          icon: <CheckSquare className="size-4" />,
          run: () => go(`/tareas?semana=${t.week_start}`),
        });
      }
      for (const l of remote.data.lessons) {
        out.push({
          id: 'l' + l.id,
          section: 'Clases',
          label: `${lookup.targetName(l)} · ${fmt(l.starts_at, "d MMM yyyy, HH:mm")}`,
          sub: [l.summary, l.plan, l.notes].find((x) => x)?.slice(0, 80),
          icon: <CalendarDays className="size-4" />,
          run: () => go(`/clases/${l.id}`),
        });
      }
      for (const n of remote.data.notes) {
        out.push({
          id: 'n' + n.id,
          section: 'Notas',
          label: n.body.slice(0, 80),
          sub: `${studentName(lookup.studentById.get(n.student_id))} · ${fmt(n.noted_on, 'd MMM yyyy')}`,
          icon: <FileText className="size-4" />,
          run: () => go(`/alumnos/${n.student_id}?tab=seguimiento`),
        });
      }
    }
    out.push({ id: 'adv', section: 'Más', label: `Búsqueda avanzada de «${query}»`, icon: <Search className="size-4" />, run: () => go(`/buscar?q=${encodeURIComponent(query)}`) });
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, lookup, remote.data, term]);

  useEffect(() => setSel(0), [q]);
  useEffect(() => {
    inputRef.current?.focus();
    const prev = document.documentElement.style.overflow;
    document.documentElement.style.overflow = 'hidden';
    return () => {
      document.documentElement.style.overflow = prev;
    };
  }, []);
  useEffect(() => {
    listRef.current?.querySelector(`[data-index="${sel}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [sel]);

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSel((s) => Math.min(items.length - 1, s + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSel((s) => Math.max(0, s - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      items[sel]?.run();
    } else if (e.key === 'Escape') onClose();
  };

  let lastSection = '';
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-start justify-center p-3 pt-[max(env(safe-area-inset-top),12px)] md:pt-[12vh]">
      <div className="animate-fade-in absolute inset-0 bg-black/30 backdrop-blur-[2px]" onClick={onClose} />
      <div role="dialog" aria-label="Buscar" className="animate-pop-in relative w-full max-w-xl overflow-hidden rounded-xl border border-border bg-surface shadow-lg">
        <div className="flex items-center gap-3 border-b border-border px-4">
          <Search className="size-4.5 shrink-0 text-muted" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={onKey}
            placeholder="Buscar alumnos, grupos, tareas, clases, notas…"
            className="h-13 flex-1 bg-transparent text-[15px] outline-none placeholder:text-muted"
            aria-label="Buscar"
          />
          {remote.isFetching ? <Spinner /> : <Kbd>Esc</Kbd>}
        </div>
        <div ref={listRef} className="max-h-[60dvh] overflow-y-auto overscroll-contain p-1.5">
          {items.map((it, i) => {
            const header = it.section !== lastSection ? it.section : null;
            lastSection = it.section;
            return (
              <div key={it.id}>
                {header ? <div className="px-2.5 pt-2.5 pb-1 text-[11px] font-semibold tracking-wide text-muted uppercase">{header}</div> : null}
                <button
                  data-index={i}
                  onMouseMove={() => setSel(i)}
                  onClick={it.run}
                  className={cn('flex min-h-10 w-full items-center gap-3 rounded-lg px-2.5 py-1.5 text-left transition-colors', sel === i ? 'bg-surface-2' : '')}
                >
                  <span className="flex size-6 shrink-0 items-center justify-center text-muted">{it.icon}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm">{it.label}</span>
                    {it.sub ? <span className="block truncate text-xs text-muted">{it.sub}</span> : null}
                  </span>
                  {sel === i ? <ArrowRight className="size-3.5 text-muted" /> : null}
                </button>
              </div>
            );
          })}
          {q.trim() && term.length >= 2 && remote.isPending ? <p className="px-3 py-2 text-xs text-muted">Buscando en tareas, clases y notas…</p> : null}
        </div>
      </div>
    </div>,
    document.body,
  );
}
