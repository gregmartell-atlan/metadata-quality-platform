/**
 * Tag Name Resolver Service
 *
 * Resolves classification type names to human-readable display names
 */

import { getAtlanConfig, getClassificationTypeDefs } from './api';

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
 * Uses centralized API function that routes through proxy
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
    // Fetch all definitions and find the one we need
    const allNames = await getClassificationTypeDefs();
    const displayName = allNames.get(typeName) || typeName;
    setCachedTagName(typeName, displayName);
    return displayName;
  } catch (error) {
    console.warn(`Failed to fetch tag display name for ${typeName}:`, error);
    setCachedTagName(typeName, typeName);
    return typeName;
  }
}

/**
 * Batch fetch all classification type definitions and cache them
 * Uses centralized API function that routes through proxy
 */
export async function fetchAllTagDisplayNames(): Promise<Map<string, string>> {
  const config = getAtlanConfig();
  if (!config) {
    console.log('[TagResolver] No Atlan config available');
    return new Map();
  }

  try {
    console.log('[TagResolver] Fetching classification type definitions via API...');
    const allNames = await getClassificationTypeDefs();
    console.log(`[TagResolver] Got ${allNames.size} classification type definitions`);

    // Cache all the names
    for (const [typeName, displayName] of allNames.entries()) {
      setCachedTagName(typeName, displayName);
    }

    return allNames;
  } catch (error) {
    console.warn('Failed to fetch all tag display names:', error);
    return new Map();
  }
}

/**
 * Resolve multiple tag type names to display names
 */
export async function resolveTagNames(typeNames: string[]): Promise<Map<string, string>> {
  console.log(`[TagResolver] Resolving ${typeNames.length} tag type names:`, typeNames.slice(0, 10));

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
    console.log(`[TagResolver] ${uncached.length} uncached tags, fetching definitions...`);
    const allNames = await fetchAllTagDisplayNames();
    console.log(`[TagResolver] Got ${allNames.size} definitions from API`);

    for (const typeName of uncached) {
      const displayName = allNames.get(typeName) || typeName;
      if (displayName !== typeName) {
        console.log(`[TagResolver] Resolved: ${typeName} -> ${displayName}`);
      } else {
        console.log(`[TagResolver] No display name found for: ${typeName}`);
      }
      result.set(typeName, displayName);
    }
  }

  console.log(`[TagResolver] Final resolution results:`, Object.fromEntries(result.entries()));
  return result;
}

/**
 * Clear tag name cache
 */
export function clearTagCache(): void {
  cache.clear();
}
