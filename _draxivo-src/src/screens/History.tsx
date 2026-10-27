import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Dumbbell, Ellipsis, Search } from 'lucide-react';
import type { Workout } from '../db/types';
import { useQuery } from '../app/hooks';
import { goBack, navigate } from '../app/router';
import { useToast } from '../app/context';
import { deleteWorkout, emptyRoutine, getWorkout, newPlannedSet, saveRoutine } from '../db/repo';
import { compareWorkouts, prsInWorkout, PR_LABELS, workoutStats } from '../domain/metrics';
import { addDays, addMonths, daysInMonth, fmtDate, fmtDateLong, fmtDuration, fmtMinutes, fmtMonth, monthStart, timeKey, today, WEEKDAYS_SHORT, weekday } from '../lib/dates';
import { fmtVolume } from '../lib/units';
import { ActionMenu, Button, Empty, Field, IconButton, Input, List, Loading, Page, Row, Section, Segmented, Select, Stat, cx, useConfirm } from '../ui/kit';
import { normalize, useExercises, useRoutines, useWorkouts } from './shared';
import { WorkoutBreakdown, fmtPR } from './WorkoutSummary';
import { uid } from '../lib/id';

export function WorkoutRow({ w }: { w: Workout }) {
  const st = workoutStats(w);
  return (
    <Row
      title={w.name}
      subtitle={`${fmtDate(w.date)} · ${fmtMinutes(st.durationMs / 60000)} · ${st.sets} series${st.volume ? ` · ${fmtVolume(st.volume)}` : ''}`}
      onClick={() => navigate(`/history/${w.id}`)}
    />
  );
}

function Calendar({ workouts, month, setMonth, selected, onSelect }: { workouts: Workout[]; month: string; setMonth: (m: string) => void; selected: string | null; onSelect: (d: string) => void }) {
  const first = monthStart(month);
  const lead = weekday(first);
  const n = daysInMonth(first);
  const byDay = new Set(workouts.map((w) => w.date));
  const t = today();
  const cells: (string | null)[] = [...Array(lead).fill(null), ...Array.from({ length: n }, (_, i) => addDays(first, i))];
  const count = workouts.filter((w) => w.date.startsWith(first.slice(0, 7))).length;
  return (
    <div className="cal">
      <div className="cal-head">
        <IconButton label="Mes anterior" onClick={() => setMonth(addMonths(first, -1))}>
          <ChevronLeft size={20} />
        </IconButton>
        <div style={{ textAlign: 'center' }}>
          <h3>{fmtMonth(first)}</h3>
          <div className="tiny muted">{count} {count === 1 ? 'entrenamiento' : 'entrenamientos'}</div>
        </div>
        <IconButton label="Mes siguiente" onClick={() => setMonth(addMonths(first, 1))}>
          <ChevronRight size={20} />
        </IconButton>
      </div>
      <div className="cal-grid">
        {WEEKDAYS_SHORT.map((d) => (
          <div key={d} className="cal-wd">
            {d}
          </div>
        ))}
        {cells.map((d, i) =>
          d ? (
            <button key={d} className={cx('cal-day', d === t && 'today', d === selected && 'selected')} onClick={() => onSelect(d)} aria-label={`${fmtDate(d, true)}${byDay.has(d) ? ', con entrenamiento' : ''}`}>
              <span>{Number(d.slice(8))}</span>
              <span className={cx('cal-dot', !byDay.has(d) && 'empty')} />
            </button>
          ) : (
            <span key={`e${i}`} />
          ),
        )}
      </div>
    </div>
  );
}

