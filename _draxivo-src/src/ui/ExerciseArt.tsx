// Ilustraciones de ejercicios: figura humana articulada con el material, el músculo principal
// resaltado y la trayectoria del movimiento. Cada ejercicio tiene una plantilla asignada por
// identificador; los ejercicios personalizados usan una plantilla según músculo y material.
import { memo, useEffect, useState } from 'react';
import type { Equipment, MovementType, MuscleGroup } from '../db/types';
import { mix, resolve, type Joints } from './figures/rig';
import { Figure, arrow, floorLine } from './figures/draw';
import { EXERCISE_TEMPLATE, TEMPLATES, type Template, type TemplateKey } from './figures/templates';

type ArtExercise = { id: string; equipment: Equipment; movement: MovementType; primaryMuscle: MuscleGroup };

const FALLBACK: Partial<Record<MuscleGroup, Partial<Record<Equipment, TemplateKey>> & { default: TemplateKey }>> = {
  pecho: { barra: 'bench-bar', mancuernas: 'bench-db', maquina: 'chest-press-machine', polea: 'cable-cross', banda: 'band-press', default: 'pushup' },
  espalda: { barra: 'row-bar', mancuernas: 'row-db-one', maquina: 'row-machine', polea: 'lat-pulldown', banda: 'row-band', default: 'pullup' },
  hombros: { barra: 'ohp-bar', mancuernas: 'lateral-db', maquina: 'ohp-machine', polea: 'lateral-cable', peso_corporal: 'handstand-pushup', default: 'lateral-db' },
  biceps: { barra: 'curl-bar', polea: 'curl-cable', maquina: 'curl-preacher', banda: 'curl-band', peso_corporal: 'pullup', default: 'curl-db' },
  triceps: { barra: 'skullcrusher', mancuernas: 'overhead-ext', polea: 'pushdown-bar', maquina: 'pushdown-bar', banda: 'pushdown-rope', default: 'bench-dip' },
  antebrazos: { default: 'wrist-curl' },
  cuadriceps: { barra: 'squat-back', mancuernas: 'lunge', maquina: 'leg-press', polea: 'squat-goblet', default: 'squat-bw' },
  isquios: { barra: 'rdl-bar', mancuernas: 'rdl-db', maquina: 'leg-curl-lying', polea: 'leg-curl-seated', default: 'rdl-single' },
  gluteos: { barra: 'hip-thrust', maquina: 'abduction', polea: 'cable-kickback', banda: 'monster-walk', default: 'glute-bridge' },
  gemelos: { maquina: 'calf-machine', default: 'calf-single' },
  abdominales: { polea: 'cable-crunch', default: 'crunch' },
  cuerpo_completo: { peso_corporal: 'burpee', barra: 'clean', default: 'kb-swing' },
  cardio: { maquina: 'treadmill', default: 'run' },
  movilidad: { banda: 'band-dislocate', default: 'hamstring-stretch' },
};

/** Plantilla asociada a un ejercicio (identificador estable o regla por músculo y material). */
export function templateKeyFor(ex: ArtExercise): TemplateKey {
  const own = EXERCISE_TEMPLATE[ex.id.replace(/^ex-/, '')];
  if (own) return own;
  const byMuscle = FALLBACK[ex.primaryMuscle];
  return byMuscle?.[ex.equipment] ?? byMuscle?.default ?? 'squat-bw';
}

interface Resolved {
  t: Template;
  a: Joints;
  b: Joints;
  /** Encuadre ajustado al cuerpo para miniaturas (proporción 4:3). */
  crop: string;
}

function cropFor(t: Template, a: Joints, b: Joints): string {
  const s = t.scale ?? 1;
  const xs: number[] = [];
  const ys: number[] = [];
  for (const j of [a, b])
    for (const [k, v] of Object.entries(j)) {
      if (k === 'front' || k === 'arch') continue;
      const [x, y] = v as [number, number];
      xs.push(60 + (x - 60) * s);
      ys.push(86 + (y - 86) * s);
    }
  let x1 = Math.min(...xs) - 9;
  let x2 = Math.max(...xs) + 9;
  let y1 = Math.min(...ys) - 9;
  let y2 = Math.max(...ys) + 6;
  let w = x2 - x1;
  let h = y2 - y1;
  // Proporción 4:3 sin recortar el cuerpo.
  if (w / h < 4 / 3) {
    const nw = (h * 4) / 3;
    x1 -= (nw - w) / 2;
    w = nw;
  } else {
    const nh = (w * 3) / 4;
    y1 -= (nh - h) / 2;
    h = nh;
  }
  // Tamaño mínimo para que la figura no aparezca pixelada ni desproporcionada.
  if (w < 64) {
    const k = 64 / w;
    x1 -= ((k - 1) * w) / 2;
    y1 -= ((k - 1) * h) / 2;
    w *= k;
    h *= k;
  }
  void x2;
  void y2;
  return `${x1.toFixed(1)} ${y1.toFixed(1)} ${w.toFixed(1)} ${h.toFixed(1)}`;
}
const cache = new Map<TemplateKey, Resolved>();
function getResolved(key: TemplateKey): Resolved {
  let r = cache.get(key);
  if (!r) {
    const t = TEMPLATES[key]();
    const a = resolve(t.a);
    const b = resolve(t.b);
    r = { t, a, b, crop: cropFor(t, a, b) };
    cache.set(key, r);
  }
  return r;
}

