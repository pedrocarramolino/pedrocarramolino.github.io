// Gráficas SVG ligeras: líneas finas, azul desaturado, ejes discretos e interacción táctil.
import { useMemo, useRef, useState, type ReactNode } from 'react';
import { cx } from './kit';

export interface Point {
  x: string; // fecha YYYY-MM-DD o etiqueta
  y: number;
}

interface LineChartProps {
  points: Point[];
  /** Serie secundaria opcional (p. ej. tendencia). */
  line?: Point[];
  height?: number;
  formatY: (v: number) => string;
  formatX: (x: string) => string;
  label: string;
  showDots?: boolean;
  lineLabel?: string;
  pointsLabel?: string;
  goal?: number | null;
  goalLabel?: string;
  /** Relleno suave bajo la línea principal. */
  area?: boolean;
}

const PAD_LEFT = { top: 14, right: 12, bottom: 24, left: 40 };
const PAD_RIGHT = { top: 14, right: 36, bottom: 24, left: 6 };

function niceTicks(min: number, max: number, count = 4): number[] {
  if (min === max) {
    const d = Math.abs(min) * 0.05 || 1;
    min -= d;
    max += d;
  }
  const span = max - min;
  const step0 = span / count;
  const mag = Math.pow(10, Math.floor(Math.log10(step0)));
  const norm = step0 / mag;
  const step = (norm < 1.5 ? 1 : norm < 3 ? 2 : norm < 7 ? 5 : 10) * mag;
  const start = Math.floor(min / step) * step;
  const out: number[] = [];
  for (let v = start; v <= max + step * 0.5; v += step) out.push(Math.round(v * 1000) / 1000);
  return out;
}

