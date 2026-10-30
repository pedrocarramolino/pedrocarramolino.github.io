// Dibujo de la figura y del material. Todo en SVG con clases del tema (claro/oscuro).
import type { ReactNode } from 'react';
import type { MuscleGroup } from '../../db/types';
import { add, angleOf, dir, type Joints, type V } from './rig';

const f = (n: number) => Math.round(n * 10) / 10;
const pt = (p: V) => `${f(p[0])},${f(p[1])}`;

function Seg({ a, b, w, cls }: { a: V; b: V; w: number; cls: string }) {
  return <line x1={f(a[0])} y1={f(a[1])} x2={f(b[0])} y2={f(b[1])} strokeWidth={w} className={cls} strokeLinecap="round" />;
}

/** Tronco como curva (permite arquear la espalda en algunos ejercicios). */
function torsoPath(hip: V, neck: V, arch: number) {
  const mid = [(hip[0] + neck[0]) / 2, (hip[1] + neck[1]) / 2] as V;
  const n = dir(angleOf(hip, neck) - 90);
  const c = add(mid, n, arch);
  return `M${pt(hip)} Q${pt(c)} ${pt(neck)}`;
}

function along(a: V, b: V, t: number): V {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}

/** Resalta el músculo principal en azul sobre los segmentos correspondientes. */
function Highlight({ j, m, far, arch }: { j: Joints; m: MuscleGroup | undefined; far: boolean; arch: number }) {
  if (!m) return null;
  const cls = far ? 'fig-hl fig-hl-far' : 'fig-hl';
  const arm = far ? { sh: j.front ? j.shR : j.shR, el: j.el2, ha: j.ha2 } : { sh: j.shL, el: j.el, ha: j.ha };
  const leg = far ? { hip: j.hipR, kn: j.kn2, an: j.an2 } : { hip: j.hipL, kn: j.kn, an: j.an };
  const torsoDir = angleOf(j.hip, j.neck);
  const front = dir(torsoDir - 90);
  const tseg = (t1: number, t2: number, off: number, w = 3.6) => {
    const a = add(along(j.hip, j.neck, t1), front, off);
    const b = add(along(j.hip, j.neck, t2), front, off);
    const mid = add(along(a, b, 0.5), dir(torsoDir - 90), arch * 0.5);
    return <path d={`M${pt(a)} Q${pt(mid)} ${pt(b)}`} strokeWidth={w} className={cls} strokeLinecap="round" fill="none" />;
  };
  switch (m) {
    case 'biceps':
    case 'triceps':
      return <Seg a={along(arm.sh, arm.el, 0.18)} b={along(arm.sh, arm.el, 0.92)} w={3.6} cls={cls} />;
    case 'antebrazos':
      return <Seg a={along(arm.el, arm.ha, 0.12)} b={along(arm.el, arm.ha, 0.85)} w={3.2} cls={cls} />;
    case 'cuadriceps':
    case 'isquios':
      return <Seg a={along(leg.hip, leg.kn, 0.15)} b={along(leg.hip, leg.kn, 0.9)} w={4.2} cls={cls} />;
    case 'gemelos':
      return <Seg a={along(leg.kn, leg.an, 0.12)} b={along(leg.kn, leg.an, 0.62)} w={4} cls={cls} />;
    case 'hombros':
      return <circle cx={f(arm.sh[0])} cy={f(arm.sh[1])} r={3.8} className={cls.replace('fig-hl', 'fig-hl-fill')} />;
    case 'gluteos': {
      if (far) return null;
      const c = j.front ? j.hip : add(j.hip, dir(torsoDir + 90), 2.6);
      return <circle cx={f(c[0])} cy={f(c[1])} r={4.4} className="fig-hl-fill" />;
    }
    default:
      if (far) return null;
      if (j.front) {
        if (m === 'pecho') return <Seg a={along(j.shL, j.hipL, 0.22)} b={along(j.shR, j.hipR, 0.22)} w={5} cls={cls} />;
        if (m === 'abdominales') return <Seg a={along(j.neck, j.hip, 0.55)} b={along(j.neck, j.hip, 0.92)} w={4.5} cls={cls} />;
        if (m === 'espalda')
          return (
            <>
              <Seg a={along(j.shL, j.hipL, 0.2)} b={along(j.shL, j.hipL, 0.75)} w={3} cls={cls} />
              <Seg a={along(j.shR, j.hipR, 0.2)} b={along(j.shR, j.hipR, 0.75)} w={3} cls={cls} />
            </>
          );
        return null;
      }
      if (m === 'pecho') return tseg(0.62, 0.9, 2.6);
      if (m === 'abdominales') return tseg(0.12, 0.5, 2.6);
      if (m === 'espalda') return tseg(0.3, 0.88, -2.6);
      return null;
  }
}

