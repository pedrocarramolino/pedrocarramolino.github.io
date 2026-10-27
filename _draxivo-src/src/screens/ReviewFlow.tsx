import { useEffect, useState } from 'react';
import { Info } from 'lucide-react';
import type { MuscleGroup, WeeklyReview } from '../db/types';
import { useSettings, useToast } from '../app/context';
import { goBack, navigate, useRoute } from '../app/router';
import { getReview, listBodyWeights, listMeasurements, listPlan, listReviews, listWeekGoals, listWorkouts, saveReview, setMeta, setWeekGoal } from '../db/repo';
import { buildConclusions, computeReviewMetrics, emptyAnswers, proposeNextGoal, reviewTargetWeek } from '../domain/review';
import { dailyWeights } from '../domain/weight';
import { addDays, fmtDateShort, fmtMinutes, fmtRange, isDateKey, today } from '../lib/dates';
import { MEASUREMENTS, MUSCLES } from '../lib/labels';
import { fmtSigned, fmtVolume, fmtWeight, num, toDisplayWeight } from '../lib/units';
import { uid } from '../lib/id';
import { HBars, LineChart } from '../ui/charts';
import { Button, Field, Input, List, Loading, NumberInput, Page, Row, Scale, Section, Stat, TextArea, Toggle } from '../ui/kit';

const STEPS = ['Resumen', 'Evolución física', 'Valoración', 'Conclusiones', 'Guardar'];

export function ReviewMetricsView({ m }: { m: WeeklyReview['metrics'] }) {
  const muscles = (Object.entries(m.muscleSets) as [MuscleGroup, number][]).sort((a, b) => b[1] - a[1]);
  return (
    <>
      <div className="panel panel-flat">
        <div className="stats-grid cols-3">
          <Stat label="Completados" value={`${m.completedSessions}/${m.goalSessions}`} sub={m.plannedSessions != null ? `${m.plannedSessions} planificados` : 'Sin planificación'} />
          <Stat label="Cumplimiento" value={m.goalSessions ? `${Math.round((m.completedSessions / m.goalSessions) * 100)} %` : '—'} />
          <Stat label="Tiempo" value={fmtMinutes(m.totalMinutes)} />
          <Stat label="Series" value={m.sets} sub={`${m.reps} reps`} />
          <Stat label="Volumen" value={m.volumeKg ? fmtVolume(m.volumeKg) : '—'} sub={m.prevVolumeKg ? `semana anterior ${fmtVolume(m.prevVolumeKg)}` : undefined} />
          <Stat label="Récords" value={m.prs.length} />
          <Stat label="Peso inicio" value={m.weightStart != null ? fmtWeight(m.weightStart) : '—'} />
          <Stat label="Peso final" value={m.weightEnd != null ? fmtWeight(m.weightEnd) : '—'} sub={m.weightStart != null && m.weightEnd != null ? fmtSigned(m.weightEnd - m.weightStart) : m.weightEntries < 2 ? 'Faltan registros' : undefined} />
          <Stat label="Peso medio" value={m.weightAvg != null ? fmtWeight(m.weightAvg) : '—'} sub={`${m.weightEntries} registros`} />
        </div>
      </div>
      {muscles.length > 0 && (
        <Section title="Grupos musculares trabajados">
          <div className="panel">
            <HBars items={muscles.map(([k, v]) => ({ key: k, label: MUSCLES[k], value: v }))} format={(v) => `${v} series`} />
          </div>
        </Section>
      )}
      {m.prs.length > 0 && (
        <Section title="Récords personales">
          <List>
            {m.prs.map((p, i) => (
              <Row key={i} title={p.exercise} subtitle={p.label} />
            ))}
          </List>
        </Section>
      )}
    </>
  );
}

