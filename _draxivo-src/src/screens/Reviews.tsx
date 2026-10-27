import { useState } from 'react';
import { Check, ClipboardCheck, Ellipsis } from 'lucide-react';
import type { WeeklyReview } from '../db/types';
import { useQuery } from '../app/hooks';
import { goBack, navigate } from '../app/router';
import { useSettings, useToast } from '../app/context';
import { deleteReview, getReview, listBodyWeights, listMeasurements, listPlan, listReviews, listWeekGoals, listWorkouts, saveReview } from '../db/repo';
import { buildConclusions, computeReviewMetrics, pendingReviewWeek, reviewTargetWeek } from '../domain/review';
import { dateKey, fmtDate, fmtMinutes, fmtRange, today } from '../lib/dates';
import { fmtVolume, fmtWeight } from '../lib/units';
import { ActionMenu, Button, Empty, IconButton, List, Loading, Page, Row, Section, Tag, cx, useConfirm } from '../ui/kit';
import { ConclusionsView, ReviewMetricsView } from './ReviewFlow';

export function Reviews() {
  const { settings } = useSettings();
  const reviews = useQuery(listReviews, ['reviews']);
  if (!reviews) return <Loading />;
  const pending = pendingReviewWeek(today(), settings, reviews, undefined);
  const target = reviewTargetWeek(today(), settings.reviewDay).weekStart;
  return (
    <Page title="Revisiones" back="/progress" backLabel="Progreso" subtitle={settings.reviewEnabled ? `Semanas de lunes a domingo` : 'Avisos de revisión desactivados en Perfil'}>
      <div className="btn-row">
        <Button variant="primary" onClick={() => navigate(`/reviews/new?week=${pending ?? target}`)}>
          {pending ? 'Revisar semana pendiente' : 'Revisar semana'}
        </Button>
        {reviews.length >= 2 && <Button onClick={() => navigate('/reviews/compare')}>Comparar</Button>}
      </div>
      <Section title={`Historial · ${reviews.length}`}>
        {reviews.length ? (
          <List>
            {reviews.map((r) => (
              <Row
                key={r.id}
                icon={<ClipboardCheck size={20} />}
                title={fmtRange(r.weekStart, r.weekEnd)}
                subtitle={`${r.metrics.completedSessions}/${r.metrics.goalSessions} sesiones · ${fmtMinutes(r.metrics.totalMinutes)}${r.metrics.weightAvg != null ? ` · ${fmtWeight(r.metrics.weightAvg)}` : ''}`}
                value={r.status === 'draft' ? <Tag tone="warn">Borrador</Tag> : undefined}
                onClick={() => navigate(r.status === 'draft' ? `/reviews/${r.id}/edit` : `/reviews/${r.id}`)}
              />
            ))}
          </List>
        ) : (
          <Empty icon={<ClipboardCheck size={24} />} title="Sin revisiones" text="Cada semana puedes repasar tus datos, valorar cómo te has sentido y fijar un objetivo para la siguiente." />
        )}
      </Section>
    </Page>
  );
}

