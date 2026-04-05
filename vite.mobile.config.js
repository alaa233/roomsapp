import { renameSync, existsSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const __dirname = dirname(fileURLToPath(import.meta.url));

/** Capacitor requires `index.html` in webDir; Vite names HTML from the source file (`child.html`). */
function renameChildHtmlToIndex() {
  return {
    name: 'rename-child-html-to-index',
    closeBundle() {
      const dir = join(__dirname, 'mobile', 'www');
      const from = join(dir, 'child.html');
      const to = join(dir, 'index.html');
      if (existsSync(from)) renameSync(from, to);
    },
  };
}

/** Vite build for Capacitor: single child page as index.html, relative asset paths. */
export default defineConfig({
  plugins: [renameChildHtmlToIndex()],
  envDir: __dirname,
  base: './',
  build: {
    target: 'es2022',
    outDir: 'mobile/www',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        index: resolve(__dirname, 'child.html'),
      },
    },
  },
  server: {
    port: 5174,
    proxy: {
      '/ws': {
        target: 'ws://127.0.0.1:3000',
        ws: true,
        changeOrigin: true,
      },
    },
  },
});
