/**
 * Capa de acceso a datos sobre Cloud Firestore.
 *
 * Estructura (todo bajo el profesor autenticado):
 *   users/{uid}                      perfil
 *   users/{uid}/categories/{id}      categorías de tareas
 *   users/{uid}/students/{id}        alumnos (group_ids: pertenencia a grupos)
 *   users/{uid}/groups/{id}          grupos
 *   users/{uid}/series/{id}          horarios recurrentes
 *   users/{uid}/lessons/{id}         cada sesión real
 *   users/{uid}/tasks/{id}           tareas con sus asignaciones por alumno
 *   users/{uid}/notes/{id}           anotaciones de seguimiento
 *   users/{uid}/goals/{id}           objetivos
 *   users/{uid}/activity/{id}        registro de actividad
 *
 * Las reglas de seguridad (firestore.rules) impiden acceder a datos de otro
 * profesor. Las operaciones que tocan varios documentos usan lotes o
 * transacciones para que sean atómicas.
 */
import {
  arrayRemove,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocFromCache,
  getDocsFromCache,
  getDocs,
  limit as qLimit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  where,
  writeBatch,
  type DocumentData,
  type Query,
  type QueryConstraint,
  type QueryDocumentSnapshot,
  type WriteBatch,
} from 'firebase/firestore';
import { firebaseAuth, firestore } from '@/lib/firebase';
import { trackWrite } from '@/lib/sync-status';
import { norm } from '@/lib/search';
import { normalizeStatus } from '@/lib/labels';
import type {
  ActivityEntry,
  Assignment,
  AssignmentStatus,
  Category,
  Goal,
  Group,
  GroupMember,
  Lesson,
  LessonSeries,
  Profile,
  ProgressNote,
  Student,
  Task,
  TaskWithAssignments,
} from '@/lib/types';

export class ApiError extends Error {
  constructor(message: string, public code?: string) {
    super(message);
  }
}

/** Traduce errores de Firebase a mensajes comprensibles. */
export function humanize(e: unknown): ApiError {
  if (e instanceof ApiError) return e;
  const err = e as { code?: string; message?: string };
  const code = err?.code ?? '';
  if (code === 'permission-denied') return new ApiError('No tienes permiso para esta acción o algún dato no es válido. Vuelve a iniciar sesión si persiste.', code);
  if (code === 'unauthenticated') return new ApiError('Tu sesión ha caducado. Vuelve a iniciar sesión.', code);
  if (code === 'unavailable' || code === 'deadline-exceeded') return new ApiError('Sin conexión con el servidor. Comprueba tu conexión a internet.', code);
  if (code === 'not-found') return new ApiError('El elemento ya no existe. Recarga la página.', code);
  if (code === 'resource-exhausted') return new ApiError('Se ha superado la cuota de Firebase. Inténtalo más tarde.', code);
  return new ApiError(err?.message || 'Ha ocurrido un error inesperado.', code);
}

async function safe<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    throw humanize(e);
  }
}

// ------------------------------------------------------------------ utilidades
/** Límite para esperar al servidor: así ninguna acción se queda colgada sin conexión. */
const SERVER_TIMEOUT_MS = 6000;
function withTimeout<T>(p: Promise<T>, ms = SERVER_TIMEOUT_MS): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new ApiError('Sin respuesta de la nube. Comprueba tu conexión e inténtalo de nuevo.', 'deadline-exceeded')), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}
/** Consulta que necesita al servidor (borrados en cascada): con límite de tiempo y sin caché. */
const getDocsStrict = (q: Query<DocumentData>) => withTimeout(getDocs(q));
/** Consulta al servidor con límite de tiempo; si no responde, usa lo que haya en el dispositivo. */
async function getDocsSafe(q: Query<DocumentData>) {
  try {
    return await withTimeout(getDocs(q));
  } catch (e) {
    const cached = await getDocsFromCache(q).catch(() => null);
    if (cached) return cached;
    throw e;
  }
}

function uid(): string {
  const u = firebaseAuth().currentUser;
  if (!u) throw new ApiError('Tu sesión ha caducado. Vuelve a iniciar sesión.', 'unauthenticated');
  return u.uid;
}
const db = () => firestore();
export type Coll = 'categories' | 'students' | 'groups' | 'series' | 'lessons' | 'tasks' | 'notes' | 'goals' | 'activity';
const col = (c: Coll) => collection(db(), 'users', uid(), c);
const ref = (c: Coll, id: string) => doc(db(), 'users', uid(), c, id);
const newId = (c: Coll) => doc(col(c)).id;
const now = () => new Date().toISOString();

function withId<T>(id: string, data: DocumentData): T {
  return { ...data, id, owner_id: uid() } as T;
}
async function list<T>(q: Query<DocumentData>): Promise<T[]> {
  const snap = await getDocsSafe(q);
  return snap.docs.map((d) => withId<T>(d.id, d.data()));
}
const all = <T>(c: Coll, ...cs: QueryConstraint[]) => list<T>(query(col(c), ...cs));

/** Elimina campos que no se guardan (id, owner_id) antes de escribir. */
function clean<T extends object>(o: T): DocumentData {
  const { id: _id, owner_id: _o, ...rest } = o as Record<string, unknown>;
  void _id;
  void _o;
  return rest;
}

/** Lotes de escritura troceados (Firestore admite 500 operaciones por lote). */
class Batcher {
  private batches: WriteBatch[] = [];
  private count = 0;
  private get current() {
    if (!this.batches.length || this.count >= 450) {
      this.batches.push(writeBatch(db()));
      this.count = 0;
    }
    this.count++;
    return this.batches[this.batches.length - 1];
  }
  private changes: LocalChange[] = [];
  private touch(r: ReturnType<typeof doc>, value: DocumentData | null | 'refresh') {
    const coll = r.parent.id as Coll;
    this.changes.push({ coll, id: r.id, value });
  }
  set(r: ReturnType<typeof doc>, data: DocumentData, merge = false) {
    if (merge) this.current.set(r, data, { merge: true });
    else this.current.set(r, data);
    this.touch(r, merge ? 'refresh' : data);
  }
  update(r: ReturnType<typeof doc>, data: DocumentData) {
    this.current.update(r, data);
    this.touch(r, 'refresh');
  }
  delete(r: ReturnType<typeof doc>) {
    this.current.delete(r);
    this.touch(r, null);
  }
  log(entity: string, action: ActivityEntry['action'], label: string, entityId: string | null) {
    this.current.set(doc(col('activity')), { entity, entity_id: entityId, action, label: label.slice(0, 200), created_at: now() });
  }
  async commit() {
    for (const b of this.batches) await b.commit();
  }
  /** Guarda esperando la confirmación del servidor (solo donde hace falta). */
  async commitAndWait() {
    await this.commit();
  }
  /**
   * Guarda sin esperar la confirmación del servidor. Firestore aplica el cambio
   * al instante en la caché local (persistente) y lo sincroniza en segundo
   * plano; si el servidor lo rechaza se notifica mediante syncErrors.
   */
  commitInBackground() {
    const sent = this.commit();
    trackWrite(sent); // el aviso de sincronización vigila que llegue a la nube
    sent.catch((e) => syncErrors.dispatchEvent(new CustomEvent('error', { detail: humanize(e) })));
    // la interfaz se actualiza ya, sin esperar al servidor
    const changes = this.changes.filter((c) => c.coll !== 'activity');
    if (changes.length) localChanges.dispatchEvent(new CustomEvent('change', { detail: changes }));
  }
}

