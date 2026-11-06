'use client';
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { addWeeks } from 'date-fns';
import { Info, Users } from 'lucide-react';
import { Dialog } from '@/components/ui/overlay';
import { Button, Checkbox, Field, Input } from '@/components/ui/controls';
import { Avatar } from '@/components/ui/display';
import { studentName, useAction, useLookup } from '@/hooks/data';
import { taskApi } from '@/services/api';
import { fromDateKey, toDateKey, weekKey, weekLabel } from '@/lib/dates';
import type { TaskWithAssignments } from '@/lib/types';

/**
 * Copia tareas de una semana a otra. Muestra cuáles ya se copiaron a la
 * semana destino (no se pueden copiar dos veces) y permite elegir.
 * `studentId` limita la copia a la asignación de ese alumno.
 */
export function DuplicateDialog({
  tasks,
  fromWeek,
  studentId,
  title,
  onClose,
}: {
  tasks: TaskWithAssignments[];
  fromWeek: string;
  studentId?: string;
  title?: string;
  onClose: () => void;
}) {
  const lookup = useLookup();
  const [target, setTarget] = useState(toDateKey(addWeeks(fromDateKey(fromWeek), 1)));
  const copies = useQuery({ queryKey: ['copies', target], queryFn: () => taskApi.copiesIn(target) });
  const keys = useMemo(() => new Set((copies.data ?? []).map((c) => c.copy_key)), [copies.data]);
  const scopeOf = (t: TaskWithAssignments) => (studentId && t.assignments.length > 1 ? studentId : 'all');
  const already = useMemo(
    () => ({
      has: (id: string) => {
        const t = tasks.find((x) => x.id === id);
        if (!t) return false;
        return keys.has(`${id}:${target}:all`) || keys.has(`${id}:${target}:${scopeOf(t)}`);
      },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [keys, target, tasks, studentId],
  );
  const [selected, setSelected] = useState<Set<string>>(() => new Set(tasks.map((t) => t.id)));

  const run = useAction(
    async () => {
      const ids = tasks.filter((t) => selected.has(t.id)).map((t) => t.id);
      const individual = tasks.filter((t) => selected.has(t.id) && studentId && t.assignments.length > 1).map((t) => t.id);
      const whole = ids.filter((id) => !individual.includes(id));
      let n = 0;
      if (whole.length) n += await taskApi.duplicate(whole, target, null);
      if (individual.length && studentId) n += await taskApi.duplicate(individual, target, studentId);
      return { n, asked: ids.length };
    },
    {
      invalidate: ['tasks'],
      success: ({ n, asked }) =>
        n === asked ? `${n} ${n === 1 ? 'tarea copiada' : 'tareas copiadas'} a la ${weekLabel(fromDateKey(target)).toLowerCase()}` : `${n} copiadas · ${asked - n} ya existían en esa semana`,
      onDone: onClose,
    },
  );

  // agrupa por destinatario para que la lista sea legible
  const groupsOfTasks = useMemo(() => {
    const m = new Map<string, { label: string; color?: string; isGroup: boolean; photo?: string | null; tasks: TaskWithAssignments[] }>();
    for (const t of tasks) {
      const key = t.group_id ? 'g' + t.group_id : t.assignments.map((a) => a.student_id).sort().join(',');
      const label = t.group_id
        ? (lookup.groupById.get(t.group_id)?.name ?? 'Grupo')
        : t.assignments.map((a) => studentName(lookup.studentById.get(a.student_id))).join(', ') || 'Sin alumnos';
      const first = lookup.studentById.get(t.assignments[0]?.student_id ?? '');
      if (!m.has(key)) m.set(key, { label, color: t.group_id ? lookup.groupById.get(t.group_id)?.color : first?.color, isGroup: !!t.group_id, photo: first?.photo, tasks: [] });
      m.get(key)!.tasks.push(t);
    }
    return [...m.values()];
  }, [tasks, lookup]);

  const toggle = (id: string, on: boolean) =>
    setSelected((s) => {
      const n = new Set(s);
      if (on) n.add(id);
      else n.delete(id);
      return n;
    });
  const effective = tasks.filter((t) => selected.has(t.id) && !already.has(t.id)).length;
  const sameWeek = target === fromWeek;

  return (
    <Dialog
      open
      onClose={onClose}
      title={title ?? 'Copiar tareas a otra semana'}
      description={`Desde la ${weekLabel(fromDateKey(fromWeek)).toLowerCase()}`}
      size="md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={() => run.mutate(undefined)} loading={run.isPending} disabled={!effective || sameWeek}>
            Copiar {effective || ''} {effective === 1 ? 'tarea' : 'tareas'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Semana de destino" hint={weekLabel(fromDateKey(target))}>
          <Input type="date" value={target} onChange={(e) => e.target.value && setTarget(weekKey(fromDateKey(e.target.value)))} />
        </Field>
        {sameWeek ? <p className="text-sm text-danger">Elige una semana distinta a la de origen.</p> : null}
        <div className="flex items-start gap-2 rounded-lg bg-surface-2 px-3 py-2.5 text-xs text-fg-2">
          <Info className="mt-px size-3.5 shrink-0" />
          Las copias empiezan como «Pendiente» y conservan categoría, prioridad y descripción. Después podrás editar solo las que cambien.
        </div>
        <div className="space-y-3">
          {groupsOfTasks.map((g) => (
            <div key={g.label}>
              <div className="mb-1 flex items-center gap-2 text-[13px] font-medium">
                {g.isGroup ? <Users className="size-4 text-muted" /> : <Avatar name={g.label} photo={g.photo} color={g.color} size={20} />}
                <span className="truncate">{g.label}</span>
              </div>
              <div className="space-y-0.5 pl-1">
                {g.tasks.map((t) => {
                  const dup = already.has(t.id);
                  return (
                    <div key={t.id} className="flex items-center gap-2 py-1">
                      <Checkbox checked={!dup && selected.has(t.id)} onChange={(v) => !dup && toggle(t.id, v)} label={<span className={dup ? 'text-muted' : ''}>{t.title}</span>} />
                      {dup ? <span className="ml-auto shrink-0 text-[11px] text-muted">Ya copiada</span> : null}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </Dialog>
  );
}
