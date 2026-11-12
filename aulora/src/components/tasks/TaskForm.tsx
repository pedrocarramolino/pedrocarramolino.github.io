'use client';
import { useState } from 'react';
import { ListPlus, Users } from 'lucide-react';
import { Dialog } from '@/components/ui/overlay';
import { Button, Field, Input, LabeledInput, Segmented, Select, Textarea } from '@/components/ui/controls';
import { Avatar } from '@/components/ui/display';
import { StudentMultiPicker } from '@/components/ui/pickers';
import { cn } from '@/components/ui/cn';
import { studentName, useAction, useLookup } from '@/hooks/data';
import { taskApi } from '@/services/api';
import { ASSIGNMENT_STATUS, PRIORITY, nextStatus } from '@/lib/labels';
import { StatusIcon } from './parts';
import { cvar } from '@/lib/colors';
import { fromDateKey, toDateKey, weekKey, weekLabel } from '@/lib/dates';
import type { AssignmentStatus, TaskPriority } from '@/lib/types';
import type { TaskDraft } from '@/components/layout/ui-store';

export function TaskForm({ draft, onClose }: { draft: TaskDraft; onClose: () => void }) {
  const lookup = useLookup();
  const existing = draft.task;
  const editing = !!existing;
  const today = toDateKey(new Date());
  const [mode, setMode] = useState<'students' | 'group'>(existing ? (existing.group_id ? 'group' : 'students') : draft.groupId ? 'group' : 'students');
  const [studentIds, setStudentIds] = useState<string[]>(existing ? existing.assignments.map((a) => a.student_id) : (draft.studentIds ?? []));
  const [groupId, setGroupId] = useState(existing?.group_id ?? draft.groupId ?? '');
  const [title, setTitle] = useState(existing?.title ?? '');
  const [bulk, setBulk] = useState(false);
  const [description, setDescription] = useState(existing?.description ?? '');
  const [week, setWeek] = useState(existing?.week_start ?? draft.week ?? weekKey(new Date()));
  const [assignedOn, setAssignedOn] = useState(existing?.assigned_on ?? (draft.week && draft.week > today ? draft.week : today));
  const [dueOn, setDueOn] = useState(existing?.due_on ?? '');
  const [categoryId, setCategoryId] = useState(existing?.category_id ?? lookup.categories[0]?.id ?? '');
  const [priority, setPriority] = useState<TaskPriority>(existing?.priority ?? 'normal');
  const [notes, setNotes] = useState(existing?.notes ?? '');
  const [statuses, setStatuses] = useState<Record<string, AssignmentStatus>>(
    Object.fromEntries((existing?.assignments ?? []).map((a) => [a.id, a.status])),
  );
  const [error, setError] = useState<string>();

  const titles = bulk ? title.split('\n').map((t) => t.trim()).filter(Boolean) : [title.trim()].filter(Boolean);

  const save = useAction(
    async () => {
      const fields = {
        description: description.trim(),
        week_start: weekKey(fromDateKey(week)),
        assigned_on: assignedOn || today,
        due_on: dueOn || null,
        category_id: categoryId || null,
        priority,
        notes: notes.trim(),
      };
      if (editing) {
        await taskApi.update(existing.id, { ...fields, title: titles[0] });
        if (!existing.group_id) await taskApi.setStudents(existing.id, studentIds);
        const changed = existing.assignments.filter((a) => statuses[a.id] && statuses[a.id] !== a.status && studentIds.includes(a.student_id));
        for (const a of changed) await taskApi.setStatus([a.id], statuses[a.id]);
        return 1;
      }
      const target = mode === 'group' ? { ids: [] as string[], group: groupId } : { ids: studentIds, group: null };
      for (const t of titles) {
        await taskApi.create({ ...fields, title: t, lesson_id: draft.lessonId ?? null }, target.ids, target.group);
      }
      return titles.length;
    },
    {
      invalidate: ['tasks'],
      success: (n) => (editing ? 'Tarea actualizada' : n === 1 ? 'Tarea asignada' : `${n} tareas asignadas`),
      onDone: onClose,
    },
  );

  const submit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!titles.length) return setError('Escribe el título de la tarea');
    if (!editing && mode === 'students' && !studentIds.length) return setError('Elige al menos un alumno');
    if (!editing && mode === 'group' && !groupId) return setError('Elige un grupo');
    if (dueOn && assignedOn && dueOn < assignedOn) return setError('La fecha de entrega no puede ser anterior a la de asignación');
    setError(undefined);
    save.mutate(undefined);
  };

  const activeStudents = lookup.students.filter((s) => s.status !== 'archived' || studentIds.includes(s.id));
  const groupMembers = groupId ? lookup.membersOf(groupId) : [];

  return (
    <Dialog
      open
      onClose={onClose}
      title={editing ? 'Editar tarea' : 'Nueva tarea'}
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={() => submit()} loading={save.isPending}>
            {editing ? 'Guardar' : titles.length > 1 ? `Asignar ${titles.length} tareas` : 'Asignar tarea'}
          </Button>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-5">
        <Field label={bulk ? 'Tareas (una por línea)' : 'Título'}>
          {bulk ? (
            <Textarea data-autofocus value={title} onChange={(e) => setTitle(e.target.value)} rows={4} placeholder={'Escalas mayores\nEstudio nº 8\nRepasar repertorio de audición'} />
          ) : (
            <Input
              data-autofocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Estudio nº 4, escalas, lectura rítmica pág. 12…"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit();
              }}
            />
          )}
          {!editing ? (
            <button type="button" onClick={() => setBulk((b) => !b)} className="flex items-center gap-1 self-start text-xs font-medium text-accent">
              <ListPlus className="size-3.5" />
              {bulk ? 'Una sola tarea' : 'Añadir varias a la vez'}
            </button>
          ) : null}
        </Field>

        {!editing || !existing.group_id ? (
          <div className="space-y-2.5">
            {!editing ? (
              <Segmented
                value={mode}
                onChange={setMode}
                options={[
                  { value: 'students', label: 'Alumnos' },
                  { value: 'group', label: 'Grupo completo' },
                ]}
              />
            ) : (
              <p className="text-[13px] font-medium text-fg-2">Alumnos asignados</p>
            )}
            {mode === 'group' && !editing ? (
              <>
                <Select aria-label="Grupo" value={groupId} onChange={(e) => setGroupId(e.target.value)}>
                  <option value="">Elige un grupo…</option>
                  {lookup.activeGroups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name} ({lookup.membersOf(g.id).length} integrantes)
                    </option>
                  ))}
                </Select>
                {groupId ? (
                  <p className="text-xs text-muted">
                    Se asignará a {groupMembers.length} {groupMembers.length === 1 ? 'integrante' : 'integrantes'}; cada uno tendrá su propio estado. Para asignarla solo a
                    algunos, elige «Alumnos».
                  </p>
                ) : null}
              </>
            ) : (
              <>
                {lookup.activeGroups.length ? (
                  <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted">
                    <Users className="size-3.5" /> Añadir integrantes de:
                    {lookup.activeGroups.map((g) => (
                      <button
                        key={g.id}
                        type="button"
                        style={cvar(g.color)}
                        onClick={() => setStudentIds((ids) => [...new Set([...ids, ...lookup.membersOf(g.id)])])}
                        className="tint h-6 rounded-md border px-1.5 font-medium"
                      >
                        {g.name}
                      </button>
                    ))}
                  </div>
                ) : null}
                <StudentMultiPicker students={activeStudents} value={studentIds} onChange={setStudentIds} maxHeight={180} />
              </>
            )}
          </div>
        ) : (
          <p className="rounded-lg bg-surface-2 px-3 py-2 text-sm text-fg-2">
            Tarea del grupo <strong>{lookup.groupById.get(existing.group_id)?.name ?? '—'}</strong> · {existing.assignments.length} integrantes
          </p>
        )}

        {editing && existing.assignments.length ? (
          <Field label="Estado por alumno">
            <div className="divide-y divide-border rounded-lg border border-border">
              {existing.assignments
                .filter((a) => studentIds.includes(a.student_id))
                .map((a) => {
                  const s = lookup.studentById.get(a.student_id);
                  return (
                    <div key={a.id} className="flex items-center gap-2.5 px-3 py-2">
                      <Avatar name={studentName(s)} photo={s?.photo} color={s?.color} size={24} />
                      <span className="min-w-0 flex-1 truncate text-sm">{studentName(s)}</span>
                      {(() => {
                        const cur = statuses[a.id] ?? a.status;
                        return (
                          <button
                            type="button"
                            data-status={cur}
                            aria-label={`Estado de ${studentName(s)}: ${ASSIGNMENT_STATUS[cur]}. Cambiar a ${ASSIGNMENT_STATUS[nextStatus(cur)]}`}
                            onClick={() => setStatuses((st) => ({ ...st, [a.id]: nextStatus(cur) }))}
                            className="flex h-8 items-center gap-1.5 rounded-md px-2 text-[13px] text-fg-2 hover:bg-surface-2"
                          >
                            <StatusIcon status={cur} />
                            {ASSIGNMENT_STATUS[cur]}
                          </button>
                        );
                      })()}
                    </div>
                  );
                })}
            </div>
          </Field>
        ) : null}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Field label="Semana" hint={weekLabel(fromDateKey(weekKey(fromDateKey(week || today))))} className="sm:col-span-1">
            <Input type="date" value={week} onChange={(e) => e.target.value && setWeek(weekKey(fromDateKey(e.target.value)))} />
          </Field>
          <LabeledInput label="Asignada el" type="date" value={assignedOn} onChange={(e) => setAssignedOn(e.target.value)} />
          <LabeledInput label="Entrega o revisión" type="date" value={dueOn ?? ''} onChange={(e) => setDueOn(e.target.value)} />
        </div>

        <Field label="Categoría">
          <div className="flex flex-wrap gap-1.5">
            {lookup.categories.map((c) => (
              <button
                key={c.id}
                type="button"
                style={cvar(c.color)}
                onClick={() => setCategoryId(c.id)}
                aria-pressed={categoryId === c.id}
                className={cn('h-8 rounded-lg border px-2.5 text-[13px] font-medium transition-colors', categoryId === c.id ? 'tint' : 'border-border text-fg-2 hover:bg-surface-2')}
              >
                {c.name}
              </button>
            ))}
          </div>
        </Field>

        <div className="flex flex-wrap gap-5">
          <Field label="Prioridad">
            <Segmented value={priority} onChange={setPriority} options={(Object.keys(PRIORITY) as TaskPriority[]).map((p) => ({ value: p, label: PRIORITY[p] }))} />
          </Field>
        </div>

        <Field label="Descripción">
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder="Indicaciones, compases, tempo…" />
        </Field>
        <Field label="Observaciones">
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
        </Field>
        {error ? <p className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p> : null}
        <button type="submit" className="hidden" />
      </form>
    </Dialog>
  );
}