/** Errores de escrituras sincronizadas en segundo plano (los muestra la interfaz). */
export const syncErrors = new EventTarget();

/**
 * Cambios locales recién guardados (antes de que confirme el servidor), para
 * que las listas en pantalla se actualicen al instante.
 * value: documento completo, null si se borró, o 'refresh' si hay que recargar.
 */
export type LocalChange = { coll: Coll; id: string; value: DocumentData | null | 'refresh' };
export const localChanges = new EventTarget();

/** Convierte un documento guardado al tipo que usa la interfaz. */
export function toAppDoc(coll: Coll, id: string, data: DocumentData): unknown {
  if (coll === 'tasks') return toTask(id, data);
  if (coll === 'students') return { ...withId<Student>(id, data), group_ids: (data.group_ids as string[]) ?? [] };
  return withId(id, data);
}

/** Lee un documento de la caché local si está; si no, del servidor. */
async function readDoc(r: ReturnType<typeof doc>) {
  try {
    const snap = await getDocFromCache(r);
    if (snap.exists()) return snap;
  } catch {
    // no está en caché
  }
  return withTimeout(getDoc(r));
}

const fullName = (s: Pick<Student, 'first_name' | 'last_name'>) => [s.first_name, s.last_name].filter(Boolean).join(' ');

// ------------------------------------------------------------------ Perfil
const DEFAULT_CATEGORIES: [string, string][] = [
  ['Técnica', 'indigo'],
  ['Estudios', 'sky'],
  ['Repertorio', 'violet'],
  ['Lectura', 'amber'],
  ['Teoría musical', 'teal'],
  ['Ejercicios', 'rose'],
  ['Otros', 'slate'],
];

let ensuring: Promise<boolean> | null = null;

export const profileApi = {
  get: () =>
    safe(async () => {
      const snap = await readDoc(doc(db(), 'users', uid()));
      return snap.exists() ? ({ ...(snap.data() as Profile), id: snap.id } as Profile) : null;
    }),
  /** Crea el perfil y las categorías iniciales la primera vez que entra el profesor. */
  ensure: (displayName: string) =>
    safe(async () => {
      const id = uid();
      const pref = doc(db(), 'users', id);
      // caso habitual: el perfil ya está en la caché del dispositivo, no hace falta ir al servidor
      const cached = await getDocFromCache(pref).catch(() => null);
      if (cached?.exists()) return false;
      // una sola comprobación a la vez (registro y arranque de la app la piden a la vez)
      ensuring ??= (async () => {
        const created = await runTransaction(db(), async (tx) => {
          const snap = await tx.get(pref);
          if (snap.exists()) return false;
          tx.set(pref, { display_name: displayName, default_lesson_minutes: 60, day_start_hour: 8, day_end_hour: 22, created_at: now() });
          return true;
        }).catch((e) => {
          // si otra petición ya lo creó, no es un error
          if ((e as { code?: string })?.code === 'already-exists') return false;
          throw e;
        });
        if (created) {
          const b = new Batcher();
          DEFAULT_CATEGORIES.forEach(([name, color], i) => b.set(doc(col('categories')), { name, color, sort_order: i + 1, created_at: now() }));
          await b.commitAndWait();
        }
        return created;
      })().finally(() => {
        ensuring = null;
      });
      const created = await ensuring;
      return created;
    }),
  update: (id: string, patch: Partial<Profile>) =>
    safe(async () => {
      const r = doc(db(), 'users', id);
      const cur = (await readDoc(r)).data() ?? {};
      const next = { ...cur, ...clean(patch) };
      const b = new Batcher();
      b.set(r, next);
      b.commitInBackground();
      return { ...(next as Profile), id };
    }),
};

// ------------------------------------------------------------------ Categorías
export const categoryApi = {
  list: () => safe(async () => (await all<Category>('categories')).sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name))),
  create: (c: Pick<Category, 'name' | 'color' | 'sort_order'>) =>
    safe(async () => {
      const existing = await all<Category>('categories');
      if (existing.some((x) => norm(x.name) === norm(c.name))) throw new ApiError('Ya existe una categoría con ese nombre.');
      const id = newId('categories');
      const b = new Batcher();
      const data = { ...c, created_at: now() };
      b.set(ref('categories', id), data);
      b.commitInBackground();
      return withId<Category>(id, data);
    }),
  update: (id: string, patch: Partial<Category>) =>
    safe(async () => {
      const r = ref('categories', id);
      const cur = (await readDoc(r)).data();
      if (!cur) throw new ApiError('La categoría ya no existe.');
      const next = { ...cur, ...clean(patch) };
      const b = new Batcher();
      b.set(r, next);
      b.commitInBackground();
      return withId<Category>(id, next);
    }),
  /** Borra la categoría; las tareas, objetivos y notas que la usaban quedan sin categoría. */
  remove: (id: string) =>
    safe(async () => {
      const b = new Batcher();
      for (const c of ['tasks', 'goals', 'notes'] as const) {
        const snap = await getDocsStrict(query(col(c), where('category_id', '==', id)));
        snap.docs.forEach((d) => b.update(d.ref, { category_id: null }));
      }
      b.delete(ref('categories', id));
      b.commitInBackground();
    }),
};

// ------------------------------------------------------------------ Alumnos
export type StudentInput = Omit<Student, 'id' | 'owner_id' | 'created_at' | 'updated_at' | 'group_ids'> & { group_ids?: string[] };

const STUDENT_DEFAULTS = {
  last_name: '',
  photo: null,
  instrument: '',
  phone: '',
  email: '',
  joined_on: null,
  usual_schedule: '',
  lesson_minutes: 60,
  level: '',
  notes: '',
  status: 'active',
  color: 'indigo',
  group_ids: [] as string[],
};

