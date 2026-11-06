'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Dialog } from '@/components/ui/overlay';
import { Button, Field, LabeledInput, NumberInput, Select, Textarea, rangeError } from '@/components/ui/controls';
import { ColorPicker, StudentMultiPicker } from '@/components/ui/pickers';
import { useAction, useLookup, useProfile } from '@/hooks/data';
import { groupApi, type GroupInput } from '@/services/api';
import { WEEKDAYS } from '@/lib/dates';
import type { Group } from '@/lib/types';

export function GroupForm({ group, onClose }: { group?: Group; onClose: () => void }) {
  const router = useRouter();
  const { students, membersOf } = useLookup();
  const profile = useProfile();
  const editing = !!group;
  // id del elemento nuevo generado al abrir: su ficha se precarga mientras se rellena el formulario
  const [presetId] = useState(() => (editing ? null : groupApi.newId()));
  useEffect(() => {
    if (presetId) // precarga completa (datos y código) de la ficha, no solo hasta la pantalla de carga
    router.prefetch(`/grupos/${presetId}`, { kind: 'full' as never });
  }, [presetId, router]);
  const initialMembers = group ? membersOf(group.id) : [];
  const [form, setForm] = useState<GroupInput>(() => ({
    name: group?.name ?? '',
    description: group?.description ?? '',
    subject: group?.subject ?? '',
    usual_weekday: group?.usual_weekday ?? null,
    usual_time: group?.usual_time?.slice(0, 5) ?? null,
    lesson_minutes: group?.lesson_minutes ?? profile.data?.default_lesson_minutes ?? 60,
    location: group?.location ?? '',
    notes: group?.notes ?? '',
    color: group?.color ?? 'teal',
    archived: group?.archived ?? false,
  }));
  const [memberIds, setMemberIds] = useState<string[]>(initialMembers);
  const [minutes, setMinutes] = useState<number | null>(group?.lesson_minutes ?? profile.data?.default_lesson_minutes ?? 60);
  const [error, setError] = useState<string>();
  const set = <K extends keyof GroupInput>(k: K, v: GroupInput[K]) => setForm((f) => ({ ...f, [k]: v }));

  const save = useAction(
    async () => {
      const clean = { ...form, name: form.name.trim(), usual_time: form.usual_time || null, lesson_minutes: minutes ?? 60 };
      const saved = editing ? await groupApi.update(group.id, clean) : await groupApi.create(clean, presetId ?? undefined);
      await groupApi.setMembers(saved.id, memberIds, initialMembers);
      return saved;
    },
    {
      success: editing ? 'Grupo actualizado' : 'Grupo creado',
      invalidate: ['groups', 'students'],
      onDone: (g) => {
        onClose();
        if (!editing) router.push(`/grupos/${g.id}`);
      },
    },
  );

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return setError('El nombre del grupo es obligatorio');
    const minutesProblem = rangeError(minutes, 5, 600, 'la duración (en minutos)');
    if (minutesProblem) return setError(minutesProblem);
    setError(undefined);
    save.mutate(undefined);
  };

  return (
    <Dialog
      open
      onClose={onClose}
      title={editing ? 'Editar grupo' : 'Nuevo grupo'}
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="primary" type="submit" form="group-form" loading={save.isPending}>
            {editing ? 'Guardar cambios' : 'Crear grupo'}
          </Button>
        </>
      }
    >
      <form id="group-form" onSubmit={submit} className="space-y-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <LabeledInput label="Nombre del grupo *" value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Lenguaje Musical 1" required />
          <LabeledInput label="Especialidad o asignatura" value={form.subject} onChange={(e) => set('subject', e.target.value)} placeholder="Lenguaje musical" />
          <Field label="Día habitual">
            <Select value={form.usual_weekday ?? ''} onChange={(e) => set('usual_weekday', e.target.value ? Number(e.target.value) : null)}>
              <option value="">Sin día fijo</option>
              {WEEKDAYS.map((d, i) => (
                <option key={d} value={i + 1}>
                  {d}
                </option>
              ))}
            </Select>
          </Field>
          <LabeledInput label="Hora habitual" type="time" value={form.usual_time ?? ''} onChange={(e) => set('usual_time', e.target.value)} />
          <Field label="Duración (min)" hint="Entre 5 y 600 minutos">
            <NumberInput value={minutes} onValueChange={setMinutes} maxLength={3} placeholder="60" />
          </Field>
          <LabeledInput label="Aula o ubicación" value={form.location} onChange={(e) => set('location', e.target.value)} placeholder="Aula 3" />
        </div>
        <Field label="Descripción">
          <Textarea value={form.description} onChange={(e) => set('description', e.target.value)} rows={2} />
        </Field>
        <Field label={`Integrantes (${memberIds.length})`}>
          <StudentMultiPicker students={students.filter((s) => s.status !== 'archived' || memberIds.includes(s.id))} value={memberIds} onChange={setMemberIds} />
        </Field>
        <Field label="Color identificativo">
          <ColorPicker value={form.color} onChange={(c) => set('color', c)} />
        </Field>
        <Field label="Observaciones">
          <Textarea value={form.notes} onChange={(e) => set('notes', e.target.value)} rows={2} />
        </Field>
        {error ? <p className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p> : null}
      </form>
    </Dialog>
  );
}
