// Plantillas de movimiento: postura inicial (a), postura final (b), escena fija, material ligado
// a las articulaciones y punto cuya trayectoria se marca con una flecha.
import type { ReactNode } from 'react';
import { rel, shoulderOf, type FrontPose, type Joints, type Pose, type SidePose, type V } from './rig';
import { band, barFront, bench, box, dumbbell, dumbbellFront, kettlebell, line, mat, pad, plate, post, pulleyTower, stack, wall } from './draw';

export interface Template {
  a: Pose;
  b: Pose;
  scene?: ReactNode;
  gear?: (j: Joints) => { back?: ReactNode; front?: ReactNode };
  track?: (j: Joints) => V;
  /** Escala del dibujo (para movimientos que necesitan más altura). */
  scale?: number;
  thumb?: 'a' | 'b';
  bulge?: number;
}

const HIP: V = [60, 49];
const stand = (o: Partial<SidePose> = {}): SidePose => ({ hip: HIP, torso: 180, arm: { to: [61, 52] }, leg: { to: [60, 84] }, ...o });
const standF = (o: Partial<FrontPose> = {}): FrontPose => ({
  front: true,
  hip: [60, 49],
  armL: { to: [48, 51] },
  armR: { to: [72, 51] },
  legL: { to: [55, 84] },
  legR: { to: [65, 84] },
  ...o,
});
const hand = (j: Joints) => j.ha;
const hip = (j: Joints) => j.hip;
const neck = (j: Joints) => j.neck;
const ankle = (j: Joints) => j.an;

type Imp = 'bar' | 'db' | 'machine' | 'kb' | 'band' | 'cable' | 'ez' | 'bw' | 'plate';
const held = (imp: Imp, two = true) => (j: Joints) => {
  switch (imp) {
    case 'bar':
      return { front: plate(j.ha) };
    case 'ez':
      return { front: plate(j.ha, 6.5) };
    case 'db':
      return { back: two ? dumbbell(j.ha2) : undefined, front: dumbbell(j.ha) };
    case 'kb':
      return { front: kettlebell(rel(j.ha, 0, 4)) };
    default:
      return {};
  }
};

// ---------- Press en banco ----------
const BENCH_HIP: V = [68, 62];
function benchPress(kind: 'flat' | 'incline' | 'decline', imp: Imp): Template {
  if (kind === 'incline') {
    const h: V = [72, 63];
    const s = shoulderOf(h, -130);
    return {
      a: { hip: h, torso: -130, arm: { to: rel(s, 0, -26) }, leg: { to: [90, 84] } },
      b: { hip: h, torso: -130, arm: { to: rel(s, 3, -1), bend: -1 }, leg: { to: [90, 84] } },
      scene: (
        <>
          {post(82, 70)}
          {post(62, 70)}
          {pad([62, 72], [86, 72])}
          {pad([66, 69], [45, 50])}
        </>
      ),
      gear: held(imp),
      track: hand,
      thumb: 'a',
    };
  }
  if (kind === 'decline') {
    const h: V = [74, 56];
    const s = shoulderOf(h, -65);
    return {
      a: { hip: h, torso: -65, arm: { to: rel(s, 0, -26) }, leg: { to: [94, 66], bend: -1 } },
      b: { hip: h, torso: -65, arm: { to: rel(s, 3, -4), bend: -1 }, leg: { to: [94, 66], bend: -1 } },
      scene: (
        <>
          {post(70, 64)}
          {post(44, 76)}
          {pad([79, 61], [42, 78])}
          {pad([94, 70], [100, 70], 7)}
        </>
      ),
      gear: held(imp),
      track: hand,
      thumb: 'a',
    };
  }
  const s = shoulderOf(BENCH_HIP, -90);
  return {
    a: { hip: BENCH_HIP, torso: -90, arm: { to: rel(s, 0, -26) }, leg: { to: [84, 84] } },
    b: { hip: BENCH_HIP, torso: -90, arm: { to: rel(s, 3, -5), bend: -1 }, leg: { to: [84, 84] } },
    scene: (
      <>
        {imp === 'bar' && post(36, 26)}
        {bench(20, 78, 66)}
      </>
    ),
    gear: held(imp),
    track: hand,
    thumb: 'a',
  };
}

function skullCrusher(): Template {
  const s = shoulderOf(BENCH_HIP, -90);
  return {
    a: { hip: BENCH_HIP, torso: -90, arm: { pts: [rel(s, 1, -14), rel(s, 2, -26)] }, leg: { to: [84, 84] } },
    b: { hip: BENCH_HIP, torso: -90, arm: { pts: [rel(s, 1, -14), rel(s, -11, -10)] }, leg: { to: [84, 84] } },
    scene: bench(20, 78, 66),
    gear: held('ez'),
    track: hand,
  };
}

/** Aperturas tumbado vistas desde arriba. */
function flyTop(): Template {
  const base = (armL: FrontPose['armL'], armR: FrontPose['armR']): FrontPose => ({ front: true, hip: [60, 47], armL, armR, legL: { to: [56, 82] }, legR: { to: [64, 82] }, noFeet: true });
  return {
    a: base({ pts: [[48, 30], [54, 24]] }, { pts: [[72, 30], [66, 24]] }),
    b: base({ pts: [[39, 25], [27, 22]] }, { pts: [[81, 25], [93, 22]] }),
    scene: <rect x="49" y="6" width="22" height="80" rx="4" className="a-light-frame" />,
    gear: (j) => ({ front: <>{dumbbellFront(j.ha, true)}{dumbbellFront(j.ha2, true)}</> }),
    track: hand,
    bulge: -0.2,
  };
}

function cableCross(): Template {
  return {
    a: standF({ armL: { to: [30, 22] }, armR: { to: [90, 22] }, legL: { to: [53, 84] }, legR: { to: [67, 84] } }),
    b: standF({ armL: { to: [57, 50], bend: -1 }, armR: { to: [63, 50], bend: 1 }, legL: { to: [53, 84] }, legR: { to: [67, 84] } }),
    scene: (
      <>
        {pulleyTower(8, 10)}
        {pulleyTower(112, 10)}
      </>
    ),
    gear: (j) => ({ back: <>{line([10, 11], j.ha)}{line([110, 11], j.ha2)}</> }),
    track: hand,
    bulge: 0.15,
  };
}

const SEAT_HIP: V = [46, 66];
const seated = (o: Partial<SidePose> = {}): SidePose => ({ hip: SEAT_HIP, torso: 184, arm: { to: [52, 70] }, leg: { to: [64, 84] }, ...o });
const machineSeat = (
  <>
    {post(44, 72)}
    {pad([34, 72], [58, 72])}
    {pad([36, 70], [38, 36])}
  </>
);

function chestPressMachine(): Template {
  const s = shoulderOf(SEAT_HIP, 184);
  return {
    a: seated({ arm: { to: rel(s, 11, 4), bend: -1 } }),
    b: seated({ arm: { to: rel(s, 26, 1) } }),
    scene: (
      <>
        {stack(8, 30, 40)}
        {post(26, 10)}
        {machineSeat}
      </>
    ),
    gear: (j) => ({ back: line([28, 14], j.ha, 'a-lever', 3), front: <rect x={j.ha[0] - 1.5} y={j.ha[1] - 5} width="3" height="10" rx="1.5" className="a-dark" /> }),
    track: hand,
    thumb: 'b',
  };
}

const seatedF = (o: Partial<FrontPose> = {}): FrontPose => ({
  front: true,
  hip: [60, 58],
  armL: { to: [50, 60] },
  armR: { to: [70, 60] },
  legL: { pts: [[52, 66], [50, 84]] },
  legR: { pts: [[68, 66], [70, 84]] },
  ...o,
});
const frontSeat = (
  <>
    <rect x="48" y="58" width="24" height="8" rx="3" className="a-pad" />
    <rect x="50" y="18" width="20" height="40" rx="4" className="a-pad-soft" />
    {post(60, 66)}
  </>
);

