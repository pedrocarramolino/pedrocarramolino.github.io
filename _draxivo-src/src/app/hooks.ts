import { useCallback, useEffect, useRef, useState } from 'react';
import { subscribe, type StoreName } from '../db/database';

/**
 * Ejecuta una consulta asíncrona y la repite cuando cambian los almacenes indicados.
 * Devuelve `undefined` mientras carga por primera vez.
 */
export function useQuery<T>(fn: () => Promise<T>, stores: StoreName[], deps: unknown[] = []): T | undefined {
  const [data, setData] = useState<T | undefined>(undefined);
  const fnRef = useRef(fn);
  fnRef.current = fn;
  const storesKey = stores.join(',');
  const run = useCallback(() => {
    let alive = true;
    fnRef
      .current()
      .then((d) => alive && setData(d))
      .catch((e) => console.error('DRAXIVO consulta', e));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  useEffect(() => {
    let cancel = run();
    const watched = new Set(storesKey.split(','));
    const unsub = subscribe((changed) => {
      for (const s of changed) {
        if (watched.has(s)) {
          cancel();
          cancel = run();
          return;
        }
      }
    });
    return () => {
      cancel();
      unsub();
    };
  }, [run, storesKey]);
  return data;
}

/** Fuerza un re-render periódico (para temporizadores). */
export function useTick(ms: number, active = true) {
  const [, set] = useState(0);
  useEffect(() => {
    if (!active) return;
    const id = window.setInterval(() => set((n) => n + 1), ms);
    const vis = () => set((n) => n + 1);
    document.addEventListener('visibilitychange', vis);
    window.addEventListener('focus', vis);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', vis);
      window.removeEventListener('focus', vis);
    };
  }, [ms, active]);
}

export function useMediaQuery(q: string) {
  const [m, setM] = useState(() => (typeof window !== 'undefined' ? window.matchMedia(q).matches : false));
  useEffect(() => {
    const mq = window.matchMedia(q);
    const on = () => setM(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, [q]);
  return m;
}
