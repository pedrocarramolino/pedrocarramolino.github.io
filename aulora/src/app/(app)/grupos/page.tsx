'use client';
import { useState } from 'react';
import Link from 'next/link';
import { Clock, MapPin, Plus, Search, Users, UsersRound } from 'lucide-react';
import { Badge, Button, Input } from '@/components/ui/controls';
import { Avatar, Card, EmptyState, PageHeader, Skeleton } from '@/components/ui/display';
import { useUi } from '@/components/layout/ui-store';
import { studentName, useLookup } from '@/hooks/data';
import { cvar } from '@/lib/colors';
import { WEEKDAYS, durationLabel } from '@/lib/dates';
import { matches } from '@/lib/search';

export default function GroupsPage() {
  const ui = useUi();
  const lookup = useLookup();
  const [q, setQ] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const list = lookup.groups.filter((g) => (showArchived || !g.archived) && (!q || matches(`${g.name} ${g.subject} ${g.location} ${g.description}`, q)));
  const archivedCount = lookup.groups.filter((g) => g.archived).length;

  return (
    <div>
      <PageHeader
        title="Grupos"
        subtitle={`${lookup.activeGroups.length} grupos y clases colectivas`}
        actions={
          <Button variant="primary" onClick={() => ui.openGroup()}>
            <Plus className="size-4" /> Nuevo grupo
          </Button>
        }
      />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative min-w-48 flex-1 md:max-w-80">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar grupo…" className="pl-8" aria-label="Buscar grupo" />
        </div>
        {archivedCount ? (
          <Button variant="ghost" size="sm" onClick={() => setShowArchived((s) => !s)}>
            {showArchived ? 'Ocultar archivados' : `Ver archivados (${archivedCount})`}
          </Button>
        ) : null}
      </div>

      {lookup.loading ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-40 rounded-xl" />
          ))}
        </div>
      ) : !lookup.groups.length ? (
        <Card>
          <EmptyState
            icon={UsersRound}
            title="Aún no tienes grupos"
            description="Crea grupos para tus clases colectivas: Lenguaje Musical 1, Grupo de Trompeta, Preparación de audiciones…"
            action={
              <Button variant="primary" onClick={() => ui.openGroup()}>
                <Plus className="size-4" /> Nuevo grupo
              </Button>
            }
          />
        </Card>
      ) : !list.length ? (
        <Card>
          <EmptyState compact icon={Search} title="Ningún grupo coincide" />
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {list.map((g) => {
            const members = lookup.membersOf(g.id).map((id) => lookup.studentById.get(id)).filter(Boolean);
            return (
              <Link key={g.id} href={`/grupos/${g.id}`}>
                <Card className="flex h-full flex-col p-4 transition-[border-color,transform] hover:border-border-strong active:scale-[0.99]">
                  <div className="flex items-start gap-3">
                    <span style={cvar(g.color)} className="tint-strong flex size-10 shrink-0 items-center justify-center rounded-xl">
                      <Users className="size-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h2 className="truncate font-semibold">{g.name}</h2>
                        {g.archived ? <Badge>Archivado</Badge> : null}
                      </div>
                      <p className="truncate text-sm text-muted">{g.subject || g.description || 'Clase colectiva'}</p>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs text-fg-2">
                    {g.usual_weekday ? (
                      <span className="flex items-center gap-1">
                        <Clock className="size-3.5 text-muted" />
                        {WEEKDAYS[g.usual_weekday - 1]}
                        {g.usual_time ? ` ${g.usual_time.slice(0, 5)}` : ''} · {durationLabel(g.lesson_minutes)}
                      </span>
                    ) : null}
                    {g.location ? (
                      <span className="flex items-center gap-1">
                        <MapPin className="size-3.5 text-muted" />
                        {g.location}
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-auto flex items-center gap-2 pt-4">
                    <div className="flex -space-x-1.5">
                      {members.slice(0, 5).map((s) => (
                        <Avatar key={s!.id} name={studentName(s)} photo={s!.photo} color={s!.color} size={24} className="ring-2 ring-surface" />
                      ))}
                    </div>
                    <span className="text-xs text-muted">
                      {members.length} {members.length === 1 ? 'integrante' : 'integrantes'}
                    </span>
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
