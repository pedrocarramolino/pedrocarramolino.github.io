'use client';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { addDays } from 'date-fns';
import { useConfirm } from '@/components/ui/overlay';
import { useInvalidate, useLookup } from '@/hooks/data';
import { lessonApi, seriesApi } from '@/services/api';
import { fmt, timeRange, toDateKey } from '@/lib/dates';
import type { Lesson, LessonStatus } from '@/lib/types';

/** Acciones sobre clases compartidas por la agenda, el panel y la ficha. */
export function useLessonActions() {
  const qc = useQueryClient();
  const invalidate = useInvalidate();
  const confirm = useConfirm();
  const lookup = useLookup();

  /** Actualiza la caché al instante y revierte si el servidor falla. */
  const optimistic = async (id: string, patch: Partial<Lesson>, fn: () => Promise<unknown>, msg?: string) => {
    const snapshots = qc.getQueriesData<Lesson[] | Lesson>({ predicate: (q) => ['lessons', 'lesson', 'lessons-for'].includes(String(q.queryKey[0])) });
    qc.setQueriesData<Lesson[] | Lesson>({ predicate: (q) => ['lessons', 'lesson', 'lessons-for'].includes(String(q.queryKey[0])) }, (old) => {
      if (!old) return old;
      if (Array.isArray(old)) return old.map((l) => (l.id === id ? { ...l, ...patch } : l));
      return old.id === id ? { ...old, ...patch } : old;
    });
    try {
      await fn();
      if (msg) toast.success(msg);
    } catch (e) {
      snapshots.forEach(([k, v]) => qc.setQueryData(k, v));
      toast.error((e as Error).message);
      throw e;
    } finally {
      invalidate('lessons');
    }
  };

  const setStatus = (l: Lesson, status: LessonStatus) =>
    optimistic(
      l.id,
      { status },
      () => lessonApi.update(l.id, { status, is_modified: l.series_id ? true : l.is_modified }),
      status === 'completed' ? 'Clase marcada como realizada' : status === 'cancelled' ? 'Sesión cancelada' : 'Clase restaurada',
    );

  /** Mueve/redimensiona una sesión (solo esa) avisando de conflictos. */
  const move = async (l: Lesson, start: Date, minutes: number) => {
    const end = new Date(start.getTime() + minutes * 60_000);
    if (l.status !== 'cancelled') {
      const hits = await lessonApi.conflicts(start.toISOString(), end.toISOString(), [l.id]).catch(() => []);
      if (hits.length) {
        const ok = await confirm({
          title: 'Conflicto de horario',
          description: `A esa hora ya tienes ${hits.map((h) => `${lookup.targetName(h)} (${timeRange(h.starts_at, h.ends_at)})`).join(', ')}. ¿Mover la clase igualmente?`,
          confirmLabel: 'Mover igualmente',
        });
        if (!ok) return false;
      }
    }
    const moved = start.getTime() !== new Date(l.starts_at).getTime();
    const patch = {
      starts_at: start.toISOString(),
      ends_at: end.toISOString(),
      duration_minutes: minutes,
      is_modified: l.series_id ? true : l.is_modified,
      original_starts_at: moved && !l.original_starts_at ? l.starts_at : l.original_starts_at,
    };
    const { ends_at: _omit, ...serverPatch } = patch;
    void _omit;
    await optimistic(l.id, patch, () => lessonApi.update(l.id, serverPatch), moved ? `Clase movida a ${fmt(start, "EEE d, HH:mm")}` : 'Duración actualizada').catch(() => {});
    return true;
  };

  const remove = async (l: Lesson) => {
    if (!l.series_id) {
      const ok = await confirm({
        title: '¿Eliminar la clase?',
        description: 'Se borrarán también sus anotaciones y resumen. Si solo no va a celebrarse, mejor cancélala.',
        confirmLabel: 'Eliminar',
        danger: true,
      });
      if (!ok) return false;
      await lessonApi.remove(l.id).then(
        () => toast.success('Clase eliminada'),
        (e) => toast.error(e.message),
      );
      await invalidate('lessons');
      return true;
    }
    const ok = await confirm({
      title: '¿Eliminar esta sesión?',
      description: 'Solo se eliminará esta sesión; el resto de la serie no cambia. Para terminar la serie usa «Eliminar esta y las siguientes».',
      confirmLabel: 'Eliminar sesión',
      danger: true,
    });
    if (!ok) return false;
    await lessonApi.remove(l.id).then(
      () => toast.success('Sesión eliminada'),
      (e) => toast.error(e.message),
    );
    await invalidate('lessons');
    return true;
  };

  const removeFollowing = async (l: Lesson) => {
    if (!l.series_id) return false;
    const following = await lessonApi.seriesFollowing(l.series_id, l.starts_at);
    const ids = [...new Set([l.id, ...following.map((f) => f.id)])];
    const ok = await confirm({
      title: '¿Eliminar esta y las siguientes?',
      description: `Se eliminarán ${ids.length} sesiones programadas a partir del ${fmt(l.starts_at, "d 'de' MMMM")}. Las clases ya realizadas o canceladas se conservan.`,
      confirmLabel: `Eliminar ${ids.length}`,
      danger: true,
    });
    if (!ok) return false;
    try {
      await lessonApi.removeMany(ids);
      await seriesApi.update(l.series_id, { end_date: toDateKey(addDays(new Date(l.starts_at), -1)) }).catch(() => {});
      toast.success(`${ids.length} sesiones eliminadas`);
    } catch (e) {
      toast.error((e as Error).message);
    }
    await invalidate('lessons');
    return true;
  };

  return { setStatus, move, remove, removeFollowing };
}
