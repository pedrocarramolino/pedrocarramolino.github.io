import { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Camera, ChartColumn, ChevronRight, ClipboardCheck, Dumbbell, History as HistoryIcon, Layers, Plus, Ruler, Trophy } from 'lucide-react';
import type { MuscleGroup } from '../db/types';
import { useQuery } from '../app/hooks';
import { navigate } from '../app/router';
import { useSettings } from '../app/context';
import { listBodyWeights, listWeekGoals } from '../db/repo';
import { PR_LABELS, consistency, exerciseHistory, monthlyBuckets, periodStats, prsInWorkout, weeklyBuckets } from '../domain/metrics';
import { goalForWeek } from '../domain/review';
import { averageIn, dailyWeights } from '../domain/weight';
import { addDays, diffDays, fmtDate, fmtDateShort, fmtMinutes, fmtMonth, today } from '../lib/dates';
import { MUSCLES, supportsLoadMetrics } from '../lib/labels';
import { fmtSigned, fmtVolume, fmtWeight, fmtWeightNum, num, toDisplayWeight, wUnit } from '../lib/units';
import { BarChart, HBars, LineChart } from '../ui/charts';
import { Card, DateInput, Field, IconButton, List, Loading, Page, Row, Section, Segmented, Select, Sheet, Stat } from '../ui/kit';
import { WeightSheet, useExerciseMap, useWorkouts } from './shared';
import { fmtPR } from './WorkoutSummary';

export type PeriodKey = '7' | '30' | '90' | '365' | 'all' | 'custom';
export const PERIODS: { value: PeriodKey; label: string }[] = [
  { value: '7', label: 'Semana' },
  { value: '30', label: 'Mes' },
  { value: '365', label: 'Año' },
  { value: 'all', label: 'Todo' },
  { value: 'custom', label: 'Rango' },
];

export function periodRange(p: PeriodKey, earliest: string | null, custom: { from: string; to: string }): { from: string; to: string } {
  const t = today();
  if (p === 'custom') return { from: custom.from || earliest || t, to: custom.to || t };
  if (p === 'all') return { from: earliest ?? addDays(t, -29), to: t };
  return { from: addDays(t, -(Number(p) - 1)), to: t };
}

export function PeriodPicker({ value, onChange, custom, setCustom }: { value: PeriodKey; onChange: (p: PeriodKey) => void; custom: { from: string; to: string }; setCustom: (c: { from: string; to: string }) => void }) {
  return (
    <>
      <Segmented label="Periodo" value={value} onChange={onChange} options={PERIODS} />
      {value === 'custom' && (
        <div className="form-grid mt">
          <Field label="Desde">
            <DateInput value={custom.from} max={custom.to || today()} onChange={(v) => setCustom({ ...custom, from: v })} label="Desde" />
          </Field>
          <Field label="Hasta">
            <DateInput value={custom.to} min={custom.from} max={today()} onChange={(v) => setCustom({ ...custom, to: v })} label="Hasta" />
          </Field>
        </div>
      )}
    </>
  );
}