export const studentApi = {
  list: () => safe(async () => (await all<Student>('students')).map((s) => ({ ...s, group_ids: s.group_ids ?? [] })).sort((a, b) => fullName(a).localeCompare(fullName(b), 'es'))),
  get: (id: string) =>
    safe(async () => {
      const snap = await withTimeout(getDoc(ref('students', id)));
      if (!snap.exists()) throw new ApiError('Alumno no encontrado', 'not-found');
      return withId<Student>(id, snap.data());
    }),
  /** Id para un alumno nuevo (permite precargar su ficha antes de guardarlo). */
  newId: () => newId('students'),
  create: (s: Partial<StudentInput>, presetId?: string) =>
    safe(async () => {
      const id = presetId ?? newId('students');
      const data = { ...STUDENT_DEFAULTS, ...s, created_at: now(), updated_at: now() };
      const b = new Batcher();
      b.set(ref('students', id), data);
      b.log('students', 'created', fullName(data as Student), id);
      b.commitInBackground();
      return withId<Student>(id, data);
    }),
  update: (id: string, patch: Partial<StudentInput>) =>
    safe(async () => {
      const r = ref('students', id);
      // la caché local basta para conocer el estado actual: evita esperar al servidor
      const snap = await readDoc(r);
      const cur = snap.data();
      if (!cur) throw new ApiError('El alumno ya no existe.', 'not-found');
      const next = { ...STUDENT_DEFAULTS, ...cur, ...clean(patch), updated_at: now() };
      const b = new Batcher();
      b.set(r, next);
      b.log('students', 'updated', fullName(next as Student), id);
      b.commitInBackground();
      return withId<Student>(id, next);
    }),
  /** Borra al alumno y, en cascada, sus clases, series, notas, objetivos y asignaciones. */
  remove: (id: string) =>
    safe(async () => {
      const cur = (await readDoc(ref('students', id))).data();
      const b = new Batcher();
      for (const c of ['lessons', 'series', 'notes', 'goals'] as const) {
        (await getDocsStrict(query(col(c), where('student_id', '==', id)))).docs.forEach((d) => b.delete(d.ref));
      }
      const tasks = await getDocsStrict(query(col('tasks'), where('student_ids', 'array-contains', id)));
      for (const d of tasks.docs) {
        const t = d.data() as Task & { assignments: Record<string, unknown>; student_ids: string[] };
        if (!t.group_id && t.student_ids.length <= 1) b.delete(d.ref);
        else {
          const assignments = { ...t.assignments };
          delete assignments[id];
          b.update(d.ref, derive({ assignments }));
        }
      }
      b.delete(ref('students', id));
      b.log('students', 'deleted', cur ? fullName(cur as Student) : '', id);
      b.commitInBackground();
    }),
  duplicate: (id: string) =>
    safe(async () => {
      const cur = (await readDoc(ref('students', id))).data() as Student | undefined;
      if (!cur) throw new ApiError('Alumno no encontrado', 'not-found');
      const copy = await studentApi.create({
        ...clean(cur),
        last_name: `${cur.last_name} (copia)`.trim(),
        joined_on: new Date().toISOString().slice(0, 10),
        status: 'active',
        group_ids: cur.group_ids ?? [],
      } as Partial<StudentInput>);
      return copy.id;
    }),
};

// ------------------------------------------------------------------ Grupos
export type GroupInput = Omit<Group, 'id' | 'owner_id' | 'created_at' | 'updated_at'>;
const GROUP_DEFAULTS = { description: '', subject: '', usual_weekday: null, usual_time: null, lesson_minutes: 60, location: '', notes: '', color: 'teal', archived: false };

export const groupApi = {
  list: () => safe(async () => (await all<Group>('groups')).sort((a, b) => a.name.localeCompare(b.name, 'es'))),
  newId: () => newId('groups'),
  create: (g: Partial<GroupInput>, presetId?: string) =>
    safe(async () => {
      const id = presetId ?? newId('groups');
      const data = { ...GROUP_DEFAULTS, ...g, created_at: now(), updated_at: now() };
      const b = new Batcher();
      b.set(ref('groups', id), data);
      b.log('groups', 'created', String(data.name), id);
      b.commitInBackground();
      return withId<Group>(id, data);
    }),
  update: (id: string, patch: Partial<GroupInput>) =>
    safe(async () => {
      const r = ref('groups', id);
      const cur = (await readDoc(r)).data();
      if (!cur) throw new ApiError('El grupo ya no existe.', 'not-found');
      const next: DocumentData = { ...GROUP_DEFAULTS, ...cur, ...clean(patch), updated_at: now() };
      const b = new Batcher();
      b.set(r, next);
      b.log('groups', 'updated', String(next.name), id);
      b.commitInBackground();
      return withId<Group>(id, next);
    }),
  /** Borra el grupo, sus clases y sus tareas; los alumnos se conservan. */
  remove: (id: string) =>
    safe(async () => {
      const cur = (await readDoc(ref('groups', id))).data();
      const b = new Batcher();
      for (const c of ['lessons', 'series', 'tasks'] as const) {
        (await getDocsStrict(query(col(c), where('group_id', '==', id)))).docs.forEach((d) => b.delete(d.ref));
      }
      (await getDocsStrict(query(col('students'), where('group_ids', 'array-contains', id)))).docs.forEach((d) => b.update(d.ref, { group_ids: arrayRemove(id) }));
      b.delete(ref('groups', id));
      b.log('groups', 'deleted', String(cur?.name ?? ''), id);
      b.commitInBackground();
    }),
  /** Pertenencias derivadas de los alumnos. */
  members: () =>
    safe(async () => (await studentApi.list()).flatMap((s) => s.group_ids.map<GroupMember>((g) => ({ group_id: g, student_id: s.id, owner_id: s.owner_id })))),
  setMembers: (groupId: string, studentIds: string[], current: string[]) =>
    safe(async () => {
      const b = new Batcher();
      studentIds.filter((id) => !current.includes(id)).forEach((id) => b.update(ref('students', id), { group_ids: arrayUnion(groupId) }));
      current.filter((id) => !studentIds.includes(id)).forEach((id) => b.update(ref('students', id), { group_ids: arrayRemove(groupId) }));
      b.commitInBackground();
    }),
  setStudentGroups: (studentId: string, groupIds: string[]) =>
    safe(async () => {
      const b = new Batcher();
      b.update(ref('students', studentId), { group_ids: [...new Set(groupIds)] });
      b.commitInBackground();
    }),
};

// ------------------------------------------------------------------ Clases
export type LessonInput = Partial<Omit<Lesson, 'id' | 'owner_id' | 'ends_at' | 'created_at' | 'updated_at'>>;
const LESSON_DEFAULTS = {
  series_id: null,
  student_id: null,
  group_id: null,
  lesson_type: 'Individual',
  status: 'scheduled',
  location: '',
  plan: '',
  notes: '',
  summary: '',
  next_goals: '',
  is_modified: false,
  original_starts_at: null,
  completed_at: null,
};