export function LineChart({ points, line, height = 200, formatY, formatX, label, showDots = true, lineLabel, pointsLabel, goal, goalLabel, area = true }: LineChartProps) {
  const PAD = area ? PAD_RIGHT : PAD_LEFT;
  const ref = useRef<SVGSVGElement>(null);
  const [hover, setHover] = useState<number | null>(null);
  const [width, setWidth] = useState(340);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Observa el ancho del contenedor para adaptar la gráfica a cualquier pantalla.
  const observe = useMemo(() => {
    let ro: ResizeObserver | null = null;
    return (el: HTMLDivElement | null) => {
      ro?.disconnect();
      if (!el) return;
      wrapRef.current = el;
      ro = new ResizeObserver(([e]) => setWidth(Math.max(200, Math.floor(e.contentRect.width))));
      ro.observe(el);
    };
  }, []);

  const all = [...points, ...(line ?? [])];
  if (!points.length) return null;
  const ys = all.map((p) => p.y);
  if (goal != null) ys.push(goal);
  const ticks = niceTicks(Math.min(...ys), Math.max(...ys));
  // Si el formato pierde decimales y repite etiquetas, se muestra con un decimal.
  const rawLabels = ticks.map(formatY);
  const fmtAxis = new Set(rawLabels).size < rawLabels.length ? (v: number) => v.toFixed(1).replace('.', ',') : formatY;
  const yMin = ticks[0];
  const yMax = ticks[ticks.length - 1];
  const keys = [...new Set(all.map((p) => p.x))].sort();
  const iw = width - PAD.left - PAD.right;
  const ih = height - PAD.top - PAD.bottom;
  const xPos = (x: string) => PAD.left + (keys.length === 1 ? iw / 2 : (keys.indexOf(x) / (keys.length - 1)) * iw);
  const yPos = (y: number) => PAD.top + ih - ((y - yMin) / (yMax - yMin || 1)) * ih;
  const path = (ps: Point[]) => ps.map((p, i) => `${i ? 'L' : 'M'}${xPos(p.x).toFixed(1)},${yPos(p.y).toFixed(1)}`).join(' ');
  const primary = line && line.length ? line : points;

  const xLabelIdx = keys.length <= 1 ? [0] : [0, Math.floor((keys.length - 1) / 2), keys.length - 1].filter((v, i, a) => a.indexOf(v) === i);

  const pick = (clientX: number) => {
    const svg = ref.current;
    if (!svg) return;
    const r = svg.getBoundingClientRect();
    const x = clientX - r.left;
    let best = 0;
    let bd = Infinity;
    keys.forEach((k, i) => {
      const d = Math.abs(xPos(k) - x);
      if (d < bd) {
        bd = d;
        best = i;
      }
    });
    setHover(best);
  };

  const hk = hover != null ? keys[hover] : null;
  const hp = hk ? points.find((p) => p.x === hk) : undefined;
  const hl = hk ? line?.find((p) => p.x === hk) : undefined;

  return (
    <figure className="chart" aria-label={label}>
      <div ref={observe} className="chart-wrap">
        <svg
          ref={ref}
          width={width}
          height={height}
          role="img"
          aria-label={label}
          onPointerMove={(e) => pick(e.clientX)}
          onPointerDown={(e) => pick(e.clientX)}
          onPointerLeave={() => setHover(null)}
          style={{ touchAction: 'pan-y' }}
        >
          {ticks.map((t) => (
            <g key={t}>
              <line x1={PAD.left} x2={width - PAD.right} y1={yPos(t)} y2={yPos(t)} className="chart-grid" />
              <text x={area ? width - 4 : PAD.left - 6} y={yPos(t) + 4} className="chart-axis" textAnchor="end">
                {fmtAxis(t)}
              </text>
            </g>
          ))}
          {xLabelIdx.map((i) => (
            <text key={i} x={xPos(keys[i])} y={height - 6} className="chart-axis" textAnchor={keys.length === 1 ? 'middle' : i === 0 ? 'start' : i === keys.length - 1 ? 'end' : 'middle'}>
              {formatX(keys[i])}
            </text>
          ))}
          {goal != null && (
            <g>
              <line x1={PAD.left} x2={width - PAD.right} y1={yPos(goal)} y2={yPos(goal)} className="chart-goal" />
              <text x={width - PAD.right} y={yPos(goal) - 4} textAnchor="end" className="chart-axis">
                {goalLabel ?? 'Objetivo'}
              </text>
            </g>
          )}
          {line && line.length > 0 && <path d={path(points)} className="chart-line-faint" />}
          {area && primary.length > 1 && (
            <path d={`${path(primary)} L${xPos(primary[primary.length - 1].x).toFixed(1)},${(PAD.top + ih).toFixed(1)} L${xPos(primary[0].x).toFixed(1)},${(PAD.top + ih).toFixed(1)} Z`} className="chart-area" />
          )}
          <path d={path(primary)} className="chart-line" />
          {showDots &&
            points.length <= (area ? 14 : 60) &&
            points.map((p) => <circle key={p.x} cx={xPos(p.x)} cy={yPos(p.y)} r={line ? 3 : 3.5} className={line ? 'chart-dot-faint' : 'chart-dot'} />)}
          {hk && (
            <g>
              <line x1={xPos(hk)} x2={xPos(hk)} y1={PAD.top} y2={PAD.top + ih} className="chart-cross" />
              {hp && <circle cx={xPos(hk)} cy={yPos(hp.y)} r={5} className="chart-dot-active" />}
              {hl && <circle cx={xPos(hk)} cy={yPos(hl.y)} r={4} className="chart-dot-active" />}
            </g>
          )}
        </svg>
        {hk && (hp || hl) && (
          <div className="chart-tip" style={{ left: Math.min(Math.max(xPos(hk), 70), width - 70) }}>
            <strong>{formatX(hk)}</strong>
            {hp && (
              <span>
                {pointsLabel ? `${pointsLabel}: ` : ''}
                {formatY(hp.y)}
              </span>
            )}
            {hl && (
              <span>
                {lineLabel ? `${lineLabel}: ` : ''}
                {formatY(hl.y)}
              </span>
            )}
          </div>
        )}
      </div>
      {line && line.length > 0 && (
        <figcaption className="chart-legend">
          <span>
            <i className="legend-dot faint" /> {pointsLabel ?? 'Registros'}
          </span>
          <span>
            <i className="legend-line" /> {lineLabel ?? 'Tendencia'}
          </span>
        </figcaption>
      )}
    </figure>
  );
}

