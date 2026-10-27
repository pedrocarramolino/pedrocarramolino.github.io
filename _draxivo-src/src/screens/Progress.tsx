import { useMemo, useState } from 'react';
import { Camera, ClipboardCheck, History as HistoryIcon, ListChecks, Ruler, Scale as ScaleIcon } from 'lucide-react';
import type { MuscleGroup } from '../db/types';
import { useQuery } from '../app/hooks';
import { navigate } from '../app/router';
import { useSettings } from '../app/context';
import { listBodyWeights, listWeekGoals } from '../db/repo';
import { consistency, monthlyBuckets, periodStats, weeklyBuckets } from '../domain/metrics';
import { goalForWeek } from '../domain/review';
import { weightSummary } from '../domain/weight';
import { addDays, diffDays, fmtDateShort, fmtMinutes, fmtMonth, today } from '../lib/dates';
import { MUSCLES } from '../lib/labels';
import { fmtSigned, fmtVolume, fmtWeight, num, toDisplayWeight } from '../lib/units';
import { BarChart, HBars } from '../ui/charts';
import { Field, Input, List, Loading, Page, Row, Section, Segmented, Stat } from '../ui/kit';
import { useWorkouts } from './shared';

export type PeriodKey = '7' | '30' | '90' | '365' | 'all' | 'custom';
export const PERIODS: { value: PeriodKey; label: string }[] = [
  { value: '7', label: '7 d' },
  { value: '30', label: '30 d' },
  { value: '90', label: '90 d' },
  { value: '365', label: '1 año' },
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
            <Input type="date" value={custom.from} max={custom.to || today()} onChange={(e) => setCustom({ ...custom, from: e.target.value })} />
          </Field>
          <Field label="Hasta">
            <Input type="date" value={custom.to} min={custom.from} max={today()} onChange={(e) => setCustom({ ...custom, to: e.target.value })} />
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
  const [period, setPeriod] = useState<PeriodKey>('30');
  const [custom, setCustom] = useState({ from: addDays(today(), -59), to: today() });

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
    return { from, to, st, span, weeks, months, monthly, cons, muscles };
  }, [workouts, goals, period, custom, settings]);

  if (!data || !weights) return <Loading />;
  const { st, span, weeks, months, monthly, cons, muscles, from, to } = data;
  const perWeek = st.workouts / Math.max(1, span / 7);
  const ws = weightSummary(weights.filter((w) => w.date >= from && w.date <= to));

  return (
    <Page title="Progreso">
      <PeriodPicker value={period} onChange={setPeriod} custom={custom} setCustom={setCustom} />

      <Section title="Entrenamiento">
        <div className="panel panel-flat">
          <div className="stats-grid cols-3">
            <Stat label="Entrenamientos" value={st.workouts} sub={`${num(perWeek, 1)} por semana`} />
            <Stat label="Tiempo total" value={fmtMinutes(st.minutes)} sub={st.workouts ? `${fmtMinutes(st.avgMinutes)} de media` : undefined} />
            <Stat label="Series efectivas" value={st.sets} sub={`${st.reps} repeticiones`} />
            <Stat label="Volumen" value={st.volume ? fmtVolume(st.volume) : '—'} sub="carga × repeticiones" />
            <Stat label="Consistencia" value={cons ? `${cons.pct} %` : '—'} sub={cons ? `${cons.met} de ${cons.total} semanas con objetivo` : 'Sin semanas completas'} />
            <Stat label="Peso corporal" value={ws.latest ? fmtWeight(ws.latest.weightKg) : '—'} sub={ws.latest && ws.initial && ws.latest !== ws.initial ? `${fmtSigned(ws.latest.weightKg - ws.initial.weightKg)} en el periodo` : undefined} />
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
              <p className="tiny muted mt">El volumen suma carga × repeticiones; no equivale al peso máximo levantado. Los ejercicios de cardio y sólo repeticiones no suman volumen.</p>
            </div>
          </Section>
          <Section title="Series por grupo muscular">
            <div className="panel">
              {muscles.length ? <HBars items={muscles.map(([m, n]) => ({ key: m, label: MUSCLES[m], value: n }))} format={(v) => String(v)} /> : <p className="small muted">Sin series efectivas.</p>}
              <p className="tiny muted mt">Cuenta las series efectivas según el grupo muscular principal de cada ejercicio.</p>
            </div>
          </Section>
        </>
      )}

      <Section title="Explorar">
        <List>
          <Row icon={<HistoryIcon size={20} />} title="Historial" subtitle="Calendario, búsqueda y detalles de cada sesión" onClick={() => navigate('/history')} />
          <Row icon={<ListChecks size={20} />} title="Ejercicios y récords" subtitle="Evolución de cargas, 1RM estimado y mejores series" onClick={() => navigate('/exercises')} />
          <Row icon={<ScaleIcon size={20} />} title="Peso corporal" onClick={() => navigate('/body/weight')} />
          <Row icon={<Ruler size={20} />} title="Medidas corporales" onClick={() => navigate('/body/measurements')} />
          <Row icon={<Camera size={20} />} title="Fotos de progreso" onClick={() => navigate('/body/photos')} />
          <Row icon={<ClipboardCheck size={20} />} title="Revisiones semanales" onClick={() => navigate('/reviews')} />
        </List>
      </Section>
    </Page>
  );
}
