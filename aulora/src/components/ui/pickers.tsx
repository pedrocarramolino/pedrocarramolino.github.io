'use client';
import { useMemo, useState } from 'react';
import { Check, Search, Users, X } from 'lucide-react';
import { Avatar, ColorDot } from './display';
import { cn } from './cn';
import { COLOR_KEYS, COLORS, cvar } from '@/lib/colors';
import { studentName } from '@/hooks/data';
import type { Group, Student } from '@/lib/types';
import { WEEKDAYS_SHORT, WEEKDAYS } from '@/lib/dates';

function norm(s: string) {
  return s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
}

/** Selector múltiple de alumnos con búsqueda. */
export function StudentMultiPicker({
  students,
  value,
  onChange,
  maxHeight = 220,
}: {
  students: Student[];
  value: string[];
  onChange: (ids: string[]) => void;
  maxHeight?: number;
}) {
  const [q, setQ] = useState('');
  const list = useMemo(() => {
    const n = norm(q.trim());
    return students.filter((s) => !n || norm(studentName(s) + ' ' + s.instrument).includes(n));
  }, [students, q]);
  const toggle = (id: string) => onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-surface">
      <div className="flex items-center gap-2 border-b border-border px-3">
        <Search className="size-4 text-muted" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar alumno…"
          className="h-9 flex-1 bg-transparent outline-none placeholder:text-muted"
        />
        {value.length ? (
          <button type="button" onClick={() => onChange([])} className="text-xs text-muted hover:text-fg">
            Quitar {value.length}
          </button>
        ) : null}
      </div>
      <div className="overflow-y-auto overscroll-contain p-1" style={{ maxHeight }}>
        {list.length === 0 ? <p className="px-3 py-4 text-center text-sm text-muted">Sin resultados</p> : null}
        {list.map((s) => {
          const on = value.includes(s.id);
          return (
            <button
              type="button"
              key={s.id}
              onClick={() => toggle(s.id)}
              className={cn('flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-sm transition-colors', on ? 'bg-accent-soft' : 'hover:bg-surface-2')}
            >
              <Avatar name={studentName(s)} photo={s.photo} color={s.color} size={24} />
              <span className="min-w-0 flex-1 truncate">
                {studentName(s)}
                {s.instrument ? <span className="ml-1.5 text-muted">· {s.instrument}</span> : null}
              </span>
              <span className={cn('flex size-4.5 items-center justify-center rounded border', on ? 'border-accent bg-accent text-accent-fg' : 'border-border-strong')}>
                {on ? <Check className="size-3" strokeWidth={3} /> : null}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Chips de selección de grupos. */
export function GroupChips({ groups, value, onChange }: { groups: Group[]; value: string[]; onChange: (ids: string[]) => void }) {
  if (!groups.length) return <p className="text-sm text-muted">Aún no has creado grupos.</p>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {groups.map((g) => {
        const on = value.includes(g.id);
        return (
          <button
            key={g.id}
            type="button"
            onClick={() => onChange(on ? value.filter((v) => v !== g.id) : [...value, g.id])}
            style={cvar(g.color)}
            className={cn(
              'inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-[13px] font-medium transition-colors',
              on ? 'tint' : 'border-border bg-surface text-fg-2 hover:bg-surface-2',
            )}
          >
            {on ? <Check className="size-3.5" /> : <Users className="size-3.5 opacity-60" />}
            {g.name}
          </button>
        );
      })}
    </div>
  );
}

export function ColorPicker({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Color">
      {COLOR_KEYS.map((k) => (
        <button
          key={k}
          type="button"
          role="radio"
          aria-checked={value === k}
          title={COLORS[k].label}
          onClick={() => onChange(k)}
          style={cvar(k)}
          className={cn('dot size-7 rounded-full ring-offset-2 ring-offset-surface transition-transform active:scale-90', value === k ? 'ring-2 ring-[var(--c)]' : '')}
        />
      ))}
    </div>
  );
}

export function WeekdayPicker({ value, onChange }: { value: number[]; onChange: (v: number[]) => void }) {
  return (
    <div className="flex gap-1.5">
      {WEEKDAYS_SHORT.map((d, i) => {
        const n = i + 1;
        const on = value.includes(n);
        return (
          <button
            type="button"
            key={n}
            title={WEEKDAYS[i]}
            aria-label={WEEKDAYS[i]}
            aria-pressed={on}
            onClick={() => onChange(on ? value.filter((v) => v !== n) : [...value, n].sort())}
            className={cn(
              'size-9 rounded-lg text-sm font-semibold transition-colors',
              on ? 'bg-accent text-accent-fg' : 'border border-border bg-surface text-fg-2 hover:bg-surface-2',
            )}
          >
            {d}
          </button>
        );
      })}
    </div>
  );
}

export function TargetChip({ name, color, onRemove, isGroup }: { name: string; color?: string | null; onRemove?: () => void; isGroup?: boolean }) {
  return (
    <span style={cvar(color)} className="tint inline-flex h-7 items-center gap-1.5 rounded-lg border px-2 text-[13px] font-medium">
      {isGroup ? <Users className="size-3.5" /> : <ColorDot color={color} />}
      {name}
      {onRemove ? (
        <button type="button" onClick={onRemove} aria-label={`Quitar ${name}`} className="-mr-1 rounded p-0.5 opacity-60 hover:opacity-100">
          <X className="size-3" />
        </button>
      ) : null}
    </span>
  );
}
