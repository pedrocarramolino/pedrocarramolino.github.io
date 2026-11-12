import { describe, expect, it } from 'vitest';
import { isAllowedOrigin, parseRestPush, MAX_DELAY_MS } from '../../api/rest-push';

const sub = { endpoint: 'https://fcm.googleapis.com/fcm/send/abc123', keys: { p256dh: 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U', auth: 'tBHItJI5svbpez7KI4CCXg' } };

describe('servidor de avisos de descanso', () => {
  const now = 1_000_000;
  it('acepta una petición válida y calcula la espera', () => {
    const r = parseRestPush(JSON.stringify({ subscription: sub, endsAt: now + 90_000 }), now);
    expect(r.ok && r.delayMs).toBe(90_000);
  });
  it('acepta suscripciones de Safari/iOS y Firefox', () => {
    for (const endpoint of ['https://web.push.apple.com/QH8x', 'https://updates.push.services.mozilla.com/wpush/v2/x'])
      expect(parseRestPush({ subscription: { ...sub, endpoint }, endsAt: now + 1000 }, now).ok).toBe(true);
  });
  it('rechaza servicios push desconocidos, http y claves raras', () => {
    expect(parseRestPush({ subscription: { ...sub, endpoint: 'https://evil.example.com/x' }, endsAt: now + 1000 }, now).ok).toBe(false);
    expect(parseRestPush({ subscription: { ...sub, endpoint: 'http://fcm.googleapis.com/x' }, endsAt: now + 1000 }, now).ok).toBe(false);
    expect(parseRestPush({ subscription: { ...sub, keys: { p256dh: '<script>', auth: 'x' } }, endsAt: now + 1000 }, now).ok).toBe(false);
  });
  it('rechaza descansos demasiado largos o ya terminados', () => {
    expect(parseRestPush({ subscription: sub, endsAt: now + MAX_DELAY_MS + 1 }, now).ok).toBe(false);
    expect(parseRestPush({ subscription: sub, endsAt: now - 60_000 }, now).ok).toBe(false);
    expect(parseRestPush('no-json', now).ok).toBe(false);
  });
  it('solo admite los orígenes de la app', () => {
    expect(isAllowedOrigin('https://pedrocarramolino.github.io')).toBe(true);
    expect(isAllowedOrigin('https://draxivo-neon.vercel.app')).toBe(true);
    expect(isAllowedOrigin('https://draxivo-abc123-pedrocarramolinos-projects.vercel.app')).toBe(true);
    expect(isAllowedOrigin('https://example.com')).toBe(false);
    expect(isAllowedOrigin(undefined)).toBe(false);
  });
});

describe('función /api/rest-push', () => {
  it('responde 202, permite CORS y envía el push al terminar la espera', async () => {
    const { vi } = await import('vitest');
    vi.resetModules();
    const sent: unknown[][] = [];
    const pending: Promise<unknown>[] = [];
    vi.doMock('web-push', () => ({ default: { setVapidDetails: () => {}, sendNotification: async (...a: unknown[]) => void sent.push(a) } }));
    vi.doMock('@vercel/functions', () => ({ waitUntil: (p: Promise<unknown>) => void pending.push(p) }));
    process.env.VAPID_PUBLIC_KEY = 'pub';
    process.env.VAPID_PRIVATE_KEY = 'priv';
    const { default: handler } = await import('../../api/rest-push');
    const call = async (method: string, origin: string, body?: unknown) => {
      const headers: Record<string, string> = {};
      const res = { statusCode: 0, body: '', setHeader: (k: string, v: string) => void (headers[k] = v), end: (b?: string) => void (res.body = b ?? '') };
      await handler({ method, headers: { origin }, body } as never, res as never);
      return { status: res.statusCode, headers, json: res.body ? JSON.parse(res.body) : null };
    };
    const pre = await call('OPTIONS', 'https://pedrocarramolino.github.io');
    expect(pre.status).toBe(204);
    expect(pre.headers['Access-Control-Allow-Origin']).toBe('https://pedrocarramolino.github.io');
    const key = await call('GET', 'https://pedrocarramolino.github.io');
    expect(key.status).toBe(200);
    expect(key.json).toEqual({ publicKey: 'pub' });
    expect((await call('POST', 'https://example.com', '{}')).status).toBe(403);
    expect((await call('POST', 'https://pedrocarramolino.github.io', '{"x":1}')).status).toBe(400);
    const endsAt = Date.now() + 50;
    const ok = await call('POST', 'https://pedrocarramolino.github.io', JSON.stringify({ subscription: sub, endsAt }));
    expect(ok.status).toBe(202);
    expect(sent).toHaveLength(0);
    await Promise.all(pending);
    expect(sent).toHaveLength(1);
    expect(JSON.parse(sent[0][1] as string)).toEqual({ type: 'rest', endsAt });
  });
});
