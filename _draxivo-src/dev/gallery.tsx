// Página de revisión visual de todas las ilustraciones (sólo en desarrollo: no se incluye en el build).
import { createRoot } from 'react-dom/client';
import '../src/styles.css';
import { seedExercises } from '../src/db/seedExercises';
import { ExerciseArt, templateKeyFor } from '../src/ui/ExerciseArt';

const params = new URLSearchParams(location.search);
if (params.get('theme')) document.documentElement.setAttribute('data-theme', params.get('theme')!);
const all = seedExercises();
const from = Number(params.get('from') ?? 0);
const count = Number(params.get('count') ?? 200);
const list = all.slice(from, from + count);
createRoot(document.getElementById('root')!).render(
  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, padding: 6, background: 'var(--bg)', width: 1200 }}>
    {list.map((e) => (
      <div key={e.id} style={{ background: 'var(--surface)', borderRadius: 10, padding: 6, display: 'flex', gap: 6, alignItems: 'center', color: 'var(--text)', font: '12px system-ui' }}>
        <ExerciseArt exercise={e} size={56} />
        <ExerciseArt exercise={e} size={130} pose="a" />
        <ExerciseArt exercise={e} size={130} pose="b" />
        <div style={{ minWidth: 0 }}>
          <b>{e.name}</b>
          <div style={{ opacity: 0.6 }}>{templateKeyFor(e)}</div>
        </div>
      </div>
    ))}
  </div>,
);
