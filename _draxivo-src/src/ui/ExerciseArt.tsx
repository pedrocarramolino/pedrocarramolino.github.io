// Ilustraciones SVG locales y consistentes para identificar cada ejercicio por su equipamiento
// y su postura de trabajo. Se dibujan con primitivas comunes y colores del tema (claro/oscuro).
import type { ReactNode } from 'react';
import type { Equipment, MovementType, MuscleGroup } from '../db/types';

export type Scene =
  | 'bench-barbell'
  | 'incline-barbell'
  | 'decline-barbell'
  | 'bench-dumbbells'
  | 'incline-dumbbells'
  | 'dumbbells'
  | 'barbell-floor'
  | 'ez-bar'
  | 'rack'
  | 'pullup'
  | 'dips'
  | 'cable'
  | 'machine'
  | 'leg-press'
  | 'calf'
  | 'hip-thrust'
  | 'kettlebell'
  | 'mat'
  | 'ab-wheel'
  | 'band'
  | 'treadmill'
  | 'bike'
  | 'rower'
  | 'rope'
  | 'box'
  | 'preacher';

const BY_ID: Record<string, Scene> = {
  'press-banca': 'bench-barbell',
  'press-cerrado': 'bench-barbell',
  'press-inclinado-barra': 'incline-barbell',
  'press-declinado-barra': 'decline-barbell',
  'press-banca-mancuernas': 'bench-dumbbells',
  'aperturas-mancuernas': 'bench-dumbbells',
  'press-inclinado-mancuernas': 'incline-dumbbells',
  'curl-inclinado': 'incline-dumbbells',
  'press-hombro-mancuernas': 'incline-dumbbells',
  'press-arnold': 'incline-dumbbells',
  'remo-mancuerna': 'bench-dumbbells',
  'press-frances': 'ez-bar',
  'curl-barra-z': 'ez-bar',
  'curl-predicador': 'preacher',
  'sentadilla': 'rack',
  'sentadilla-frontal': 'rack',
  'press-militar': 'rack',
  'buenos-dias': 'rack',
  'dominadas': 'pullup',
  'dominadas-lastradas': 'pullup',
  'chin-ups': 'pullup',
  'elevacion-piernas': 'pullup',
  'colgado-barra': 'pullup',
  'dominadas-asistidas': 'pullup',
  'fondos-pecho': 'dips',
  'fondos-lastrados': 'dips',
  'fondos-asistidos': 'dips',
  'fondos-banco': 'bench-dumbbells',
  'prensa': 'leg-press',
  'gemelo-prensa': 'leg-press',
  'sentadilla-hack': 'leg-press',
  'gemelo-de-pie': 'calf',
  'hip-thrust': 'hip-thrust',
  'kettlebell-swing': 'kettlebell',
  'turkish-getup': 'kettlebell',
  'sentadilla-goblet': 'kettlebell',
  'rueda-abdominal': 'ab-wheel',
  'correr': 'treadmill',
  'cinta': 'treadmill',
  'caminar': 'treadmill',
  'bicicleta': 'bike',
  'eliptica': 'bike',
  'remo-ergometro': 'rower',
  'comba': 'rope',
  'step-up': 'box',
  'escaladora': 'box',
  'bulgara': 'box',
  'hiperextensiones': 'machine',
};

export function sceneFor(ex: { id: string; equipment: Equipment; movement: MovementType; primaryMuscle: MuscleGroup; tracking?: string }): Scene {
  const key = ex.id.replace(/^ex-/, '');
  if (BY_ID[key]) return BY_ID[key];
  if (ex.primaryMuscle === 'cardio') return 'treadmill';
  switch (ex.equipment) {
    case 'barra':
      return ex.primaryMuscle === 'pecho' ? 'bench-barbell' : ex.primaryMuscle === 'cuadriceps' ? 'rack' : 'barbell-floor';
    case 'mancuernas':
      return ex.primaryMuscle === 'pecho' ? 'bench-dumbbells' : 'dumbbells';
    case 'maquina':
      return ex.primaryMuscle === 'cuadriceps' || ex.primaryMuscle === 'gluteos' ? 'leg-press' : 'machine';
    case 'polea':
      return 'cable';
    case 'banda':
      return 'band';
    case 'peso_corporal':
      return ex.primaryMuscle === 'espalda' || ex.primaryMuscle === 'biceps' ? 'pullup' : 'mat';
    default:
      return ex.movement === 'cardio' ? 'treadmill' : 'kettlebell';
  }
}

// ---------- Primitivas (vista lateral, suelo en y=100) ----------
const floor = <ellipse cx="80" cy="102" rx="62" ry="4" className="a-shadow" />;

