// Generador de rutinas local: interpreta una petición en lenguaje natural (músculos, tiempo,
// material y nivel) y construye una rutina con reglas explícitas y la biblioteca de ejercicios.
// No usa ningún servicio externo. La interfaz `RoutineGenerator` permite añadir en el futuro
// un generador basado en un modelo sin cambiar las pantallas.
import type { Equipment, Exercise, MuscleGroup, PlannedSet, Routine } from '../db/types';
import { emptyRoutine, newPlannedSet } from '../db/repo';
import { uid } from '../lib/id';
import { MUSCLES } from '../lib/labels';

export type Level = 'principiante' | 'intermedio' | 'avanzado';
export type EquipKey = 'gym' | 'mancuernas' | 'barra' | 'maquinas' | 'bandas' | 'peso_corporal';
export type Role = 'main' | 'sec' | 'acc';

export const EQUIP_OPTIONS: { value: EquipKey; label: string }[] = [
  { value: 'gym', label: 'Gimnasio completo' },
  { value: 'mancuernas', label: 'Mancuernas' },
  { value: 'barra', label: 'Barra' },
  { value: 'maquinas', label: 'Máquinas y poleas' },
  { value: 'bandas', label: 'Bandas elásticas' },
  { value: 'peso_corporal', label: 'Peso corporal' },
];

export const DURATIONS = [15, 20, 30, 45, 60, 75, 90];

/** Grupos que se pueden pedir en el generador (incluye cuerpo completo). */
export const GEN_MUSCLES: MuscleGroup[] = ['pecho', 'espalda', 'hombros', 'biceps', 'triceps', 'antebrazos', 'cuadriceps', 'isquios', 'gluteos', 'gemelos', 'abdominales', 'cuerpo_completo'];

export interface RoutineRequest {
  muscles: MuscleGroup[];
  minutes: number;
  equipment: EquipKey[];
  level: Level;
  /** Semilla para obtener variantes distintas al regenerar. */
  seed?: number;
}

export interface PlanItem {
  key: string;
  exerciseId: string;
  role: Role;
  sets: number;
  warmupSets: number;
  repsMin: number | null;
  repsMax: number | null;
  durationSec: number | null;
  restSec: number;
  reason: string;
  /** Músculo de la petición al que se asignó el ejercicio. */
  target: MuscleGroup;
  alternatives: string[];
}

export interface GeneratedPlan {
  request: RoutineRequest;
  items: PlanItem[];
  notes: string[];
  generator: string;
}

export interface RoutineGenerator {
  id: string;
  label: string;
  description: string;
  generate(req: RoutineRequest, exercises: Exercise[]): Promise<GeneratedPlan>;
}

