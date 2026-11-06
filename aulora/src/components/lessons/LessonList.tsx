'use client';
import Link from 'next/link';
import { Ban, CheckCircle2, ChevronRight, Circle, Users } from 'lucide-react';
import { cn } from '@/components/ui/cn';
import { useLookup } from '@/hooks/data';
import { capitalize, durationLabel, fmt, timeRange } from '@/lib/dates';
import type { Lesson } from '@/lib/types';

/** Lista compacta de clases (agenda de un alumno o grupo). */
export function LessonList({ lessons, showTarget = false, empty }: { lessons: Lesson[]; showTarget?: boolean; empty?: string }) {
  const lookup = useLookup();
  if (!lessons.length) return <p className="px-4 py-3 text-sm text-muted">{empty ?? 'Sin clases.'}</p>;
  return (
    <ul className="divide-y divide-border">
      {lessons.map((l) => {
        const Icon = l.status === 'completed' ? CheckCircle2 : l.status === 'cancelled' ? Ban : Circle;
        return (
          <li key={l.id}>
            <Link href={`/clases/${l.id}`} className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-surface-2/50">
              <Icon className={cn('size-4 shrink-0', l.status === 'completed' ? 'text-success' : l.status === 'cancelled' ? 'text-danger' : 'text-muted')} />
              <div className="w-24 shrink-0 md:w-32">
                <div className={cn('text-sm font-medium', l.status === 'cancelled' && 'line-through opacity-60')}>{capitalize(fmt(l.starts_at, 'EEE d MMM'))}</div>
                <div className="text-xs text-muted tabular-nums">{timeRange(l.starts_at, l.ends_at)}</div>
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 text-sm">
                  {showTarget || l.group_id ? (
                    <>
                      {l.group_id ? <Users className="size-3.5 text-muted" /> : null}
                      <span className="truncate">{lookup.targetName(l)}</span>
                      <span className="text-muted">·</span>
                    </>
                  ) : null}
                  <span className="truncate text-fg-2">
                    {l.lesson_type} · {durationLabel(l.duration_minutes)}
                  </span>
                </div>
                {l.plan || l.summary ? <div className="truncate text-xs text-muted">{l.summary || l.plan}</div> : null}
              </div>
              <ChevronRight className="size-4 shrink-0 text-muted" />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
