import { useMemo, useState } from 'react';
import { Check, Plus, Search } from 'lucide-react';
import type { Equipment, Exercise, MovementType, MuscleGroup, TrackingType } from '../db/types';
import { useQuery } from '../app/hooks';
import { getActiveWorkout, listExercises, listRoutines, listWorkouts, saveBodyWeight, saveExercise, startWorkout } from '../db/repo';
import { Button, Field, Input, Select, Sheet, TextArea, cx, NumberInput, useConfirm } from '../ui/kit';
import { EQUIPMENT, MOVEMENTS, MUSCLES, TRACKING } from '../lib/labels';
import { useToast, useSettings } from '../app/context';
import { navigate } from '../app/router';
import { fromDisplayWeight, toDisplayWeight, wUnit } from '../lib/units';
import { dateKey, timeKey, today } from '../lib/dates';
import type { BodyWeight } from '../db/types';

export const useWorkouts = () => useQuery(listWorkouts, ['workouts']);
export const useRoutines = () => useQuery(listRoutines, ['routines']);
export const useExercises = (includeArchived = true) => useQuery(() => listExercises(includeArchived), ['exercises'], [includeArchived]);

export function useExerciseMap() {
  const all = useExercises(true);
  return useMemo(() => new Map((all ?? []).map((e) => [e.id, e])), [all]);
}

