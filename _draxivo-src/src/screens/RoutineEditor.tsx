import { useEffect, useState } from 'react';
import { ArrowUpDown, Ellipsis, Link2, Plus, Trash2 } from 'lucide-react';
import type { EffortMetric, PlannedSet, Routine, RoutineExercise, SetType } from '../db/types';
import { useQuery } from '../app/hooks';
import { goBack, navigate, useRoute } from '../app/router';
import { useSettings, useToast } from '../app/context';
import { emptyRoutine, estimateRoutineMinutes, getRoutine, listFolders, newPlannedSet, newRoutineExercise, saveRoutine } from '../db/repo';
import { CATEGORIES, GOALS, SET_TYPES, usesDistance, usesReps, usesWeight } from '../lib/labels';
import { fmtMinutes, fmtSeconds } from '../lib/dates';
import { fromDisplayWeight, toDisplayWeight, wUnit } from '../lib/units';
import { ActionMenu, Button, Empty, Field, IconButton, Input, Loading, NumberInput, Page, Section, Select, Sheet, TextArea, cx, useConfirm } from '../ui/kit';
import { ReorderList } from '../ui/reorder';
import { ExerciseArt } from '../ui/ExerciseArt';
import { ExercisePicker, useExerciseMap } from './shared';
import { uid } from '../lib/id';

const RESTS = [0, 30, 45, 60, 75, 90, 120, 150, 180, 240, 300];

