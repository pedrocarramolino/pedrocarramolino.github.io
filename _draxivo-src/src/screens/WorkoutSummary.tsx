import { Trophy } from 'lucide-react';
import type { Workout, WorkoutExercise, WorkoutSet } from '../db/types';
import { useQuery } from '../app/hooks';
import { navigate } from '../app/router';
import { getWorkout } from '../db/repo';
import { PR_LABELS, compareWorkouts, estimate1RM, previousEquivalent, prsInWorkout, workoutStats, type PR } from '../domain/metrics';
import { fmtDateLong, fmtDuration, fmtSeconds, fmtMinutes } from '../lib/dates';
import { SET_TYPES, supportsLoadMetrics, usesDistance, usesDuration, usesWeight } from '../lib/labels';
import { fmtDistance, fmtVolume, fmtWeight, fmtWeightNum, num, wUnit } from '../lib/units';
import { Button, List, Loading, Page, Row, Section, Stat } from '../ui/kit';
import { useWorkouts } from './shared';

export function fmtSet(s: WorkoutSet, ex: Pick<WorkoutExercise, 'tracking'>): string {
  const parts: string[] = [];
  if (usesWeight(ex.tracking)) {
    const sign = ex.tracking === 'weighted_bodyweight' ? '+' : ex.tracking === 'assisted_bodyweight' ? '−' : '';
    parts.push(`${sign}${fmtWeightNum(s.weight ?? 0)} ${wUnit()} × ${s.reps ?? 0}`);
  } else if (!usesDuration(ex.tracking)) parts.push(`${s.reps ?? 0} reps`);
  if (usesDistance(ex.tracking) && s.distanceM) parts.push(fmtDistance(s.distanceM));
  if (usesDuration(ex.tracking)) parts.push(fmtSeconds(s.durationSec ?? 0));
  if (s.rpe != null) parts.push(`RPE ${num(s.rpe)}`);
  if (s.rir != null) parts.push(`RIR ${num(s.rir)}`);
  return parts.join(' · ');
}

export function fmtPR(pr: Pick<PR, 'kind' | 'value'>): string {
  switch (pr.kind) {
    case 'maxWeight':
    case 'e1rm':
      return fmtWeight(pr.value);
    case 'bestSetVolume':
      return fmtVolume(pr.value);
    case 'maxReps':
      return `${pr.value} reps`;
    case 'maxDuration':
      return fmtSeconds(pr.value);
    case 'maxDistance':
      return fmtDistance(pr.value);
  }
}

export function WorkoutBreakdown({ w }: { w: Workout }) {
  return (
    <>
      {w.exercises.map((ex) => {
        let n = 0;
        return (
          <Section key={ex.id} title={ex.name} action={<button className="link small" onClick={() => navigate(`/exercises/${ex.exerciseId}`)}>Estadísticas</button>}>
            <List>
              {ex.sets.map((s) => {
                const label = s.type === 'warmup' ? 'C' : String(++n);
                const e1 = supportsLoadMetrics(ex.tracking) && s.type !== 'warmup' ? estimate1RM(s.weight, s.reps) : null;
                return (
                  <Row
                    key={s.id}
                    title={
                      <span>
                        <span className="muted tabular" style={{ display: 'inline-block', width: 28 }}>
                          {label}
                        </span>
                        {fmtSet(s, ex)}
                      </span>
                    }
                    subtitle={s.type !== 'normal' ? SET_TYPES[s.type].label : undefined}
                    value={e1 ? <span className="small">1RM est. {fmtWeightNum(e1)}</span> : undefined}
                  />
                );
              })}
              {ex.notes && <Row title={<span className="small muted">{ex.notes}</span>} />}
            </List>
          </Section>
        );
      })}
    </>
  );
}

function Delta({ v, fmt }: { v: number; fmt: (n: number) => string }) {
  if (Math.abs(v) < 0.001) return <span className="muted">igual</span>;
  return <span>{v > 0 ? '+' : '−'}{fmt(Math.abs(v))}</span>;
}

export function WorkoutSummary({ id }: { id: string }) {
  const w = useQuery(() => getWorkout(id), ['workouts'], [id]);
  const history = useWorkouts();
  if (!w || !history) return <Loading />;
  const st = workoutStats(w);
  const prs = prsInWorkout(w, history);
  const prev = previousEquivalent(history, w);
  const cmp = prev ? compareWorkouts(w, prev) : null;
  return (
    <Page title="¡Entrenamiento guardado!" subtitle={`${w.name} · ${fmtDateLong(w.date)}`}>
      <div className="panel panel-flat">
        <div className="stats-grid cols-3">
          <Stat label="Duración" value={fmtDuration(st.durationMs)} />
          <Stat label="Ejercicios" value={st.exercises} />
          <Stat label="Series" value={st.sets} sub={st.warmupSets ? `+${st.warmupSets} de calentamiento` : undefined} />
          <Stat label="Repeticiones" value={st.reps} />
          <Stat label="Volumen total" value={st.volume ? fmtVolume(st.volume) : '—'} sub="carga × repeticiones" />
          <Stat label="Récords" value={prs.length} />
        </div>
      </div>

      {prs.length > 0 && (
        <Section title="Récords personales">
          <List>
            {prs.map((p, i) => (
              <Row key={i} icon={<Trophy size={20} />} title={p.exerciseName} subtitle={`${PR_LABELS[p.kind]} · antes ${fmtPR({ kind: p.kind, value: p.previous })}`} value={<strong>{fmtPR(p)}</strong>} />
            ))}
          </List>
        </Section>
      )}

      <Section title="Comparación con la sesión anterior">
        {prev && cmp ? (
          <List>
            <Row title="Sesión anterior" value={prev.date} onClick={() => navigate(`/history/${prev.id}`)} />
            <Row title="Volumen" value={<Delta v={cmp.volume} fmt={fmtVolume} />} />
            <Row title="Series" value={<Delta v={cmp.sets} fmt={(n) => String(n)} />} />
            <Row title="Repeticiones" value={<Delta v={cmp.reps} fmt={(n) => String(n)} />} />
            <Row title="Duración" value={<Delta v={cmp.durationMs / 60000} fmt={(n) => fmtMinutes(n)} />} />
          </List>
        ) : (
          <p className="small muted">{w.routineId ? 'Es la primera vez que completas esta rutina.' : 'Las sesiones libres no tienen una sesión equivalente con la que comparar.'}</p>
        )}
      </Section>

      {w.notes && (
        <Section title="Notas">
          <div className="panel">{w.notes}</div>
        </Section>
      )}

      <WorkoutBreakdown w={w} />

      <div className="btn-row mt-lg">
        <Button onClick={() => navigate(`/history/${w.id}`, { replace: true })}>Ver detalle</Button>
        <Button variant="primary" onClick={() => navigate('/', { replace: true })}>
          Hecho
        </Button>
      </div>
    </Page>
  );
}
