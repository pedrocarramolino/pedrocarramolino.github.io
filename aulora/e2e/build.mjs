// Compila la app con la configuración de .env.e2e (emuladores) sin tocar .env.local.
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
const vars = Object.fromEntries(
  readFileSync(new URL('../.env.e2e', import.meta.url), 'utf8')
    .split('\n')
    .filter((l) => l.trim() && !l.startsWith('#'))
    .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]),
);
const r = spawnSync('npx', ['next', 'build'], { stdio: 'inherit', env: { ...process.env, ...vars, NEXT_TELEMETRY_DISABLED: '1' } });
process.exit(r.status ?? 1);