export function RoutineEditor({ id }: { id: string | null }) {
  const { settings } = useSettings();
  const toast = useToast();
  const confirm = useConfirm();
  const { query } = useRoute();
  const folders = useQuery(listFolders, ['folders']);
  const exMap = useExerciseMap();
  const [r, setR] = useState<Routine | null>(null);
  const [dirty, setDirty] = useState(false);
  const [missing, setMissing] = useState(false);
  const [picker, setPicker] = useState(false);
  const [reorder, setReorder] = useState(false);
  const [menu, setMenu] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) {
      setR(emptyRoutine({ folderId: query.get('folder') || null }));
      return;
    }
    getRoutine(id).then((x) => (x ? setR(structuredClone(x)) : setMissing(true)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (missing)
    return (
      <Page title="Editar rutina" back="/routines" backLabel="Rutinas">
        <Empty title="Rutina no encontrada" />
      </Page>
    );
  if (!r || !folders) return <Loading />;

  const set = (p: Partial<Routine>) => {
    setR({ ...r, ...p });
    setDirty(true);
  };
  const setEx = (exId: string, fn: (e: RoutineExercise) => RoutineExercise) => set({ exercises: r.exercises.map((e) => (e.id === exId ? fn(e) : e)) });
  const setPS = (exId: string, psId: string, p: Partial<PlannedSet>) => setEx(exId, (e) => ({ ...e, sets: e.sets.map((s) => (s.id === psId ? { ...s, ...p } : s)) }));

  const save = async () => {
    if (!r.name.trim()) {
      setError('Ponle un nombre a la rutina.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    try {
      const saved = await saveRoutine(r);
      setDirty(false);
      toast(id ? 'Rutina guardada' : 'Rutina creada');
      if (id) goBack(`/routines/${saved.id}`);
      else navigate(`/routines/${saved.id}`, { replace: true });
    } catch (e) {
      toast((e as Error).message, { tone: 'error' });
    }
  };

  const cancel = async () => {
    if (dirty && !(await confirm({ title: '¿Descartar los cambios?', message: 'Los cambios no guardados se perderán.', confirmLabel: 'Descartar', destructive: true }))) return;
    goBack(id ? `/routines/${id}` : '/routines');
  };

  const toggleSuperset = (exId: string) => {
    const i = r.exercises.findIndex((e) => e.id === exId);
    const cur = r.exercises[i];
    const next = r.exercises[i + 1];
    if (!next) return;
    const ex = [...r.exercises];
    if (cur.supersetId && cur.supersetId === next.supersetId) {
      ex[i + 1] = { ...next, supersetId: null };
      if (ex.filter((e) => e.supersetId === cur.supersetId).length < 2) ex[i] = { ...cur, supersetId: null };
    } else {
      const sid = cur.supersetId ?? next.supersetId ?? uid();
      ex[i] = { ...cur, supersetId: sid };
      ex[i + 1] = { ...next, supersetId: sid };
    }
    set({ exercises: ex });
  };

  const menuEx = r.exercises.find((e) => e.id === menu);
  const menuIdx = menuEx ? r.exercises.indexOf(menuEx) : -1;
  const estimate = estimateRoutineMinutes(r, settings.defaultRestSec);

  return (
    <Page
      title={id ? 'Editar rutina' : 'Nueva rutina'}
      large={false}
      back={id ? `/routines/${id}` : '/routines'}
      backLabel="Cancelar"
      actions={
        <Button variant="primary" size="sm" onClick={save}>
          Guardar
        </Button>
      }
    >
      <div className="panel">
        <Field label="Nombre" error={error || undefined}>
          <Input
            value={r.name}
            onChange={(e) => {
              setError('');
              set({ name: e.target.value });
            }}
            placeholder="Ej.: Torso A"
            maxLength={80}
            autoFocus={!id}
          />
        </Field>
        <Field label="Descripción (opcional)">
          <TextArea value={r.description} onChange={(e) => set({ description: e.target.value })} maxLength={1000} rows={2} />
        </Field>
        <div className="form-grid">
          <Field label="Objetivo">
            <Select value={r.goal} onChange={(v) => set({ goal: v })}>
              <option value="">Sin especificar</option>
              {GOALS.map((g) => (
                <option key={g}>{g}</option>
              ))}
              {r.goal && !GOALS.includes(r.goal) && <option>{r.goal}</option>}
            </Select>
          </Field>
          <Field label="Categoría">
            <Select value={r.category} onChange={(v) => set({ category: v })}>
              <option value="">Sin categoría</option>
              {CATEGORIES.map((g) => (
                <option key={g}>{g}</option>
              ))}
              {r.category && !CATEGORIES.includes(r.category) && <option>{r.category}</option>}
            </Select>
          </Field>
          <Field label="Carpeta">
            <Select value={r.folderId ?? ''} onChange={(v) => set({ folderId: v || null })}>
              <option value="">Sin carpeta</option>
              {folders.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Duración estimada (min)" hint={`Automática: ~${fmtMinutes(estimate)}`}>
            <NumberInput value={r.estimatedMin} onChange={(v) => set({ estimatedMin: v })} decimals={false} placeholder={String(estimate)} max={600} />
          </Field>
        </div>
      </div>

      <Section
        title={`Ejercicios · ${r.exercises.length}`}
        action={
          r.exercises.length > 1 && (
            <button className="link" onClick={() => setReorder(true)}>
              <ArrowUpDown size={14} style={{ verticalAlign: '-2px' }} /> Reordenar
            </button>
          )
        }
      >
        {r.exercises.length === 0 && <Empty title="Sin ejercicios" text="Añade ejercicios de la biblioteca o crea los tuyos." />}
        <div className="stack">
          {r.exercises.map((e, i) => {
            const ex = exMap.get(e.exerciseId);
            const tracking = ex?.tracking ?? 'weight_reps';
            const linked = e.supersetId && r.exercises[i + 1]?.supersetId === e.supersetId;
            return (
              <div key={e.id} className={cx('wex', e.supersetId && 'superset')} style={{ marginTop: 0 }}>
                <div className="wex-head">
                  <ExerciseArt exercise={ex} size={64} />
                  <div className="wex-name">
                    <h3>
                      {i + 1}. {ex?.name ?? 'Ejercicio eliminado'}
                    </h3>
                    {e.supersetId && <p>Superserie{linked ? ' con el siguiente ↓' : ''}</p>}
                  </div>
                  <IconButton label={`Opciones de ${ex?.name ?? 'ejercicio'}`} onClick={() => setMenu(e.id)}>
                    <Ellipsis size={22} />
                  </IconButton>
                </div>
                <div style={{ padding: '0 12px 12px' }}>
                  <div className="planned-head">
                    <span>#</span>
                    {usesReps(tracking) ? (
                      <>
                        <span>Reps mín.</span>
                        <span>Reps máx.</span>
                      </>
                    ) : (
                      <>
                        <span>{usesDistance(tracking) ? 'Metros' : '—'}</span>
                        <span>Segundos</span>
                      </>
                    )}
                    <span>{usesWeight(tracking) ? wUnit() : e.effort !== 'none' ? e.effort.toUpperCase() : ''}</span>
                    <span />
                  </div>
                  {e.sets.map((s, si) => (
                    <div key={s.id} className="planned-set">
                      <SetTypeButton type={s.type} index={si} onChange={(t) => setPS(e.id, s.id, { type: t })} />
                      {usesReps(tracking) ? (
                        <>
                          <NumberInput value={s.repsMin} decimals={false} onChange={(v) => setPS(e.id, s.id, { repsMin: v })} ariaLabel={`Repeticiones mínimas serie ${si + 1}`} max={999} />
                          <NumberInput value={s.repsMax} decimals={false} onChange={(v) => setPS(e.id, s.id, { repsMax: v })} ariaLabel={`Repeticiones máximas serie ${si + 1}`} max={999} />
                        </>
                      ) : (
                        <>
                          {usesDistance(tracking) ? <NumberInput value={s.distanceM} onChange={(v) => setPS(e.id, s.id, { distanceM: v })} ariaLabel={`Distancia serie ${si + 1}`} /> : <span />}
                          <NumberInput value={s.durationSec} decimals={false} onChange={(v) => setPS(e.id, s.id, { durationSec: v })} ariaLabel={`Duración serie ${si + 1}`} />
                        </>
                      )}
                      {usesWeight(tracking) ? (
                        <NumberInput value={s.weight != null ? toDisplayWeight(s.weight) : null} onChange={(v) => setPS(e.id, s.id, { weight: v == null ? null : fromDisplayWeight(v) })} ariaLabel={`Carga objetivo serie ${si + 1}`} placeholder="—" />
                      ) : e.effort !== 'none' ? (
                        <NumberInput value={e.effort === 'rpe' ? s.rpe : s.rir} onChange={(v) => setPS(e.id, s.id, e.effort === 'rpe' ? { rpe: v } : { rir: v })} ariaLabel={`${e.effort.toUpperCase()} objetivo serie ${si + 1}`} max={10} />
                      ) : (
                        <span />
                      )}
                      <IconButton label={`Eliminar serie ${si + 1}`} onClick={() => setEx(e.id, (x) => ({ ...x, sets: x.sets.filter((y) => y.id !== s.id) }))}>
                        <Trash2 size={16} />
                      </IconButton>
                    </div>
                  ))}
                  {usesWeight(tracking) && e.effort !== 'none' && (
                    <div className="mt">
                      <span className="field-label">{e.effort.toUpperCase()} objetivo por serie</span>
                      <div className="chips">
                        {e.sets.map((s, si) => (
                          <NumberInput key={s.id} className="chip" value={e.effort === 'rpe' ? s.rpe : s.rir} onChange={(v) => setPS(e.id, s.id, e.effort === 'rpe' ? { rpe: v } : { rir: v })} ariaLabel={`${e.effort.toUpperCase()} serie ${si + 1}`} placeholder={`S${si + 1}`} max={10} />
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="form-grid mt">
                    <Field label="Descanso">
                      <Select value={e.restSec == null ? '' : String(e.restSec)} onChange={(v) => setEx(e.id, (x) => ({ ...x, restSec: v === '' ? null : Number(v) }))}>
                        <option value="">Predeterminado ({fmtSeconds(settings.defaultRestSec)})</option>
                        {RESTS.map((s) => (
                          <option key={s} value={s}>
                            {s ? fmtSeconds(s) : 'Sin descanso'}
                          </option>
                        ))}
                      </Select>
                    </Field>
                    <Field label="Esfuerzo">
                      <Select value={e.effort} onChange={(v) => setEx(e.id, (x) => ({ ...x, effort: v as EffortMetric }))}>
                        <option value="none">No registrar</option>
                        <option value="rpe">RPE</option>
                        <option value="rir">RIR</option>
                      </Select>
                    </Field>
                  </div>
                  <Input value={e.notes} onChange={(ev) => setEx(e.id, (x) => ({ ...x, notes: ev.target.value }))} placeholder="Notas del ejercicio" aria-label="Notas del ejercicio" />
                  <div className="btn-row mt">
                    <Button
                      size="sm"
                      variant="tinted"
                      icon={<Plus size={16} />}
                      onClick={() => setEx(e.id, (x) => ({ ...x, sets: [...x.sets, { ...(x.sets[x.sets.length - 1] ?? newPlannedSet()), id: uid(), type: x.sets[x.sets.length - 1]?.type === 'warmup' ? 'normal' : (x.sets[x.sets.length - 1]?.type ?? 'normal') }] }))}
                    >
                      Serie
                    </Button>
                    <Button size="sm" onClick={() => setEx(e.id, (x) => ({ ...x, sets: [newPlannedSet({ type: 'warmup', repsMin: 10, repsMax: 10 }), ...x.sets] }))}>
                      + Calentamiento
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <Button variant="tinted" size="lg" block className="mt" icon={<Plus size={20} />} onClick={() => setPicker(true)}>
          Añadir ejercicios
        </Button>
      </Section>

      <Section title="Notas de la rutina">
        <TextArea value={r.notes} onChange={(e) => set({ notes: e.target.value })} maxLength={3000} placeholder="Indicaciones generales, progresión, calentamiento…" />
      </Section>

      <div className="btn-row mt-lg">
        <Button onClick={cancel}>Cancelar</Button>
        <Button variant="primary" onClick={save}>
          Guardar rutina
        </Button>
      </div>

      <ExercisePicker open={picker} onClose={() => setPicker(false)} onPick={(list) => set({ exercises: [...r.exercises, ...list.map((ex) => newRoutineExercise(ex))] })} />

      <Sheet open={reorder} onClose={() => setReorder(false)} title="Reordenar ejercicios">
        <p className="small muted">Arrastra desde el asa o usa las flechas.</p>
        <div className="mt">
          <ReorderList items={r.exercises} getKey={(e) => e.id} label={(e) => exMap.get(e.exerciseId)?.name ?? 'ejercicio'} render={(e) => (
              <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <ExerciseArt exercise={exMap.get(e.exerciseId)} size={40} />
                <span className="row-title">{exMap.get(e.exerciseId)?.name}</span>
              </span>
            )} onChange={(exercises) => set({ exercises })} />
        </div>
      </Sheet>

      <ActionMenu
        open={!!menuEx}
        onClose={() => setMenu(null)}
        title={menuEx ? (exMap.get(menuEx.exerciseId)?.name ?? '') : ''}
        actions={
          menuEx
            ? [
                {
                  label: menuEx.supersetId && r.exercises[menuIdx + 1]?.supersetId === menuEx.supersetId ? 'Separar del siguiente' : 'Superserie con el siguiente',
                  icon: <Link2 size={20} />,
                  onSelect: () => toggleSuperset(menuEx.id),
                  hidden: menuIdx === r.exercises.length - 1,
                },
                { label: 'Subir', onSelect: () => set({ exercises: swap(r.exercises, menuIdx, menuIdx - 1) }), hidden: menuIdx === 0 },
                { label: 'Bajar', onSelect: () => set({ exercises: swap(r.exercises, menuIdx, menuIdx + 1) }), hidden: menuIdx === r.exercises.length - 1 },
                { label: 'Duplicar ejercicio', onSelect: () => set({ exercises: [...r.exercises.slice(0, menuIdx + 1), { ...menuEx, id: uid(), supersetId: null, sets: menuEx.sets.map((s) => ({ ...s, id: uid() })) }, ...r.exercises.slice(menuIdx + 1)] }) },
                { label: 'Eliminar de la rutina', icon: <Trash2 size={20} />, destructive: true, onSelect: () => set({ exercises: r.exercises.filter((x) => x.id !== menuEx.id) }) },
              ]
            : []
        }
      />
    </Page>
  );
}

function swap<T>(arr: T[], a: number, b: number): T[] {
  if (b < 0 || b >= arr.length) return arr;
  const n = [...arr];
  [n[a], n[b]] = [n[b], n[a]];
  return n;
}

function SetTypeButton({ type, index, onChange }: { type: SetType; index: number; onChange: (t: SetType) => void }) {
  const order: SetType[] = ['normal', 'warmup', 'drop', 'failure'];
  return (
    <button
      type="button"
      className={cx('set-num', `t-${type}`)}
      onClick={() => onChange(order[(order.indexOf(type) + 1) % order.length])}
      aria-label={`Serie ${index + 1}: ${SET_TYPES[type].label}. Pulsar para cambiar el tipo`}
      title={SET_TYPES[type].label}
    >
      {type === 'normal' ? index + 1 : SET_TYPES[type].short}
    </button>
  );
}