function pecDeck(reverse: boolean): Template {
  const open = seatedF({ armL: { pts: [[38, 34], [37, 21]] }, armR: { pts: [[82, 34], [83, 21]] } });
  const closed = seatedF({ armL: { pts: [[55, 37], [57, 25]] }, armR: { pts: [[65, 37], [63, 25]] } });
  const revOpen = seatedF({ armL: { to: [27, 30] }, armR: { to: [93, 30] } });
  const revClosed = seatedF({ armL: { pts: [[52, 38], [57, 34]] }, armR: { pts: [[68, 38], [63, 34]] } });
  return {
    a: reverse ? revClosed : open,
    b: reverse ? revOpen : closed,
    scene: (
      <>
        {frontSeat}
        <rect x="14" y="8" width="92" height="4" rx="2" className="a-frame" />
        {post(16, 8)}
        {post(104, 8)}
      </>
    ),
    gear: (j) => ({
      front: reverse ? (
        <>
          <circle cx={j.ha[0]} cy={j.ha[1]} r="2.6" className="a-dark" />
          <circle cx={j.ha2[0]} cy={j.ha2[1]} r="2.6" className="a-dark" />
        </>
      ) : (
        <>
          {pad(j.el, j.ha, 4.5)}
          {pad(j.el2, j.ha2, 4.5)}
        </>
      ),
    }),
    track: hand,
  };
}

function pushup(): Template {
  return {
    a: { hip: [56, 64], torso: 105, arm: { to: [80, 84] }, leg: { to: [23, 77] }, toe: [20, 84] },
    b: { hip: [56, 73], torso: 95, arm: { to: [81, 84], bend: -1 }, leg: { to: [22, 79] }, toe: [20, 84] },
    track: neck,
    scene: mat(14, 96),
  };
}

function dip(variant: 'bw' | 'weighted' | 'assisted'): Template {
  return {
    a: { hip: [56, 47], torso: 172, arm: { to: [60, 50] }, leg: { to: [42, 68] } },
    b: { hip: [58, 60], torso: 162, arm: { to: [60, 50], bend: -1 }, leg: { to: [42, 78] } },
    scene: (
      <>
        {post(66, 51)}
        <rect x="50" y="49" width="24" height="3.4" rx="1.7" className="a-metal" />
        {variant === 'assisted' && (
          <>
            {post(36, 66)}
            {pad([30, 66], [52, 66], 5)}
          </>
        )}
      </>
    ),
    gear: variant === 'weighted' ? (j) => ({ front: <>{line(j.hip, rel(j.hip, 2, 14), 'a-chain', 1.4)}{plate(rel(j.hip, 2, 19), 6)}</> }) : undefined,
    track: neck,
    thumb: 'b',
  };
}

function benchDip(): Template {
  return {
    a: { hip: [53, 58], torso: 180, arm: { to: [46, 57] }, leg: { to: [82, 84] } },
    b: { hip: [54, 70], torso: 178, arm: { to: [46, 57], bend: -1 }, leg: { to: [84, 84] } },
    scene: bench(22, 50, 55),
    track: neck,
  };
}

// ---------- Hombros ----------
function ohpStand(imp: Imp): Template {
  const s = shoulderOf(HIP, 180);
  return {
    a: stand({ arm: { to: rel(s, 5, 1), bend: -1 } }),
    b: stand({ arm: { to: rel(s, 1, -26) } }),
    gear: held(imp),
    track: hand,
    scale: 0.88,
  };
}

function ohpSeat(imp: Imp): Template {
  const h: V = [54, 66];
  const s = shoulderOf(h, 180);
  const base = (arm: SidePose['arm']): SidePose => ({ hip: h, torso: 180, arm, leg: { to: [72, 84] } });
  return {
    a: base({ to: rel(s, 5, 1), bend: -1 }),
    b: base({ to: rel(s, 2, -26) }),
    scene:
      imp === 'machine' ? (
        <>
          {post(42, 8)}
          {pad([44, 72], [64, 72])}
          {pad([46, 70], [46, 34])}
          {stack(14, 30, 40)}
        </>
      ) : (
        <>
          {post(52, 72)}
          {pad([44, 72], [64, 72])}
          {pad([46, 70], [46, 34])}
        </>
      ),
    gear: imp === 'machine' ? (j) => ({ back: line([42, 12], j.ha, 'a-lever', 3), front: <circle cx={j.ha[0]} cy={j.ha[1]} r="2.6" className="a-dark" /> }) : held(imp),
    track: hand,
    scale: 0.9,
  };
}

function lateralRaise(cable: boolean): Template {
  if (cable)
    return {
      a: standF({ armR: { to: [64, 54] }, armL: { to: [47, 52] } }),
      b: standF({ armR: { to: [92, 30] }, armL: { to: [47, 52] } }),
      scene: pulleyTower(16, 80),
      gear: (j) => ({ back: line([18, 80], j.ha2) }),
      track: (j) => j.ha2,
    };
  return {
    a: standF({ armL: { to: [47, 53] }, armR: { to: [73, 53] } }),
    b: standF({ armL: { to: [28, 28] }, armR: { to: [92, 28] } }),
    gear: (j) => ({ front: <>{dumbbellFront(j.ha, true)}{dumbbellFront(j.ha2, true)}</> }),
    track: hand,
    bulge: 0.12,
  };
}

function frontRaise(): Template {
  const s = shoulderOf(HIP, 180);
  return { a: stand({ arm: { to: rel(s, 3, 26) } }), b: stand({ arm: { to: rel(s, 26, -2) } }), gear: held('db', false), track: hand, bulge: -0.25 };
}

function rearFly(): Template {
  const h: V = [52, 50];
  const s = shoulderOf(h, 105);
  return {
    a: { hip: h, torso: 105, arm: { to: rel(s, 1, 26) }, leg: { to: [58, 84] } },
    b: { hip: h, torso: 105, arm: { pts: [rel(s, -3, 6), rel(s, -1, -2)] }, arm2: { pts: [rel(s, -3, 6), rel(s, -1, -2)] }, leg: { to: [58, 84] } },
    gear: (j) => ({ front: dumbbell(j.ha) }),
    track: hand,
  };
}

function uprightRow(): Template {
  const s = shoulderOf(HIP, 180);
  return { a: stand({ arm: { to: rel(s, 3, 26) } }), b: stand({ arm: { pts: [rel(s, -6, -5), rel(s, 4, 6)] } }), gear: held('bar'), track: hand };
}

function handstandPushup(): Template {
  return {
    a: { hip: [58, 30], torso: 0, arm: { to: [60, 84] }, leg: { to: [52, -3] }, foot: 200 },
    b: { hip: [58, 42], torso: 0, arm: { to: [64, 84], bend: 1 }, leg: { to: [50, 8] }, foot: 200 },
    scene: wall(44),
    track: (j) => j.head,
    scale: 0.92,
  };
}

function facePull(): Template {
  const s = shoulderOf(HIP, 180);
  return {
    a: stand({ arm: { to: rel(s, 26, -2) } }),
    b: stand({ arm: { pts: [rel(s, -10, -6), rel(s, 2, -12)] } }),
    scene: pulleyTower(104, 20),
    gear: (j) => ({ back: line([102, 20], j.ha) }),
    track: hand,
  };
}

// ---------- Espalda ----------
function deadlift(imp: Imp, sumo: boolean): Template {
  if (sumo)
    return {
      a: { front: true, hip: [60, 62], armL: { to: [55, 76] }, armR: { to: [65, 76] }, legL: { to: [38, 84], bend: -1 }, legR: { to: [82, 84], bend: 1 } },
      b: { front: true, hip: [60, 51], armL: { to: [55, 70] }, armR: { to: [65, 70] }, legL: { to: [41, 84] }, legR: { to: [79, 84] } },
      gear: (j) => ({ front: barFront(j.ha[1] + 1) }),
      track: hand,
    };
  return {
    a: { hip: [43, 64], torso: 125, arm: { to: [64, 75] }, leg: { to: [60, 84] } },
    b: stand({ hip: [57, 49], arm: { to: [61, 52] } }),
    gear: held(imp),
    track: hand,
  };
}

function rdl(imp: Imp, single = false): Template {
  const h: V = [50, 51];
  const s = shoulderOf(h, 100);
  return {
    a: stand({ arm: { to: [62, 52] }, ...(single ? { leg2: { to: [54, 80] } } : {}) }),
    b: { hip: h, torso: 100, arm: { to: rel(s, 1, 25) }, leg: { to: [58, 84] }, ...(single ? { leg2: { to: [16, 46] }, foot2: -90 } : {}) },
    gear: imp === 'bw' ? undefined : held(imp),
    track: single ? (j) => j.head : hand,
  };
}

function goodMorning(): Template {
  const s1 = shoulderOf(HIP, 180);
  const h: V = [52, 50];
  const s2 = shoulderOf(h, 100);
  return {
    a: stand({ arm: { pts: [rel(s1, -6, 10), rel(s1, -1, -1)] } }),
    b: { hip: h, torso: 100, arm: { pts: [rel(s2, -4, 10), rel(s2, 1, -1)] }, leg: { to: [58, 84] } },
    gear: (j) => ({ front: plate(rel(j.ha, 0, -2)) }),
    track: (j) => j.head,
  };
}

