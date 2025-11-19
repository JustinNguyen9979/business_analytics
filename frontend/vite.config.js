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
          // Tách Plotly riêng (Cái này quan trọng nhất)
          'plotly-vendor': ['plotly.js', 'react-plotly.js'],
          // Tách Map riêng
          'map-vendor': ['@vnedyalk0v/react19-simple-maps', 'd3-geo', 'd3-scale'],
        },
      },
    },
    chunkSizeWarningLimit: 2000,
  },
})