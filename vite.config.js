import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  build: {
    target: 'es2022',
    outDir: 'backend/public',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        child: resolve(__dirname, 'child.html'),
        parent: resolve(__dirname, 'parent.html'),
      },
    },
  },
  server: {
    proxy: {
      '/ws': {
        target: 'ws://127.0.0.1:3000',
        ws: true,
        changeOrigin: true,
      },
    },
  },
});
