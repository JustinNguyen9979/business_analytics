// FILE: frontend/vite.config.js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0', // Rất quan trọng: cho phép truy cập từ bên ngoài container
    port: 5173,      // Port Vite sẽ lắng nghe
    proxy: {
      // Bất kỳ request nào đến frontend bắt đầu bằng '/api'
      '/api': {
        // Sẽ được chuyển tiếp đến backend
        target: 'http://backend:8000',
        changeOrigin: true,
        // Xóa '/api' khỏi URL trước khi gửi đi
        // ví dụ: /api/brands -> /brands
        rewrite: (path) => path.replace(/^\/api/, ''),
      }
    }
  }
})