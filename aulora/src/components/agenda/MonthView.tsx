'use client';
import { addDays, endOfMonth, startOfMonth } from 'date-fns';
import { cn } from '@/components/ui/cn';
import { cvar } from '@/lib/colors';
import { WEEKDAYS, hhmm, isSameDay, isSameMonth, weekStartOf } from '@/lib/dates';
import { useLookup } from '@/hooks/data';
import type { Lesson } from '@/lib/types';

export function monthGrid(anchor: Date): Date[] {
  const start = weekStartOf(startOfMonth(anchor));
  const end = endOfMonth(anchor);
  const days: Date[] = [];
  for (let d = start; d <= end || days.length % 7 !== 0; d = addDays(d, 1)) days.push(d);
  return days;
}

export function MonthView({
  anchor,
  lessons,
  onDay,
  onOpen,
}: {
  anchor: Date;
  lessons: Lesson[];
  onDay: (d: Date) => void;
  onOpen: (l: Lesson) => void;
}) {
  const lookup = useLookup();
  const days = monthGrid(anchor);
  const today = new Date();
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
      <div className="grid grid-cols-7 border-b border-border">
        {WEEKDAYS.map((d) => (
          <div key={d} className="py-2 text-center text-xs font-medium text-muted">
            <span className="hidden md:inline">{d}</span>
            <span className="md:hidden">{d.slice(0, 2)}</span>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((d, i) => {
          const list = lessons.filter((l) => isSameDay(new Date(l.starts_at), d)).sort((a, b) => a.starts_at.localeCompare(b.starts_at));
          const visible = list.filter((l) => l.status !== 'cancelled');
          const isToday = isSameDay(d, today);
          return (
            <div
              key={d.toISOString()}
              onClick={() => onDay(d)}
              role="button"
              aria-label={`${d.getDate()}: ${visible.length} clases`}
              className={cn(
                'min-h-20 cursor-pointer border-border p-1 transition-colors hover:bg-surface-2/60 md:min-h-28 md:p-1.5',
                i % 7 !== 0 && 'border-l',
                i >= 7 && 'border-t',
                !isSameMonth(d, anchor) && 'bg-surface-2/40 text-muted',
              )}
            >
              <div className="mb-1 flex justify-end md:justify-start">
                <span className={cn('flex size-6 items-center justify-center rounded-full text-xs font-semibold tabular-nums', isToday && 'bg-accent text-accent-fg')}>{d.getDate()}</span>
              </div>
              {/* móvil: puntos · tablet/ordenador: lista */}
              <div className="flex flex-wrap gap-0.5 md:hidden">
                {visible.slice(0, 6).map((l) => (
                  <span key={l.id} style={cvar(lookup.targetColor(l))} className="dot size-1.5 rounded-full" />
                ))}
              </div>
              <div className="hidden space-y-0.5 md:block">
                {list.slice(0, 4).map((l) => (
                  <button
                    key={l.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpen(l);
                    }}
                    style={cvar(lookup.targetColor(l))}
                    className={cn('tint flex w-full items-center gap-1 truncate rounded px-1 py-0.5 text-left text-[11px] font-medium', l.status === 'cancelled' && 'line-through opacity-50')}
                  >
                    <span className="tabular-nums opacity-70">{hhmm(new Date(l.starts_at))}</span>
                    <span className="truncate">{lookup.targetName(l)}</span>
                  </button>
                ))}
                {list.length > 4 ? <div className="px-1 text-[11px] text-muted">+{list.length - 4} más</div> : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
