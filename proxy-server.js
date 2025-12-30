// ============================================
// ATLAN API PROXY SERVER
// Proxies requests to Atlan to avoid CORS issues
// Run with: node proxy-server.js
// ============================================

import express from 'express';
import cors from 'cors';

const app = express();
const PORT = process.env.PROXY_PORT || 3002;

// Enable CORS for the frontend (any localhost/127.0.0.1 Vite port)
const explicitAllowedOrigins = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
const originAllowlist = [
  /^http:\/\/localhost:\d+$/,
  /^http:\/\/127\.0\.0\.1:\d+$/,
  ...explicitAllowedOrigins.map((o) => new RegExp(`^${o.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`)),
];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    const allowed = originAllowlist.some((re) => re.test(origin));
    return callback(allowed ? null : new Error(`CORS blocked: ${origin}`), allowed);
  },
  credentials: true,
}));

// Parse JSON bodies
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Proxy middleware - handles all /proxy/* requests
app.use('/proxy', async (req, res) => {
  try {
    // Get target URL and API key from headers
    const atlanUrl = req.headers['x-atlan-url'];
    const apiKey = req.headers['x-atlan-api-key'];

    if (!atlanUrl) {
      return res.status(400).json({ error: 'Missing X-Atlan-URL header' });
    }

    if (!apiKey) {
      return res.status(400).json({ error: 'Missing X-Atlan-API-Key header' });
    }

    // Build the target URL from the original URL path after /proxy
    const path = req.originalUrl.replace('/proxy', '');
    const targetUrl = `${atlanUrl}${path}`;

    // Log request without sensitive data (API key)
    if (process.env.NODE_ENV === 'development') {
      console.log(`[Proxy] ${req.method} ${targetUrl}`);
    }

    // Forward the request
    const fetchOptions = {
      method: req.method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
    };

    // Include body for POST/PUT/PATCH
    if (['POST', 'PUT', 'PATCH'].includes(req.method) && req.body && Object.keys(req.body).length > 0) {
      fetchOptions.body = JSON.stringify(req.body);
    }

    // Apply a reasonable timeout to avoid hanging requests
    const controller = new AbortController();
    const timeoutMs = Number(process.env.PROXY_TIMEOUT_MS || 30_000);
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    const response = await fetch(targetUrl, { ...fetchOptions, signal: controller.signal });
    clearTimeout(timeout);

    // Get response data
    const contentType = response.headers.get('content-type');
    let data;

    if (contentType && contentType.includes('application/json')) {
      data = await response.json();
    } else {
      data = await response.text();

      // Check if we got an HTML page (likely auth redirect)
      if (data.includes('<!DOCTYPE') || data.includes('<html')) {
        console.error('[Proxy] Received HTML instead of JSON - likely auth issue or wrong URL');
        return res.status(401).json({
          error: 'Authentication failed or wrong Atlan URL',
          message: 'The server returned an HTML page instead of JSON. This usually means:\n' +
                   '1. Your Atlan URL is incorrect (should be https://yourcompany.atlan.com)\n' +
                   '2. Your API key is invalid or expired\n' +
                   '3. The API endpoint requires different authentication',
          hint: 'Make sure you\'re using your tenant-specific URL, not home.atlan.com'
        });
      }
    }

    // Log response summary for debugging (only in development)
    if (process.env.NODE_ENV === 'development' && typeof data === 'object' && data !== null) {
      const entityCount = data.entities?.length || 0;
      const aggKeys = data.aggregations ? Object.keys(data.aggregations) : [];
      if (entityCount > 0 || aggKeys.length > 0) {
        console.log(`[Proxy] Response: ${entityCount} entities, aggregations: [${aggKeys.join(', ')}]`);

        // Log first entity's fields to understand the schema
        if (data.entities?.length > 0) {
          const firstEntity = data.entities[0];
          const attrKeys = Object.keys(firstEntity.attributes || {}).slice(0, 15);
          console.log(`[Proxy] Sample entity type: ${firstEntity.typeName}, attrs: [${attrKeys.join(', ')}]`);
        }

        // Log aggregation buckets
        if (data.aggregations?.connections?.buckets?.length > 0) {
          console.log(`[Proxy] Found ${data.aggregations.connections.buckets.length} connection buckets`);
        }
      }
    }

    // Forward status and data
    res.status(response.status);

    if (typeof data === 'string') {
      res.send(data);
    } else {
      res.json(data);
    }

  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[Proxy Error]', message);
    res.status(500).json({
      error: 'Proxy request failed',
      message,
    });
  }
});

app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════════╗
║  Atlan API Proxy Server                        ║
║  Running on http://localhost:${PORT}              ║
║                                                ║
║  Endpoints:                                    ║
║  - GET  /health          Health check          ║
║  - ALL  /proxy/*         Proxy to Atlan        ║
║                                                ║
║  Required Headers:                             ║
║  - X-Atlan-URL: https://your-instance.atlan.com║
║  - X-Atlan-API-Key: your-api-key               ║
╚════════════════════════════════════════════════╝
  `);
});

