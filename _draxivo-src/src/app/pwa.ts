// Registro del service worker con estrategia de actualización controlada por el usuario.
type Listener = (ready: boolean) => void;
let waiting: ServiceWorker | null = null;
const listeners = new Set<Listener>();

function emit() {
  for (const l of listeners) l(!!waiting);
}

export function onUpdateAvailable(fn: Listener) {
  listeners.add(fn);
  fn(!!waiting);
  return () => {
    listeners.delete(fn);
  };
}

export function applyUpdate() {
  if (!waiting) return;
  waiting.postMessage({ type: 'SKIP_WAITING' });
}

export function registerServiceWorker() {
  if (!('serviceWorker' in navigator) || !import.meta.env.PROD) return;
  window.addEventListener('load', async () => {
    try {
      const reg = await navigator.serviceWorker.register('./sw.js', { scope: './' });
      const track = (sw: ServiceWorker | null) => {
        if (!sw) return;
        sw.addEventListener('statechange', () => {
          if (sw.state === 'installed' && navigator.serviceWorker.controller) {
            waiting = sw;
            emit();
          }
        });
      };
      if (reg.waiting && navigator.serviceWorker.controller) {
        waiting = reg.waiting;
        emit();
      }
      reg.addEventListener('updatefound', () => track(reg.installing));
      let reloading = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (reloading) return;
        reloading = true;
        location.reload();
      });
      // Comprueba actualizaciones al volver a la aplicación.
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') reg.update().catch(() => {});
      });
    } catch (e) {
      console.warn('Service worker no registrado', e);
    }
  });
}

export function isStandalone(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true;
}