// ---------- Interpretación del texto ----------
export function normalizeText(s: string) {
  return s
    .toLocaleLowerCase('es')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

const MUSCLE_PATTERNS: [RegExp, MuscleGroup[]][] = [
  [/\b(cuerpo completo|todo el cuerpo|full ?body|fullbody)\b/, ['cuerpo_completo']],
  [/\b(piernas?|tren inferior|lower)\b/, ['cuadriceps', 'isquios', 'gluteos', 'gemelos']],
  [/\b(brazos?)\b/, ['biceps', 'triceps']],
  [/\b(torso|tren superior|upper)\b/, ['pecho', 'espalda', 'hombros']],
  [/\b(empuje|push)\b/, ['pecho', 'hombros', 'triceps']],
  [/\b(tiron|pull)\b/, ['espalda', 'biceps']],
  [/\b(pechos?|pectorales?)\b/, ['pecho']],
  [/\b(espaldas?|dorsal(es)?|dorsales)\b/, ['espalda']],
  [/\b(hombros?|deltoides?)\b/, ['hombros']],
  [/\b(biceps?|bicep)\b/, ['biceps']],
  [/\b(triceps?|tricep)\b/, ['triceps']],
  [/\b(antebrazos?|agarre)\b/, ['antebrazos']],
  [/\b(cuadriceps?|cuadris?|quads?)\b/, ['cuadriceps']],
  [/\b(isquios?|isquiotibiales?|femorales?)\b/, ['isquios']],
  [/\b(gluteos?|culo|glutes?)\b/, ['gluteos']],
  [/\b(gemelos?|pantorrillas?|soleo)\b/, ['gemelos']],
  [/\b(abdominales?|abdomen|abs|core|abdos?)\b/, ['abdominales']],
];

export interface ParsedRequest {
  muscles: MuscleGroup[];
  minutes: number | null;
  equipment: EquipKey[];
  level: Level | null;
}

export function parseRequest(text: string): ParsedRequest {
  const t = normalizeText(text);
  const muscles: MuscleGroup[] = [];
  for (const [re, ms] of MUSCLE_PATTERNS) if (re.test(t)) for (const m of ms) if (!muscles.includes(m)) muscles.push(m);

  let minutes: number | null = null;
  const m1 = /(\d{1,3})\s*(?:min|mins|minutos?|m\b|')/.exec(t);
  const h1 = /(\d(?:[.,]\d+)?)\s*(?:h|horas?)\b/.exec(t);
  if (/hora y media/.test(t)) minutes = 90;
  else if (/tres cuartos de hora/.test(t)) minutes = 45;
  else if (/media hora/.test(t)) minutes = 30;
  else if (/\buna hora\b/.test(t)) minutes = 60;
  else if (/\bdos horas\b/.test(t)) minutes = 120;
  if (m1) minutes = Number(m1[1]);
  else if (h1 && minutes == null) minutes = Math.round(Number(h1[1].replace(',', '.')) * 60);
  else if (minutes == null) {
    const bare = /\b(\d{2,3})\b/.exec(t);
    if (bare && +bare[1] >= 10 && +bare[1] <= 180) minutes = +bare[1];
  }
  if (minutes != null) minutes = Math.max(10, Math.min(150, minutes));

  const equipment: EquipKey[] = [];
  if (/\b(gimnasio|gym)\b/.test(t)) equipment.push('gym');
  if (/mancuerna/.test(t)) equipment.push('mancuernas');
  if (/\bbarras?\b/.test(t) && !/barra de dominadas/.test(t)) equipment.push('barra');
  if (/maquina|polea/.test(t)) equipment.push('maquinas');
  if (/\b(bandas?|gomas?|elasticos?)\b/.test(t)) equipment.push('bandas');
  if (/peso corporal|sin material|sin pesas|calistenia|en casa/.test(t)) equipment.push('peso_corporal');

  let level: Level | null = null;
  if (/principiante|novato|empezando|empiezo/.test(t)) level = 'principiante';
  else if (/avanzad/.test(t)) level = 'avanzado';
  else if (/intermedi/.test(t)) level = 'intermedio';

  return { muscles, minutes, equipment, level };
}

// ---------- Metadatos de selección por ejercicio ----------
// [papel, dificultad técnica 1-3, patrón de movimiento, requiere instalación de gimnasio]
type Meta = [Role, 1 | 2 | 3, string, boolean?];
const META: Record<string, Meta> = {
  'press-banca': ['main', 2, 'press-h'],
  'press-inclinado-barra': ['main', 2, 'press-inc'],
  'press-declinado-barra': ['sec', 2, 'press-dec'],
  'press-banca-mancuernas': ['main', 1, 'press-h'],
  'press-inclinado-mancuernas': ['main', 1, 'press-inc'],
  'aperturas-mancuernas': ['acc', 1, 'fly'],
  'cruce-poleas': ['acc', 1, 'fly'],
  'press-pecho-maquina': ['sec', 1, 'press-h'],
  'pec-deck': ['acc', 1, 'fly'],
  flexiones: ['sec', 1, 'press-h'],
  'fondos-pecho': ['sec', 2, 'dip', true],
  'fondos-lastrados': ['main', 3, 'dip', true],
  'fondos-asistidos': ['sec', 1, 'dip', true],
  'press-banda': ['sec', 1, 'press-h'],
  'peso-muerto': ['main', 3, 'hinge'],
  dominadas: ['main', 2, 'pull-v', true],
  'dominadas-lastradas': ['main', 3, 'pull-v', true],
  'dominadas-asistidas': ['main', 1, 'pull-v', true],
  'chin-ups': ['main', 2, 'pull-v', true],
  'jalon-pecho': ['main', 1, 'pull-v'],
  'jalon-agarre-cerrado': ['sec', 1, 'pull-v'],
  'remo-barra': ['main', 2, 'row'],
  'remo-mancuerna': ['main', 1, 'row'],
  'remo-polea-baja': ['sec', 1, 'row'],
  'remo-maquina': ['sec', 1, 'row'],
  'remo-t': ['sec', 2, 'row'],
  'remo-banda': ['sec', 1, 'row'],
  'pullover-polea': ['acc', 1, 'pullover'],
  'face-pull': ['acc', 1, 'rear'],
  hiperextensiones: ['acc', 1, 'back-ext', true],
  encogimientos: ['acc', 1, 'shrug'],
  'press-militar': ['main', 2, 'press-v'],
  'press-hombro-mancuernas': ['main', 1, 'press-v'],
  'press-arnold': ['sec', 2, 'press-v'],
  'press-hombro-maquina': ['sec', 1, 'press-v'],
  'elevaciones-laterales': ['acc', 1, 'lateral'],
  'elevaciones-laterales-polea': ['acc', 1, 'lateral'],
  'elevaciones-frontales': ['acc', 1, 'front-raise'],
  pajaros: ['acc', 1, 'rear'],
  'reverse-pec-deck': ['acc', 1, 'rear'],
  'remo-al-menton': ['sec', 2, 'upright-row'],
  'pino-flexiones': ['sec', 3, 'press-v'],
  'curl-barra': ['sec', 1, 'curl'],
  'curl-barra-z': ['sec', 1, 'curl'],
  'curl-mancuernas': ['sec', 1, 'curl'],
  'curl-martillo': ['acc', 1, 'hammer'],
  'curl-inclinado': ['acc', 1, 'curl-inc'],
  'curl-predicador': ['acc', 1, 'curl-pre'],
  'curl-polea': ['acc', 1, 'curl-cable'],
  'curl-concentrado': ['acc', 1, 'curl-pre'],
  'curl-banda': ['acc', 1, 'curl-cable'],
  'press-cerrado': ['main', 2, 'press-cg'],
  'extension-polea': ['sec', 1, 'pushdown'],
  'extension-cuerda': ['sec', 1, 'pushdown'],
  'press-frances': ['sec', 2, 'skull'],
  'extension-sobre-cabeza': ['acc', 1, 'overhead-ext'],
  'patada-triceps': ['acc', 1, 'kickback'],
  'fondos-banco': ['sec', 1, 'dip-bench'],
  'curl-muneca': ['acc', 1, 'wrist'],
  'curl-muneca-inverso': ['acc', 1, 'wrist-rev'],
  'paseo-granjero': ['sec', 1, 'carry'],
  'colgado-barra': ['acc', 1, 'hang', true],
  sentadilla: ['main', 2, 'squat'],
  'sentadilla-frontal': ['main', 3, 'squat'],
  'sentadilla-goblet': ['main', 1, 'squat'],
  'sentadilla-hack': ['main', 1, 'squat-m'],
  prensa: ['main', 1, 'leg-press'],
  'extension-cuadriceps': ['acc', 1, 'leg-ext'],
  zancadas: ['sec', 1, 'lunge'],
  bulgara: ['sec', 2, 'split'],
  'step-up': ['sec', 1, 'step'],
  'sentadilla-peso-corporal': ['sec', 1, 'squat'],
  'sissy-squat': ['acc', 2, 'leg-ext'],
  'aduccion-maquina': ['acc', 1, 'adduct'],
  'peso-muerto-rumano': ['main', 2, 'hinge'],
  'peso-muerto-rumano-mancuernas': ['main', 1, 'hinge'],
  'curl-femoral-tumbado': ['sec', 1, 'leg-curl'],
  'curl-femoral-sentado': ['sec', 1, 'leg-curl'],
  'buenos-dias': ['sec', 3, 'hinge'],
  'nordic-curl': ['acc', 3, 'leg-curl', true],
  'hip-thrust': ['main', 1, 'thrust'],
  'puente-gluteo': ['sec', 1, 'thrust'],
  'patada-gluteo-polea': ['acc', 1, 'glute-kick'],
  'abduccion-maquina': ['acc', 1, 'abduct'],
  'peso-muerto-sumo': ['main', 3, 'hinge'],
  'monster-walk': ['acc', 1, 'abduct'],
  'gemelo-de-pie': ['sec', 1, 'calf'],
  'gemelo-sentado': ['sec', 1, 'calf-seated'],
  'gemelo-prensa': ['sec', 1, 'calf'],
  plancha: ['sec', 1, 'plank'],
  'plancha-lateral': ['acc', 1, 'side-plank'],
  crunch: ['acc', 1, 'crunch'],
  'crunch-polea': ['sec', 1, 'crunch'],
  'elevacion-piernas': ['sec', 2, 'leg-raise', true],
  'rueda-abdominal': ['sec', 2, 'rollout'],
  'russian-twist': ['acc', 1, 'twist'],
  pallof: ['acc', 1, 'anti-rotation'],
  'dead-bug': ['acc', 1, 'dead-bug'],
  cargada: ['main', 3, 'olympic'],
  arrancada: ['main', 3, 'olympic'],
  thruster: ['main', 2, 'thruster'],
  'kettlebell-swing': ['sec', 2, 'swing'],
  burpees: ['sec', 1, 'burpee'],
  'turkish-getup': ['sec', 3, 'getup'],
  'gemelo-peso-corporal': ['sec', 1, 'calf'],
  'peso-muerto-una-pierna': ['sec', 1, 'hinge-uni'],
};

function metaOf(ex: Exercise): Meta {
  const m = META[ex.id.replace(/^ex-/, '')];
  if (m) return m;
  // Ejercicios personalizados: se deduce el papel por el tipo de movimiento.
  return [ex.movement === 'compuesto' ? 'sec' : 'acc', 1, `custom-${ex.id}`];
}

const LEVEL_MAX: Record<Level, number> = { principiante: 1, intermedio: 2, avanzado: 3 };
/** Orden: músculos grandes primero, aislados al final. */
const ORDER: MuscleGroup[] = ['cuadriceps', 'gluteos', 'isquios', 'espalda', 'pecho', 'hombros', 'triceps', 'biceps', 'gemelos', 'antebrazos', 'abdominales'];
const SMALL = new Set<MuscleGroup>(['biceps', 'triceps', 'gemelos', 'antebrazos', 'abdominales']);
const FULL_BODY: MuscleGroup[] = ['cuadriceps', 'espalda', 'pecho', 'isquios', 'hombros', 'abdominales'];

function equipAllowed(ex: Exercise, sel: EquipKey[]): 'yes' | 'fallback' | 'no' {
  const gym = sel.length === 0 || sel.includes('gym');
  const [, , , needsGym] = metaOf(ex);
  if (gym) return 'yes';
  const e: Equipment = ex.equipment;
  if (sel.includes('mancuernas') && e === 'mancuernas') return 'yes';
  if (sel.includes('barra') && e === 'barra') return 'yes';
  if (sel.includes('maquinas') && (e === 'maquina' || e === 'polea')) return 'yes';
  if (sel.includes('bandas') && e === 'banda') return 'yes';
  if (e === 'peso_corporal' && !needsGym) return sel.includes('peso_corporal') ? 'yes' : 'fallback';
  return 'no';
}

// Pseudoaleatorio determinista para variar al regenerar.
function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) % 10000) / 10000;
  };
}