/** Normaliza una clase: fin calculado y fecha de finalización según el estado. */
function lessonData(base: DocumentData): DocumentData {
  const d: DocumentData = { ...LESSON_DEFAULTS, ...base };
  d.starts_at = new Date(d.starts_at).toISOString();
  d.ends_at = new Date(new Date(d.starts_at).getTime() + Number(d.duration_minutes) * 60_000).toISOString();
  if (d.status === 'completed' && !d.completed_at) d.completed_at = now();
  if (d.status !== 'completed') d.completed_at = null;
  return d;
}
const lessonLabel = (l: DocumentData) =>
  new Date(l.starts_at).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Madrid' });
const STATUS_WORD: Record<string, string> = { completed: 'realizada', cancelled: 'cancelada', scheduled: 'programada' };

export const lessonApi = {
  range: (fromIso: string, toIso: string) =>
    safe(() => all<Lesson>('lessons', where('starts_at', '>=', new Date(fromIso).toISOString()), where('starts_at', '<', new Date(toIso).toISOString()), orderBy('starts_at'))),
  get: (id: string) =>
    safe(async () => {
      const snap = await withTimeout(getDoc(ref('lessons', id)));
      if (!snap.exists()) throw new ApiError('Clase no encontrada', 'not-found');
      return withId<Lesson>(id, snap.data());
    }),
  forTarget: (studentId: string | null, groupIds: string[]) =>
    safe(async () => {
      const out: Lesson[] = [];
      if (studentId) out.push(...(await all<Lesson>('lessons', where('student_id', '==', studentId))));
      for (let i = 0; i < groupIds.length; i += 30) out.push(...(await all<Lesson>('lessons', where('group_id', 'in', groupIds.slice(i, i + 30)))));
      return out.sort((a, b) => b.starts_at.localeCompare(a.starts_at)).slice(0, 500);
    }),
  create: (l: LessonInput) =>
    safe(async () => {
      const id = newId('lessons');
      const data = lessonData({ ...l, created_at: now(), updated_at: now() });
      const b = new Batcher();
      b.set(ref('lessons', id), data);
      b.log('lessons', 'created', lessonLabel(data), id);
      b.commitInBackground();
      return withId<Lesson>(id, data);
    }),
  /** Crea muchas sesiones a la vez (series): solo se registra la serie en la actividad. */
  createMany: (rows: LessonInput[]) =>
    safe(async () => {
      const b = new Batcher();
      const out: Lesson[] = [];
      for (const r of rows) {
        const id = newId('lessons');
        const data = lessonData({ ...r, created_at: now(), updated_at: now() });
        b.set(ref('lessons', id), data);
        out.push(withId<Lesson>(id, data));
      }
      b.commitInBackground();
      return out;
    }),
  update: (id: string, patch: LessonInput) =>
    safe(async () => {
      const r = ref('lessons', id);
      const cur = (await readDoc(r)).data();
      if (!cur) throw new ApiError('La clase ya no existe.', 'not-found');
      const next = lessonData({ ...cur, ...clean(patch), updated_at: now() });
      const b = new Batcher();
      b.set(r, next);
      const label = lessonLabel(next) + (cur.status !== next.status ? ` · ${STATUS_WORD[next.status]}` : '');
      b.log('lessons', 'updated', label, id);
      b.commitInBackground();
      return withId<Lesson>(id, next);
    }),
  remove: (id: string) =>
    safe(async () => {
      const cur = (await readDoc(ref('lessons', id))).data();
      const b = new Batcher();
      b.delete(ref('lessons', id));
      b.log('lessons', 'deleted', cur ? lessonLabel(cur) : '', id);
      b.commitInBackground();
    }),
  /** Clases que se solapan con un intervalo (no canceladas). */
  conflicts: (startsIso: string, endsIso: string, exclude: string[] = []) =>
    safe(async () => {
      const from = new Date(new Date(startsIso).getTime() - 12 * 3600_000).toISOString();
      const list = await lessonApi.range(from, endsIso);
      return list.filter((l) => l.status !== 'cancelled' && !exclude.includes(l.id) && l.starts_at < endsIso && l.ends_at > startsIso);
    }),
  /** Sesiones programadas de una serie a partir de una fecha. */
  seriesFollowing: (seriesId: string, fromIso: string) =>
    safe(async () =>
      (await all<Lesson>('lessons', where('series_id', '==', seriesId)))
        .filter((l) => l.starts_at >= new Date(fromIso).toISOString() && l.status === 'scheduled')
        .sort((a, b) => a.starts_at.localeCompare(b.starts_at)),
    ),
  /**
   * Crea una serie recurrente y todas sus sesiones en una sola escritura
   * (sin esperar al servidor). Devuelve la serie y las sesiones creadas.
   */
  createSeries: (series: Omit<LessonSeries, 'id' | 'owner_id'>, rows: LessonInput[]) =>
    safe(async () => {
      const seriesId = newId('series');
      const b = new Batcher();
      b.set(ref('series', seriesId), { ...series, created_at: now(), updated_at: now() });
      b.log('lesson_series', 'created', `${series.weekdays.length} día(s) por semana · ${series.start_time} · ${rows.length} clases`, seriesId);
      const lessons: Lesson[] = [];
      for (const r of rows) {
        const id = newId('lessons');
        const data = lessonData({ ...r, series_id: seriesId, created_at: now(), updated_at: now() });
        b.set(ref('lessons', id), data);
        lessons.push(withId<Lesson>(id, data));
      }
      b.commitInBackground();
      return { seriesId, lessons };
    }),
  removeMany: (ids: string[]) =>
    safe(async () => {
      const b = new Batcher();
      ids.forEach((id) => b.delete(ref('lessons', id)));
      b.commitInBackground();
    }),
};

export const seriesApi = {
  create: (s: Omit<LessonSeries, 'id' | 'owner_id'>) =>
    safe(async () => {
      const id = newId('series');
      const data = { ...s, created_at: now(), updated_at: now() };
      const b = new Batcher();
      b.set(ref('series', id), data);
      b.log('lesson_series', 'created', `${s.weekdays.length} día(s) por semana · ${s.start_time}`, id);
      b.commitInBackground();
      return withId<LessonSeries>(id, data);
    }),
  get: (id: string) =>
    safe(async () => {
      const snap = await withTimeout(getDoc(ref('series', id)));
      if (!snap.exists()) throw new ApiError('Serie no encontrada', 'not-found');
      return withId<LessonSeries>(id, snap.data());
    }),
  update: (id: string, patch: Partial<LessonSeries>) =>
    safe(async () => {
      const r = ref('series', id);
      const cur = (await readDoc(r)).data();
      if (!cur) throw new ApiError('Serie no encontrada', 'not-found');
      const next: DocumentData = { ...cur, ...clean(patch), updated_at: now() };
      if (next.end_date < next.start_date) next.end_date = next.start_date;
      const b = new Batcher();
      b.set(r, next);
      b.commitInBackground();
      return withId<LessonSeries>(id, next);
    }),
  remove: (id: string) =>
    safe(async () => {
      const b = new Batcher();
      b.delete(ref('series', id));
      b.commitInBackground();
    }),
};

