import { useEffect, useRef, useState } from 'react';
import { Database, Download, Info, ShieldCheck, Smartphone, Upload } from 'lucide-react';
import { useSettings, useToast } from '../app/context';
import { navigate } from '../app/router';
import { isStandalone } from '../app/pwa';
import { applyImport, downloadText, exportBackup, exportCSV, planImport, type ImportPlan } from '../db/backup';
import { requestPersistentStorage, storageEstimate } from '../db/database';
import { wipeAllData } from '../db/repo';
import { deviceTimezone, fmtSeconds, today, WEEKDAYS } from '../lib/dates';
import { GOALS } from '../lib/labels';
import { Button, Field, Input, List, LogoMark, Page, Row, Section, Segmented, Select, Sheet, Toggle, cx, useConfirm } from '../ui/kit';

export function Profile() {
  const { settings: s, update } = useSettings();
  const [name, setName] = useState(s.name);
  useEffect(() => setName(s.name), [s.name]);
  const zones = (() => {
    try {
      return (Intl as unknown as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf?.('timeZone') ?? [s.timezone];
    } catch {
      return [s.timezone];
    }
  })();

  return (
    <Page title="Perfil">
      <Section title="Tú">
        <div className="panel">
          <Field label="Nombre o alias">
            <Input value={name} onChange={(e) => setName(e.target.value)} onBlur={() => name !== s.name && update({ name: name.trim() })} maxLength={40} placeholder="Opcional" />
          </Field>
          <div className="form-grid">
            <Field label="Objetivo">
              <Select value={s.goal} onChange={(v) => update({ goal: v })}>
                <option value="">Sin especificar</option>
                {GOALS.map((g) => (
                  <option key={g}>{g}</option>
                ))}
              </Select>
            </Field>
            <Field label="Experiencia">
              <Select value={s.experience} onChange={(v) => update({ experience: v as typeof s.experience })}>
                <option value="">Sin especificar</option>
                <option value="principiante">Principiante</option>
                <option value="intermedio">Intermedio</option>
                <option value="avanzado">Avanzado</option>
              </Select>
            </Field>
          </div>
        </div>
      </Section>

      <Section title="Entrenamiento">
        <div className="panel">
          <Field label="Días habituales de entrenamiento">
            <div className="chips chips-wrap">
              {WEEKDAYS.map((d, i) => {
                const on = s.trainingDays.includes(i);
                return (
                  <button key={d} className={cx('chip', on && 'active')} aria-pressed={on} onClick={() => update({ trainingDays: on ? s.trainingDays.filter((x) => x !== i) : [...s.trainingDays, i].sort() })}>
                    {d.slice(0, 3)}
                  </button>
                );
              })}
            </div>
          </Field>
          <Field label="Objetivo semanal de sesiones">
            <Segmented label="Objetivo semanal" value={String(s.weeklyGoal)} onChange={(v) => update({ weeklyGoal: Number(v) })} options={[1, 2, 3, 4, 5, 6, 7].map((n) => ({ value: String(n), label: String(n) }))} />
          </Field>
          <Field label="Descanso predeterminado entre series">
            <Select value={String(s.defaultRestSec)} onChange={(v) => update({ defaultRestSec: Number(v) })}>
              {[30, 45, 60, 75, 90, 120, 150, 180, 240, 300].map((x) => (
                <option key={x} value={x}>
                  {fmtSeconds(x)}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <List className="mt">
          <Toggle checked={s.autoStartRest} onChange={(v) => update({ autoStartRest: v })} label="Iniciar descanso al completar una serie" />
          <Toggle checked={s.restSound} onChange={(v) => update({ restSound: v })} label="Sonido al terminar el descanso" description="Sólo con la app abierta en pantalla." />
          <Toggle checked={s.restVibration} onChange={(v) => update({ restVibration: v })} label="Vibración al terminar el descanso" description="No disponible en iPhone (Safari no permite vibrar)." />
        </List>
      </Section>

      <Section title="Revisión semanal">
        <List>
          <Toggle checked={s.reviewEnabled} onChange={(v) => update({ reviewEnabled: v })} label="Recordar la revisión en Inicio" description="Nunca bloquea el acceso al entrenamiento y se puede posponer." />
        </List>
        <div className="panel mt">
          <Field label="Día de revisión" hint="De viernes a domingo se revisa la semana en curso; de lunes a jueves, la semana anterior.">
            <Select value={String(s.reviewDay)} onChange={(v) => update({ reviewDay: Number(v) })}>
              {WEEKDAYS.map((d, i) => (
                <option key={d} value={i}>
                  {d}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      </Section>

      <Section title="Unidades y región">
        <div className="panel">
          <div className="form-grid">
            <Field label="Peso">
              <Segmented label="Unidad de peso" value={s.weightUnit} onChange={(v) => update({ weightUnit: v })} options={[{ value: 'kg', label: 'kg' }, { value: 'lb', label: 'lb' }]} />
            </Field>
            <Field label="Longitud">
              <Segmented label="Unidad de longitud" value={s.lengthUnit} onChange={(v) => update({ lengthUnit: v })} options={[{ value: 'cm', label: 'cm' }, { value: 'in', label: 'in' }]} />
            </Field>
          </div>
          <Field label="Zona horaria" hint={`Del dispositivo: ${deviceTimezone()}. Define qué día cuenta cada entrenamiento.`}>
            <Select value={s.timezone} onChange={(v) => update({ timezone: v })}>
              {!zones.includes(s.timezone) && <option>{s.timezone}</option>}
              {zones.map((z) => (
                <option key={z}>{z}</option>
              ))}
            </Select>
          </Field>
        </div>
      </Section>

      <Section title="Apariencia">
        <Segmented label="Tema" value={s.theme} onChange={(v) => update({ theme: v })} options={[{ value: 'auto', label: 'Automático' }, { value: 'light', label: 'Claro' }, { value: 'dark', label: 'Oscuro' }]} />
      </Section>

      <Section title="Datos y privacidad">
        <List>
          <Row icon={<Database size={20} />} title="Exportar, importar y borrar datos" onClick={() => navigate('/profile/data')} />
          <Row icon={<ShieldCheck size={20} />} title="Privacidad y almacenamiento" onClick={() => navigate('/profile/about')} />
        </List>
      </Section>

      <p className="tiny muted mt-lg" style={{ textAlign: 'center' }}>
        DRAXIVO · gratuito, sin anuncios ni suscripciones
      </p>
    </Page>
  );
}

const CSV_KINDS = [
  ['workouts', 'Entrenamientos'],
  ['sets', 'Series'],
  ['routines', 'Rutinas'],
  ['exercises', 'Ejercicios'],
  ['bodyweights', 'Peso corporal'],
  ['measurements', 'Medidas'],
  ['reviews', 'Revisiones'],
  ['settings', 'Configuración'],
] as const;

const STORE_LABELS: Record<string, string> = {
  settings: 'Configuración',
  exercises: 'Ejercicios',
  folders: 'Carpetas',
  routines: 'Rutinas',
  workouts: 'Entrenamientos',
  bodyweights: 'Registros de peso',
  measurements: 'Medidas',
  photos: 'Fotos',
  plan: 'Planificación',
  weekgoals: 'Objetivos semanales',
  reviews: 'Revisiones',
};

export function DataScreen() {
  const toast = useToast();
  const confirm = useConfirm();
  const [photos, setPhotos] = useState(false);
  const [busy, setBusy] = useState(false);
  const [plan, setPlan] = useState<ImportPlan | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [includeSettings, setIncludeSettings] = useState(false);
  const fileText = useRef('');
  const fileRef = useRef<HTMLInputElement>(null);

  const exportJson = async () => {
    setBusy(true);
    try {
      const data = await exportBackup({ includePhotos: photos });
      downloadText(`draxivo-copia-${today()}.json`, JSON.stringify(data), 'application/json');
      toast('Copia de seguridad descargada');
    } catch (e) {
      toast(`Error al exportar: ${(e as Error).message}`, { tone: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const analyze = async (text: string, incl: boolean) => {
    const res = await planImport(text, { includeSettings: incl });
    if (res.ok) {
      setPlan(res.plan);
      setErrors([]);
    } else {
      setPlan(null);
      setErrors(res.errors);
    }
  };

  return (
    <Page title="Tus datos" back="/profile" backLabel="Perfil">
      <div className="callout callout-neutral">
        <Info size={18} />
        <span>Tus datos sólo existen en este navegador. Si borras los datos del sitio, desinstalas la app o el sistema libera espacio, podrías perderlos. Haz copias de seguridad periódicas.</span>
      </div>

      <Section title="Copia de seguridad completa (JSON)" footer="Incluye rutinas, ejercicios, entrenamientos, peso, medidas, planificación, revisiones y configuración. Se puede importar en otro dispositivo.">
        <List>
          <Toggle checked={photos} onChange={setPhotos} label="Incluir fotos de progreso" description="El archivo será más grande. Guárdalo en un lugar privado." />
        </List>
        <Button variant="primary" block className="mt" icon={<Download size={18} />} onClick={exportJson} disabled={busy}>
          {busy ? 'Preparando…' : 'Descargar copia'}
        </Button>
      </Section>

      <Section title="Exportar a CSV" footer="Archivos compatibles con Excel, Numbers o Google Sheets. Pesos en kg.">
        <List>
          {CSV_KINDS.map(([k, label]) => (
            <Row
              key={k}
              icon={<Download size={18} />}
              title={label}
              onClick={async () => {
                const csv = await exportCSV(k);
                downloadText(`draxivo-${k}-${today()}.csv`, csv, 'text/csv;charset=utf-8');
              }}
            />
          ))}
        </List>
      </Section>

      <Section title="Importar copia" footer="Se valida el archivo antes de importar. No se borra nada: los registros nuevos se añaden y los existentes sólo se actualizan si la copia es más reciente.">
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (!f) return;
            fileText.current = await f.text();
            await analyze(fileText.current, includeSettings);
          }}
        />
        <Button block icon={<Upload size={18} />} onClick={() => fileRef.current?.click()}>
          Seleccionar archivo JSON
        </Button>
        {errors.length > 0 && (
          <div className="panel mt">
            <strong className="text-danger">No se puede importar</strong>
            <ul className="bullets small">
              {errors.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
          </div>
        )}
      </Section>

      <Section title="Borrar datos">
        <Button
          variant="danger"
          block
          onClick={async () => {
            if (!(await confirm({ title: '¿Borrar todos los datos?', message: 'Se eliminarán rutinas, entrenamientos, peso, medidas, fotos, revisiones y configuración de este dispositivo. No se puede deshacer. Exporta una copia antes si la necesitas.', confirmLabel: 'Continuar', destructive: true }))) return;
            if (!(await confirm({ title: 'Confirmación final', message: 'Esta acción es definitiva.', confirmLabel: 'Borrar todo', destructive: true }))) return;
            await wipeAllData();
            toast('Datos eliminados');
            navigate('/', { replace: true });
          }}
        >
          Borrar todos los datos
        </Button>
      </Section>

      <Sheet
        open={!!plan}
        onClose={() => setPlan(null)}
        title="Revisar importación"
        footer={
          <>
            <Button onClick={() => setPlan(null)}>Cancelar</Button>
            <Button
              variant="primary"
              disabled={!plan?.total || busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await applyImport(plan!, { includeSettings });
                  toast(`Importación completada: ${plan!.total} registros`);
                  setPlan(null);
                } catch (e) {
                  toast(`La importación falló y no se ha modificado nada: ${(e as Error).message}`, { tone: 'error', duration: 8000 });
                } finally {
                  setBusy(false);
                }
              }}
            >
              Importar {plan?.total ?? 0}
            </Button>
          </>
        }
      >
        {plan && (
          <>
            <p className="small muted">Copia exportada el {new Date(plan.file.exportedAt).toLocaleString('es-ES')}.</p>
            <List className="mt">
              <Toggle
                checked={includeSettings}
                onChange={async (v) => {
                  setIncludeSettings(v);
                  await analyze(fileText.current, v);
                }}
                label="Importar también la configuración"
              />
            </List>
            <List className="mt">
              {Object.entries(plan.counts)
                .filter(([, c]) => c.add + c.update + c.skip > 0)
                .map(([k, c]) => (
                  <Row key={k} title={STORE_LABELS[k] ?? k} value={`${c.add} nuevos · ${c.update} act. · ${c.skip} omitidos`} />
                ))}
            </List>
            {!plan.total && <p className="small muted mt">No hay datos nuevos que importar.</p>}
          </>
        )}
      </Sheet>
    </Page>
  );
}

export function AboutScreen() {
  const [est, setEst] = useState<{ usage: number; quota: number } | null>(null);
  const [persisted, setPersisted] = useState<boolean | null>(null);
  useEffect(() => {
    storageEstimate().then(setEst);
    navigator.storage?.persisted?.().then(setPersisted).catch(() => setPersisted(null));
  }, []);
  const mb = (b: number) => `${(b / 1024 / 1024).toFixed(b > 100 * 1024 * 1024 ? 0 : 1)} MB`;
  return (
    <Page title="Privacidad" back="/profile" backLabel="Perfil">
      <div style={{ textAlign: 'center', padding: '8px 0 16px' }}>
        <LogoMark size={64} />
        <h2 style={{ marginTop: 10, letterSpacing: '0.14em', fontSize: 18 }}>DRAXIVO</h2>
        <p className="small muted">Train with purpose</p>
      </div>
      <Section title="Privacidad">
        <div className="panel stack small">
          <p>DRAXIVO funciona sin cuenta. Todos tus datos —incluidas las fotos y las medidas corporales— se guardan sólo en este dispositivo, dentro del almacenamiento del navegador (IndexedDB).</p>
          <p>La aplicación no envía datos a ningún servidor, no usa analítica, publicidad ni rastreadores. Sólo salen del dispositivo los archivos que tú exportas.</p>
          <p>No hay sincronización entre dispositivos. Para pasar tus datos a otro dispositivo, exporta una copia JSON e impórtala allí.</p>
        </div>
      </Section>
      <Section title="Almacenamiento">
        <List>
          <Row title="Espacio usado" value={est ? mb(est.usage) : 'No disponible'} />
          <Row title="Espacio disponible estimado" value={est && est.quota ? mb(est.quota) : 'No disponible'} />
          <Row title="Almacenamiento persistente" value={persisted == null ? 'No disponible' : persisted ? 'Concedido' : 'No concedido'} />
        </List>
        {persisted === false && (
          <Button
            variant="tinted"
            block
            className="mt"
            onClick={async () => {
              setPersisted(await requestPersistentStorage());
            }}
          >
            Solicitar almacenamiento persistente
          </Button>
        )}
        <p className="section-footer">Sin límites artificiales: el único límite es el espacio que el navegador concede a la app en este dispositivo.</p>
      </Section>
      <Section title="Instalar en iPhone o iPad">
        <div className="panel stack small">
          <p>
            <Smartphone size={16} style={{ verticalAlign: '-3px' }} /> {isStandalone() ? 'Estás usando DRAXIVO instalada.' : 'En Safari, pulsa Compartir → «Añadir a pantalla de inicio».'}
          </p>
          <p>Limitaciones de iOS: Safari puede borrar los datos de sitios web no instalados que no se usen durante semanas; instalar la app en la pantalla de inicio reduce ese riesgo. Los avisos del descanso sólo suenan con la app abierta: el navegador no garantiza notificaciones ni temporizadores en segundo plano. El tiempo restante se recalcula siempre al volver a la app.</p>
          <p>Las funciones de DRAXIVO funcionan sin conexión una vez cargada la aplicación.</p>
        </div>
      </Section>
      <Section title="Aviso">
        <div className="panel small">DRAXIVO es una herramienta de registro. Las estimaciones (como el 1RM) y sugerencias son orientativas y no constituyen consejo médico ni garantizan resultados.</div>
      </Section>
    </Page>
  );
}
