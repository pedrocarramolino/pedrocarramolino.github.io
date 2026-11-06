'use client';
import { useCallback, useEffect, useSyncExternalStore } from 'react';

export type ThemePref = 'light' | 'dark' | 'system';
const KEY = 'aula-theme';
const listeners = new Set<() => void>();

function read(): ThemePref {
  if (typeof window === 'undefined') return 'system';
  const v = localStorage.getItem(KEY);
  return v === 'light' || v === 'dark' ? v : 'system';
}
function systemDark() {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches;
}
function apply(pref: ThemePref) {
  const dark = pref === 'dark' || (pref === 'system' && systemDark());
  document.documentElement.classList.toggle('dark', dark);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#121214' : '#f7f7f5');
}

/** Preferencia de tema (se guarda en localStorage: solo preferencias de interfaz). */
export function useTheme() {
  const pref = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    read,
    () => 'system' as ThemePref,
  );
  useEffect(() => {
    apply(pref);
    if (pref !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const on = () => {
      apply('system');
      listeners.forEach((l) => l());
    };
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, [pref]);
  const setPref = useCallback((p: ThemePref) => {
    localStorage.setItem(KEY, p);
    apply(p);
    listeners.forEach((l) => l());
  }, []);
  const resolved: 'light' | 'dark' = pref === 'dark' || (pref === 'system' && systemDark()) ? 'dark' : 'light';
  return { pref, setPref, resolved };
}

/** Script que se ejecuta antes del primer pintado para evitar parpadeos. */
export const themeScript = `(function(){try{var p=localStorage.getItem('${KEY}');var d=p==='dark'||(p!=='light'&&matchMedia('(prefers-color-scheme: dark)').matches);if(d)document.documentElement.classList.add('dark')}catch(e){}})()`;