// ------------------------------------------------------------------ Tareas
export type TaskInput = Partial<Omit<Task, 'id' | 'owner_id' | 'created_at' | 'updated_at' | 'copied_from'>>;

type StoredAssignment = { status: AssignmentStatus; feedback: string; completed_at: string | null; updated_at: string };
type StoredTask = Omit<Task, 'id' | 'owner_id'> & {
  student_ids: string[];
  pending_ids: string[];
  has_pending: boolean;
  assignments: Record<string, StoredAssignment>;
  copy_key: string | null;
};

const TASK_DEFAULTS = {
  description: '',
  category_id: null,
  priority: 'normal',
  due_on: null,
  notes: '',
  group_id: null,
  lesson_id: null,
  copied_from: null,
  copy_key: null,
  carried_from: null,
};

const newAssignment = (): StoredAssignment => ({ status: 'pending', feedback: '', completed_at: null, updated_at: now() });

/** Campos derivados de las asignaciones, usados en las consultas. */
function derive<T extends { assignments: Record<string, unknown> }>(t: T) {
  const asg = t.assignments as Record<string, StoredAssignment>;
  const ids = Object.keys(asg).sort();
  const pending = ids.filter((id) => normalizeStatus(asg[id].status) === 'pending');
  return { ...t, student_ids: ids, pending_ids: pending, has_pending: pending.length > 0 };
}

function stamp(a: StoredAssignment, status: AssignmentStatus): StoredAssignment {
  const { reviewed_at: _r, ...rest } = a as StoredAssignment & { reviewed_at?: unknown };
  void _r;
  return {
    ...rest,
    status,
    completed_at: status === 'completed' ? (normalizeStatus(a.status) === 'completed' && a.completed_at ? a.completed_at : now()) : null,
    updated_at: now(),
  };
}

// ---------------------------------------------- Tareas no completadas → semana siguiente
const nextWeekKey = (week: string) => new Date(Date.parse(week + 'T00:00:00Z') + 7 * 86400_000).toISOString().slice(0, 10);
/**
 * Id de la continuación de una tarea en la semana siguiente. Es determinista
 * (tarea de origen + semana de destino): por mucho que se pulse, se recargue
 * o se use desde varios dispositivos, solo puede existir una.
 */
export const carryId = (taskId: string, week: string) => `carry_${taskId}_${nextWeekKey(week)}`;

/** Una continuación sin tocar (pendiente y sin comentarios) se puede retirar sin perder nada. */
const untouched = (a: StoredAssignment | undefined) => !!a && normalizeStatus(a.status) === 'pending' && !a.feedback;

/**
 * Lleva a la semana siguiente las asignaciones marcadas como «No completada»
 * (como pendientes) y retira las continuaciones sin tocar de las que dejan de
 * estarlo. La tarea original no cambia: conserva su estado e historial.
 */
async function syncCarryOver(b: Batcher, tid: string, src: StoredTask, add: string[], drop: string[]) {
  if (!add.length && !drop.length) return;
  const week = nextWeekKey(src.week_start);
  const id = carryId(tid, src.week_start);
  const r = ref('tasks', id);
  const cur = (await readDoc(r)).data() as StoredTask | undefined;
  if (!cur) {
    if (!add.length) return;
    const shift = (k: string) => nextWeekKey(k);
    const data = derive({
      ...TASK_DEFAULTS,
      title: src.title,
      description: src.description ?? '',
      category_id: src.category_id ?? null,
      priority: src.priority ?? 'normal',
      week_start: week,
      assigned_on: week,
      due_on: src.due_on ? shift(src.due_on) : null,
      notes: src.notes ?? '',
      group_id: src.group_id ?? null,
      lesson_id: null,
      carried_from: tid,
      assignments: Object.fromEntries(add.map((sid) => [sid, newAssignment()])),
      created_at: now(),
      updated_at: now(),
    });
    b.set(r, data);
    b.log('tasks', 'created', `${src.title} · pasa a la semana del ${week.split('-').reverse().join('/')}`, id);
    return;
  }
  const assignments = { ...cur.assignments };
  let changed = false;
  for (const sid of add) if (!assignments[sid]) (assignments[sid] = newAssignment()), (changed = true);
  for (const sid of drop) if (untouched(assignments[sid])) delete assignments[sid], (changed = true);
  if (!changed) return;
  if (!Object.keys(assignments).length) b.delete(r);
  else b.set(r, derive({ ...cur, assignments, updated_at: now() }));
}

/** Aplica estados a una tarea y actualiza su continuación en la semana siguiente. */
async function applyStatuses(b: Batcher, tid: string, sids: string[] | 'all', status: AssignmentStatus) {
  const t = (await readDoc(ref('tasks', tid))).data() as StoredTask | undefined;
  if (!t) return;
  const assignments = { ...t.assignments };
  const add: string[] = [];
  const drop: string[] = [];
  for (const sid of sids === 'all' ? Object.keys(assignments) : sids) {
    const a = assignments[sid];
    if (!a) continue;
    const before = normalizeStatus(a.status);
    assignments[sid] = stamp(a, status);
    if (status === 'not_completed') {
      if (before !== 'not_completed') add.push(sid);
    }
    else if (before === 'not_completed') drop.push(sid);
  }
  b.set(ref('tasks', tid), derive({ ...t, assignments, updated_at: now() }));
  await syncCarryOver(b, tid, t, add, drop);
}

function toTask(id: string, d: DocumentData): TaskWithAssignments {
  const owner = uid();
  const asg = (d.assignments ?? {}) as Record<string, StoredAssignment>;
  const { assignments: _a, student_ids: _s, pending_ids: _p, has_pending: _h, ...rest } = d;
  void _a;
  void _s;
  void _p;
  void _h;
  return {
    ...(rest as Task),
    id,
    owner_id: owner,
    assignments: Object.entries(asg)
      .map(([sid, a]) => {
        const { reviewed_at: _r, ...rest } = a as StoredAssignment & { reviewed_at?: unknown };
        void _r;
        return { id: `${id}__${sid}`, owner_id: owner, task_id: id, student_id: sid, ...rest, status: normalizeStatus(a.status) } as Assignment;
      })
      .sort((a, b) => a.student_id.localeCompare(b.student_id)),
  };
}
async function tasksOf(q: Query<DocumentData>) {
  const snap = await getDocsSafe(q);
  return snap.docs.map((d) => toTask(d.id, d.data()));
}
const byWeekThenCreated = (a: Task, b: Task) => a.week_start.localeCompare(b.week_start) || a.created_at.localeCompare(b.created_at);

/** Alumnos actuales (no archivados) de un grupo. */
async function groupMemberIds(groupId: string) {
  const q = query(col('students'), where('group_ids', 'array-contains', groupId));
  let snap = await getDocsFromCache(q).catch(() => null);
  if (!snap || snap.empty) snap = await getDocsSafe(q);
  return snap.docs.filter((d) => d.data().status !== 'archived').map((d) => d.id);
}

