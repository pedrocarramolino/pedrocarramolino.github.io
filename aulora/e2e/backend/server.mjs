// Backend local de pruebas compatible con el subconjunto de la API de Supabase
// que usa Aulora (Auth: signup/token/user/logout · PostgREST: CRUD + RPC).
//
// NO se usa en producción. Sirve para ejecutar pruebas E2E reales contra un
// Postgres local con la misma migración y la misma RLS que en Supabase:
// cada petición se ejecuta como rol `authenticated` con los claims del JWT.
//
//   DATABASE_URL=postgres://postgres:postgres@localhost:5432/aula_e2e node e2e/backend/server.mjs
import http from 'node:http';
import crypto from 'node:crypto';
import pg from 'pg';

const PORT = Number(process.env.PORT ?? 54321);
const SECRET = process.env.JWT_SECRET ?? 'aula-local-test-secret-aula-local-test-secret';
// Igual que PostgREST: las columnas date se devuelven como 'yyyy-MM-dd'
pg.types.setTypeParser(1082, (v) => v);
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL ?? 'postgres://postgres:postgres@localhost:5432/aula_e2e', max: 8 });

// ---------------------------------------------------------------- JWT (HS256)
const b64url = (buf) => Buffer.from(buf).toString('base64url');
function signJwt(payload) {
  const head = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = b64url(JSON.stringify(payload));
  const sig = crypto.createHmac('sha256', SECRET).update(`${head}.${body}`).digest('base64url');
  return `${head}.${body}.${sig}`;
}
function verifyJwt(token) {
  const [h, b, s] = String(token ?? '').split('.');
  if (!h || !b || !s) return null;
  const expected = crypto.createHmac('sha256', SECRET).update(`${h}.${b}`).digest('base64url');
  if (expected.length !== s.length || !crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(s))) return null;
  const payload = JSON.parse(Buffer.from(b, 'base64url').toString());
  if (payload.exp && payload.exp < Date.now() / 1000) return null;
  return payload;
}

// --------------------------------------------------------------- utilidades
function send(res, status, body, headers = {}) {
  const data = body === undefined ? '' : JSON.stringify(body);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'access-control-allow-origin': '*',
    'access-control-allow-headers': '*',
    'access-control-allow-methods': 'GET,POST,PATCH,PUT,DELETE,OPTIONS',
    'access-control-expose-headers': 'content-range',
    ...headers,
  });
  res.end(data);
}
async function readBody(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const raw = Buffer.concat(chunks).toString();
  return raw ? JSON.parse(raw) : undefined;
}
const ident = (name) => {
  if (!/^[a-z_][a-z0-9_]*$/i.test(name)) throw Object.assign(new Error(`Identificador no válido: ${name}`), { status: 400 });
  return `"${name}"`;
};
function hashPassword(pw, salt = crypto.randomBytes(16).toString('hex')) {
  return `${salt}:${crypto.scryptSync(pw, salt, 32).toString('hex')}`;
}
function checkPassword(pw, stored) {
  const [salt] = String(stored).split(':');
  return hashPassword(pw, salt) === stored;
}

// --------------------------------------------------------------------- auth
const refreshTokens = new Map();
function userJson(u) {
  return {
    id: u.id,
    aud: 'authenticated',
    role: 'authenticated',
    email: u.email,
    email_confirmed_at: u.created_at,
    user_metadata: u.raw_user_meta_data ?? {},
    app_metadata: { provider: 'email', providers: ['email'] },
    created_at: u.created_at,
    updated_at: u.created_at,
  };
}
function session(u) {
  const now = Math.floor(Date.now() / 1000);
  const access_token = signJwt({ sub: u.id, email: u.email, role: 'authenticated', aud: 'authenticated', iat: now, exp: now + 3600, session_id: crypto.randomUUID() });
  const refresh_token = crypto.randomBytes(24).toString('hex');
  refreshTokens.set(refresh_token, u.id);
  return { access_token, refresh_token, token_type: 'bearer', expires_in: 3600, expires_at: now + 3600, user: userJson(u) };
}
const authError = (res, status, code, msg) => send(res, status, { code: status, error_code: code, msg, message: msg });

