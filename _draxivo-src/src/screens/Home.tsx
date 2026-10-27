import { useState } from 'react';
import { ArrowDown, ArrowUp, CalendarDays, ChevronRight, ClipboardCheck, Dumbbell, History as HistoryIcon, Play, Plus, Scale as ScaleIcon } from 'lucide-react';
import { useSettings } from '../app/context';
import { useQuery } from '../app/hooks';
import { navigate } from '../app/router';
import { getMeta, listBodyWeights, listPlan, listReviews, listWeekGoals, setMeta } from '../db/repo';
import { goalForWeek, pendingReviewWeek } from '../domain/review';
import { periodStats, workoutStats } from '../domain/metrics';
import { weightSummary } from '../domain/weight';
import { addDays, fmtDateLong, fmtMinutes, fmtRange, relativeDay, today, weekStart, weekday, WEEKDAYS_ABBR, WEEKDAYS_SHORT } from '../lib/dates';
import { fmtSigned, fmtVolume, fmtWeightNum, num, toDisplayWeight, wUnit } from '../lib/units';
import { LineChart, WeekDots } from '../ui/charts';
import { Button, Card, Empty, IconButton, IconTile, Page, Progress, Section } from '../ui/kit';
import { WeightSheet, useRoutines, useStartWorkout, useWorkouts } from './shared';

const cap = (s: string) => s.replace(/^./, (c) => c.toUpperCase());

