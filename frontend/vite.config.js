// FILE: frontend/vite.config.js
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const proxyTarget = env.VITE_API_PROXY_TARGET || 'http://localhost:8000'

  return {
    plugins: [react()],
    server: {
      host: '0.0.0.0',
      port: 5173,
      proxy: {
        '/api': {
          target: proxyTarget,
          changeOrigin: true,
        }
      },
      
      hmr: {
        port: 24678,
      },
      watch: {
        // usePolling: true,
      },

      allowedHosts: [
        'macbook-pro-ca-justin-2.tail2ab52c.ts.net',
        '.ngrok-free.app',
        '192.168.1.*',
        '192.168.100.*'
      ]
    },
    build: {
      target: 'esnext', // Build cho trình duyệt hiện đại (nhẹ hơn)
      minify: 'esbuild', // Minify nhanh hơn
      rollupOptions: {
        output: {
          manualChunks: {
            // Tách lõi React riêng
            'react-vendor': ['react', 'react-dom', 'react-router-dom'],
            // Tách MUI riêng (vì nó rất nặng)
            'mui-vendor': ['@mui/material', '@mui/icons-material', '@mui/x-date-pickers'],
          },
        },
      },
      chunkSizeWarningLimit: 2000,
    },
  }
})
