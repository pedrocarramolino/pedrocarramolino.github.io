import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import type { Settings } from '../db/types';
import { getSettings, updateSettings } from '../db/repo';
import { subscribe } from '../db/database';
import { setTimezone } from '../lib/dates';
import { setUnits } from '../lib/units';

interface Ctx {
  settings: Settings;
  update: (p: Partial<Settings>) => Promise<Settings>;
}

const SettingsCtx = createContext<Ctx | null>(null);

export function applyTheme(theme: Settings['theme']) {
  const root = document.documentElement;
  if (theme === 'auto') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', theme);
  const dark = theme === 'dark' || (theme === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.querySelector('meta[name="theme-color"]:not([media])')?.setAttribute('content', dark ? '#111216' : '#F5F5F7');
  try {
    localStorage.setItem('draxivo-theme', theme);
  } catch {
    /* almacenamiento no disponible */
  }
}

export function SettingsProvider({ initial, children }: { initial: Settings; children: ReactNode }) {
  const [settings, setSettings] = useState(initial);
  const apply = useCallback((s: Settings) => {
    setTimezone(s.timezone);
    setUnits(s.weightUnit, s.lengthUnit);
    applyTheme(s.theme);
    setSettings(s);
  }, []);
  useEffect(() => {
    apply(initial);
    return subscribe((stores) => {
      if (stores.has('settings')) getSettings().then(apply);
    });
  }, [apply, initial]);
  useEffect(() => {
    if (settings.theme !== 'auto') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const on = () => applyTheme('auto');
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, [settings.theme]);
  const update = useCallback(
    async (p: Partial<Settings>) => {
      const s = await updateSettings(p);
      apply(s);
      return s;
    },
    [apply],
  );
  return <SettingsCtx.Provider value={{ settings, update }}>{children}</SettingsCtx.Provider>;
}

export function useSettings() {
  const c = useContext(SettingsCtx);
  if (!c) throw new Error('SettingsProvider ausente');
  return c;
}

// ---------- Avisos (toasts) con acción opcional (p. ej. «Deshacer») ----------
interface Toast {
  id: number;
  message: string;
  action?: { label: string; run: () => void };
  tone?: 'default' | 'error';
}
interface ToastCtx {
  toast: (message: string, opts?: { action?: Toast['action']; tone?: Toast['tone']; duration?: number }) => void;
}
const ToastContext = createContext<ToastCtx | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const seq = useRef(0);
  const dismiss = (id: number) => setToasts((t) => t.filter((x) => x.id !== id));
  const toast = useCallback<ToastCtx['toast']>((message, opts = {}) => {
    const id = ++seq.current;
    setToasts((t) => [...t.slice(-2), { id, message, action: opts.action, tone: opts.tone }]);
    window.setTimeout(() => dismiss(id), opts.duration ?? (opts.action ? 6000 : 3200));
  }, []);
  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.tone === 'error' ? 'toast-error' : ''}`}>
            <span>{t.message}</span>
            {t.action && (
              <button
                className="toast-action"
                onClick={() => {
                  t.action!.run();
                  dismiss(t.id);
                }}
              >
                {t.action.label}
              </button>
            )}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const c = useContext(ToastContext);
  if (!c) throw new Error('ToastProvider ausente');
  return c.toast;
}