function Scene({ r, j, muscle, ghost, showArrow, arrowWidth }: { r: Resolved; j: Joints; muscle?: MuscleGroup; ghost?: Joints | null; showArrow: boolean; arrowWidth: number }) {
  const { t } = r;
  const g = t.gear?.(j) ?? {};
  const gGhost = ghost ? (t.gear?.(ghost) ?? {}) : {};
  const s = t.scale ?? 1;
  return (
    <g transform={s === 1 ? undefined : `translate(60 86) scale(${s}) translate(-60 -86)`}>
      {floorLine}
      {t.scene}
      {ghost && (
        <g opacity="0.32">
          {gGhost.back}
          <Figure j={ghost} ghost arch={ghost.arch} />
          {gGhost.front}
        </g>
      )}
      {g.back}
      <Figure j={j} muscle={muscle} arch={j.arch} />
      {g.front}
      {showArrow && t.track && arrow(t.track(r.a), t.track(r.b), t.bulge ?? 0.18, arrowWidth)}
    </g>
  );
}

/**
 * Ilustración de un ejercicio.
 * - size numérico: miniatura (postura representativa y trayectoria).
 * - size 'fill': grande, con la postura opuesta en transparencia.
 * - mode 'animated': alterna entre la postura inicial y la final.
 * - pose: fuerza la postura inicial ('a') o final ('b').
 */
export const ExerciseArt = memo(function ExerciseArt({
  exercise,
  size = 56,
  className,
  label,
  mode = 'static',
  pose,
}: {
  exercise: ArtExercise | null | undefined;
  size?: number | 'fill';
  className?: string;
  label?: string;
  mode?: 'static' | 'animated';
  pose?: 'a' | 'b';
}) {
  const key = exercise ? templateKeyFor(exercise) : 'squat-bw';
  const r = getResolved(key);
  const fill = size === 'fill';
  const small = !fill && size < 72;
  const which = pose ?? r.t.thumb ?? 'a';
  const j = which === 'a' ? r.a : r.b;
  const other = which === 'a' ? r.b : r.a;
  const content =
    mode === 'animated' ? (
      <Animated r={r} muscle={exercise?.primaryMuscle} />
    ) : (
      <Scene r={r} j={j} muscle={exercise?.primaryMuscle} ghost={!small && !pose ? other : null} showArrow={!pose} arrowWidth={small ? 3 : 1.8} />
    );
  return (
    <span className={`exercise-art ${fill ? 'art-hero' : ''} ${className ?? ''}`} style={fill ? undefined : { width: size, height: size * 0.75 }} data-template={key}>
      <svg viewBox={small ? r.crop : '0 0 120 90'} style={fill ? { width: '100%', height: 'auto' } : { width: size, height: size * 0.75 }} role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
        {content}
      </svg>
    </span>
  );
});

function Animated({ r, muscle }: { r: Resolved; muscle?: MuscleGroup }) {
  const [t, setT] = useState(0);
  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const CYCLE = 3000;
    const tick = (now: number) => {
      const p = ((now - start) % CYCLE) / CYCLE;
      // Pausa en cada extremo y transición suave entre posturas.
      const seg = p < 0.15 ? 0 : p < 0.5 ? (p - 0.15) / 0.35 : p < 0.65 ? 1 : 1 - (p - 0.65) / 0.35;
      setT(0.5 - 0.5 * Math.cos(Math.PI * seg));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);
  return <Scene r={r} j={mix(r.a, r.b, t)} muscle={muscle} ghost={null} showArrow={false} arrowWidth={1.8} />;
}

/** Compatibilidad con el código anterior. */
export function sceneFor(ex: ArtExercise): string {
  return templateKeyFor(ex);
}