// ---------- Prescripción y tiempo ----------
function prescribe(ex: Exercise, role: Role, level: Level, compact: boolean) {
  const timed = ex.tracking === 'duration' || ex.tracking === 'distance_duration';
  let sets = role === 'main' ? (level === 'avanzado' ? 4 : 3) : role === 'sec' ? 3 : level === 'principiante' ? 2 : 3;
  let rest = role === 'main' ? (level === 'principiante' ? 105 : level === 'avanzado' ? 150 : 120) : role === 'sec' ? 90 : 60;
  let repsMin: number | null = role === 'main' ? (level === 'principiante' ? 8 : 6) : role === 'sec' ? 8 : 10;
  let repsMax: number | null = role === 'main' ? (level === 'principiante' ? 12 : 10) : role === 'sec' ? 12 : 15;
  let durationSec: number | null = null;
  if (ex.tracking === 'bodyweight_reps' || ex.tracking === 'assisted_bodyweight') {
    repsMin = Math.max(repsMin, 8);
    repsMax = Math.max(repsMax, 15);
  }
  if (timed) {
    repsMin = repsMax = null;
    durationSec = level === 'principiante' ? 30 : 45;
    rest = 45;
  }
  if (ex.primaryMuscle === 'abdominales' && !timed) {
    repsMin = 12;
    repsMax = 20;
    rest = Math.min(rest, 60);
  }
  if (compact) {
    sets = Math.min(sets, 2);
    rest = Math.min(rest, 60);
  }
  return { sets, rest, repsMin, repsMax, durationSec };
}

