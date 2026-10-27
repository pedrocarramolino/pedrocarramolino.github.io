import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, ChevronLeft, ChevronRight, Clock3, Ellipsis, Flag, Link2, Pause, Play, Plus, RotateCcw, SkipForward, StickyNote, Timer, Trash2, TrendingUp } from 'lucide-react';
import type { EffortMetric, Exercise, SetType, Workout, WorkoutExercise, WorkoutSet } from '../db/types';
import { deleteWorkout, finishWorkout, getActiveWorkout, getWorkout, newWorkoutSet, saveWorkout, workoutExerciseFrom } from '../db/repo';
import { useSettings, useToast } from '../app/context';
import { useTick } from '../app/hooks';
import { goBack, navigate } from '../app/router';
import { lastPerformance, workoutDurationMs, workoutStats } from '../domain/metrics';
import { dateKey, fmtDuration, fmtSeconds, localToMs, timeKey, today } from '../lib/dates';
import { EQUIPMENT, MUSCLES, SET_TYPES, usesDistance, usesDuration, usesReps, usesWeight, weightColumnLabel } from '../lib/labels';
import { fmtVolume, fmtWeightNum, fromDisplayWeight, toDisplayWeight, wUnit } from '../lib/units';
import { DateInput, ActionMenu, Button, Card, Empty, Field, IconButton, Input, Loading, NumberInput, Progress, Sheet, TextArea, cx, useConfirm, type MenuAction } from '../ui/kit';
import { ExerciseArt } from '../ui/ExerciseArt';
import { ReorderList } from '../ui/reorder';
import { ExercisePicker, useExerciseMap, useStartWorkout, useWorkouts } from './shared';
import { uid } from '../lib/id';

// ---------- Sonido y vibración del descanso ----------
let audioCtx: AudioContext | null = null;
function unlockAudio() {
  try {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!audioCtx && AC) audioCtx = new AC();
    if (audioCtx?.state === 'suspended') audioCtx.resume();
  } catch {
    /* sin audio */
  }
}
function beep() {
  try {
    if (!audioCtx) return;
    const t = audioCtx.currentTime;
    [0, 0.25].forEach((off) => {
      const o = audioCtx!.createOscillator();
      const g = audioCtx!.createGain();
      o.frequency.value = 880;
      g.gain.setValueAtTime(0.0001, t + off);
      g.gain.exponentialRampToValueAtTime(0.25, t + off + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + off + 0.18);
      o.connect(g).connect(audioCtx!.destination);
      o.start(t + off);
      o.stop(t + off + 0.2);
    });
  } catch {
    /* sin audio */
  }
}

/** Serie equivalente de la sesión anterior: mismo tipo (calentamiento o trabajo) y mismo orden. */
export function matchPrev(prev: WorkoutSet[] | undefined, sets: WorkoutSet[], i: number): WorkoutSet | undefined {
  if (!prev) return undefined;
  const warm = sets[i].type === 'warmup';
  const ordinal = sets.slice(0, i).filter((x) => (x.type === 'warmup') === warm).length;
  return prev.filter((x) => x.completed && (x.type === 'warmup') === warm)[ordinal];
}

export function restRemainingMs(w: Workout, now = Date.now()): number | null {
  if (!w.rest) return null;
  if (w.rest.pausedRemainingMs != null) return w.rest.pausedRemainingMs;
  if (w.rest.endsAt == null) return null;
  return w.rest.endsAt - now;
}