export function History() {
  const workouts = useWorkouts();
  const routines = useRoutines();
  const exercises = useExercises(true);
  const [view, setView] = useState<'list' | 'calendar'>('list');
  const [q, setQ] = useState('');
  const [routineId, setRoutineId] = useState('');
  const [exerciseId, setExerciseId] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [month, setMonth] = useState(today());
  const [day, setDay] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const nq = normalize(q.trim());
    return (workouts ?? []).filter(
      (w) =>
        (!routineId || w.routineId === routineId) &&
        (!exerciseId || w.exercises.some((e) => e.exerciseId === exerciseId)) &&
        (!from || w.date >= from) &&
        (!to || w.date <= to) &&
        (!nq || normalize(w.name).includes(nq) || normalize(w.notes).includes(nq) || w.exercises.some((e) => normalize(e.name).includes(nq))),
    );
  }, [workouts, q, routineId, exerciseId, from, to]);

  if (!workouts) return <Loading />;
  const usedEx = new Set(workouts.flatMap((w) => w.exercises.map((e) => e.exerciseId)));
  const groups = new Map<string, Workout[]>();
  for (const w of filtered) {
    const k = w.date.slice(0, 7);
    groups.set(k, [...(groups.get(k) ?? []), w]);
  }
  const anyFilter = q || routineId || exerciseId || from || to;

  return (
    <Page title="Historial" back="/progress" backLabel="Progreso" subtitle={`${workouts.length} ${workouts.length === 1 ? 'entrenamiento' : 'entrenamientos'}`}>
      <Segmented label="Vista" value={view} onChange={setView} options={[{ value: 'list', label: 'Lista' }, { value: 'calendar', label: 'Calendario' }]} />
      {view === 'calendar' ? (
        <div className="mt">
          <Calendar workouts={workouts} month={month} setMonth={setMonth} selected={day} onSelect={setDay} />
          {day && (
            <Section title={fmtDateLong(day)}>
              {workouts.filter((w) => w.date === day).length ? (
                <List>
                  {workouts
                    .filter((w) => w.date === day)
                    .map((w) => (
                      <WorkoutRow key={w.id} w={w} />
                    ))}
                </List>
              ) : (
                <p className="small muted">Sin entrenamientos este día.</p>
              )}
            </Section>
          )}
        </div>
      ) : (
        <>
          <div className="search mt">
            <Search size={18} />
            <Input type="search" placeholder="Buscar por nombre, ejercicio o nota" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar en el historial" />
          </div>
          <div className="form-grid">
            <Field label="Rutina">
              <Select value={routineId} onChange={setRoutineId}>
                <option value="">Todas</option>
                {(routines ?? []).map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Ejercicio">
              <Select value={exerciseId} onChange={setExerciseId}>
                <option value="">Todos</option>
                {(exercises ?? [])
                  .filter((e) => usedEx.has(e.id))
                  .map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.name}
                    </option>
                  ))}
              </Select>
            </Field>
            <Field label="Desde">
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </Field>
            <Field label="Hasta">
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </Field>
          </div>
          {anyFilter && (
            <Button
              variant="plain"
              size="sm"
              onClick={() => {
                setQ('');
                setRoutineId('');
                setExerciseId('');
                setFrom('');
                setTo('');
              }}
            >
              Quitar filtros ({filtered.length} resultados)
            </Button>
          )}
          {!workouts.length ? (
            <Section>
              <Empty icon={<Dumbbell size={24} />} title="Aún no hay entrenamientos" text="Cuando termines tu primera sesión aparecerá aquí." action={<Button variant="tinted" onClick={() => navigate('/train')}>Entrenar</Button>} />
            </Section>
          ) : !filtered.length ? (
            <p className="muted mt">No hay entrenamientos que coincidan.</p>
          ) : (
            [...groups.entries()].map(([m, list]) => (
              <Section key={m} title={`${fmtMonth(m + '-01')} · ${list.length}`}>
                <List>
                  {list.map((w) => (
                    <WorkoutRow key={w.id} w={w} />
                  ))}
                </List>
              </Section>
            ))
          )}
        </>
      )}
    </Page>
  );
}

