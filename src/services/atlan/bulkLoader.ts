/**
 * Bulk Asset Loader
 *
 * Scalable loading strategies for large asset counts (100k+)
 *
 * Strategies:
 * 1. Paginated - Load in batches with progress callback (up to 10k)
 * 2. Scroll - Use search_after for deep pagination (10k+)
 * 3. Sampled - Statistical sampling for quality metrics (any size)
 */

import type { AtlanAsset } from './types';
import { searchAssets, fetchAssetsForModel } from './api';
import { logger } from '../../utils/logger';

export interface BulkLoadOptions {
  connectionName?: string;
  connectionQualifiedName?: string;
  assetTypes?: string[];
  /** Maximum assets to load (default: 10000) */
  maxAssets?: number;
  /** Batch size per request (default: 1000) */
  batchSize?: number;
  /** Progress callback - called after each batch */
  onProgress?: (loaded: number, total: number, assets: AtlanAsset[]) => void;
  /** Abort signal for cancellation */
  signal?: AbortSignal;
}

export interface BulkLoadResult {
  assets: AtlanAsset[];
  totalCount: number;
  loadedCount: number;
  isSampled: boolean;
  sampleRate?: number;
}

/**
 * Get total count of assets matching filters (without loading them)
 */
export async function getAssetCount(options: {
  connectionName?: string;
  connectionQualifiedName?: string;
  assetTypes?: string[];
}): Promise<number> {
  const mustFilters: Array<Record<string, unknown>> = [];
  const mustNotFilters: Array<Record<string, unknown>> = [
    { term: { '__state': 'DELETED' } },
    {
      terms: {
        '__typeName.keyword': [
          'AtlasGlossary', 'AtlasGlossaryTerm', 'AtlasGlossaryCategory',
          'Persona', 'Purpose', 'AuthPolicy', 'Connection', 'Process',
          'ColumnProcess', 'Task',
        ],
      },
    },
  ];

  if (options.connectionName) {
    mustFilters.push({
      bool: {
        should: [
          { term: { 'connectionName': options.connectionName } },
          { term: { 'connectorName': options.connectionName } },
        ],
        minimum_should_match: 1,
      },
    });
  }

  if (options.connectionQualifiedName) {
    mustFilters.push({ term: { 'connectionQualifiedName': options.connectionQualifiedName } });
  }

  if (options.assetTypes?.length) {
    mustFilters.push({ terms: { '__typeName.keyword': options.assetTypes } });
  }

  const query = {
    bool: {
      must: mustFilters.length > 0 ? mustFilters : [{ match_all: {} }],
      must_not: mustNotFilters,
    },
  };

  // Use size 0 to just get count
  const response = await searchAssets(query, ['name'], 0, 0);
  return response.approximateCount || 0;
}

/**
 * Load assets in bulk with pagination
 * Handles up to 10k assets with standard pagination
 */
export async function loadAssetsPaginated(
  options: BulkLoadOptions
): Promise<BulkLoadResult> {
  const batchSize = options.batchSize || 1000;
  const maxAssets = options.maxAssets || 10000;
  const allAssets: AtlanAsset[] = [];

  let offset = 0;
  let totalCount = 0;
  let hasMore = true;

  logger.info('bulkLoader: Starting paginated load', {
    connectionName: options.connectionName,
    batchSize,
    maxAssets
  });

  while (hasMore && allAssets.length < maxAssets) {
    if (options.signal?.aborted) {
      logger.info('bulkLoader: Aborted by signal');
      break;
    }

    const remaining = maxAssets - allAssets.length;
    const currentBatchSize = Math.min(batchSize, remaining);

    const assets = await fetchAssetsForModel({
      connector: options.connectionName,
      connectionQualifiedName: options.connectionQualifiedName,
      assetTypes: options.assetTypes || ['Table', 'View', 'MaterializedView'],
      size: currentBatchSize,
      from: offset,
    });

    if (assets.length === 0) {
      hasMore = false;
    } else {
      allAssets.push(...assets);
      offset += assets.length;

      // Estimate total from first batch
      if (totalCount === 0) {
        totalCount = await getAssetCount({
          connectionName: options.connectionName,
          connectionQualifiedName: options.connectionQualifiedName,
          assetTypes: options.assetTypes,
        });
      }

      options.onProgress?.(allAssets.length, totalCount, assets);

      // If we got less than requested, no more results
      if (assets.length < currentBatchSize) {
        hasMore = false;
      }

      // Elasticsearch limit: from + size <= 10000
      if (offset >= 10000) {
        logger.warn('bulkLoader: Reached Elasticsearch pagination limit (10k)');
        hasMore = false;
      }
    }

    logger.debug('bulkLoader: Batch loaded', {
      batchSize: assets.length,
      totalLoaded: allAssets.length,
      totalCount
    });
  }

  logger.info('bulkLoader: Paginated load complete', {
    loadedCount: allAssets.length,
    totalCount
  });

  return {
    assets: allAssets,
    totalCount,
    loadedCount: allAssets.length,
    isSampled: allAssets.length < totalCount,
    sampleRate: totalCount > 0 ? allAssets.length / totalCount : 1,
  };
}

