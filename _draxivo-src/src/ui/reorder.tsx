import { useRef, useState, type ReactNode } from 'react';
import { ArrowDown, ArrowUp, GripVertical } from 'lucide-react';
import { IconButton, cx } from './kit';

/**
 * Lista reordenable: arrastrar desde el asa (ratón o táctil) y, como alternativa accesible,
 * botones de subir y bajar.
 */
export function ReorderList<T>({
  items,
  getKey,
  render,
  onChange,
  label,
}: {
  items: T[];
  getKey: (t: T) => string;
  render: (t: T, i: number) => ReactNode;
  onChange: (next: T[]) => void;
  label: (t: T) => string;
}) {
  const [drag, setDrag] = useState<{ from: number; over: number; dy: number } | null>(null);
  const startY = useRef(0);
  const rowH = useRef(56);
  const refs = useRef<(HTMLDivElement | null)[]>([]);

  const move = (from: number, to: number) => {
    if (to < 0 || to >= items.length || from === to) return;
    const next = [...items];
    const [x] = next.splice(from, 1);
    next.splice(to, 0, x);
    onChange(next);
  };

  return (
    <div className="list">
      {items.map((it, i) => {
        const isDragging = drag?.from === i;
        let shift = 0;
        if (drag && !isDragging) {
          if (drag.from < i && drag.over >= i) shift = -rowH.current;
          if (drag.from > i && drag.over <= i) shift = rowH.current;
        }
        return (
          <div
            key={getKey(it)}
            ref={(el) => {
              refs.current[i] = el;
            }}
            className={cx('row reorder-item', isDragging && 'dragging')}
            style={{ transform: isDragging ? `translateY(${drag!.dy}px)` : shift ? `translateY(${shift}px)` : undefined, transition: isDragging ? 'none' : 'transform 0.15s ease' }}
          >
            <span
              className="drag-handle"
              aria-hidden="true"
              onPointerDown={(e) => {
                (e.target as HTMLElement).setPointerCapture(e.pointerId);
                startY.current = e.clientY;
                rowH.current = refs.current[i]?.offsetHeight ?? 56;
                setDrag({ from: i, over: i, dy: 0 });
              }}
              onPointerMove={(e) => {
                if (!drag || drag.from !== i) return;
                const dy = e.clientY - startY.current;
                const over = Math.max(0, Math.min(items.length - 1, i + Math.round(dy / rowH.current)));
                setDrag({ from: i, over, dy });
              }}
              onPointerUp={() => {
                if (drag) move(drag.from, drag.over);
                setDrag(null);
              }}
              onPointerCancel={() => setDrag(null)}
            >
              <GripVertical size={20} />
            </span>
            <div className="row-main">{render(it, i)}</div>
            <IconButton label={`Subir ${label(it)}`} onClick={() => move(i, i - 1)} disabled={i === 0}>
              <ArrowUp size={18} />
            </IconButton>
            <IconButton label={`Bajar ${label(it)}`} onClick={() => move(i, i + 1)} disabled={i === items.length - 1}>
              <ArrowDown size={18} />
            </IconButton>
          </div>
        );
      })}
    </div>
  );
}