export function Progress() {
  const { settings } = useSettings();
  const workouts = useWorkouts();
  const weights = useQuery(listBodyWeights, ['bodyweights']);
  const goals = useQuery(listWeekGoals, ['weekgoals']);
  const exMap = useExerciseMap();
  const [period, setPeriod] = useState<PeriodKey>('30');
  const [custom, setCustom] = useState({ from: addDays(today(), -59), to: today() });
  const [strengthEx, setStrengthEx] = useState('');
  const [prsOpen, setPrsOpen] = useState(false);
  const [weightOpen, setWeightOpen] = useState(false);

  const data = useMemo(() => {
    if (!workouts || !goals) return null;
    const earliest = workouts.length ? workouts[workouts.length - 1].date : null;
    const { from, to } = periodRange(period, earliest, custom);
    const st = periodStats(workouts, from, to);
    const span = diffDays(to, from) + 1;
    const weeks = weeklyBuckets(workouts, from, to);
    const monthly = span > 182;
    const months = monthly ? monthlyBuckets(workouts, from, to) : [];
    const cons = consistency(weeks, (ws) => goalForWeek(ws, settings, goals), today());
    const muscles = (Object.entries(st.muscleSets) as [MuscleGroup, number][]).sort((a, b) => b[1] - a[1]);
    const prs = workouts.filter((w) => w.date >= from && w.date <= to).flatMap((w) => prsInWorkout(w, workouts));
    // Ejercicios con carga ordenados por número de sesiones, para la evolución de fuerza.
    const counts = new Map<string, number>();
    for (const w of workouts) for (const e of w.exercises) if (supportsLoadMetrics(e.tracking)) counts.set(e.exerciseId, (counts.get(e.exerciseId) ?? 0) + 1);
    const strengthOptions = [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => id);
    return { from, to, st, span, weeks, months, monthly, cons, muscles, prs, strengthOptions };
  }, [workouts, goals, period, custom, settings]);

  if (!data || !weights || !workouts) return <Loading />;
  const { st, span, weeks, months, monthly, cons, muscles, from, to, prs, strengthOptions } = data;
  const perWeek = st.workouts / Math.max(1, span / 7);
  const days = dailyWeights(weights);
  const inRange = days.filter((d) => d.date >= from && d.date <= to);
  const latest = days[days.length - 1];
  const firstIn = inRange[0];
  const lastIn = inRange[inRange.length - 1];
  const delta = firstIn && lastIn && firstIn !== lastIn ? lastIn.weight - firstIn.weight : null;
  const avgPrev = averageIn(days, addDays(from, -span), addDays(from, -1));
  const sid = strengthOptions.includes(strengthEx) ? strengthEx : strengthOptions[0];
  const strength = sid ? exerciseHistory(workouts, sid).filter((p) => p.e1rm != null) : [];
  const strengthPts = strength
    .reduce<{ x: string; y: number }[]>((acc, p) => {
      const last = acc[acc.length - 1];
      if (last && last.x === p.date) last.y = Math.max(last.y, p.e1rm!);
      else acc.push({ x: p.date, y: p.e1rm! });
      return acc;
    }, [])
    .map((p) => ({ x: p.x, y: toDisplayWeight(p.y) }));
  const periodLabel = PERIODS.find((p) => p.value === period)!.label.toLowerCase();

  return (
    <Page
      title="Progreso"
      actions={
        <IconButton label="Registrar peso" className="icon-btn-solid" onClick={() => setWeightOpen(true)}>
          <Plus size={22} />
        </IconButton>
      }
    >
      <PeriodPicker value={period} onChange={setPeriod} custom={custom} setCustom={setCustom} />

      <div className="stack mt">
        <Card onClick={() => navigate('/body/weight')} ariaLabel="Ver peso corporal">
          <div className="split">
            <span className="card-kicker">Peso corporal</span>
            <ChevronRight size={18} className="row-chevron" />
          </div>
          {latest ? (
            <>
              <div style={{ marginTop: 4 }}>
                <span className="hero-number">{fmtWeightNum(latest.weight)}</span>
                <span className="hero-unit">{wUnit()}</span>
              </div>
              <div className="delta" style={{ marginTop: 6 }}>
                {delta != null ? (
                  <>
                    {delta < 0 ? <ArrowDown size={16} /> : <ArrowUp size={16} />}
                    {fmtSigned(delta)} ({delta >= 0 ? '+' : '−'}
                    {num(Math.abs((delta / firstIn!.weight) * 100), 1)} %) en {period === 'custom' ? 'el rango' : period === 'all' ? 'total' : `este periodo`}
                  </>
                ) : (
                  <span>Sin variación medible en el periodo</span>
                )}
              </div>
              {inRange.length >= 2 ? (
                <div className="mt">
                  <LineChart points={inRange.map((d) => ({ x: d.date, y: toDisplayWeight(d.weight) }))} formatY={(v) => num(v, 0)} formatX={fmtDateShort} label="Peso corporal en el periodo" height={150} />
                </div>
              ) : (
                <p className="small muted mt">Pocos registros en este periodo para dibujar la gráfica.</p>
              )}
              {avgPrev != null && averageIn(days, from, to) != null && (
                <p className="tiny muted mt">
                  Media {fmtWeight(averageIn(days, from, to))} · periodo anterior {fmtWeight(avgPrev)}
                </p>
              )}
            </>
          ) : (
            <p className="small muted mt">Aún no hay registros. Usa el botón + para añadir tu peso.</p>
          )}
        </Card>

        <List>
          <Row icon={<ChartColumn size={20} />} title="Entrenamientos" value={<strong className="tabular" style={{ color: 'var(--text)' }}>{st.workouts}</strong>} onClick={() => navigate('/history')} />
          <Row icon={<Layers size={20} />} title="Volumen total" value={<strong className="tabular" style={{ color: 'var(--text)' }}>{st.volume ? fmtVolume(st.volume) : '—'}</strong>} />
          <Row icon={<Trophy size={20} />} title="Récords personales" value={<strong className="tabular" style={{ color: 'var(--text)' }}>{prs.length}</strong>} onClick={() => setPrsOpen(true)} />
          <Row icon={<Ruler size={20} />} title="Medidas corporales" onClick={() => navigate('/body/measurements')} />
        </List>

        <Card>
          <div className="split">
            <div style={{ minWidth: 0 }}>
              <div className="card-title" style={{ fontSize: 16 }}>
                Evolución de fuerza
              </div>
              <div className="card-sub">{sid ? `${exMap.get(sid)?.name ?? 'Ejercicio'} · 1RM estimado` : 'Registra series con carga para verla'}</div>
            </div>
            {strengthPts.length > 0 && (
              <strong className="tabular" style={{ fontSize: 17 }}>
                {num(strengthPts[strengthPts.length - 1].y, 0)} {wUnit()}
              </strong>
            )}
          </div>
          {strengthOptions.length > 1 && (
            <div className="mt">
              <Select value={sid} onChange={setStrengthEx} aria-label="Ejercicio" title="Evolución de fuerza">
                {strengthOptions.map((id) => (
                  <option key={id} value={id}>
                    {exMap.get(id)?.name ?? id}
                  </option>
                ))}
              </Select>
            </div>
          )}
          {strengthPts.length >= 2 ? (
            <div className="mt">
              <LineChart points={strengthPts} formatY={(v) => num(v, 0)} formatX={fmtDateShort} label="1RM estimado a lo largo del tiempo" height={140} />
            </div>
          ) : (
            sid && <p className="small muted mt">Necesitas al menos dos sesiones de este ejercicio.</p>
          )}
          <p className="tiny muted mt">1RM estimado (Epley) con series de 1 a 12 repeticiones. Es una estimación, no una marca real.</p>
        </Card>
      </div>

      <Section title="Resumen del periodo">
        <div className="panel panel-flat">
          <div className="stats-grid cols-3">
            <Stat label="Frecuencia" value={num(perWeek, 1)} sub="sesiones/semana" />
            <Stat label="Tiempo total" value={fmtMinutes(st.minutes)} sub={st.workouts ? `${fmtMinutes(st.avgMinutes)} de media` : undefined} />
            <Stat label="Series efectivas" value={st.sets} sub={`${st.reps} repeticiones`} />
            <Stat label="Consistencia" value={cons ? `${cons.pct} %` : '—'} sub={cons ? `${cons.met}/${cons.total} semanas con objetivo` : 'Sin semanas completas'} />
          </div>
        </div>
      </Section>

      {st.workouts > 0 && (
        <>
          <Section title={monthly ? 'Entrenamientos por mes' : 'Entrenamientos por semana'}>
            <div className="panel">
              {monthly ? (
                <BarChart bars={months.map((m) => ({ key: m.month, label: m.month.slice(5), value: m.workouts, tip: `${m.workouts} sesiones · ${fmtMonth(m.month + '-01')}` }))} formatY={(v) => String(v)} label="Entrenamientos por mes" />
              ) : (
                <BarChart
                  bars={weeks.map((w) => ({ key: w.weekStart, label: fmtDateShort(w.weekStart), value: w.workouts, tip: `${w.workouts} sesiones · ${fmtMinutes(w.minutes)}` }))}
                  formatY={(v) => String(v)}
                  label="Entrenamientos por semana"
                  goal={settings.weeklyGoal}
                />
              )}
            </div>
          </Section>
          <Section title={monthly ? 'Volumen por mes' : 'Volumen por semana'}>
            <div className="panel">
              <BarChart
                bars={(monthly ? months.map((m) => ({ key: m.month, label: m.month.slice(5), value: toDisplayWeight(m.volume), raw: m.volume })) : weeks.map((w) => ({ key: w.weekStart, label: fmtDateShort(w.weekStart), value: toDisplayWeight(w.volume), raw: w.volume }))).map((b) => ({ ...b, tip: fmtVolume(b.raw) }))}
                formatY={(v) => num(v, 0)}
                label="Volumen"
              />
              <p className="tiny muted mt">El volumen suma carga × repeticiones; no equivale al peso máximo levantado. El cardio y los ejercicios sólo de repeticiones no suman volumen.</p>
            </div>
          </Section>
          <Section title="Series por grupo muscular">
            <div className="panel">
              {muscles.length ? <HBars items={muscles.map(([m, n]) => ({ key: m, label: MUSCLES[m], value: n }))} format={(v) => String(v)} /> : <p className="small muted">Sin series efectivas.</p>}
            </div>
          </Section>
        </>
      )}

      <Section title="Explorar">
        <List>
          <Row icon={<HistoryIcon size={20} />} title="Historial" subtitle="Calendario, búsqueda y detalle de cada sesión" onClick={() => navigate('/history')} />
          <Row icon={<Dumbbell size={20} />} title="Ejercicios y récords" subtitle="Cargas, 1RM estimado y mejores series" onClick={() => navigate('/exercises')} />
          <Row icon={<Camera size={20} />} title="Fotos de progreso" onClick={() => navigate('/body/photos')} />
          <Row icon={<ClipboardCheck size={20} />} title="Revisiones semanales" onClick={() => navigate('/reviews')} />
        </List>
      </Section>

      <Sheet open={prsOpen} onClose={() => setPrsOpen(false)} title={`Récords · ${periodLabel}`}>
        {prs.length ? (
          <List>
            {prs.map((p, i) => (
              <Row key={i} icon={<Trophy size={18} />} title={p.exerciseName} subtitle={`${PR_LABELS[p.kind]} · ${fmtDate(p.date, true)}`} value={<strong>{fmtPR(p)}</strong>} onClick={() => navigate(`/history/${p.workoutId}`)} />
            ))}
          </List>
        ) : (
          <p className="small muted">Sin récords nuevos en este periodo. Los récords se cuentan cuando superas tu mejor marca anterior.</p>
        )}
      </Sheet>
      <WeightSheet open={weightOpen} onClose={() => setWeightOpen(false)} />
    </Page>
  );
}