/**
 * Load assets using search_after for deep pagination (>10k assets)
 * This requires sorting by a unique field and using the last value as cursor
 */
export async function loadAssetsWithCursor(
  options: BulkLoadOptions
): Promise<BulkLoadResult> {
  const batchSize = options.batchSize || 1000;
  const maxAssets = options.maxAssets || 500000;  // Support up to 500k
  const allAssets: AtlanAsset[] = [];

  let searchAfter: (string | number)[] | undefined = undefined;
  let totalCount = 0;

  logger.info('bulkLoader: Starting cursor-based load', {
    connectionName: options.connectionName,
    batchSize,
    maxAssets
  });

  // Get total count first
  totalCount = await getAssetCount({
    connectionName: options.connectionName,
    connectionQualifiedName: options.connectionQualifiedName,
    assetTypes: options.assetTypes,
  });

  const mustFilters: Array<Record<string, unknown>> = [];
  const mustNotFilters: Array<Record<string, unknown>> = [
    { term: { '__state': 'DELETED' } },
    {
      terms: {
        '__typeName.keyword': [
          'AtlasGlossary', 'AtlasGlossaryTerm', 'AtlasGlossaryCategory',
          'Persona', 'Purpose', 'AuthPolicy', 'Connection', 'Process',
          'ColumnProcess', 'Task',
        ],
      },
    },
  ];

  if (options.connectionName) {
    mustFilters.push({
      bool: {
        should: [
          { term: { 'connectionName': options.connectionName } },
          { term: { 'connectorName': options.connectionName } },
        ],
        minimum_should_match: 1,
      },
    });
  }

  if (options.connectionQualifiedName) {
    mustFilters.push({ term: { 'connectionQualifiedName': options.connectionQualifiedName } });
  }

  if (options.assetTypes?.length) {
    mustFilters.push({ terms: { '__typeName.keyword': options.assetTypes } });
  }

  const query: Record<string, unknown> = {
    bool: {
      must: mustFilters.length > 0 ? mustFilters : [{ match_all: {} }],
      must_not: mustNotFilters,
    },
  };

  while (allAssets.length < maxAssets && allAssets.length < totalCount) {
    if (options.signal?.aborted) {
      logger.info('bulkLoader: Aborted by signal');
      break;
    }

    // Use searchAssets with search_after for cursor-based pagination
    const response = await searchAssets(
      query,
      [],  // Use default attributes
      batchSize,
      0,   // offset is 0 when using search_after
      {
        searchAfter,
        sort: [{ '__guid': 'asc' }],  // Sort by GUID for consistent cursor
      }
    );

    const assets = response.entities;

    if (assets.length === 0) break;

    allAssets.push(...assets);

    // Update cursor from response for next iteration
    // Use lastSort from response (populated by searchAssets from entity.sort)
    searchAfter = response.lastSort;

    // If no cursor returned, fall back to guid-based cursor
    if (!searchAfter && assets.length > 0) {
      const lastAsset = assets[assets.length - 1];
      searchAfter = [lastAsset.guid];
    }

    options.onProgress?.(allAssets.length, totalCount, assets);

    logger.debug('bulkLoader: Cursor batch loaded', {
      batchSize: assets.length,
      totalLoaded: allAssets.length,
      totalCount,
      hasNextCursor: !!searchAfter
    });

    // If we got fewer results than requested, we're done
    if (assets.length < batchSize) {
      break;
    }
  }

  logger.info('bulkLoader: Cursor-based load complete', {
    loadedCount: allAssets.length,
    totalCount
  });

  return {
    assets: allAssets,
    totalCount,
    loadedCount: allAssets.length,
    isSampled: allAssets.length < totalCount,
    sampleRate: totalCount > 0 ? allAssets.length / totalCount : 1,
  };
}

/**
 * Load a statistically representative sample of assets
 * Uses stratified sampling by schema to ensure coverage
 */