function pullup(variant: 'bw' | 'weighted' | 'assisted'): Template {
  return {
    a: { hip: [60, 59], torso: 180, arm: { to: [61, 8] }, leg: { to: [50, 86] } },
    b: { hip: [60, 42], torso: 176, arm: { to: [62, 8], bend: -1 }, leg: { to: [50, 70] } },
    scene: (
      <>
        {post(34, 6)}
        {post(88, 6)}
        <rect x="30" y="5.5" width="62" height="3" rx="1.5" className="a-metal" />
        {variant === 'assisted' && pad([44, 78], [68, 78], 5)}
      </>
    ),
    gear: variant === 'weighted' ? (j) => ({ front: <>{line(j.hip, rel(j.hip, 1, 12), 'a-chain', 1.4)}{plate(rel(j.hip, 1, 17), 6)}</> }) : undefined,
    track: neck,
    thumb: 'b',
    scale: 0.92,
  };
}

function latPulldown(): Template {
  const h: V = [54, 66];
  const s = shoulderOf(h, 186);
  return {
    a: { hip: h, torso: 186, arm: { to: rel(s, 6, -25) }, leg: { to: [72, 84] } },
    b: { hip: h, torso: 190, arm: { to: rel(s, 7, -1), bend: -1 }, leg: { to: [72, 84] } },
    scene: (
      <>
        {post(22, 4)}
        <rect x="20" y="3" width="44" height="4" rx="2" className="a-frame" />
        <circle cx="58" cy="7" r="2.6" className="a-dark" />
        {stack(8, 28, 40)}
        {pad([44, 72], [66, 72])}
        {post(54, 72)}
        {pad([64, 58], [74, 58], 5)}
      </>
    ),
    gear: (j) => ({ back: line([58, 8], j.ha), front: <line x1={j.ha[0] - 6} y1={j.ha[1] - 1} x2={j.ha[0] + 6} y2={j.ha[1] + 1} className="a-metal-line" strokeWidth="2.4" strokeLinecap="round" /> }),
    track: hand,
  };
}

function bentRow(imp: Imp, landmine = false): Template {
  const h: V = [46, 52];
  const s = shoulderOf(h, 112);
  return {
    a: { hip: h, torso: 112, arm: { to: rel(s, 1, 26) }, leg: { to: [58, 84] } },
    b: { hip: h, torso: 112, arm: { to: rel(s, -4, 9), bend: 1 }, leg: { to: [58, 84] } },
    scene: landmine ? <circle cx="108" cy="83" r="2.5" className="a-dark" /> : undefined,
    gear: landmine ? (j) => ({ back: line([108, 83], j.ha, 'a-metal-line', 2.6), front: plate(rel(j.ha, -3, 1), 8) }) : held(imp),
    track: hand,
  };
}

function oneArmRow(kickback = false): Template {
  const h: V = [34, 49];
  const s = shoulderOf(h, 95);
  const base = (arm: SidePose['arm']): SidePose => ({ hip: h, torso: 95, arm, arm2: { to: [58, 71] }, leg: { to: [46, 84] }, leg2: { pts: [[35, 68], [20, 70]] }, toe2: [15, 69] });
  return {
    a: kickback ? base({ pts: [rel(s, -14, 2), rel(s, -14, 15)] }) : base({ to: rel(s, 2, 26) }),
    b: kickback ? base({ pts: [rel(s, -14, 2), rel(s, -27, 1)] }) : base({ to: rel(s, -6, 6), bend: 1 }),
    scene: bench(12, 62, 71),
    gear: (j) => ({ front: dumbbell(j.ha) }),
    track: hand,
  };
}

function cableRow(): Template {
  const h: V = [42, 70];
  const s = shoulderOf(h, 180);
  return {
    a: { hip: h, torso: 162, arm: { to: rel(s, 28, 6) }, leg: { to: [78, 74], bend: -1 } },
    b: { hip: h, torso: 184, arm: { to: rel(s, 12, 10), bend: -1 }, leg: { to: [78, 74], bend: -1 } },
    scene: (
      <>
        {pad([24, 76], [88, 76], 5)}
        {post(30, 78)}
        <rect x="82" y="66" width="4" height="14" rx="1.5" className="a-frame" />
        {pulleyTower(108, 72, 30)}
      </>
    ),
    gear: (j) => ({ back: line([106, 72], j.ha), front: <circle cx={j.ha[0]} cy={j.ha[1]} r="2.4" className="a-dark" /> }),
    track: hand,
  };
}

function machineRow(): Template {
  const h: V = [62, 66];
  const s = shoulderOf(h, 176);
  return {
    a: { hip: h, torso: 176, arm: { to: rel(s, 26, 4) }, leg: { to: [76, 84] } },
    b: { hip: h, torso: 182, arm: { to: rel(s, 8, 9), bend: -1 }, leg: { to: [76, 84] } },
    scene: (
      <>
        {post(62, 72)}
        {pad([52, 72], [72, 72])}
        {pad([75, 36], [75, 56], 6)}
        {post(98, 10)}
        {stack(104, 30, 40, 10)}
      </>
    ),
    gear: (j) => ({ back: line([98, 14], j.ha, 'a-lever', 3), front: <circle cx={j.ha[0]} cy={j.ha[1]} r="2.6" className="a-dark" /> }),
    track: hand,
  };
}

function bandRow(): Template {
  const h: V = [40, 75];
  const s = shoulderOf(h, 180);
  return {
    a: { hip: h, torso: 172, arm: { to: rel(s, 26, 6) }, leg: { to: [74, 80] }, foot: 160 },
    b: { hip: h, torso: 188, arm: { to: rel(s, 10, 12), bend: -1 }, leg: { to: [74, 80] }, foot: 160 },
    scene: mat(20, 90),
    gear: (j) => ({ back: band(j.to, j.ha, rel(j.ha, 8, 4)) }),
    track: hand,
  };
}

function pulloverCable(): Template {
  const h: V = [52, 49];
  const s = shoulderOf(h, 160);
  return {
    a: { hip: h, torso: 160, arm: { to: rel(s, 24, -12) }, leg: { to: [56, 84] } },
    b: { hip: h, torso: 160, arm: { to: rel(s, 4, 26) }, leg: { to: [56, 84] } },
    scene: pulleyTower(106, 6),
    gear: (j) => ({ back: line([104, 6], j.ha) }),
    track: hand,
    bulge: -0.25,
  };
}

function backExtension(): Template {
  const h: V = [56, 50];
  const crossed = (torso: number): SidePose['arm'] => {
    const s = shoulderOf(h, torso);
    const c: V = [(s[0] + h[0]) / 2, (s[1] + h[1]) / 2];
    return { pts: [rel(c, 4, 4), rel(s, 3, 3)] };
  };
  return {
    a: { hip: h, torso: 28, arm: crossed(28), leg: { to: [32, 80] }, foot: -50 },
    b: { hip: h, torso: 140, arm: crossed(140), leg: { to: [32, 80] }, foot: -50 },
    scene: (
      <>
        {line([24, 85], [60, 56], 'a-frame-line', 4)}
        {pad([53, 56], [61, 54], 7)}
        {pad([28, 83], [34, 83], 6)}
      </>
    ),
    track: (j) => j.head,
  };
}

function shrug(): Template {
  return { a: stand({ arm: { to: [61, 52] } }), b: stand({ arm: { to: [61, 45] }, shrug: 7 }), gear: held('db'), track: (j) => rel(j.shL, 8, 0), bulge: 0 };
}

// ---------- Brazos ----------
function curlStand(imp: Imp): Template {
  const s = shoulderOf(HIP, 180);
  const gear: Template['gear'] =
    imp === 'cable'
      ? (j) => ({ back: line([96, 82], j.ha), front: <circle cx={j.ha[0]} cy={j.ha[1]} r="2.4" className="a-dark" /> })
      : imp === 'band'
        ? (j) => ({ back: band(j.to, j.ha, rel(j.ha, 4, 16)) })
        : held(imp);
  return {
    a: stand({ arm: { to: rel(s, 3, 26) } }),
    b: stand({ arm: { to: rel(s, 6, 3), bend: -1 } }),
    scene: imp === 'cable' ? pulleyTower(98, 82, 30) : undefined,
    gear,
    track: hand,
    bulge: 0.25,
    thumb: 'b',
  };
}

