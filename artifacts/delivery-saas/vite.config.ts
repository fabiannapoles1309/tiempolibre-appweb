import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

const port = Number(process.env.PORT ?? 5173);

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@workspace/api-client-react': path.resolve(__dirname, '../../lib/api-client-react/src'),
    },
  },
  server: {
    host: '0.0.0.0',
    port,
    strictPort: true,
    allowedHosts: true,
  },
  preview: {
    host: '0.0.0.0',
    port,
    strictPort: true,
    allowedHosts: true,
  },
  build: {
    outDir: 'dist',
  },
});