/** Segundos de trabajo estimados por serie. */
function workSeconds(i: Pick<PlanItem, 'repsMin' | 'repsMax' | 'durationSec'>) {
  if (i.durationSec) return i.durationSec + 10;
  const reps = ((i.repsMin ?? 10) + (i.repsMax ?? i.repsMin ?? 10)) / 2;
  return Math.round(reps * 3 + 10);
}

export const TRANSITION_SEC = 75;
export const WARMUP_SET_SEC = 75;

/** Duración estimada: series × (trabajo + descanso) + transición entre ejercicios. */
export function estimateItemSeconds(i: Pick<PlanItem, 'sets' | 'warmupSets' | 'repsMin' | 'repsMax' | 'durationSec' | 'restSec'>) {
  return i.sets * workSeconds(i) + Math.max(0, i.sets - 1) * i.restSec + i.warmupSets * WARMUP_SET_SEC + TRANSITION_SEC;
}

export function estimatePlanMinutes(items: Parameters<typeof estimateItemSeconds>[0][]) {
  // Tras la última serie de cada ejercicio también se descansa antes del siguiente (incluido en la transición).
  return Math.round(items.reduce((s, i) => s + estimateItemSeconds(i), 0) / 60);
}

export function setsByMuscle(items: PlanItem[], exMap: Map<string, Exercise>) {
  const out = new Map<MuscleGroup, number>();
  for (const i of items) {
    const m = exMap.get(i.exerciseId)?.primaryMuscle ?? i.target;
    out.set(m, (out.get(m) ?? 0) + i.sets);
  }
  return out;
}

