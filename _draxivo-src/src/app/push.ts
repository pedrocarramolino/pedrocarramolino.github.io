// Avisos push de fin de descanso a través del servidor de DRAXIVO (función de Vercel).
// Solo se envía la suscripción push del dispositivo y la hora de fin del descanso;
// el servidor no guarda nada y el texto del aviso lo compone el propio dispositivo.

/** En Vercel la API está en el mismo origen; desde GitHub Pages se llama al despliegue de Vercel. */
export function pushEndpoint(): string {
  const host = location.hostname;
  if (/^draxivo-.*\.vercel\.app$/.test(host) || host === 'localhost' || host === '127.0.0.1') return '/api/rest-push';
  return 'https://draxivo-neon.vercel.app/api/rest-push';
}

/** Límite del servidor: descansos más largos solo usan el aviso local. */
export const MAX_PUSH_DELAY_MS = 290_000;

export function pushSupported(): boolean {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && import.meta.env.PROD;
}

/** Clave pública VAPID que publica el servidor (la privada nunca sale de él). */
async function serverKey(): Promise<string | null> {
  try {
    const r = await fetch(pushEndpoint(), { cache: 'no-store' });
    if (!r.ok) return null;
    const j = (await r.json()) as { publicKey?: string };
    return typeof j.publicKey === 'string' ? j.publicKey : null;
  } catch {
    return null;
  }
}

const sameKey = (a: ArrayBuffer | null | undefined, b: Uint8Array) => !!a && a.byteLength === b.byteLength && new Uint8Array(a).every((x, i) => x === b[i]);

function keyBytes(b64: string): Uint8Array<ArrayBuffer> {
  const pad = '='.repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

let cached: PushSubscription | null = null;
let failed = false;

/** Suscripción push del dispositivo; la crea si hace falta (requiere permiso concedido). */
export async function ensurePushSubscription(): Promise<PushSubscription | null> {
  if (!pushSupported() || Notification.permission !== 'granted' || failed) return cached;
  try {
    const reg = await navigator.serviceWorker.ready;
    const pub = await serverKey();
    if (!pub) return (cached = null);
    const key = keyBytes(pub);
    let sub = await reg.pushManager.getSubscription();
    // Si el servidor cambió de clave, la suscripción anterior ya no sirve.
    if (sub && !sameKey(sub.options.applicationServerKey, key)) {
      await sub.unsubscribe();
      sub = null;
    }
    if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
    cached = sub;
    return sub;
  } catch (e) {
    // Sin servicio push (p. ej. navegación privada): queda el aviso local.
    console.warn('Suscripción push no disponible', e);
    failed = true;
    cached = null;
    return null;
  }
}

const sentFor = new Set<number>();

/**
 * Pide al servidor el aviso para el descanso que termina en `endsAt`.
 * Se llama al pasar la app a segundo plano; usa sendBeacon para que salga aunque la página se congele.
 */
export function scheduleRestPush(endsAt: number): boolean {
  if (!cached || sentFor.has(endsAt)) return !!cached;
  const delay = endsAt - Date.now();
  if (delay <= 1500 || delay > MAX_PUSH_DELAY_MS) return false;
  const body = JSON.stringify({ subscription: cached.toJSON(), endsAt });
  const url = pushEndpoint();
  let ok = false;
  try {
    ok = navigator.sendBeacon?.(url, new Blob([body], { type: 'text/plain' })) ?? false;
  } catch {
    ok = false;
  }
  if (!ok) {
    fetch(url, { method: 'POST', body, keepalive: true, headers: { 'Content-Type': 'text/plain' } }).catch(() => {});
    ok = true;
  }
  sentFor.add(endsAt);
  return ok;
}
