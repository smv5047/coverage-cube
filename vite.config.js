import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Relative asset paths so the build works under any sub-path (e.g. GitHub Pages).
  base: './',
  server: { host: true },
  build: { chunkSizeWarningLimit: 1600 },
});
