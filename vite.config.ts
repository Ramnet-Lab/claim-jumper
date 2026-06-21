import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    open: false,
    proxy: {
      // On-demand TWI compute backend (pipeline/server.py).
      '/api': {
        target: 'http://127.0.0.1:8011',
        changeOrigin: true,
      },
    },
  },
})
