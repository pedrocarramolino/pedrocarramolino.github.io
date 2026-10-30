// Esqueleto 2D para las ilustraciones de ejercicios.
// Ángulos absolutos en grados: 0 = hacia abajo, 90 = hacia delante (derecha),
// 180 = hacia arriba, -90 = hacia atrás (izquierda). Lienzo de 120 × 90; suelo en y = 85.

export type V = [number, number];

export const L = { torso: 27, neckLen: 3, headR: 5.6, upper: 14, fore: 13, thigh: 18, shin: 17, foot: 7 } as const;
export const LF = { shoulderHalf: 9, hipHalf: 5.5 } as const;
export const GROUND = 84;

export const dir = (deg: number): V => [Math.sin((deg * Math.PI) / 180), Math.cos((deg * Math.PI) / 180)];
export const add = (p: V, d: V, k = 1): V => [p[0] + d[0] * k, p[1] + d[1] * k];
export const angleOf = (from: V, to: V) => (Math.atan2(to[0] - from[0], to[1] - from[1]) * 180) / Math.PI;
export const dist = (a: V, b: V) => Math.hypot(a[0] - b[0], a[1] - b[1]);
export const lerp = (a: V, b: V, t: number): V => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];

/** Cinemática inversa de dos segmentos. bend = 1 gira la articulación hacia ángulos mayores. */
export function ik(root: V, target: V, l1: number, l2: number, bend: 1 | -1): [V, V] {
  const d = Math.min(Math.max(dist(root, target), Math.abs(l1 - l2) + 0.01), l1 + l2 - 0.01);
  const base = angleOf(root, target);
  const a = (Math.acos((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d)) * 180) / Math.PI;
  const mid = add(root, dir(base + bend * a), l1);
  const end = add(mid, dir(angleOf(mid, target)), l2);
  return [mid, end];
}

/** Especificación de una extremidad: objetivo con IK, ángulos o puntos explícitos (escorzo). */
export type Limb = { to: V; bend?: 1 | -1 } | { ang: [number, number] } | { pts: [V, V] };

function limb(root: V, spec: Limb, l1: number, l2: number, defBend: 1 | -1): [V, V] {
  if ('pts' in spec) return spec.pts;
  if ('ang' in spec) {
    const m = add(root, dir(spec.ang[0]), l1);
    return [m, add(m, dir(spec.ang[1]), l2)];
  }
  return ik(root, spec.to, l1, l2, spec.bend ?? defBend);
}

export interface Joints {
  front: boolean;
  head: V;
  neck: V;
  shL: V;
  shR: V;
  hipL: V;
  hipR: V;
  hip: V;
  /** Brazo cercano (vista lateral) o izquierdo (vista frontal). */
  el: V;
  ha: V;
  el2: V;
  ha2: V;
  kn: V;
  an: V;
  to: V;
  kn2: V;
  an2: V;
  to2: V;
  /** Curvatura del tronco (positivo hacia el pecho). */
  arch: number;
}

export interface SidePose {
  hip: V;
  /** Ángulo del tronco de cadera a cuello (180 = vertical). */
  torso: number;
  /** Giro de la cabeza respecto al tronco. */
  head?: number;
  arm: Limb;
  arm2?: Limb;
  leg: Limb;
  leg2?: Limb;
  foot?: number;
  foot2?: number;
  toe?: V;
  toe2?: V;
  /** Curvatura de la espalda (positivo: arquea hacia el pecho). */
  arch?: number;
  /** Elevación de hombros (encogimientos). */
  shrug?: number;
}

export interface FrontPose {
  front: true;
  hip: V;
  torso?: number;
  armL: Limb;
  armR: Limb;
  legL: Limb;
  legR: Limb;
  /** Vista cenital o tumbado: pies sin apoyo. */
  noFeet?: boolean;
}

export type Pose = SidePose | FrontPose;

export function resolve(p: Pose): Joints {
  if ('front' in p) {
    const t = p.torso ?? 180;
    const up = dir(t);
    const side = dir(t - 90); // hacia la derecha cuando el tronco está vertical
    const neck = add(p.hip, up, L.torso);
    const head = add(neck, up, L.neckLen + L.headR);
    const shC = add(p.hip, up, L.torso - 3);
    const shL = add(shC, side, -LF.shoulderHalf);
    const shR = add(shC, side, LF.shoulderHalf);
    const hipL = add(p.hip, side, -LF.hipHalf);
    const hipR = add(p.hip, side, LF.hipHalf);
    const [el, ha] = limb(shL, p.armL, 13, 12, 1);
    const [el2, ha2] = limb(shR, p.armR, 13, 12, -1);
    const [kn, an] = limb(hipL, p.legL, L.thigh, L.shin, -1);
    const [kn2, an2] = limb(hipR, p.legR, L.thigh, L.shin, 1);
    const to: V = p.noFeet ? an : [an[0] - 3.5, an[1] + 1];
    const to2: V = p.noFeet ? an2 : [an2[0] + 3.5, an2[1] + 1];
    return { front: true, head, neck, shL, shR, hipL, hipR, hip: p.hip, el, ha, el2, ha2, kn, an, to, kn2, an2, to2, arch: 0 };
  }
  const up = dir(p.torso);
  const neck = add(p.hip, up, L.torso);
  const head = add(neck, dir(p.torso + (p.head ?? 0)), L.neckLen + L.headR);
  const sh = add(p.hip, up, L.torso - 3 + (p.shrug ?? 0));
  const [el, ha] = limb(sh, p.arm, L.upper, L.fore, -1);
  const [el2, ha2] = p.arm2 ? limb(sh, p.arm2, L.upper, L.fore, -1) : [el, ha];
  const [kn, an] = limb(p.hip, p.leg, L.thigh, L.shin, 1);
  const [kn2, an2] = p.leg2 ? limb(p.hip, p.leg2, L.thigh, L.shin, 1) : [kn, an];
  const shinA = angleOf(kn, an);
  const shinA2 = angleOf(kn2, an2);
  const to = p.toe ?? add(an, dir(p.foot ?? shinA + 90), L.foot);
  const to2 = p.toe2 ?? (p.leg2 || p.foot2 != null ? add(an2, dir(p.foot2 ?? shinA2 + 90), L.foot) : to);
  return { front: false, head, neck, shL: sh, shR: sh, hipL: p.hip, hipR: p.hip, hip: p.hip, el, ha, el2, ha2, kn, an, to, kn2, an2, to2, arch: p.arch ?? 0 };
}

/** Interpola dos posturas ya resueltas (para la animación). */
export function mix(a: Joints, b: Joints, t: number): Joints {
  const out = { front: a.front } as Joints;
  out.arch = a.arch + (b.arch - a.arch) * t;
  for (const k of Object.keys(a) as (keyof Joints)[]) {
    if (k === 'front' || k === 'arch') continue;
    (out as unknown as Record<string, V>)[k] = lerp(a[k] as V, b[k] as V, t);
  }
  return out;
}

/** Hombro para una cadera y un ángulo de tronco (ayuda al definir posturas). */
export const shoulderOf = (hip: V, torso: number): V => add(hip, dir(torso), L.torso - 3);
export const rel = (p: V, dx: number, dy: number): V => [p[0] + dx, p[1] + dy];