export function BarChart({
  bars,
  height = 160,
  formatY,
  label,
  goal,
}: {
  bars: { key: string; label: string; value: number; tip?: string }[];
  height?: number;
  formatY: (v: number) => string;
  label: string;
  goal?: number | null;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...bars.map((b) => b.value), goal ?? 0);
  const showEvery = Math.ceil(bars.length / 8);
  return (
    <figure className="chart" aria-label={label}>
      <div className="bars" style={{ height }} onPointerLeave={() => setHover(null)}>
        {goal != null && goal > 0 && <div className="bars-goal" style={{ bottom: `calc(${(goal / max) * 100}% * (1 - 22 / ${height}) + 22px)` }} aria-hidden="true" />}
        {bars.map((b, i) => (
          <button
            type="button"
            key={b.key}
            className={cx('bar-col', hover === i && 'active')}
            onPointerEnter={() => setHover(i)}
            onFocus={() => setHover(i)}
            onClick={() => setHover(i)}
            aria-label={`${b.label}: ${b.tip ?? formatY(b.value)}`}
          >
            <span className="bar-track">
              <span className={cx('bar', b.value === 0 && 'bar-zero')} style={{ height: `${(b.value / max) * 100}%` }} />
            </span>
            <span className="bar-label">{i % showEvery === 0 || i === bars.length - 1 ? b.label : ''}</span>
          </button>
        ))}
      </div>
      <div className="bars-tip" aria-hidden={hover == null}>
        {hover != null ? (
          <>
            <strong>{bars[hover].label}</strong> · {bars[hover].tip ?? formatY(bars[hover].value)}
          </>
        ) : (
          <span className="muted">Toca una barra para ver el detalle</span>
        )}
      </div>
    </figure>
  );
}

export function Sparkline({ values, width = 84, height = 28, label }: { values: number[]; width?: number; height?: number; label: string }) {
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const d = values
    .map((v, i) => `${i ? 'L' : 'M'}${((i / (values.length - 1)) * (width - 4) + 2).toFixed(1)},${(height - 3 - ((v - min) / (max - min || 1)) * (height - 6)).toFixed(1)}`)
    .join(' ');
  return (
    <svg width={width} height={height} className="sparkline" role="img" aria-label={label}>
      <path d={d} className="chart-line" />
    </svg>
  );
}

export function WeekDots({ days, label }: { days: { label: string; state: 'done' | 'planned' | 'rest' | 'none' | 'missed'; today?: boolean }[]; label: string }) {
  return (
    <div className="weekdots" role="list" aria-label={label}>
      {days.map((d, i) => (
        <div key={i} className={cx('weekdot', `wd-${d.state}`, d.today && 'wd-today')} role="listitem" aria-label={`${d.label}: ${{ done: 'entrenado', planned: 'planificado', rest: 'descanso', none: 'sin actividad', missed: 'planificado sin completar' }[d.state]}`}>
          <span className="weekdot-mark" />
          <span className="weekdot-label">{d.label}</span>
        </div>
      ))}
    </div>
  );
}

export function HBars({ items, format }: { items: { label: ReactNode; value: number; key: string }[]; format: (v: number) => string }) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <div className="hbars">
      {items.map((i) => (
        <div key={i.key} className="hbar-row">
          <span className="hbar-label">{i.label}</span>
          <span className="hbar-track">
            <span className="hbar-fill" style={{ width: `${(i.value / max) * 100}%` }} />
          </span>
          <span className="hbar-value">{format(i.value)}</span>
        </div>
      ))}
    </div>
  );
}

export function Ring({ value, size = 64, label, children }: { value: number; size?: number; label: string; children?: ReactNode }) {
  const r = size / 2 - 5;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(1, value));
  return (
    <div className="ring" style={{ width: size, height: size }} role="img" aria-label={label}>
      <svg width={size} height={size}>
        <circle cx={size / 2} cy={size / 2} r={r} className="ring-track" />
        <circle cx={size / 2} cy={size / 2} r={r} className="ring-fill" strokeDasharray={`${c * v} ${c}`} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      </svg>
      <div className="ring-center">{children}</div>
    </div>
  );
}
