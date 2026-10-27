// Revisión semanal: cálculo de métricas (instantánea) y conclusiones basadas sólo en datos reales.
import type {
  BodyWeight,
  Measurement,
  MeasurementType,
  PlanEntry,
  ReviewAnswers,
  ReviewConclusions,
  ReviewMetrics,
  Settings,
  WeekGoal,
  WeeklyReview,
  Workout,
} from '../db/types';
import { addDays, dateKey, weekStart } from '../lib/dates';
import { PR_LABELS, periodStats, prsInWorkout } from './metrics';
import { averageIn, dailyWeights, round2 } from './weight';
import { MEASUREMENTS, MUSCLES } from '../lib/labels';

export function goalForWeek(ws: string, settings: Settings, goals: WeekGoal[]): number {
  return goals.find((g) => g.weekStart === ws)?.sessions ?? settings.weeklyGoal;
}

/**
 * Semana que corresponde revisar hoy. Si el día de revisión es viernes, sábado o domingo,
 * se revisa la semana en curso a partir de ese día; si es de lunes a jueves, la semana anterior.
 */
export function reviewTargetWeek(todayKey: string, reviewDay: number): { weekStart: string; availableFrom: string } {
  const ws = weekStart(todayKey);
  const thisWeeksReviewDate = addDays(ws, reviewDay);
  const lastReviewDate = todayKey >= thisWeeksReviewDate ? thisWeeksReviewDate : addDays(thisWeeksReviewDate, -7);
  const reviewedWeek = reviewDay >= 4 ? weekStart(lastReviewDate) : addDays(weekStart(lastReviewDate), -7);
  return { weekStart: reviewedWeek, availableFrom: lastReviewDate };
}

export function pendingReviewWeek(
  todayKey: string,
  settings: Settings,
  reviews: { weekStart: string; status: string }[],
  snoozedUntil: string | undefined,
): string | null {
  if (!settings.reviewEnabled) return null;
  const { weekStart: ws } = reviewTargetWeek(todayKey, settings.reviewDay);
  // No se pide revisar semanas anteriores al inicio del uso de la aplicación.
  const startedKey = dateKey(settings.createdAt);
  if (addDays(ws, 6) < startedKey) return null;
  if (reviews.some((r) => r.weekStart === ws && r.status === 'completed')) return null;
  if (snoozedUntil && snoozedUntil > todayKey) return null;
  return ws;
}

export interface ReviewInputs {
  workouts: Workout[];
  bodyweights: BodyWeight[];
  measurements: Measurement[];
  plan: PlanEntry[];
  settings: Settings;
  weekGoals: WeekGoal[];
}

export function computeReviewMetrics(ws: string, d: ReviewInputs): ReviewMetrics {
  const we = addDays(ws, 6);
  const prevWs = addDays(ws, -7);
  const prevWe = addDays(ws, -1);
  const completed = d.workouts.filter((w) => w.status === 'completed');
  const st = periodStats(completed, ws, we);
  const prev = periodStats(completed, prevWs, prevWe);
  const planned = d.plan.filter((p) => p.kind === 'routine' && p.date >= ws && p.date <= we).length;

  const prs: ReviewMetrics['prs'] = [];
  for (const w of completed.filter((w) => w.date >= ws && w.date <= we)) {
    for (const pr of prsInWorkout(w, completed)) {
      prs.push({ exercise: pr.exerciseName, label: PR_LABELS[pr.kind], value: String(pr.value) });
    }
  }

  const days = dailyWeights(d.bodyweights);
  const inWeek = days.filter((x) => x.date >= ws && x.date <= we);
  const measurements: ReviewMetrics['measurements'] = [];
  const types = Object.keys(MEASUREMENTS) as MeasurementType[];
  for (const t of types) {
    const list = d.measurements.filter((m) => m.type === t).sort((a, b) => a.date.localeCompare(b.date));
    const inRange = list.filter((m) => m.date >= ws && m.date <= we);
    if (!inRange.length) continue;
    const before = list.filter((m) => m.date < ws);
    measurements.push({
      type: t,
      first: before.length ? before[before.length - 1].value : null,
      last: inRange[inRange.length - 1].value,
      unit: t === 'grasa' ? '%' : 'cm',
    });
  }

  return {
    weekStart: ws,
    weekEnd: we,
    plannedSessions: planned || null,
    goalSessions: goalForWeek(ws, d.settings, d.weekGoals),
    completedSessions: st.workouts,
    totalMinutes: Math.round(st.minutes),
    sets: st.sets,
    reps: st.reps,
    volumeKg: st.volume,
    muscleSets: st.muscleSets,
    prs,
    weightStart: inWeek[0]?.weight ?? null,
    weightEnd: inWeek.length > 1 ? inWeek[inWeek.length - 1].weight : null,
    weightEntries: inWeek.reduce((s, x) => s + x.count, 0),
    weightAvg: averageIn(days, ws, we),
    prevWeightAvg: averageIn(days, prevWs, prevWe),
    firstWeight: days[0]?.weight ?? null,
    measurements,
    prevCompletedSessions: prev.workouts,
    prevVolumeKg: prev.volume,
  };
}

