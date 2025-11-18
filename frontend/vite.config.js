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
    rollupOptions: {
      output: {
        manualChunks: {
          // Tách plotly.js và react-plotly.js ra thành một file chunk riêng
          // Giúp trình duyệt tải nhanh hơn và không phải tải lại nếu code chính thay đổi
          plotly: ['plotly.js', 'react-plotly.js'], 
        },
      },
    },
    // Tăng giới hạn cảnh báo kích thước file (vì plotly vẫn nặng) để không bị spam warning
    chunkSizeWarningLimit: 1600, 
  },
})