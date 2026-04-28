import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'https://collab-editor-qib6.onrender.com',
        changeOrigin: true,
      },
      '/ws': {
        target: 'wss://collab-editor-qib6.onrender.com',
        ws: true,
        changeOrigin: true,
      }
    }
  }
});