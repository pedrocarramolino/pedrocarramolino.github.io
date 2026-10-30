import { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Info, Pencil, Play, Plus, RefreshCw, Replace, Trash2, WandSparkles } from 'lucide-react';
import type { Exercise, MuscleGroup } from '../db/types';
import { useSettings, useToast } from '../app/context';
import { navigate } from '../app/router';
import { saveRoutine } from '../db/repo';
import {
  DURATIONS,
  EQUIP_OPTIONS,
  GEN_MUSCLES,
  estimateItemSeconds,
  estimatePlanMinutes,
  localGenerator,
  parseRequest,
  planTitle,
  planToRoutine,
  setsByMuscle,
  type EquipKey,
  type GeneratedPlan,
  type Level,
  type PlanItem,
} from '../domain/generator';
import { fmtSeconds } from '../lib/dates';
import { EQUIPMENT, MUSCLES } from '../lib/labels';
import { uid } from '../lib/id';
import { ExerciseArt } from '../ui/ExerciseArt';
import { Button, Card, Field, IconButton, Input, List, Page, Progress, Section, Segmented, Sheet, Stepper, Tag, TextArea, cx } from '../ui/kit';
import { ExercisePicker, useExercises, useStartWorkout } from './shared';

const LEVELS: { value: Level; label: string }[] = [
  { value: 'principiante', label: 'Principiante' },
  { value: 'intermedio', label: 'Intermedio' },
  { value: 'avanzado', label: 'Avanzado' },
];

function prescription(i: PlanItem) {
  const work = i.durationSec ? `${i.durationSec} s` : i.repsMin != null ? (i.repsMax != null && i.repsMax !== i.repsMin ? `${i.repsMin}–${i.repsMax}` : `${i.repsMin}`) : '—';
  return `${i.warmupSets ? `${i.warmupSets} aprox. + ` : ''}${i.sets} × ${work} · descanso ${fmtSeconds(i.restSec)}`;
}

