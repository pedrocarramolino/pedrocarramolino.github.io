// Genera los iconos PNG a partir del SVG del logotipo con el Chromium preinstalado.
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
import { readFileSync } from 'node:fs';

const svg = readFileSync('public/icons/icon.svg', 'utf8');
// Versión maskable: fondo completo y símbolo dentro de la zona segura (80 %).
const maskable = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" fill="#29323E"/><g transform="translate(76.8 76.8) scale(0.7)"><rect x="132" y="128" width="64" height="256" rx="10" fill="#E9EDF2"/><path d="M244 128 L380 256 L244 384" fill="none" stroke="#91B7E5" stroke-width="64"/></g></svg>`;
const fullBleed = svg.replace('rx="116"', 'rx="0"');
const jobs = [
  ['public/icons/icon-192.png', svg, 192],
  ['public/icons/icon-512.png', svg, 512],
  ['public/icons/maskable-512.png', maskable, 512],
  ['public/icons/apple-touch-icon.png', fullBleed, 180],
];
const browser = await chromium.launch();
const page = await browser.newPage();
for (const [out, src, size] of jobs) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<html><body style="margin:0;background:transparent">${src.replace('<svg ', `<svg width="${size}" height="${size}" `)}</body></html>`);
  await page.screenshot({ path: out, omitBackground: true, clip: { x: 0, y: 0, width: size, height: size } });
  console.log('ok', out);
}
await browser.close();
