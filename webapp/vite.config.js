import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Served by the app server at /web/..., the built files go to ../public-web (committed, so a git pull deploys them).
export default defineConfig({
  base: '/web/',
  plugins: [react()],
  build: { outDir: '../public-web', emptyOutDir: true, sourcemap: false },
  server: { port: 5173, proxy: { '/api': { target: process.env.API_TARGET || 'http://localhost:5000', changeOrigin: true, secure: true } } },
});
