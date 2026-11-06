'use client';
import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Camera, Trash2 } from 'lucide-react';
import { Dialog } from '@/components/ui/overlay';
import { Button, Field, Input, LabeledInput, Select, Textarea } from '@/components/ui/controls';
import { Avatar } from '@/components/ui/display';
import { ColorPicker, GroupChips } from '@/components/ui/pickers';
import { useAction, useLookup, useProfile } from '@/hooks/data';
import { groupApi, studentApi, type StudentInput } from '@/services/api';
import { LEVELS, STUDENT_STATUS } from '@/lib/labels';
import { colorFor } from '@/lib/colors';
import { toDateKey } from '@/lib/dates';
import type { Student, StudentStatus } from '@/lib/types';

/** Redimensiona una imagen a una miniatura cuadrada JPEG (data URL). */
async function toThumbnail(file: File, size = 192): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, size, size);
  return canvas.toDataURL('image/jpeg', 0.82);
}

export function StudentForm({ student, onClose }: { student?: Student; onClose: () => void }) {
  const router = useRouter();
  const { groups, groupsOf } = useLookup();
  const profile = useProfile();
  const editing = !!student;
  const initialGroups = student ? groupsOf(student.id) : [];
  const [form, setForm] = useState<StudentInput>(() => ({
    first_name: student?.first_name ?? '',
    last_name: student?.last_name ?? '',
    photo: student?.photo ?? null,
    instrument: student?.instrument ?? '',
    phone: student?.phone ?? '',
    email: student?.email ?? '',
    joined_on: student?.joined_on ?? toDateKey(new Date()),
    usual_schedule: student?.usual_schedule ?? '',
    lesson_minutes: student?.lesson_minutes ?? profile.data?.default_lesson_minutes ?? 60,
    level: student?.level ?? '',
    notes: student?.notes ?? '',
    status: student?.status ?? 'active',
    color: student?.color ?? colorFor(String(Math.random())),
  }));
  const [groupIds, setGroupIds] = useState<string[]>(initialGroups);
  const [error, setError] = useState<string>();
  const fileRef = useRef<HTMLInputElement>(null);
  const set = <K extends keyof StudentInput>(k: K, v: StudentInput[K]) => setForm((f) => ({ ...f, [k]: v }));

  const save = useAction(
    async () => {
      const clean = { ...form, first_name: form.first_name.trim(), last_name: form.last_name.trim(), email: form.email.trim(), joined_on: form.joined_on || null };
      const saved = editing ? await studentApi.update(student.id, clean) : await studentApi.create(clean);
      await groupApi.setStudentGroups(saved.id, groupIds, initialGroups);
      return saved;
    },
    {
      success: editing ? 'Alumno actualizado' : 'Alumno creado',
      invalidate: ['students', 'groups'],
      onDone: (s) => {
        onClose();
        if (!editing) router.push(`/alumnos/${s.id}`);
      },
    },
  );

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.first_name.trim()) return setError('El nombre es obligatorio');
    if (form.email && !/^\S+@\S+\.\S+$/.test(form.email.trim())) return setError('El correo no parece válido');
    setError(undefined);
    save.mutate(undefined);
  };

  const onPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    try {
      set('photo', await toThumbnail(f));
    } catch {
      setError('No se pudo leer la imagen');
    }
  };

  const fullName = `${form.first_name} ${form.last_name}`.trim() || 'Nuevo alumno';

  return (
    <Dialog
      open
      onClose={onClose}
      title={editing ? 'Editar alumno' : 'Nuevo alumno'}
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="primary" type="submit" form="student-form" loading={save.isPending}>
            {editing ? 'Guardar cambios' : 'Crear alumno'}
          </Button>
        </>
      }
    >
      <form id="student-form" onSubmit={submit} className="space-y-5">
        <div className="flex items-center gap-4">
          <button type="button" onClick={() => fileRef.current?.click()} className="group relative" aria-label="Cambiar fotografía">
            <Avatar name={fullName} photo={form.photo} color={form.color} size={64} />
            <span className="absolute -right-1 -bottom-1 flex size-6 items-center justify-center rounded-full border border-border bg-surface shadow-sm">
              <Camera className="size-3.5 text-fg-2" />
            </span>
          </button>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onPhoto} />
          <div className="min-w-0 flex-1 space-y-2">
            <p className="truncate font-medium">{fullName}</p>
            <div className="flex gap-2">
              <Button size="sm" onClick={() => fileRef.current?.click()}>
                {form.photo ? 'Cambiar foto' : 'Añadir foto'}
              </Button>
              {form.photo ? (
                <Button size="sm" variant="ghost" onClick={() => set('photo', null)}>
                  <Trash2 className="size-3.5" /> Quitar
                </Button>
              ) : null}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <LabeledInput label="Nombre *" value={form.first_name} onChange={(e) => set('first_name', e.target.value)} autoComplete="off" required />
          <LabeledInput label="Apellidos" value={form.last_name} onChange={(e) => set('last_name', e.target.value)} autoComplete="off" />
          <LabeledInput label="Instrumento o especialidad" value={form.instrument} onChange={(e) => set('instrument', e.target.value)} placeholder="Trompeta, Piano, Lenguaje musical…" />
          <Field label="Nivel musical">
            <Input list="aulora-levels" value={form.level} onChange={(e) => set('level', e.target.value)} placeholder="Elemental 2, Profesional 1…" />
            <datalist id="aulora-levels">
              {LEVELS.map((l) => (
                <option key={l} value={l} />
              ))}
            </datalist>
          </Field>
          <LabeledInput label="Teléfono" type="tel" inputMode="tel" value={form.phone} onChange={(e) => set('phone', e.target.value)} />
          <LabeledInput label="Correo electrónico" type="email" inputMode="email" value={form.email} onChange={(e) => set('email', e.target.value)} />
          <LabeledInput label="Fecha de incorporación" type="date" value={form.joined_on ?? ''} onChange={(e) => set('joined_on', e.target.value)} />
          <LabeledInput
            label="Duración de la clase (min)"
            type="number"
            min={5}
            max={600}
            step={5}
            inputMode="numeric"
            value={form.lesson_minutes}
            onChange={(e) => set('lesson_minutes', Number(e.target.value) || 0)}
          />
          <LabeledInput label="Horario habitual" value={form.usual_schedule} onChange={(e) => set('usual_schedule', e.target.value)} placeholder="Martes 17:30" />
          <Field label="Estado">
            <Select value={form.status} onChange={(e) => set('status', e.target.value as StudentStatus)}>
              {Object.entries(STUDENT_STATUS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <Field label="Grupos" hint="Un alumno puede pertenecer a varios grupos.">
          <GroupChips groups={groups.filter((g) => !g.archived || groupIds.includes(g.id))} value={groupIds} onChange={setGroupIds} />
        </Field>

        <Field label="Color identificativo">
          <ColorPicker value={form.color} onChange={(c) => set('color', c)} />
        </Field>

        <Field label="Observaciones personales">
          <Textarea value={form.notes} onChange={(e) => set('notes', e.target.value)} rows={3} placeholder="Información útil sobre el alumno, familia, objetivos generales…" />
        </Field>
        {error ? <p className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p> : null}
      </form>
    </Dialog>
  );
}