function curlIncline(): Template {
  const h: V = [72, 63];
  const s = shoulderOf(h, -148);
  return {
    a: { hip: h, torso: -148, arm: { to: rel(s, -3, 26) }, leg: { to: [90, 84] } },
    b: { hip: h, torso: -148, arm: { to: rel(s, 10, 3), bend: -1 }, leg: { to: [90, 84] } },
    scene: (
      <>
        {post(80, 70)}
        {pad([62, 72], [86, 72])}
        {pad([65, 69], [50, 46])}
      </>
    ),
    gear: held('db'),
    track: hand,
    bulge: 0.25,
  };
}

function preacher(): Template {
  const h: V = [42, 66];
  const s = shoulderOf(h, 176);
  const el = rel(s, 10, 10);
  return {
    a: { hip: h, torso: 176, arm: { pts: [el, rel(el, 10, 8)] }, leg: { to: [60, 84] } },
    b: { hip: h, torso: 176, arm: { pts: [el, rel(el, -2, -12)] }, leg: { to: [60, 84] } },
    scene: (
      <>
        {post(56, 56)}
        {pad([47, 46], [63, 62], 6)}
        {pad([30, 72], [52, 72])}
        {post(40, 72)}
      </>
    ),
    gear: held('ez'),
    track: hand,
    bulge: 0.25,
  };
}

function concentration(): Template {
  const h: V = [44, 66];
  const s = shoulderOf(h, 150);
  return {
    a: { hip: h, torso: 150, arm: { to: rel(s, 2, 26) }, leg: { to: [66, 84] } },
    b: { hip: h, torso: 150, arm: { pts: [rel(s, 4, 13), rel(s, 0, 1)] }, leg: { to: [66, 84] } },
    scene: bench(26, 56, 70),
    gear: (j) => ({ front: dumbbell(j.ha) }),
    track: hand,
    bulge: 0.3,
  };
}

function pushdown(rope: boolean): Template {
  const h: V = [56, 49];
  const s = shoulderOf(h, 174);
  return {
    a: { hip: h, torso: 174, arm: { pts: [rel(s, 1, 14), rel(s, 13, 9)] }, leg: { to: [58, 84] } },
    b: { hip: h, torso: 174, arm: { pts: [rel(s, 1, 14), rel(s, 6, 26)] }, leg: { to: [58, 84] } },
    scene: pulleyTower(90, 6),
    gear: (j) => ({
      back: line([88, 7], j.ha),
      front: rope ? <path d={`M${j.ha[0]} ${j.ha[1]} l-2 5 M${j.ha[0]} ${j.ha[1]} l2 5`} className="a-rope" strokeWidth="2" strokeLinecap="round" /> : <circle cx={j.ha[0]} cy={j.ha[1]} r="2.4" className="a-dark" />,
    }),
    track: hand,
    bulge: -0.2,
  };
}

function overheadExt(): Template {
  const h: V = [54, 66];
  const s = shoulderOf(h, 180);
  const base = (arm: SidePose['arm']): SidePose => ({ hip: h, torso: 180, arm, leg: { to: [72, 84] } });
  return {
    a: base({ pts: [rel(s, 3, -14), rel(s, 4, -27)] }),
    b: base({ pts: [rel(s, 3, -14), rel(s, -9, -10)] }),
    scene: (
      <>
        {post(52, 72)}
        {pad([44, 72], [64, 72])}
        {pad([46, 70], [46, 40])}
      </>
    ),
    gear: (j) => ({ front: dumbbell(j.ha, 4.8) }),
    track: hand,
    scale: 0.9,
  };
}

function wristCurl(): Template {
  const h: V = [42, 66];
  const el: V = [54, 62];
  return {
    a: { hip: h, torso: 168, arm: { pts: [el, [67, 65]] }, leg: { to: [66, 84] } },
    b: { hip: h, torso: 168, arm: { pts: [el, [67, 56]] }, leg: { to: [66, 84] } },
    scene: bench(24, 54, 70),
    gear: held('ez'),
    track: hand,
  };
}

function farmer(): Template {
  return {
    a: stand({ leg: { to: [72, 84] }, leg2: { to: [48, 84] }, arm: { to: [61, 52] } }),
    b: stand({ hip: [66, 49], leg: { to: [60, 84] }, leg2: { to: [78, 84] }, arm: { to: [67, 52] } }),
    gear: held('db'),
    track: hip,
  };
}

function deadHang(): Template {
  const p: SidePose = { hip: [60, 59], torso: 180, arm: { to: [61, 8] }, leg: { to: [56, 88] } };
  return {
    a: p,
    b: { ...p, hip: [60, 57] },
    scene: (
      <>
        {post(34, 6)}
        {post(88, 6)}
        <rect x="30" y="5.5" width="62" height="3" rx="1.5" className="a-metal" />
      </>
    ),
    scale: 0.92,
  };
}

// ---------- Piernas ----------
function squat(kind: 'back' | 'front' | 'goblet' | 'bw'): Template {
  const h2: V = kind === 'front' || kind === 'goblet' ? [46, 69] : [44, 68];
  const t2 = kind === 'front' ? 160 : kind === 'goblet' ? 158 : 145;
  const s1 = shoulderOf(HIP, 180);
  const s2 = shoulderOf(h2, t2);
  const arms = (s: V): SidePose['arm'] => {
    if (kind === 'back') return { pts: [rel(s, -6, 10), rel(s, -1, -1)] };
    if (kind === 'front') return { pts: [rel(s, 8, 4), rel(s, 4, -4)] };
    if (kind === 'goblet') return { to: rel(s, 8, 8), bend: -1 };
    return { to: rel(s, 27, 0) };
  };
  return {
    a: stand({ arm: arms(s1) }),
    b: { hip: h2, torso: t2, arm: arms(s2), leg: { to: [60, 84] } },
    gear: (j) => ({
      front: kind === 'back' ? plate(rel(j.ha, 0, -2)) : kind === 'front' ? plate(rel(j.ha, 2, 2)) : kind === 'goblet' ? kettlebell(rel(j.ha, 2, 2)) : undefined,
    }),
    track: hip,
    thumb: 'b',
  };
}

function hack(): Template {
  return {
    a: { hip: [56, 46], torso: 166, arm: { to: [64, 22], bend: -1 }, leg: { to: [70, 80] } },
    b: { hip: [46, 64], torso: 160, arm: { to: [56, 40], bend: -1 }, leg: { to: [70, 80] } },
    scene: (
      <>
        {line([30, 85], [62, 10], 'a-frame-line', 4)}
        {pad([66, 86], [80, 78], 5)}
      </>
    ),
    gear: (j) => ({ back: pad(rel(j.shL, -6, 2), rel(j.hip, -6, 2), 6), front: <rect x={j.shL[0] - 1} y={j.shL[1] - 4} width="7" height="5" rx="2" className="a-pad" /> }),
    track: hip,
  };
}

function legPress(calf = false): Template {
  const h: V = [40, 72];
  const ext: V = [80, 40];
  return {
    a: calf ? { hip: h, torso: -142, arm: { to: [48, 76] }, leg: { to: ext }, foot: 140 } : { hip: h, torso: -142, arm: { to: [48, 76] }, leg: { to: [62, 52], bend: -1 } },
    b: calf ? { hip: h, torso: -142, arm: { to: [48, 76] }, leg: { to: ext }, foot: 100 } : { hip: h, torso: -142, arm: { to: [48, 76] }, leg: { to: ext } },
    scene: (
      <>
        {line([30, 85], [112, 28], 'a-frame-line', 4)}
        {pad([46, 78], [22, 52], 7)}
        {pad([40, 79], [58, 79], 6)}
      </>
    ),
    gear: (j) => ({ front: <g transform={`rotate(-34 ${j.to[0]} ${j.to[1]})`}><rect x={j.to[0] - 2} y={j.to[1] - 13} width="6" height="22" rx="2" className="a-dark" /></g> }),
    track: calf ? (j) => j.to : ankle,
  };
}

function legExtension(): Template {
  const h: V = [46, 62];
  return {
    a: { hip: h, torso: 186, arm: { to: [52, 68] }, leg: { pts: [[64, 62], [65, 79]] } },
    b: { hip: h, torso: 186, arm: { to: [52, 68] }, leg: { pts: [[64, 62], [81, 58]] } },
    scene: (
      <>
        {post(48, 68)}
        {pad([36, 68], [64, 68])}
        {pad([36, 66], [33, 32])}
        <circle cx="64" cy="62" r="3" className="a-dark" />
      </>
    ),
    gear: (j) => ({ front: <circle cx={j.an[0] + 2} cy={j.an[1]} r="3.4" className="a-pad" /> }),
    track: ankle,
    bulge: -0.2,
  };
}

