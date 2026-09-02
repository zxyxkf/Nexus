import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'path'
import packageJson from './package.json'

const devPort = Number(process.env.VITE_DEV_PORT || 5173)
const devApiTarget = process.env.VITE_DEV_API_TARGET || 'http://localhost:18632'

export default defineConfig({
  plugins: [vue()],
  base: './',
  define: {
    'import.meta.env.VITE_APP_VERSION': JSON.stringify(packageJson.version)
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src')
    }
  },
  server: {
    port: devPort,
    proxy: {
      '/api': {
        target: devApiTarget,
        changeOrigin: true
      },
      '/upload': {
        target: devApiTarget,
        changeOrigin: true
      },
      '/socket.io': {
        target: devApiTarget,
        ws: true,
        changeOrigin: true
      }
    }
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor': ['vue', 'vue-router', 'pinia', 'axios', 'echarts', 'element-plus']
        }
      }
    },
    chunkSizeWarningLimit: 1000
  }
})
