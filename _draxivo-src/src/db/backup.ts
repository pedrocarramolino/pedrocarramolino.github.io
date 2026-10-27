// Exportación e importación de copias de seguridad (JSON) y exportación CSV.
import { DB_VERSION, getDB, notify, type StoreName } from './database';
import { backupSchema, type BackupFile } from '../domain/schemas';
import type { BodyWeight, Exercise, Measurement, Workout } from './types';
import { MEASUREMENTS, MUSCLES, SET_TYPES, TRACKING, EQUIPMENT } from '../lib/labels';
import { workoutStats } from '../domain/metrics';

type DataKey = keyof BackupFile['data'];
const KEYS: DataKey[] = ['settings', 'exercises', 'folders', 'routines', 'workouts', 'bodyweights', 'measurements', 'photos', 'plan', 'weekgoals', 'reviews'];

function blobToDataUrl(b: Blob): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result));
    r.onerror = () => rej(r.error);
    r.readAsDataURL(b);
  });
}

function dataUrlToBlob(url: string): Blob {
  const [head, body] = url.split(',');
  const mime = /data:([^;]+)/.exec(head)?.[1] ?? 'image/jpeg';
  const bin = atob(body);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

export async function exportBackup(opts: { includePhotos: boolean }): Promise<BackupFile> {
  const db = await getDB();
  const [settings, exercises, folders, routines, workouts, bodyweights, measurements, photos, plan, weekgoals, reviews] = await Promise.all([
    db.getAll('settings'),
    db.getAll('exercises'),
    db.getAll('folders'),
    db.getAll('routines'),
    db.getAll('workouts'),
    db.getAll('bodyweights'),
    db.getAll('measurements'),
    opts.includePhotos ? db.getAll('photos') : Promise.resolve([]),
    db.getAll('plan'),
    db.getAll('weekgoals'),
    db.getAll('reviews'),
  ]);
  const photoRecords = [];
  for (const p of photos) {
    photoRecords.push({ id: p.id, date: p.date, pose: p.pose, mime: p.mime, note: p.note, createdAt: p.createdAt, updatedAt: p.updatedAt, dataUrl: await blobToDataUrl(p.blob) });
  }
  return {
    app: 'draxivo',
    format: 1,
    schemaVersion: DB_VERSION,
    exportedAt: new Date().toISOString(),
    data: {
      settings,
      exercises,
      folders,
      routines,
      workouts: workouts.filter((w) => w.status === 'completed'),
      bodyweights,
      measurements,
      photos: photoRecords,
      plan,
      weekgoals,
      reviews: reviews as BackupFile['data']['reviews'],
    } as BackupFile['data'],
  };
}

export interface ImportPlan {
  file: BackupFile;
  counts: Record<DataKey, { add: number; update: number; skip: number }>;
  total: number;
}

export type ImportResult = { ok: true; plan: ImportPlan } | { ok: false; errors: string[] };

function keyOf(k: DataKey, rec: Record<string, unknown>): string {
  return k === 'weekgoals' ? String(rec.weekStart) : String(rec.id);
}

/** Valida el archivo y calcula qué se añadiría o actualizaría, sin escribir nada. */
export async function planImport(text: string, opts: { includeSettings: boolean }): Promise<ImportResult> {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return { ok: false, errors: ['El archivo no es un JSON válido.'] };
  }
  const parsed = backupSchema.safeParse(json);
  if (!parsed.success) {
    const errors = parsed.error.issues.slice(0, 8).map((i) => `${i.path.join('.') || 'archivo'}: ${i.message}`);
    return { ok: false, errors: ['El archivo no es una copia de DRAXIVO compatible.', ...errors] };
  }
  const file = parsed.data;
  if (file.schemaVersion > DB_VERSION) {
    return { ok: false, errors: ['La copia procede de una versión más reciente de DRAXIVO. Actualiza la aplicación antes de importarla.'] };
  }
  const db = await getDB();
  const counts = {} as ImportPlan['counts'];
  let total = 0;
  const existingBW = await db.getAll('bodyweights');
  const bwSig = new Set(existingBW.map((b) => `${b.date}|${b.time ?? ''}|${b.weightKg}`));
  const existingEx = await db.getAll('exercises');
  const exNames = new Map(existingEx.map((e) => [e.name.toLocaleLowerCase('es'), e.id]));
  for (const k of KEYS) {
    counts[k] = { add: 0, update: 0, skip: 0 };
    if (k === 'settings' && !opts.includeSettings) {
      counts[k].skip = file.data.settings.length;
      continue;
    }
    for (const rec of file.data[k] as unknown as Record<string, unknown>[]) {
      const cur = (await db.get(k as StoreName as 'exercises', keyOf(k, rec))) as unknown as { updatedAt?: number } | undefined;
      if (!cur) {
        // Evita duplicados con identificadores distintos pero contenido equivalente.
        if (k === 'bodyweights' && bwSig.has(`${rec.date}|${rec.time ?? ''}|${rec.weightKg}`)) {
          counts[k].skip++;
          continue;
        }
        if (k === 'exercises' && exNames.has(String(rec.name).toLocaleLowerCase('es'))) {
          counts[k].skip++;
          continue;
        }
        counts[k].add++;
      } else if ((rec.updatedAt as number) > (cur.updatedAt ?? 0)) counts[k].update++;
      else counts[k].skip++;
    }
    total += counts[k].add + counts[k].update;
  }
  return { ok: true, plan: { file, counts, total } };
}