function lunge(): Template {
  return {
    a: stand({ arm: { to: [61, 52] } }),
    b: { hip: [56, 62], torso: 180, arm: { to: [57, 64] }, leg: { to: [72, 84] }, leg2: { pts: [[46, 78], [31, 76]] }, toe2: [35, 84] },
    gear: held('db'),
    track: hip,
  };
}

function bulgarian(): Template {
  return {
    a: { hip: [54, 51], torso: 178, arm: { to: [55, 54] }, leg: { to: [66, 84] }, leg2: { pts: [[46, 66], [30, 64]] }, toe2: [24, 62] },
    b: { hip: [54, 63], torso: 172, arm: { to: [56, 66] }, leg: { to: [68, 84] }, leg2: { pts: [[42, 76], [30, 64]] }, toe2: [24, 62] },
    scene: bench(10, 34, 64),
    gear: held('db'),
    track: hip,
  };
}

function stepUp(): Template {
  return {
    a: { hip: [48, 49], torso: 176, arm: { to: [50, 52] }, leg: { to: [72, 64] }, leg2: { to: [48, 84] } },
    b: { hip: [72, 30], torso: 180, arm: { to: [73, 33] }, leg: { to: [72, 64] }, leg2: { to: [64, 56] } },
    scene: box(62, 65, 40, 20),
    gear: held('db'),
    track: hip,
    scale: 0.9,
  };
}

function sissy(): Template {
  return {
    a: stand({ arm: { to: [86, 26] } }),
    b: { hip: [50, 66], torso: 200, arm: { to: [72, 46] }, leg: { pts: [[68, 72], [62, 84]] }, toe: [69, 84] },
    track: (j) => j.kn,
  };
}

function thighMachine(adduct: boolean): Template {
  const open = seatedF({ legL: { pts: [[42, 64], [36, 82]] }, legR: { pts: [[78, 64], [84, 82]] } });
  const closed = seatedF({ legL: { pts: [[55, 66], [54, 84]] }, legR: { pts: [[65, 66], [66, 84]] } });
  return {
    a: adduct ? open : closed,
    b: adduct ? closed : open,
    scene: frontSeat,
    gear: (j) => ({
      front: (
        <>
          <rect x={j.kn[0] + (adduct ? 1 : -6)} y={j.kn[1] - 4} width="5" height="10" rx="2" className="a-pad" />
          <rect x={j.kn2[0] + (adduct ? -6 : 1)} y={j.kn2[1] - 4} width="5" height="10" rx="2" className="a-pad" />
        </>
      ),
    }),
    track: (j) => j.kn,
  };
}

function legCurlLying(): Template {
  const h: V = [48, 60];
  const base = (leg: SidePose['leg']): SidePose => ({ hip: h, torso: 90, arm: { to: [88, 67] }, leg, foot: 180 });
  return {
    a: base({ pts: [[30, 61], [13, 61]] }),
    b: base({ pts: [[30, 61], [34, 45]] }),
    scene: (
      <>
        {post(30, 66)}
        {post(84, 66)}
        {pad([16, 66], [90, 66])}
      </>
    ),
    gear: (j) => ({ front: <circle cx={j.an[0]} cy={j.an[1] - 3} r="3.4" className="a-pad" /> }),
    track: ankle,
    bulge: 0.2,
  };
}

function legCurlSeated(): Template {
  const h: V = [46, 62];
  return {
    a: { hip: h, torso: 184, arm: { to: [52, 68] }, leg: { pts: [[64, 62], [81, 60]] } },
    b: { hip: h, torso: 184, arm: { to: [52, 68] }, leg: { pts: [[64, 62], [60, 79]] } },
    scene: (
      <>
        {post(48, 68)}
        {pad([36, 68], [64, 68])}
        {pad([36, 66], [33, 32])}
        {pad([56, 56], [66, 56], 5)}
      </>
    ),
    gear: (j) => ({ front: <circle cx={j.an[0]} cy={j.an[1] + 3} r="3.4" className="a-pad" /> }),
    track: ankle,
    bulge: 0.2,
  };
}

function nordic(): Template {
  const kneel: SidePose['leg'] = { pts: [[52, 83], [34, 83]] };
  return {
    a: { hip: [52, 65], torso: 180, arm: { pts: [[56, 50], [64, 44]] }, leg: kneel, foot: 200 },
    b: { hip: [66, 73], torso: 124, arm: { to: [100, 82] }, leg: kneel, foot: 200 },
    scene: (
      <>
        {mat(26, 70)}
        <circle cx="34" cy="78" r="3.4" className="a-pad" />
      </>
    ),
    track: (j) => j.head,
  };
}

function hipThrust(imp: Imp): Template {
  return {
    a: { hip: [53, 77], torso: -128, arm: { to: [57, 70] }, leg: { to: [74, 84] } },
    b: { hip: [53, 61], torso: -96, arm: { to: [55, 54] }, leg: { to: [74, 84] } },
    scene: imp === 'bw' ? mat(8, 92) : bench(10, 36, 62),
    gear: imp === 'bar' ? (j) => ({ front: plate(rel(j.hip, 2, -9)) }) : undefined,
    track: hip,
  };
}

function gluteBridge(): Template {
  return {
    a: { hip: [54, 80], torso: -90, arm: { to: [46, 83] }, leg: { to: [72, 84] } },
    b: { hip: [54, 67], torso: -58, arm: { to: [44, 83] }, leg: { to: [72, 84] } },
    scene: mat(8, 92),
    track: hip,
  };
}

function cableKickback(): Template {
  return {
    a: { hip: [56, 49], torso: 168, arm: { to: [82, 40] }, leg: { to: [60, 84] }, leg2: { to: [56, 84] } },
    b: { hip: [56, 49], torso: 160, arm: { to: [82, 40] }, leg: { to: [30, 74] }, leg2: { to: [56, 84] } },
    scene: pulleyTower(90, 80),
    gear: (j) => ({ back: line([88, 80], j.an) }),
    track: ankle,
  };
}

function monsterWalk(): Template {
  return {
    a: { front: true, hip: [60, 56], armL: { to: [52, 72] }, armR: { to: [68, 72] }, legL: { to: [50, 84] }, legR: { to: [70, 84] } },
    b: { front: true, hip: [62, 56], armL: { to: [54, 72] }, armR: { to: [70, 72] }, legL: { to: [48, 84] }, legR: { to: [80, 84] } },
    gear: (j) => ({ front: band(j.kn, j.kn2, rel([(j.kn[0] + j.kn2[0]) / 2, (j.kn[1] + j.kn2[1]) / 2], 0, 3)) }),
    track: (j) => j.an2,
  };
}

function calfRaise(kind: 'machine' | 'seated' | 'single'): Template {
  if (kind === 'seated') {
    const h: V = [44, 64];
    return {
      a: { hip: h, torso: 180, arm: { to: [60, 62] }, leg: { pts: [[62, 64], [62, 80]] }, foot: 105 },
      b: { hip: h, torso: 180, arm: { to: [60, 58] }, leg: { pts: [[62, 60], [63, 76]] }, foot: 60 },
      scene: (
        <>
          {bench(28, 56, 68)}
          <rect x="60" y="80" width="12" height="5" rx="1" className="a-light-frame" />
        </>
      ),
      gear: (j) => ({ front: pad(rel(j.kn, -2, -3), rel(j.kn, 10, -3), 5) }),
      track: (j) => j.kn,
    };
  }
  const single = kind === 'single';
  return {
    a: { hip: [58, 46], torso: 180, arm: single ? { to: [76, 30] } : { pts: [[52, 32], [58, 22]] }, leg: { to: [58, 80] }, foot: 108, ...(single ? { leg2: { pts: [[60, 62], [48, 70]] } } : {}) },
    b: { hip: [58, 40], torso: 180, arm: single ? { to: [76, 26] } : { pts: [[52, 26], [58, 16]] }, leg: { to: [58, 74] }, foot: 50, ...(single ? { leg2: { pts: [[60, 56], [48, 64]] } } : {}) },
    scene: (
      <>
        <rect x="58" y="80" width="14" height="5" rx="1" className="a-light-frame" />
        {single ? wall(84) : post(40, 6)}
      </>
    ),
    gear: single ? undefined : (j) => ({ front: <rect x={j.shL[0] - 6} y={j.shL[1] - 5} width="12" height="5" rx="2" className="a-pad" /> }),
    track: (j) => j.head,
    scale: single ? 1 : 0.95,
  };
}