function plate(x: number, y: number, h = 30) {
  return (
    <g>
      <rect x={x - 4} y={y - h / 2} width="8" height={h} rx="2.5" className="a-dark" />
      <rect x={x + 4} y={y - h / 2 + 5} width="4" height={h - 10} rx="1.5" className="a-mid" />
    </g>
  );
}
function barbell(cx: number, y: number, half = 56, h = 30) {
  return (
    <g>
      <rect x={cx - half - 6} y={y - 1.6} width={half * 2 + 12} height="3.2" rx="1.6" className="a-metal" />
      {plate(cx - half + 6, y, h)}
      <g transform={`translate(${2 * cx} 0) scale(-1 1)`}>{plate(cx - half + 6, y, h)}</g>
    </g>
  );
}
function dumbbell(cx: number, cy: number, s = 1) {
  return (
    <g transform={`translate(${cx} ${cy}) scale(${s})`}>
      <rect x="-11" y="-1.5" width="22" height="3" rx="1.5" className="a-metal" />
      <rect x="-15" y="-7" width="7" height="14" rx="2.5" className="a-dark" />
      <rect x="8" y="-7" width="7" height="14" rx="2.5" className="a-dark" />
    </g>
  );
}
function bench(x1: number, x2: number, y = 70) {
  return (
    <g>
      <rect x={x1 + 6} y={y + 6} width="5" height={100 - y - 6} className="a-mid" />
      <rect x={x2 - 11} y={y + 6} width="5" height={100 - y - 6} className="a-mid" />
      <rect x={x1 + 2} y={97} width="14" height="3" rx="1.5" className="a-mid" />
      <rect x={x2 - 16} y={97} width="14" height="3" rx="1.5" className="a-mid" />
      <rect x={x1} y={y} width={x2 - x1} height="8" rx="3" className="a-pad" />
    </g>
  );
}
function inclineBench(x: number, angle: number) {
  return (
    <g>
      {bench(x, x + 46, 72)}
      <g transform={`rotate(${-angle} ${x + 46} 76)`}>
        <rect x={x + 44} y={72} width="52" height="8" rx="3" className="a-pad" />
      </g>
      <rect x={x + 60} y={70} width="5" height="30" className="a-mid" transform={`rotate(${angle / 2} ${x + 62} 100)`} />
    </g>
  );
}
function uprights(x1: number, x2: number, top = 22) {
  return (
    <g>
      {[x1, x2].map((x) => (
        <g key={x}>
          <rect x={x - 3} y={top} width="6" height={100 - top} rx="2" className="a-mid" />
          <rect x={x - 9} y={97} width="18" height="3" rx="1.5" className="a-mid" />
        </g>
      ))}
    </g>
  );
}

