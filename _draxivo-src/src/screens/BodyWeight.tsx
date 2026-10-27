import { useState } from 'react';
import { Info, Plus, Scale as ScaleIcon } from 'lucide-react';
import type { BodyWeight } from '../db/types';
import { useQuery } from '../app/hooks';
import { useSettings, useToast } from '../app/context';
import { deleteBodyWeight, listBodyWeights } from '../db/repo';
import { averageIn, weightSummary } from '../domain/weight';
import { addDays, diffDays, fmtDate, fmtDateShort } from '../lib/dates';
import { fmtSigned, fmtWeight, fromDisplayWeight, num, toDisplayWeight, wUnit } from '../lib/units';
import { LineChart } from '../ui/charts';
import { Button, Empty, Field, IconButton, List, Loading, NumberInput, Page, Row, Section, Segmented, Sheet, Stat, useConfirm } from '../ui/kit';
import { WeightSheet } from './shared';
import { PeriodPicker, periodRange, type PeriodKey } from './Progress';

export function BodyWeightScreen() {
  const { settings, update } = useSettings();
  const toast = useToast();
  const confirm = useConfirm();
  const entries = useQuery(listBodyWeights, ['bodyweights']);
  const [sheet, setSheet] = useState<{ entry: BodyWeight | null } | null>(null);
  const [period, setPeriod] = useState<PeriodKey>('90');
  const [custom, setCustom] = useState({ from: '', to: '' });
  const [goalOpen, setGoalOpen] = useState(false);
  const [goalType, setGoalType] = useState(settings.weightGoalType ?? 'mantener');
  const [goalVal, setGoalVal] = useState<number | null>(settings.weightGoalKg != null ? toDisplayWeight(settings.weightGoalKg) : null);
  const [showAll, setShowAll] = useState(false);

  if (!entries) return <Loading />;
  const s = weightSummary(entries);
  const earliest = entries[0]?.date ?? null;
  const { from, to } = periodRange(period, earliest, custom);
  const inRange = s.days.filter((d) => d.date >= from && d.date <= to);
  const trendIn = s.trend.filter((d) => d.date >= from && d.date <= to);
  const span = diffDays(to, from) + 1;
  const avgNow = averageIn(s.days, from, to);
  const avgPrev = averageIn(s.days, addDays(from, -span), addDays(from, -1));
  const goal = settings.weightGoalKg;
  const sorted = [...entries].reverse();

  const remove = async (e: BodyWeight) => {
    if (await confirm({ title: '¿Eliminar este registro?', message: `${fmtWeight(e.weightKg)} · ${fmtDate(e.date, true)}`, confirmLabel: 'Eliminar', destructive: true })) {
      await deleteBodyWeight(e.id);
      toast('Registro eliminado');
    }
  };

  return (
    <Page
      title="Peso corporal"
      back="/progress"
      backLabel="Progreso"
      actions={
        <IconButton label="Registrar peso" onClick={() => setSheet({ entry: null })}>
          <Plus size={24} />
        </IconButton>
      }
    >
      {!entries.length ? (
        <Empty icon={<ScaleIcon size={26} />} title="Sin registros" text="Registra tu peso con regularidad, idealmente en condiciones similares, para ver una tendencia fiable." action={<Button variant="primary" onClick={() => setSheet({ entry: null })}>Registrar peso</Button>} />
      ) : (
        <>
          <div className="panel">
            <div className="split">
              <div>
                <div className="stat-label">Último registro · {fmtDate(s.latest!.date)}</div>
                <span className="hero-number">{num(toDisplayWeight(s.latest!.weightKg), 1)}</span>
                <span className="hero-unit">{wUnit()}</span>
              </div>
              <Button variant="tinted" size="sm" onClick={() => setSheet({ entry: null })}>
                Registrar
              </Button>
            </div>
            <div className="stats-grid" style={{ padding: '16px 0 0' }}>
              <Stat label="Respecto al anterior" value={s.diffPrevious != null ? fmtSigned(s.diffPrevious) : '—'} />
              <Stat label="Variación semanal" value={s.weekly ? fmtSigned(s.weekly.delta) : '—'} sub={s.weekly ? `desde el ${fmtDate(s.weekly.from.date)}` : 'Datos insuficientes'} />
              <Stat label="Variación mensual" value={s.monthly ? fmtSigned(s.monthly.delta) : '—'} sub={s.monthly ? `desde el ${fmtDate(s.monthly.from.date)}` : 'Datos insuficientes'} />
              <Stat label="Peso inicial" value={fmtWeight(s.initial!.weightKg)} sub={fmtDate(s.initial!.date, true)} />
              <Stat label="Tendencia (media 7 días)" value={s.trend.length ? fmtWeight(s.trend[s.trend.length - 1].value) : '—'} />
              <Stat
                label="Objetivo"
                value={settings.weightGoalType ? (goal != null ? fmtWeight(goal) : { perder: 'Perder', ganar: 'Ganar', mantener: 'Mantener' }[settings.weightGoalType]) : '—'}
                sub={<button className="link small" onClick={() => setGoalOpen(true)}>{settings.weightGoalType ? 'Cambiar' : 'Definir (opcional)'}</button>}
              />
            </div>
          </div>

          <Section title="Evolución">
            <PeriodPicker value={period} onChange={setPeriod} custom={custom} setCustom={setCustom} />
            <div className="panel mt">
              {inRange.length >= 2 ? (
                <LineChart
                  points={inRange.map((d) => ({ x: d.date, y: toDisplayWeight(d.weight) }))}
                  line={trendIn.map((d) => ({ x: d.date, y: toDisplayWeight(d.value) }))}
                  pointsLabel="Registro"
                  lineLabel="Media 7 días"
                  goal={goal != null ? toDisplayWeight(goal) : null}
                  formatY={(v) => num(v, 1)}
                  formatX={fmtDateShort}
                  label="Evolución del peso corporal"
                  height={220}
                />
              ) : (
                <p className="small muted">Necesitas al menos dos días con registros en este periodo para ver la gráfica.</p>
              )}
              {avgNow != null && (
                <p className="small mt">
                  Media del periodo: <strong>{fmtWeight(avgNow)}</strong>
                  {avgPrev != null ? (
                    <>
                      {' '}
                      · periodo anterior {fmtWeight(avgPrev)} (<strong>{fmtSigned(avgNow - avgPrev)}</strong>)
                    </>
                  ) : (
                    <span className="muted"> · sin datos del periodo anterior para comparar</span>
                  )}
                </p>
              )}
            </div>
          </Section>

          <div className="callout callout-neutral mt">
            <Info size={18} />
            <span>
              El peso varía de un día a otro por hidratación, digestión, sal, sueño y otros factores. Esas fluctuaciones no significan cambios de grasa o músculo; la media de 7 días ayuda a ver la tendencia.
            </span>
          </div>

          <Section title={`Registros · ${entries.length}`}>
            <List>
              {(showAll ? sorted : sorted.slice(0, 20)).map((e, i) => {
                const prev = sorted[i + 1];
                return (
                  <Row
                    key={e.id}
                    title={fmtWeight(e.weightKg)}
                    subtitle={`${fmtDate(e.date, true)}${e.time ? ` · ${e.time}` : ''}${e.note ? ` · ${e.note}` : ''}`}
                    value={prev ? fmtSigned(e.weightKg - prev.weightKg) : undefined}
                    onClick={() => setSheet({ entry: e })}
                    chevron={false}
                  >
                    <Button size="sm" variant="plain" onClick={() => remove(e)} aria-label={`Eliminar registro del ${fmtDate(e.date, true)}`} className="text-danger">
                      Eliminar
                    </Button>
                  </Row>
                );
              })}
            </List>
            {sorted.length > 20 && (
              <Button variant="plain" block onClick={() => setShowAll((x) => !x)}>
                {showAll ? 'Mostrar menos' : `Mostrar los ${sorted.length} registros`}
              </Button>
            )}
          </Section>
        </>
      )}

      <WeightSheet open={!!sheet} entry={sheet?.entry} onClose={() => setSheet(null)} />

      <Sheet
        open={goalOpen}
        onClose={() => setGoalOpen(false)}
        title="Objetivo de peso"
        footer={
          <>
            <Button
              onClick={async () => {
                await update({ weightGoalType: null, weightGoalKg: null });
                setGoalOpen(false);
              }}
            >
              Sin objetivo
            </Button>
            <Button
              variant="primary"
              onClick={async () => {
                await update({ weightGoalType: goalType, weightGoalKg: goalVal != null ? fromDisplayWeight(goalVal) : null });
                setGoalOpen(false);
              }}
            >
              Guardar
            </Button>
          </>
        }
      >
        <p className="small muted">Es opcional. DRAXIVO no impone objetivos ni ritmos.</p>
        <div className="mt">
          <Segmented label="Tipo de objetivo" value={goalType} onChange={setGoalType} options={[{ value: 'perder', label: 'Perder' }, { value: 'mantener', label: 'Mantener' }, { value: 'ganar', label: 'Ganar' }]} />
        </div>
        <div className="mt">
          <Field label={`Peso objetivo (${wUnit()}, opcional)`}>
            <NumberInput value={goalVal} onChange={setGoalVal} />
          </Field>
        </div>
      </Sheet>
    </Page>
  );
}