async function handleAuth(req, res, url) {
  const route = url.pathname.replace('/auth/v1', '');
  if (route === '/signup' && req.method === 'POST') {
    const { email, password, data } = await readBody(req);
    if (!email || !password || password.length < 6) return authError(res, 422, 'weak_password', 'Password should be at least 6 characters.');
    const exists = await pool.query('select 1 from auth.users where email = $1', [email.toLowerCase()]);
    if (exists.rowCount) return authError(res, 422, 'user_already_exists', 'User already registered');
    const r = await pool.query('insert into auth.users (email, encrypted_password, raw_user_meta_data) values ($1, $2, $3) returning *', [email.toLowerCase(), hashPassword(password), data ?? {}]);
    return send(res, 200, session(r.rows[0]));
  }
  if (route === '/token' && req.method === 'POST') {
    const grant = url.searchParams.get('grant_type');
    const body = await readBody(req);
    if (grant === 'password') {
      const r = await pool.query('select * from auth.users where email = $1', [String(body.email).toLowerCase()]);
      if (!r.rowCount || !checkPassword(body.password, r.rows[0].encrypted_password)) return authError(res, 400, 'invalid_credentials', 'Invalid login credentials');
      return send(res, 200, session(r.rows[0]));
    }
    if (grant === 'refresh_token') {
      const uid = refreshTokens.get(body.refresh_token);
      if (!uid) return authError(res, 400, 'refresh_token_not_found', 'Invalid Refresh Token');
      const r = await pool.query('select * from auth.users where id = $1', [uid]);
      return send(res, 200, session(r.rows[0]));
    }
    return authError(res, 400, 'unsupported_grant_type', 'unsupported grant');
  }
  const claims = verifyJwt((req.headers.authorization ?? '').replace(/^Bearer /i, ''));
  if (route === '/user' && (req.method === 'GET' || req.method === 'PUT')) {
    if (!claims) return authError(res, 401, 'bad_jwt', 'invalid JWT');
    if (req.method === 'PUT') {
      const body = await readBody(req);
      if (body.password) await pool.query('update auth.users set encrypted_password = $2 where id = $1', [claims.sub, hashPassword(body.password)]);
      if (body.data) await pool.query('update auth.users set raw_user_meta_data = raw_user_meta_data || $2 where id = $1', [claims.sub, body.data]);
    }
    const r = await pool.query('select * from auth.users where id = $1', [claims.sub]);
    if (!r.rowCount) return authError(res, 403, 'user_not_found', 'User not found');
    return send(res, 200, userJson(r.rows[0]));
  }
  if (route === '/logout') return send(res, 204);
  if (route === '/recover') return send(res, 200, {});
  return authError(res, 404, 'not_found', 'not found');
}