export function Home() {
  const { settings } = useSettings();
  const workouts = useWorkouts();
  const routines = useRoutines();
  const plan = useQuery(listPlan, ['plan']);
  const weights = useQuery(listBodyWeights, ['bodyweights']);
  const reviews = useQuery(listReviews, ['reviews']);
  const goals = useQuery(listWeekGoals, ['weekgoals']);
  const snooze = useQuery(() => getMeta<string>('reviewSnoozedUntil'), ['meta']);
  const start = useStartWorkout();
  const [weightOpen, setWeightOpen] = useState(false);

  const t = today();
  const ws = weekStart(t);
  const we = addDays(ws, 6);
  const header = { title: 'Hoy', subtitle: <span className="date-line">{settings.name ? `Hola, ${settings.name} · ` : ''}{cap(fmtDateLong(t))}</span> };
  if (!workouts || !routines || !plan || !weights || !reviews || !goals) return <Page {...header}>{null}</Page>;

  const goal = goalForWeek(ws, settings, goals);
  const week = periodStats(workouts, ws, we);
  const pct = goal > 0 ? week.workouts / goal : 0;
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = addDays(ws, i);
    const done = workouts.some((w) => w.date === d);
    const p = plan.filter((x) => x.date === d);
    const planned = p.some((x) => x.kind === 'routine');
    const rest = p.some((x) => x.kind === 'rest');
    const state: 'done' | 'planned' | 'rest' | 'none' | 'missed' = done ? 'done' : planned ? (d < t ? 'missed' : 'planned') : rest ? 'rest' : 'none';
    return { label: WEEKDAYS_SHORT[i], state, today: d === t };
  });
  const last = workouts[0];
  const nextPlan = plan.find((p) => p.kind === 'routine' && p.date >= t && !workouts.some((w) => w.date === p.date && w.routineId === p.routineId));
  const nextRoutine = nextPlan ? routines.find((r) => r.id === nextPlan.routineId) : undefined;
  const ws2 = weightSummary(weights);
  const chartDays = ws2.days.filter((d) => d.date > addDays(t, -7));
  const pendingWeek = pendingReviewWeek(t, settings, reviews, snooze);
  const thisWeekReview = reviews.find((r) => r.weekStart === ws);
  const lastReview = reviews.find((r) => r.status === 'completed');
  const empty = !workouts.length && !weights.length && !routines.length;
  const todayPlanned = nextPlan?.date === t && nextRoutine;

  return (
    <Page
      {...header}
      actions={
        <IconButton label="Planificación semanal" onClick={() => navigate('/plan')}>
          <CalendarDays size={24} />
        </IconButton>
      }
    >
      <div className="stack">
        {ws2.latest ? (
          <Card onClick={() => navigate('/body/weight')} ariaLabel="Ver peso corporal">
            <div className="split">
              <span className="card-kicker">Peso actual</span>
              <ChevronRight size={18} className="row-chevron" />
            </div>
            <div style={{ marginTop: 4 }}>
              <span className="hero-number">{fmtWeightNum(ws2.latest.weightKg)}</span>
              <span className="hero-unit">{wUnit()}</span>
            </div>
            <div className="delta mt" style={{ marginTop: 6 }}>
              {ws2.weekly ? (
                <>
                  {ws2.weekly.delta < 0 ? <ArrowDown size={16} /> : <ArrowUp size={16} />}
                  {fmtSigned(ws2.weekly.delta)} esta semana
                </>
              ) : (
                <span>{relativeDay(ws2.latest.date)} · registra varios días para ver la variación</span>
              )}
            </div>
            {chartDays.length >= 2 && (
              <div className="mt">
                <LineChart
                  points={chartDays.map((d) => ({ x: d.date, y: toDisplayWeight(d.weight) }))}
                  formatY={(v) => num(v, 0)}
                  formatX={(k) => cap(WEEKDAYS_ABBR[weekday(k)])}
                  label="Peso de los últimos días"
                  height={110}
                  showDots={false}
                />
              </div>
            )}
          </Card>
        ) : (
          <Card>
            <div className="card-row">
              <IconTile tone="blue">
                <ScaleIcon size={22} />
              </IconTile>
              <div className="grow">
                <div className="card-title">Sin registros de peso</div>
                <div className="card-sub">Registra tu peso para ver su evolución y tendencia.</div>
              </div>
            </div>
          </Card>
        )}

        <Button variant="primary" size="lg" block icon={<Play size={20} fill="currentColor" />} onClick={() => start(todayPlanned ? nextPlan!.routineId : null, todayPlanned ? nextPlan!.id : null)}>
          {todayPlanned ? `Empezar «${nextRoutine!.name}»` : 'Empezar entrenamiento'}
        </Button>
        <div className="btn-row">
          <Button icon={<ScaleIcon size={18} />} onClick={() => setWeightOpen(true)}>
            Registrar peso
          </Button>
          <Button icon={<CalendarDays size={18} />} onClick={() => navigate('/plan')}>
            Planificar
          </Button>
        </div>

        {empty && (
          <Empty
            icon={<Dumbbell size={26} />}
            title="Tu progreso empieza aquí"
            text="Crea tu primera rutina, empieza un entrenamiento libre o registra tu peso. Todo se guarda en este dispositivo."
            action={
              <Button variant="tinted" icon={<Plus size={18} />} onClick={() => navigate('/routines/new')}>
                Crear rutina
              </Button>
            }
          />
        )}

        <Card onClick={() => navigate('/plan')} ariaLabel="Ver planificación de la semana">
          <div className="card-kicker">Esta semana</div>
          <div className="split" style={{ marginTop: 2 }}>
            <span className="card-title">
              {week.workouts} de {goal} entrenamientos
            </span>
            <span className="muted tabular">{goal > 0 ? `${Math.min(999, Math.round(pct * 100))} %` : '—'}</span>
          </div>
          <div className="mt">
            <Progress value={pct} label="Cumplimiento semanal" />
          </div>
          <div className="mt-lg">
            <WeekDots days={days} label="Actividad de la semana" />
          </div>
          <div className="small muted mt">
            {fmtRange(ws, we)} · {fmtMinutes(week.minutes)} · {week.sets} series{week.volume ? ` · ${fmtVolume(week.volume)}` : ''}
          </div>
        </Card>

        <Card onClick={() => (nextRoutine ? navigate(`/routines/${nextRoutine.id}`) : navigate('/plan'))} ariaLabel="Próxima rutina">
          <div className="card-row">
            <IconTile>
              <Dumbbell size={22} />
            </IconTile>
            <div className="grow">
              <div className="card-kicker">Próxima rutina</div>
              <div className="card-title">{nextRoutine ? nextRoutine.name : 'Sin sesiones planificadas'}</div>
              <div className="card-sub">{nextRoutine && nextPlan ? `${relativeDay(nextPlan.date)} · ${nextRoutine.exercises.length} ejercicios` : 'Asigna rutinas a días concretos'}</div>
            </div>
            <ChevronRight size={18} className="row-chevron" />
          </div>
        </Card>

        <Card
          onClick={() =>
            pendingWeek
              ? navigate(`/reviews/new?week=${pendingWeek}`)
              : thisWeekReview
                ? navigate(thisWeekReview.status === 'completed' ? `/reviews/${thisWeekReview.id}` : `/reviews/${thisWeekReview.id}/edit`)
                : navigate('/reviews')
          }
          ariaLabel="Revisión semanal"
        >
          <div className="card-row">
            <IconTile>
              <ClipboardCheck size={22} />
            </IconTile>
            <div className="grow">
              <div className="card-kicker">Revisión semanal</div>
              <div className="card-title">
                {pendingWeek ? (
                  <>
                    <span className="dot" />
                    Pendiente
                  </>
                ) : thisWeekReview ? (
                  thisWeekReview.status === 'completed' ? 'Semana revisada' : 'Borrador'
                ) : settings.reviewEnabled ? (
                  'Al día'
                ) : (
                  'Desactivada'
                )}
              </div>
              <div className="card-sub">
                {pendingWeek ? `Semana del ${fmtRange(pendingWeek, addDays(pendingWeek, 6))}` : lastReview ? `Última: ${fmtRange(lastReview.weekStart, lastReview.weekEnd)}` : 'Aún no has hecho ninguna revisión'}
              </div>
            </div>
            <ChevronRight size={18} className="row-chevron" />
          </div>
        </Card>
        {pendingWeek && (
          <div style={{ marginTop: -4 }}>
            <Button size="sm" variant="plain" onClick={() => setMeta('reviewSnoozedUntil', addDays(t, 1))}>
              Recordármelo mañana
            </Button>
          </div>
        )}

        {last && (
          <Section title="Última sesión">
            <Card onClick={() => navigate(`/history/${last.id}`)} ariaLabel={`Última sesión: ${last.name}`}>
              <div className="card-row">
                <IconTile>
                  <HistoryIcon size={22} />
                </IconTile>
                <div className="grow">
                  <div className="card-title">{last.name}</div>
                  <div className="card-sub">
                    {relativeDay(last.date)} · {fmtMinutes(workoutStats(last).durationMs / 60000)} · {workoutStats(last).sets} series
                  </div>
                </div>
                <ChevronRight size={18} className="row-chevron" />
              </div>
            </Card>
          </Section>
        )}
      </div>
      <WeightSheet open={weightOpen} onClose={() => setWeightOpen(false)} />
    </Page>
  );
}
