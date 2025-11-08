// FILE: frontend/vite.config.js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://backend:8000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      }
    },
    
    allowedHosts: [
      'macbook-pro-ca-justin-2.tail2ab52c.ts.net',
      '.ngrok-free.app',
      '192.168.1.*',
      '192.168.100.*'
    ]
  }
})