// ---------------------------------------------------------------- PostgREST
function parseValueList(v) {
  // in.(a,b,"c d")
  const inner = v.replace(/^\(/, '').replace(/\)$/, '');
  return inner === '' ? [] : inner.split(',').map((x) => x.replace(/^"(.*)"$/, '$1'));
}
function filterSql(col, expr, params) {
  let negate = false;
  if (expr.startsWith('not.')) {
    negate = true;
    expr = expr.slice(4);
  }
  const dot = expr.indexOf('.');
  const op = expr.slice(0, dot);
  const val = expr.slice(dot + 1);
  const c = ident(col);
  const p = (v) => {
    params.push(v);
    return `$${params.length}`;
  };
  let sql;
  switch (op) {
    case 'eq': sql = `${c} = ${p(val)}`; break;
    case 'neq': sql = `${c} <> ${p(val)}`; break;
    case 'gt': sql = `${c} > ${p(val)}`; break;
    case 'gte': sql = `${c} >= ${p(val)}`; break;
    case 'lt': sql = `${c} < ${p(val)}`; break;
    case 'lte': sql = `${c} <= ${p(val)}`; break;
    case 'like': sql = `${c}::text like ${p(val.replaceAll('*', '%'))}`; break;
    case 'ilike': sql = `${c}::text ilike ${p(val.replaceAll('*', '%'))}`; break;
    case 'is': sql = `${c} is ${val === 'null' ? 'null' : val === 'true' ? 'true' : 'false'}`; break;
    case 'in': sql = `${c}::text = any(${p(parseValueList(val))}::text[])`; break;
    case 'cs': sql = `${c} @> ${p(val)}`; break;
    default: throw Object.assign(new Error(`Operador no soportado: ${op}`), { status: 400 });
  }
  return negate ? `not (${sql})` : sql;
}
function splitTopLevel(s) {
  const out = [];
  let depth = 0;
  let cur = '';
  let quoted = false;
  for (const ch of s) {
    if (ch === '"') quoted = !quoted;
    if (!quoted && ch === '(') depth++;
    if (!quoted && ch === ')') depth--;
    if (!quoted && ch === ',' && depth === 0) {
      out.push(cur);
      cur = '';
    } else cur += ch;
  }
  if (cur) out.push(cur);
  return out;
}
function orSql(expr, params) {
  // (a.eq.1,b.ilike.*x*,and(c.eq.1,d.eq.2))
  const parts = splitTopLevel(expr.replace(/^\(/, '').replace(/\)$/, ''));
  return '(' + parts.map((part) => {
    if (part.startsWith('and(')) return '(' + splitTopLevel(part.slice(4, -1)).map((x) => condSql(x, params)).join(' and ') + ')';
    return condSql(part, params);
  }).join(' or ') + ')';
}
function condSql(part, params) {
  const i = part.indexOf('.');
  return filterSql(part.slice(0, i), part.slice(i + 1), params);
}
const RESERVED = new Set(['select', 'order', 'limit', 'offset', 'on_conflict', 'columns']);
function whereClause(url, params) {
  const conds = [];
  for (const [k, v] of url.searchParams) {
    if (RESERVED.has(k)) continue;
    if (k === 'or') conds.push(orSql(v, params));
    else if (k === 'and') conds.push('(' + splitTopLevel(v.slice(1, -1)).map((x) => condSql(x, params)).join(' and ') + ')');
    else conds.push(filterSql(k, v, params));
  }
  return conds.length ? ` where ${conds.join(' and ')}` : '';
}
function selectList(url) {
  const sel = url.searchParams.get('select') ?? '*';
  if (sel === '*') return '*';
  return sel.split(',').map((c) => {
    if (c.includes('(')) throw Object.assign(new Error('Los embeds no están soportados en el backend de pruebas'), { status: 400 });
    return ident(c.trim());
  }).join(', ');
}
function orderClause(url) {
  const o = url.searchParams.get('order');
  if (!o) return '';
  return ' order by ' + o.split(',').map((part) => {
    const [col, ...mods] = part.split('.');
    let s = ident(col);
    if (mods.includes('desc')) s += ' desc';
    if (mods.includes('nullsfirst')) s += ' nulls first';
    if (mods.includes('nullslast')) s += ' nulls last';
    return s;
  }).join(', ');
}

async function withUser(req, fn) {
  const token = (req.headers.authorization ?? '').replace(/^Bearer /i, '');
  const claims = verifyJwt(token);
  const client = await pool.connect();
  try {
    await client.query('begin');
    if (claims) {
      await client.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify(claims)]);
      await client.query('set local role authenticated');
    } else {
      await client.query('set local role anon');
    }
    const out = await fn(client);
    await client.query('commit');
    return out;
  } catch (e) {
    await client.query('rollback').catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}