/** Aplica la importación en una única transacción: o se importa todo o nada. */
export async function applyImport(plan: ImportPlan, opts: { includeSettings: boolean }) {
  const db = await getDB();
  const stores: StoreName[] = ['settings', 'exercises', 'folders', 'routines', 'workouts', 'bodyweights', 'measurements', 'photos', 'plan', 'weekgoals', 'reviews'];
  // Prepara los blobs fuera de la transacción.
  const photos = plan.file.data.photos.map((p) => ({ id: p.id, date: p.date, pose: p.pose, mime: p.mime, note: p.note, createdAt: p.createdAt, updatedAt: p.updatedAt, blob: dataUrlToBlob(p.dataUrl) }));
  const existingBW = await db.getAll('bodyweights');
  const bwSig = new Set(existingBW.map((b) => `${b.date}|${b.time ?? ''}|${b.weightKg}`));
  const existingEx = await db.getAll('exercises');
  const exNames = new Map(existingEx.map((e) => [e.name.toLocaleLowerCase('es'), e.id]));
  const exRemap = new Map<string, string>();

  const tx = db.transaction(stores, 'readwrite');
  const put = async (k: DataKey, rec: Record<string, unknown>) => {
    const store = tx.objectStore(k as 'exercises');
    const cur = (await store.get(keyOf(k, rec))) as unknown as { updatedAt?: number } | undefined;
    if (cur && (rec.updatedAt as number) <= (cur.updatedAt ?? 0)) return;
    if (!cur && k === 'bodyweights' && bwSig.has(`${rec.date}|${rec.time ?? ''}|${rec.weightKg}`)) return;
    if (!cur && k === 'exercises') {
      const same = exNames.get(String(rec.name).toLocaleLowerCase('es'));
      if (same) {
        exRemap.set(String(rec.id), same);
        return;
      }
    }
    await store.put(rec as unknown as Exercise);
  };
  if (opts.includeSettings) for (const s of plan.file.data.settings) await put('settings', s);
  for (const k of KEYS) {
    if (k === 'settings' || k === 'photos') continue;
    let list = plan.file.data[k] as unknown as Record<string, unknown>[];
    if ((k === 'routines' || k === 'workouts') && exRemap.size) {
      list = list.map((r) => ({
        ...r,
        exercises: (r.exercises as { exerciseId: string }[]).map((e) => ({ ...e, exerciseId: exRemap.get(e.exerciseId) ?? e.exerciseId })),
      }));
    }
    for (const rec of list) await put(k, rec);
  }
  for (const p of photos) await put('photos', p as unknown as Record<string, unknown>);
  await tx.done;
  notify(...stores);
}

