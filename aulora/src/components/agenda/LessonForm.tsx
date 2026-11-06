'use client';
import { useMemo, useState } from 'react';
import { AlertTriangle, Repeat } from 'lucide-react';
import { addDays, differenceInCalendarDays } from 'date-fns';
import { Dialog } from '@/components/ui/overlay';
import { Button, Checkbox, Field, Input, LabeledInput, Segmented, Select, Textarea } from '@/components/ui/controls';
import { WeekdayPicker } from '@/components/ui/pickers';
import { studentName, useAction, useLookup, useProfile } from '@/hooks/data';
import { lessonApi, seriesApi, type LessonInput } from '@/services/api';
import { LESSON_STATUS, LESSON_TYPES } from '@/lib/labels';
import { generateOccurrences } from '@/lib/recurrence';
import { findConflicts } from '@/lib/conflicts';
import { atTime, fmt, fromDateKey, hhmm, isoWeekday, toDateKey, timeRange } from '@/lib/dates';
import type { Lesson, LessonStatus } from '@/lib/types';
import type { LessonDraft } from '@/components/layout/ui-store';

type Scope = 'one' | 'following';

function defaultEnd(start: Date) {
  // fin de curso: 30 de junio siguiente (o del mismo año si aún no ha llegado)
  const y = start.getMonth() >= 6 ? start.getFullYear() + 1 : start.getFullYear();
  return toDateKey(new Date(y, 5, 30));
}

