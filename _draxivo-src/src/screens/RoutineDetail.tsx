import { useState } from 'react';
import { Check, Copy, Ellipsis, Lightbulb, Play } from 'lucide-react';
import { useQuery } from '../app/hooks';
import { navigate } from '../app/router';
import { useSettings, useToast } from '../app/context';
import { copyExercisesToRoutine, estimateRoutineMinutes, getMeta, getRoutine, saveRoutine, setMeta } from '../db/repo';
import { suggestionsForRoutine } from '../domain/progression';
import { dateKey, fmtDate, fmtMinutes, fmtSeconds } from '../lib/dates';
import { MUSCLES, SET_TYPES, usesDuration, usesWeight } from '../lib/labels';
import { fmtWeight } from '../lib/units';
import { ActionMenu, Button, Empty, IconButton, List, Loading, Page, Row, Section, Sheet, Tag, cx } from '../ui/kit';
import { useExerciseMap, useRoutines, useStartWorkout, useWorkouts } from './shared';
import { useRoutineActions } from './Routines';
import { ExerciseArt } from '../ui/ExerciseArt';

export function RoutineDetail({ id }: { id: string }) {
  const { settings } = useSettings();
  const toast = useToast();
  const r = useQuery(() => getRoutine(id), ['routines'], [id]);
  const exMap = useExerciseMap();
  const workouts = useWorkouts();
  const routines = useRoutines();
  const dismissedList = useQuery(() => getMeta<string[]>('dismissedSuggestions'), ['meta']);
  const start = useStartWorkout();
  const [menu, setMenu] = useState(false);
  const [copyOpen, setCopyOpen] = useState(false);
  const [copySel, setCopySel] = useState<string[]>([]);
  const { actions, moveSheet } = useRoutineActions();

  if (r === undefined || !workouts || !routines) return <Loading />;
  if (!r)
    return (
      <Page title="Rutina" back="/routines" backLabel="Rutinas">
        <Empty title="Rutina no encontrada" text="Puede que se haya eliminado." />
      </Page>
    );

  const dismissed = new Set(dismissedList ?? []);
  const suggestions = r.isTemplate ? [] : suggestionsForRoutine(r, workouts, (eid) => exMap.get(eid)?.equipment, dismissed);
  const sessions = workouts.filter((w) => w.routineId === r.id);
  const minutes = r.estimatedMin ?? estimateRoutineMinutes(r, settings.defaultRestSec);
  const parent = r.variantOf ? routines.find((x) => x.id === r.variantOf) : undefined;
  const variants = routines.filter((x) => x.variantOf === r.id);

  const dismiss = async (key: string) => setMeta('dismissedSuggestions', [...dismissed, key].slice(-500));
  const accept = async (reId: string, weight: number) => {
    await saveRoutine({ ...r, exercises: r.exercises.map((e) => (e.id === reId ? { ...e, sets: e.sets.map((s) => (s.type === 'normal' ? { ...s, weight } : s)) } : e)) });
    toast(`Carga objetivo actualizada a ${fmtWeight(weight)}`);
  };

  return (
    <Page
      title={r.name}
      back="/routines"
      backLabel="Rutinas"
      subtitle={[r.category, r.goal, `${r.exercises.length} ejercicios`, `~${fmtMinutes(minutes)}`].filter(Boolean).join(' · ')}
      actions={
        <IconButton label="Opciones" onClick={() => setMenu(true)}>
          <Ellipsis size={22} />
        </IconButton>
      }
    >
      {r.archived && <p className="callout callout-neutral">Rutina archivada. Su historial se conserva.</p>}
      {r.description && <p className="muted">{r.description}</p>}
      <div className="btn-row mt">
        {!r.isTemplate && !r.archived && (
          <Button variant="primary" size="lg" icon={<Play size={20} />} onClick={() => start(r.id)} disabled={!r.exercises.length}>
            Empezar
          </Button>
        )}
        <Button size="lg" onClick={() => navigate(`/routines/${r.id}/edit`)}>
          Editar
        </Button>
      </div>

      {suggestions.length > 0 && (
        <Section title="Sugerencias de progresión" footer="Son orientativas y se basan sólo en tu historial. No se aplican automáticamente.">
          <div className="stack">
            {suggestions.map((s) => (
              <div key={s.key} className="panel">
                <div className="split">
                  <strong>
                    <Lightbulb size={16} style={{ verticalAlign: '-2px', color: 'var(--blue)' }} /> {exMap.get(s.exerciseId)?.name}
                  </strong>
                  <Tag tone="blue">{s.kind === 'increase' ? `Valorar ${fmtWeight(s.suggestedWeight)}` : 'Mantener carga'}</Tag>
                </div>
                <ul className="bullets small mt">
                  {s.reasons.map((x) => (
                    <li key={x}>{x}</li>
                  ))}
                </ul>
                <div className="btn-row mt">
                  {s.kind === 'increase' && s.suggestedWeight != null && (
                    <Button size="sm" variant="tinted" icon={<Check size={16} />} onClick={() => accept(s.routineExerciseId, s.suggestedWeight!)}>
                      Aplicar objetivo
                    </Button>
                  )}
                  <Button size="sm" onClick={() => navigate(`/routines/${r.id}/edit`)}>
                    Modificar
                  </Button>
                  <Button size="sm" variant="plain" onClick={() => dismiss(s.key)}>
                    Ignorar
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      <Section title="Ejercicios">
        {r.exercises.length ? (
          <div className="stack gap-sm">
            {r.exercises.map((e, i) => {
              const ex = exMap.get(e.exerciseId);
              const linked = e.supersetId && r.exercises[i + 1]?.supersetId === e.supersetId;
              return (
                <div key={e.id} className={cx('panel', e.supersetId && 'wex superset')} style={{ marginTop: 0 }}>
                  <div className="split">
                    <button className="link" style={{ textAlign: 'left', fontSize: 16, display: 'flex', alignItems: 'center', gap: 12 }} onClick={() => navigate(`/exercises/${e.exerciseId}`)}>
                      <ExerciseArt exercise={ex} size={56} />
                      {ex?.name ?? 'Ejercicio eliminado'}
                    </button>
                    <span className="small muted">Descanso {fmtSeconds(e.restSec ?? settings.defaultRestSec)}</span>
                  </div>
                  <div className="small muted">
                    {ex ? MUSCLES[ex.primaryMuscle] : ''}
                    {e.supersetId ? ` · Superserie${linked ? ' con el siguiente' : ''}` : ''}
                    {e.effort !== 'none' ? ` · ${e.effort.toUpperCase()}` : ''}
                  </div>
                  <div className="mt small">
                    {e.sets.map((s, si) => (
                      <div key={s.id} className="split tabular" style={{ padding: '2px 0' }}>
                        <span className="muted">
                          {si + 1}. {s.type !== 'normal' ? SET_TYPES[s.type].label : 'Serie'}
                        </span>
                        <span>
                          {ex && usesDuration(ex.tracking)
                            ? `${s.distanceM ? `${s.distanceM} m · ` : ''}${fmtSeconds(s.durationSec ?? 0)}`
                            : `${s.repsMin ?? '?'}${s.repsMax != null && s.repsMax !== s.repsMin ? `–${s.repsMax}` : ''} reps`}
                          {ex && usesWeight(ex.tracking) && s.weight != null ? ` · ${fmtWeight(s.weight)}` : ''}
                          {s.rpe != null ? ` · RPE ${s.rpe}` : ''}
                          {s.rir != null ? ` · RIR ${s.rir}` : ''}
                        </span>
                      </div>
                    ))}
                  </div>
                  {e.notes && <p className="small muted mt">{e.notes}</p>}
                </div>
              );
            })}
          </div>
        ) : (
          <Empty title="Rutina vacía" text="Añade ejercicios desde el editor." action={<Button variant="tinted" onClick={() => navigate(`/routines/${r.id}/edit`)}>Añadir ejercicios</Button>} />
        )}
      </Section>

      {r.notes && (
        <Section title="Notas">
          <div className="panel">{r.notes}</div>
        </Section>
      )}

      {(parent || variants.length > 0) && (
        <Section title="Variantes">
          <List>
            {parent && <Row title={parent.name} subtitle="Rutina original" onClick={() => navigate(`/routines/${parent.id}`)} />}
            {variants.map((v) => (
              <Row key={v.id} title={v.name} subtitle="Variante" onClick={() => navigate(`/routines/${v.id}`)} />
            ))}
          </List>
        </Section>
      )}

      <Section title={`Sesiones realizadas · ${sessions.length}`}>
        {sessions.length ? (
          <List>
            {sessions.slice(0, 10).map((w) => (
              <Row key={w.id} title={fmtDate(w.date, true)} subtitle={w.name} onClick={() => navigate(`/history/${w.id}`)} />
            ))}
          </List>
        ) : (
          <p className="small muted">Aún no has completado esta rutina.</p>
        )}
      </Section>

      <p className="tiny muted mt-lg">
        Creada el {fmtDate(dateKey(r.createdAt), true)} · Modificada el {fmtDate(dateKey(r.updatedAt), true)}
      </p>

      <ActionMenu
        open={menu}
        onClose={() => setMenu(false)}
        title={r.name}
        actions={[...actions(r).filter((a) => a.label !== 'Editar'), { label: 'Copiar ejercicios a otra rutina', icon: <Copy size={20} />, onSelect: () => { setCopySel(r.exercises.map((e) => e.id)); setCopyOpen(true); }, hidden: !r.exercises.length }]}
      />
      {moveSheet}

      <Sheet open={copyOpen} onClose={() => setCopyOpen(false)} title="Copiar ejercicios" size="lg">
        <p className="small muted">1. Elige los ejercicios</p>
        <List className="mt">
          {r.exercises.map((e) => {
            const on = copySel.includes(e.id);
            return (
              <button key={e.id} className="row row-button" aria-pressed={on} onClick={() => setCopySel((s) => (on ? s.filter((x) => x !== e.id) : [...s, e.id]))}>
                <span className="row-main">
                  <span className="row-title">{exMap.get(e.exerciseId)?.name}</span>
                </span>
                <span className={cx('check-btn', on && 'on')}>{on && <Check size={18} />}</span>
              </button>
            );
          })}
        </List>
        <p className="small muted mt-lg">2. Elige la rutina de destino</p>
        <List className="mt">
          {routines
            .filter((x) => x.id !== r.id && !x.archived)
            .map((x) => (
              <Row
                key={x.id}
                title={x.name}
                onClick={async () => {
                  if (!copySel.length) return toast('Selecciona al menos un ejercicio', { tone: 'error' });
                  await copyExercisesToRoutine(
                    x.id,
                    r.exercises.filter((e) => copySel.includes(e.id)),
                  );
                  setCopyOpen(false);
                  toast(`${copySel.length} ejercicios copiados a «${x.name}»`);
                }}
              />
            ))}
        </List>
      </Sheet>
    </Page>
  );
}
