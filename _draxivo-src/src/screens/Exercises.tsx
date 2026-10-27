import { useMemo, useState } from 'react';
import { Ellipsis, Plus, Search } from 'lucide-react';
import type { Equipment, MuscleGroup } from '../db/types';
import { useQuery } from '../app/hooks';
import { goBack, navigate } from '../app/router';
import { useToast } from '../app/context';
import { deleteExercise, getExercise, saveExercise } from '../db/repo';
import { exerciseHistory, personalRecords, PR_LABELS, type ExercisePoint, type PRKind } from '../domain/metrics';
import { fmtDate, fmtDateShort } from '../lib/dates';
import { EQUIPMENT, MOVEMENTS, MUSCLES, TRACKING, supportsLoadMetrics, usesDistance, usesDuration } from '../lib/labels';
import { fmtWeightNum, num, toDisplayWeight, wUnit } from '../lib/units';
import { LineChart } from '../ui/charts';
import { ActionMenu, Button, Empty, IconButton, Input, List, Loading, Page, Row, Section, Segmented, Select, Tag, useConfirm } from '../ui/kit';
import { ExerciseForm, normalize, useExercises, useWorkouts } from './shared';
import { fmtPR, fmtSet } from './WorkoutSummary';

export function Exercises() {
  const all = useExercises(true);
  const workouts = useWorkouts();
  const [q, setQ] = useState('');
  const [muscle, setMuscle] = useState<MuscleGroup | ''>('');
  const [equip, setEquip] = useState<Equipment | ''>('');
  const [tab, setTab] = useState<'all' | 'custom' | 'archived'>('all');
  const [creating, setCreating] = useState(false);
  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const w of workouts ?? []) for (const e of w.exercises) m.set(e.exerciseId, (m.get(e.exerciseId) ?? 0) + 1);
    return m;
  }, [workouts]);
  const list = useMemo(() => {
    const nq = normalize(q.trim());
    return (all ?? []).filter(
      (e) =>
        (tab === 'archived' ? e.archived : !e.archived) &&
        (tab !== 'custom' || e.custom) &&
        (!nq || normalize(e.name).includes(nq)) &&
        (!muscle || e.primaryMuscle === muscle || e.secondaryMuscles.includes(muscle)) &&
        (!equip || e.equipment === equip),
    );
  }, [all, q, muscle, equip, tab]);
  if (!all) return <Loading />;
  return (
    <Page
      title="Ejercicios"
      back="/routines"
      backLabel="Rutinas"
      subtitle={`${all.filter((e) => !e.archived).length} ejercicios`}
      actions={
        <IconButton label="Nuevo ejercicio" onClick={() => setCreating(true)}>
          <Plus size={24} />
        </IconButton>
      }
    >
      <Segmented label="Filtrar" value={tab} onChange={setTab} options={[{ value: 'all', label: 'Todos' }, { value: 'custom', label: 'Personalizados' }, { value: 'archived', label: 'Archivados' }]} />
      <div className="search mt">
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
      <Section>
        {list.length ? (
          <List>
            {list.map((e) => (
              <Row
                key={e.id}
                title={e.name}
                subtitle={`${MUSCLES[e.primaryMuscle]} · ${EQUIPMENT[e.equipment]}${counts.get(e.id) ? ` · ${counts.get(e.id)} sesiones` : ''}`}
                value={e.custom ? <Tag>Propio</Tag> : undefined}
                onClick={() => navigate(`/exercises/${e.id}`)}
              />
            ))}
          </List>
        ) : (
          <Empty title="Sin resultados" text={tab === 'custom' ? 'Aún no has creado ejercicios personalizados.' : 'Prueba con otros filtros.'} action={<Button variant="tinted" onClick={() => setCreating(true)}>Crear ejercicio</Button>} />
        )}
      </Section>
      <ExerciseForm open={creating} onClose={() => setCreating(false)} onSaved={(e) => navigate(`/exercises/${e.id}`)} initial={{ name: q }} />
    </Page>
  );
}

