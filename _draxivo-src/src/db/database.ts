import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type {
  BodyWeight,
  Exercise,
  Folder,
  Measurement,
  MetaEntry,
  PlanEntry,
  ProgressPhoto,
  Routine,
  Settings,
  WeekGoal,
  WeeklyReview,
  Workout,
} from './types';
import { LIBRARY_VERSION, seedExercises } from './seedExercises';

export const DB_NAME = 'draxivo';
/** Versión del esquema. Cada incremento debe añadir un paso en `migrate`. */
export const DB_VERSION = 1;

export interface DraxivoDB extends DBSchema {
  settings: { key: string; value: Settings };
  meta: { key: string; value: MetaEntry };
  exercises: { key: string; value: Exercise; indexes: { name: string } };
  folders: { key: string; value: Folder };
  routines: { key: string; value: Routine; indexes: { folderId: string } };
  workouts: { key: string; value: Workout; indexes: { status: string; date: string; routineId: string } };
  bodyweights: { key: string; value: BodyWeight; indexes: { date: string } };
  measurements: { key: string; value: Measurement; indexes: { date: string; type: string } };
  photos: { key: string; value: ProgressPhoto; indexes: { date: string } };
  plan: { key: string; value: PlanEntry; indexes: { date: string } };
  weekgoals: { key: string; value: WeekGoal };
  reviews: { key: string; value: WeeklyReview; indexes: { weekStart: string } };
}

export type StoreName =
  | 'settings'
  | 'meta'
  | 'exercises'
  | 'folders'
  | 'routines'
  | 'workouts'
  | 'bodyweights'
  | 'measurements'
  | 'photos'
  | 'plan'
  | 'weekgoals'
  | 'reviews';

export const DATA_STORES: StoreName[] = [
  'settings',
  'meta',
  'exercises',
  'folders',
  'routines',
  'workouts',
  'bodyweights',
  'measurements',
  'photos',
  'plan',
  'weekgoals',
  'reviews',
];

let dbPromise: Promise<IDBPDatabase<DraxivoDB>> | null = null;

export function getDB(): Promise<IDBPDatabase<DraxivoDB>> {
  if (!dbPromise) {
    dbPromise = openDB<DraxivoDB>(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion) {
        migrate(db, oldVersion);
      },
      blocked() {
        console.warn('DRAXIVO: hay otra pestaña con una versión anterior abierta.');
      },
      blocking() {
        // Otra pestaña necesita actualizar el esquema: cerramos para no bloquearla.
        dbPromise?.then((d) => d.close());
        dbPromise = null;
      },
    }).then(async (db) => {
      await ensureLibrary(db);
      return db;
    });
    dbPromise.catch(() => {
      dbPromise = null;
    });
  }
  return dbPromise;
}

/** Sólo para pruebas: cierra y olvida la conexión. */
export async function resetDBConnection() {
  if (dbPromise) {
    const d = await dbPromise.catch(() => null);
    d?.close();
  }
  dbPromise = null;
}

function migrate(db: IDBPDatabase<DraxivoDB>, oldVersion: number) {
  if (oldVersion < 1) {
    db.createObjectStore('settings', { keyPath: 'id' });
    db.createObjectStore('meta', { keyPath: 'key' });
    const ex = db.createObjectStore('exercises', { keyPath: 'id' });
    ex.createIndex('name', 'name');
    db.createObjectStore('folders', { keyPath: 'id' });
    const r = db.createObjectStore('routines', { keyPath: 'id' });
    r.createIndex('folderId', 'folderId');
    const w = db.createObjectStore('workouts', { keyPath: 'id' });
    w.createIndex('status', 'status');
    w.createIndex('date', 'date');
    w.createIndex('routineId', 'routineId');
    db.createObjectStore('bodyweights', { keyPath: 'id' }).createIndex('date', 'date');
    const m = db.createObjectStore('measurements', { keyPath: 'id' });
    m.createIndex('date', 'date');
    m.createIndex('type', 'type');
    db.createObjectStore('photos', { keyPath: 'id' }).createIndex('date', 'date');
    db.createObjectStore('plan', { keyPath: 'id' }).createIndex('date', 'date');
    db.createObjectStore('weekgoals', { keyPath: 'weekStart' });
    db.createObjectStore('reviews', { keyPath: 'id' }).createIndex('weekStart', 'weekStart');
  }
  // Futuras migraciones: if (oldVersion < 2) { ... }
}

/** Añade los ejercicios de la biblioteca que falten, sin tocar los existentes. */
async function ensureLibrary(db: IDBPDatabase<DraxivoDB>) {
  const meta = await db.get('meta', 'libraryVersion');
  if (meta && (meta.value as number) >= LIBRARY_VERSION) return;
  const tx = db.transaction(['exercises', 'meta'], 'readwrite');
  const store = tx.objectStore('exercises');
  for (const ex of seedExercises()) {
    const existing = await store.get(ex.id);
    if (!existing) await store.put(ex);
  }
  await tx.objectStore('meta').put({ key: 'libraryVersion', value: LIBRARY_VERSION });
  await tx.done;
}

// ---- Notificación de cambios para refrescar la interfaz ----
type Listener = (stores: Set<StoreName>) => void;
const listeners = new Set<Listener>();

export function subscribe(fn: Listener) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function notify(...stores: StoreName[]) {
  const set = new Set(stores);
  for (const l of listeners) l(set);
  try {
    channel?.postMessage(stores);
  } catch {
    /* sin BroadcastChannel */
  }
}

// Sincroniza otras pestañas abiertas de la misma aplicación.
const channel: BroadcastChannel | null =
  typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('draxivo-changes') : null;
channel?.addEventListener('message', (e) => {
  const set = new Set(e.data as StoreName[]);
  for (const l of listeners) l(set);
});

export async function requestPersistentStorage(): Promise<boolean | null> {
  try {
    if (navigator.storage?.persist) {
      if (await navigator.storage.persisted()) return true;
      return await navigator.storage.persist();
    }
  } catch {
    /* no disponible */
  }
  return null;
}

export async function storageEstimate(): Promise<{ usage: number; quota: number } | null> {
  try {
    if (navigator.storage?.estimate) {
      const e = await navigator.storage.estimate();
      return { usage: e.usage ?? 0, quota: e.quota ?? 0 };
    }
  } catch {
    /* no disponible */
  }
  return null;
}