function reasonFor(role: Role, ex: Exercise, target: MuscleGroup, fallback: boolean) {
  const m = MUSCLES[target].toLowerCase();
  const base = role === 'main' ? `Ejercicio principal de ${m}: más carga y menos repeticiones.` : role === 'sec' ? `Complementario para ${m} con otro ángulo o equipamiento.` : `Accesorio de aislamiento para ${m}.`;
  return fallback ? `${base} Alternativa con ${ex.equipment === 'peso_corporal' ? 'peso corporal' : 'otro material'} por falta de opciones con el material elegido.` : base;
}

// ---------- Generación ----------
export function generatePlan(req: RoutineRequest, exercises: Exercise[]): GeneratedPlan {
  const rand = rng(req.seed ?? 1);
  const notes: string[] = [];
  const levelMax = LEVEL_MAX[req.level];
  const targetSec = req.minutes * 60;
  const compact = req.minutes <= 25;

  let muscles: MuscleGroup[] = req.muscles.filter((m) => m !== 'cardio' && m !== 'movilidad');
  if (muscles.includes('cuerpo_completo')) muscles = [...new Set([...FULL_BODY, ...muscles.filter((m) => m !== 'cuerpo_completo')])];
  muscles = ORDER.filter((m) => muscles.includes(m));
  if (!muscles.length) return { request: req, items: [], notes: ['Indica al menos un grupo muscular.'], generator: 'local' };

  const usable = exercises.filter((e) => !e.archived && e.primaryMuscle !== 'cardio' && e.primaryMuscle !== 'movilidad');
  type Cand = { ex: Exercise; meta: Meta; fit: 'yes' | 'fallback'; jitter: number };
  const pools = new Map<MuscleGroup, Cand[]>();
  for (const m of muscles) {
    const list: Cand[] = [];
    for (const ex of usable) {
      if (ex.primaryMuscle !== m) continue;
      const fit = equipAllowed(ex, req.equipment);
      if (fit === 'no') continue;
      const meta = metaOf(ex);
      if (meta[1] > levelMax) continue;
      list.push({ ex, meta, fit, jitter: rand() });
    }
    pools.set(m, list);
  }

  const items: PlanItem[] = [];
  const used = new Set<string>();
  const patternsUsed = new Map<MuscleGroup, Set<string>>();
  const countFor = (m: MuscleGroup) => items.filter((i) => i.target === m).length;
  const total = (list: PlanItem[]) => list.reduce((s, i) => s + estimateItemSeconds(i), 0);
  const maxPer = (m: MuscleGroup) => (SMALL.has(m) ? 3 : 4);
  const rolePref: Role[][] = [
    ['main', 'sec', 'acc'],
    ['sec', 'acc', 'main'],
    ['acc', 'sec', 'main'],
    ['acc', 'sec', 'main'],
  ];

  const pick = (m: MuscleGroup, round: number): Cand | null => {
    const pats = patternsUsed.get(m) ?? new Set<string>();
    const lastEquip = items.filter((i) => i.target === m).map((i) => usable.find((e) => e.id === i.exerciseId)?.equipment);
    const pref = rolePref[Math.min(round, rolePref.length - 1)];
    const cands = (pools.get(m) ?? []).filter((c) => !used.has(c.ex.id));
    if (!cands.length) return null;
    const score = (c: Cand) =>
      pref.indexOf(c.meta[0]) * 10 + // papel adecuado a la ronda
      (pats.has(c.meta[2]) ? 25 : 0) + // evita repetir el mismo patrón de movimiento
      (c.fit === 'fallback' ? 15 : 0) + // prioriza el material elegido
      (lastEquip.includes(c.ex.equipment) ? 3 : 0) + // variedad de material
      ((req.equipment.length === 0 || req.equipment.includes('gym')) && c.ex.equipment === 'banda' ? 8 : 0) + // en gimnasio, mejor carga real
      (req.level === 'principiante' ? c.meta[1] * 2 : 0) +
      c.jitter * 4;
    return cands.sort((a, b) => score(a) - score(b))[0];
  };

  const make = (c: Cand, m: MuscleGroup, isFirst: boolean, compactMode: boolean): PlanItem => {
    const role = c.meta[0];
    const p = prescribe(c.ex, role, req.level, compactMode);
    return {
      key: uid(),
      exerciseId: c.ex.id,
      role,
      sets: p.sets,
      warmupSets: isFirst && role === 'main' && req.minutes >= 30 && c.ex.tracking === 'weight_reps' ? 1 : 0,
      repsMin: p.repsMin,
      repsMax: p.repsMax,
      durationSec: p.durationSec,
      restSec: p.rest,
      reason: reasonFor(role, c.ex, m, c.fit === 'fallback'),
      target: m,
      alternatives: [],
    };
  };

  for (let round = 0; round < 4; round++) {
    let added = false;
    for (const m of muscles) {
      if (countFor(m) >= maxPer(m)) continue;
      if (round > 0 && muscles.length >= 5 && countFor(m) >= 1 && !SMALL.has(m) && round > 1) continue;
      const c = pick(m, round);
      if (!c) continue;
      let item = make(c, m, items.length === 0, compact);
      if (total([...items, item]) > targetSec * 1.04) {
        // En la primera ronda se intenta una versión reducida para cubrir todos los músculos pedidos.
        if (round === 0) {
          item = make(c, m, false, true);
          if (total([...items, item]) > targetSec * 1.08) continue;
        } else continue;
      }
      items.push(item);
      used.add(c.ex.id);
      patternsUsed.set(m, (patternsUsed.get(m) ?? new Set()).add(c.meta[2]));
      added = true;
    }
    if (!added) break;
  }

  // Si sobra tiempo, añade series a los ejercicios principales y secundarios (hasta 4-5).
  let grew = true;
  while (grew) {
    grew = false;
    for (const it of [...items].sort((a, b) => (a.role === 'main' ? 0 : a.role === 'sec' ? 1 : 2) - (b.role === 'main' ? 0 : b.role === 'sec' ? 1 : 2))) {
      const cap = it.role === 'main' ? (req.level === 'avanzado' ? 5 : 4) : 4;
      if (it.sets >= cap) continue;
      const extra = workSeconds(it) + it.restSec;
      if (total(items) + extra <= targetSec) {
        it.sets++;
        grew = true;
      }
    }
  }

  // Orden de ejecución: principales primero, después complementarios y accesorios.
  const rank: Record<Role, number> = { main: 0, sec: 1, acc: 2 };
  items.sort((a, b) => rank[a.role] - rank[b.role] || ORDER.indexOf(a.target) - ORDER.indexOf(b.target));
  items.forEach((it, i) => {
    if (i > 0 && it.warmupSets) it.warmupSets = 0;
  });
  const first = items[0];
  if (first && first.role === 'main' && req.minutes >= 30 && usable.find((e) => e.id === first.exerciseId)?.tracking === 'weight_reps' && total(items) + WARMUP_SET_SEC <= targetSec * 1.04) first.warmupSets = 1;

  // Alternativas equivalentes para cada ejercicio (mismo músculo, otro ejercicio permitido).
  for (const it of items) {
    const pool = pools.get(it.target) ?? [];
    const me = pool.find((c) => c.ex.id === it.exerciseId);
    it.alternatives = pool
      .filter((c) => c.ex.id !== it.exerciseId && !used.has(c.ex.id))
      .sort((a, b) => Number(b.meta[2] === me?.meta[2]) - Number(a.meta[2] === me?.meta[2]) || Number(b.meta[0] === it.role) - Number(a.meta[0] === it.role))
      .slice(0, 6)
      .map((c) => c.ex.id);
  }

  for (const m of muscles) {
    if (!countFor(m)) {
      const pool = pools.get(m) ?? [];
      notes.push(pool.length ? `No cabe un ejercicio de ${MUSCLES[m].toLowerCase()} en ${req.minutes} min. Amplía el tiempo o reduce los grupos.` : `No hay ejercicios de ${MUSCLES[m].toLowerCase()} con el material y nivel elegidos.`);
    }
  }
  if (items.some((i) => (pools.get(i.target) ?? []).find((c) => c.ex.id === i.exerciseId)?.fit === 'fallback')) {
    notes.push('Algunos ejercicios usan peso corporal porque no había suficientes opciones con el material elegido.');
  }
  return { request: req, items, notes, generator: 'local' };
}

