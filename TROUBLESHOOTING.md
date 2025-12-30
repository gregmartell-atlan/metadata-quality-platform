# Troubleshooting Guide

## Common Issues

### 1. Proxy Server Not Running

**Error:** `ERR_CONNECTION_REFUSED` on port 3002

**Solution:**
```bash
npm run proxy
```

The proxy server must be running in a separate terminal window before connecting to Atlan.

### 2. Excessive Re-rendering

**Symptom:** Component mounting repeatedly in console

**Causes:**
- React Strict Mode (normal in development, won't happen in production)
- Browser cache (hard refresh: Ctrl+Shift+R or Cmd+Shift+R)

**Solution:**
- Hard refresh the browser
- The component is now memoized to prevent unnecessary re-renders

### 3. Atlan Connection Fails

**Error:** "Failed to connect to Atlan"

**Checklist:**
1. ✅ Proxy server is running (`npm run proxy`)
2. ✅ Atlan base URL is correct (e.g., `https://your-company.atlan.com`)
3. ✅ API key is valid and not expired
4. ✅ Network connection is working

### 4. Module Export Errors

**Error:** "does not provide an export named X"

**Solution:**
- Restart the Vite dev server
- Hard refresh the browser
- Clear browser cache

## Quick Start

1. **Start the proxy server:**
   ```bash
   npm run proxy
   ```

2. **Start the dev server (in another terminal):**
   ```bash
   npm run dev
   ```

3. **Open the app:**
   - Navigate to `http://localhost:5173`
   - Click "Connect to Atlan"
   - Enter your Atlan API key and base URL

## Environment Variables

Create a `.env` file (optional):
```env
VITE_PROXY_URL=http://localhost:3002
```

## Still Having Issues?

1. Check browser console for specific error messages
2. Verify proxy server is running on port 3002
3. Check network tab for failed requests
4. Restart both servers (proxy and dev)

