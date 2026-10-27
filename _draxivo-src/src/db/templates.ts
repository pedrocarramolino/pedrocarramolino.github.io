// Plantillas incluidas. No se guardan en la base de datos hasta que el usuario las usa.
import type { Routine } from './types';
import { emptyRoutine, newPlannedSet } from './repo';
import { uid } from '../lib/id';

interface Tpl {
  id: string;
  name: string;
  description: string;
  category: string;
  goal: string;
  items: [exerciseId: string, sets: number, repsMin: number, repsMax: number, restSec: number][];
}

export const BUILTIN_TEMPLATES: Tpl[] = [
  {
    id: 'tpl-fullbody-a',
    name: 'Cuerpo completo A',
    description: 'Sesión equilibrada de cuerpo completo con básicos.',
    category: 'Cuerpo completo',
    goal: 'Fuerza',
    items: [
      ['ex-sentadilla', 3, 5, 8, 150],
      ['ex-press-banca', 3, 5, 8, 150],
      ['ex-remo-barra', 3, 6, 10, 120],
      ['ex-press-hombro-mancuernas', 2, 8, 12, 90],
      ['ex-plancha', 2, 0, 0, 60],
    ],
  },
  {
    id: 'tpl-torso',
    name: 'Torso',
    description: 'Pecho, espalda, hombros y brazos.',
    category: 'Torso',
    goal: 'Hipertrofia',
    items: [
      ['ex-press-inclinado-mancuernas', 3, 8, 12, 120],
      ['ex-jalon-pecho', 3, 8, 12, 120],
      ['ex-remo-polea-baja', 3, 10, 12, 90],
      ['ex-elevaciones-laterales', 3, 12, 15, 60],
      ['ex-curl-mancuernas', 2, 10, 12, 60],
      ['ex-extension-cuerda', 2, 10, 12, 60],
    ],
  },
  {
    id: 'tpl-pierna',
    name: 'Pierna',
    description: 'Cuádriceps, isquiotibiales, glúteos y gemelos.',
    category: 'Pierna',
    goal: 'Hipertrofia',
    items: [
      ['ex-sentadilla', 3, 6, 10, 150],
      ['ex-peso-muerto-rumano', 3, 8, 10, 120],
      ['ex-prensa', 3, 10, 12, 120],
      ['ex-curl-femoral-tumbado', 3, 10, 12, 90],
      ['ex-gemelo-de-pie', 3, 10, 15, 60],
    ],
  },
  {
    id: 'tpl-empuje',
    name: 'Empuje',
    description: 'Pecho, hombros y tríceps.',
    category: 'Empuje',
    goal: 'Hipertrofia',
    items: [
      ['ex-press-banca', 3, 6, 10, 150],
      ['ex-press-militar', 3, 6, 10, 120],
      ['ex-aperturas-mancuernas', 3, 10, 15, 90],
      ['ex-elevaciones-laterales', 3, 12, 15, 60],
      ['ex-extension-polea', 3, 10, 12, 60],
    ],
  },
  {
    id: 'tpl-tiron',
    name: 'Tirón',
    description: 'Espalda y bíceps.',
    category: 'Tirón',
    goal: 'Hipertrofia',
    items: [
      ['ex-dominadas', 3, 5, 10, 150],
      ['ex-remo-barra', 3, 6, 10, 120],
      ['ex-jalon-agarre-cerrado', 3, 10, 12, 90],
      ['ex-face-pull', 3, 12, 15, 60],
      ['ex-curl-barra', 3, 8, 12, 60],
    ],
  },
];

export function routineFromTemplate(t: Tpl, timedIds: Set<string>): Routine {
  return emptyRoutine({
    name: t.name,
    description: t.description,
    category: t.category,
    goal: t.goal,
    exercises: t.items.map(([exerciseId, sets, repsMin, repsMax, restSec]) => ({
      id: uid(),
      exerciseId,
      restSec,
      notes: '',
      supersetId: null,
      effort: 'none',
      sets: Array.from({ length: sets }, () =>
        timedIds.has(exerciseId) ? newPlannedSet({ repsMin: null, repsMax: null, durationSec: 45 }) : newPlannedSet({ repsMin, repsMax }),
      ),
    })),
  });
}