type Metric = 'e1rm' | 'maxWeight' | 'volume' | 'maxReps' | 'totalReps' | 'maxDuration' | 'maxDistance';

export function ExerciseDetail({ id }: { id: string }) {
  const ex = useQuery(() => getExercise(id), ['exercises'], [id]);
  const workouts = useWorkouts();
  const toast = useToast();
  const confirm = useConfirm();
  const [editing, setEditing] = useState(false);
  const [menu, setMenu] = useState(false);
  const [metric, setMetric] = useState<Metric | null>(null);
  if (ex === undefined || !workouts) return <Loading />;
  if (!ex)
    return (
      <Page title="Ejercicio" back="/exercises" backLabel="Ejercicios">
        <Empty title="Ejercicio no encontrado" />
      </Page>
    );
  const hist = exerciseHistory(workouts, id);
  const prs = personalRecords(workouts, id);
  const load = supportsLoadMetrics(ex.tracking);
  const options: { value: Metric; label: string }[] = load
    ? [
        { value: 'e1rm', label: '1RM est.' },
        { value: 'maxWeight', label: 'Peso máx.' },
        { value: 'volume', label: 'Volumen' },
        { value: 'totalReps', label: 'Reps' },
      ]
    : usesDuration(ex.tracking)
      ? [{ value: 'maxDuration', label: 'Duración' }, ...(usesDistance(ex.tracking) ? [{ value: 'maxDistance' as Metric, label: 'Distancia' }] : [])]
      : [
          { value: 'maxReps', label: 'Reps máx.' },
          { value: 'totalReps', label: 'Reps totales' },
          ...(ex.tracking === 'assisted_bodyweight' ? [{ value: 'maxWeight' as Metric, label: 'Asistencia' }] : []),
        ];
  const m = metric && options.some((o) => o.value === metric) ? metric : options[0].value;
  const val = (p: ExercisePoint): number | null => {
    switch (m) {
      case 'e1rm':
        return p.e1rm;
      case 'maxWeight':
        return ex.tracking === 'assisted_bodyweight' ? (p.bestSet?.weight ?? null) : p.maxWeight;
      case 'volume':
        return p.volume || null;
      case 'maxReps':
        return p.maxReps;
      case 'totalReps':
        return p.totalReps;
      case 'maxDuration':
        return p.maxDuration;
      case 'maxDistance':
        return p.maxDistance;
    }
  };
  const isWeight = m === 'e1rm' || m === 'maxWeight' || m === 'volume';
  const points = hist
    .map((p) => ({ x: p.date, y: val(p) }))
    .filter((p): p is { x: string; y: number } => p.y != null)
    // Un punto por día (el mejor).
    .reduce<{ x: string; y: number }[]>((acc, p) => {
      const last = acc[acc.length - 1];
      if (last && last.x === p.x) last.y = Math.max(last.y, p.y);
      else acc.push({ ...p });
      return acc;
    }, [])
    .map((p) => ({ x: p.x, y: isWeight ? toDisplayWeight(p.y) : p.y }));

  return (
    <Page
      title={ex.name}
      back="/exercises"
      backLabel="Ejercicios"
      subtitle={`${MUSCLES[ex.primaryMuscle]} · ${EQUIPMENT[ex.equipment]}`}
      actions={
        <IconButton label="Opciones" onClick={() => setMenu(true)}>
          <Ellipsis size={22} />
        </IconButton>
      }
    >
      {ex.archived && <p className="callout callout-neutral">Ejercicio archivado: no aparece al añadir ejercicios, pero su historial se conserva.</p>}

      <Section title="Progresión">
        {points.length ? (
          <div className="panel">
            <Segmented label="Métrica" value={m} onChange={setMetric} options={options} />
            <div className="mt">
              {points.length >= 2 ? (
                <LineChart
                  points={points}
                  label={`Evolución de ${options.find((o) => o.value === m)?.label}`}
                  formatY={(v) => (m === 'maxDuration' ? `${Math.round(v)} s` : m === 'maxDistance' ? `${num(v, 0)} m` : num(v, isWeight ? 1 : 0))}
                  formatX={fmtDateShort}
                />
              ) : (
                <p className="small muted">Necesitas al menos dos sesiones para ver una gráfica.</p>
              )}
            </div>
            {m === 'e1rm' && <p className="tiny muted mt">1RM estimado con la fórmula de Epley a partir de series de 1 a 12 repeticiones. Es una estimación, no una marca real.</p>}
            {m === 'volume' && <p className="tiny muted mt">Volumen = carga × repeticiones de las series efectivas (sin calentamiento), en {wUnit()}.</p>}
          </div>
        ) : (
          <Empty title="Sin historial" text="Cuando registres este ejercicio verás aquí su evolución." />
        )}
      </Section>

      {Object.keys(prs).length > 0 && (
        <Section title="Récords personales">
          <List>
            {(Object.entries(prs) as [PRKind, { value: number; date: string; workoutId: string }][]).map(([k, v]) => (
              <Row key={k} title={PR_LABELS[k]} subtitle={fmtDate(v.date, true)} value={<strong>{fmtPR({ kind: k, value: v.value })}</strong>} onClick={() => navigate(`/history/${v.workoutId}`)} />
            ))}
          </List>
        </Section>
      )}

      {hist.length > 0 && (
        <Section title={`Historial · ${hist.length}`}>
          <List>
            {[...hist]
              .reverse()
              .slice(0, 30)
              .map((p) => (
                <Row
                  key={p.workoutId}
                  title={fmtDate(p.date, true)}
                  subtitle={p.bestSet ? `Mejor serie: ${fmtSet(p.bestSet, ex)}` : undefined}
                  value={load && p.e1rm ? `1RM est. ${fmtWeightNum(p.e1rm)}` : `${p.sets} series`}
                  onClick={() => navigate(`/history/${p.workoutId}`)}
                />
              ))}
          </List>
        </Section>
      )}

      <Section title="Información">
        <List>
          <Row title="Tipo de registro" value={TRACKING[ex.tracking]} />
          <Row title="Movimiento" value={MOVEMENTS[ex.movement]} />
          <Row title="Secundarios" value={ex.secondaryMuscles.length ? ex.secondaryMuscles.map((x) => MUSCLES[x]).join(', ') : '—'} />
          <Row title="Unidad" value={load || ex.tracking === 'assisted_bodyweight' ? wUnit() : usesDuration(ex.tracking) ? (usesDistance(ex.tracking) ? 'm y s' : 's') : 'reps'} />
        </List>
        {ex.instructions && <p className="mt" style={{ padding: '0 4px' }}>{ex.instructions}</p>}
        {ex.notes && (
          <div className="panel mt">
            <div className="field-label">Notas personales</div>
            {ex.notes}
          </div>
        )}
      </Section>

      <ExerciseForm open={editing} onClose={() => setEditing(false)} initial={ex} />
      <ActionMenu
        open={menu}
        onClose={() => setMenu(false)}
        title={ex.name}
        actions={[
          { label: ex.custom ? 'Editar ejercicio' : 'Editar notas e información', onSelect: () => setEditing(true) },
          { label: 'Restaurar', hidden: !ex.archived, onSelect: async () => { await saveExercise({ ...ex, archived: false }); toast('Ejercicio restaurado'); } },
          {
            label: ex.custom ? 'Eliminar ejercicio' : 'Archivar ejercicio',
            destructive: true,
            hidden: ex.archived,
            onSelect: async () => {
              if (!(await confirm({ title: ex.custom ? '¿Eliminar este ejercicio?' : '¿Archivar este ejercicio?', message: 'Si se usa en rutinas o en el historial se archivará para conservar tus datos.', confirmLabel: ex.custom ? 'Eliminar' : 'Archivar', destructive: true }))) return;
              const res = await deleteExercise(ex.id);
              toast(res === 'deleted' ? 'Ejercicio eliminado' : 'Ejercicio archivado');
              if (res === 'deleted') goBack('/exercises');
            },
          },
        ]}
      />
    </Page>
  );
}
