/**
 * Lineage Enricher Service
 *
 * Fetches and caches lineage data for assets to support pivot views
 */

import type { AtlanAsset } from './types';
import { getLineage } from './api';
import { logger } from '../../utils/logger';

export interface LineageInfo {
  hasUpstream: boolean;
  hasDownstream: boolean;
  upstreamCount: number;
  downstreamCount: number;
  guid: string;
}

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const MAX_CACHE_SIZE = 500; // Prevent unbounded memory growth

interface CacheEntry {
  data: LineageInfo;
  timestamp: number;
}

const cache = new Map<string, CacheEntry>();
const inFlightRequests = new Map<string, Promise<LineageInfo>>();

/**
 * Get cached lineage info if still valid
 */
function getCachedLineage(guid: string): LineageInfo | null {
  const entry = cache.get(guid);
  if (entry && Date.now() - entry.timestamp < CACHE_TTL) {
    return entry.data;
  }
  cache.delete(guid);
  return null;
}

/**
 * Store lineage info in cache with size limit
 */
function setCachedLineage(guid: string, data: LineageInfo): void {
  // Evict oldest entries if cache is full
  if (cache.size >= MAX_CACHE_SIZE) {
    const now = Date.now();
    const keysToDelete: string[] = [];

    // Remove expired entries first
    for (const [k, v] of cache) {
      if (now - v.timestamp >= CACHE_TTL) {
        keysToDelete.push(k);
      }
    }
    keysToDelete.forEach(k => cache.delete(k));

    // If still too large, remove oldest entries
    if (cache.size >= MAX_CACHE_SIZE) {
      const iterator = cache.keys();
      const toRemove = cache.size - MAX_CACHE_SIZE + 1;
      for (let i = 0; i < toRemove; i++) {
        const oldestKey = iterator.next().value;
        if (oldestKey) cache.delete(oldestKey);
      }
    }
  }

  cache.set(guid, { data, timestamp: Date.now() });
}

/**
 * Fetch lineage for a single asset (with deduplication for concurrent requests)
 */
export async function fetchLineageForAsset(guid: string): Promise<LineageInfo> {
  // Check cache first
  const cached = getCachedLineage(guid);
  if (cached) {
    return cached;
  }

  // Check if there's already an in-flight request for this guid
  const inFlight = inFlightRequests.get(guid);
  if (inFlight) {
    return inFlight;
  }

  // Create the fetch promise
  const fetchPromise = (async (): Promise<LineageInfo> => {
    try {
      // Fetch both upstream and downstream lineage
      const [upstreamResponse, downstreamResponse] = await Promise.allSettled([
        getLineage(guid, 'upstream', 1), // Depth 1 to check existence
        getLineage(guid, 'downstream', 1),
      ]);

      // Check if lineage exists by looking at relations or guidEntityMap
      const hasUpstream = upstreamResponse.status === 'fulfilled' &&
        upstreamResponse.value.relations &&
        upstreamResponse.value.relations.length > 0;

      const hasDownstream = downstreamResponse.status === 'fulfilled' &&
        downstreamResponse.value.relations &&
        downstreamResponse.value.relations.length > 0;

      // Count unique entities (not just relations, as one entity can have multiple relations)
      const upstreamGuids = upstreamResponse.status === 'fulfilled' && upstreamResponse.value.guidEntityMap
        ? new Set(Object.keys(upstreamResponse.value.guidEntityMap)).size
        : 0;

      const downstreamGuids = downstreamResponse.status === 'fulfilled' && downstreamResponse.value.guidEntityMap
        ? new Set(Object.keys(downstreamResponse.value.guidEntityMap)).size
        : 0;

      const info: LineageInfo = {
        hasUpstream,
        hasDownstream,
        upstreamCount: upstreamGuids,
        downstreamCount: downstreamGuids,
        guid,
      };

      setCachedLineage(guid, info);
      return info;
    } catch (error) {
      logger.warn(`Failed to fetch lineage for ${guid}:`, error);
      // Return default (no lineage) on error
      const info: LineageInfo = {
        hasUpstream: false,
        hasDownstream: false,
        upstreamCount: 0,
        downstreamCount: 0,
        guid,
      };
      setCachedLineage(guid, info);
      return info;
    } finally {
      // Clean up in-flight tracking
      inFlightRequests.delete(guid);
    }
  })();

  // Track the in-flight request
  inFlightRequests.set(guid, fetchPromise);

  return fetchPromise;
}

/**
 * Batch fetch lineage for multiple assets (with concurrency limit)
 */
export async function fetchLineageForAssets(
  assets: AtlanAsset[],
  concurrency: number = 5
): Promise<Map<string, LineageInfo>> {
  const results = new Map<string, LineageInfo>();
  const guids = assets.map((a) => a.guid);

  // Process in batches to avoid overwhelming the API
  for (let i = 0; i < guids.length; i += concurrency) {
    const batch = guids.slice(i, i + concurrency);
    const batchResults = await Promise.all(
      batch.map((guid) => fetchLineageForAsset(guid))
    );
    
    batchResults.forEach((info) => {
      results.set(info.guid, info);
    });
  }

  return results;
}

/**
 * Clear lineage cache
 */
export function clearLineageCache(): void {
  cache.clear();
}

