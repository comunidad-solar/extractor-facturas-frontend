import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const API_URL        = process.env.VITE_API_URL       || 'http://localhost:8000'
const CE_DETAIL_URL  = process.env.VITE_CE_DETAIL_URL || 'https://comunidades-energeticas-api-20084454554.catalystserverless.eu'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/facturas': API_URL,
      '/cups':     API_URL,
      '/enviar':   API_URL,
      '/ce-api': {
        target: CE_DETAIL_URL,
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/ce-api/, ''),
      },
    }
  }
})