export interface FigureOpts {
  muscle?: MuscleGroup;
  arch?: number;
  ghost?: boolean;
}

/** Figura humana a partir de las articulaciones. */
export function Figure({ j, muscle, arch = 0, ghost }: { j: Joints } & FigureOpts) {
  const cls = ghost ? 'fig-ghost' : 'fig';
  const far = ghost ? 'fig-ghost' : 'fig-far';
  if (j.front) {
    const torso = `M${pt(j.shL)} L${pt(j.shR)} L${pt(add(j.hipR, [0, 0]))} L${pt(j.hipL)} Z`;
    return (
      <g>
        <Seg a={j.hipL} b={j.kn} w={6} cls={cls} />
        <Seg a={j.kn} b={j.an} w={5.4} cls={cls} />
        <Seg a={j.an} b={j.to} w={4} cls={cls} />
        <Seg a={j.hipR} b={j.kn2} w={6} cls={cls} />
        <Seg a={j.kn2} b={j.an2} w={5.4} cls={cls} />
        <Seg a={j.an2} b={j.to2} w={4} cls={cls} />
        {!ghost && <Highlight j={j} m={muscle === 'gluteos' ? undefined : muscle} far={false} arch={0} />}
        {!ghost && (muscle === 'cuadriceps' || muscle === 'isquios' || muscle === 'gemelos') && <Highlight j={j} m={muscle} far arch={0} />}
        <path d={torso} className={`${cls}-fill ${cls}`} strokeWidth={4} strokeLinejoin="round" />
        {!ghost && (muscle === 'pecho' || muscle === 'abdominales' || muscle === 'espalda' || muscle === 'gluteos') && <Highlight j={j} m={muscle} far={false} arch={0} />}
        <Seg a={j.neck} b={j.head} w={3.4} cls={cls} />
        <circle cx={f(j.head[0])} cy={f(j.head[1])} r={5.6} className={`${cls}-fill`} />
        <Seg a={j.shL} b={j.el} w={5} cls={cls} />
        <Seg a={j.el} b={j.ha} w={4.4} cls={cls} />
        <Seg a={j.shR} b={j.el2} w={5} cls={cls} />
        <Seg a={j.el2} b={j.ha2} w={4.4} cls={cls} />
        {!ghost && (muscle === 'biceps' || muscle === 'triceps' || muscle === 'antebrazos' || muscle === 'hombros') && (
          <>
            <Highlight j={j} m={muscle} far={false} arch={0} />
            <Highlight j={j} m={muscle} far arch={0} />
          </>
        )}
      </g>
    );
  }
  return (
    <g>
      <Seg a={j.shR} b={j.el2} w={5} cls={far} />
      <Seg a={j.el2} b={j.ha2} w={4.4} cls={far} />
      <Seg a={j.hip} b={j.kn2} w={6} cls={far} />
      <Seg a={j.kn2} b={j.an2} w={5.4} cls={far} />
      <Seg a={j.an2} b={j.to2} w={4} cls={far} />
      {!ghost && <Highlight j={j} m={muscle === 'pecho' || muscle === 'espalda' || muscle === 'abdominales' || muscle === 'gluteos' ? undefined : muscle} far arch={arch} />}
      <path d={torsoPath(j.hip, j.neck, arch)} className={cls} strokeWidth={10} strokeLinecap="round" fill="none" />
      {!ghost && <Highlight j={j} m={muscle === 'pecho' || muscle === 'espalda' || muscle === 'abdominales' || muscle === 'gluteos' ? muscle : undefined} far={false} arch={arch} />}
      <Seg a={j.neck} b={j.head} w={3.4} cls={cls} />
      <circle cx={f(j.head[0])} cy={f(j.head[1])} r={5.6} className={`${cls}-fill`} />
      <Seg a={j.hip} b={j.kn} w={6} cls={cls} />
      <Seg a={j.kn} b={j.an} w={5.4} cls={cls} />
      <Seg a={j.an} b={j.to} w={4} cls={cls} />
      {!ghost && (muscle === 'cuadriceps' || muscle === 'isquios' || muscle === 'gemelos') && <Highlight j={j} m={muscle} far={false} arch={arch} />}
      <Seg a={j.shL} b={j.el} w={5} cls={cls} />
      <Seg a={j.el} b={j.ha} w={4.4} cls={cls} />
      {!ghost && (muscle === 'biceps' || muscle === 'triceps' || muscle === 'antebrazos' || muscle === 'hombros') && <Highlight j={j} m={muscle} far={false} arch={arch} />}
    </g>
  );
}