// ---------- Abdominales ----------
function plank(side: boolean): Template {
  if (side) {
    const p = (y: number): FrontPose => ({
      front: true,
      hip: [52, y],
      torso: 112,
      armL: { to: [72, 24] },
      armR: { pts: [[78, 82], [90, 83]] },
      legL: { to: [16, 78] },
      legR: { to: [17, 84] },
      noFeet: true,
    });
    return { a: p(72), b: p(66), scene: mat(10, 100), track: hip };
  }
  const p: SidePose = { hip: [50, 70], torso: 95, arm: { pts: [[74, 82], [86, 83]] }, leg: { to: [20, 79] }, toe: [18, 84] };
  return { a: p, b: p, scene: mat(12, 96) };
}

function crunch(): Template {
  const h: V = [58, 80];
  const behind = (t: number): SidePose['arm'] => {
    const s = shoulderOf(h, t);
    return { pts: [rel(s, 4, -8), rel(s, -6, -9)] };
  };
  return {
    a: { hip: h, torso: -90, arm: behind(-90), leg: { to: [76, 84] } },
    b: { hip: h, torso: -122, arm: behind(-122), leg: { to: [76, 84] }, arch: 3 },
    scene: mat(8, 92),
    track: neck,
  };
}

function cableCrunch(): Template {
  const kneel: SidePose['leg'] = { pts: [[50, 84], [32, 84]] };
  return {
    a: { hip: [50, 66], torso: 160, arm: { pts: [[62, 42], [64, 34]] }, leg: kneel, foot: 200 },
    b: { hip: [52, 64], torso: 112, arm: { pts: [[74, 62], [76, 54]] }, leg: kneel, foot: 200, arch: 5 },
    scene: pulleyTower(96, 6),
    gear: (j) => ({ back: line([94, 7], j.ha) }),
    track: neck,
  };
}

function hangingLegRaise(): Template {
  return {
    a: { hip: [60, 59], torso: 180, arm: { to: [61, 8] }, leg: { to: [60, 92] } },
    b: { hip: [60, 59], torso: 186, arm: { to: [61, 8] }, leg: { to: [95, 54] }, foot: 180 },
    scene: (
      <>
        {post(34, 6)}
        {post(88, 6)}
        <rect x="30" y="5.5" width="62" height="3" rx="1.5" className="a-metal" />
      </>
    ),
    track: ankle,
    scale: 0.9,
    thumb: 'b',
  };
}

function abWheel(): Template {
  const kneel: SidePose['leg'] = { pts: [[40, 84], [22, 84]] };
  return {
    a: { hip: [44, 67], torso: 142, arm: { to: [64, 80] }, leg: kneel, foot: 200, arch: -4 },
    b: { hip: [56, 76], torso: 96, arm: { to: [100, 80] }, leg: kneel, foot: 200 },
    gear: (j) => ({ front: <><circle cx={j.ha[0]} cy={j.ha[1]} r="5" className="a-dark" /><circle cx={j.ha[0]} cy={j.ha[1]} r="1.8" className="a-metal" /></> }),
    scene: mat(14, 104),
    track: hand,
  };
}

function russianTwist(): Template {
  const base = (armL: FrontPose['armL'], armR: FrontPose['armR'], t: number): FrontPose => ({ front: true, hip: [60, 70], torso: t, armL, armR, legL: { pts: [[52, 62], [48, 76]] }, legR: { pts: [[68, 62], [72, 76]] }, noFeet: true });
  return {
    a: base({ pts: [[46, 54], [40, 62]] }, { pts: [[62, 58], [42, 62]] }, 172),
    b: base({ pts: [[58, 58], [78, 62]] }, { pts: [[74, 54], [80, 62]] }, 188),
    scene: mat(28, 92),
    gear: (j) => ({ front: plate([(j.ha[0] + j.ha2[0]) / 2, (j.ha[1] + j.ha2[1]) / 2 + 1], 5.5) }),
    track: hand,
  };
}

function pallof(): Template {
  const s = shoulderOf(HIP, 180);
  return {
    a: stand({ arm: { to: rel(s, 6, 10), bend: -1 }, leg: { to: [66, 84] }, leg2: { to: [54, 84] } }),
    b: stand({ arm: { to: rel(s, 26, 6) }, leg: { to: [66, 84] }, leg2: { to: [54, 84] } }),
    scene: pulleyTower(16, 34),
    gear: (j) => ({ back: line([18, 34], j.ha), front: <circle cx={j.ha[0]} cy={j.ha[1]} r="2.4" className="a-dark" /> }),
    track: hand,
  };
}

function deadBug(): Template {
  const h: V = [62, 80];
  const s = shoulderOf(h, -90);
  const table: SidePose['leg'] = { pts: [[62, 62], [79, 62]] };
  return {
    a: { hip: h, torso: -90, arm: { to: rel(s, 0, -26) }, arm2: { to: rel(s, 0, -26) }, leg: table, leg2: table, foot: 180, foot2: 180 },
    b: { hip: h, torso: -90, arm: { to: rel(s, -25, -6) }, arm2: { to: rel(s, 0, -26) }, leg: { to: [96, 76] }, leg2: table, foot: 180, foot2: 180 },
    scene: mat(6, 106),
    track: hand,
  };
}

// ---------- Cuerpo completo ----------
function clean(): Template {
  const s = shoulderOf(HIP, 180);
  return {
    a: { hip: [43, 64], torso: 125, arm: { to: [64, 75] }, leg: { to: [60, 84] } },
    b: stand({ arm: { pts: [rel(s, 9, 2), rel(s, 4, -4)] } }),
    gear: held('bar'),
    track: hand,
    bulge: 0.2,
  };
}

function snatch(): Template {
  return {
    a: { hip: [43, 64], torso: 125, arm: { to: [64, 75] }, leg: { to: [60, 84] } },
    b: stand({ arm: { to: [57, -2] } }),
    gear: held('bar'),
    track: hand,
    scale: 0.86,
    bulge: 0.15,
  };
}

function thruster(): Template {
  const h: V = [46, 69];
  const s = shoulderOf(h, 160);
  return {
    a: { hip: h, torso: 160, arm: { pts: [rel(s, 8, 4), rel(s, 4, -4)] }, leg: { to: [60, 84] } },
    b: stand({ arm: { to: [61, -2] } }),
    gear: held('bar'),
    track: hand,
    scale: 0.86,
  };
}

function kbSwing(): Template {
  const h: V = [46, 52];
  const s = shoulderOf(h, 118);
  return {
    a: { hip: h, torso: 118, arm: { to: rel(s, -12, 22) }, leg: { to: [58, 84] } },
    b: stand({ arm: { to: [86, 28] } }),
    gear: held('kb'),
    track: hand,
    bulge: -0.2,
  };
}

function burpee(): Template {
  return {
    a: { hip: [56, 64], torso: 105, arm: { to: [80, 84] }, leg: { to: [23, 77] }, toe: [20, 84] },
    b: { hip: [60, 41], torso: 180, arm: { to: [64, -6] }, leg: { to: [60, 76] }, foot: 30 },
    track: hip,
    scale: 0.88,
  };
}

function getup(): Template {
  const h1: V = [56, 80];
  const s1 = shoulderOf(h1, -90);
  const h2: V = [58, 76];
  const s2 = shoulderOf(h2, -138);
  return {
    a: { hip: h1, torso: -90, arm: { to: rel(s1, 0, -26) }, leg: { to: [76, 84] }, leg2: { to: [90, 82] } },
    b: { hip: h2, torso: -138, arm: { to: rel(s2, 0, -26) }, arm2: { to: [26, 84] }, leg: { to: [76, 84] }, leg2: { to: [90, 82] } },
    scene: mat(8, 100),
    gear: (j) => ({ front: kettlebell(rel(j.ha, 0, -4)) }),
    track: neck,
  };
}

