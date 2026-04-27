import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    outDir: 'dist',
    // No `rollupOptions.external` here: every dependency must be bundled
    // into the SPA, otherwise the browser cannot resolve workspace packages
    // like `@workspace/api-client-react`. The previous external list broke
    // production builds (it only "worked" because we never ran `vite build`
    // on Replit — the workflow uses `vite dev`).
  },
})