function parseAssignmentId(id: string) {
  const [taskId, studentId] = id.split('__');
  return { taskId, studentId };
}

export const taskApi = {
  week: (weekStart: string) => safe(async () => (await tasksOf(query(col('tasks'), where('week_start', '==', weekStart)))).sort(byWeekThenCreated)),
  weeks: (fromWeek: string, toWeek: string) =>
    safe(async () => (await tasksOf(query(col('tasks'), where('week_start', '>=', fromWeek), where('week_start', '<=', toWeek)))).sort(byWeekThenCreated)),
  forStudent: (studentId: string) =>
    safe(async () =>
      (await tasksOf(query(col('tasks'), where('student_ids', 'array-contains', studentId)))).sort(
        (a, b) => b.week_start.localeCompare(a.week_start) || a.created_at.localeCompare(b.created_at),
      ),
    ),
  forGroup: (groupId: string) =>
    safe(async () =>
      (await tasksOf(query(col('tasks'), where('group_id', '==', groupId)))).sort((a, b) => b.week_start.localeCompare(a.week_start) || a.created_at.localeCompare(b.created_at)),
    ),
  /** Búsqueda: filtra en el servidor por categoría/grupo/semana y por texto en el cliente (sin tildes). */
  search: (filters: { q?: string; categoryId?: string; fromWeek?: string; toWeek?: string; groupId?: string }) =>
    safe(async () => {
      const cs: QueryConstraint[] = [];
      if (filters.categoryId) cs.push(where('category_id', '==', filters.categoryId));
      else if (filters.groupId) cs.push(where('group_id', '==', filters.groupId));
      let list = await tasksOf(query(col('tasks'), ...cs));
      if (filters.groupId) list = list.filter((t) => t.group_id === filters.groupId);
      if (filters.fromWeek) list = list.filter((t) => t.week_start >= filters.fromWeek!);
      if (filters.toWeek) list = list.filter((t) => t.week_start <= filters.toWeek!);
      if (filters.q) {
        const q = norm(filters.q);
        list = list.filter((t) => norm(`${t.title} ${t.description} ${t.notes}`).includes(q));
      }
      return list.sort((a, b) => b.week_start.localeCompare(a.week_start)).slice(0, 300);
    }),

  /** Crea una tarea para varios alumnos y/o un grupo completo (una asignación por integrante). */
  create: (task: TaskInput, studentIds: string[], groupId: string | null) =>
    safe(async () => {
      const ids = new Set(studentIds);
      if (groupId) (await groupMemberIds(groupId)).forEach((id) => ids.add(id));
      const id = newId('tasks');
      const assignments = Object.fromEntries([...ids].map((sid) => [sid, newAssignment()]));
      const data = derive({ ...TASK_DEFAULTS, ...task, group_id: groupId, assignments, created_at: now(), updated_at: now() });
      const b = new Batcher();
      b.set(ref('tasks', id), data);
      b.log('tasks', 'created', String(task.title ?? ''), id);
      b.commitInBackground();
      return toTask(id, data) as Task;
    }),
  update: (id: string, patch: TaskInput) =>
    safe(async () => {
      const r = ref('tasks', id);
      const cur = (await readDoc(r)).data() as StoredTask | undefined;
      if (!cur) throw new ApiError('La tarea ya no existe.', 'not-found');
      const next = derive({ ...TASK_DEFAULTS, ...cur, ...clean(patch), updated_at: now() });
      const b = new Batcher();
      b.set(r, next);
      b.log('tasks', 'updated', next.title, id);
      b.commitInBackground();
      return toTask(id, next) as Task;
    }),
  /** Ajusta los alumnos asignados (añade y quita). */
  setStudents: (taskId: string, studentIds: string[]) =>
    safe(async () => {
      const r = ref('tasks', taskId);
      const cur = (await readDoc(r)).data() as StoredTask | undefined;
      if (!cur) throw new ApiError('La tarea ya no existe.', 'not-found');
      const assignments: Record<string, StoredAssignment> = {};
      for (const sid of new Set(studentIds)) assignments[sid] = cur.assignments[sid] ?? newAssignment();
      const b = new Batcher();
      b.set(r, derive({ ...cur, assignments, updated_at: now() }));
      b.commitInBackground();
    }),
  assignGroup: (taskId: string, groupId: string) =>
    safe(async () => {
      const members = await groupMemberIds(groupId);
      const r = ref('tasks', taskId);
      const cur = (await readDoc(r)).data() as StoredTask | undefined;
      if (!cur) throw new ApiError('La tarea ya no existe.', 'not-found');
      const assignments = { ...cur.assignments };
      let added = 0;
      for (const sid of members) if (!assignments[sid]) (assignments[sid] = newAssignment()), added++;
      const b = new Batcher();
      b.set(r, derive({ ...cur, group_id: groupId, assignments, updated_at: now() }));
      b.commitInBackground();
      return added;
    }),
  remove: (id: string) =>
    safe(async () => {
      const cur = (await readDoc(ref('tasks', id))).data();
      const b = new Batcher();
      b.delete(ref('tasks', id));
      b.log('tasks', 'deleted', String(cur?.title ?? ''), id);
      b.commitInBackground();
    }),
  removeAssignment: (assignmentId: string) =>
    safe(async () => {
      const { taskId, studentId } = parseAssignmentId(assignmentId);
      const r = ref('tasks', taskId);
      const t = (await readDoc(r)).data() as StoredTask | undefined;
      if (!t) return;
      const assignments = { ...t.assignments };
      delete assignments[studentId];
      const b = new Batcher();
      b.set(r, derive({ ...t, assignments, updated_at: now() }));
      b.commitInBackground();
    }),
  /** Cambia el estado de varias asignaciones (agrupadas por tarea). */
  setStatus: (assignmentIds: string[], status: AssignmentStatus) =>
    safe(async () => {
      const byTask = new Map<string, string[]>();
      for (const aid of assignmentIds) {
        const { taskId, studentId } = parseAssignmentId(aid);
        byTask.set(taskId, [...(byTask.get(taskId) ?? []), studentId]);
      }
      const b = new Batcher();
      for (const [tid, sids] of byTask) await applyStatuses(b, tid, sids, status);
      b.commitInBackground();
      return [] as Assignment[];
    }),
  setStatusForTasks: (taskIds: string[], status: AssignmentStatus) =>
    safe(async () => {
      const b = new Batcher();
      for (const tid of taskIds) await applyStatuses(b, tid, 'all', status);
      b.commitInBackground();
      return [] as Assignment[];
    }),
  setFeedback: (assignmentId: string, feedback: string) =>
    safe(async () => {
      const { taskId, studentId } = parseAssignmentId(assignmentId);
      const r = ref('tasks', taskId);
      const t = (await readDoc(r)).data() as StoredTask | undefined;
      if (!t?.assignments[studentId]) return;
      const b = new Batcher();
      b.set(r, derive({ ...t, assignments: { ...t.assignments, [studentId]: { ...t.assignments[studentId], feedback, updated_at: now() } } }));
      b.commitInBackground();
    }),

  /**
   * Copia tareas a otra semana. Cada copia tiene un id determinista
   * (origen + semana + alcance), así que nunca se duplica la misma tarea:
   * si ya existe, se omite. Si studentId se indica, solo se copia la
   * asignación de ese alumno (como tarea individual). Devuelve cuántas creó.
   */
  duplicate: (taskIds: string[], targetWeek: string, studentId: string | null = null) =>
    safe(async () => {
      const [y, m, d] = targetWeek.split('-').map(Number);
      if (new Date(y, m - 1, d).getDay() !== 1) throw new ApiError('La semana de destino debe empezar en lunes');
      const scope = studentId ?? 'all';
      let created = 0;
      for (const tid of taskIds) {
        const src = (await readDoc(ref('tasks', tid))).data() as StoredTask | undefined;
        if (!src || src.week_start === targetWeek) continue;
        const key = `${tid}_${targetWeek}_${scope}`;
        const shift = Math.round((Date.UTC(y, m - 1, d) - Date.parse(src.week_start + 'T00:00:00Z')) / 86400_000);
        const addDaysKey = (k: string) => new Date(Date.parse(k + 'T00:00:00Z') + shift * 86400_000).toISOString().slice(0, 10);
        let ids: string[];
        if (src.group_id && !studentId) ids = await groupMemberIds(src.group_id);
        else ids = Object.keys(src.assignments).filter((sid) => !studentId || sid === studentId);
        const assignedOn = addDaysKey(src.assigned_on);
        const data = derive({
          ...TASK_DEFAULTS,
          title: src.title,
          description: src.description,
          category_id: src.category_id,
          priority: src.priority,
          week_start: targetWeek,
          assigned_on: assignedOn > targetWeek ? assignedOn : targetWeek,
          due_on: src.due_on ? addDaysKey(src.due_on) : null,
          notes: src.notes,
          group_id: studentId ? null : src.group_id,
          lesson_id: null,
          copied_from: tid,
          copy_key: key,
          assignments: Object.fromEntries(ids.map((sid) => [sid, newAssignment()])),
          created_at: now(),
          updated_at: now(),
        });
        const ok = await runTransaction(db(), async (tx) => {
          const r = ref('tasks', 'copy_' + key);
          if ((await tx.get(r)).exists()) return false;
          tx.set(r, data);
          return true;
        });
        if (ok) created++;
      }
      if (created) {
        const b = new Batcher();
        b.log('tasks', 'created', `${created} ${created === 1 ? 'tarea copiada' : 'tareas copiadas'} a la semana del ${targetWeek.split('-').reverse().join('/')}`, null);
        b.commitInBackground();
      }
      return created;
    }),
  /** Claves de copia existentes en una semana destino (para avisar de duplicados). */
  copiesIn: (targetWeek: string) =>
    safe(async () => (await tasksOf(query(col('tasks'), where('week_start', '==', targetWeek)))).filter((t) => t.copy_key).map((t) => ({ copied_from: t.copied_from, copy_key: t.copy_key ?? null }))),
  pendingAssignments: () =>
    safe(async () => (await tasksOf(query(col('tasks'), where('has_pending', '==', true)))).flatMap((t) => t.assignments.filter((a) => a.status === 'pending'))),
};

