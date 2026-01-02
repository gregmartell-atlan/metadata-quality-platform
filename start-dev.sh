#!/bin/sh
# Start both the proxy server and Vite dev server concurrently

# Start proxy server in background
node proxy-server.js &
PROXY_PID=$!

# Start Vite dev server
npm run dev -- --host 0.0.0.0

# Cleanup on exit
trap "kill $PROXY_PID 2>/dev/null" EXIT