const SCENES: Record<Scene, () => ReactNode> = {
  'bench-barbell': () => (
    <>
      {floor}
      {uprights(44, 116, 34)}
      {bench(30, 130, 72)}
      {barbell(80, 42)}
    </>
  ),
  'incline-barbell': () => (
    <>
      {floor}
      {uprights(100, 140, 24)}
      {inclineBench(22, 38)}
      {barbell(96, 32, 52)}
    </>
  ),
  'decline-barbell': () => (
    <>
      {floor}
      <g transform="translate(160 0) scale(-1 1)">{inclineBench(30, -16)}</g>
      {barbell(80, 44)}
    </>
  ),
  'bench-dumbbells': () => (
    <>
      {floor}
      {bench(26, 134, 72)}
      {dumbbell(58, 56, 1.15)}
      {dumbbell(102, 56, 1.15)}
    </>
  ),
  'incline-dumbbells': () => (
    <>
      {floor}
      {inclineBench(24, 50)}
      {dumbbell(40, 60, 1.1)}
      {dumbbell(128, 92, 1.1)}
    </>
  ),
  dumbbells: () => (
    <>
      {floor}
      {dumbbell(52, 84, 1.6)}
      {dumbbell(108, 84, 1.6)}
      <rect x="40" y="96" width="80" height="4" rx="2" className="a-light" />
    </>
  ),
  'barbell-floor': () => (
    <>
      {floor}
      {barbell(80, 84, 58, 34)}
    </>
  ),
  'ez-bar': () => (
    <>
      {floor}
      <path d="M26 82 H58 l6 -5 l6 10 l6 -10 l6 10 l6 -10 l6 5 H134" className="a-metal-stroke" fill="none" strokeWidth="3.2" strokeLinejoin="round" />
      {plate(30, 82, 26)}
      <g transform="translate(160 0) scale(-1 1)">{plate(30, 82, 26)}</g>
    </>
  ),
  rack: () => (
    <>
      {floor}
      {uprights(46, 114, 14)}
      <rect x="40" y="14" width="80" height="5" rx="2" className="a-mid" />
      <rect x="36" y="44" width="12" height="4" rx="1.5" className="a-dark" />
      <rect x="112" y="44" width="12" height="4" rx="1.5" className="a-dark" />
      {barbell(80, 40, 60)}
      <rect x="24" y="97" width="112" height="3" rx="1.5" className="a-light" />
    </>
  ),
  pullup: () => (
    <>
      {floor}
      {uprights(34, 126, 18)}
      <rect x="28" y="22" width="104" height="5" rx="2.5" className="a-metal" />
      <rect x="54" y="20" width="10" height="9" rx="3" className="a-pad" />
      <rect x="96" y="20" width="10" height="9" rx="3" className="a-pad" />
    </>
  ),
  dips: () => (
    <>
      {floor}
      {uprights(50, 110, 40)}
      <rect x="36" y="44" width="34" height="5" rx="2.5" className="a-metal" />
      <rect x="90" y="44" width="34" height="5" rx="2.5" className="a-metal" />
      <rect x="62" y="40" width="10" height="9" rx="3" className="a-pad" />
      <rect x="88" y="40" width="10" height="9" rx="3" className="a-pad" />
      <rect x="44" y="70" width="72" height="4" rx="2" className="a-mid" />
    </>
  ),
  cable: () => (
    <>
      {floor}
      <rect x="28" y="10" width="8" height="90" rx="2" className="a-mid" />
      <rect x="124" y="10" width="8" height="90" rx="2" className="a-mid" />
      <rect x="28" y="10" width="104" height="7" rx="2" className="a-mid" />
      <rect x="64" y="40" width="32" height="50" rx="3" className="a-light" />
      {[46, 52, 58, 64, 70, 76, 82].map((y) => (
        <rect key={y} x="68" y={y} width="24" height="4" rx="1" className="a-dark" />
      ))}
      <circle cx="32" cy="24" r="5" className="a-dark" />
      <circle cx="128" cy="24" r="5" className="a-dark" />
      <path d="M32 29 Q 52 50 58 62" className="a-cable" fill="none" />
      <path d="M128 29 Q 108 50 102 62" className="a-cable" fill="none" />
      <rect x="52" y="60" width="12" height="5" rx="2.5" className="a-pad" />
      <rect x="96" y="60" width="12" height="5" rx="2.5" className="a-pad" />
    </>
  ),
  machine: () => (
    <>
      {floor}
      <rect x="104" y="18" width="30" height="82" rx="4" className="a-mid" />
      {[28, 36, 44, 52, 60, 68].map((y) => (
        <rect key={y} x="110" y={y} width="18" height="5" rx="1" className="a-dark" />
      ))}
      <rect x="30" y="74" width="54" height="9" rx="4" className="a-pad" />
      <rect x="30" y="34" width="10" height="42" rx="4" className="a-pad" />
      <rect x="54" y="83" width="6" height="17" className="a-mid" />
      <rect x="40" y="97" width="30" height="3" rx="1.5" className="a-mid" />
      <path d="M60 46 H96" className="a-metal-stroke" strokeWidth="4" strokeLinecap="round" />
      <rect x="86" y="40" width="8" height="14" rx="3" className="a-dark" />
    </>
  ),
  'leg-press': () => (
    <>
      {floor}
      <path d="M24 98 L124 30" className="a-metal-stroke" strokeWidth="5" strokeLinecap="round" />
      <rect x="22" y="66" width="44" height="9" rx="4" className="a-pad" transform="rotate(-22 44 70)" />
      <rect x="96" y="30" width="26" height="40" rx="3" className="a-dark" transform="rotate(-34 109 50)" />
      {plate(126, 52, 26)}
      <rect x="20" y="97" width="120" height="3" rx="1.5" className="a-mid" />
    </>
  ),
  calf: () => (
    <>
      {floor}
      <rect x="44" y="12" width="8" height="88" rx="2" className="a-mid" />
      <rect x="108" y="12" width="8" height="88" rx="2" className="a-mid" />
      <rect x="40" y="36" width="80" height="9" rx="4" className="a-pad" />
      <rect x="56" y="88" width="48" height="9" rx="3" className="a-dark" />
      {plate(120, 60, 24)}
    </>
  ),
  'hip-thrust': () => (
    <>
      {floor}
      {bench(18, 70, 66)}
      {barbell(98, 84, 44, 30)}
      <rect x="86" y="80" width="24" height="8" rx="4" className="a-pad" />
    </>
  ),
  kettlebell: () => (
    <>
      {floor}
      <path d="M66 62 a14 14 0 0 1 28 0" className="a-dark-stroke" fill="none" strokeWidth="6" />
      <circle cx="80" cy="80" r="20" className="a-dark" />
      <rect x="64" y="96" width="32" height="4" rx="2" className="a-mid" />
      <circle cx="74" cy="74" r="5" className="a-shine" />
    </>
  ),
  mat: () => (
    <>
      {floor}
      <rect x="18" y="88" width="124" height="10" rx="5" className="a-pad" />
      <rect x="18" y="88" width="20" height="10" rx="5" className="a-mid" />
      <circle cx="132" cy="70" r="6" className="a-accent" />
    </>
  ),
  'ab-wheel': () => (
    <>
      {floor}
      <rect x="40" y="76" width="80" height="5" rx="2.5" className="a-pad" />
      <circle cx="80" cy="78" r="20" className="a-dark" />
      <circle cx="80" cy="78" r="7" className="a-mid" />
    </>
  ),
  band: () => (
    <>
      {floor}
      <ellipse cx="80" cy="64" rx="44" ry="26" className="a-band" fill="none" strokeWidth="7" />
      <rect x="28" y="96" width="104" height="4" rx="2" className="a-light" />
    </>
  ),
  treadmill: () => (
    <>
      {floor}
      <rect x="20" y="82" width="112" height="12" rx="6" className="a-dark" />
      <rect x="24" y="78" width="104" height="5" rx="2.5" className="a-mid" />
      <path d="M118 80 L132 28" className="a-metal-stroke" strokeWidth="5" strokeLinecap="round" />
      <rect x="118" y="20" width="26" height="12" rx="3" className="a-pad" />
      <rect x="122" y="24" width="12" height="4" rx="1" className="a-accent" />
    </>
  ),
  bike: () => (
    <>
      {floor}
      <path d="M44 96 L76 50 L112 96" className="a-metal-stroke" strokeWidth="5" strokeLinecap="round" fill="none" />
      <rect x="62" y="44" width="28" height="8" rx="4" className="a-pad" />
      <path d="M100 74 L112 30" className="a-metal-stroke" strokeWidth="5" strokeLinecap="round" />
      <rect x="104" y="24" width="22" height="7" rx="3.5" className="a-pad" />
      <circle cx="94" cy="80" r="14" className="a-dark" />
      <circle cx="94" cy="80" r="5" className="a-mid" />
    </>
  ),
  rower: () => (
    <>
      {floor}
      <rect x="16" y="88" width="128" height="6" rx="3" className="a-mid" />
      <circle cx="132" cy="72" r="16" className="a-dark" />
      <rect x="54" y="78" width="26" height="9" rx="4" className="a-pad" />
      <path d="M118 66 L92 66" className="a-cable" />
      <rect x="84" y="62" width="10" height="8" rx="3" className="a-pad" />
    </>
  ),
  rope: () => (
    <>
      {floor}
      <path d="M50 60 C 50 120, 110 120, 110 60" className="a-dark-stroke" fill="none" strokeWidth="3" />
      <rect x="45" y="40" width="10" height="22" rx="5" className="a-pad" />
      <rect x="105" y="40" width="10" height="22" rx="5" className="a-pad" />
    </>
  ),
  box: () => (
    <>
      {floor}
      <path d="M44 56 H116 L124 64 V100 H52 L44 92 Z" className="a-mid" />
      <rect x="44" y="56" width="72" height="44" rx="3" className="a-light" />
      {dumbbell(132, 86, 1)}
    </>
  ),
  preacher: () => (
    <>
      {floor}
      <rect x="62" y="56" width="6" height="44" className="a-mid" />
      <rect x="44" y="97" width="44" height="3" rx="1.5" className="a-mid" />
      <rect x="54" y="48" width="44" height="10" rx="4" className="a-pad" transform="rotate(-30 76 53)" />
      <rect x="36" y="70" width="30" height="8" rx="4" className="a-pad" />
      <path d="M86 40 l5 -4 l5 7 l5 -7 l5 4" className="a-metal-stroke" fill="none" strokeWidth="3" />
      {plate(80, 40, 20)}
      <g transform="translate(224 0) scale(-1 1)">{plate(80, 40, 20)}</g>
    </>
  ),
};

export function ExerciseArt({
  exercise,
  size = 56,
  className,
  label,
}: {
  exercise: { id: string; equipment: Equipment; movement: MovementType; primaryMuscle: MuscleGroup } | null | undefined;
  size?: number | 'fill';
  className?: string;
  label?: string;
}) {
  const scene: Scene = exercise ? sceneFor(exercise) : 'dumbbells';
  const style = size === 'fill' ? { width: '100%', height: 'auto' } : { width: size, height: size * 0.75 };
  return (
    <span className={`exercise-art ${size === 'fill' ? 'art-hero' : ''} ${className ?? ''}`} style={size === 'fill' ? undefined : { width: size, height: size * 0.75 }}>
      <svg viewBox={size === 'fill' ? '0 0 160 120' : '14 6 132 99'} style={style} role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
        {SCENES[scene]()}
      </svg>
    </span>
  );
}
