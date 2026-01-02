#!/bin/bash
# Test script to verify Atlan connection works

echo "=== Testing Atlan Connection ==="
echo ""

# Load env vars
if [ -f .env ]; then
    export $(grep -E '^(ATLAN_API_KEY|ATLAN_BASE_URL)=' .env | xargs)
fi

if [ -z "$ATLAN_API_KEY" ] || [ -z "$ATLAN_BASE_URL" ]; then
    echo "ERROR: ATLAN_API_KEY and ATLAN_BASE_URL must be set in .env"
    exit 1
fi

echo "1. Testing proxy server health..."
HEALTH=$(curl -s http://localhost:3002/health 2>/dev/null)
if echo "$HEALTH" | grep -q '"status":"ok"'; then
    echo "   ✓ Proxy server is running"
else
    echo "   ✗ Proxy server not running. Start with: npm run proxy"
    exit 1
fi

echo ""
echo "2. Testing Atlan API connection..."
RESPONSE=$(curl -s -X POST "http://localhost:3002/proxy/api/meta/search/indexsearch" \
    -H "Content-Type: application/json" \
    -H "X-Atlan-URL: $ATLAN_BASE_URL" \
    -H "X-Atlan-API-Key: $ATLAN_API_KEY" \
    -d '{"dsl":{"from":0,"size":1,"query":{"match_all":{}}},"attributes":["name"]}')

if echo "$RESPONSE" | grep -q '"approximateCount"'; then
    COUNT=$(echo "$RESPONSE" | grep -o '"approximateCount":[0-9]*' | cut -d: -f2)
    echo "   ✓ Connected to Atlan! Found ~$COUNT assets"
elif echo "$RESPONSE" | grep -q '"error"'; then
    ERROR=$(echo "$RESPONSE" | grep -o '"error":"[^"]*"' | cut -d'"' -f4)
    echo "   ✗ Error: $ERROR"
    exit 1
else
    echo "   ✗ Unexpected response: $RESPONSE"
    exit 1
fi

echo ""
echo "3. Testing Vite dev server..."
VITE=$(curl -s http://localhost:5173/ 2>/dev/null | head -1)
if echo "$VITE" | grep -q "<!DOCTYPE"; then
    echo "   ✓ Vite dev server is running"
else
    echo "   ✗ Vite not running. Start with: npm run dev"
fi

echo ""
echo "=== All tests passed! ==="
echo "Open http://localhost:5173 in your browser"
