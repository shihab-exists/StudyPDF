import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// No dev proxy: the app is 100% client-side. The only backend is the optional
// serverless smoke-test at /api/health on Vercel.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    allowedHosts: true,
  },
  preview: {
    host: '0.0.0.0',
    port: 3000,
    strictPort: true,
    allowedHosts: true,
  },
  build: {
    outDir: 'dist',
    chunkSizeWarningLimit: 1400,
  },
});