// ------------------------------------------------------------------ Seguimiento
const byNotedDesc = (a: ProgressNote, b: ProgressNote) => b.noted_on.localeCompare(a.noted_on) || b.created_at.localeCompare(a.created_at);

export const noteApi = {
  forStudent: (studentId: string) => safe(async () => (await all<ProgressNote>('notes', where('student_id', '==', studentId))).sort(byNotedDesc)),
  recent: () => safe(async () => (await all<ProgressNote>('notes')).sort(byNotedDesc).slice(0, 300)),
  create: (n: Partial<ProgressNote>) =>
    safe(async () => {
      const id = newId('notes');
      const data = { lesson_id: null, kind: 'observation', category_id: null, noted_on: new Date().toISOString().slice(0, 10), ...clean(n), created_at: now(), updated_at: now() };
      const b = new Batcher();
      b.set(ref('notes', id), data);
      b.commitInBackground();
      return withId<ProgressNote>(id, data);
    }),
  update: (id: string, patch: Partial<ProgressNote>) =>
    safe(async () => {
      const r = ref('notes', id);
      const cur = (await readDoc(r)).data();
      const next = { ...cur, ...clean(patch), updated_at: now() };
      const b = new Batcher();
      b.set(r, next);
      b.commitInBackground();
      return withId<ProgressNote>(id, next);
    }),
  remove: (id: string) =>
    safe(async () => {
      const b = new Batcher();
      b.delete(ref('notes', id));
      b.commitInBackground();
    }),
  search: (q: string) => safe(async () => (await noteApi.recent()).filter((n) => norm(n.body).includes(norm(q))).slice(0, 50)),
};

export const goalApi = {
  forStudent: (studentId: string) =>
    safe(async () => {
      const order = { active: 0, achieved: 1, dropped: 2 } as const;
      return (await all<Goal>('goals', where('student_id', '==', studentId))).sort((a, b) => order[a.status] - order[b.status] || b.created_at.localeCompare(a.created_at));
    }),
  all: () => safe(() => all<Goal>('goals')),
  create: (g: Partial<Goal>) =>
    safe(async () => {
      const id = newId('goals');
      const data: DocumentData = { description: '', category_id: null, status: 'active', target_date: null, achieved_on: null, ...clean(g), created_at: now(), updated_at: now() };
      const b = new Batcher();
      b.set(ref('goals', id), data);
      b.log('goals', 'created', String(data.title ?? ''), id);
      b.commitInBackground();
      return withId<Goal>(id, data);
    }),
  update: (id: string, patch: Partial<Goal>) =>
    safe(async () => {
      const r = ref('goals', id);
      const cur = (await readDoc(r)).data();
      if (!cur) throw new ApiError('El objetivo ya no existe.', 'not-found');
      const next: DocumentData = { ...cur, ...clean(patch), updated_at: now() };
      const b = new Batcher();
      b.set(r, next);
      b.log('goals', 'updated', String(next.title ?? ''), id);
      b.commitInBackground();
      return withId<Goal>(id, next);
    }),
  remove: (id: string) =>
    safe(async () => {
      const cur = (await readDoc(ref('goals', id))).data();
      const b = new Batcher();
      b.delete(ref('goals', id));
      b.log('goals', 'deleted', String(cur?.title ?? ''), id);
      b.commitInBackground();
    }),
};