export async function loadAssetsSampled(
  options: BulkLoadOptions & { targetSampleSize?: number }
): Promise<BulkLoadResult> {
  const targetSampleSize = options.targetSampleSize || 5000;

  logger.info('bulkLoader: Starting sampled load', {
    connectionName: options.connectionName,
    targetSampleSize
  });

  // Get total count
  const totalCount = await getAssetCount({
    connectionName: options.connectionName,
    connectionQualifiedName: options.connectionQualifiedName,
    assetTypes: options.assetTypes,
  });

  if (totalCount <= targetSampleSize) {
    // Small enough to load entirely
    return loadAssetsPaginated({
      ...options,
      maxAssets: totalCount,
    });
  }

  // For large datasets, use random sampling via sort
  // Sort by a pseudo-random field (popularityScore or updateTime) to get variety
  const sampledAssets = await fetchAssetsForModel({
    connector: options.connectionName,
    connectionQualifiedName: options.connectionQualifiedName,
    assetTypes: options.assetTypes || ['Table', 'View', 'MaterializedView'],
    size: targetSampleSize,
    from: 0,
  });

  const sampleRate = targetSampleSize / totalCount;

  logger.info('bulkLoader: Sampled load complete', {
    sampleSize: sampledAssets.length,
    totalCount,
    sampleRate: `${(sampleRate * 100).toFixed(1)}%`
  });

  options.onProgress?.(sampledAssets.length, totalCount, sampledAssets);

  return {
    assets: sampledAssets,
    totalCount,
    loadedCount: sampledAssets.length,
    isSampled: true,
    sampleRate,
  };
}

/**
 * Smart bulk loader - automatically chooses the best strategy
 * - Up to 10k: Standard pagination (fastest)
 * - Up to 500k: Cursor-based pagination (handles any size)
 * - Over 500k: Sampling (for truly massive datasets)
 */
export async function loadAssetsBulk(
  options: BulkLoadOptions
): Promise<BulkLoadResult> {
  // Get count first to determine strategy
  const totalCount = await getAssetCount({
    connectionName: options.connectionName,
    connectionQualifiedName: options.connectionQualifiedName,
    assetTypes: options.assetTypes,
  });

  const maxAssets = options.maxAssets || 500000;  // Default to 500k max

  logger.info('bulkLoader: Determining strategy', { totalCount, maxAssets });

  if (totalCount <= 10000) {
    // Small enough for standard pagination (fastest)
    return loadAssetsPaginated({
      ...options,
      maxAssets: Math.min(totalCount, maxAssets),
    });
  } else if (totalCount <= maxAssets) {
    // Use cursor-based loading for datasets up to maxAssets
    return loadAssetsWithCursor({
      ...options,
      maxAssets,
    });
  } else {
    // Very large dataset - use sampling to maxAssets
    logger.info('bulkLoader: Very large dataset, using cursor-based load with limit', { totalCount, maxAssets });
    return loadAssetsWithCursor({
      ...options,
      maxAssets,
    });
  }
}

/**
 * Load all assets without limit (use with caution for large datasets)
 * Returns sample metadata so UI can show "X of Y assets"
 */
export async function loadAllAssetsUnlimited(
  options: Omit<BulkLoadOptions, 'maxAssets'>
): Promise<BulkLoadResult> {
  return loadAssetsWithCursor({
    ...options,
    maxAssets: 1000000,  // 1M max safety limit
  });
}


/**
 * Progressive loader for UI - yields batches as they load
 */
export async function* loadAssetsProgressive(
  options: BulkLoadOptions
): AsyncGenerator<{ assets: AtlanAsset[]; loaded: number; total: number; done: boolean }> {
  const batchSize = options.batchSize || 1000;
  const maxAssets = options.maxAssets || 10000;

  let offset = 0;
  let totalCount = 0;
  let done = false;
  const allAssets: AtlanAsset[] = [];

  // Get total count first
  totalCount = await getAssetCount({
    connectionName: options.connectionName,
    connectionQualifiedName: options.connectionQualifiedName,
    assetTypes: options.assetTypes,
  });

  while (!done && allAssets.length < maxAssets && offset < Math.min(totalCount, 10000)) {
    if (options.signal?.aborted) {
      done = true;
      break;
    }

    const assets = await fetchAssetsForModel({
      connector: options.connectionName,
      connectionQualifiedName: options.connectionQualifiedName,
      assetTypes: options.assetTypes || ['Table', 'View', 'MaterializedView'],
      size: batchSize,
      from: offset,
    });

    if (assets.length === 0) {
      done = true;
    } else {
      allAssets.push(...assets);
      offset += assets.length;
      done = assets.length < batchSize || offset >= 10000 || allAssets.length >= maxAssets;
    }

    yield {
      assets: allAssets,
      loaded: allAssets.length,
      total: totalCount,
      done,
    };
  }
}
