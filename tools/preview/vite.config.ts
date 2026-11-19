import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Baut die Vorschau (ohne Service Worker, mit In-Memory-Speicher). Danach fügt inline.mjs alles in eine HTML-Datei.
const here = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  root: here,
  base: './',
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { 'virtual:pwa-register/react': fileURLToPath(new URL('./pwa-register-stub.ts', import.meta.url)) },
  },
  build: {
    outDir: fileURLToPath(new URL('../../dist-preview/build', import.meta.url)),
    emptyOutDir: true,
    target: 'es2022',
    modulePreload: false,
    rolldownOptions: { output: { codeSplitting: false } },
    chunkSizeWarningLimit: 2000,
  },
});
