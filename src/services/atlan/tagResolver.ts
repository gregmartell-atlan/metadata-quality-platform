/**
 * Tag Name Resolver Service
 *
 * Resolves classification type names to human-readable display names
 */

import { getAtlanConfig } from './api';

const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

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
    // Fetch classification type definition
    const response = await fetch(`${config.baseUrl}/api/meta/types/typedefs?type=classification`, {
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      console.warn(`Failed to fetch classification types: ${response.status}`);
      setCachedTagName(typeName, typeName);
      return typeName;
    }

    const data = await response.json();

    // Find the classification type definition
    const classificationDefs = data.classificationDefs || [];
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
 */
export async function fetchAllTagDisplayNames(): Promise<Map<string, string>> {
  const config = getAtlanConfig();
  if (!config) {
    return new Map();
  }

  try {
    const response = await fetch(`${config.baseUrl}/api/meta/types/typedefs?type=classification`, {
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      console.warn(`Failed to fetch classification types: ${response.status}`);
      return new Map();
    }

    const data = await response.json();
    const result = new Map<string, string>();

    const classificationDefs = data.classificationDefs || [];
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