async function handleRest(req, res, url) {
  const route = url.pathname.replace('/rest/v1/', '');
  const prefer = req.headers.prefer ?? '';
  const wantsObject = (req.headers.accept ?? '').includes('vnd.pgrst.object+json');
  const returnRep = prefer.includes('return=representation');
  const countExact = prefer.includes('count=exact');

  const reply = (rows, status = 200, extra = {}) => {
    if (wantsObject) {
      if (rows.length !== 1) return send(res, 406, { code: 'PGRST116', details: `The result contains ${rows.length} rows`, hint: null, message: 'JSON object requested, multiple (or no) rows returned' });
      return send(res, status, rows[0], extra);
    }
    return send(res, status, rows, extra);
  };

  if (route.startsWith('rpc/')) {
    const fn = route.slice(4);
    const args = (req.method === 'GET' ? Object.fromEntries(url.searchParams) : await readBody(req)) ?? {};
    return withUser(req, async (db) => {
      const meta = await db.query(`select proretset, prorettype::regtype::text rt from pg_proc where proname = $1 and pronamespace = 'public'::regnamespace`, [fn]);
      if (!meta.rowCount) return send(res, 404, { code: 'PGRST202', message: `Could not find the function public.${fn}` });
      const params = [];
      // los argumentos se pasan como texto y se convierten al tipo declarado
      const types = await db.query(`select unnest(proargnames) n, unnest(proargtypes::oid[]::regtype[]::text[]) t from pg_proc where proname = $1 and pronamespace = 'public'::regnamespace`, [fn]);
      const typeOf = Object.fromEntries(types.rows.map((r) => [r.n, r.t]));
      const named = Object.entries(args).map(([k, v]) => {
        params.push(Array.isArray(v) ? v : v === null ? null : typeof v === 'object' ? JSON.stringify(v) : String(v));
        return `${ident(k)} => $${params.length}::${typeOf[k] ?? 'text'}`;
      });
      const call = `public.${ident(fn)}(${named.join(', ')})`;
      if (meta.rows[0].proretset) {
        const r = await db.query(`select * from ${call}`, params);
        return reply(r.rows);
      }
      const r = await db.query(`select ${call} as result`, params);
      return send(res, 200, r.rows[0].result);
    });
  }

  const table = ident(route);
  return withUser(req, async (db) => {
    const params = [];
    if (req.method === 'GET' || req.method === 'HEAD') {
      const where = whereClause(url, params);
      let sql = `select ${selectList(url)} from public.${table}${where}${orderClause(url)}`;
      const limit = url.searchParams.get('limit');
      const offset = url.searchParams.get('offset');
      if (limit) sql += ` limit ${Number(limit)}`;
      if (offset) sql += ` offset ${Number(offset)}`;
      const r = await db.query(sql, params);
      let extra = {};
      if (countExact) {
        const c = await db.query(`select count(*)::int n from public.${table}${where}`, params);
        extra = { 'content-range': `0-${Math.max(0, r.rowCount - 1)}/${c.rows[0].n}` };
      }
      if (req.method === 'HEAD') {
        res.writeHead(200, { 'content-range': extra['content-range'] ?? '*/*', 'access-control-expose-headers': 'content-range', 'access-control-allow-origin': '*' });
        return res.end();
      }
      return reply(r.rows, 200, extra);
    }
    if (req.method === 'POST') {
      const body = await readBody(req);
      const rows = Array.isArray(body) ? body : [body];
      if (!rows.length) return reply([], 201);
      const cols = [...new Set(rows.flatMap((r) => Object.keys(r)))];
      const colList = cols.map(ident).join(', ');
      params.push(JSON.stringify(rows));
      let sql = `insert into public.${table} (${colList}) select ${colList} from json_populate_recordset(null::public.${table}, $1)`;
      const onConflict = url.searchParams.get('on_conflict');
      if (prefer.includes('resolution=merge-duplicates')) {
        const target = (onConflict ?? 'id').split(',').map(ident).join(', ');
        sql += ` on conflict (${target}) do update set ${cols.map((c) => `${ident(c)} = excluded.${ident(c)}`).join(', ')}`;
      } else if (prefer.includes('resolution=ignore-duplicates')) {
        sql += ` on conflict${onConflict ? ` (${onConflict.split(',').map(ident).join(', ')})` : ''} do nothing`;
      }
      sql += ` returning ${selectList(url)}`;
      const r = await db.query(sql, params);
      return returnRep ? reply(r.rows, 201) : send(res, 201);
    }
    if (req.method === 'PATCH') {
      const body = await readBody(req);
      const cols = Object.keys(body);
      params.push(JSON.stringify(body));
      const colList = cols.map(ident).join(', ');
      const set = cols.length === 1 ? `${colList} = (select ${colList} from json_populate_record(null::public.${table}, $1))` : `(${colList}) = (select ${colList} from json_populate_record(null::public.${table}, $1))`;
      const sql = `update public.${table} set ${set}${whereClause(url, params)} returning ${selectList(url)}`;
      const r = await db.query(sql, params);
      return returnRep ? reply(r.rows) : send(res, 204);
    }
    if (req.method === 'DELETE') {
      const sql = `delete from public.${table}${whereClause(url, params)} returning ${selectList(url)}`;
      const r = await db.query(sql, params);
      return returnRep ? reply(r.rows) : send(res, 204);
    }
    return send(res, 405, { message: 'method not allowed' });
  });
}

function pgError(res, e) {
  const status = e.status ?? (e.code === '42501' ? 403 : e.code === '23505' ? 409 : e.code?.startsWith('23') ? 409 : 400);
  send(res, status, { code: e.code ?? 'PGRST000', message: e.message, details: e.detail ?? null, hint: e.hint ?? null });
}

http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  if (req.method === 'OPTIONS') return send(res, 204);
  try {
    if (url.pathname.startsWith('/auth/v1')) return await handleAuth(req, res, url);
    if (url.pathname.startsWith('/rest/v1/')) return await handleRest(req, res, url);
    if (url.pathname === '/health') return send(res, 200, { ok: true });
    send(res, 404, { message: 'not found' });
  } catch (e) {
    if (process.env.DEBUG) console.error(req.method, req.url, e.message);
    pgError(res, e);
  }
}).listen(PORT, () => console.log(`Backend de pruebas en http://localhost:${PORT}`));
