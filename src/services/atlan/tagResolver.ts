/**
 * Tag Name Resolver Service
 *
 * Resolves classification type names to human-readable display names
 */

import { getAtlanConfig } from './api';
import { apiFetch } from '../../utils/apiClient';

const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

// Proxy server URL (must match api.ts)
const PROXY_URL = import.meta.env.VITE_PROXY_URL || 'http://localhost:3002';

interface CacheEntry {
  displayName: string;
  timestamp: number;
}

const cache = new Map<string, CacheEntry>();

/**
 * Get cached tag display name if still valid
 */
function getCachedTagName(typeName: string): string | null {
  const entry = cache.get(typeName);
  if (entry && Date.now() - entry.timestamp < CACHE_TTL) {
    return entry.displayName;
  }
  cache.delete(typeName);
  return null;
}

/**
 * Store tag display name in cache
 */
function setCachedTagName(typeName: string, displayName: string): void {
  cache.set(typeName, { displayName, timestamp: Date.now() });
}

/**
 * Fetch classification type definition to get display name
 * Routes through the proxy to avoid CORS issues
 */
export async function fetchTagDisplayName(typeName: string): Promise<string> {
  // Check cache first
  const cached = getCachedTagName(typeName);
  if (cached) {
    return cached;
  }

  const config = getAtlanConfig();
  if (!config) {
    // Return typeName as fallback
    return typeName;
  }

  try {
    // Fetch classification type definition through proxy
    const proxyUrl = `${PROXY_URL}/proxy/api/meta/types/typedefs?type=classification`;
    const response = await apiFetch<{ classificationDefs?: Array<{ name: string; displayName?: string }> }>(proxyUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-Atlan-URL': config.baseUrl,
        'X-Atlan-API-Key': config.apiKey,
      },
    });

    if (response.error || !response.data) {
      console.warn(`Failed to fetch classification types: ${response.error || 'No data'}`);
      setCachedTagName(typeName, typeName);
      return typeName;
    }

    // Find the classification type definition
    const classificationDefs = response.data.classificationDefs || [];
    for (const def of classificationDefs) {
      if (def.name === typeName) {
        const displayName = def.displayName || def.name;
        setCachedTagName(typeName, displayName);
        return displayName;
      }
    }

    // If not found, use typeName as fallback
    setCachedTagName(typeName, typeName);
    return typeName;
  } catch (error) {
    console.warn(`Failed to fetch tag display name for ${typeName}:`, error);
    setCachedTagName(typeName, typeName);
    return typeName;
  }
}

/**
 * Batch fetch all classification type definitions and cache them
 * Routes through the proxy to avoid CORS issues
 */
export async function fetchAllTagDisplayNames(): Promise<Map<string, string>> {
  const config = getAtlanConfig();
  if (!config) {
    return new Map();
  }

  try {
    // Fetch through proxy to avoid CORS
    const proxyUrl = `${PROXY_URL}/proxy/api/meta/types/typedefs?type=classification`;
    const response = await apiFetch<{ classificationDefs?: Array<{ name: string; displayName?: string }> }>(proxyUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-Atlan-URL': config.baseUrl,
        'X-Atlan-API-Key': config.apiKey,
      },
    });

    if (response.error || !response.data) {
      console.warn(`Failed to fetch classification types: ${response.error || 'No data'}`);
      return new Map();
    }

    const result = new Map<string, string>();

    const classificationDefs = response.data.classificationDefs || [];
    for (const def of classificationDefs) {
      const typeName = def.name;
      const displayName = def.displayName || def.name;
      result.set(typeName, displayName);
      setCachedTagName(typeName, displayName);
    }

    return result;
  } catch (error) {
    console.warn('Failed to fetch all tag display names:', error);
    return new Map();
  }
}

/**
 * Resolve multiple tag type names to display names
 */
export async function resolveTagNames(typeNames: string[]): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  const uncached: string[] = [];

  // Check cache for each typeName
  for (const typeName of typeNames) {
    const cached = getCachedTagName(typeName);
    if (cached) {
      result.set(typeName, cached);
    } else {
      uncached.push(typeName);
    }
  }

  // If we have uncached items, fetch all definitions (more efficient than individual lookups)
  if (uncached.length > 0) {
    const allNames = await fetchAllTagDisplayNames();
    for (const typeName of uncached) {
      const displayName = allNames.get(typeName) || typeName;
      result.set(typeName, displayName);
    }
  }

  return result;
}

/**
 * Clear tag name cache
 */
export function clearTagCache(): void {
  cache.clear();
}