export function Generator() {
  const { settings } = useSettings();
  const toast = useToast();
  const start = useStartWorkout();
  const all = useExercises(false);
  const exMap = useMemo(() => new Map((all ?? []).map((e) => [e.id, e])), [all]);

  const [text, setText] = useState('');
  const [muscles, setMuscles] = useState<MuscleGroup[]>([]);
  const [minutes, setMinutes] = useState(45);
  const [equipment, setEquipment] = useState<EquipKey[]>(['gym']);
  const [level, setLevel] = useState<Level>(settings.experience || 'intermedio');
  const [seed, setSeed] = useState(1);
  const [plan, setPlan] = useState<GeneratedPlan | null>(null);
  const [name, setName] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const [replacing, setReplacing] = useState<string | null>(null);
  const [searching, setSearching] = useState<{ mode: 'replace'; key: string } | { mode: 'add' } | null>(null);
  const [busy, setBusy] = useState(false);

  // Interpreta la frase y rellena los campos detectados (sin borrar lo que el usuario eligió a mano).
  const onText = (v: string) => {
    setText(v);
    const p = parseRequest(v);
    if (p.muscles.length) setMuscles(p.muscles);
    if (p.minutes) setMinutes(p.minutes);
    if (p.equipment.length) setEquipment(p.equipment);
    if (p.level) setLevel(p.level);
  };
  const toggleMuscle = (m: MuscleGroup) => setMuscles((cur) => (cur.includes(m) ? cur.filter((x) => x !== m) : [...cur, m]));
  const toggleEquip = (e: EquipKey) =>
    setEquipment((cur) => {
      if (e === 'gym') return ['gym'];
      const next = cur.filter((x) => x !== 'gym');
      const res = next.includes(e) ? next.filter((x) => x !== e) : [...next, e];
      return res.length ? res : ['gym'];
    });

  const generate = async (nextSeed = seed) => {
    if (!all || !muscles.length) return;
    setBusy(true);
    const p = await localGenerator.generate({ muscles, minutes, equipment, level, seed: nextSeed }, all);
    setPlan(p);
    setName(planTitle(p.request));
    setBusy(false);
    window.setTimeout(() => document.getElementById('gen-result')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  };

  const updateItem = (key: string, patch: Partial<PlanItem>) => setPlan((p) => p && { ...p, items: p.items.map((i) => (i.key === key ? { ...i, ...patch } : i)) });
  const move = (idx: number, d: number) =>
    setPlan((p) => {
      if (!p) return p;
      const items = [...p.items];
      const j = idx + d;
      if (j < 0 || j >= items.length) return p;
      [items[idx], items[j]] = [items[j], items[idx]];
      return { ...p, items };
    });
  const replaceWith = (key: string, ex: Exercise) =>
    setPlan((p) => {
      if (!p) return p;
      return {
        ...p,
        items: p.items.map((i) => {
          if (i.key !== key) return i;
          const timed = ex.tracking === 'duration' || ex.tracking === 'distance_duration';
          return {
            ...i,
            exerciseId: ex.id,
            alternatives: [i.exerciseId, ...i.alternatives.filter((a) => a !== ex.id)],
            repsMin: timed ? null : (i.repsMin ?? 10),
            repsMax: timed ? null : (i.repsMax ?? 12),
            durationSec: timed ? (i.durationSec ?? 40) : null,
            warmupSets: ex.tracking === 'weight_reps' ? i.warmupSets : 0,
          };
        }),
      };
    });

  const save = async (andStart: boolean) => {
    if (!plan || !plan.items.length) return;
    const r = planToRoutine(plan, exMap, name.trim() || planTitle(plan.request));
    const saved = await saveRoutine(r);
    toast(`Rutina «${saved.name}» guardada`);
    if (andStart) await start(saved.id);
    else navigate(`/routines/${saved.id}`, { replace: true });
  };

  const estimated = plan ? estimatePlanMinutes(plan.items) : 0;
  const bySets = plan ? setsByMuscle(plan.items, exMap) : new Map();
  const editItem = plan?.items.find((i) => i.key === editing);
  const replaceItem = plan?.items.find((i) => i.key === replacing);
  const durOptions = DURATIONS.includes(minutes) ? DURATIONS : [...DURATIONS, minutes].sort((a, b) => a - b);

  return (
    <Page title="Generar rutina" large={false} back="/routines" backLabel="Rutinas" subtitle="Describe qué quieres entrenar y cuánto tiempo tienes.">
      <Card>
        <Field label="¿Qué quieres entrenar?" hint="Ej.: «bíceps y tríceps durante 45 minutos» o «hoy quiero darle a pecho y hombro con mancuernas».">
          <TextArea value={text} onChange={(e) => onText(e.target.value)} rows={2} placeholder="Quiero entrenar…" aria-label="Qué quieres entrenar" enterKeyHint="done" />
        </Field>
        <div className="field-label">Grupos musculares</div>
        <div className="chips chips-wrap mt" style={{ marginTop: 6 }} role="group" aria-label="Grupos musculares">
          {GEN_MUSCLES.map((m) => (
            <button key={m} type="button" className={cx('chip', muscles.includes(m) && 'active')} aria-pressed={muscles.includes(m)} onClick={() => toggleMuscle(m)}>
              {MUSCLES[m]}
            </button>
          ))}
        </div>
        <div className="field-label mt">Tiempo disponible</div>
        <div className="chips chips-wrap" style={{ marginTop: 6 }} role="radiogroup" aria-label="Tiempo disponible">
          {durOptions.map((d) => (
            <button key={d} type="button" role="radio" aria-checked={minutes === d} className={cx('chip', minutes === d && 'active')} onClick={() => setMinutes(d)}>
              {d} min
            </button>
          ))}
        </div>
        <div className="field-label mt">Material disponible</div>
        <div className="chips chips-wrap" style={{ marginTop: 6 }} role="group" aria-label="Material disponible">
          {EQUIP_OPTIONS.map((o) => (
            <button key={o.value} type="button" className={cx('chip', equipment.includes(o.value) && 'active')} aria-pressed={equipment.includes(o.value)} onClick={() => toggleEquip(o.value)}>
              {o.label}
            </button>
          ))}
        </div>
        <div className="field-label mt">Nivel</div>
        <div style={{ marginTop: 6 }}>
          <Segmented label="Nivel" value={level} onChange={setLevel} options={LEVELS} />
        </div>
        <Button variant="primary" size="lg" block className="mt-lg" icon={<WandSparkles size={20} />} disabled={!muscles.length || !all || busy} onClick={() => generate()}>
          Generar rutina
        </Button>
        {!muscles.length && <p className="small muted mt">Elige al menos un grupo muscular o escríbelo en la frase.</p>}
      </Card>
      <p className="tiny muted mt" style={{ padding: '0 4px' }}>
        <Info size={12} style={{ verticalAlign: '-2px' }} /> Generador local: usa reglas de entrenamiento y tu biblioteca de ejercicios en este dispositivo. No usa inteligencia artificial ni envía datos a ningún servidor.
      </p>

      {plan && (
        <div id="gen-result">
          <Section title="Rutina propuesta">
            <Card>
              <Field label="Nombre">
                <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} aria-label="Nombre de la rutina" />
              </Field>
              <div className="split">
                <div className="gen-time">
                  <span className="hero-number">≈{estimated}</span>
                  <span className="hero-unit">min</span>
                </div>
                <span className="small muted">de {plan.request.minutes} disponibles</span>
              </div>
              <div className="mt">
                <Progress value={Math.min(1, estimated / plan.request.minutes)} label="Duración estimada frente al tiempo disponible" />
              </div>
              <p className="tiny muted mt">Incluye series, descansos, una serie de aproximación en el primer ejercicio y ~1 min de preparación entre ejercicios.</p>
              {bySets.size > 0 && (
                <div className="chips chips-wrap mt">
                  {[...bySets.entries()].map(([m, n]) => (
                    <Tag key={m} tone="blue">
                      {MUSCLES[m as MuscleGroup]} · {n} series
                    </Tag>
                  ))}
                </div>
              )}
            </Card>
            {estimated > plan.request.minutes * 1.1 && (
              <div className="callout callout-warn mt">
                <Info size={18} />
                <span>La rutina supera el tiempo disponible. Reduce series o elimina algún ejercicio.</span>
              </div>
            )}
            {plan.notes.map((n) => (
              <div key={n} className="callout callout-neutral mt">
                <Info size={18} />
                <span>{n}</span>
              </div>
            ))}
          </Section>

          <Section title={`Ejercicios · ${plan.items.length}`}>
            {plan.items.map((i, idx) => {
              const ex = exMap.get(i.exerciseId);
              return (
                <div key={i.key} className="card gen-item" aria-label={ex?.name}>
                  <div className="gen-item-head">
                    <ExerciseArt exercise={ex} size={64} />
                    <div className="grow">
                      <div className="card-title" style={{ fontSize: 16 }}>
                        {ex?.name ?? 'Ejercicio no disponible'}
                      </div>
                      <div className="card-sub">
                        {ex ? `${MUSCLES[ex.primaryMuscle]} · ${EQUIPMENT[ex.equipment]}` : ''}
                      </div>
                      <div className="small" style={{ marginTop: 4, fontWeight: 600 }}>
                        {prescription(i)}
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <IconButton label={`Subir ${ex?.name ?? ''}`} onClick={() => move(idx, -1)} disabled={idx === 0}>
                        <ArrowUp size={18} />
                      </IconButton>
                      <IconButton label={`Bajar ${ex?.name ?? ''}`} onClick={() => move(idx, 1)} disabled={idx === plan.items.length - 1}>
                        <ArrowDown size={18} />
                      </IconButton>
                    </div>
                  </div>
                  <p className="tiny muted" style={{ marginTop: 6 }}>
                    {i.reason}
                  </p>
                  <div className="gen-item-actions">
                    <Button size="sm" icon={<Pencil size={14} />} onClick={() => setEditing(i.key)} aria-label={`Editar series de ${ex?.name ?? ''}`}>
                      Editar
                    </Button>
                    <Button size="sm" icon={<Replace size={14} />} onClick={() => setReplacing(i.key)} aria-label={`Sustituir ${ex?.name ?? ''}`}>
                      Sustituir
                    </Button>
                    <Button
                      size="sm"
                      variant="plain"
                      className="text-danger"
                      icon={<Trash2 size={14} />}
                      onClick={() => setPlan((p) => p && { ...p, items: p.items.filter((x) => x.key !== i.key) })}
                      aria-label={`Eliminar ${ex?.name ?? ''}`}
                    >
                      Eliminar
                    </Button>
                  </div>
                </div>
              );
            })}
            <Button variant="tinted" block className="mt" icon={<Plus size={18} />} onClick={() => setSearching({ mode: 'add' })}>
              Añadir ejercicio
            </Button>
          </Section>

          <div className="stack mt-lg">
            <Button variant="primary" size="lg" block icon={<Play size={20} fill="currentColor" />} disabled={!plan.items.length} onClick={() => save(true)}>
              Guardar y empezar
            </Button>
            <div className="btn-row">
              <Button onClick={() => save(false)} disabled={!plan.items.length}>
                Guardar rutina
              </Button>
              <Button
                icon={<RefreshCw size={16} />}
                onClick={() => {
                  setSeed(seed + 1);
                  generate(seed + 1);
                }}
              >
                Otra propuesta
              </Button>
            </div>
          </div>
        </div>
      )}

      <Sheet open={!!editItem} onClose={() => setEditing(null)} title={editItem ? (exMap.get(editItem.exerciseId)?.name ?? 'Editar') : ''}>
        {editItem && (
          <>
            <div className="list">
              <div className="edit-row">
                <span>Series</span>
                <Stepper label="series" value={editItem.sets} min={1} max={10} onChange={(v) => updateItem(editItem.key, { sets: v })} />
              </div>
              {editItem.durationSec != null ? (
                <div className="edit-row">
                  <span>Duración</span>
                  <Stepper label="duración" value={editItem.durationSec} min={10} max={600} step={5} format={(v) => `${v} s`} onChange={(v) => updateItem(editItem.key, { durationSec: v })} />
                </div>
              ) : (
                <>
                  <div className="edit-row">
                    <span>Reps mínimas</span>
                    <Stepper label="repeticiones mínimas" value={editItem.repsMin ?? 8} min={1} max={editItem.repsMax ?? 50} onChange={(v) => updateItem(editItem.key, { repsMin: v })} />
                  </div>
                  <div className="edit-row">
                    <span>Reps máximas</span>
                    <Stepper label="repeticiones máximas" value={editItem.repsMax ?? 12} min={editItem.repsMin ?? 1} max={50} onChange={(v) => updateItem(editItem.key, { repsMax: v })} />
                  </div>
                </>
              )}
              <div className="edit-row">
                <span>Descanso</span>
                <Stepper label="descanso" value={editItem.restSec} min={0} max={300} step={15} format={fmtSeconds} onChange={(v) => updateItem(editItem.key, { restSec: v })} />
              </div>
              <div className="edit-row">
                <span>Series de aproximación</span>
                <Stepper label="series de aproximación" value={editItem.warmupSets} min={0} max={3} onChange={(v) => updateItem(editItem.key, { warmupSets: v })} />
              </div>
            </div>
            <p className="small muted mt">Este ejercicio suma ≈{Math.round(estimateItemSeconds(editItem) / 60)} min. Total de la rutina: ≈{estimated} min.</p>
          </>
        )}
      </Sheet>

      <Sheet open={!!replaceItem} onClose={() => setReplacing(null)} title="Sustituir ejercicio">
        {replaceItem && (
          <>
            <p className="small muted">Alternativas equivalentes para {MUSCLES[replaceItem.target].toLowerCase()} con el material elegido.</p>
            <List className="mt">
              {replaceItem.alternatives
                .map((id) => exMap.get(id))
                .filter((e): e is Exercise => !!e && !plan?.items.some((x) => x.exerciseId === e.id))
                .map((e) => (
                  <button
                    key={e.id}
                    type="button"
                    className="row row-button"
                    onClick={() => {
                      replaceWith(replaceItem.key, e);
                      setReplacing(null);
                    }}
                  >
                    <ExerciseArt exercise={e} size={52} />
                    <span className="row-main">
                      <span className="row-title">{e.name}</span>
                      <span className="row-subtitle">
                        {MUSCLES[e.primaryMuscle]} · {EQUIPMENT[e.equipment]}
                      </span>
                    </span>
                  </button>
                ))}
            </List>
            <Button
              variant="plain"
              block
              className="mt"
              onClick={() => {
                const key = replaceItem.key;
                setReplacing(null);
                setSearching({ mode: 'replace', key });
              }}
            >
              Buscar otro ejercicio en la biblioteca
            </Button>
          </>
        )}
      </Sheet>

      <ExercisePicker
        open={!!searching}
        multi={searching?.mode === 'add'}
        title={searching?.mode === 'add' ? 'Añadir ejercicios' : 'Sustituir ejercicio'}
        onClose={() => setSearching(null)}
        onPick={(list) => {
          if (!plan || !searching) return;
          if (searching.mode === 'replace') {
            if (list[0]) replaceWith(searching.key, list[0]);
          } else {
            setPlan({
              ...plan,
              items: [
                ...plan.items,
                ...list.map((e) => {
                  const timed = e.tracking === 'duration' || e.tracking === 'distance_duration';
                  return {
                    key: uid(),
                    exerciseId: e.id,
                    role: 'acc' as const,
                    sets: 3,
                    warmupSets: 0,
                    repsMin: timed ? null : 10,
                    repsMax: timed ? null : 12,
                    durationSec: timed ? 40 : null,
                    restSec: 75,
                    reason: 'Añadido manualmente.',
                    target: e.primaryMuscle,
                    alternatives: [],
                  };
                }),
              ],
            });
          }
        }}
      />
    </Page>
  );
}
