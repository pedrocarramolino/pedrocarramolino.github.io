import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync } from 'node:fs';

/** Genera el service worker con la lista de archivos del build y una versión única. */
function serviceWorker(): Plugin {
  return {
    name: 'draxivo-sw',
    apply: 'build',
    generateBundle(_, bundle) {
      const assets = Object.keys(bundle).filter((f) => !f.endsWith('.map'));
      const extra = ['./', 'index.html', 'manifest.webmanifest', 'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png', 'icons/maskable-512.png'];
      const version = Date.now().toString(36);
      const src = readFileSync('sw-template.js', 'utf8')
        .replace('__VERSION__', version)
        .replace('__PRECACHE__', JSON.stringify([...new Set([...extra, ...assets])]));
      this.emitFile({ type: 'asset', fileName: 'sw.js', source: src });
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [react(), serviceWorker()],
  build: { target: 'es2020', sourcemap: false, chunkSizeWarningLimit: 800 },
  test: { environment: 'node', setupFiles: ['./src/test/setup.ts'] },
} as never);