// ---------- Cardio ----------
function run(kind: 'run' | 'walk' | 'treadmill' | 'elliptical'): Template {
  const walk = kind === 'walk';
  const p1: SidePose = walk
    ? { hip: [60, 49], torso: 178, arm: { to: [66, 50] }, arm2: { to: [54, 50] }, leg: { to: [68, 84] }, leg2: { to: [52, 84] } }
    : { hip: [60, 46], torso: 166, arm: { to: [72, 36], bend: -1 }, arm2: { to: [48, 52], bend: -1 }, leg: { to: [72, 76] }, leg2: { pts: [[54, 62], [40, 60]] } };
  const p2: SidePose = walk
    ? { hip: [62, 49], torso: 178, arm: { to: [56, 50] }, arm2: { to: [68, 50] }, leg: { to: [54, 84] }, leg2: { to: [70, 84] } }
    : { hip: [60, 46], torso: 166, arm: { to: [48, 52], bend: -1 }, arm2: { to: [72, 36], bend: -1 }, leg: { pts: [[54, 62], [40, 60]] }, leg2: { to: [72, 76] } };
  const scene =
    kind === 'treadmill' ? (
      <>
        <rect x="18" y="80" width="84" height="6" rx="3" className="a-dark" />
        {line([96, 80], [104, 34], 'a-frame-line', 3.5)}
        <rect x="96" y="28" width="18" height="8" rx="2" className="a-pad" />
      </>
    ) : kind === 'elliptical' ? (
      <>
        <circle cx="60" cy="74" r="10" className="a-light-frame" />
        {line([88, 84], [86, 26], 'a-frame-line', 3.5)}
      </>
    ) : undefined;
  return { a: p1, b: p2, scene, track: kind === 'elliptical' ? ankle : hip };
}

function bike(): Template {
  const h: V = [52, 44];
  const p = (leg: SidePose['leg'], leg2: SidePose['leg']): SidePose => ({ hip: h, torso: 140, arm: { to: [84, 42] }, leg, leg2 });
  return {
    a: p({ to: [60, 76] }, { to: [70, 62] }),
    b: p({ to: [70, 62] }, { to: [60, 76] }),
    scene: (
      <>
        {line([46, 50], [62, 84], 'a-frame-line', 3.5)}
        {line([62, 84], [88, 84], 'a-frame-line', 3.5)}
        {line([86, 84], [86, 42], 'a-frame-line', 3.5)}
        {pad([42, 48], [56, 48], 4)}
        <circle cx="65" cy="69" r="9" className="a-light-frame" />
        <circle cx="82" cy="72" r="10" className="a-dark-ring" />
      </>
    ),
    track: ankle,
  };
}

function rower(): Template {
  return {
    a: { hip: [42, 76], torso: 148, arm: { to: [76, 64] }, leg: { to: [70, 78], bend: -1 } },
    b: { hip: [32, 76], torso: 196, arm: { to: [40, 60], bend: -1 }, leg: { to: [70, 78] } },
    scene: (
      <>
        {line([8, 84], [100, 84], 'a-frame-line', 4)}
        <circle cx="100" cy="70" r="11" className="a-dark-ring" />
        <rect x="70" y="72" width="5" height="10" rx="1.5" className="a-frame" />
      </>
    ),
    gear: (j) => ({ back: line([96, 66], j.ha, 'a-chain', 1.4), front: pad(rel(j.hip, -6, 4), rel(j.hip, 6, 4), 4) }),
    track: hip,
  };
}

function jumpRope(): Template {
  return {
    a: stand({ hip: [60, 47], arm: { to: [70, 56], bend: -1 }, leg: { to: [61, 82] }, foot: 50 }),
    b: stand({ hip: [60, 49], arm: { to: [70, 58], bend: -1 } }),
    gear: (j) => ({ back: <path d={`M${j.ha[0]} ${j.ha[1]} C 100 ${j.ha[1] + 40}, 20 ${j.ha[1] + 40}, ${j.ha2[0] - 18} ${j.ha2[1]}`} className="a-rope" strokeWidth="1.4" fill="none" /> }),
    track: hip,
  };
}

function stair(): Template {
  return {
    a: { hip: [56, 40], torso: 170, arm: { to: [76, 44] }, leg: { to: [64, 60] }, leg2: { to: [54, 75] } },
    b: { hip: [58, 34], torso: 170, arm: { to: [78, 40] }, leg: { to: [62, 69] }, leg2: { to: [66, 52] } },
    scene: (
      <>
        <path d="M20 85 V75 H40 V65 H60 V55 H80 V85 Z" className="a-light" />
        {line([84, 85], [84, 30], 'a-frame-line', 3.5)}
      </>
    ),
    track: ankle,
    scale: 0.95,
  };
}

// ---------- Movilidad ----------
function hip9090(): Template {
  return {
    a: { hip: [56, 76], torso: 180, arm: { to: [66, 82] }, leg: { pts: [[74, 80], [70, 85]] }, leg2: { pts: [[40, 82], [34, 72]] }, foot: 90 },
    b: { hip: [56, 76], torso: 140, arm: { to: [86, 82] }, leg: { pts: [[74, 80], [70, 85]] }, leg2: { pts: [[40, 82], [34, 72]] }, foot: 90 },
    scene: mat(20, 100),
    track: (j) => j.head,
  };
}

function hamstringStretch(): Template {
  const h: V = [52, 49];
  return {
    a: stand(),
    b: { hip: h, torso: 70, arm: { to: [64, 82] }, leg: { to: [56, 84] }, arch: -4 },
    track: (j) => j.head,
  };
}

function bandDislocate(): Template {
  const s = shoulderOf(HIP, 180);
  return {
    a: stand({ arm: { to: rel(s, 25, 10) } }),
    b: stand({ arm: { to: rel(s, -24, 10) } }),
    gear: (j) => ({ front: <circle cx={j.ha[0]} cy={j.ha[1]} r="2" className="a-band" /> }),
    track: hand,
    bulge: -0.6,
    scale: 0.92,
  };
}

function quadruped(arch1: number, arch2: number, reach = false): Template {
  const p = (arch: number, head: number, arm?: SidePose['arm']): SidePose => ({
    hip: [40, 63],
    torso: 108,
    head,
    arm: arm ?? { to: [64, 84] },
    arm2: { to: [64, 84] },
    leg: { pts: [[40, 83], [22, 83]] },
    foot: 200,
    arch,
  });
  if (reach) return { a: p(0, 0, { pts: [[58, 72], [50, 78]] }), b: p(0, -20, { pts: [[62, 46], [64, 33]] }), scene: mat(12, 90), track: hand };
  return { a: p(arch1, 30), b: p(arch2, -40), scene: mat(12, 90), track: (j) => j.head };
}

function ankleWall(): Template {
  const kneel: SidePose['leg2'] = { pts: [[44, 84], [28, 84]] };
  return {
    a: { hip: [46, 66], torso: 180, arm: { to: [84, 46] }, leg: { pts: [[64, 66], [66, 83]] }, leg2: kneel, foot2: 200 },
    b: { hip: [50, 66], torso: 176, arm: { to: [84, 44] }, leg: { pts: [[70, 68], [66, 83]] }, leg2: kneel, foot2: 200 },
    scene: wall(88),
    track: (j) => j.kn,
  };
}

function bandPress(): Template {
  const s = shoulderOf(HIP, 180);
  return {
    a: stand({ arm: { to: rel(s, 9, 4), bend: -1 } }),
    b: stand({ arm: { to: rel(s, 27, 0) } }),
    scene: post(14, 20),
    gear: (j) => ({ back: band([16, 28], j.ha) }),
    track: hand,
  };
}

