'use client';
import { useCallback, useEffect, useSyncExternalStore } from 'react';

export type ThemePref = 'light' | 'dark' | 'system';
const KEY = 'aulora-theme';
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
  document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
  syncThemeColor(dark);
}

export const THEME_COLORS = { light: '#f7f7f5', dark: '#121214' } as const;

/**
 * Pone el color de la barra de estado de iOS/Safari (theme-color).
 * Se sustituye la etiqueta por una nueva en lugar de cambiar su valor:
 * iOS (sobre todo en apps añadidas a la pantalla de inicio) solo repinta la
 * barra cuando aparece una etiqueta nueva.
 */
function syncThemeColor(dark: boolean) {
  const color = dark ? THEME_COLORS.dark : THEME_COLORS.light;
  const current = document.querySelectorAll('meta[name="theme-color"]');
  if (current.length === 1 && current[0].getAttribute('content') === color) return;
  current.forEach((m) => m.remove());
  const meta = document.createElement('meta');
  meta.name = 'theme-color';
  meta.content = color;
  document.head.appendChild(meta);
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
export const themeScript = `(function(){try{var p=localStorage.getItem('${KEY}');var d=p==='dark'||(p!=='light'&&matchMedia('(prefers-color-scheme: dark)').matches);var r=document.documentElement;if(d)r.classList.add('dark');r.style.colorScheme=d?'dark':'light';var m=document.createElement('meta');m.name='theme-color';m.content=d?'${THEME_COLORS.dark}':'${THEME_COLORS.light}';document.head.appendChild(m)}catch(e){}})()`;