export function emptyAnswers(): ReviewAnswers {
  return { week: null, energy: null, recovery: null, sleep: null, discomfort: '', bestThing: '', improve: '' };
}

type Fmt = (kg: number) => string;

export function buildConclusions(m: ReviewMetrics, a: ReviewAnswers, fmtWeight: Fmt): ReviewConclusions {
  const achievements: string[] = [];
  const evolution: string[] = [];
  const attention: string[] = [];

  if (m.completedSessions > 0) {
    achievements.push(`Completaste ${m.completedSessions} ${m.completedSessions === 1 ? 'entrenamiento' : 'entrenamientos'} (${m.totalMinutes} min, ${m.sets} series efectivas).`);
  }
  if (m.prs.length) {
    const names = [...new Set(m.prs.map((p) => p.exercise))];
    achievements.push(`Récords personales en ${names.slice(0, 3).join(', ')}${names.length > 3 ? ` y ${names.length - 3} más` : ''}.`);
  }
  if (m.completedSessions >= m.goalSessions && m.goalSessions > 0) achievements.push('Alcanzaste tu objetivo semanal de sesiones.');
  if (m.prevCompletedSessions > 0 && m.volumeKg > 0 && m.prevVolumeKg > 0) {
    const pct = Math.round(((m.volumeKg - m.prevVolumeKg) / m.prevVolumeKg) * 100);
    evolution.push(`Volumen total ${pct >= 0 ? '+' : ''}${pct} % respecto a la semana anterior.`);
  }

  if (m.weightAvg != null && m.prevWeightAvg != null) {
    const delta = round2(m.weightAvg - m.prevWeightAvg);
    evolution.push(
      `Peso medio ${fmtWeight(m.weightAvg)} frente a ${fmtWeight(m.prevWeightAvg)} la semana anterior (${delta >= 0 ? '+' : '−'}${fmtWeight(Math.abs(delta))}). El peso varía por hidratación, digestión y otros factores; una sola semana no indica cambios de grasa o músculo.`,
    );
  } else if (m.weightAvg != null) {
    evolution.push(`Peso medio de la semana: ${fmtWeight(m.weightAvg)}. Faltan registros de la semana anterior para comparar.`);
  } else {
    evolution.push('No hay registros de peso esta semana.');
  }
  for (const x of m.measurements) {
    if (x.first != null && x.last != null) {
      const d = round2(x.last - x.first);
      evolution.push(`${MEASUREMENTS[x.type]}: ${x.last} ${x.unit} (${d >= 0 ? '+' : ''}${d} ${x.unit} desde la medición anterior).`);
    }
  }

  const muscles = Object.entries(m.muscleSets).sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0));
  if (muscles.length) evolution.push(`Grupos más trabajados: ${muscles.slice(0, 3).map(([k, v]) => `${MUSCLES[k as keyof typeof MUSCLES]} (${v})`).join(', ')}.`);

  if (m.completedSessions < m.goalSessions) attention.push(`Completaste ${m.completedSessions} de ${m.goalSessions} sesiones previstas en tu objetivo.`);
  if (m.plannedSessions != null && m.completedSessions < m.plannedSessions) attention.push(`Había ${m.plannedSessions} sesiones planificadas en el calendario.`);
  if (a.recovery != null && a.recovery <= 2) attention.push('Has valorado tu recuperación como baja.');
  if (a.sleep != null && a.sleep <= 2) attention.push('Has valorado tu descanso nocturno como bajo.');
  if (a.energy != null && a.energy <= 2) attention.push('Has valorado tu energía como baja.');
  if (a.discomfort.trim()) attention.push(`Molestias indicadas: «${a.discomfort.trim()}». Si persisten, consulta con un profesional sanitario.`);
  if (m.weightEntries === 0) attention.push('Registra tu peso algún día de la próxima semana si quieres seguir su evolución.');

  const pct = m.goalSessions > 0 ? Math.round((m.completedSessions / m.goalSessions) * 100) : 0;
  const compliance = m.goalSessions > 0 ? `${m.completedSessions}/${m.goalSessions} sesiones (${Math.min(pct, 999)} %).` : `${m.completedSessions} sesiones. Sin objetivo definido.`;
  return { achievements, evolution, attention, compliance };
}

/** Objetivo de sesiones propuesto para la semana siguiente, sin imponer frecuencias. */
export function proposeNextGoal(m: ReviewMetrics, a: ReviewAnswers): number {
  const lowRecovery = (a.recovery != null && a.recovery <= 2) || (a.sleep != null && a.sleep <= 2);
  if (lowRecovery) return Math.max(1, Math.min(m.goalSessions, m.completedSessions || m.goalSessions));
  return Math.max(1, m.goalSessions);
}

export function isReviewForCurrentWeek(r: WeeklyReview, todayKey: string) {
  return r.weekStart === weekStart(todayKey);
}
