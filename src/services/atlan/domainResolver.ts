/**
 * Domain Resolver Service
 * 
 * Resolves domain GUIDs to domain names for pivot views
 */

import { getAsset } from './api';
import type { AtlanAsset } from '../types';

const domainCache = new Map<string, string>();
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

interface CacheEntry {
  name: string;
  timestamp: number;
}

const cache = new Map<string, CacheEntry>();

/**
 * Get cached domain name if still valid
 */
function getCachedDomain(guid: string): string | null {
  const entry = cache.get(guid);
  if (entry && Date.now() - entry.timestamp < CACHE_TTL) {
    return entry.name;
  }
  cache.delete(guid);
  return null;
}

/**
 * Store domain name in cache
 */
function setCachedDomain(guid: string, name: string): void {
  cache.set(guid, { name, timestamp: Date.now() });
}

/**
 * Fetch domain name from GUID
 */
export async function fetchDomainName(guid: string): Promise<string> {
  // Check cache first
  const cached = getCachedDomain(guid);
  if (cached) {
    return cached;
  }

  try {
    // Fetch domain entity by GUID
    // Domains in Atlan are typically of type "DataDomain" or "DataProduct"
    const domain = await getAsset(guid, ['name', 'displayName']);
    
    if (domain) {
      const name = domain.name || `Domain ${guid.slice(0, 8)}`;
      setCachedDomain(guid, name);
      return name;
    }
    
    // Fallback: return truncated GUID
    const fallback = `Domain ${guid.slice(0, 8)}`;
    setCachedDomain(guid, fallback);
    return fallback;
  } catch (error) {
    console.warn(`Failed to fetch domain name for ${guid}:`, error);
    // Return fallback
    const fallback = `Domain ${guid.slice(0, 8)}`;
    setCachedDomain(guid, fallback);
    return fallback;
  }
}

/**
 * Batch fetch domain names for multiple GUIDs
 */
export async function fetchDomainNames(guids: string[]): Promise<Map<string, string>> {
  const results = new Map<string, string>();
  const uniqueGuids = [...new Set(guids.filter(Boolean))];

  // Process in parallel (with reasonable limit)
  const batchSize = 10;
  for (let i = 0; i < uniqueGuids.length; i += batchSize) {
    const batch = uniqueGuids.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batch.map((guid) => fetchDomainName(guid).then((name) => ({ guid, name })))
    );
    
    batchResults.forEach(({ guid, name }) => {
      results.set(guid, name);
    });
  }

  return results;
}

/**
 * Clear domain cache
 */
export function clearDomainCache(): void {
  cache.clear();
}







