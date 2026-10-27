import { useState } from 'react';
import { CalendarDays, ClipboardCheck, Dumbbell, Play, Plus, Scale as ScaleIcon } from 'lucide-react';
import { useSettings } from '../app/context';
import { useQuery } from '../app/hooks';
import { navigate } from '../app/router';
import { getMeta, listBodyWeights, listPlan, listReviews, listWeekGoals, setMeta } from '../db/repo';
import { goalForWeek, pendingReviewWeek } from '../domain/review';
import { periodStats, workoutStats } from '../domain/metrics';
import { weightSummary } from '../domain/weight';
import { addDays, fmtDate, fmtDateLong, fmtMinutes, fmtRange, relativeDay, today, weekStart, WEEKDAYS_SHORT } from '../lib/dates';
import { fmtSigned, fmtVolume, fmtWeightNum, wUnit } from '../lib/units';
import { Ring, Sparkline, WeekDots } from '../ui/charts';
import { Button, Empty, List, Page, Row, Section } from '../ui/kit';
import { WeightSheet, useRoutines, useStartWorkout, useWorkouts } from './shared';

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
  if (!workouts || !routines || !plan || !weights || !reviews || !goals) return <Page title="Hoy">{null}</Page>;

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
  const pendingWeek = pendingReviewWeek(t, settings, reviews, snooze);
  const thisWeekReview = reviews.find((r) => r.weekStart === ws);
  const lastReview = reviews.find((r) => r.status === 'completed');
  const empty = !workouts.length && !weights.length && !routines.length;
  const hello = settings.name ? `Hola, ${settings.name}` : null;

  return (
    <Page title="Hoy" subtitle={<span className="date-line">{hello ? `${hello} · ${fmtDateLong(t)}` : fmtDateLong(t).replace(/^./, (c) => c.toUpperCase())}</span>}>
      <div className="stack">
        <Button variant="primary" size="lg" block icon={<Play size={20} />} onClick={() => start(nextPlan?.date === t ? nextPlan.routineId : null, nextPlan?.date === t ? nextPlan.id : null)}>
          {nextPlan?.date === t && nextRoutine ? `Empezar «${nextRoutine.name}»` : 'Empezar entrenamiento'}
        </Button>
        <div className="btn-row">
          <Button icon={<ScaleIcon size={18} />} onClick={() => setWeightOpen(true)}>
            Registrar peso
          </Button>
          <Button icon={<CalendarDays size={18} />} onClick={() => navigate('/plan')}>
            Planificar
          </Button>
        </div>
      </div>

      {pendingWeek && (
        <Section>
          <div className="callout">
            <ClipboardCheck size={20} />
            <div style={{ flex: 1 }}>
              <strong>Revisión semanal disponible</strong>
              <div className="small muted">Semana {fmtRange(pendingWeek, addDays(pendingWeek, 6))}. Te llevará un par de minutos.</div>
              <div className="btn-row mt">
                <Button size="sm" variant="primary" onClick={() => navigate(`/reviews/new?week=${pendingWeek}`)}>
                  Empezar revisión
                </Button>
                <Button size="sm" onClick={() => setMeta('reviewSnoozedUntil', addDays(t, 1))}>
                  Mañana
                </Button>
              </div>
            </div>
          </div>
        </Section>
      )}

      {empty && (
        <Section>
          <Empty
            icon={<Dumbbell size={26} />}
            title="Tu progreso empieza aquí"
            text="Crea tu primera rutina, empieza un entrenamiento libre o registra tu peso. Todo se guarda en este dispositivo."
            action={
              <>
                <Button variant="tinted" icon={<Plus size={18} />} onClick={() => navigate('/routines/new')}>
                  Crear rutina
                </Button>
              </>
            }
          />
        </Section>
      )}

      <div className="home-grid">
        <Section title="Esta semana" action={<button className="link" onClick={() => navigate('/plan')}>Plan</button>}>
          <div className="panel">
            <div className="home-hero">
              <Ring value={pct} size={76} label={`${week.workouts} de ${goal} sesiones`}>
                {goal > 0 ? `${Math.round(pct * 100)}%` : '—'}
              </Ring>
              <div>
                <div>
                  <span className="hero-number">{week.workouts}</span>
                  <span className="hero-unit">/ {goal} sesiones</span>
                </div>
                <div className="small muted mt">{fmtRange(ws, we)}</div>
              </div>
            </div>
            <div className="mt-lg">
              <WeekDots days={days} label="Actividad de la semana" />
            </div>
          </div>
          <List>
            <Row title="Tiempo entrenado" value={fmtMinutes(week.minutes)} />
            <Row title="Series efectivas" value={week.sets} />
            <Row title="Volumen" value={week.volume ? fmtVolume(week.volume) : '—'} />
          </List>
        </Section>

        <Section title="Peso corporal" action={<button className="link" onClick={() => navigate('/body/weight')}>Ver todo</button>}>
          {ws2.latest ? (
            <div className="panel">
              <div className="split">
                <div>
                  <span className="hero-number">{fmtWeightNum(ws2.latest.weightKg)}</span>
                  <span className="hero-unit">{wUnit()}</span>
                  <div className="small muted mt">{relativeDay(ws2.latest.date)}</div>
                </div>
                <Sparkline values={ws2.days.slice(-14).map((d) => d.weight)} width={110} height={40} label="Peso de las últimas mediciones" />
              </div>
              <div className="small mt">
                {ws2.weekly ? (
                  <>
                    Variación semanal: <strong>{fmtSigned(ws2.weekly.delta)}</strong> <span className="muted">desde el {fmtDate(ws2.weekly.from.date)}</span>
                  </>
                ) : (
                  <span className="muted">Registra el peso durante al menos una semana para ver la variación semanal.</span>
                )}
              </div>
            </div>
          ) : (
            <Empty icon={<ScaleIcon size={24} />} title="Sin registros de peso" text="Registra tu peso para ver su evolución y tendencia." action={<Button variant="tinted" onClick={() => setWeightOpen(true)}>Registrar peso</Button>} />
          )}
        </Section>

        <Section title="Próximo y reciente">
          <List>
            {nextPlan && nextRoutine ? (
              <Row
                icon={<CalendarDays size={20} />}
                title={nextRoutine.name}
                subtitle={`Planificada · ${relativeDay(nextPlan.date)}`}
                onClick={() => navigate(`/routines/${nextRoutine.id}`)}
              />
            ) : (
              <Row icon={<CalendarDays size={20} />} title="Sin sesiones planificadas" subtitle="Asigna rutinas a días concretos" onClick={() => navigate('/plan')} />
            )}
            {last ? (
              <Row
                icon={<Dumbbell size={20} />}
                title={last.name}
                subtitle={`Última sesión · ${relativeDay(last.date)} · ${fmtMinutes(workoutStats(last).durationMs / 60000)}`}
                onClick={() => navigate(`/history/${last.id}`)}
              />
            ) : (
              <Row icon={<Dumbbell size={20} />} title="Aún no hay sesiones" subtitle="Tu última sesión aparecerá aquí" />
            )}
          </List>
        </Section>

        <Section title="Revisión semanal">
          <List>
            {thisWeekReview ? (
              <Row
                icon={<ClipboardCheck size={20} />}
                title={thisWeekReview.status === 'completed' ? 'Semana revisada' : 'Revisión en borrador'}
                subtitle={fmtRange(thisWeekReview.weekStart, thisWeekReview.weekEnd)}
                onClick={() => navigate(thisWeekReview.status === 'completed' ? `/reviews/${thisWeekReview.id}` : `/reviews/${thisWeekReview.id}/edit`)}
              />
            ) : (
              <Row
                icon={<ClipboardCheck size={20} />}
                title={pendingWeek ? 'Pendiente' : settings.reviewEnabled ? 'Al día' : 'Desactivada'}
                subtitle={lastReview ? `Última: ${fmtRange(lastReview.weekStart, lastReview.weekEnd)}` : 'Aún no has hecho ninguna revisión'}
                onClick={() => navigate('/reviews')}
              />
            )}
          </List>
        </Section>
      </div>
      <WeightSheet open={weightOpen} onClose={() => setWeightOpen(false)} />
    </Page>
  );
}