export function WorkoutScreen({ editId }: { editId?: string }) {
  const { settings } = useSettings();
  const toast = useToast();
  const confirm = useConfirm();
  const history = useWorkouts();
  const start = useStartWorkout();
  const editing = !!editId;
  const [w, setW] = useState<Workout | null | undefined>(undefined);
  const undoStack = useRef<Workout[]>([]);
  const saveChain = useRef<Promise<unknown>>(Promise.resolve());
  const [picker, setPicker] = useState<{ mode: 'add' } | { mode: 'replace'; exId: string } | null>(null);
  const [menuEx, setMenuEx] = useState<string | null>(null);
  const [setMenu, setSetMenu] = useState<{ exId: string; setId: string } | null>(null);
  const [restEdit, setRestEdit] = useState<string | null>(null);
  const [reorder, setReorder] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [workoutMenu, setWorkoutMenu] = useState(false);
  const [showNotes, setShowNotes] = useState<Record<string, boolean>>({});
  const [editMeta, setEditMeta] = useState(false);
  const [view, setView] = useState<'focus' | 'list'>('focus');
  const [blockIdx, setBlockIdx] = useState<number | null>(null);
  const [listOpen, setListOpen] = useState(false);
  const exMap = useExerciseMap();

  // Carga (y recuperación de una sesión interrumpida).
  useEffect(() => {
    let alive = true;
    (editId ? getWorkout(editId) : getActiveWorkout()).then((x) => alive && setW(x ?? null));
    return () => {
      alive = false;
    };
  }, [editId]);

  // Persistencia inmediata y serializada de cada cambio (salvo en edición, que guarda al final).
  const commit = useCallback(
    (next: Workout, opts: { undoable?: boolean; message?: string } = {}) => {
      setW((prev) => {
        if (opts.undoable && prev) {
          undoStack.current.push(prev);
          if (undoStack.current.length > 20) undoStack.current.shift();
        }
        return next;
      });
      if (!editing) {
        saveChain.current = saveChain.current.then(() => saveWorkout(next)).catch((e) => toast(`No se pudo guardar: ${(e as Error).message}`, { tone: 'error' }));
      }
      if (opts.undoable && opts.message) {
        toast(opts.message, {
          action: {
            label: 'Deshacer',
            run: () => {
              const prev = undoStack.current.pop();
              if (prev) commit(prev);
            },
          },
        });
      }
    },
    [editing, toast],
  );

  useTick(500, !!w && !editing);
  const now = Date.now();
  const remaining = w ? restRemainingMs(w, now) : null;
  const alerted = useRef<number | null>(null);
  useEffect(() => {
    if (!w?.rest || w.rest.endsAt == null || w.rest.pausedRemainingMs != null) return;
    if (remaining != null && remaining <= 0 && alerted.current !== w.rest.endsAt) {
      alerted.current = w.rest.endsAt;
      // Si la app estuvo suspendida mucho más tiempo, no avisamos tarde.
      if (remaining > -15000) {
        if (settings.restSound) beep();
        if (settings.restVibration) navigator.vibrate?.([200, 100, 200]);
      }
    }
  }, [remaining, w, settings.restSound, settings.restVibration]);

  // Guardado defensivo al ocultar la página (bloqueo del dispositivo, cambio de app).
  const wRef = useRef(w);
  wRef.current = w;
  useEffect(() => {
    if (editing) return;
    const flush = () => {
      if (wRef.current && wRef.current.status === 'active') saveWorkout(wRef.current, { silent: true });
    };
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', flush);
    return () => {
      window.removeEventListener('pagehide', flush);
      document.removeEventListener('visibilitychange', flush);
    };
  }, [editing]);

  const prevByExercise = useMemo(() => {
    const map = new Map<string, WorkoutSet[]>();
    if (!w || !history) return map;
    for (const e of w.exercises) {
      if (map.has(e.exerciseId)) continue;
      const lp = lastPerformance(history.filter((h) => h.id !== w.id), e.exerciseId, w.startedAt);
      if (lp) map.set(e.exerciseId, lp.sets);
    }
    return map;
  }, [w, history]);

  if (w === undefined) return <Loading />;
  if (w === null)
    return (
      <div className="page">
        <div className="page-header">
          <div className="page-toolbar">
            <button className="back-btn" onClick={() => goBack('/train')}>
              ‹ Entrenar
            </button>
          </div>
        </div>
        <Empty
          icon={<Timer size={26} />}
          title={editing ? 'Entrenamiento no encontrado' : 'No hay ningún entrenamiento en curso'}
          text={editing ? undefined : 'Empieza uno libre o desde una de tus rutinas.'}
          action={!editing && <Button variant="primary" onClick={() => start(null)}>Entrenamiento libre</Button>}
        />
      </div>
    );

  const stats = workoutStats(w, now);
  const updateEx = (exId: string, fn: (e: WorkoutExercise) => WorkoutExercise, opts?: { undoable?: boolean; message?: string }) =>
    commit({ ...w, exercises: w.exercises.map((e) => (e.id === exId ? fn(e) : e)) }, opts);
  const updateSet = (exId: string, setId: string, patch: Partial<WorkoutSet>) =>
    updateEx(exId, (e) => ({ ...e, sets: e.sets.map((s) => (s.id === setId ? { ...s, ...patch } : s)) }));

  const startRest = (sec: number, label: string, base: Workout) => {
    if (sec <= 0) return base;
    return { ...base, rest: { endsAt: Date.now() + sec * 1000, durationSec: sec, pausedRemainingMs: null, label } };
  };

  const toggleSet = (ex: WorkoutExercise, s: WorkoutSet) => {
    unlockAudio();
    const completed = !s.completed;
    const patch: Partial<WorkoutSet> = { completed, completedAt: completed ? Date.now() : null };
    // Al completar sin datos, usamos el objetivo o la sesión anterior como valores.
    if (completed) {
      const prev = matchPrev(prevByExercise.get(ex.exerciseId), ex.sets, ex.sets.indexOf(s));
      if (usesWeight(ex.tracking) && s.weight == null) patch.weight = s.target?.weight ?? prev?.weight ?? null;
      if (usesReps(ex.tracking) && s.reps == null) patch.reps = s.target?.repsMax ?? s.target?.repsMin ?? prev?.reps ?? null;
      if (usesDuration(ex.tracking) && s.durationSec == null) patch.durationSec = prev?.durationSec ?? null;
      if (usesReps(ex.tracking) && patch.reps == null && s.reps == null) {
        toast('Introduce las repeticiones antes de completar la serie.', { tone: 'error' });
        return;
      }
    }
    let next: Workout = { ...w, exercises: w.exercises.map((e) => (e.id === ex.id ? { ...e, sets: e.sets.map((x) => (x.id === s.id ? { ...x, ...patch } : x)) } : e)) };
    if (completed && !editing && settings.autoStartRest) {
      const group = ex.supersetId ? w.exercises.filter((e) => e.supersetId === ex.supersetId) : [ex];
      const lastInGroup = group[group.length - 1].id === ex.id;
      if (lastInGroup) next = startRest(ex.restSec ?? settings.defaultRestSec, ex.name, next);
    }
    commit(next);
  };

  const addSet = (ex: WorkoutExercise) => {
    const last = ex.sets[ex.sets.length - 1];
    updateEx(ex.id, (e) => ({
      ...e,
      sets: [
        ...e.sets,
        newWorkoutSet({ type: last?.type === 'warmup' ? 'normal' : (last?.type ?? 'normal'), weight: last?.weight ?? null, reps: last?.reps ?? null, durationSec: last?.durationSec ?? null, distanceM: last?.distanceM ?? null, target: last?.target ?? null }),
      ],
    }));
  };

  const removeSet = (exId: string, setId: string) =>
    updateEx(exId, (e) => ({ ...e, sets: e.sets.filter((s) => s.id !== setId) }), { undoable: true, message: 'Serie eliminada' });

  const removeExercise = (exId: string) =>
    commit({ ...w, exercises: w.exercises.filter((e) => e.id !== exId) }, { undoable: true, message: 'Ejercicio eliminado' });

  const toggleSuperset = (exId: string) => {
    const i = w.exercises.findIndex((e) => e.id === exId);
    const cur = w.exercises[i];
    const next = w.exercises[i + 1];
    if (!next) return;
    const linked = cur.supersetId && cur.supersetId === next.supersetId;
    const exercises = [...w.exercises];
    if (linked) {
      exercises[i + 1] = { ...next, supersetId: null };
      const groupLeft = exercises.filter((e) => e.supersetId === cur.supersetId).length;
      if (groupLeft < 2) exercises[i] = { ...cur, supersetId: null };
    } else {
      const id = cur.supersetId ?? next.supersetId ?? uid();
      exercises[i] = { ...cur, supersetId: id };
      exercises[i + 1] = { ...next, supersetId: id };
    }
    commit({ ...w, exercises });
  };

  const togglePause = () => {
    const t = Date.now();
    if (w.pausedAt) {
      const rest = w.rest && w.rest.pausedRemainingMs != null ? { ...w.rest, endsAt: t + w.rest.pausedRemainingMs, pausedRemainingMs: null } : w.rest;
      commit({ ...w, pausedTotalMs: w.pausedTotalMs + (t - w.pausedAt), pausedAt: null, rest });
    } else {
      const rem = restRemainingMs(w, t);
      const rest = w.rest && rem != null && rem > 0 ? { ...w.rest, pausedRemainingMs: rem } : w.rest;
      commit({ ...w, pausedAt: t, rest });
    }
  };

  const doFinish = async () => {
    try {
      await saveChain.current;
      if (editing) {
        const durMs = workoutDurationMs(w);
        const saved = await finishWorkout({ ...w, endedAt: null, pausedAt: null, startedAt: w.startedAt, pausedTotalMs: 0 });
        // Mantiene la duración editada.
        await saveWorkout({ ...saved, endedAt: saved.startedAt + durMs });
        toast('Cambios guardados');
        navigate(`/history/${w.id}`, { replace: true });
      } else {
        const saved = await finishWorkout(w);
        navigate(`/workout/${saved.id}/summary`, { replace: true });
      }
    } catch (e) {
      toast((e as Error).message, { tone: 'error' });
    }
  };

  const discard = async () => {
    if (editing) {
      if (await confirm({ title: 'Descartar cambios', message: 'Se perderán los cambios no guardados.', confirmLabel: 'Descartar', destructive: true })) goBack(`/history/${w.id}`);
      return;
    }
    if (await confirm({ title: '¿Descartar el entrenamiento?', message: 'Se eliminará la sesión en curso y sus series. Esta acción no se puede deshacer.', confirmLabel: 'Descartar', destructive: true })) {
      await saveChain.current;
      await deleteWorkout(w.id);
      navigate('/', { replace: true });
    }
  };

  const incomplete = w.exercises.reduce((n, e) => n + e.sets.filter((s) => !s.completed).length, 0);
  const completedSets = w.exercises.reduce((n, e) => n + e.sets.filter((s) => s.completed).length, 0);
  const menuExercise = w.exercises.find((e) => e.id === menuEx);
  const menuIndex = menuExercise ? w.exercises.indexOf(menuExercise) : -1;
  const setMenuExercise = setMenu ? w.exercises.find((e) => e.id === setMenu.exId) : undefined;
  const restEx = w.exercises.find((e) => e.id === restEdit);

  const exMenuActions: MenuAction[] = menuExercise
    ? [
        { label: showNotes[menuExercise.id] ? 'Ocultar nota' : 'Añadir nota', icon: <StickyNote size={20} />, onSelect: () => setShowNotes((s) => ({ ...s, [menuExercise.id]: !s[menuExercise.id] })) },
        { label: 'Tiempo de descanso', icon: <Timer size={20} />, onSelect: () => setRestEdit(menuExercise.id) },
        {
          label: menuExercise.supersetId && w.exercises[menuIndex + 1]?.supersetId === menuExercise.supersetId ? 'Separar del siguiente (superserie)' : 'Superserie con el siguiente',
          icon: <Link2 size={20} />,
          onSelect: () => toggleSuperset(menuExercise.id),
          hidden: menuIndex === w.exercises.length - 1,
        },
        {
          label: `RPE/RIR: ${menuExercise.effort === 'none' ? 'no' : menuExercise.effort.toUpperCase()}`,
          icon: <ChevronDown size={20} />,
          onSelect: () => updateEx(menuExercise.id, (e) => ({ ...e, effort: (e.effort === 'none' ? 'rpe' : e.effort === 'rpe' ? 'rir' : 'none') as EffortMetric })),
        },
        { label: 'Reordenar ejercicios', icon: <ChevronDown size={20} />, onSelect: () => setReorder(true), hidden: w.exercises.length < 2 },
        { label: 'Sustituir ejercicio', icon: <RotateCcw size={20} />, onSelect: () => setPicker({ mode: 'replace', exId: menuExercise.id }) },
        { label: 'Eliminar ejercicio', icon: <Trash2 size={20} />, destructive: true, onSelect: () => removeExercise(menuExercise.id) },
      ]
    : [];

  // Bloques: ejercicios consecutivos de una superserie se muestran juntos.
  const blocks: WorkoutExercise[][] = [];
  for (const e of w.exercises) {
    const last = blocks[blocks.length - 1];
    if (last && e.supersetId && last[0].supersetId === e.supersetId) last.push(e);
    else blocks.push([e]);
  }
  const firstOpen = Math.max(0, blocks.findIndex((bl) => bl.some((e) => e.sets.some((x) => !x.completed))));
  const bi = Math.min(blockIdx ?? firstOpen, Math.max(0, blocks.length - 1));
  const block = blocks[bi] ?? [];
  const nextBlock = blocks[bi + 1];
  const totalSets = w.exercises.reduce((n, e) => n + e.sets.length, 0);
  const exNumber = block.length ? w.exercises.indexOf(block[0]) + 1 : 0;
  // Siguiente serie pendiente del bloque (en superseries, alterna entre ejercicios).
  const pending = (() => {
    let best: { ex: WorkoutExercise; s: WorkoutSet; done: number } | null = null;
    for (const e of block) {
      const s2 = e.sets.find((x) => !x.completed);
      if (!s2) continue;
      const done = e.sets.filter((x) => x.completed).length;
      if (!best || done < best.done) best = { ex: e, s: s2, done };
    }
    return best;
  })();
  const shown = view === 'list' ? w.exercises : block;
  const goBlock = (i: number) => {
    setBlockIdx(i);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const restRemaining = !editing && w.rest ? remaining : null;

  const renderCard = (ex: WorkoutExercise) => {
    const i = w.exercises.indexOf(ex);
    return (
      <ExerciseCard
        key={ex.id}
        ex={ex}
        info={exMap.get(ex.exerciseId)}
        prev={prevByExercise.get(ex.exerciseId)}
        supersetWithNext={!!ex.supersetId && w.exercises[i + 1]?.supersetId === ex.supersetId}
        showNotes={!!showNotes[ex.id] || !!ex.notes}
        nextSetId={pending?.ex.id === ex.id ? pending.s.id : null}
        onMenu={() => setMenuEx(ex.id)}
        onNotes={(notes) => updateEx(ex.id, (e) => ({ ...e, notes }))}
        onToggle={(s2) => toggleSet(ex, s2)}
        onChange={(setId, p2) => updateSet(ex.id, setId, p2)}
        onSetMenu={(setId) => setSetMenu({ exId: ex.id, setId })}
        onAddSet={() => addSet(ex)}
        onRest={() => setRestEdit(ex.id)}
        onCopyPrev={(sets) => updateEx(ex.id, (e) => ({ ...e, sets }))}
        defaultRest={settings.defaultRestSec}
      />
    );
  };

  return (
    <div>
      <div className="wk-top">
        <div className="wk-top-row">
          <IconButton label={editing ? 'Cancelar edición' : 'Minimizar entrenamiento'} onClick={() => (editing ? discard() : goBack('/'))}>
            <ChevronLeft size={26} />
          </IconButton>
          <button className="wk-title" onClick={() => (editing ? setEditMeta(true) : setListOpen(true))} aria-label={`${w.name}. Ver lista de ejercicios`}>
            <strong>{w.name}</strong>
            <small>{editing ? `Editando · ${w.date}` : w.exercises.length ? `Ejercicio ${exNumber} de ${w.exercises.length}` : 'Sin ejercicios'}</small>
          </button>
          {!editing ? (
            <button className={cx('timer-pill', !!w.pausedAt && 'paused')} onClick={() => setWorkoutMenu(true)} aria-label={`Tiempo ${fmtDuration(workoutDurationMs(w, now))}${w.pausedAt ? ', en pausa' : ''}. Opciones del entrenamiento`}>
              {w.pausedAt && <Pause size={16} />}
              {fmtDuration(workoutDurationMs(w, now))}
            </button>
          ) : (
            <Button variant="primary" size="sm" onClick={() => setFinishing(true)}>
              Guardar
            </Button>
          )}
        </div>
        <div className="wk-progress">
          <Progress value={totalSets ? completedSets / totalSets : 0} label="Series completadas" />
        </div>
        <div className="wk-metrics" aria-live="off">
          <span>
            Series <b>{completedSets}/{totalSets}</b>
          </span>
          <span>
            Volumen <b>{fmtVolume(stats.volume)}</b>
          </span>
          {stats.warmupSets > 0 && (
            <span>
              Calent. <b>{stats.warmupSets}</b>
            </span>
          )}
          <button className="link small" style={{ marginLeft: 'auto', minHeight: 0 }} onClick={() => setView(view === 'focus' ? 'list' : 'focus')}>
            {view === 'focus' ? 'Ver todos' : 'Ver uno a uno'}
          </button>
        </div>
      </div>

      <div className="workout-main">
        {w.pausedAt && !editing && (
          <div className="callout callout-neutral paused-banner">
            <Pause size={18} />
            <div style={{ flex: 1 }}>
              Entrenamiento en pausa. El tiempo no avanza.
              <div className="mt">
                <Button size="sm" variant="tinted" onClick={togglePause} icon={<Play size={16} />}>
                  Reanudar
                </Button>
              </div>
            </div>
          </div>
        )}

        {w.exercises.length === 0 && (
          <div className="mt">
            <Empty icon={<Plus size={24} />} title="Añade tu primer ejercicio" text="Busca en la biblioteca o crea un ejercicio personalizado." />
          </div>
        )}

        {shown.map(renderCard)}

        {restRemaining != null && w.rest && (
          <RestCard
            remaining={restRemaining}
            total={w.rest.durationSec}
            paused={w.rest.pausedRemainingMs != null}
            label={w.rest.label}
            onAdjust={(d) => {
              const r = restRemainingMs(w) ?? 0;
              const nr = Math.max(0, r + d * 1000);
              commit({
                ...w,
                rest: w.rest!.pausedRemainingMs != null ? { ...w.rest!, pausedRemainingMs: nr, durationSec: Math.max(1, w.rest!.durationSec + d) } : { ...w.rest!, endsAt: Date.now() + nr, durationSec: Math.max(1, w.rest!.durationSec + d) },
              });
            }}
            onPause={() => {
              const r = restRemainingMs(w) ?? 0;
              commit({ ...w, rest: w.rest!.pausedRemainingMs != null ? { ...w.rest!, endsAt: Date.now() + w.rest!.pausedRemainingMs, pausedRemainingMs: null } : { ...w.rest!, pausedRemainingMs: Math.max(0, r) } });
            }}
            onRestart={() => commit({ ...w, rest: { ...w.rest!, endsAt: Date.now() + w.rest!.durationSec * 1000, pausedRemainingMs: null } })}
            onClose={() => commit({ ...w, rest: null })}
          />
        )}

        {view === 'focus' && nextBlock && (
          <Card className="next-card" onClick={() => goBlock(bi + 1)} ariaLabel={`Siguiente ejercicio: ${nextBlock.map((e) => e.name).join(', ')}`}>
            <div className="card-row">
              <ExerciseArt exercise={exMap.get(nextBlock[0].exerciseId)} size={56} />
              <div className="grow">
                <div className="card-kicker">Siguiente ejercicio</div>
                <div className="card-title" style={{ fontSize: 16 }}>
                  {nextBlock.map((e) => e.name).join(' + ')}
                </div>
                <div className="card-sub">
                  {MUSCLES[nextBlock[0].primaryMuscle]}
                  {exMap.get(nextBlock[0].exerciseId) ? ` · ${EQUIPMENT[exMap.get(nextBlock[0].exerciseId)!.equipment]}` : ''}
                </div>
              </div>
              <ChevronRight size={18} className="row-chevron" />
            </div>
          </Card>
        )}
        {view === 'focus' && bi > 0 && (
          <Button variant="plain" block className="mt" icon={<ChevronLeft size={18} />} onClick={() => goBlock(bi - 1)}>
            Ejercicio anterior
          </Button>
        )}

        <div className="stack mt-lg">
          <Button variant="tinted" size="lg" block icon={<Plus size={20} />} onClick={() => setPicker({ mode: 'add' })}>
            Añadir ejercicios
          </Button>
          <Button variant="plain" block icon={<StickyNote size={18} />} onClick={() => setShowNotes((x) => ({ ...x, __w: !x.__w }))}>
            {showNotes.__w || w.notes ? 'Notas del entrenamiento' : 'Añadir nota al entrenamiento'}
          </Button>
          {(showNotes.__w || w.notes) && <TextArea value={w.notes} onChange={(e) => commit({ ...w, notes: e.target.value })} placeholder="Sensaciones, contexto, molestias…" aria-label="Notas del entrenamiento" />}
          <Button block onClick={() => setFinishing(true)} icon={<Flag size={18} />}>
            {editing ? 'Guardar cambios' : 'Terminar entrenamiento'}
          </Button>
          <Button variant="danger" block onClick={discard}>
            {editing ? 'Descartar cambios' : 'Descartar entrenamiento'}
          </Button>
        </div>
      </div>

      {w.exercises.length > 0 && (
        <div className="wk-actions">
          <Button size="lg" icon={<Plus size={18} />} onClick={() => addSet(pending?.ex ?? block[block.length - 1])}>
            Añadir serie
          </Button>
          {pending ? (
            <Button variant="primary" size="lg" icon={<Check size={20} strokeWidth={2.6} />} onClick={() => toggleSet(pending.ex, pending.s)}>
              Completar serie
            </Button>
          ) : view === 'focus' && nextBlock ? (
            <Button variant="primary" size="lg" icon={<ChevronRight size={20} />} onClick={() => goBlock(bi + 1)}>
              Siguiente
            </Button>
          ) : (
            <Button variant="primary" size="lg" icon={<Flag size={18} />} onClick={() => setFinishing(true)}>
              {editing ? 'Guardar' : 'Terminar'}
            </Button>
          )}
        </div>
      )}

      <Sheet open={listOpen} onClose={() => setListOpen(false)} title="Ejercicios del entrenamiento">
        <div className="list">
          {blocks.map((bl, i) => (
            <button
              key={bl[0].id}
              type="button"
              className={cx('row row-button wk-list-item', i === bi && 'current')}
              onClick={() => {
                setView('focus');
                goBlock(i);
                setListOpen(false);
              }}
            >
              <ExerciseArt exercise={exMap.get(bl[0].exerciseId)} size={48} />
              <span className="row-main">
                <span className="row-title">{bl.map((e) => e.name).join(' + ')}</span>
                <span className="row-subtitle">
                  {bl.reduce((n, e) => n + e.sets.filter((x) => x.completed).length, 0)}/{bl.reduce((n, e) => n + e.sets.length, 0)} series
                  {bl.length > 1 ? ' · Superserie' : ''}
                </span>
              </span>
              {bl.every((e) => e.sets.length && e.sets.every((x) => x.completed)) && <Check size={20} className="option-check" />}
            </button>
          ))}
        </div>
        <div className="btn-row mt">
          {w.exercises.length > 1 && (
            <Button
              onClick={() => {
                setListOpen(false);
                setReorder(true);
              }}
            >
              Reordenar
            </Button>
          )}
          <Button
            variant="tinted"
            icon={<Plus size={18} />}
            onClick={() => {
              setListOpen(false);
              setPicker({ mode: 'add' });
            }}
          >
            Añadir
          </Button>
        </div>
      </Sheet>

      <ExercisePicker
        open={!!picker}
        multi={picker?.mode !== 'replace'}
        title={picker?.mode === 'replace' ? 'Sustituir ejercicio' : 'Añadir ejercicios'}
        onClose={() => setPicker(null)}
        onPick={(list) => {
          if (picker?.mode === 'replace') {
            const ex = list[0];
            updateEx(picker.exId, (old) => ({ ...workoutExerciseFrom(ex), id: old.id, supersetId: old.supersetId, restSec: old.restSec, sets: old.sets.map((s) => ({ ...s, completed: false, completedAt: null })) }), { undoable: true, message: 'Ejercicio sustituido' });
          } else {
            commit({ ...w, exercises: [...w.exercises, ...list.map((ex) => workoutExerciseFrom(ex, { sets: [newWorkoutSet(), newWorkoutSet(), newWorkoutSet()] }))] });
            if (list.length) setBlockIdx(blocks.length);
          }
        }}
      />

      <ActionMenu open={!!menuExercise} onClose={() => setMenuEx(null)} title={menuExercise?.name ?? ''} actions={exMenuActions} />

      <ActionMenu
        open={!!setMenu && !!setMenuExercise}
        onClose={() => setSetMenu(null)}
        title="Tipo de serie"
        actions={
          setMenu
            ? [
                ...(Object.keys(SET_TYPES) as SetType[]).map((t) => ({
                  label: `${SET_TYPES[t].label}${setMenuExercise?.sets.find((s) => s.id === setMenu.setId)?.type === t ? ' ✓' : ''}`,
                  onSelect: () => updateSet(setMenu.exId, setMenu.setId, { type: t }),
                })),
                { label: 'Eliminar serie', icon: <Trash2 size={20} />, destructive: true, onSelect: () => removeSet(setMenu.exId, setMenu.setId) },
              ]
            : []
        }
      />

      <RestSheet
        open={!!restEx}
        value={restEx?.restSec ?? null}
        defaultRest={settings.defaultRestSec}
        onClose={() => setRestEdit(null)}
        onSave={(v) => restEx && updateEx(restEx.id, (e) => ({ ...e, restSec: v }))}
        onStartNow={(sec) => restEx && commit(startRest(sec, restEx.name, w))}
        canStart={!editing}
      />

      <Sheet open={reorder} onClose={() => setReorder(false)} title="Reordenar ejercicios">
        <ReorderList items={w.exercises} getKey={(e) => e.id} label={(e) => e.name} render={(e) => <span className="row-title">{e.name}</span>} onChange={(exercises) => commit({ ...w, exercises })} />
      </Sheet>

      <ActionMenu
        open={workoutMenu}
        onClose={() => setWorkoutMenu(false)}
        title={w.name}
        actions={[
          { label: 'Renombrar entrenamiento', onSelect: () => setEditMeta(true) },
          { label: w.pausedAt ? 'Reanudar' : 'Pausar', onSelect: togglePause },
          { label: 'Reordenar ejercicios', onSelect: () => setReorder(true), hidden: w.exercises.length < 2 },
          { label: 'Descartar entrenamiento', destructive: true, onSelect: discard },
        ]}
      />

      <MetaSheet open={editMeta} onClose={() => setEditMeta(false)} w={w} editing={editing} onSave={(p) => commit({ ...w, ...p })} />

      <Sheet
        open={finishing}
        onClose={() => setFinishing(false)}
        title={editing ? 'Guardar cambios' : 'Terminar entrenamiento'}
        footer={
          <>
            <Button onClick={() => setFinishing(false)}>Seguir</Button>
            <Button
              variant="primary"
              disabled={completedSets === 0}
              onClick={() => {
                setFinishing(false);
                doFinish();
              }}
            >
              {editing ? 'Guardar' : 'Terminar y guardar'}
            </Button>
          </>
        }
      >
        <div className="stack">
          <p>
            {completedSets} {completedSets === 1 ? 'serie completada' : 'series completadas'} · {fmtDuration(workoutDurationMs(w, now))}
          </p>
          {incomplete > 0 && (
            <div className="callout callout-neutral">
              <span>
                Hay {incomplete} {incomplete === 1 ? 'serie sin completar que no se guardará' : 'series sin completar que no se guardarán'}. Márcalas como completadas si las has hecho.
              </span>
            </div>
          )}
          {completedSets === 0 && (
            <div className="callout callout-neutral">
              <span>No hay ninguna serie completada. Completa alguna o descarta el entrenamiento.</span>
            </div>
          )}
        </div>
      </Sheet>
    </div>
  );
}

function fmtPrev(s: WorkoutSet | undefined, ex: WorkoutExercise): string {
  if (!s || !s.completed) return '—';
  if (usesDuration(ex.tracking)) return `${s.distanceM ? `${s.distanceM} m · ` : ''}${fmtSeconds(s.durationSec ?? 0)}`;
  if (usesWeight(ex.tracking)) return `${s.weight != null ? fmtWeightNum(s.weight) : '0'}×${s.reps ?? 0}`;
  return `${s.reps ?? 0} reps`;
}

function ExerciseCard({
  ex,
  info,
  prev,
  supersetWithNext,
  showNotes,
  nextSetId,
  onMenu,
  onNotes,
  onToggle,
  onChange,
  onSetMenu,
  onAddSet,
  onRest,
  onCopyPrev,
  defaultRest,
}: {
  ex: WorkoutExercise;
  info?: Exercise;
  prev?: WorkoutSet[];
  supersetWithNext: boolean;
  showNotes: boolean;
  nextSetId: string | null;
  onMenu: () => void;
  onNotes: (n: string) => void;
  onToggle: (s: WorkoutSet) => void;
  onChange: (setId: string, p: Partial<WorkoutSet>) => void;
  onSetMenu: (setId: string) => void;
  onAddSet: () => void;
  onRest: () => void;
  onCopyPrev: (sets: WorkoutSet[]) => void;
  defaultRest: number;
}) {
  const tw = usesWeight(ex.tracking);
  const tr = usesReps(ex.tracking);
  const td = usesDuration(ex.tracking);
  const tdist = usesDistance(ex.tracking);
  const effort = ex.effort !== 'none';
  const valueCols = (tw ? 1 : 0) + (tr ? 1 : 0) + (td ? 1 : 0) + (tdist ? 1 : 0) + (effort ? 1 : 0);
  const colClass = valueCols <= 1 ? 'cols-3' : valueCols >= 3 ? 'cols-5' : '';
  const prevDone = (prev ?? []).filter((x) => x.completed && x.type !== 'warmup');
  const bestPrev = prevDone[0];
  let n = 0;
  return (
    <section className={cx('wex', ex.supersetId && 'superset')} aria-label={ex.name}>
      <div className="wex-head">
        <ExerciseArt exercise={info ?? { id: ex.exerciseId, equipment: 'otros', movement: 'compuesto', primaryMuscle: ex.primaryMuscle }} size={76} />
        <button className="wex-name" onClick={() => navigate(`/exercises/${ex.exerciseId}`)} aria-label={`${ex.name}: ver ejercicio`}>
          <h3>{ex.name}</h3>
          <p>
            {MUSCLES[ex.primaryMuscle]}
            {info ? ` · ${EQUIPMENT[info.equipment]}` : ''}
            {ex.supersetId && ` · Superserie${supersetWithNext ? ' ↓' : ''}`}
          </p>
        </button>
        <IconButton label={`Opciones de ${ex.name}`} onClick={onMenu}>
          <Ellipsis size={22} />
        </IconButton>
      </div>
      {bestPrev && (
        <button
          type="button"
          className="last-time"
          style={{ width: 'calc(100% - 28px)', textAlign: 'left' }}
          onClick={() =>
            onCopyPrev(
              ex.sets.map((s, i) => {
                const p = matchPrev(prev, ex.sets, i);
                return !s.completed && p ? { ...s, weight: s.weight ?? p.weight, reps: s.reps ?? p.reps, durationSec: s.durationSec ?? p.durationSec, distanceM: s.distanceM ?? p.distanceM } : s;
              }),
            )
          }
          aria-label={`Última vez: ${fmtPrev(bestPrev, ex)}, ${prevDone.length} series. Pulsa para copiar los valores`}
        >
          <TrendingUp size={16} />
          <span style={{ flex: 1 }}>
            Última vez · {fmtPrevLong(bestPrev, ex)} · {prevDone.length} {prevDone.length === 1 ? 'serie' : 'series'}
          </span>
          <span className="link small" style={{ minHeight: 0 }}>
            Copiar
          </span>
        </button>
      )}
      {showNotes && (
        <div className="wex-notes">
          <Input value={ex.notes} onChange={(e) => onNotes(e.target.value)} placeholder="Nota del ejercicio" aria-label={`Nota de ${ex.name}`} />
        </div>
      )}
      <div className="set-table">
        <div className={cx('set-head', colClass)}>
          <span>Serie</span>
          {tw && <span>{ex.tracking === 'weight_reps' ? wUnit() : `${weightColumnLabel(ex.tracking)} ${wUnit()}`}</span>}
          {tdist && <span>Metros</span>}
          {tr && <span>Reps</span>}
          {td && <span>Min:s</span>}
          {effort && <span>{ex.effort.toUpperCase()}</span>}
          <span>
            <Clock3 size={14} aria-label="Completada" />
          </span>
        </div>
        {ex.sets.map((s, i) => {
          const label = s.type === 'normal' || s.type === 'failure' || s.type === 'drop' ? String(++n) : SET_TYPES[s.type].short;
          const p = matchPrev(prev, ex.sets, i);
          const t = s.target;
          // Nombre accesible coherente con el número visible.
          const sname = s.type === 'warmup' ? `de calentamiento ${i + 1}` : `serie ${n}`;
          return (
            <div key={s.id} className={cx('set-row', colClass, s.completed && 'done', s.id === nextSetId && 'next')}>
              <button className={cx('set-num', `t-${s.type}`)} onClick={() => onSetMenu(s.id)} aria-label={`${sname[0].toUpperCase()}${sname.slice(1)}: ${SET_TYPES[s.type].label}. Cambiar tipo o eliminar`}>
                {label}
                {s.type === 'drop' || s.type === 'failure' ? SET_TYPES[s.type].short : ''}
              </button>
              {tw && (
                <NumberInput
                  value={s.weight != null ? toDisplayWeight(s.weight) : null}
                  onChange={(v) => onChange(s.id, { weight: v == null ? null : fromDisplayWeight(v) })}
                  placeholder={t?.weight != null ? fmtWeightNum(t.weight) : p?.weight != null ? fmtWeightNum(p.weight) : '0'}
                  ariaLabel={`Peso ${sname}`}
                  max={9999}
                />
              )}
              {tdist && <NumberInput value={s.distanceM} onChange={(v) => onChange(s.id, { distanceM: v })} placeholder={p?.distanceM ? String(p.distanceM) : '0'} ariaLabel={`Distancia ${sname}`} max={1000000} />}
              {tr && (
                <NumberInput
                  value={s.reps}
                  decimals={false}
                  onChange={(v) => onChange(s.id, { reps: v })}
                  placeholder={t?.repsMin != null ? (t.repsMax != null && t.repsMax !== t.repsMin ? `${t.repsMin}-${t.repsMax}` : String(t.repsMin)) : p?.reps != null ? String(p.reps) : '0'}
                  ariaLabel={`Repeticiones ${sname}`}
                  max={9999}
                />
              )}
              {td && <DurationInput value={s.durationSec} onChange={(v) => onChange(s.id, { durationSec: v })} label={`Duración ${sname}`} />}
              {effort && (
                <NumberInput
                  value={ex.effort === 'rpe' ? s.rpe : s.rir}
                  onChange={(v) => onChange(s.id, ex.effort === 'rpe' ? { rpe: v } : { rir: v })}
                  placeholder={ex.effort === 'rpe' ? '8' : '2'}
                  ariaLabel={`${ex.effort.toUpperCase()} ${sname}`}
                  max={10}
                />
              )}
              <button className={cx('check-btn', s.completed && 'on')} onClick={() => onToggle(s)} aria-pressed={s.completed} aria-label={`${s.completed ? 'Desmarcar' : 'Completar'} ${sname}`}>
                <Check size={22} strokeWidth={3} />
              </button>
            </div>
          );
        })}
      </div>
      <div className="wex-foot">
        <Button size="sm" variant="tinted" icon={<Plus size={16} />} onClick={onAddSet}>
          Añadir serie
        </Button>
        <Button size="sm" icon={<Timer size={16} />} onClick={onRest} aria-label={`Descanso ${fmtSeconds(ex.restSec ?? defaultRest)}. Cambiar`}>
          {fmtSeconds(ex.restSec ?? defaultRest)}
        </Button>
      </div>
    </section>
  );
}

function fmtPrevLong(s: WorkoutSet, ex: WorkoutExercise): string {
  if (usesDuration(ex.tracking)) return fmtPrev(s, ex);
  if (usesWeight(ex.tracking)) return `${fmtWeightNum(s.weight ?? 0)} ${wUnit()} × ${s.reps ?? 0} reps`;
  return `${s.reps ?? 0} reps`;
}

function DurationInput({ value, onChange, label }: { value: number | null; onChange: (v: number | null) => void; label: string }) {
  const [text, setText] = useState(value != null ? fmtSeconds(value) : '');
  const focused = useRef(false);
  useEffect(() => {
    if (!focused.current) setText(value != null ? fmtSeconds(value) : '');
  }, [value]);
  return (
    <input
      className="input num-input"
      inputMode="numeric"
      aria-label={label}
      placeholder="0:00"
      value={text}
      onFocus={(e) => {
        focused.current = true;
        e.currentTarget.select();
      }}
      onChange={(e) => {
        const raw = e.target.value.replace(/[^0-9:]/g, '');
        setText(raw);
        if (!raw) return onChange(null);
        const parts = raw.split(':').map((x) => Number(x || 0));
        const sec = parts.length > 1 ? parts[0] * 60 + parts[1] : parts[0];
        if (Number.isFinite(sec)) onChange(sec);
      }}
      onBlur={() => {
        focused.current = false;
        setText(value != null ? fmtSeconds(value) : '');
      }}
    />
  );
}

function RestCard({
  remaining,
  total,
  paused,
  label,
  onAdjust,
  onPause,
  onRestart,
  onClose,
}: {
  remaining: number;
  total: number;
  paused: boolean;
  label: string;
  onAdjust: (d: number) => void;
  onPause: () => void;
  onRestart: () => void;
  onClose: () => void;
}) {
  const done = remaining <= 0;
  const pct = total > 0 ? Math.max(0, Math.min(1, remaining / (total * 1000))) : 0;
  const R = 36;
  const C = 2 * Math.PI * R;
  const ref = useRef<HTMLDivElement>(null);
  // Al empezar el descanso, la tarjeta se desplaza a la vista.
  useEffect(() => {
    ref.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, []);
  return (
    <div ref={ref} className={cx('rest-card', done && 'finished')} role="timer" aria-live={done ? 'assertive' : 'off'} aria-label={`Descanso${label ? ` tras ${label}` : ''}`}>
      <div className="grow">
        <div className="rest-label">{done ? 'Descanso terminado' : paused ? 'Descanso en pausa' : 'Descanso'}</div>
        <div className="rest-time">{done ? '00:00' : fmtSeconds(Math.ceil(remaining / 1000)).padStart(5, '0')}</div>
        <div className="rest-adjust">
          {done ? (
            <>
              <Button size="sm" onClick={onRestart} icon={<RotateCcw size={14} />}>
                Repetir
              </Button>
              <Button size="sm" variant="primary" onClick={onClose}>
                Continuar
              </Button>
            </>
          ) : (
            <>
              <Button size="sm" onClick={() => onAdjust(-15)} aria-label="Restar 15 segundos">
                −15 s
              </Button>
              <Button size="sm" onClick={() => onAdjust(15)} aria-label="Sumar 15 segundos">
                +15 s
              </Button>
              <Button size="sm" variant="plain" onClick={onClose} icon={<SkipForward size={14} />} aria-label="Saltar descanso">
                Saltar
              </Button>
            </>
          )}
        </div>
      </div>
      <div className="rest-ring">
        <svg width="84" height="84" aria-hidden="true">
          <circle cx="42" cy="42" r={R} className="ring-track" />
          <circle cx="42" cy="42" r={R} className="ring-fill" strokeDasharray={`${C * pct} ${C}`} transform="rotate(-90 42 42)" />
        </svg>
        {!done && (
          <button type="button" onClick={onPause} aria-label={paused ? 'Reanudar descanso' : 'Pausar descanso'}>
            {paused ? <Play size={24} fill="currentColor" /> : <Pause size={24} fill="currentColor" />}
          </button>
        )}
      </div>
    </div>
  );
}

const REST_PRESETS = [30, 45, 60, 90, 120, 150, 180, 240, 300];

function RestSheet({
  open,
  value,
  defaultRest,
  onClose,
  onSave,
  onStartNow,
  canStart,
}: {
  open: boolean;
  value: number | null;
  defaultRest: number;
  onClose: () => void;
  onSave: (v: number | null) => void;
  onStartNow: (sec: number) => void;
  canStart: boolean;
}) {
  const cur = value ?? defaultRest;
  return (
    <Sheet open={open} onClose={onClose} title="Descanso del ejercicio">
      <p className="small muted">Predeterminado: {fmtSeconds(defaultRest)}. Cambia la duración sólo para este ejercicio.</p>
      <div className="chips chips-wrap mt">
        <button className={cx('chip', value == null && 'active')} onClick={() => onSave(null)}>
          Predeterminado
        </button>
        {REST_PRESETS.map((s) => (
          <button key={s} className={cx('chip', value === s && 'active')} onClick={() => onSave(s)}>
            {fmtSeconds(s)}
          </button>
        ))}
        <button className={cx('chip', value === 0 && 'active')} onClick={() => onSave(0)}>
          Sin descanso
        </button>
      </div>
      {canStart && (
        <div className="mt-lg">
          <Button
            variant="tinted"
            block
            icon={<Timer size={18} />}
            onClick={() => {
              onStartNow(cur || defaultRest);
              onClose();
            }}
          >
            Iniciar descanso de {fmtSeconds(cur || defaultRest)} ahora
          </Button>
        </div>
      )}
    </Sheet>
  );
}

function MetaSheet({ open, onClose, w, editing, onSave }: { open: boolean; onClose: () => void; w: Workout; editing: boolean; onSave: (p: Partial<Workout>) => void }) {
  const [name, setName] = useState(w.name);
  const [date, setDate] = useState(w.date);
  const [time, setTime] = useState(timeKey(w.startedAt));
  const [minutes, setMinutes] = useState<number | null>(Math.round(workoutDurationMs(w) / 60000));
  const [key, setKey] = useState<string | null>(null);
  if (open && key !== w.id) {
    setKey(w.id);
    setName(w.name);
    setDate(w.date);
    setTime(timeKey(w.startedAt));
    setMinutes(Math.round(workoutDurationMs(w) / 60000));
  }
  if (!open && key) setKey(null);
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={editing ? 'Datos de la sesión' : 'Renombrar'}
      footer={
        <>
          <Button onClick={onClose}>Cancelar</Button>
          <Button
            variant="primary"
            disabled={!name.trim()}
            onClick={() => {
              if (editing) {
                const startedAt = localToMs(date, time || '12:00');
                onSave({ name: name.trim(), date: dateKey(startedAt), startedAt, endedAt: startedAt + (minutes ?? 0) * 60000, pausedTotalMs: 0, pausedAt: null });
              } else onSave({ name: name.trim() });
              onClose();
            }}
          >
            Guardar
          </Button>
        </>
      }
    >
      <Field label="Nombre">
        <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} data-autofocus />
      </Field>
      {editing && (
        <div className="form-grid">
          <Field label="Fecha">
            <DateInput value={date} max={today()} onChange={setDate} label="Fecha" />
          </Field>
          <Field label="Hora de inicio">
            <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
          </Field>
          <Field label="Duración (min)">
            <NumberInput value={minutes} onChange={setMinutes} decimals={false} max={1440} />
          </Field>
        </div>
      )}
    </Sheet>
  );
}