export function ReviewDetail({ id }: { id: string }) {
  const { settings } = useSettings();
  const r = useQuery(() => getReview(id), ['reviews'], [id]);
  const toast = useToast();
  const confirm = useConfirm();
  const [menu, setMenu] = useState(false);
  if (r === undefined) return <Loading />;
  if (!r)
    return (
      <Page title="Revisión" back="/reviews" backLabel="Revisiones">
        <Empty title="Revisión no encontrada" />
      </Page>
    );
  const a = r.answers;
  const scale = (v: number | null) => (v == null ? '—' : `${v}/5`);
  const recompute = async () => {
    if (!(await confirm({ title: '¿Recalcular métricas?', message: 'Se sustituirá la instantánea guardada por los datos actuales de esta semana. Tus respuestas se conservan.', confirmLabel: 'Recalcular' }))) return;
    const [workouts, bodyweights, measurements, plan, weekGoals] = await Promise.all([listWorkouts(), listBodyWeights(), listMeasurements(), listPlan(), listWeekGoals()]);
    const metrics = computeReviewMetrics(r.weekStart, { workouts, bodyweights, measurements, plan, settings, weekGoals });
    await saveReview({ ...r, metrics, conclusions: buildConclusions(metrics, r.answers, (kg) => fmtWeight(kg)) });
    toast('Métricas actualizadas');
  };
  return (
    <Page
      title={`Semana ${fmtRange(r.weekStart, r.weekEnd)}`}
      large={false}
      back="/reviews"
      backLabel="Revisiones"
      subtitle={`Guardada el ${fmtDate(dateKey(r.updatedAt), true)}`}
      actions={
        <IconButton label="Opciones" onClick={() => setMenu(true)}>
          <Ellipsis size={22} />
        </IconButton>
      }
    >
      <ReviewMetricsView m={r.metrics} />
      <Section title="Valoración personal">
        <List>
          <Row title="Semana" value={scale(a.week)} />
          <Row title="Energía" value={scale(a.energy)} />
          <Row title="Recuperación" value={scale(a.recovery)} />
          <Row title="Sueño" value={scale(a.sleep)} />
          {a.discomfort && <Row title="Molestias" subtitle={a.discomfort} />}
          {a.bestThing && <Row title="Lo que mejor funcionó" subtitle={a.bestThing} />}
          {a.improve && <Row title="A mejorar" subtitle={a.improve} />}
        </List>
      </Section>
      <ConclusionsView c={r.conclusions} />
      <Section title="Objetivo para la semana siguiente">
        <div className="panel">
          {r.nextGoalSessions != null ? `${r.nextGoalSessions} sesiones` : 'Sin objetivo'}
          {r.nextGoalText && <div className="muted mt">{r.nextGoalText}</div>}
        </div>
      </Section>
      <ActionMenu
        open={menu}
        onClose={() => setMenu(false)}
        title="Revisión"
        actions={[
          { label: 'Editar respuestas y objetivos', onSelect: () => navigate(`/reviews/${r.id}/edit`) },
          { label: 'Recalcular métricas con los datos actuales', onSelect: recompute },
          {
            label: 'Eliminar revisión',
            destructive: true,
            onSelect: async () => {
              if (await confirm({ title: '¿Eliminar esta revisión?', confirmLabel: 'Eliminar', destructive: true })) {
                await deleteReview(r.id);
                toast('Revisión eliminada');
                goBack('/reviews');
              }
            },
          },
        ]}
      />
    </Page>
  );
}

export function ReviewCompare() {
  const reviews = useQuery(listReviews, ['reviews']);
  const [sel, setSel] = useState<string[] | null>(null);
  if (!reviews) return <Loading />;
  const completed = reviews.filter((r) => r.status === 'completed');
  const chosen = sel ?? completed.slice(0, 4).map((r) => r.id);
  const cols = completed.filter((r) => chosen.includes(r.id)).sort((a, b) => a.weekStart.localeCompare(b.weekStart));
  const rows: [string, (r: WeeklyReview) => string][] = [
    ['Sesiones', (r) => `${r.metrics.completedSessions}/${r.metrics.goalSessions}`],
    ['Tiempo', (r) => fmtMinutes(r.metrics.totalMinutes)],
    ['Series', (r) => String(r.metrics.sets)],
    ['Volumen', (r) => (r.metrics.volumeKg ? fmtVolume(r.metrics.volumeKg) : '—')],
    ['Récords', (r) => String(r.metrics.prs.length)],
    ['Peso medio', (r) => (r.metrics.weightAvg != null ? fmtWeight(r.metrics.weightAvg) : '—')],
    ['Semana', (r) => (r.answers.week != null ? `${r.answers.week}/5` : '—')],
    ['Energía', (r) => (r.answers.energy != null ? `${r.answers.energy}/5` : '—')],
    ['Recuperación', (r) => (r.answers.recovery != null ? `${r.answers.recovery}/5` : '—')],
    ['Sueño', (r) => (r.answers.sleep != null ? `${r.answers.sleep}/5` : '—')],
    ['Objetivo sig.', (r) => (r.nextGoalSessions != null ? String(r.nextGoalSessions) : '—')],
  ];
  return (
    <Page title="Comparar revisiones" back="/reviews" backLabel="Revisiones">
      <Section title="Semanas seleccionadas">
        <List>
          {completed.map((r) => {
            const on = chosen.includes(r.id);
            return (
              <button key={r.id} className="row row-button" aria-pressed={on} onClick={() => setSel(on ? chosen.filter((x) => x !== r.id) : [...chosen, r.id])}>
                <span className="row-main">
                  <span className="row-title">{fmtRange(r.weekStart, r.weekEnd)}</span>
                </span>
                <span className={cx('check-btn', on && 'on')}>{on && <Check size={18} />}</span>
              </button>
            );
          })}
        </List>
      </Section>
      {cols.length >= 1 && (
        <Section title="Comparación">
          <div className="panel table-scroll">
            <table className="compare-table">
              <thead>
                <tr>
                  <th>Métrica</th>
                  {cols.map((r) => (
                    <th key={r.id}>{fmtDate(r.weekStart)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map(([label, f]) => (
                  <tr key={label}>
                    <td>{label}</td>
                    {cols.map((r) => (
                      <td key={r.id}>{f(r)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}
    </Page>
  );
}