export function ReviewFlow({ id }: { id: string | null }) {
  const { settings } = useSettings();
  const toast = useToast();
  const { query } = useRoute();
  const [r, setR] = useState<WeeklyReview | null>(null);
  const [step, setStep] = useState(0);
  const [weights, setWeights] = useState<{ date: string; weight: number }[]>([]);
  const [applyGoal, setApplyGoal] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    (async () => {
      const [workouts, bodyweights, measurements, plan, weekGoals, reviews] = await Promise.all([listWorkouts(), listBodyWeights(), listMeasurements(), listPlan(), listWeekGoals(), listReviews()]);
      setWeights(dailyWeights(bodyweights));
      if (id) {
        const ex = await getReview(id);
        if (!ex) return setNotFound(true);
        setR(ex);
        return;
      }
      const qw = query.get('week');
      const ws = qw && isDateKey(qw) ? qw : reviewTargetWeek(today(), settings.reviewDay).weekStart;
      const existing = reviews.find((x) => x.weekStart === ws);
      if (existing) {
        setR(existing);
        return;
      }
      const metrics = computeReviewMetrics(ws, { workouts, bodyweights, measurements, plan, settings, weekGoals });
      const answers = emptyAnswers();
      const now = Date.now();
      setR({
        id: uid(),
        weekStart: ws,
        weekEnd: addDays(ws, 6),
        status: 'draft',
        metrics,
        answers,
        conclusions: buildConclusions(metrics, answers, (kg) => fmtWeight(kg)),
        nextGoalSessions: proposeNextGoal(metrics, answers),
        nextGoalText: '',
        createdAt: now,
        updatedAt: now,
      });
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (notFound)
    return (
      <Page title="Revisión" back="/reviews" backLabel="Revisiones">
        <p className="muted">Revisión no encontrada.</p>
      </Page>
    );
  if (!r) return <Loading />;
  const m = r.metrics;

  const persistDraft = async (next: WeeklyReview) => {
    if (next.status === 'completed') return next;
    const saved = await saveReview(next);
    return saved;
  };
  const go = async (n: number) => {
    let next = r;
    if (n === 3 && step === 2) {
      next = { ...r, conclusions: buildConclusions(r.metrics, r.answers, (kg) => fmtWeight(kg)), nextGoalSessions: r.nextGoalSessions ?? proposeNextGoal(r.metrics, r.answers) };
    }
    next = await persistDraft(next);
    setR(next);
    setStep(n);
    window.scrollTo({ top: 0 });
  };
  const finish = async () => {
    const saved = await saveReview({ ...r, status: 'completed' });
    if (applyGoal && r.nextGoalSessions != null) await setWeekGoal(addDays(r.weekStart, 7), r.nextGoalSessions);
    await setMeta('reviewSnoozedUntil', null);
    toast('Revisión guardada');
    navigate(`/reviews/${saved.id}`, { replace: true });
  };
  const setA = (p: Partial<WeeklyReview['answers']>) => setR({ ...r, answers: { ...r.answers, ...p } });

  const chartFrom = addDays(r.weekStart, -49);
  const chart = weights.filter((d) => d.date >= chartFrom && d.date <= r.weekEnd);

  return (
    <Page title="Revisión semanal" back="/reviews" backLabel="Revisiones" subtitle={`Semana ${fmtRange(r.weekStart, r.weekEnd)} · Paso ${step + 1} de 5: ${STEPS[step]}`}>
      <div className="steps" aria-hidden="true">
        {STEPS.map((s, i) => (
          <span key={s} className={i <= step ? 'on' : ''} />
        ))}
      </div>

      {step === 0 && <ReviewMetricsView m={m} />}

      {step === 1 && (
        <>
          <Section title="Peso corporal (últimas 8 semanas)">
            <div className="panel">
              {chart.length >= 2 ? (
                <LineChart points={chart.map((d) => ({ x: d.date, y: toDisplayWeight(d.weight) }))} formatY={(v) => num(v, 1)} formatX={fmtDateShort} label="Peso de las últimas semanas" />
              ) : (
                <p className="small muted">No hay suficientes registros de peso para mostrar una gráfica.</p>
              )}
              <List className="mt">
                <Row title="Media esta semana" value={m.weightAvg != null ? fmtWeight(m.weightAvg) : 'Sin registros'} />
                <Row title="Media semana anterior" value={m.prevWeightAvg != null ? fmtWeight(m.prevWeightAvg) : 'Sin registros'} />
                <Row title="Diferencia" value={m.weightAvg != null && m.prevWeightAvg != null ? fmtSigned(m.weightAvg - m.prevWeightAvg) : '—'} />
                <Row title="Desde el inicio del seguimiento" value={m.weightAvg != null && m.firstWeight != null ? fmtSigned(m.weightAvg - m.firstWeight) : '—'} />
              </List>
            </div>
          </Section>
          <Section title="Medidas de la semana">
            {m.measurements.length ? (
              <List>
                {m.measurements.map((x) => (
                  <Row key={x.type} title={MEASUREMENTS[x.type]} value={`${x.last} ${x.unit}${x.first != null ? ` (${x.last! - x.first >= 0 ? '+' : ''}${num(x.last! - x.first, 1)})` : ''}`} />
                ))}
              </List>
            ) : (
              <p className="small muted">No registraste medidas esta semana.</p>
            )}
          </Section>
          {(m.weightEntries === 0 || !m.measurements.length) && (
            <div className="callout callout-neutral mt">
              <Info size={18} />
              <span>
                Faltan datos: {[m.weightEntries === 0 && 'registros de peso', !m.measurements.length && 'medidas corporales'].filter(Boolean).join(' y ')}. Puedes revisar igualmente; la revisión sólo usa lo que existe.
              </span>
            </div>
          )}
        </>
      )}

      {step === 2 && (
        <>
          <p className="small muted">Todas las respuestas son opcionales.</p>
          <div className="list mt">
            <Scale label="¿Cómo ha ido tu semana?" value={r.answers.week} onChange={(v) => setA({ week: v })} low="Mal" high="Muy bien" />
            <Scale label="¿Cómo ha sido tu energía?" value={r.answers.energy} onChange={(v) => setA({ energy: v })} low="Baja" high="Alta" />
            <Scale label="¿Cómo ha sido tu recuperación?" value={r.answers.recovery} onChange={(v) => setA({ recovery: v })} low="Mala" high="Excelente" />
            <Scale label="¿Cómo has dormido?" value={r.answers.sleep} onChange={(v) => setA({ sleep: v })} low="Mal" high="Muy bien" />
          </div>
          <div className="mt-lg">
            <Field label="¿Has tenido molestias o dificultades?">
              <TextArea value={r.answers.discomfort} onChange={(e) => setA({ discomfort: e.target.value })} maxLength={1000} rows={2} />
            </Field>
            <Field label="¿Qué ha funcionado mejor?">
              <TextArea value={r.answers.bestThing} onChange={(e) => setA({ bestThing: e.target.value })} maxLength={1000} rows={2} />
            </Field>
            <Field label="¿Qué quieres mejorar?">
              <TextArea value={r.answers.improve} onChange={(e) => setA({ improve: e.target.value })} maxLength={1000} rows={2} />
            </Field>
          </div>
        </>
      )}

      {step === 3 && (
        <>
          <ConclusionsView c={r.conclusions} />
          <Section title="Objetivo para la semana siguiente">
            <div className="panel">
              <Field label="Sesiones" hint="Propuesta basada en tu objetivo actual y tu recuperación. Puedes cambiarla.">
                <NumberInput value={r.nextGoalSessions} onChange={(v) => setR({ ...r, nextGoalSessions: v })} decimals={false} max={21} />
              </Field>
              <Field label="Objetivo personal (opcional)">
                <Input value={r.nextGoalText} onChange={(e) => setR({ ...r, nextGoalText: e.target.value })} maxLength={300} placeholder="Ej.: registrar el peso 3 días" />
              </Field>
            </div>
            <p className="tiny muted mt">DRAXIVO no cambia tus rutinas automáticamente. Las conclusiones se basan sólo en tus datos y no sustituyen el consejo de un profesional.</p>
          </Section>
        </>
      )}

      {step === 4 && (
        <>
          <Section title="Resumen">
            <List>
              <Row title="Periodo" value={fmtRange(r.weekStart, r.weekEnd)} />
              <Row title="Cumplimiento" value={r.conclusions.compliance} />
              <Row title="Objetivo siguiente" value={r.nextGoalSessions != null ? `${r.nextGoalSessions} sesiones` : '—'} />
              {r.nextGoalText && <Row title="Objetivo personal" value={r.nextGoalText} />}
            </List>
          </Section>
          <Section>
            <List>
              <Toggle checked={applyGoal} onChange={setApplyGoal} label="Usar como objetivo de la próxima semana" description={`Semana del ${fmtRange(addDays(r.weekStart, 7), addDays(r.weekStart, 13))}`} />
            </List>
          </Section>
          <p className="small muted mt">Se guardará una instantánea de las métricas: si después editas entrenamientos, esta revisión no cambiará.</p>
        </>
      )}

      <div className="btn-row mt-lg">
        {step > 0 ? <Button onClick={() => go(step - 1)}>Anterior</Button> : <Button onClick={() => goBack('/')}>Más tarde</Button>}
        {step < 4 ? (
          <Button variant="primary" onClick={() => go(step + 1)}>
            Siguiente
          </Button>
        ) : (
          <Button variant="primary" onClick={finish}>
            Guardar revisión
          </Button>
        )}
      </div>
    </Page>
  );
}

export function ConclusionsView({ c }: { c: WeeklyReview['conclusions'] }) {
  return (
    <>
      <Section title="Logros">
        <div className="panel">{c.achievements.length ? <ul className="bullets">{c.achievements.map((x) => <li key={x}>{x}</li>)}</ul> : <p className="small muted">Sin logros registrados esta semana. Cada semana cuenta como punto de partida.</p>}</div>
      </Section>
      <Section title="Evolución observada">
        <div className="panel">
          <ul className="bullets">
            {c.evolution.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
        </div>
      </Section>
      <Section title="Aspectos que requieren atención">
        <div className="panel">{c.attention.length ? <ul className="bullets">{c.attention.map((x) => <li key={x}>{x}</li>)}</ul> : <p className="small muted">Nada destacable.</p>}</div>
      </Section>
      <Section title="Cumplimiento del objetivo">
        <div className="panel">{c.compliance}</div>
      </Section>
    </>
  );
}