export function normalize(s: string) {
  return s
    .toLocaleLowerCase('es')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

/** Inicia un entrenamiento manejando el caso de que ya exista uno en curso. */
export function useStartWorkout() {
  const toast = useToast();
  const confirm = useConfirm();
  return async (routineId?: string | null, planEntryId?: string | null) => {
    const active = await getActiveWorkout();
    if (active) {
      const go = await confirm({ title: 'Entrenamiento en curso', message: `Ya tienes «${active.name}» en curso. ¿Quieres volver a él?`, confirmLabel: 'Ir al entrenamiento' });
      if (go) navigate('/workout');
      return;
    }
    try {
      await startWorkout({ routineId, planEntryId });
      navigate('/workout');
    } catch (e) {
      toast((e as Error).message, { tone: 'error' });
    }
  };
}

// ---------- Selector de ejercicios ----------
export function ExercisePicker({
  open,
  onClose,
  onPick,
  multi = true,
  title = 'Añadir ejercicios',
}: {
  open: boolean;
  onClose: () => void;
  onPick: (ex: Exercise[]) => void;
  multi?: boolean;
  title?: string;
}) {
  const all = useExercises(false);
  const [q, setQ] = useState('');
  const [muscle, setMuscle] = useState<MuscleGroup | ''>('');
  const [equip, setEquip] = useState<Equipment | ''>('');
  const [sel, setSel] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);
  const list = useMemo(() => {
    const nq = normalize(q.trim());
    return (all ?? []).filter(
      (e) => (!nq || normalize(e.name).includes(nq)) && (!muscle || e.primaryMuscle === muscle || e.secondaryMuscles.includes(muscle)) && (!equip || e.equipment === equip),
    );
  }, [all, q, muscle, equip]);
  const close = () => {
    setSel([]);
    setQ('');
    onClose();
  };
  const done = (ids: string[]) => {
    const byId = new Map((all ?? []).map((e) => [e.id, e]));
    onPick(ids.map((id) => byId.get(id)!).filter(Boolean));
    close();
  };
  return (
    <>
      <Sheet
        open={open && !creating}
        onClose={close}
        title={title}
        size="full"
        footer={
          multi ? (
            <Button variant="primary" disabled={!sel.length} onClick={() => done(sel)}>
              {sel.length ? `Añadir ${sel.length}` : 'Selecciona ejercicios'}
            </Button>
          ) : undefined
        }
      >
        <div className="search">
          <Search size={18} />
          <Input type="search" placeholder="Buscar ejercicio" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar ejercicio" />
        </div>
        <div className="form-grid">
          <Select value={muscle} onChange={(v) => setMuscle(v as MuscleGroup | '')} aria-label="Grupo muscular">
            <option value="">Todos los músculos</option>
            {Object.entries(MUSCLES).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </Select>
          <Select value={equip} onChange={(v) => setEquip(v as Equipment | '')} aria-label="Equipamiento">
            <option value="">Todo el equipamiento</option>
            {Object.entries(EQUIPMENT).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </Select>
        </div>
        <Button variant="plain" icon={<Plus size={18} />} onClick={() => setCreating(true)} className="mt">
          Crear ejercicio personalizado
        </Button>
        <div className="list mt">
          {list.map((e) => {
            const on = sel.includes(e.id);
            return (
              <button
                key={e.id}
                type="button"
                className="row row-button"
                aria-pressed={multi ? on : undefined}
                onClick={() => (multi ? setSel((s) => (on ? s.filter((x) => x !== e.id) : [...s, e.id])) : done([e.id]))}
              >
                <span className="row-main">
                  <span className="row-title">{e.name}</span>
                  <span className="row-subtitle">
                    {MUSCLES[e.primaryMuscle]} · {EQUIPMENT[e.equipment]}
                    {e.custom ? ' · Personalizado' : ''}
                  </span>
                </span>
                {multi && <span className={cx('check-btn', on && 'on')}>{on && <Check size={18} />}</span>}
              </button>
            );
          })}
          {!list.length && <div className="row muted">No hay ejercicios con esos filtros.</div>}
        </div>
      </Sheet>
      <ExerciseForm
        open={open && creating}
        onClose={() => setCreating(false)}
        onSaved={(ex) => {
          setCreating(false);
          if (multi) setSel((s) => [...s, ex.id]);
          else {
            onPick([ex]);
            close();
          }
        }}
        initial={{ name: q }}
      />
    </>
  );
}

// ---------- Formulario de ejercicio ----------
export function ExerciseForm({
  open,
  onClose,
  onSaved,
  initial,
}: {
  open: boolean;
  onClose: () => void;
  onSaved?: (e: Exercise) => void;
  initial?: Partial<Exercise>;
}) {
  const toast = useToast();
  const [f, setF] = useState<Partial<Exercise>>({});
  const [key, setKey] = useState<string | null>(null);
  const k = `${open}-${initial?.id ?? 'new'}`;
  if (open && key !== k) {
    setKey(k);
    setF({
      name: '',
      primaryMuscle: 'pecho',
      secondaryMuscles: [],
      equipment: 'mancuernas',
      movement: 'compuesto',
      tracking: 'weight_reps',
      instructions: '',
      notes: '',
      custom: true,
      archived: false,
      ...initial,
    });
  }
  if (!open && key !== null) setKey(null);
  const set = (p: Partial<Exercise>) => setF((x) => ({ ...x, ...p }));
  const save = async () => {
    try {
      const ex = await saveExercise(f as Exercise);
      toast(initial?.id ? 'Ejercicio actualizado' : 'Ejercicio creado');
      onSaved?.(ex);
      onClose();
    } catch (e) {
      toast((e as Error).message, { tone: 'error' });
    }
  };
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={initial?.id ? 'Editar ejercicio' : 'Nuevo ejercicio'}
      size="lg"
      footer={
        <>
          <Button onClick={onClose}>Cancelar</Button>
          <Button variant="primary" onClick={save} disabled={!f.name?.trim()}>
            Guardar
          </Button>
        </>
      }
    >
      <Field label="Nombre">
        <Input value={f.name ?? ''} onChange={(e) => set({ name: e.target.value })} maxLength={80} data-autofocus placeholder="Ej.: Press inclinado en Smith" />
      </Field>
      <div className="form-grid">
        <Field label="Grupo principal">
          <Select value={f.primaryMuscle ?? 'pecho'} onChange={(v) => set({ primaryMuscle: v as MuscleGroup })}>
            {Object.entries(MUSCLES).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Equipamiento">
          <Select value={f.equipment ?? 'otros'} onChange={(v) => set({ equipment: v as Equipment })}>
            {Object.entries(EQUIPMENT).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Tipo de registro" hint="Determina qué se anota y qué métricas se calculan.">
          <Select value={f.tracking ?? 'weight_reps'} onChange={(v) => set({ tracking: v as TrackingType })}>
            {Object.entries(TRACKING).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Movimiento">
          <Select value={f.movement ?? 'compuesto'} onChange={(v) => set({ movement: v as MovementType })}>
            {Object.entries(MOVEMENTS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <Field label="Músculos secundarios">
        <div className="chips chips-wrap">
          {(Object.keys(MUSCLES) as MuscleGroup[])
            .filter((m) => m !== f.primaryMuscle)
            .map((m) => {
              const on = f.secondaryMuscles?.includes(m);
              return (
                <button
                  type="button"
                  key={m}
                  className={cx('chip', on && 'active')}
                  aria-pressed={on}
                  onClick={() => set({ secondaryMuscles: on ? f.secondaryMuscles!.filter((x) => x !== m) : [...(f.secondaryMuscles ?? []), m] })}
                >
                  {MUSCLES[m]}
                </button>
              );
            })}
        </div>
      </Field>
      <Field label="Instrucciones">
        <TextArea value={f.instructions ?? ''} onChange={(e) => set({ instructions: e.target.value })} maxLength={2000} />
      </Field>
      <Field label="Notas personales">
        <TextArea value={f.notes ?? ''} onChange={(e) => set({ notes: e.target.value })} maxLength={2000} placeholder="Ajustes de la máquina, agarre, sensaciones…" />
      </Field>
    </Sheet>
  );
}

// ---------- Registro de peso corporal ----------
export function WeightSheet({ open, onClose, entry }: { open: boolean; onClose: () => void; entry?: BodyWeight | null }) {
  const toast = useToast();
  const { settings } = useSettings();
  const [key, setKey] = useState<string | null>(null);
  const [date, setDate] = useState(today());
  const [time, setTime] = useState('');
  const [value, setValue] = useState<number | null>(null);
  const [note, setNote] = useState('');
  const k = `${open}-${entry?.id ?? 'new'}`;
  if (open && key !== k) {
    setKey(k);
    setDate(entry?.date ?? today());
    setTime(entry?.time ?? (entry ? '' : timeKey()));
    setValue(entry ? toDisplayWeight(entry.weightKg) : null);
    setNote(entry?.note ?? '');
  }
  if (!open && key !== null) setKey(null);
  const save = async () => {
    if (value == null) return;
    try {
      await saveBodyWeight({ id: entry?.id, createdAt: entry?.createdAt, date, time: time || null, weightKg: fromDisplayWeight(value), note });
      toast(entry ? 'Registro corregido' : 'Peso registrado');
      onClose();
    } catch (e) {
      toast((e as Error).message, { tone: 'error' });
    }
  };
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={entry ? 'Editar registro de peso' : 'Registrar peso'}
      footer={
        <>
          <Button onClick={onClose}>Cancelar</Button>
          <Button variant="primary" onClick={save} disabled={value == null || value <= 0 || date > dateKey()}>
            Guardar
          </Button>
        </>
      }
    >
      <Field label={`Peso (${wUnit()})`}>
        <NumberInput value={value} onChange={setValue} placeholder={settings.weightUnit === 'kg' ? '72,5' : '160'} ariaLabel="Peso corporal" className="input-lg" />
      </Field>
      <div className="form-grid">
        <Field label="Fecha" error={date > dateKey() ? 'No puede ser una fecha futura.' : undefined}>
          <Input type="date" value={date} max={today()} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="Hora (opcional)">
          <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
        </Field>
      </div>
      <Field label="Nota (opcional)">
        <Input value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} placeholder="Ej.: en ayunas" />
      </Field>
    </Sheet>
  );
}
