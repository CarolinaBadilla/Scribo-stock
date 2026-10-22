// frontend/vite.config.js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.js',
  },
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      }
    }
  },
  build: {
    outDir: 'dist',
    sourcemap: false, // 🔒 Oculta el código fuente original en producción
    minify: 'esbuild', // Minificación eficiente de código
    rollupOptions: {
      output: {
        manualChunks: {
          // Separa librerías pesadas en un chunk independiente para mejor rendimiento y caché
          vendor: ['react', 'react-dom', 'react-router-dom', 'axios'],
          charts: ['recharts']
        }
      }
    }
  },
  base: '/',
});