/** Plantillas por identificador estable. */
export const TEMPLATES = {
  'bench-bar': () => benchPress('flat', 'bar'),
  'bench-db': () => benchPress('flat', 'db'),
  'incline-bar': () => benchPress('incline', 'bar'),
  'incline-db': () => benchPress('incline', 'db'),
  'decline-bar': () => benchPress('decline', 'bar'),
  'fly-db': flyTop,
  'cable-cross': cableCross,
  'chest-press-machine': chestPressMachine,
  'pec-deck': () => pecDeck(false),
  'reverse-pec-deck': () => pecDeck(true),
  pushup,
  dip: () => dip('bw'),
  'dip-weighted': () => dip('weighted'),
  'dip-assisted': () => dip('assisted'),
  'bench-dip': benchDip,
  'ohp-bar': () => ohpStand('bar'),
  'ohp-db': () => ohpSeat('db'),
  'ohp-machine': () => ohpSeat('machine'),
  'lateral-db': () => lateralRaise(false),
  'lateral-cable': () => lateralRaise(true),
  'front-raise': frontRaise,
  'rear-fly': rearFly,
  'upright-row': uprightRow,
  'handstand-pushup': handstandPushup,
  'face-pull': facePull,
  deadlift: () => deadlift('bar', false),
  'deadlift-sumo': () => deadlift('bar', true),
  'rdl-bar': () => rdl('bar'),
  'rdl-db': () => rdl('db'),
  'rdl-single': () => rdl('bw', true),
  'good-morning': goodMorning,
  pullup: () => pullup('bw'),
  'pullup-weighted': () => pullup('weighted'),
  'pullup-assisted': () => pullup('assisted'),
  'lat-pulldown': latPulldown,
  'row-bar': () => bentRow('bar'),
  'row-landmine': () => bentRow('bar', true),
  'row-db-one': () => oneArmRow(false),
  'row-cable': cableRow,
  'row-machine': machineRow,
  'row-band': bandRow,
  'pullover-cable': pulloverCable,
  'back-extension': backExtension,
  shrug,
  'curl-bar': () => curlStand('bar'),
  'curl-ez': () => curlStand('ez'),
  'curl-db': () => curlStand('db'),
  'curl-cable': () => curlStand('cable'),
  'curl-band': () => curlStand('band'),
  'curl-incline': curlIncline,
  'curl-preacher': preacher,
  'curl-concentration': concentration,
  'pushdown-bar': () => pushdown(false),
  'pushdown-rope': () => pushdown(true),
  skullcrusher: skullCrusher,
  'overhead-ext': overheadExt,
  kickback: () => oneArmRow(true),
  'wrist-curl': wristCurl,
  farmer,
  'dead-hang': deadHang,
  'squat-back': () => squat('back'),
  'squat-front': () => squat('front'),
  'squat-goblet': () => squat('goblet'),
  'squat-bw': () => squat('bw'),
  'hack-squat': hack,
  'leg-press': () => legPress(false),
  'leg-press-calf': () => legPress(true),
  'leg-extension': legExtension,
  lunge,
  bulgarian,
  'step-up': stepUp,
  sissy,
  adduction: () => thighMachine(true),
  abduction: () => thighMachine(false),
  'leg-curl-lying': legCurlLying,
  'leg-curl-seated': legCurlSeated,
  nordic,
  'hip-thrust': () => hipThrust('bar'),
  'glute-bridge': gluteBridge,
  'cable-kickback': cableKickback,
  'monster-walk': monsterWalk,
  'calf-machine': () => calfRaise('machine'),
  'calf-seated': () => calfRaise('seated'),
  'calf-single': () => calfRaise('single'),
  plank: () => plank(false),
  'side-plank': () => plank(true),
  crunch,
  'cable-crunch': cableCrunch,
  'hanging-leg-raise': hangingLegRaise,
  'ab-wheel': abWheel,
  'russian-twist': russianTwist,
  pallof,
  'dead-bug': deadBug,
  clean,
  snatch,
  thruster,
  'kb-swing': kbSwing,
  burpee,
  'get-up': getup,
  run: () => run('run'),
  walk: () => run('walk'),
  treadmill: () => run('treadmill'),
  elliptical: () => run('elliptical'),
  bike,
  rower,
  'jump-rope': jumpRope,
  stair,
  'hip-90-90': hip9090,
  'hamstring-stretch': hamstringStretch,
  'band-dislocate': bandDislocate,
  'cat-cow': () => quadruped(5, -6),
  'thoracic-rotation': () => quadruped(0, 0, true),
  'ankle-wall': ankleWall,
  'band-press': bandPress,
} satisfies Record<string, () => Template>;

export type TemplateKey = keyof typeof TEMPLATES;

/** Ejercicios de la biblioteca → plantilla. Cada uno tiene una asignación explícita. */
export const EXERCISE_TEMPLATE: Record<string, TemplateKey> = {
  'press-banca': 'bench-bar',
  'press-inclinado-barra': 'incline-bar',
  'press-declinado-barra': 'decline-bar',
  'press-banca-mancuernas': 'bench-db',
  'press-inclinado-mancuernas': 'incline-db',
  'aperturas-mancuernas': 'fly-db',
  'cruce-poleas': 'cable-cross',
  'press-pecho-maquina': 'chest-press-machine',
  'pec-deck': 'pec-deck',
  flexiones: 'pushup',
  'fondos-pecho': 'dip',
  'fondos-lastrados': 'dip-weighted',
  'fondos-asistidos': 'dip-assisted',
  'peso-muerto': 'deadlift',
  dominadas: 'pullup',
  'dominadas-lastradas': 'pullup-weighted',
  'dominadas-asistidas': 'pullup-assisted',
  'chin-ups': 'pullup',
  'jalon-pecho': 'lat-pulldown',
  'jalon-agarre-cerrado': 'lat-pulldown',
  'remo-barra': 'row-bar',
  'remo-mancuerna': 'row-db-one',
  'remo-polea-baja': 'row-cable',
  'remo-maquina': 'row-machine',
  'remo-t': 'row-landmine',
  'pullover-polea': 'pullover-cable',
  'face-pull': 'face-pull',
  hiperextensiones: 'back-extension',
  encogimientos: 'shrug',
  'press-militar': 'ohp-bar',
  'press-hombro-mancuernas': 'ohp-db',
  'press-arnold': 'ohp-db',
  'press-hombro-maquina': 'ohp-machine',
  'elevaciones-laterales': 'lateral-db',
  'elevaciones-laterales-polea': 'lateral-cable',
  'elevaciones-frontales': 'front-raise',
  pajaros: 'rear-fly',
  'reverse-pec-deck': 'reverse-pec-deck',
  'remo-al-menton': 'upright-row',
  'pino-flexiones': 'handstand-pushup',
  'curl-barra': 'curl-bar',
  'curl-barra-z': 'curl-ez',
  'curl-mancuernas': 'curl-db',
  'curl-martillo': 'curl-db',
  'curl-inclinado': 'curl-incline',
  'curl-predicador': 'curl-preacher',
  'curl-polea': 'curl-cable',
  'curl-concentrado': 'curl-concentration',
  'press-cerrado': 'bench-bar',
  'extension-polea': 'pushdown-bar',
  'extension-cuerda': 'pushdown-rope',
  'press-frances': 'skullcrusher',
  'extension-sobre-cabeza': 'overhead-ext',
  'patada-triceps': 'kickback',
  'fondos-banco': 'bench-dip',
  'curl-muneca': 'wrist-curl',
  'curl-muneca-inverso': 'wrist-curl',
  'paseo-granjero': 'farmer',
  'colgado-barra': 'dead-hang',
  sentadilla: 'squat-back',
  'sentadilla-frontal': 'squat-front',
  'sentadilla-goblet': 'squat-goblet',
  'sentadilla-hack': 'hack-squat',
  prensa: 'leg-press',
  'extension-cuadriceps': 'leg-extension',
  zancadas: 'lunge',
  bulgara: 'bulgarian',
  'step-up': 'step-up',
  'sentadilla-peso-corporal': 'squat-bw',
  'sissy-squat': 'sissy',
  'peso-muerto-rumano': 'rdl-bar',
  'peso-muerto-rumano-mancuernas': 'rdl-db',
  'peso-muerto-una-pierna': 'rdl-single',
  'curl-femoral-tumbado': 'leg-curl-lying',
  'curl-femoral-sentado': 'leg-curl-seated',
  'buenos-dias': 'good-morning',
  'nordic-curl': 'nordic',
  'hip-thrust': 'hip-thrust',
  'puente-gluteo': 'glute-bridge',
  'patada-gluteo-polea': 'cable-kickback',
  'abduccion-maquina': 'abduction',
  'aduccion-maquina': 'adduction',
  'peso-muerto-sumo': 'deadlift-sumo',
  'monster-walk': 'monster-walk',
  'gemelo-de-pie': 'calf-machine',
  'gemelo-sentado': 'calf-seated',
  'gemelo-prensa': 'leg-press-calf',
  'gemelo-peso-corporal': 'calf-single',
  plancha: 'plank',
  'plancha-lateral': 'side-plank',
  crunch: 'crunch',
  'crunch-polea': 'cable-crunch',
  'elevacion-piernas': 'hanging-leg-raise',
  'rueda-abdominal': 'ab-wheel',
  'russian-twist': 'russian-twist',
  pallof: 'pallof',
  'dead-bug': 'dead-bug',
  cargada: 'clean',
  arrancada: 'snatch',
  thruster: 'thruster',
  'kettlebell-swing': 'kb-swing',
  burpees: 'burpee',
  'turkish-getup': 'get-up',
  correr: 'run',
  cinta: 'treadmill',
  bicicleta: 'bike',
  'remo-ergometro': 'rower',
  eliptica: 'elliptical',
  comba: 'jump-rope',
  caminar: 'walk',
  escaladora: 'stair',
  'movilidad-cadera': 'hip-90-90',
  'estiramiento-isquios': 'hamstring-stretch',
  'dislocaciones-banda': 'band-dislocate',
  'gato-camello': 'cat-cow',
  'rotacion-toracica': 'thoracic-rotation',
  'tobillo-pared': 'ankle-wall',
  'remo-banda': 'row-band',
  'press-banda': 'band-press',
  'curl-banda': 'curl-band',
};
