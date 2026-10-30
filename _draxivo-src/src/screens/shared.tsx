import { useDeferredValue, useMemo, useState } from 'react';
import { Check, Plus, Search } from 'lucide-react';
import type { Equipment, Exercise, MovementType, MuscleGroup, TrackingType } from '../db/types';
import { useQuery } from '../app/hooks';
import { getActiveWorkout, listBodyWeights, listExercises, listRoutines, listWorkouts, saveBodyWeight, saveExercise, startWorkout } from '../db/repo';
import { Button, DateInput, Field, Input, Select, Sheet, TextArea, WheelPicker, cx, NumberInput, useConfirm } from '../ui/kit';
import { ExerciseArt } from '../ui/ExerciseArt';
import { EQUIPMENT, MOVEMENTS, MUSCLES, TRACKING } from '../lib/labels';
import { useToast, useSettings } from '../app/context';
import { navigate } from '../app/router';
import { fromDisplayWeight, num, toDisplayWeight, wUnit } from '../lib/units';
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
  const deferredQ = useDeferredValue(q);
  const list = useMemo(() => {
    const nq = normalize(deferredQ.trim());
    return (all ?? []).filter(
      (e) => (!nq || normalize(e.name).includes(nq)) && (!muscle || e.primaryMuscle === muscle || e.secondaryMuscles.includes(muscle)) && (!equip || e.equipment === equip),
    );
  }, [all, deferredQ, muscle, equip]);
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
          <Input type="search" placeholder="Buscar ejercicio" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar ejercicio" enterKeyHint="search" autoComplete="off" autoCorrect="off" spellCheck={false} data-autofocus />
        </div>
        <MuscleChips value={muscle} onChange={setMuscle} />
        <div className="chips">
          <button type="button" className={cx('chip', !equip && 'active')} onClick={() => setEquip('')}>
            Todo el equipo
          </button>
          {(Object.keys(EQUIPMENT) as Equipment[]).map((k) => (
            <button key={k} type="button" className={cx('chip', equip === k && 'active')} aria-pressed={equip === k} onClick={() => setEquip(equip === k ? '' : k)}>
              {EQUIPMENT[k]}
            </button>
          ))}
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
                // Evita que el buscador pierda el foco (y se cierre el teclado) al elegir un resultado.
                onMouseDown={(ev) => ev.preventDefault()}
                aria-pressed={multi ? on : undefined}
                onClick={() => (multi ? setSel((s) => (on ? s.filter((x) => x !== e.id) : [...s, e.id])) : done([e.id]))}
              >
                <ExerciseArt exercise={e} size={52} />
                <span className="row-main">
                  <span className="row-title">{e.name}</span>
                  <span className="row-subtitle">
                    {MUSCLES[e.primaryMuscle]} · {EQUIPMENT[e.equipment]}
                    {e.custom ? ' · Personalizado' : ''}
                  </span>
                </span>
                {multi && <span className={cx('check-btn picker-check', on && 'on')}>{on && <Check size={16} strokeWidth={3} />}</span>}
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
  const all = useQuery(listBodyWeights, ['bodyweights']);
  const [key, setKey] = useState<string | null>(null);
  const [date, setDate] = useState(today());
  const [time, setTime] = useState('');
  const [value, setValue] = useState<number | null>(null);
  const [note, setNote] = useState('');
  const [typing, setTyping] = useState(false);
  const k = `${open}-${entry?.id ?? 'new'}`;
  if (open && key !== k && all) {
    setKey(k);
    const last = all[all.length - 1];
    setDate(entry?.date ?? today());
    setTime(entry?.time ?? (entry ? '' : timeKey()));
    setValue(entry ? toDisplayWeight(entry.weightKg) : last ? toDisplayWeight(last.weightKg) : settings.weightUnit === 'kg' ? 70 : 155);
    setNote(entry?.note ?? '');
    setTyping(false);
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
  const center = value ?? 70;
  const span = settings.weightUnit === 'kg' ? 25 : 50;
  const min = Math.max(20, Math.floor(center - span));
  const max = Math.min(400, Math.ceil(center + span));
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={entry ? 'Editar peso' : 'Registrar peso'}
      action={{ label: 'Guardar', onClick: save, disabled: value == null || value <= 0 || date > dateKey() }}
    >
      <div className="big-value">
        {typing ? (
          <div style={{ maxWidth: 200, margin: '0 auto' }}>
            <NumberInput value={value} onChange={setValue} ariaLabel="Peso corporal" className="input-lg" />
          </div>
        ) : (
          <button type="button" className="big-value-btn" onClick={() => setTyping(true)} aria-label={`Peso ${value ?? ''} ${wUnit()}. Pulsa para escribirlo`}>
            <span className="hero-number">{value != null ? num(value, 1) : '—'}</span>
            <span className="hero-unit">{wUnit()}</span>
          </button>
        )}
        <div className="small muted" style={{ marginTop: 4 }}>
          Desliza la rueda o toca la cifra para escribirla
        </div>
      </div>
      {!typing && value != null && <WheelPicker value={value} onChange={setValue} min={min} max={max} step={0.1} format={(v) => num(v, 1)} label="Peso corporal" />}
      <div className="form-grid mt">
        <Field label="Fecha" error={date > dateKey() ? 'No puede ser una fecha futura.' : undefined}>
          <DateInput value={date} max={today()} onChange={setDate} label="Fecha" />
        </Field>
        <Field label="Hora (opcional)">
          <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
        </Field>
      </div>
      <Field label="Nota (opcional)">
        <Input value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} placeholder="Cómo te sientes, cambios, etc." />
      </Field>
    </Sheet>
  );
}

/** Filtros por grupo muscular en forma de chips desplazables. */
export function MuscleChips({ value, onChange, only }: { value: MuscleGroup | ''; onChange: (m: MuscleGroup | '') => void; only?: MuscleGroup[] }) {
  const list = only ?? (Object.keys(MUSCLES) as MuscleGroup[]);
  return (
    <div className="chips" role="group" aria-label="Filtrar por grupo muscular">
      <button type="button" className={cx('chip', !value && 'active')} aria-pressed={!value} onClick={() => onChange('')}>
        Todos
      </button>
      {list.map((m) => (
        <button key={m} type="button" className={cx('chip', value === m && 'active')} aria-pressed={value === m} onClick={() => onChange(value === m ? '' : m)}>
          {MUSCLES[m]}
        </button>
      ))}
    </div>
  );
}
