import { defineConfig } from 'vite';

/** @type {import('vite').UserConfig} */
export default defineConfig({
  root: '.',
  publicDir: 'public',
  appType: 'mpa',
  server: {
    host: '0.0.0.0',
    port: 5500,
    strictPort: true,
  },
  preview: {
    host: '0.0.0.0',
    port: 5500,
    strictPort: true,
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: './index.html',
    },
  },
});
