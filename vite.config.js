import { defineConfig } from 'vite';

/** @type {import('vite').UserConfig} */
export default defineConfig({
  root: '.',
  publicDir: 'public',
  server: {
    port: 5500,
    strictPort: false,
  },
  preview: {
    port: 5500,
    strictPort: false,
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: './index.html',
    },
  },
});
