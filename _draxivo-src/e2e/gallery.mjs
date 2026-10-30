// Capturas de la galería de ilustraciones con el servidor de desarrollo. Uso: node e2e/gallery.mjs [dark]
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
const { chromium } = createRequire(import.meta.url)('playwright');
const OUT = 'e2e/screens/gallery';
mkdirSync(OUT, { recursive: true });
const theme = process.argv[2] === 'dark' ? 'dark' : 'light';
const server = spawn('npx', ['vite', '--port', '4185', '--strictPort'], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 3000));
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1212, height: 900 }, deviceScaleFactor: 1 });
p.on('pageerror', (e) => console.log('pageerror', e.message));
for (let from = 0; from < 130; from += 30) {
  await p.goto(`http://localhost:4185/dev/gallery.html?from=${from}&count=30&theme=${theme}`);
  await p.waitForTimeout(800);
  await p.screenshot({ path: `${OUT}/${theme}-${from}.png`, fullPage: true });
}
await b.close();
server.kill();
console.log('ok');
