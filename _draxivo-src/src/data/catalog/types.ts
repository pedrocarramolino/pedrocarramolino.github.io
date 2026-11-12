// Tipos del catálogo de ejercicios: datos estructurados que alimentan la biblioteca,
// las fichas de detalle, el selector y el generador de rutinas.
import type { Equipment, MovementType, MuscleGroup, TrackingType } from '../../db/types';
import type { TemplateKey } from '../../ui/figures/templates';

export type Level = 'principiante' | 'intermedio' | 'avanzado';
export type Role = 'main' | 'sec' | 'acc';

/** Patrón de movimiento: agrupa ejercicios equivalentes y aporta consejos comunes. */
export type Pattern =
  | 'press-h'
  | 'pushup'
  | 'fly'
  | 'dip'
  | 'pullover'
  | 'pull-v'
  | 'row'
  | 'hinge'
  | 'back-ext'
  | 'shrug'
  | 'press-v'
  | 'lateral'
  | 'front-raise'
  | 'rear'
  | 'curl'
  | 'tri-ext'
  | 'wrist'
  | 'carry'
  | 'hang'
  | 'squat'
  | 'lunge'
  | 'leg-machine'
  | 'leg-curl'
  | 'thrust'
  | 'abduct'
  | 'calf'
  | 'core-stab'
  | 'core-flex'
  | 'core-rot'
  | 'power'
  | 'plyo'
  | 'cardio'
  | 'mobility';

export interface CatalogEntry {
  /** Identificador estable (sin el prefijo «ex-»). Nunca cambia: lo usan rutinas e historial. */
  id: string;
  name: string;
  primary: MuscleGroup;
  secondary: MuscleGroup[];
  equipment: Equipment;
  movement: MovementType;
  tracking: TrackingType;
  level: Level;
  pattern: Pattern;
  /** Ilustración local (plantilla SVG). */
  art: TemplateKey;
  /** Pasos breves en orden. */
  steps: string[];
  /** Consejos de seguridad propios (se suman a los del patrón). */
  tips: string[];
  /** Errores frecuentes propios (se suman a los del patrón). */
  mistakes: string[];
  /** Sustituciones explícitas (identificadores); se completan con el mismo patrón. */
  alt: string[];
  /** Otros nombres para la búsqueda (inglés, nombres populares…). */
  aka: string[];
  /** Papel en el generador de rutinas. */
  role: Role;
  /** Necesita instalación de gimnasio aunque sea con peso corporal (barra, paralelas…). */
  gym: boolean;
  /** Se puede hacer en casa con poco material. */
  home: boolean;
}

export interface EntryOpts {
  tips?: string[];
  mistakes?: string[];
  alt?: string[];
  aka?: string[];
  role?: Role;
  gym?: boolean;
  home?: boolean;
}

const HOME_EQUIP = new Set<Equipment>(['peso_corporal', 'banda', 'mancuernas', 'kettlebell']);

/** Crea una entrada con valores por defecto coherentes. */
export function x(
  id: string,
  name: string,
  primary: MuscleGroup,
  secondary: string,
  equipment: Equipment,
  movement: MovementType,
  tracking: TrackingType,
  level: Level,
  pattern: Pattern,
  art: TemplateKey,
  steps: string[],
  o: EntryOpts = {},
): CatalogEntry {
  const gym = o.gym ?? false;
  return {
    id,
    name,
    primary,
    secondary: (secondary ? secondary.split(' ') : []) as MuscleGroup[],
    equipment,
    movement,
    tracking,
    level,
    pattern,
    art,
    steps,
    tips: o.tips ?? [],
    mistakes: o.mistakes ?? [],
    alt: o.alt ?? [],
    aka: o.aka ?? [],
    role: o.role ?? (movement === 'compuesto' ? 'sec' : 'acc'),
    gym,
    home: o.home ?? (HOME_EQUIP.has(equipment) && !gym),
  };
}

export const W: TrackingType = 'weight_reps';
export const BW: TrackingType = 'bodyweight_reps';
export const T: TrackingType = 'duration';
export const DD: TrackingType = 'distance_duration';