// ---------- CSV ----------
function csvCell(v: unknown): string {
  if (v == null) return '';
  const s = String(v);
  return /[",;\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCSV(headers: string[], rows: unknown[][]): string {
  // BOM para que Excel reconozca UTF-8.
  return '﻿' + [headers, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n');
}

export async function exportCSV(kind: 'workouts' | 'sets' | 'routines' | 'exercises' | 'bodyweights' | 'measurements' | 'reviews' | 'settings'): Promise<string> {
  const db = await getDB();
  switch (kind) {
    case 'workouts': {
      const ws = (await db.getAll('workouts')).filter((w) => w.status === 'completed').sort((a, b) => a.startedAt - b.startedAt);
      return toCSV(
        ['id', 'fecha', 'nombre', 'rutina', 'inicio', 'fin', 'duracion_min', 'ejercicios', 'series', 'repeticiones', 'volumen_kg', 'notas'],
        ws.map((w: Workout) => {
          const s = workoutStats(w);
          return [w.id, w.date, w.name, w.routineName ?? '', new Date(w.startedAt).toISOString(), w.endedAt ? new Date(w.endedAt).toISOString() : '', Math.round(s.durationMs / 60000), s.exercises, s.sets, s.reps, s.volume, w.notes];
        }),
      );
    }
    case 'sets': {
      const ws = (await db.getAll('workouts')).filter((w) => w.status === 'completed').sort((a, b) => a.startedAt - b.startedAt);
      const rows: unknown[][] = [];
      for (const w of ws)
        w.exercises.forEach((e, ei) =>
          e.sets.forEach((s, si) =>
            rows.push([w.id, w.date, w.name, ei + 1, e.name, MUSCLES[e.primaryMuscle], TRACKING[e.tracking], si + 1, SET_TYPES[s.type].label, s.weight ?? '', s.reps ?? '', s.rpe ?? '', s.rir ?? '', s.durationSec ?? '', s.distanceM ?? '', s.completed ? 'sí' : 'no']),
          ),
        );
      return toCSV(['entrenamiento_id', 'fecha', 'entrenamiento', 'orden_ejercicio', 'ejercicio', 'grupo_muscular', 'tipo', 'serie', 'tipo_serie', 'peso_kg', 'repeticiones', 'rpe', 'rir', 'duracion_s', 'distancia_m', 'completada'], rows);
    }
    case 'routines': {
      const rs = await db.getAll('routines');
      const exs = new Map((await db.getAll('exercises')).map((e) => [e.id, e.name]));
      const folders = new Map((await db.getAll('folders')).map((f) => [f.id, f.name]));
      const rows: unknown[][] = [];
      for (const r of rs) {
        if (!r.exercises.length) rows.push([r.id, r.name, folders.get(r.folderId ?? '') ?? '', r.category, r.goal, r.archived ? 'sí' : 'no', '', '', '', '', '', '', '', '']);
        r.exercises.forEach((e, ei) =>
          e.sets.forEach((s, si) =>
            rows.push([r.id, r.name, folders.get(r.folderId ?? '') ?? '', r.category, r.goal, r.archived ? 'sí' : 'no', ei + 1, exs.get(e.exerciseId) ?? e.exerciseId, si + 1, SET_TYPES[s.type].label, s.repsMin ?? '', s.repsMax ?? '', s.weight ?? '', e.restSec ?? '']),
          ),
        );
      }
      return toCSV(['rutina_id', 'rutina', 'carpeta', 'categoria', 'objetivo', 'archivada', 'orden', 'ejercicio', 'serie', 'tipo_serie', 'reps_min', 'reps_max', 'peso_kg', 'descanso_s'], rows);
    }
    case 'exercises': {
      const exs = (await db.getAll('exercises')).sort((a, b) => a.name.localeCompare(b.name, 'es'));
      return toCSV(
        ['id', 'nombre', 'grupo_principal', 'secundarios', 'equipamiento', 'tipo_registro', 'personalizado', 'archivado', 'notas'],
        exs.map((e: Exercise) => [e.id, e.name, MUSCLES[e.primaryMuscle], e.secondaryMuscles.map((m) => MUSCLES[m]).join(' | '), EQUIPMENT[e.equipment], TRACKING[e.tracking], e.custom ? 'sí' : 'no', e.archived ? 'sí' : 'no', e.notes]),
      );
    }
    case 'bodyweights': {
      const bw = (await db.getAll('bodyweights')).sort((a, b) => a.date.localeCompare(b.date));
      return toCSV(['id', 'fecha', 'hora', 'peso_kg', 'nota'], bw.map((b: BodyWeight) => [b.id, b.date, b.time ?? '', b.weightKg, b.note]));
    }
    case 'measurements': {
      const ms = (await db.getAll('measurements')).sort((a, b) => a.date.localeCompare(b.date));
      return toCSV(['id', 'fecha', 'medida', 'valor', 'unidad', 'nota'], ms.map((m: Measurement) => [m.id, m.date, MEASUREMENTS[m.type], m.value, m.unit, m.note]));
    }
    case 'reviews': {
      const rs = (await db.getAll('reviews')).sort((a, b) => a.weekStart.localeCompare(b.weekStart));
      return toCSV(
        ['semana_inicio', 'semana_fin', 'estado', 'sesiones', 'objetivo', 'minutos', 'series', 'volumen_kg', 'peso_medio_kg', 'semana', 'energia', 'recuperacion', 'sueno', 'molestias', 'lo_mejor', 'mejorar', 'objetivo_siguiente', 'nota_objetivo'],
        rs.map((r) => [r.weekStart, r.weekEnd, r.status === 'completed' ? 'completada' : 'borrador', r.metrics.completedSessions, r.metrics.goalSessions, r.metrics.totalMinutes, r.metrics.sets, r.metrics.volumeKg, r.metrics.weightAvg ?? '', r.answers.week ?? '', r.answers.energy ?? '', r.answers.recovery ?? '', r.answers.sleep ?? '', r.answers.discomfort, r.answers.bestThing, r.answers.improve, r.nextGoalSessions ?? '', r.nextGoalText]),
      );
    }
    case 'settings': {
      const s = await db.get('settings', 'settings');
      if (!s) return toCSV(['clave', 'valor'], []);
      return toCSV(
        ['clave', 'valor'],
        Object.entries(s)
          .filter(([k]) => k !== 'id')
          .map(([k, v]) => [k, Array.isArray(v) ? v.join(' | ') : v]),
      );
    }
  }
}

export function downloadText(filename: string, text: string, mime: string) {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