export const localGenerator: RoutineGenerator = {
  id: 'local',
  label: 'Generador local',
  description: 'Reglas de entrenamiento y biblioteca de ejercicios del dispositivo. Funciona sin conexión y sin servicios externos.',
  generate: async (req, exercises) => generatePlan(req, exercises),
};

export function planTitle(req: RoutineRequest) {
  const names = req.muscles.map((m) => MUSCLES[m]);
  const joined = names.length > 1 ? `${names.slice(0, -1).join(', ')} y ${names[names.length - 1]}` : (names[0] ?? 'Rutina');
  return `${joined} · ${req.minutes} min`;
}

export function planToRoutine(plan: GeneratedPlan, exMap: Map<string, Exercise>, name: string): Routine {
  const req = plan.request;
  const legs = new Set<MuscleGroup>(['cuadriceps', 'isquios', 'gluteos', 'gemelos']);
  const upper = new Set<MuscleGroup>(['pecho', 'espalda', 'hombros', 'biceps', 'triceps', 'antebrazos']);
  const category = req.muscles.includes('cuerpo_completo') ? 'Cuerpo completo' : req.muscles.every((m) => legs.has(m)) ? 'Pierna' : req.muscles.every((m) => upper.has(m)) ? 'Torso' : 'Hipertrofia';
  const equip = req.equipment.length ? req.equipment.map((e) => EQUIP_OPTIONS.find((o) => o.value === e)?.label.toLowerCase()).join(', ') : 'gimnasio completo';
  return emptyRoutine({
    name,
    description: `Generada automáticamente para ${req.muscles.map((m) => MUSCLES[m].toLowerCase()).join(', ')} · ${req.minutes} min · ${equip} · nivel ${req.level}.`,
    goal: 'Hipertrofia',
    category,
    estimatedMin: estimatePlanMinutes(plan.items),
    exercises: plan.items
      .filter((i) => exMap.has(i.exerciseId))
      .map((i) => {
        const sets: PlannedSet[] = [];
        for (let w = 0; w < i.warmupSets; w++) sets.push(newPlannedSet({ type: 'warmup', repsMin: 10, repsMax: 12, durationSec: null }));
        for (let k = 0; k < i.sets; k++) sets.push(newPlannedSet({ repsMin: i.repsMin, repsMax: i.repsMax, durationSec: i.durationSec }));
        return { id: uid(), exerciseId: i.exerciseId, sets, restSec: i.restSec, notes: '', supersetId: null, effort: 'none' as const };
      }),
  });
}
