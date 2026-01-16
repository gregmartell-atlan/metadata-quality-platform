import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
// Use host.docker.internal when running Vite in Docker, localhost otherwise
const PROXY_HOST = process.env.DOCKER_ENV ? 'host.docker.internal' : 'localhost';

export default defineConfig({
  plugins: [react()],
  // Base path for GitHub Pages deployment (e.g., /repo-name/)
  // Falls back to '/' for local development and other deployments
  base: process.env.VITE_BASE_PATH || '/',
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
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq, req) => {
            console.log(`[Vite Proxy] ${req.method} ${req.url} -> ${proxyReq.path}`);
            console.log(`[Vite Proxy] Headers forwarded:`, {
              'x-atlan-url': req.headers['x-atlan-url'] ? 'present' : 'MISSING',
              'x-atlan-api-key': req.headers['x-atlan-api-key'] ? 'present' : 'MISSING',
            });
          });
          proxy.on('error', (err) => {
            console.error('[Vite Proxy] Error:', err.message);
          });
        },
      },
      // Proxy /api/snowflake/* and /api/mdlh/* requests to the Python backend
      '/api/snowflake': {
        target: `http://${PROXY_HOST}:8000`,
        changeOrigin: true,
      },
      '/api/mdlh': {
        target: `http://${PROXY_HOST}:8000`,
        changeOrigin: true,
      },
    },
  },
})
