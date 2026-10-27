// Enrutado mínimo basado en hash: funciona en cualquier alojamiento estático sin reescrituras.
import { useSyncExternalStore } from 'react';

function current(): string {
  const h = window.location.hash.replace(/^#/, '');
  return h || '/';
}

function subscribe(cb: () => void) {
  window.addEventListener('hashchange', cb);
  return () => window.removeEventListener('hashchange', cb);
}

export interface Route {
  path: string;
  segments: string[];
  query: URLSearchParams;
}

export function parse(full: string): Route {
  const [path, qs] = full.split('?');
  return { path, segments: path.split('/').filter(Boolean), query: new URLSearchParams(qs ?? '') };
}

export function useRoute(): Route {
  const full = useSyncExternalStore(subscribe, current, () => '/');
  return parse(full);
}

export function navigate(to: string, opts: { replace?: boolean } = {}) {
  const target = '#' + to;
  if (opts.replace) {
    window.history.replaceState(window.history.state, '', target);
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  } else {
    window.location.hash = to;
  }
  window.scrollTo({ top: 0 });
}

/** Vuelve atrás si hay historial dentro de la app; si no, navega a la ruta de respaldo. */
export function goBack(fallback: string) {
  const depth = (window.history.state as { depth?: number } | null)?.depth ?? 0;
  if (depth > 0) window.history.back();
  else navigate(fallback, { replace: true });
}

// Registra la profundidad para saber si "atrás" sigue dentro de la aplicación.
if (typeof window !== 'undefined') {
  let depth = (window.history.state as { depth?: number } | null)?.depth ?? 0;
  if (window.history.state?.depth == null) window.history.replaceState({ depth: 0 }, '');
  window.addEventListener('hashchange', () => {
    const st = window.history.state as { depth?: number } | null;
    if (st && typeof st.depth === 'number') {
      depth = st.depth;
    } else {
      depth += 1;
      window.history.replaceState({ depth }, '');
    }
  });
}
