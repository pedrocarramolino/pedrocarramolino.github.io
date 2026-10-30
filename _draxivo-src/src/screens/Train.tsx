import { CalendarDays, History as HistoryIcon, ListChecks, Play, Plus, WandSparkles } from 'lucide-react';
import { useQuery } from '../app/hooks';
import { navigate } from '../app/router';
import { getActiveWorkout, listPlan } from '../db/repo';
import { fmtMinutes, relativeDay, today } from '../lib/dates';
import { Button, Empty, List, Page, Row, Section } from '../ui/kit';
import { useRoutines, useStartWorkout, useWorkouts } from './shared';
import { useSettings } from '../app/context';
import { estimateRoutineMinutes } from '../db/repo';

export function Train() {
  const { settings } = useSettings();
  const routines = useRoutines();
  const workouts = useWorkouts();
  const plan = useQuery(listPlan, ['plan']);
  const active = useQuery(getActiveWorkout, ['workouts']);
  const start = useStartWorkout();
  const t = today();
  const todays = (plan ?? []).filter((p) => p.date === t);
  const usable = (routines ?? []).filter((r) => !r.archived && !r.isTemplate);
  const lastUse = (id: string) => workouts?.find((w) => w.routineId === id);

  return (
    <Page title="Entrenar">
      {active ? (
        <div className="callout">
          <Play size={20} />
          <div style={{ flex: 1 }}>
            <strong>{active.name} en curso</strong>
            <div className="btn-row mt">
              <Button size="sm" variant="primary" onClick={() => navigate('/workout')}>
                Continuar entrenamiento
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <Button variant="primary" size="lg" block icon={<Plus size={20} />} onClick={() => start(null)}>
          Entrenamiento libre
        </Button>
      )}

      {todays.length > 0 && (
        <Section title="Planificado para hoy">
          <List>
            {todays.map((p) => {
              if (p.kind === 'rest') return <Row key={p.id} title="Día de descanso" subtitle={p.note || undefined} />;
              const r = routines?.find((x) => x.id === p.routineId);
              const done = workouts?.some((w) => w.date === t && w.routineId === p.routineId);
              return (
                <Row key={p.id} title={r?.name ?? 'Rutina eliminada'} subtitle={done ? 'Completada' : 'Pendiente'}>
                  {r && !done && (
                    <Button size="sm" variant="tinted" icon={<Play size={16} />} onClick={() => start(r.id, p.id)}>
                      Empezar
                    </Button>
                  )}
                </Row>
              );
            })}
          </List>
        </Section>
      )}

      <Section title="Empezar desde una rutina" action={<button className="link" onClick={() => navigate('/routines')}>Gestionar</button>}>
        {usable.length ? (
          <List>
            {usable.map((r) => {
              const lu = lastUse(r.id);
              return (
                <Row
                  key={r.id}
                  title={r.name}
                  subtitle={`${r.exercises.length} ejercicios · ~${fmtMinutes(r.estimatedMin ?? estimateRoutineMinutes(r, settings.defaultRestSec))}${lu ? ` · última vez ${relativeDay(lu.date).toLowerCase()}` : ''}`}
                  chevron={false}
                >
                  <Button size="sm" variant="tinted" icon={<Play size={16} />} onClick={() => start(r.id)} aria-label={`Empezar ${r.name}`}>
                    Empezar
                  </Button>
                </Row>
              );
            })}
          </List>
        ) : (
          <Empty icon={<ListChecks size={24} />} title="Sin rutinas" text="Crea una rutina para empezar con tus ejercicios ya preparados." action={<Button variant="tinted" onClick={() => navigate('/routines/new')}>Crear rutina</Button>} />
        )}
      </Section>

      <Section>
        <List>
          <Row icon={<WandSparkles size={20} />} title="Generar rutina" subtitle="Según músculos, tiempo y material" onClick={() => navigate('/routines/generate')} />
          <Row icon={<CalendarDays size={20} />} title="Planificación semanal" onClick={() => navigate('/plan')} />
          <Row icon={<HistoryIcon size={20} />} title="Historial de entrenamientos" onClick={() => navigate('/history')} />
          <Row icon={<ListChecks size={20} />} title="Biblioteca de ejercicios" onClick={() => navigate('/exercises')} />
        </List>
      </Section>
    </Page>
  );
}
