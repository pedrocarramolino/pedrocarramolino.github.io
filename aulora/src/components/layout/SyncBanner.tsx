'use client';
import { AlertTriangle, CloudCheck, CloudOff, Loader2, RotateCw } from 'lucide-react';
import { cn } from '@/components/ui/cn';
import { useSyncStatus, type SyncStatus } from '@/lib/sync-status';
import { timeAgo } from '@/lib/dates';
import { compatConnection, enableCompatConnection, probeDataServer } from '@/lib/firebase';
import { useEffect, useState } from 'react';

const HINT = 'Si sigue igual, desactiva el bloqueador de anuncios, la VPN o el antivirus para esta web, o prueba con otro navegador o red.';

/** Reintenta: si la nube no responde, reconecta en modo compatible (más tolerante con redes y bloqueadores). */
export function retrySync(level: SyncStatus['level']) {
  if (level === 'stalled' || level === 'unreachable') enableCompatConnection();
  window.location.reload();
}

const plural = (n: number) => (n === 1 ? '1 cambio pendiente' : `${n} cambios pendientes`);

/** Textos del aviso según el estado de la sincronización. */
export function syncCopy(s: SyncStatus): { title: string; detail: string } | null {
  switch (s.level) {
    case 'error':
      return { title: 'Tus datos no se están guardando en la nube', detail: `${s.problem?.message ?? ''} Por ahora solo están en este dispositivo.` };
    case 'offline':
      return {
        title: 'Sin conexión',
        detail: `Tus cambios se guardan en este dispositivo y se subirán solos al volver la conexión${s.pending ? ` (${plural(s.pending)})` : ''}.`,
      };
    case 'stalled':
      return {
        title: 'Hay cambios sin guardar en la nube',
        detail: `${plural(s.pending)}. Se enviarán solos en cuanto se pueda; si tarda, pulsa «Reintentar» para reconectar. No cierres sesión hasta entonces.${compatConnection() ? ` ${HINT}` : ''}`,
      };
    case 'unreachable':
      return { title: 'No se puede conectar con la nube', detail: `Tus datos solo están en este dispositivo por ahora. Pulsa «Reintentar». ${HINT}` };
    default:
      return null;
  }
}

/** Aviso fijo bajo la cabecera cuando los datos no están llegando a la nube. */
export function SyncBanner() {
  const s = useSyncStatus();
  const copy = syncCopy(s);
  if (!copy) return null;
  const serious = s.level === 'error' || s.level === 'unreachable';
  const Icon = s.level === 'offline' ? CloudOff : AlertTriangle;
  return (
    <div
      role={serious ? 'alert' : 'status'}
      aria-live="polite"
      data-sync={s.level}
      className={cn(
        'animate-rise flex items-start gap-2.5 border-b px-4 py-2.5 text-sm md:px-6',
        serious ? 'border-danger/30 bg-danger-soft text-danger' : s.level === 'stalled' ? 'border-warning/30 bg-warning-soft text-warning' : 'border-border bg-surface-2 text-fg-2',
      )}
    >
      <Icon className="mt-0.5 size-4 shrink-0" />
      <div className="min-w-0 flex-1">
        <span className="font-semibold">{copy.title}.</span> <span className="opacity-90">{copy.detail}</span>
      </div>
      {serious || s.level === 'stalled' ? (
        <button onClick={() => retrySync(s.level)} className="flex shrink-0 items-center gap-1 rounded-md px-2 py-0.5 text-xs font-semibold hover:bg-black/5 dark:hover:bg-white/10">
          <RotateCw className="size-3.5" /> Reintentar
        </button>
      ) : null}
    </div>
  );
}

/** Estado compacto para Ajustes. */
export function SyncStatusRow() {
  const s = useSyncStatus();
  const copy = syncCopy(s);
  if (copy) {
    return (
      <div className={cn('flex items-start gap-2 text-sm', s.level === 'error' || s.level === 'unreachable' ? 'text-danger' : s.level === 'stalled' ? 'text-warning' : 'text-fg-2')}>
        <AlertTriangle className="mt-0.5 size-4 shrink-0" />
        <span>
          <strong>{copy.title}.</strong> {copy.detail}
        </span>
      </div>
    );
  }
  if (s.pending) {
    return (
      <div className="flex items-center gap-2 text-sm text-fg-2">
        <Loader2 className="size-4 animate-spin" /> Guardando en la nube…
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2 text-sm text-success">
      <CloudCheck className="size-4" />
      Todo guardado en la nube{s.lastSyncedAt ? ` · última sincronización ${timeAgo(new Date(s.lastSyncedAt).toISOString())}` : ''}
    </div>
  );
}

/** Detalles técnicos para diagnosticar problemas de sincronización (Ajustes). */
export function SyncDiagnostics() {
  const s = useSyncStatus();
  const version = process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? 'local';
  const [probe, setProbe] = useState<'…' | 'ok' | 'blocked' | 'timeout'>('…');
  const [compat, setCompat] = useState(false);
  useEffect(() => {
    setCompat(compatConnection());
    let alive = true;
    void probeDataServer().then((r) => alive && setProbe(r));
    return () => {
      alive = false;
    };
  }, []);
  const rows: [string, string][] = [
    ['Estado', { ok: 'Sincronizado', offline: 'Sin conexión', stalled: 'Cambios atascados', unreachable: 'Sin contacto con la nube', error: 'Error' }[s.level]],
    ['Cambios pendientes', String(s.pending)],
    ['Último contacto con la nube', s.lastSyncedAt ? new Date(s.lastSyncedAt).toLocaleString('es-ES') : 'Ninguno en esta sesión'],
    ['Conexión del dispositivo', typeof navigator !== 'undefined' && navigator.onLine ? 'Con conexión' : 'Sin conexión'],
    [
      'Acceso al servidor de datos',
      { '…': 'Comprobando…', ok: 'Accesible', blocked: 'Bloqueado por el navegador, una extensión o la red', timeout: 'No responde' }[probe],
    ],
    ['Modo de conexión', compat ? 'Compatible' : 'Normal'],
    ['Error', s.problem ? `${s.problem.code}: ${s.problem.message}` : '—'],
    ['Versión de la app', version],
  ];
  return (
    <details className="text-xs text-muted">
      <summary className="cursor-pointer select-none">Detalles de la sincronización</summary>
      <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
        {rows.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-muted">{k}</dt>
            <dd className="break-words text-fg-2">{v}</dd>
          </div>
        ))}
      </dl>
    </details>
  );
}