export function WorkoutDetail({ id }: { id: string }) {
  const w = useQuery(() => getWorkout(id), ['workouts'], [id]);
  const history = useWorkouts();
  const toast = useToast();
  const confirm = useConfirm();
  const [menu, setMenu] = useState(false);
  const [cmpId, setCmpId] = useState<string>('');
  if (w === undefined || !history) return <Loading />;
  if (!w || w.status !== 'completed')
    return (
      <Page title="Entrenamiento" back="/history" backLabel="Historial">
        <Empty title="Entrenamiento no encontrado" />
      </Page>
    );
  const st = workoutStats(w);
  const prs = prsInWorkout(w, history);
  const candidates = history.filter((h) => h.id !== w.id);
  const defaultCmp = candidates.find((h) => h.startedAt < w.startedAt && (w.routineId ? h.routineId === w.routineId : true));
  const other = candidates.find((h) => h.id === (cmpId || defaultCmp?.id));
  const cmp = other ? compareWorkouts(w, other) : null;
  const os = other ? workoutStats(other) : null;

  const saveAsRoutine = async () => {
    const r = emptyRoutine({
      name: `${w.name} (desde sesión)`,
      exercises: w.exercises.map((e) => ({
        id: uid(),
        exerciseId: e.exerciseId,
        restSec: e.restSec,
        notes: e.notes,
        supersetId: e.supersetId,
        effort: e.effort,
        sets: e.sets.map((s) => newPlannedSet({ type: s.type, repsMin: s.reps, repsMax: s.reps, weight: s.weight, durationSec: s.durationSec, distanceM: s.distanceM })),
      })),
    });
    await saveRoutine(r);
    toast('Rutina creada a partir de la sesión');
    navigate(`/routines/${r.id}`);
  };

  return (
    <Page
      title={w.name}
      back="/history"
      backLabel="Historial"
      subtitle={`${fmtDateLong(w.date)} · ${timeKey(w.startedAt)}`}
      actions={
        <IconButton label="Opciones" onClick={() => setMenu(true)}>
          <Ellipsis size={22} />
        </IconButton>
      }
    >
      <div className="panel panel-flat">
        <div className="stats-grid cols-4">
          <Stat label="Duración" value={fmtDuration(st.durationMs)} />
          <Stat label="Series" value={st.sets} />
          <Stat label="Reps" value={st.reps} />
          <Stat label="Volumen" value={st.volume ? fmtVolume(st.volume) : '—'} />
        </div>
      </div>
      {w.routineName && <p className="small muted mt">Rutina: {w.routineName}</p>}

      {prs.length > 0 && (
        <Section title="Récords en esta sesión">
          <List>
            {prs.map((p, i) => (
              <Row key={i} title={p.exerciseName} subtitle={PR_LABELS[p.kind]} value={fmtPR(p)} />
            ))}
          </List>
        </Section>
      )}

      {w.notes && (
        <Section title="Notas">
          <div className="panel">{w.notes}</div>
        </Section>
      )}

      <WorkoutBreakdown w={w} />

      <Section title="Comparar con otra sesión">
        {candidates.length ? (
          <>
            <Select value={cmpId || defaultCmp?.id || ''} onChange={setCmpId} aria-label="Sesión para comparar">
              <option value="">Selecciona una sesión</option>
              {candidates.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.date} · {h.name}
                </option>
              ))}
            </Select>
            {other && cmp && os && (
              <div className="panel mt table-scroll">
                <table className="compare-table">
                  <thead>
                    <tr>
                      <th>Métrica</th>
                      <th>Esta</th>
                      <th>{fmtDate(other.date)}</th>
                      <th>Dif.</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>Volumen</td>
                      <td>{fmtVolume(st.volume)}</td>
                      <td>{fmtVolume(os.volume)}</td>
                      <td>{cmp.volume >= 0 ? '+' : '−'}{fmtVolume(Math.abs(cmp.volume))}</td>
                    </tr>
                    <tr>
                      <td>Series</td>
                      <td>{st.sets}</td>
                      <td>{os.sets}</td>
                      <td>{cmp.sets >= 0 ? '+' : ''}{cmp.sets}</td>
                    </tr>
                    <tr>
                      <td>Repeticiones</td>
                      <td>{st.reps}</td>
                      <td>{os.reps}</td>
                      <td>{cmp.reps >= 0 ? '+' : ''}{cmp.reps}</td>
                    </tr>
                    <tr>
                      <td>Duración</td>
                      <td>{fmtMinutes(st.durationMs / 60000)}</td>
                      <td>{fmtMinutes(os.durationMs / 60000)}</td>
                      <td>{cmp.durationMs >= 0 ? '+' : '−'}{fmtMinutes(Math.abs(cmp.durationMs) / 60000)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </>
        ) : (
          <p className="small muted">No hay otras sesiones con las que comparar.</p>
        )}
      </Section>

      <div className="btn-row mt-lg">
        <Button onClick={() => navigate(`/history/${w.id}/edit`)}>Editar sesión</Button>
      </div>

      <ActionMenu
        open={menu}
        onClose={() => setMenu(false)}
        title={w.name}
        actions={[
          { label: 'Editar sesión', onSelect: () => navigate(`/history/${w.id}/edit`) },
          { label: 'Guardar como rutina', onSelect: saveAsRoutine },
          {
            label: 'Eliminar sesión',
            destructive: true,
            onSelect: async () => {
              if (await confirm({ title: '¿Eliminar esta sesión?', message: 'Se eliminará del historial y de las estadísticas. Las revisiones semanales ya guardadas conservan su instantánea.', confirmLabel: 'Eliminar', destructive: true })) {
                await deleteWorkout(w.id);
                toast('Sesión eliminada');
                goBack('/history');
              }
            },
          },
        ]}
      />
    </Page>
  );
}
