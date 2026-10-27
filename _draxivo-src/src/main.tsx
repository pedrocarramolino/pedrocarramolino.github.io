import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import { App } from './app/App';
import { getDB } from './db/database';
import { getSettings } from './db/repo';
import { setTimezone } from './lib/dates';
import { setUnits } from './lib/units';
import { applyTheme } from './app/context';
import { registerServiceWorker } from './app/pwa';

const root = createRoot(document.getElementById('root')!);

function Fatal({ error }: { error: unknown }) {
  return (
    <div className="onboard">
      <h1>No se pudo abrir el almacenamiento</h1>
      <p className="lead">
        DRAXIVO guarda tus datos en este dispositivo mediante IndexedDB y el navegador lo ha bloqueado. Puede ocurrir en modo privado o si el almacenamiento del sitio está desactivado.
      </p>
      <p className="lead mt">Detalle técnico: {error instanceof Error ? error.message : String(error)}</p>
      <div className="onboard-foot">
        <button className="btn btn-primary btn-lg btn-block" onClick={() => location.reload()}>
          Reintentar
        </button>
      </div>
    </div>
  );
}

async function boot() {
  try {
    await getDB();
    const settings = await getSettings();
    setTimezone(settings.timezone);
    setUnits(settings.weightUnit, settings.lengthUnit);
    applyTheme(settings.theme);
    root.render(
      <StrictMode>
        <App initialSettings={settings} />
      </StrictMode>,
    );
  } catch (e) {
    console.error(e);
    root.render(<Fatal error={e} />);
  }
}

boot();
registerServiceWorker();
