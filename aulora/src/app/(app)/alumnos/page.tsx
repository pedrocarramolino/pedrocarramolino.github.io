'use client';
import { Suspense, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { prefetchOnIntent, replaceUrl } from '@/lib/url';
import { Archive, ArchiveRestore, Copy, MoreHorizontal, Pencil, Plus, Search, Trash2, Users } from 'lucide-react';
import { Badge, Button, Input, Segmented } from '@/components/ui/controls';
import { Avatar, Card, EmptyState, ListSkeleton, PageHeader } from '@/components/ui/display';
import { Menu } from '@/components/ui/overlay';
import { useUi } from '@/components/layout/ui-store';
import { useStudentActions } from '@/components/students/useStudentActions';
import { studentName, useLookup, usePendingAssignments } from '@/hooks/data';
import { matches } from '@/lib/search';
import { cvar } from '@/lib/colors';
import type { Student, StudentStatus } from '@/lib/types';

type Filter = StudentStatus | 'all';

function StudentsPage() {
  const params = useSearchParams();
  const pathname = usePathname();
  const ui = useUi();
  const lookup = useLookup();
  const actions = useStudentActions();
  const pending = usePendingAssignments();
  const [q, setQ] = useState('');
  const filter = (params.get('estado') as Filter) ?? 'active';

  const pendingBy = useMemo(() => {
    const m = new Map<string, number>();
    for (const a of pending.data ?? []) m.set(a.student_id, (m.get(a.student_id) ?? 0) + 1);
    return m;
  }, [pending.data]);

  const counts = {
    active: lookup.students.filter((s) => s.status === 'active').length,
    inactive: lookup.students.filter((s) => s.status === 'inactive').length,
    archived: lookup.students.filter((s) => s.status === 'archived').length,
  };
  const list = lookup.students.filter(
    (s) =>
      (filter === 'all' || s.status === filter) &&
      (!q || matches(`${studentName(s)} ${s.instrument} ${s.level} ${s.email} ${s.phone} ${lookup.groupsOf(s.id).map((g) => lookup.groupById.get(g)?.name).join(' ')}`, q)),
  );

  return (
    <div>
      <PageHeader
        title="Alumnos"
        subtitle={`${counts.active} activos${counts.inactive ? ` · ${counts.inactive} inactivos` : ''}${counts.archived ? ` · ${counts.archived} archivados` : ''}`}
        actions={
          <Button variant="primary" onClick={() => ui.openStudent()}>
            <Plus className="size-4" /> Nuevo alumno
          </Button>
        }
      />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative min-w-48 flex-1 md:max-w-80">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nombre, instrumento, nivel, grupo…" className="pl-8" aria-label="Buscar alumno" />
        </div>
        <Segmented
          value={filter}
          onChange={(v) => {
            const p = new URLSearchParams(params.toString());
            if (v === 'active') p.delete('estado');
            else p.set('estado', v);
            replaceUrl(`${pathname}?${p}`);
          }}
          options={[
            { value: 'active', label: 'Activos' },
            { value: 'inactive', label: 'Inactivos' },
            { value: 'archived', label: 'Archivados' },
            { value: 'all', label: 'Todos' },
          ]}
        />
      </div>

      <Card>
        {lookup.loading ? (
          <ListSkeleton rows={6} />
        ) : lookup.error ? (
          <EmptyState title="No se pudieron cargar los alumnos" description={(lookup.error as Error).message} />
        ) : !lookup.students.length ? (
          <EmptyState
            icon={Users}
            title="Aún no tienes alumnos"
            description="Crea la ficha de tu primer alumno para empezar a organizar sus clases y tareas."
            action={
              <Button variant="primary" onClick={() => ui.openStudent()}>
                <Plus className="size-4" /> Nuevo alumno
              </Button>
            }
          />
        ) : !list.length ? (
          <EmptyState icon={Search} compact title="Ningún alumno coincide" description={q ? `No hay resultados para «${q}».` : 'No hay alumnos en este estado.'} />
        ) : (
          <ul className="divide-y divide-border">
            {list.map((s) => (
              <StudentRow key={s.id} s={s} pending={pendingBy.get(s.id) ?? 0} actions={actions} />
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function StudentRow({ s, pending, actions }: { s: Student; pending: number; actions: ReturnType<typeof useStudentActions> }) {
  const router = useRouter();
  const lookup = useLookup();
  const ui = useUi();
  const groups = lookup.groupsOf(s.id).map((g) => lookup.groupById.get(g)).filter(Boolean);
  return (
    <li className="group flex items-center gap-3 px-3 py-2.5 transition-colors hover:bg-surface-2/50 md:px-4">
      <Link href={`/alumnos/${s.id}`} {...prefetchOnIntent(router, `/alumnos/${s.id}`)} className="flex min-w-0 flex-1 items-center gap-3">
        <Avatar name={studentName(s)} photo={s.photo} color={s.color} size={38} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-medium">{studentName(s)}</span>
            {s.status !== 'active' ? <Badge>{s.status === 'archived' ? 'Archivado' : 'Inactivo'}</Badge> : null}
          </div>
          <div className="truncate text-xs text-muted">{[s.instrument, s.level, s.usual_schedule].filter(Boolean).join(' · ') || 'Sin especialidad'}</div>
        </div>
        <div className="hidden min-w-0 shrink items-center gap-1 lg:flex">
          {groups.slice(0, 3).map((g) => (
            <Badge key={g!.id} style={cvar(g!.color)} className="tint">
              {g!.name}
            </Badge>
          ))}
        </div>
        {pending ? (
          <span className="shrink-0 rounded-md bg-warning-soft px-1.5 py-0.5 text-[11px] font-medium text-warning tabular-nums" title="Tareas pendientes">
            {pending} pend.
          </span>
        ) : null}
      </Link>
      <Menu
        trigger={(p) => (
          <Button variant="ghost" size="icon-sm" aria-label={`Opciones de ${studentName(s)}`} {...p}>
            <MoreHorizontal className="size-4" />
          </Button>
        )}
        items={[
          { label: 'Editar', icon: Pencil, onSelect: () => ui.openStudent(s) },
          { label: 'Duplicar', icon: Copy, onSelect: () => actions.duplicate(s) },
          s.status === 'archived'
            ? { label: 'Reactivar', icon: ArchiveRestore, onSelect: () => actions.setStatus(s, 'active') }
            : { label: 'Archivar', icon: Archive, onSelect: () => actions.setStatus(s, 'archived') },
          'separator',
          { label: 'Eliminar', icon: Trash2, danger: true, onSelect: () => actions.remove(s) },
        ]}
      />
    </li>
  );
}

export default function Page() {
  return (
    <Suspense>
      <StudentsPage />
    </Suspense>
  );
}
