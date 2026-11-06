'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Ban, CheckCircle2, Repeat } from 'lucide-react';
import { addDays } from 'date-fns';
import { cn } from '@/components/ui/cn';
import { cvar } from '@/lib/colors';
import { capitalize, fmt, hhmm, isSameDay, startOfDay } from '@/lib/dates';
import { useLookup } from '@/hooks/data';
import { layoutDay } from './layout';
import type { Lesson } from '@/lib/types';

const SNAP = 15; // minutos

type Drag = {
  lesson: Lesson;
  mode: 'move' | 'resize';
  startX: number;
  startY: number;
  dayDelta: number;
  minuteDelta: number;
  active: boolean;
};

/**
 * Rejilla horaria para las vistas Día y Semana.
 *  - Clic/toque en un hueco: nueva clase a esa hora.
 *  - Arrastrar una clase: moverla (ratón: directamente; táctil: mantener pulsado).
 *  - Arrastrar el borde inferior: cambiar la duración.
 */
export function TimeGrid({
  days,
  lessons,
  startHour,
  endHour,
  onSlot,
  onOpen,
  onMove,
}: {
  days: Date[];
  lessons: Lesson[];
  startHour: number;
  endHour: number;
  onSlot: (d: Date) => void;
  onOpen: (l: Lesson) => void;
  onMove: (l: Lesson, start: Date, minutes: number) => Promise<boolean>;
}) {
  const lookup = useLookup();
  const [hourH, setHourH] = useState(56);
  const scrollRef = useRef<HTMLDivElement>(null);
  const colsRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const dragRef = useRef<Drag | null>(null);
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suppressClick = useRef(false);
  const [now, setNow] = useState(() => new Date());

  // ajusta el rango para que se vean clases fuera del horario habitual
  const [h0, h1] = useMemo(() => {
    let a = startHour;
    let b = endHour;
    for (const l of lessons) {
      const s = new Date(l.starts_at);
      const e = new Date(l.ends_at);
      a = Math.min(a, s.getHours());
      b = Math.max(b, e.getHours() + (e.getMinutes() ? 1 : 0) + (isSameDay(s, e) ? 0 : 24));
    }
    return [Math.max(0, a), Math.min(24, Math.max(b, a + 1))];
  }, [lessons, startHour, endHour]);

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)');
    const upd = () => setHourH(mq.matches ? 56 : 52);
    upd();
    mq.addEventListener('change', upd);
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => {
      mq.removeEventListener('change', upd);
      clearInterval(t);
    };
  }, []);

  // al abrir, desplaza a la hora actual (o a la primera clase)
  const scrolledFor = useRef('');
  useEffect(() => {
    const key = days[0]?.toDateString() + days.length;
    if (!scrollRef.current || scrolledFor.current === key) return;
    scrolledFor.current = key;
    const first = lessons.map((l) => new Date(l.starts_at)).sort((a, b) => +a - +b)[0];
    const hasToday = days.some((d) => isSameDay(d, new Date()));
    const target = hasToday ? new Date().getHours() - 1 : first ? first.getHours() - 1 : h0;
    scrollRef.current.scrollTop = Math.max(0, (target - h0) * hourH);
  }, [days, lessons, h0, hourH]);

  const byDay = useMemo(
    () =>
      days.map((d) => {
        const list = lessons.filter((l) => isSameDay(new Date(l.starts_at), d));
        return layoutDay(list);
      }),
    [days, lessons],
  );

  // ---------------------------------------------------------------- arrastre
  const colWidth = () => (colsRef.current ? colsRef.current.getBoundingClientRect().width / days.length : 100);

  const beginPress = (e: React.PointerEvent, lesson: Lesson, mode: Drag['mode']) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    const d: Drag = { lesson, mode, startX: e.clientX, startY: e.clientY, dayDelta: 0, minuteDelta: 0, active: false };
    dragRef.current = d;
    if (e.pointerType === 'touch') {
      // táctil: mantener pulsado para arrastrar (permite seguir desplazando la agenda)
      pressTimer.current = setTimeout(() => {
        if (!dragRef.current) return;
        dragRef.current = { ...dragRef.current, active: true };
        setDrag(dragRef.current);
        navigator.vibrate?.(10);
      }, 350);
    }
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp, { once: true });
    window.addEventListener('pointercancel', onPointerCancel, { once: true });
  };

  const onPointerMove = (e: PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    if (!d.active) {
      if (e.pointerType === 'touch') {
        if (Math.hypot(dx, dy) > 8) cancelPress(); // el usuario está desplazando
        return;
      }
      if (Math.hypot(dx, dy) < 4) return;
      d.active = true;
    }
    const minuteDelta = Math.round(((dy / hourH) * 60) / SNAP) * SNAP;
    const dayDelta = d.mode === 'move' && days.length > 1 ? Math.round(dx / colWidth()) : 0;
    const next = { ...d, active: true, minuteDelta, dayDelta };
    dragRef.current = next;
    setDrag(next);
  };

  const cleanup = () => {
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', onPointerUp);
    window.removeEventListener('pointercancel', onPointerCancel);
    if (pressTimer.current) clearTimeout(pressTimer.current);
    pressTimer.current = null;
  };
  const cancelPress = () => {
    cleanup();
    dragRef.current = null;
    setDrag(null);
  };
  const onPointerCancel = () => cancelPress();

  const onPointerUp = async () => {
    const d = dragRef.current;
    cleanup();
    dragRef.current = null;
    if (!d) return;
    if (!d.active) {
      setDrag(null);
      return; // fue un clic: lo gestiona onClick
    }
    suppressClick.current = true;
    setTimeout(() => (suppressClick.current = false), 50);
    const { start, minutes } = resultOf(d);
    const changed = start.getTime() !== new Date(d.lesson.starts_at).getTime() || minutes !== d.lesson.duration_minutes;
    if (changed) await onMove(d.lesson, start, minutes);
    setDrag(null);
  };

  // impide el desplazamiento de la página mientras se arrastra en táctil
  useEffect(() => {
    if (!drag?.active) return;
    const prevent = (e: TouchEvent) => e.preventDefault();
    window.addEventListener('touchmove', prevent, { passive: false });
    return () => window.removeEventListener('touchmove', prevent);
  }, [drag?.active]);

  const resultOf = (d: Drag) => {
    const s = new Date(d.lesson.starts_at);
    if (d.mode === 'resize') return { start: s, minutes: Math.max(SNAP, d.lesson.duration_minutes + d.minuteDelta) };
    const start = new Date(addDays(s, d.dayDelta).getTime() + d.minuteDelta * 60_000);
    return { start, minutes: d.lesson.duration_minutes };
  };

  const slotFromEvent = (e: React.MouseEvent, day: Date) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const y = e.clientY - rect.top;
    const minutes = Math.floor(((y / hourH) * 60) / SNAP) * SNAP + h0 * 60;
    const d = startOfDay(day);
    d.setMinutes(minutes);
    return d;
  };

  const hours = Array.from({ length: h1 - h0 }, (_, i) => h0 + i);
  const totalH = (h1 - h0) * hourH;
  const multi = days.length > 1;

  return (
    <div ref={scrollRef} className="relative max-h-[calc(100dvh-13.5rem)] overflow-auto overscroll-contain rounded-xl border border-border bg-surface shadow-sm md:max-h-[calc(100dvh-12rem)]">
      <div className={cn(multi && 'min-w-[720px]')}>
        {/* Cabecera de días */}
        <div className="sticky top-0 z-20 flex border-b border-border bg-surface/95 backdrop-blur">
          <div className="w-12 shrink-0 md:w-14" />
          <div className="grid flex-1" style={{ gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))` }}>
            {days.map((d) => {
              const today = isSameDay(d, now);
              return (
                <div key={d.toISOString()} className="flex items-center justify-center gap-1.5 border-l border-border py-2 first:border-l-0">
                  <span className={cn('text-xs font-medium', today ? 'text-accent' : 'text-muted')}>{capitalize(fmt(d, multi ? 'EEE' : 'EEEE'))}</span>
                  <span className={cn('flex size-7 items-center justify-center rounded-full text-sm font-semibold tabular-nums', today ? 'bg-accent text-accent-fg' : '')}>{fmt(d, 'd')}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex">
          {/* Horas */}
          <div className="sticky left-0 z-10 w-12 shrink-0 bg-surface md:w-14" style={{ height: totalH }}>
            {hours.map((h) => (
              <div key={h} className="relative text-right" style={{ height: hourH }}>
                <span className="absolute -top-2 right-2 text-[11px] text-muted tabular-nums">{h === h0 ? '' : `${String(h).padStart(2, '0')}:00`}</span>
              </div>
            ))}
          </div>
          {/* Columnas */}
          <div ref={colsRef} className="relative grid flex-1" style={{ gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))`, height: totalH }}>
            {days.map((day, di) => {
              const today = isSameDay(day, now);
              return (
                <div
                  key={day.toISOString()}
                  className={cn('agenda-hours relative border-l border-border first:border-l-0', today && 'bg-accent-soft/25')}
                  style={{ ['--hour-h' as string]: `${hourH}px` }}
                  onClick={(e) => {
                    if (suppressClick.current) return;
                    onSlot(slotFromEvent(e, day));
                  }}
                  data-day={di}
                >
                  {today ? (
                    <div className="pointer-events-none absolute inset-x-0 z-10 flex items-center" style={{ top: ((now.getHours() - h0) * 60 + now.getMinutes()) * (hourH / 60) }}>
                      <span className="-ml-1 size-2 rounded-full bg-danger" />
                      <span className="h-px flex-1 bg-danger" />
                    </div>
                  ) : null}
                  {byDay[di].map(({ lesson, col, cols }) => {
                    const isDragging = drag?.active && drag.lesson.id === lesson.id;
                    const s = new Date(lesson.starts_at);
                    const minutes = isDragging && drag ? resultOf(drag).minutes : lesson.duration_minutes;
                    const startM = (s.getHours() - h0) * 60 + s.getMinutes() + (isDragging && drag?.mode === 'move' ? drag.minuteDelta : 0);
                    const color = lookup.targetColor(lesson);
                    const cancelled = lesson.status === 'cancelled';
                    const done = lesson.status === 'completed';
                    const short = minutes < 40;
                    const preview = isDragging && drag ? resultOf(drag) : null;
                    return (
                      <div
                        key={lesson.id}
                        role="button"
                        tabIndex={0}
                        aria-label={`${lookup.targetName(lesson)}, ${hhmm(s)}`}
                        onPointerDown={(e) => beginPress(e, lesson, 'move')}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!suppressClick.current) onOpen(lesson);
                        }}
                        onKeyDown={(e) => e.key === 'Enter' && onOpen(lesson)}
                        onContextMenu={(e) => e.preventDefault()}
                        style={{
                          ...cvar(color),
                          top: (startM * hourH) / 60,
                          height: Math.max(18, (minutes * hourH) / 60 - 2),
                          left: `calc(${(col / cols) * 100}% + 2px)`,
                          width: `calc(${100 / cols}% - 4px)`,
                          transform: isDragging && drag?.mode === 'move' ? `translateX(${drag.dayDelta * 100}%)` : undefined,
                          WebkitTouchCallout: 'none',
                        }}
                        className={cn(
                          'tint group absolute z-[1] cursor-grab overflow-hidden rounded-lg border-l-[3px] px-1.5 py-1 text-left select-none',
                          'transition-shadow hover:z-[2] hover:shadow',
                          cancelled && 'opacity-55',
                          isDragging && 'z-30 cursor-grabbing shadow-lg ring-2 ring-[var(--c)]',
                        )}
                      >
                        <div className={cn('flex items-center gap-1 text-[12px] leading-tight font-semibold', cancelled && 'line-through')}>
                          {done ? <CheckCircle2 className="size-3 shrink-0" /> : cancelled ? <Ban className="size-3 shrink-0" /> : null}
                          <span className="truncate">{lookup.targetName(lesson)}</span>
                          {lesson.series_id && !short ? <Repeat className="ml-auto size-3 shrink-0 opacity-50" /> : null}
                        </div>
                        {!short || isDragging ? (
                          <div className="truncate text-[11px] leading-tight opacity-80 tabular-nums">
                            {preview ? `${hhmm(preview.start)}–${hhmm(new Date(preview.start.getTime() + preview.minutes * 60_000))}` : `${hhmm(s)}–${hhmm(new Date(lesson.ends_at))}`}
                            {minutes >= 50 ? ` · ${lesson.lesson_type}` : ''}
                          </div>
                        ) : null}
                        {minutes >= 75 && lesson.plan ? <div className="mt-0.5 line-clamp-2 text-[11px] leading-snug opacity-70">{lesson.plan}</div> : null}
                        {/* tirador de duración */}
                        <div
                          onPointerDown={(e) => beginPress(e, lesson, 'resize')}
                          className="absolute inset-x-0 bottom-0 h-2 cursor-ns-resize"
                          aria-hidden
                        >
                          <div className="mx-auto mt-0.5 h-0.5 w-6 rounded-full bg-current opacity-0 transition-opacity group-hover:opacity-40" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
