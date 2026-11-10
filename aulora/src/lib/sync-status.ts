'use client';
import { useEffect, useState, useSyncExternalStore } from 'react';

/**
 * Estado de la sincronización con la nube (Firestore).
 *
 * Los cambios se guardan primero en el dispositivo y se envían en segundo
 * plano. Este módulo vigila ese envío para avisar cuando los datos NO están
 * llegando a la nube: sin conexión, envíos atascados, o servidor que rechaza
 * los datos (p. ej. base de datos inexistente o reglas sin publicar).
 */

export type SyncProblem = { code: string; message: string };

const SERIOUS = new Set(['permission-denied', 'not-found', 'unauthenticated', 'failed-precondition', 'invalid-argument', 'resource-exhausted']);

type State = {
  inflight: Map<number, number>; // id → instante de inicio
  error: SyncProblem | null;
  serverSeenAt: number | null;
  startedAt: number;
  online: boolean;
};

const state: State = {
  inflight: new Map(),
  error: null,
  serverSeenAt: null,
  startedAt: Date.now(),
  online: typeof navigator === 'undefined' ? true : navigator.onLine,
};
let version = 0;
const listeners = new Set<() => void>();
const emit = () => {
  version++;
  listeners.forEach((l) => l());
};

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    state.online = true;
    emit();
  });
  window.addEventListener('offline', () => {
    state.online = false;
    emit();
  });
}

let nextId = 1;
/** Vigila un envío al servidor (escritura en segundo plano o cola pendiente). */
export function trackWrite(p: Promise<unknown>, opts: { confirmsServer?: boolean } = {}) {
  const confirms = opts.confirmsServer ?? true;
  const id = nextId++;
  state.inflight.set(id, Date.now());
  emit();
  p.then(
    () => {
      state.inflight.delete(id);
      // una escritura confirmada demuestra que la nube funciona
      if (confirms) {
        state.serverSeenAt = Date.now();
        if (state.error) state.error = null;
      }
      emit();
    },
    (e) => {
      state.inflight.delete(id);
      reportSyncError(e);
    },
  );
}

/** El servidor ha respondido (consulta confirmada): la conexión con la nube funciona. */
export function reportServerSeen() {
  const first = state.serverSeenAt === null;
  state.serverSeenAt = Date.now();
  if (first || state.error) {
    if (state.error && state.inflight.size === 0) state.error = null;
    emit();
  }
}

/** Traduce un error de Firestore a un problema de sincronización (o null si no impide guardar). */
export function describeSyncError(e: unknown): SyncProblem | null {
  const code = (e as { code?: string })?.code ?? '';
  if (!SERIOUS.has(code)) return null;
  const raw = (e as Error)?.message ?? '';
  const message = /database.*does not exist|not exist for project/i.test(raw)
    ? 'La base de datos en la nube no existe todavía.'
    : code === 'permission-denied'
      ? 'La nube rechaza los datos (permisos). Revisa que las reglas de Firestore estén publicadas.'
      : code === 'unauthenticated'
        ? 'Tu sesión ha caducado. Cierra sesión y vuelve a entrar.'
        : code === 'resource-exhausted'
          ? 'Se ha superado la cuota gratuita de Firebase por hoy.'
          : raw || 'La nube no acepta los cambios.';
  return { code, message };
}

/** Error del servidor al guardar o leer. Solo los que impiden guardar se muestran. */
export function reportSyncError(e: unknown) {
  const problem = describeSyncError(e);
  if (!problem) return;
  state.error = problem;
  emit();
}

export type SyncLevel = 'ok' | 'offline' | 'stalled' | 'unreachable' | 'error';

export interface SyncStatus {
  level: SyncLevel;
  pending: number;
  problem: SyncProblem | null;
  lastSyncedAt: number | null;
}

const STALLED_MS = 8000;
const UNREACHABLE_MS = 12000;

function compute(now: number): SyncStatus {
  const pending = state.inflight.size;
  const oldest = pending ? Math.min(...state.inflight.values()) : null;
  let level: SyncLevel = 'ok';
  if (state.error) level = 'error';
  else if (!state.online) level = 'offline';
  else if (oldest !== null && now - oldest > STALLED_MS) level = 'stalled';
  else if (state.serverSeenAt === null && now - state.startedAt > UNREACHABLE_MS) level = 'unreachable';
  return { level, pending, problem: state.error, lastSyncedAt: state.serverSeenAt };
}

/** Estado actual de la sincronización (se reevalúa cada segundo para detectar atascos). */
export function useSyncStatus(): SyncStatus {
  useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => version,
    () => 0,
  );
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  return compute(now);
}

/** Número de cambios aún no confirmados por la nube (para avisar al cerrar sesión). */
export function pendingWrites() {
  return state.inflight.size;
}

/** Empieza a vigilar de cero al iniciar sesión (o cambiar de cuenta). */
export function startSyncWatch() {
  state.inflight.clear();
  state.error = null;
  state.serverSeenAt = null;
  state.startedAt = Date.now();
  emit();
}
