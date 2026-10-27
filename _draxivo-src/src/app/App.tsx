import { useEffect, useState } from 'react';
import { ChartColumn, ClipboardList, Dumbbell, House, UserRound } from 'lucide-react';
import type { Settings } from '../db/types';
import { ConfirmProvider, cx } from '../ui/kit';
import { SettingsProvider, ToastProvider, useSettings } from './context';
import { navigate, useRoute } from './router';
import { useQuery, useTick } from './hooks';
import { getActiveWorkout } from '../db/repo';
import { workoutDurationMs } from '../domain/metrics';
import { fmtDuration } from '../lib/dates';
import { applyUpdate, onUpdateAvailable } from './pwa';
import { Home } from '../screens/Home';
import { Train } from '../screens/Train';
import { WorkoutScreen } from '../screens/Workout';
import { WorkoutSummary } from '../screens/WorkoutSummary';
import { Routines } from '../screens/Routines';
import { RoutineDetail } from '../screens/RoutineDetail';
import { RoutineEditor } from '../screens/RoutineEditor';
import { Exercises, ExerciseDetail } from '../screens/Exercises';
import { Progress } from '../screens/Progress';
import { History, WorkoutDetail } from '../screens/History';
import { BodyWeightScreen } from '../screens/BodyWeight';
import { MeasurementsScreen } from '../screens/Measurements';
import { PhotosScreen } from '../screens/Photos';
import { Reviews, ReviewDetail, ReviewCompare } from '../screens/Reviews';
import { ReviewFlow } from '../screens/ReviewFlow';
import { Planner } from '../screens/Planner';
import { Profile, DataScreen, AboutScreen } from '../screens/Profile';
import { Onboarding } from '../screens/Onboarding';

const TABS = [
  { id: 'home', label: 'Inicio', path: '/', icon: House },
  { id: 'train', label: 'Entrenar', path: '/train', icon: Dumbbell },
  { id: 'routines', label: 'Rutinas', path: '/routines', icon: ClipboardList },
  { id: 'progress', label: 'Progreso', path: '/progress', icon: ChartColumn },
  { id: 'profile', label: 'Perfil', path: '/profile', icon: UserRound },
] as const;

function tabFor(seg: string | undefined): string {
  switch (seg) {
    case undefined:
      return 'home';
    case 'train':
    case 'workout':
    case 'plan':
      return 'train';
    case 'routines':
    case 'exercises':
      return 'routines';
    case 'progress':
    case 'history':
    case 'body':
    case 'reviews':
      return 'progress';
    case 'profile':
      return 'profile';
    default:
      return 'home';
  }
}

function Screen() {
  const { segments: s } = useRoute();
  const [a, b, c] = s;
  switch (a) {
    case undefined:
      return <Home />;
    case 'train':
      return <Train />;
    case 'workout':
      if (b && c === 'summary') return <WorkoutSummary id={b} />;
      return <WorkoutScreen />;
    case 'plan':
      return <Planner />;
    case 'routines':
      if (!b) return <Routines />;
      if (b === 'new') return <RoutineEditor id={null} />;
      if (c === 'edit') return <RoutineEditor id={b} />;
      return <RoutineDetail id={b} />;
    case 'exercises':
      if (!b) return <Exercises />;
      return <ExerciseDetail id={b} />;
    case 'progress':
      return <Progress />;
    case 'history':
      if (!b) return <History />;
      if (c === 'edit') return <WorkoutScreen editId={b} />;
      return <WorkoutDetail id={b} />;
    case 'body':
      if (b === 'measurements') return <MeasurementsScreen />;
      if (b === 'photos') return <PhotosScreen />;
      return <BodyWeightScreen />;
    case 'reviews':
      if (!b) return <Reviews />;
      if (b === 'new') return <ReviewFlow id={null} />;
      if (b === 'compare') return <ReviewCompare />;
      if (c === 'edit') return <ReviewFlow id={b} />;
      return <ReviewDetail id={b} />;
    case 'profile':
      if (b === 'data') return <DataScreen />;
      if (b === 'about') return <AboutScreen />;
      return <Profile />;
    default:
      return <Home />;
  }
}

function MiniWorkout() {
  const active = useQuery(getActiveWorkout, ['workouts']);
  useTick(1000, !!active);
  if (!active) return null;
  return (
    <button className="mini-workout" onClick={() => navigate('/workout')} aria-label="Volver al entrenamiento en curso">
      <Dumbbell size={20} />
      <span className="grow">
        <strong>{active.name}</strong>
        <small>{active.pausedAt ? 'En pausa · ' : 'En curso · '}{fmtDuration(workoutDurationMs(active))}</small>
      </span>
      <span className="strong">Continuar</span>
    </button>
  );
}

function UpdateBanner() {
  const [ready, setReady] = useState(false);
  useEffect(() => onUpdateAvailable(setReady), []);
  if (!ready) return null;
  return (
    <div className="update-banner" role="status">
      <span>Hay una nueva versión de DRAXIVO.</span>
      <button className="btn btn-sm btn-tinted" onClick={applyUpdate}>
        Actualizar
      </button>
    </div>
  );
}

function Shell() {
  const { settings } = useSettings();
  const { segments, path } = useRoute();
  const tab = tabFor(segments[0]);
  const fullscreen = segments[0] === 'workout' || (segments[0] === 'history' && segments[2] === 'edit');
  const active = useQuery(getActiveWorkout, ['workouts']);
  if (!settings.onboarded) return <Onboarding />;
  return (
    <div className="app">
      <main className={cx('main', fullscreen ? 'no-tabs' : active && 'has-mini')}>
        <Screen key={path} />
      </main>
      {!fullscreen && <MiniWorkout />}
      {!fullscreen && (
        <nav className="tabbar" aria-label="Navegación principal">
          {TABS.map((t) => (
            <a key={t.id} href={`#${t.path}`} className={cx('tab', tab === t.id && 'active')} aria-current={tab === t.id ? 'page' : undefined}>
              <t.icon size={24} strokeWidth={tab === t.id ? 2.3 : 1.7} />
              <span>{t.label}</span>
            </a>
          ))}
        </nav>
      )}
      <UpdateBanner />
    </div>
  );
}

export function App({ initialSettings }: { initialSettings: Settings }) {
  return (
    <SettingsProvider initial={initialSettings}>
      <ToastProvider>
        <ConfirmProvider>
          <Shell />
        </ConfirmProvider>
      </ToastProvider>
    </SettingsProvider>
  );
}