// ------------------------------------------------------------------ Actividad y búsqueda
export const activityApi = {
  recent: (n = 12) => safe(() => all<ActivityEntry>('activity', orderBy('created_at', 'desc'), qLimit(n))),
};

export const searchApi = {
  lessons: (q: string) =>
    safe(async () => {
      const term = norm(q);
      return (await all<Lesson>('lessons'))
        .filter((l) => norm(`${l.plan} ${l.notes} ${l.summary} ${l.next_goals} ${l.lesson_type} ${l.location}`).includes(term))
        .sort((a, b) => b.starts_at.localeCompare(a.starts_at))
        .slice(0, 50);
    }),
};

/** Exporta todos los datos del profesor (copia de seguridad en JSON). */
export async function exportAll() {
  return safe(async () => {
    const out: Record<string, unknown> = { profile: await profileApi.get() };
    for (const c of ['categories', 'students', 'groups', 'series', 'lessons', 'tasks', 'notes', 'goals'] as const) out[c] = (await getDocsSafe(col(c))).docs.map((d) => ({ id: d.id, ...d.data() }));
    return { exported_at: now(), app: 'Aulora', version: 2, data: out };
  });
}

// =============================================================================
// Consultas en vivo (onSnapshot)
//
// Muestran primero lo que hay en la caché del dispositivo (al instante) y se
// actualizan solas con el servidor, también cuando cambias algo desde otro
// dispositivo. La interfaz las usa a través de useLive (hooks/data.ts).
// =============================================================================
export interface LiveDef<T> {
  subscribe(onData: (data: T, meta: { fromCache: boolean; empty: boolean }) => void, onError: (e: ApiError) => void): () => void;
}

function liveQuery<T>(build: () => Query<DocumentData>, map: (docs: QueryDocumentSnapshot<DocumentData>[]) => T): LiveDef<T> {
  return {
    subscribe: (onData, onError) =>
      onSnapshot(
        build(),
        // también avisa cuando el servidor confirma lo que había en caché (p. ej. una lista vacía)
        { includeMetadataChanges: true },
        (s) => onData(map(s.docs), { fromCache: s.metadata.fromCache, empty: s.empty }),
        (e) => onError(humanize(e)),
      ),
  };
}

const asList = <T,>(docs: QueryDocumentSnapshot<DocumentData>[]) => docs.map((d) => withId<T>(d.id, d.data()));
const asTasks = (docs: QueryDocumentSnapshot<DocumentData>[]) => docs.map((d) => toTask(d.id, d.data()));
const newestWeekFirst = (a: Task, b: Task) => b.week_start.localeCompare(a.week_start) || a.created_at.localeCompare(b.created_at);

export const live = {
  profile: (): LiveDef<Profile | null> => ({
    subscribe: (onData, onError) =>
      onSnapshot(
        doc(db(), 'users', uid()),
        { includeMetadataChanges: true },
        (s) => onData(s.exists() ? ({ ...(s.data() as Profile), id: s.id } as Profile) : null, { fromCache: s.metadata.fromCache, empty: !s.exists() }),
        (e) => onError(humanize(e)),
      ),
  }),
  categories: () =>
    liveQuery(() => col('categories'), (d) => asList<Category>(d).sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name))),
  students: () =>
    liveQuery(
      () => col('students'),
      (d) =>
        asList<Student>(d)
          .map((s) => ({ ...s, group_ids: s.group_ids ?? [] }))
          .sort((a, b) => fullName(a).localeCompare(fullName(b), 'es')),
    ),
  groups: () => liveQuery(() => col('groups'), (d) => asList<Group>(d).sort((a, b) => a.name.localeCompare(b.name, 'es'))),
  lessonsRange: (fromIso: string, toIso: string) =>
    liveQuery(
      () => query(col('lessons'), where('starts_at', '>=', new Date(fromIso).toISOString()), where('starts_at', '<', new Date(toIso).toISOString()), orderBy('starts_at')),
      (d) => asList<Lesson>(d),
    ),
  lesson: (id: string): LiveDef<Lesson> => ({
    subscribe: (onData, onError) =>
      onSnapshot(
        ref('lessons', id),
        { includeMetadataChanges: true },
        (s) => {
          if (s.exists()) onData(withId<Lesson>(s.id, s.data()), { fromCache: s.metadata.fromCache, empty: false });
          else if (!s.metadata.fromCache) onError(new ApiError('Clase no encontrada', 'not-found'));
        },
        (e) => onError(humanize(e)),
      ),
  }),
  tasksWeek: (week: string) => liveQuery(() => query(col('tasks'), where('week_start', '==', week)), (d) => asTasks(d).sort(byWeekThenCreated)),
  tasksWeeks: (from: string, to: string) =>
    liveQuery(() => query(col('tasks'), where('week_start', '>=', from), where('week_start', '<=', to)), (d) => asTasks(d).sort(byWeekThenCreated)),
  tasksStudent: (sid: string) => liveQuery(() => query(col('tasks'), where('student_ids', 'array-contains', sid)), (d) => asTasks(d).sort(newestWeekFirst)),
  tasksGroup: (gid: string) => liveQuery(() => query(col('tasks'), where('group_id', '==', gid)), (d) => asTasks(d).sort(newestWeekFirst)),
  allTasks: () => liveQuery(() => col('tasks'), (d) => asTasks(d).sort(newestWeekFirst)),
  pending: () =>
    liveQuery(
      () => query(col('tasks'), where('has_pending', '==', true)),
      (d) => asTasks(d).flatMap((t) => t.assignments.filter((a) => a.status === 'pending')),
    ),
  notes: (sid: string) => liveQuery(() => query(col('notes'), where('student_id', '==', sid)), (d) => asList<ProgressNote>(d).sort(byNotedDesc)),
  allNotes: () => liveQuery(() => col('notes'), (d) => asList<ProgressNote>(d).sort(byNotedDesc)),
  goals: (sid: string) =>
    liveQuery(
      () => query(col('goals'), where('student_id', '==', sid)),
      (d) => {
        const order = { active: 0, achieved: 1, dropped: 2 } as const;
        return asList<Goal>(d).sort((a, b) => order[a.status] - order[b.status] || b.created_at.localeCompare(a.created_at));
      },
    ),
  allGoals: () => liveQuery(() => col('goals'), (d) => asList<Goal>(d)),
  activity: (n = 12) => liveQuery(() => query(col('activity'), orderBy('created_at', 'desc'), qLimit(n)), (d) => asList<ActivityEntry>(d)),
};

/** Todas las clases (para la búsqueda): se leen una vez y se filtran en el dispositivo. */
export const allLessons = () => safe(async () => (await all<Lesson>('lessons')).sort((a, b) => b.starts_at.localeCompare(a.starts_at)));