export function LessonForm({ draft, onClose }: { draft: LessonDraft; onClose: () => void }) {
  const lookup = useLookup();
  const profile = useProfile();
  const existing = draft.lesson;
  const editing = !!existing;
  const startDate = existing ? new Date(existing.starts_at) : (draft.start ?? roundedNow());

  const initialStudent = existing?.student_id ?? draft.studentId ?? '';
  const initialGroup = existing?.group_id ?? draft.groupId ?? '';
  const [kind, setKind] = useState<'student' | 'group'>(initialGroup ? 'group' : 'student');
  const [studentId, setStudentId] = useState(initialStudent);
  const [groupId, setGroupId] = useState(initialGroup);
  const [date, setDate] = useState(toDateKey(startDate));
  const [time, setTime] = useState(hhmm(startDate));
  const defaultMinutes = (() => {
    if (existing) return existing.duration_minutes;
    if (draft.groupId) return lookup.groupById.get(draft.groupId)?.lesson_minutes ?? 60;
    if (draft.studentId) return lookup.studentById.get(draft.studentId)?.lesson_minutes ?? 60;
    return profile.data?.default_lesson_minutes ?? 60;
  })();
  const [minutes, setMinutes] = useState(defaultMinutes);
  const [type, setType] = useState(existing?.lesson_type ?? (initialGroup ? 'Colectiva' : 'Individual'));
  const [location, setLocation] = useState(existing?.location ?? (initialGroup ? (lookup.groupById.get(initialGroup)?.location ?? '') : ''));
  const [plan, setPlan] = useState(existing?.plan ?? '');
  const [notes, setNotes] = useState(existing?.notes ?? '');
  const [status, setStatus] = useState<LessonStatus>(existing?.status ?? 'scheduled');
  const [recurring, setRecurring] = useState(false);
  const [weekdays, setWeekdays] = useState<number[]>([isoWeekday(startDate)]);
  const [endDate, setEndDate] = useState(defaultEnd(startDate));
  const [scope, setScope] = useState<Scope>('one');
  const [error, setError] = useState<string>();
  const [conflicts, setConflicts] = useState<{ start: Date; with: Lesson[] }[] | null>(null);

  const occurrences = useMemo(
    () => (recurring && !editing ? generateOccurrences({ weekdays, startTime: time, startDate: date, endDate }) : []),
    [recurring, editing, weekdays, time, date, endDate],
  );

  // el día de la semana de la serie sigue a la fecha mientras no se personalice
  const changeDate = (v: string) => {
    if (v && date && weekdays.length === 1 && weekdays[0] === isoWeekday(fromDateKey(date))) setWeekdays([isoWeekday(fromDateKey(v))]);
    setDate(v);
  };

  const pickStudent = (id: string) => {
    setStudentId(id);
    const s = lookup.studentById.get(id);
    if (s && !editing) setMinutes(s.lesson_minutes);
  };
  const pickGroup = (id: string) => {
    setGroupId(id);
    const g = lookup.groupById.get(id);
    if (g && !editing) {
      setMinutes(g.lesson_minutes);
      if (g.location) setLocation(g.location);
    }
  };
  const pickKind = (k: 'student' | 'group') => {
    setKind(k);
    if (!editing) setType(k === 'group' ? 'Colectiva' : 'Individual');
  };

  const save = useAction(
    async (force: boolean) => {
      const target = kind === 'student' ? { student_id: studentId, group_id: null } : { student_id: null, group_id: groupId };
      const start = atTime(fromDateKey(date), time);
      const base: LessonInput = { ...target, duration_minutes: minutes, lesson_type: type, location: location.trim(), plan, notes, status };

      // ---- Edición de varias sesiones de una serie
      if (editing && existing.series_id && scope === 'following') {
        const following = await lessonApi.seriesFollowing(existing.series_id, existing.starts_at);
        const list = following.some((l) => l.id === existing.id) ? following : [existing, ...following];
        const dayShift = differenceInCalendarDays(fromDateKey(date), fromDateKey(toDateKey(new Date(existing.starts_at))));
        const planned = list.map((l) => {
          const s = atTime(addDays(new Date(l.starts_at), dayShift), time);
          return { lesson: l, start: s, end: new Date(s.getTime() + minutes * 60_000) };
        });
        if (!force) {
          const found = await detectConflicts(planned.map((p) => ({ start: p.start, end: p.end })), new Set(list.map((l) => l.id)));
          if (found.length) return { conflicts: found };
        }
        for (let i = 0; i < planned.length; i += 8) {
          await Promise.all(
            planned.slice(i, i + 8).map((p) =>
              lessonApi.update(p.lesson.id, {
                ...target,
                starts_at: p.start.toISOString(),
                duration_minutes: minutes,
                lesson_type: type,
                location: location.trim(),
                ...(p.lesson.id === existing.id ? { plan, notes, status } : {}),
              }),
            ),
          );
        }
        const series = await seriesApi.get(existing.series_id).catch(() => null);
        if (series) {
          await seriesApi.update(series.id, {
            start_time: time,
            duration_minutes: minutes,
            lesson_type: type,
            location: location.trim(),
            weekdays: [...new Set(series.weekdays.map((w) => ((w - 1 + dayShift) % 7 + 7) % 7 + 1))].sort(),
          });
        }
        return { message: `${planned.length} sesiones actualizadas` };
      }

      // ---- Edición de una sesión
      if (editing) {
        const end = new Date(start.getTime() + minutes * 60_000);
        if (!force && status !== 'cancelled') {
          const found = await detectConflicts([{ start, end }], new Set([existing.id]));
          if (found.length) return { conflicts: found };
        }
        const moved = start.toISOString() !== new Date(existing.starts_at).toISOString();
        await lessonApi.update(existing.id, {
          ...base,
          starts_at: start.toISOString(),
          is_modified: existing.series_id ? true : existing.is_modified,
          original_starts_at: moved && !existing.original_starts_at ? existing.starts_at : existing.original_starts_at,
        });
        return { message: 'Clase actualizada' };
      }

      // ---- Nueva serie recurrente
      if (recurring) {
        if (!occurrences.length) throw new Error('La serie no genera ninguna sesión. Revisa los días y las fechas.');
        if (!force) {
          const found = await detectConflicts(occurrences.map((s) => ({ start: s, end: new Date(s.getTime() + minutes * 60_000) })));
          if (found.length) return { conflicts: found };
        }
        const series = await seriesApi.create({
          ...target,
          lesson_type: type,
          weekdays,
          start_time: time,
          duration_minutes: minutes,
          start_date: date,
          end_date: endDate,
          location: location.trim(),
        });
        try {
          await lessonApi.createMany(occurrences.map((s) => ({ ...base, series_id: series.id, starts_at: s.toISOString() })));
        } catch (e) {
          await seriesApi.remove(series.id).catch(() => {});
          throw e;
        }
        return { message: `Serie creada: ${occurrences.length} clases` };
      }

      // ---- Nueva clase suelta
      const end = new Date(start.getTime() + minutes * 60_000);
      if (!force) {
        const found = await detectConflicts([{ start, end }]);
        if (found.length) return { conflicts: found };
      }
      await lessonApi.create({ ...base, starts_at: start.toISOString() });
      return { message: 'Clase programada' };
    },
    {
      invalidate: ['lessons'],
      success: (r) => ('message' in r ? (r.message ?? null) : null),
      onDone: (r) => {
        if ('conflicts' in r && r.conflicts) setConflicts(r.conflicts);
        else onClose();
      },
    },
  );

  const submit = (force = false) => {
    if (kind === 'student' && !studentId) return setError('Elige un alumno');
    if (kind === 'group' && !groupId) return setError('Elige un grupo');
    if (!date || !time) return setError('Indica fecha y hora');
    if (!minutes || minutes < 5) return setError('La duración mínima es de 5 minutos');
    if (recurring && !weekdays.length) return setError('Elige al menos un día de la semana');
    if (recurring && endDate < date) return setError('La fecha de fin debe ser posterior al inicio');
    setError(undefined);
    setConflicts(null);
    save.mutate(force);
  };

  const students = lookup.students.filter((s) => s.status === 'active' || s.id === studentId);
  const groups = lookup.groups.filter((g) => !g.archived || g.id === groupId);

  return (
    <Dialog
      open
      onClose={onClose}
      title={editing ? 'Editar clase' : 'Nueva clase'}
      description={editing && existing.series_id ? 'Esta clase forma parte de una serie recurrente.' : undefined}
      size="lg"
      footer={
        conflicts ? (
          <>
            <Button variant="ghost" onClick={() => setConflicts(null)}>
              Revisar
            </Button>
            <Button variant="danger" onClick={() => submit(true)} loading={save.isPending}>
              Guardar de todos modos
            </Button>
          </>
        ) : (
          <>
            <Button variant="ghost" onClick={onClose}>
              Cancelar
            </Button>
            <Button variant="primary" onClick={() => submit(false)} loading={save.isPending}>
              {editing ? 'Guardar' : recurring ? `Crear ${occurrences.length} clases` : 'Programar clase'}
            </Button>
          </>
        )
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit(false);
        }}
        className="space-y-5"
      >
        {conflicts ? (
          <div className="animate-rise rounded-xl border border-warning/40 bg-warning-soft p-4">
            <div className="flex items-center gap-2 font-medium text-warning">
              <AlertTriangle className="size-4" />
              Conflicto de horario
            </div>
            <p className="mt-1 text-sm text-fg-2">
              {conflicts.length === 1 ? 'Ya hay una clase a esa hora:' : `${conflicts.length} sesiones coinciden con otras clases:`}
            </p>
            <ul className="mt-2 space-y-1 text-sm">
              {conflicts.slice(0, 5).map((c, i) => (
                <li key={i} className="flex flex-wrap gap-x-2">
                  <span className="font-medium capitalize">{fmt(c.start, "EEE d MMM, HH:mm")}</span>
                  <span className="text-fg-2">
                    con {c.with.map((l) => `${lookup.targetName(l)} (${timeRange(l.starts_at, l.ends_at)})`).join(', ')}
                  </span>
                </li>
              ))}
              {conflicts.length > 5 ? <li className="text-muted">y {conflicts.length - 5} más…</li> : null}
            </ul>
          </div>
        ) : null}

        <div className="space-y-3">
          <Segmented
            value={kind}
            onChange={pickKind}
            options={[
              { value: 'student', label: 'Alumno' },
              { value: 'group', label: 'Grupo' },
            ]}
          />
          {kind === 'student' ? (
            <Select aria-label="Alumno" value={studentId} onChange={(e) => pickStudent(e.target.value)}>
              <option value="">Elige un alumno…</option>
              {students.map((s) => (
                <option key={s.id} value={s.id}>
                  {studentName(s)}
                  {s.instrument ? ` · ${s.instrument}` : ''}
                </option>
              ))}
            </Select>
          ) : (
            <Select aria-label="Grupo" value={groupId} onChange={(e) => pickGroup(e.target.value)}>
              <option value="">Elige un grupo…</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name} ({lookup.membersOf(g.id).length})
                </option>
              ))}
            </Select>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <LabeledInput label={recurring ? 'Empieza el' : 'Fecha'} type="date" value={date} onChange={(e) => changeDate(e.target.value)} required />
          <LabeledInput label="Hora" type="time" step={300} value={time} onChange={(e) => setTime(e.target.value)} required />
          <Field label="Duración">
            <div className="flex items-center gap-1.5">
              <Input type="number" min={5} max={600} step={5} inputMode="numeric" value={minutes} onChange={(e) => setMinutes(Number(e.target.value) || 0)} aria-label="Duración en minutos" />
              <span className="text-sm text-muted">min</span>
            </div>
          </Field>
          <Field label="Tipo">
            <Select value={type} onChange={(e) => setType(e.target.value)}>
              {[...new Set([...LESSON_TYPES, type])].map((t) => (
                <option key={t}>{t}</option>
              ))}
            </Select>
          </Field>
        </div>
        <div className="-mt-2 flex flex-wrap gap-1.5">
          {[30, 45, 60, 90].map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMinutes(m)}
              className={`h-7 rounded-md px-2 text-xs font-medium transition-colors ${minutes === m ? 'bg-accent-soft text-accent' : 'bg-surface-2 text-fg-2 hover:bg-surface-3'}`}
            >
              {m} min
            </button>
          ))}
          <span className="ml-auto self-center text-xs text-muted">
            {/^\d{2}:\d{2}/.test(time) && minutes > 0 ? `Termina a las ${hhmm(new Date(atTime(new Date(), time).getTime() + minutes * 60_000))}` : ''}
          </span>
        </div>

        {!editing ? (
          <div className="rounded-xl border border-border p-3.5">
            <Checkbox
              checked={recurring}
              onChange={setRecurring}
              label={
                <span className="flex items-center gap-1.5 font-medium">
                  <Repeat className="size-4 text-muted" /> Repetir cada semana
                </span>
              }
            />
            {recurring ? (
              <div className="animate-rise mt-3.5 space-y-3">
                <Field label="Días de la semana">
                  <WeekdayPicker value={weekdays} onChange={setWeekdays} />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <LabeledInput label="Hasta el" type="date" value={endDate} min={date} onChange={(e) => setEndDate(e.target.value)} />
                  <div className="flex items-end pb-2 text-sm text-muted">
                    {occurrences.length ? `Se crearán ${occurrences.length} clases` : 'Sin sesiones'}
                  </div>
                </div>
                <p className="text-xs text-muted">Cada sesión se guarda por separado: podrás modificar o cancelar una sin afectar al resto.</p>
              </div>
            ) : null}
          </div>
        ) : null}

        {editing && existing.series_id ? (
          <Field label="Aplicar cambios de fecha, hora, duración, tipo y lugar a">
            <Segmented
              value={scope}
              onChange={setScope}
              options={[
                { value: 'one', label: 'Solo esta sesión' },
                { value: 'following', label: 'Esta y las siguientes' },
              ]}
            />
          </Field>
        ) : null}

        {editing ? (
          <Field label="Estado">
            <Segmented
              value={status}
              onChange={setStatus}
              options={(Object.keys(LESSON_STATUS) as LessonStatus[]).map((s) => ({ value: s, label: LESSON_STATUS[s] }))}
            />
          </Field>
        ) : null}

        <LabeledInput label="Aula o ubicación" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Opcional" />
        <Field label="Contenido previsto">
          <Textarea value={plan} onChange={(e) => setPlan(e.target.value)} rows={2} placeholder="Qué vais a trabajar en esta clase" />
        </Field>
        <Field label="Anotaciones">
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
        </Field>
        {error ? <p className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p> : null}
        <button type="submit" className="hidden" />
      </form>
    </Dialog>
  );
}

function roundedNow() {
  const d = new Date();
  d.setMinutes(Math.ceil(d.getMinutes() / 15) * 15, 0, 0);
  return d;
}

/** Busca solapes con clases existentes en el rango de los candidatos. */
export async function detectConflicts(candidates: { start: Date; end: Date }[], exclude = new Set<string>()) {
  if (!candidates.length) return [];
  const from = new Date(Math.min(...candidates.map((c) => c.start.getTime())));
  const to = new Date(Math.max(...candidates.map((c) => c.end.getTime())));
  // margen para clases que empiezan antes y terminan dentro del rango
  const existing = await lessonApi.range(new Date(from.getTime() - 10 * 3600_000).toISOString(), to.toISOString());
  return findConflicts(candidates, existing, exclude).map((c) => ({ start: c.candidate.start, with: c.with }));
}
