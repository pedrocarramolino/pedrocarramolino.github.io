// GET /api/rest-push — clave pública VAPID para suscribirse.
// POST /api/rest-push — programa el aviso push de fin de descanso.
// Cuerpo: { subscription, endsAt }. No se guarda ningún dato: la función espera y envía.
import type { IncomingMessage, ServerResponse } from 'node:http';
import webpush from 'web-push';
import { waitUntil } from '@vercel/functions';

/** Espera máxima: la función de Vercel dura como mucho 300 s. */
export const MAX_DELAY_MS = 290_000;

/** Orígenes desde los que se sirve la app. */
export const ALLOWED_ORIGINS = ['https://pedrocarramolino.github.io', 'https://draxivo-neon.vercel.app'];

/** Servicios push de los navegadores (Chrome/Android, Firefox, Safari/iOS, Edge). */
const PUSH_HOSTS = [/^fcm\.googleapis\.com$/, /^updates\.push\.services\.mozilla\.com$/, /^web\.push\.apple\.com$/, /^[a-z0-9-]+\.notify\.windows\.com$/];

export interface PushSubscriptionJSON {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

export interface RestPushRequest {
  subscription: PushSubscriptionJSON;
  endsAt: number;
}

export function isAllowedOrigin(origin: string | undefined): boolean {
  if (!origin) return false;
  if (ALLOWED_ORIGINS.includes(origin)) return true;
  // Despliegues de vista previa del proyecto.
  return /^https:\/\/draxivo-[a-z0-9-]+\.vercel\.app$/.test(origin);
}

const B64URL = /^[A-Za-z0-9_-]+={0,2}$/;

/** Devuelve la petición validada o un mensaje de error. */
export function parseRestPush(body: unknown, now = Date.now()): { ok: true; value: RestPushRequest; delayMs: number } | { ok: false; error: string } {
  let data = body;
  if (typeof data === 'string') {
    try {
      data = JSON.parse(data);
    } catch {
      return { ok: false, error: 'JSON no válido' };
    }
  }
  if (!data || typeof data !== 'object') return { ok: false, error: 'Cuerpo vacío' };
  const { subscription, endsAt } = data as Partial<RestPushRequest>;
  if (typeof endsAt !== 'number' || !Number.isFinite(endsAt)) return { ok: false, error: 'endsAt no válido' };
  const delayMs = Math.round(endsAt - now);
  if (delayMs < -5_000) return { ok: false, error: 'El descanso ya terminó' };
  if (delayMs > MAX_DELAY_MS) return { ok: false, error: 'Descanso demasiado largo' };
  if (!subscription || typeof subscription.endpoint !== 'string' || subscription.endpoint.length > 1024) return { ok: false, error: 'Suscripción no válida' };
  let url: URL;
  try {
    url = new URL(subscription.endpoint);
  } catch {
    return { ok: false, error: 'Suscripción no válida' };
  }
  if (url.protocol !== 'https:' || !PUSH_HOSTS.some((h) => h.test(url.hostname))) return { ok: false, error: 'Servicio push no admitido' };
  const k = subscription.keys;
  if (!k || typeof k.p256dh !== 'string' || typeof k.auth !== 'string' || !B64URL.test(k.p256dh) || !B64URL.test(k.auth) || k.p256dh.length > 200 || k.auth.length > 64)
    return { ok: false, error: 'Claves no válidas' };
  return { ok: true, value: { subscription: { endpoint: subscription.endpoint, keys: { p256dh: k.p256dh, auth: k.auth } }, endsAt }, delayMs: Math.max(0, delayMs) };
}

type Req = IncomingMessage & { body?: unknown };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function readBody(req: Req): Promise<unknown> {
  if (req.body !== undefined) return Promise.resolve(req.body);
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (c) => {
      raw += c;
      if (raw.length > 8192) reject(new Error('too large'));
    });
    req.on('end', () => resolve(raw));
    req.on('error', reject);
  });
}

function send(res: ServerResponse, status: number, body?: object) {
  res.statusCode = status;
  if (body) {
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(body));
  } else res.end();
}

export default async function handler(req: Req, res: ServerResponse) {
  const origin = req.headers.origin;
  if (isAllowedOrigin(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin!);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  }
  if (req.method === 'OPTIONS') return send(res, 204);
  const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT } = process.env;
  const configured = !!VAPID_PUBLIC_KEY && !!VAPID_PRIVATE_KEY;
  if (req.method === 'GET') return configured ? send(res, 200, { publicKey: VAPID_PUBLIC_KEY }) : send(res, 503, { error: 'Push no configurado' });
  if (req.method !== 'POST') return send(res, 405, { error: 'Método no permitido' });
  if (!isAllowedOrigin(origin)) return send(res, 403, { error: 'Origen no permitido' });
  if (!configured) return send(res, 503, { error: 'Push no configurado' });

  let body: unknown;
  try {
    body = await readBody(req);
  } catch {
    return send(res, 413, { error: 'Cuerpo demasiado grande' });
  }
  const parsed = parseRestPush(body);
  if (!parsed.ok) return send(res, 400, { error: parsed.error });

  webpush.setVapidDetails(VAPID_SUBJECT || 'https://draxivo-neon.vercel.app', VAPID_PUBLIC_KEY!, VAPID_PRIVATE_KEY!);
  const { subscription, endsAt } = parsed.value;
  waitUntil(
    sleep(parsed.delayMs)
      .then(() => webpush.sendNotification(subscription, JSON.stringify({ type: 'rest', endsAt }), { TTL: 120, urgency: 'high', topic: 'rest' }))
      .catch((e: { statusCode?: number }) => console.warn('push no enviado', e?.statusCode ?? e)),
  );
  return send(res, 202, { scheduledInMs: parsed.delayMs });
}
