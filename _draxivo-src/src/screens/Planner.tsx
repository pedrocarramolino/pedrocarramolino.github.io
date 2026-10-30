import { useState } from 'react';
import { Check, ChevronLeft, ChevronRight, Ellipsis, Moon, Play, Plus } from 'lucide-react';
import type { PlanEntry } from '../db/types';
import { useQuery } from '../app/hooks';
import { navigate } from '../app/router';
import { useSettings, useToast } from '../app/context';
import { deletePlanEntry, listPlan, listWeekGoals, savePlanEntry, setWeekGoal } from '../db/repo';
import { goalForWeek } from '../domain/review';
import { addDays, fmtDate, fmtRange, today, weekStart, weekday, WEEKDAYS, WEEKDAYS_ABBR } from '../lib/dates';
import { ActionMenu, Button, IconButton, List, Loading, Page, Row, Section, Sheet, cx, Stepper } from '../ui/kit';
import { useRoutines, useStartWorkout, useWorkouts } from './shared';

export function Planner() {
  const { settings } = useSettings();
  const toast = useToast();
  const plan = useQuery(listPlan, ['plan']);
  const goals = useQuery(listWeekGoals, ['weekgoals']);
  const routines = useRoutines();
  const workouts = useWorkouts();
  const start = useStartWorkout();
  const [ws, setWs] = useState(weekStart(today()));
  const [adding, setAdding] = useState<string | null>(null);
  const [entryMenu, setEntryMenu] = useState<PlanEntry | null>(null);
  const [moving, setMoving] = useState<PlanEntry | null>(null);

  if (!plan || !goals || !routines || !workouts) return <Loading />;
  const t = today();
  const days = Array.from({ length: 7 }, (_, i) => addDays(ws, i));
  const we = days[6];
  const weekPlan = plan.filter((p) => p.date >= ws && p.date <= we);
  const weekWorkouts = workouts.filter((w) => w.date >= ws && w.date <= we);
  const goal = goalForWeek(ws, settings, goals);
  const override = goals.find((g) => g.weekStart === ws);
  const planned = weekPlan.filter((p) => p.kind === 'routine');
  const isDone = (p: PlanEntry) => weekWorkouts.some((w) => w.date === p.date && w.routineId === p.routineId) || weekWorkouts.some((w) => w.planEntryId === p.id);
  const doneCount = planned.filter(isDone).length;
  const usable = routines.filter((r) => !r.archived && !r.isTemplate);
  const habitual = settings.trainingDays;

  return (
    <Page title="Planificación" back="/train" backLabel="Entrenar">
      <div className="cal-head panel" style={{ padding: 8 }}>
        <IconButton label="Semana anterior" onClick={() => setWs(addDays(ws, -7))}>
          <ChevronLeft size={20} />
        </IconButton>
        <div style={{ textAlign: 'center' }}>
          <strong>{fmtRange(ws, we)}</strong>
          {ws !== weekStart(t) && (
            <div>
              <button className="link small" onClick={() => setWs(weekStart(t))}>
                Ir a esta semana
              </button>
            </div>
          )}
        </div>
        <IconButton label="Semana siguiente" onClick={() => setWs(addDays(ws, 7))}>
          <ChevronRight size={20} />
        </IconButton>
      </div>

      <Section title="Objetivo de la semana">
        <List>
          <Row title="Sesiones objetivo" subtitle={override ? 'Ajustado para esta semana' : 'Valor predeterminado del perfil'}>
            <Stepper label="sesiones objetivo" value={goal} min={0} max={14} onChange={(v) => setWeekGoal(ws, v)} />
          </Row>
          {override && <Row title="Restablecer al predeterminado" onClick={() => setWeekGoal(ws, null)} />}
          <Row title="Planificado frente a realizado" value={`${doneCount}/${planned.length} planificadas · ${weekWorkouts.length} sesiones`} />
        </List>
      </Section>

      <Section title="Días">
        <div className="list">
          {days.map((d, i) => {
            const entries = weekPlan.filter((p) => p.date === d);
            const extra = weekWorkouts.filter((w) => w.date === d && !entries.some((p) => p.kind === 'routine' && (w.routineId === p.routineId || w.planEntryId === p.id)));
            return (
              <div key={d} className={cx('plan-day', d === t && 'is-today')}>
                <div className="plan-date">
                  <div className="wd">{WEEKDAYS_ABBR[i]}</div>
                  <div className="d">{Number(d.slice(8))}</div>
                </div>
                <div className="plan-items">
                  {!entries.length && !extra.length && <div className="small muted plan-item">{habitual.includes(i) ? 'Día habitual de entrenamiento' : 'Sin plan'}</div>}
                  {entries.map((p) => {
                    const r = routines.find((x) => x.id === p.routineId);
                    const done = p.kind === 'routine' && isDone(p);
                    return (
                      <div key={p.id} className="plan-item">
                        {p.kind === 'rest' ? <Moon size={16} className="muted" /> : done ? <Check size={16} style={{ color: 'var(--blue)' }} /> : <span style={{ width: 16 }} />}
                        <span className="grow">
                          {p.kind === 'rest' ? 'Descanso' : (r?.name ?? 'Rutina eliminada')}
                          <span className="tiny muted"> {p.kind === 'routine' ? (done ? '· completada' : d < t ? '· no realizada' : '· pendiente') : ''}</span>
                        </span>
                        {p.kind === 'routine' && !done && d === t && r && (
                          <IconButton label={`Empezar ${r.name}`} onClick={() => start(r.id, p.id)}>
                            <Play size={18} />
                          </IconButton>
                        )}
                        <IconButton label="Opciones" onClick={() => setEntryMenu(p)}>
                          <Ellipsis size={18} />
                        </IconButton>
                      </div>
                    );
                  })}
                  {extra.map((w) => (
                    <button key={w.id} className="plan-item link" onClick={() => navigate(`/history/${w.id}`)} style={{ textAlign: 'left' }}>
                      <Check size={16} />
                      <span className="grow">{w.name} · realizada</span>
                    </button>
                  ))}
                  <div>
                    <Button size="sm" variant="plain" icon={<Plus size={16} />} onClick={() => setAdding(d)} aria-label={`Añadir al ${WEEKDAYS[i]} ${fmtDate(d)}`}>
                      Añadir
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </Section>

      <Sheet open={!!adding} onClose={() => setAdding(null)} title={adding ? `Planificar · ${fmtDate(adding)}` : ''}>
        <List>
          <Row
            icon={<Moon size={20} />}
            title="Día de descanso"
            onClick={async () => {
              await savePlanEntry({ date: adding!, kind: 'rest' });
              setAdding(null);
            }}
          />
          {usable.map((r) => (
            <Row
              key={r.id}
              title={r.name}
              subtitle={`${r.exercises.length} ejercicios`}
              onClick={async () => {
                await savePlanEntry({ date: adding!, kind: 'routine', routineId: r.id });
                setAdding(null);
                toast(`«${r.name}» planificada`);
              }}
            />
          ))}
        </List>
        {!usable.length && (
          <p className="small muted mt">
            No tienes rutinas activas.{' '}
            <button className="link" onClick={() => navigate('/routines/new')}>
              Crear una
            </button>
          </p>
        )}
      </Sheet>

      <ActionMenu
        open={!!entryMenu}
        onClose={() => setEntryMenu(null)}
        title={entryMenu ? fmtDate(entryMenu.date) : ''}
        actions={[
          { label: 'Reprogramar a otro día', onSelect: () => setMoving(entryMenu) },
          { label: 'Ver rutina', hidden: !entryMenu?.routineId, onSelect: () => navigate(`/routines/${entryMenu!.routineId}`) },
          { label: 'Quitar del plan', destructive: true, onSelect: () => deletePlanEntry(entryMenu!.id) },
        ]}
      />

      <Sheet open={!!moving} onClose={() => setMoving(null)} title="Reprogramar">
        <List>
          {Array.from({ length: 14 }, (_, i) => addDays(weekStart(moving?.date ?? t), i)).map((d) => (
            <Row
              key={d}
              title={`${WEEKDAYS[weekday(d)]} ${fmtDate(d)}`}
              value={d === moving?.date ? 'Actual' : undefined}
              onClick={async () => {
                if (moving && d !== moving.date) {
                  await savePlanEntry({ ...moving, date: d });
                  toast(`Movida al ${fmtDate(d)}`);
                }
                setMoving(null);
              }}
            />
          ))}
        </List>
      </Sheet>
    </Page>
  );
}
