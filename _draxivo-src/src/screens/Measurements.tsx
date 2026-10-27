import { useState } from 'react';
import { Plus, Ruler } from 'lucide-react';
import type { Measurement, MeasurementType } from '../db/types';
import { useQuery } from '../app/hooks';
import { useToast } from '../app/context';
import { deleteMeasurement, listMeasurements, saveMeasurement } from '../db/repo';
import { fmtDate, fmtDateShort, today } from '../lib/dates';
import { MEASUREMENTS } from '../lib/labels';
import { fmtLength, fromDisplayLength, lUnit, num, toDisplayLength } from '../lib/units';
import { LineChart } from '../ui/charts';
import { Button, Empty, Field, IconButton, Input, List, Loading, NumberInput, Page, Row, Section, Select, Sheet, useConfirm } from '../ui/kit';

const fmtVal = (m: { type: MeasurementType; value: number }) => (m.type === 'grasa' ? `${num(m.value, 1)} %` : fmtLength(m.value));

export function MeasurementsScreen() {
  const toast = useToast();
  const confirm = useConfirm();
  const list = useQuery(listMeasurements, ['measurements']);
  const [type, setType] = useState<MeasurementType>('cintura');
  const [edit, setEdit] = useState<{ entry: Measurement | null } | null>(null);
  const [f, setF] = useState<{ date: string; type: MeasurementType; value: number | null; note: string }>({ date: today(), type: 'cintura', value: null, note: '' });

  if (!list) return <Loading />;
  const byType = list.filter((m) => m.type === type);
  const latestPerType = (Object.keys(MEASUREMENTS) as MeasurementType[])
    .map((t) => {
      const l = list.filter((m) => m.type === t);
      return { t, last: l[l.length - 1], first: l[0], n: l.length };
    })
    .filter((x) => x.last);

  const open = (entry: Measurement | null) => {
    setF(entry ? { date: entry.date, type: entry.type, value: entry.type === 'grasa' ? entry.value : toDisplayLength(entry.value), note: entry.note } : { date: today(), type, value: null, note: '' });
    setEdit({ entry });
  };
  const save = async () => {
    if (f.value == null) return;
    try {
      await saveMeasurement({ id: edit?.entry?.id, createdAt: edit?.entry?.createdAt, date: f.date, type: f.type, value: f.type === 'grasa' ? f.value : fromDisplayLength(f.value), note: f.note });
      toast('Medida guardada');
      setType(f.type);
      setEdit(null);
    } catch (e) {
      toast((e as Error).message, { tone: 'error' });
    }
  };

  return (
    <Page
      title="Medidas"
      back="/progress"
      backLabel="Progreso"
      actions={
        <IconButton label="Añadir medida" onClick={() => open(null)}>
          <Plus size={24} />
        </IconButton>
      }
    >
      {!list.length ? (
        <Empty icon={<Ruler size={26} />} title="Sin medidas" text="Registra cintura, cadera, brazo u otras medidas. Mide siempre en el mismo punto y en condiciones similares." action={<Button variant="primary" onClick={() => open(null)}>Añadir medida</Button>} />
      ) : (
        <>
          <Section title="Últimos valores">
            <List>
              {latestPerType.map(({ t, last, first, n }) => (
                <Row
                  key={t}
                  title={MEASUREMENTS[t]}
                  subtitle={`${fmtDate(last.date, true)}${n > 1 ? ` · ${n} registros` : ''}`}
                  value={
                    <span>
                      <strong>{fmtVal(last)}</strong>
                      {n > 1 && <span className="small muted"> ({last.value - first.value >= 0 ? '+' : '−'}{t === 'grasa' ? `${num(Math.abs(last.value - first.value), 1)} %` : fmtLength(Math.abs(last.value - first.value))})</span>}
                    </span>
                  }
                  onClick={() => setType(t)}
                />
              ))}
            </List>
          </Section>
          <Section title="Evolución">
            <Select value={type} onChange={(v) => setType(v as MeasurementType)} aria-label="Medida">
              {(Object.keys(MEASUREMENTS) as MeasurementType[]).map((t) => (
                <option key={t} value={t}>
                  {MEASUREMENTS[t]}
                </option>
              ))}
            </Select>
            <div className="panel mt">
              {byType.length >= 2 ? (
                <LineChart
                  points={byType.map((m) => ({ x: m.date, y: m.type === 'grasa' ? m.value : toDisplayLength(m.value) }))}
                  formatY={(v) => num(v, 1)}
                  formatX={fmtDateShort}
                  label={`Evolución de ${MEASUREMENTS[type]}`}
                />
              ) : (
                <p className="small muted">{byType.length ? 'Añade otra medición para ver la evolución.' : `Aún no hay registros de ${MEASUREMENTS[type].toLowerCase()}.`}</p>
              )}
            </div>
            {type === 'grasa' && <p className="tiny muted mt">El porcentaje de grasa depende mucho del método de medición; compara sólo valores obtenidos con el mismo método.</p>}
          </Section>
          {byType.length > 0 && (
            <Section title={`Registros de ${MEASUREMENTS[type].toLowerCase()}`}>
              <List>
                {[...byType].reverse().map((m) => (
                  <Row key={m.id} title={fmtVal(m)} subtitle={`${fmtDate(m.date, true)}${m.note ? ` · ${m.note}` : ''}`} onClick={() => open(m)} chevron={false}>
                    <Button
                      size="sm"
                      variant="plain"
                      className="text-danger"
                      onClick={async () => {
                        if (await confirm({ title: '¿Eliminar esta medida?', confirmLabel: 'Eliminar', destructive: true })) {
                          await deleteMeasurement(m.id);
                          toast('Medida eliminada');
                        }
                      }}
                    >
                      Eliminar
                    </Button>
                  </Row>
                ))}
              </List>
            </Section>
          )}
        </>
      )}

      <Sheet
        open={!!edit}
        onClose={() => setEdit(null)}
        title={edit?.entry ? 'Editar medida' : 'Nueva medida'}
        footer={
          <>
            <Button onClick={() => setEdit(null)}>Cancelar</Button>
            <Button variant="primary" onClick={save} disabled={f.value == null || f.date > today()}>
              Guardar
            </Button>
          </>
        }
      >
        <div className="form-grid">
          <Field label="Medida">
            <Select value={f.type} onChange={(v) => setF({ ...f, type: v as MeasurementType })}>
              {(Object.keys(MEASUREMENTS) as MeasurementType[]).map((t) => (
                <option key={t} value={t}>
                  {MEASUREMENTS[t]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={f.type === 'grasa' ? 'Valor (%)' : `Valor (${lUnit()})`}>
            <NumberInput value={f.value} onChange={(v) => setF({ ...f, value: v })} />
          </Field>
          <Field label="Fecha">
            <Input type="date" value={f.date} max={today()} onChange={(e) => setF({ ...f, date: e.target.value })} />
          </Field>
          <Field label="Nota">
            <Input value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} maxLength={200} />
          </Field>
        </div>
      </Sheet>
    </Page>
  );
}
