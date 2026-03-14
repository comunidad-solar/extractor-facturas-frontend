import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const API_URL = process.env.VITE_API_URL || 'http://localhost:8000'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/facturas': API_URL,
      '/cups':     API_URL,
      '/enviar':   API_URL,
      '/ce-api': {
        target: 'https://comunidades-energeticas-api-20084454554.catalystserverless.eu',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/ce-api/, ''),
      },
    }
  }
})