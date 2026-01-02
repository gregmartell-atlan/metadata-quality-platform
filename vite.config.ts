import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
// Use host.docker.internal when running Vite in Docker, localhost otherwise
const PROXY_HOST = process.env.DOCKER_ENV ? 'host.docker.internal' : 'localhost';

export default defineConfig({
  plugins: [react()],
  resolve: {
    extensions: ['.tsx', '.ts', '.jsx', '.js', '.json'],
  },
  server: {
    proxy: {
      // Proxy /api/atlan/* requests to the local proxy server
      // The proxy server handles CORS and forwards to Atlan API
      '/api/atlan': {
        target: `http://${PROXY_HOST}:3002`,
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/atlan/, '/proxy/api'),
      },
    },
  },
})