// ---------- Material ----------
export const floorLine = <line x1="4" y1="85.5" x2="116" y2="85.5" className="a-floor" strokeWidth="1.2" />;

/** Disco de barra visto de lado (la barra es perpendicular al plano). */
export function plate(c: V, r = 9): ReactNode {
  return (
    <g>
      <circle cx={f(c[0])} cy={f(c[1])} r={r} className="a-dark" />
      <circle cx={f(c[0])} cy={f(c[1])} r={r * 0.62} className="a-plate-inner" />
      <circle cx={f(c[0])} cy={f(c[1])} r={1.6} className="a-metal" />
    </g>
  );
}
/** Mancuerna vista de lado. */
export function dumbbell(c: V, r = 4.4): ReactNode {
  return (
    <g>
      <circle cx={f(c[0])} cy={f(c[1])} r={r} className="a-dark" />
      <circle cx={f(c[0])} cy={f(c[1])} r={r * 0.4} className="a-metal" />
    </g>
  );
}
/** Mancuerna vista de frente, horizontal o vertical. */
export function dumbbellFront(c: V, vertical = false): ReactNode {
  const [x, y] = c;
  return vertical ? (
    <g>
      <rect x={f(x - 1)} y={f(y - 6)} width="2" height="12" className="a-metal" />
      <rect x={f(x - 3.5)} y={f(y - 8)} width="7" height="4" rx="1.2" className="a-dark" />
      <rect x={f(x - 3.5)} y={f(y + 4)} width="7" height="4" rx="1.2" className="a-dark" />
    </g>
  ) : (
    <g>
      <rect x={f(x - 6)} y={f(y - 1)} width="12" height="2" className="a-metal" />
      <rect x={f(x - 8)} y={f(y - 3.5)} width="4" height="7" rx="1.2" className="a-dark" />
      <rect x={f(x + 4)} y={f(y - 3.5)} width="4" height="7" rx="1.2" className="a-dark" />
    </g>
  );
}
/** Barra vista de frente entre dos puntos, con discos. */
export function barFront(y: number, x1 = 14, x2 = 106, plates = true): ReactNode {
  return (
    <g>
      <rect x={x1} y={f(y - 1.2)} width={x2 - x1} height="2.4" rx="1" className="a-metal" />
      {plates && (
        <>
          <rect x={x1 + 2} y={f(y - 10)} width="5" height="20" rx="1.5" className="a-dark" />
          <rect x={x2 - 7} y={f(y - 10)} width="5" height="20" rx="1.5" className="a-dark" />
        </>
      )}
    </g>
  );
}
export function kettlebell(c: V, r = 6): ReactNode {
  return (
    <g>
      <path d={`M${f(c[0] - r * 0.6)} ${f(c[1] - r * 0.6)} a${r * 0.6} ${r * 0.75} 0 0 1 ${r * 1.2} 0`} className="a-dark-stroke" strokeWidth="2.2" fill="none" />
      <circle cx={f(c[0])} cy={f(c[1] + r * 0.35)} r={r} className="a-dark" />
    </g>
  );
}
export function line(a: V, b: V, cls = 'a-cable-line', w = 1.3): ReactNode {
  return <line x1={f(a[0])} y1={f(a[1])} x2={f(b[0])} y2={f(b[1])} className={cls} strokeWidth={w} strokeLinecap="round" />;
}
export function pad(a: V, b: V, w = 6.5): ReactNode {
  return <line x1={f(a[0])} y1={f(a[1])} x2={f(b[0])} y2={f(b[1])} className="a-pad-stroke" strokeWidth={w} strokeLinecap="round" />;
}
export function post(x: number, y1: number, y2 = 85, w = 3.4): ReactNode {
  return <rect x={f(x - w / 2)} y={f(y1)} width={w} height={f(y2 - y1)} rx="1" className="a-frame" />;
}
/** Banco plano: tablero y patas. */
export function bench(x1: number, x2: number, y: number): ReactNode {
  return (
    <g>
      {post(x1 + 7, y, 85, 3)}
      {post(x2 - 7, y, 85, 3)}
      {pad([x1 + 3, y + 2], [x2 - 3, y + 2], 6)}
    </g>
  );
}
/** Columna de poleas con polea en (x, y). */
export function pulleyTower(x: number, py: number, top = 4): ReactNode {
  return (
    <g>
      {post(x, top, 85, 4)}
      <circle cx={x} cy={py} r="2.8" className="a-dark" />
    </g>
  );
}
export function stack(x: number, y: number, h = 40, w = 12): ReactNode {
  const rows = Math.floor(h / 5);
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx="2" className="a-light" />
      {Array.from({ length: rows }, (_, i) => (
        <rect key={i} x={x + 2} y={y + 2 + i * 5} width={w - 4} height="3" rx="0.8" className="a-mid" />
      ))}
    </g>
  );
}
export function band(a: V, b: V, mid?: V): ReactNode {
  const m = mid ?? along(a, b, 0.5);
  return <path d={`M${pt(a)} Q${pt(m)} ${pt(b)}`} className="a-band-line" strokeWidth="2" fill="none" strokeLinecap="round" />;
}
export function box(x: number, y: number, w: number, h: number): ReactNode {
  return <rect x={x} y={y} width={w} height={h} rx="2" className="a-light-frame" />;
}
export function mat(x1: number, x2: number): ReactNode {
  return <rect x={x1} y={84} width={x2 - x1} height="3" rx="1.5" className="a-mat" />;
}
export function wall(x: number): ReactNode {
  return <rect x={x - 2} y={2} width="4" height="84" className="a-light-frame" />;
}

/** Flecha de trayectoria (curva) entre dos puntos. */
export function arrow(a: V, b: V, bulge = 0.18, sw = 1.8): ReactNode {
  const d = Math.hypot(b[0] - a[0], b[1] - a[1]);
  if (d < 6) return null;
  const mid = along(a, b, 0.5);
  const n = dir(angleOf(a, b) + 90);
  const c = add(mid, n, d * bulge);
  // Acorta los extremos para no tapar la mano o el pie.
  const a2 = along(a, c, 0.18);
  const b2 = along(b, c, 0.18);
  const ang = angleOf(c, b2);
  const h1 = add(b2, dir(ang + 155), 4.2);
  const h2 = add(b2, dir(ang - 155), 4.2);
  return (
    <g className="a-arrow">
      <path d={`M${pt(a2)} Q${pt(c)} ${pt(b2)}`} fill="none" strokeWidth={sw} strokeLinecap="round" strokeDasharray="0.1 3.6" />
      <path d={`M${pt(h1)} L${pt(b2)} L${pt(h2)}`} fill="none" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
    </g>
  );
}
