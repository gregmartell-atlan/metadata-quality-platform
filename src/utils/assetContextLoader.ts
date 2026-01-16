/**
 * Asset Context Loader
 *
 * Utility functions to load assets based on context type and filters.
 * 
 * This module now uses the unified asset loader which automatically
 * routes requests to either Atlan REST API or MDLH (Snowflake) based
 * on the current backend configuration.
 */

import type { AtlanAsset } from '../services/atlan/types';
import type { AssetContextType, AssetContextFilters } from '../stores/assetContextStore';
import {
  getConnectors,
  getDatabases,
  getSchemas,
  getTables,
  fetchAssetsForModel,
  getAsset,
} from '../services/atlan/api';
import {
  loadAssetsBulk,
  loadAssetsSampled,
  loadAllAssetsUnlimited,
  getAssetCount,
  type BulkLoadOptions,
  type BulkLoadResult,
} from '../services/atlan/bulkLoader';
import * as unifiedLoader from './unifiedAssetLoader';
import { logger } from './logger';

// Cache for loaded assets to avoid redundant API calls
const assetCache = new Map<string, { assets: AtlanAsset[]; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const MAX_CACHE_SIZE = 100; // Maximum number of cache entries

function getCacheKey(type: AssetContextType, filters: AssetContextFilters): string {
  return `${type}:${JSON.stringify(filters)}`;
}

function getCachedAssets(key: string): AtlanAsset[] | null {
  const cached = assetCache.get(key);
  const now = Date.now();
  
  if (cached && now - cached.timestamp < CACHE_TTL) {
    return cached.assets;
  }
  
  // Remove expired entry
  if (cached) {
    assetCache.delete(key);
  }
  
  return null;
}

function setCachedAssets(key: string, assets: AtlanAsset[]): void {
  // Don't cache empty results - they might be due to transient failures
  if (assets.length === 0) {
    logger.debug('Not caching empty result', { key });
    return;
  }

  // Enforce cache size limit - remove oldest entries if needed
  if (assetCache.size >= MAX_CACHE_SIZE) {
    // Find and remove oldest entry
    let oldestKey: string | null = null;
    let oldestTimestamp = Infinity;

    for (const [k, v] of assetCache.entries()) {
      if (v.timestamp < oldestTimestamp) {
        oldestTimestamp = v.timestamp;
        oldestKey = k;
      }
    }

    if (oldestKey) {
      assetCache.delete(oldestKey);
    }
  }

  assetCache.set(key, { assets, timestamp: Date.now() });
}

// Periodic cleanup of expired entries
function cleanupExpiredCache(): void {
  const now = Date.now();
  const expiredKeys: string[] = [];
  
  for (const [key, value] of assetCache.entries()) {
    if (now - value.timestamp >= CACHE_TTL) {
      expiredKeys.push(key);
    }
  }
  
  expiredKeys.forEach(key => assetCache.delete(key));
  
  if (expiredKeys.length > 0) {
    logger.debug('Cleaned up expired cache entries', { count: expiredKeys.length });
  }
}

// Run cleanup every minute
if (typeof window !== 'undefined') {
  setInterval(cleanupExpiredCache, 60 * 1000);
}

/**
 * Load all assets from all connections
 * Uses bulk loader with smart strategy selection based on total count
 */
export async function loadAllAssets(options?: {
  assetTypes?: string[];
  limit?: number;
  onProgress?: (loaded: number, total: number) => void;
}): Promise<AtlanAsset[]> {
  const result = await loadAllAssetsWithMetadata(options);
  return result.assets;
}

// Extended cache entry that preserves metadata
interface CachedBulkResult {
  assets: AtlanAsset[];
  metadata: {
    totalCount: number;
    isSampled: boolean;
    sampleRate?: number;
  };
  timestamp: number;
}

const bulkResultCache = new Map<string, CachedBulkResult>();

function getCachedBulkResult(key: string): BulkLoadResult | null {
  const cached = bulkResultCache.get(key);
  const now = Date.now();

  if (cached && now - cached.timestamp < CACHE_TTL) {
    return {
      assets: cached.assets,
      totalCount: cached.metadata.totalCount,
      loadedCount: cached.assets.length,
      isSampled: cached.metadata.isSampled,
      sampleRate: cached.metadata.sampleRate,
    };
  }

  if (cached) {
    bulkResultCache.delete(key);
  }

  return null;
}

function setCachedBulkResult(key: string, result: BulkLoadResult): void {
  if (result.assets.length === 0) {
    return;
  }

  // Enforce cache size limit
  if (bulkResultCache.size >= MAX_CACHE_SIZE) {
    const iterator = bulkResultCache.keys();
    const oldestKey = iterator.next().value;
    if (oldestKey) bulkResultCache.delete(oldestKey);
  }

  bulkResultCache.set(key, {
    assets: result.assets,
    metadata: {
      totalCount: result.totalCount,
      isSampled: result.isSampled,
      sampleRate: result.sampleRate,
    },
    timestamp: Date.now(),
  });
}

/**
 * Load all assets with full metadata (totalCount, isSampled, etc.)
 * Now uses unified loader for backend-aware routing.
 */
export async function loadAllAssetsWithMetadata(options?: {
  assetTypes?: string[];
  limit?: number;
  onProgress?: (loaded: number, total: number) => void;
  signal?: AbortSignal;
}): Promise<BulkLoadResult> {
  const cacheKey = getCacheKey('all', {});

  // Check bulk result cache first (preserves metadata)
  const cachedResult = getCachedBulkResult(cacheKey);
  if (cachedResult) {
    logger.debug('Returning cached all assets with metadata', {
      count: cachedResult.loadedCount,
      totalCount: cachedResult.totalCount,
      isSampled: cachedResult.isSampled,
    });
    return cachedResult;
  }

  logger.info('Loading all assets using unified loader');

  try {
    // Use unified loader which routes to MDLH or API based on backend config
    const loadResult = await unifiedLoader.loadAllAssets({
      limit: options?.limit || 10000,
      onProgress: (loaded, total) => {
        options?.onProgress?.(loaded, total);
        logger.debug('All assets load progress', { loaded, total });
      },
    });

    const result: BulkLoadResult = {
      assets: loadResult.data.assets as AtlanAsset[],
      totalCount: loadResult.data.totalCount,
      loadedCount: loadResult.data.assets.length,
      isSampled: loadResult.data.totalCount > loadResult.data.assets.length,
      sampleRate: loadResult.data.totalCount > 0 
        ? loadResult.data.assets.length / loadResult.data.totalCount 
        : 1,
    };

    logger.info('Loaded all assets', {
      loadedCount: result.loadedCount,
      totalCount: result.totalCount,
      isSampled: result.isSampled,
      source: loadResult.source,
      fallbackUsed: loadResult.fallbackUsed,
    });

    // Cache both assets and metadata
    setCachedBulkResult(cacheKey, result);
    setCachedAssets(cacheKey, result.assets);
    return result;
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      logger.info('All assets load was cancelled');
      throw err;
    }
    logger.error('Failed to load all assets', err);
    throw err;
  }
}

/**
 * Load assets for a specific connection
 * Uses bulk loader for large connections (like Snowflake with 140k+ assets)
 */
export async function loadAssetsForConnection(
  connectionName: string,
  options?: {
    assetTypes?: string[];
    limit?: number;
    onProgress?: (loaded: number, total: number) => void;
  }
): Promise<AtlanAsset[]> {
  const result = await loadAssetsForConnectionWithMetadata(connectionName, options);
  return result.assets;
}

/**
 * Load assets for a connection with full metadata (totalCount, isSampled, etc.)
 * Now uses unified loader for backend-aware routing.
 */
export async function loadAssetsForConnectionWithMetadata(
  connectionName: string,
  options?: {
    assetTypes?: string[];
    limit?: number;
    onProgress?: (loaded: number, total: number) => void;
    signal?: AbortSignal;
  }
): Promise<BulkLoadResult> {
  const cacheKey = getCacheKey('connection', { connectionName });

  // Check bulk result cache first (preserves metadata)
  const cachedResult = getCachedBulkResult(cacheKey);
  if (cachedResult) {
    logger.debug('Returning cached connection assets with metadata', {
      connectionName,
      count: cachedResult.loadedCount,
      totalCount: cachedResult.totalCount,
      isSampled: cachedResult.isSampled,
    });
    return cachedResult;
  }

  logger.info('loadAssetsForConnection: Starting', { connectionName });

  try {
    // Use unified loader which routes to MDLH or API based on backend config
    const loadResult = await unifiedLoader.loadAssetsForConnection(connectionName, {
      limit: options?.limit || 10000,
      onProgress: (loaded, total) => {
        options?.onProgress?.(loaded, total);
        logger.debug('Connection load progress', { connectionName, loaded, total });
      },
    });

    const result: BulkLoadResult = {
      assets: loadResult.data.assets as AtlanAsset[],
      totalCount: loadResult.data.totalCount,
      loadedCount: loadResult.data.assets.length,
      isSampled: loadResult.data.totalCount > loadResult.data.assets.length,
      sampleRate: loadResult.data.totalCount > 0 
        ? loadResult.data.assets.length / loadResult.data.totalCount 
        : 1,
    };

    logger.info('loadAssetsForConnection: Completed', {
      connectionName,
      loadedCount: result.loadedCount,
      totalCount: result.totalCount,
      isSampled: result.isSampled,
      source: loadResult.source,
      fallbackUsed: loadResult.fallbackUsed,
    });

    // Cache both assets and metadata
    setCachedBulkResult(cacheKey, result);
    setCachedAssets(cacheKey, result.assets);
    return result;
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      logger.info(`loadAssetsForConnection: Cancelled for ${connectionName}`);
      throw err;
    }
    logger.error(`loadAssetsForConnection: Failed for ${connectionName}`, err);
    throw err;
  }
}

/**
 * Load assets for a specific database
 * Now uses unified loader for backend-aware routing.
 */
export async function loadAssetsForDatabase(
  connectionName: string,
  databaseName: string,
  options?: { assetTypes?: string[]; limit?: number }
): Promise<AtlanAsset[]> {
  const cacheKey = getCacheKey('database', { connectionName, databaseName });

  const cached = getCachedAssets(cacheKey);
  if (cached) {
    return cached;
  }

  try {
    // Use unified loader which routes to MDLH or API based on backend config
    const loadResult = await unifiedLoader.loadAssetsForDatabase(
      connectionName,
      databaseName,
      { limit: options?.limit || 1000 }
    );

    const assets = loadResult.data.assets as AtlanAsset[];

    logger.info('loadAssetsForDatabase: Completed', { 
      connectionName, 
      databaseName, 
      totalAssets: assets.length,
      source: loadResult.source,
      fallbackUsed: loadResult.fallbackUsed,
    });
    setCachedAssets(cacheKey, assets);
    return assets;
  } catch (err) {
    logger.error(`loadAssetsForDatabase: Failed for ${databaseName}`, err);
    throw err;
  }
}

/**
 * Load assets for a specific schema
 * Now uses unified loader for backend-aware routing.
 */
export async function loadAssetsForSchema(
  connectionName: string,
  databaseName: string,
  schemaName: string,
  options?: { assetTypes?: string[]; limit?: number }
): Promise<AtlanAsset[]> {
  const cacheKey = getCacheKey('schema', { connectionName, databaseName, schemaName });
  const cached = getCachedAssets(cacheKey);
  if (cached) {
    logger.debug('Returning cached schema assets', { connectionName, databaseName, schemaName, count: cached.length });
    return cached;
  }

  logger.debug('Loading assets for schema', { connectionName, databaseName, schemaName });

  try {
    // Use unified loader which routes to MDLH or API based on backend config
    const loadResult = await unifiedLoader.loadAssetsForSchema(
      connectionName,
      databaseName,
      schemaName,
      { limit: options?.limit || 1000 }
    );

    const assets = loadResult.data.assets as AtlanAsset[];

    logger.debug('Loaded schema assets', { 
      connectionName, 
      databaseName, 
      schemaName, 
      count: assets.length,
      source: loadResult.source,
      fallbackUsed: loadResult.fallbackUsed,
    });
    setCachedAssets(cacheKey, assets);
    return assets;
  } catch (err) {
    logger.error(`Failed to load assets for schema ${schemaName}`, err);
    throw err;
  }
}

/**
 * Load a single table/view as the context asset
 * Returns the table itself (and optionally its columns in the future)
 * Now uses unified loader for backend-aware routing.
 */
export async function loadAssetsForTable(
  connectionName: string,
  databaseName: string,
  schemaName: string,
  tableName: string,
  tableGuid?: string,
  options?: { includeColumns?: boolean }
): Promise<AtlanAsset[]> {
  const cacheKey = getCacheKey('table', { connectionName, databaseName, schemaName, tableName });
  const cached = getCachedAssets(cacheKey);
  if (cached) {
    logger.debug('Returning cached table assets', { tableName, count: cached.length });
    return cached;
  }

  logger.debug('Loading assets for table', { connectionName, databaseName, schemaName, tableName });

  try {
    // If we have a GUID, fetch the specific asset directly using unified loader
    if (tableGuid) {
      const loadResult = await unifiedLoader.loadAssetDetails(tableGuid);
      if (loadResult.data) {
        const assets = [loadResult.data];
        logger.debug('Loaded table by GUID', { 
          tableName, 
          guid: tableGuid,
          source: loadResult.source,
          fallbackUsed: loadResult.fallbackUsed,
        });
        setCachedAssets(cacheKey, assets);
        return assets;
      }
    }

    // Otherwise, find the table by navigating the hierarchy using unified loader
    const databasesResult = await unifiedLoader.loadDatabases(connectionName);
    const database = databasesResult.data.find((db) => db.name === databaseName);

    if (!database) {
      throw new Error(`Database ${databaseName} not found in ${connectionName}`);
    }

    const schemasResult = await unifiedLoader.loadSchemas(connectionName, database.qualifiedName, databaseName);
    const schema = schemasResult.data.find((s) => s.name === schemaName);

    if (!schema) {
      throw new Error(`Schema ${schemaName} not found in ${databaseName}`);
    }

    const tablesResult = await unifiedLoader.loadTables(connectionName, databaseName, schema.qualifiedName, schemaName);
    const table = tablesResult.data.find((t) => t.name === tableName);

    if (!table) {
      throw new Error(`Table ${tableName} not found in ${schemaName}`);
    }

    // Return the table's full entity as the context asset
    const assets: AtlanAsset[] = table.fullEntity ? [table.fullEntity as AtlanAsset] : [];

    logger.debug('Loaded table assets', { 
      tableName, 
      count: assets.length,
      source: tablesResult.source,
      fallbackUsed: tablesResult.fallbackUsed,
    });
    setCachedAssets(cacheKey, assets);
    return assets;
  } catch (err) {
    logger.error(`Failed to load assets for table ${tableName}`, err);
    throw err;
  }
}

/**
 * Main function to load assets based on context
 */
export async function loadAssetsForContext(
  type: AssetContextType,
  filters: AssetContextFilters,
  options?: { assetTypes?: string[]; limit?: number }
): Promise<AtlanAsset[]> {
  const startTime = performance.now();
  logger.debug('loadAssetsForContext: Starting', { type, filters });

  try {
    let assets: AtlanAsset[];

    switch (type) {
    case 'all':
      assets = await loadAllAssets(options);
      break;
    
    case 'connection':
      if (!filters.connectionName) {
        throw new Error('connectionName is required for connection context');
      }
      assets = await loadAssetsForConnection(filters.connectionName, options);
      break;
    
    case 'database':
      if (!filters.connectionName || !filters.databaseName) {
        throw new Error('connectionName and databaseName are required for database context');
      }
      assets = await loadAssetsForDatabase(filters.connectionName, filters.databaseName, options);
      break;
    
    case 'schema':
      if (!filters.connectionName || !filters.databaseName || !filters.schemaName) {
        throw new Error('connectionName, databaseName, and schemaName are required for schema context');
      }
      assets = await loadAssetsForSchema(
        filters.connectionName,
        filters.databaseName,
        filters.schemaName,
        options
      );
      break;
    
    case 'table':
      if (!filters.connectionName || !filters.databaseName || !filters.schemaName || !filters.tableName) {
        throw new Error('connectionName, databaseName, schemaName, and tableName are required for table context');
      }
      assets = await loadAssetsForTable(
        filters.connectionName,
        filters.databaseName,
        filters.schemaName,
        filters.tableName,
        filters.assetGuid
      );
      break;
    
    case 'manual':
      // Manual context means assets are set directly, not loaded
      assets = [];
      break;
    
    default:
      throw new Error(`Unknown context type: ${type}`);
    }
    
    const duration = performance.now() - startTime;
    logger.info('loadAssetsForContext: Asset load complete', {
      type,
      filters,
      assetCount: assets.length,
      duration: `${duration.toFixed(2)}ms`,
      avgPerAsset: assets.length > 0 ? `${(duration / assets.length).toFixed(2)}ms` : 'N/A'
    });
    
    return assets;
  } catch (err) {
    const duration = performance.now() - startTime;
    logger.error('loadAssetsForContext: Failed to load assets', err, {
      type,
      filters,
      duration: `${duration.toFixed(2)}ms`
    });
    throw err;
  }
}

/**
 * Generate a human-readable label for a context
 */
export function generateContextLabel(
  type: AssetContextType,
  filters: AssetContextFilters
): string {
  switch (type) {
    case 'all':
      return 'All Assets';
    
    case 'connection':
      return filters.connectionName || 'Unknown Connection';
    
    case 'database':
      return `${filters.connectionName || 'Unknown'} > ${filters.databaseName || 'Unknown'}`;
    
    case 'schema':
      return `${filters.connectionName || 'Unknown'} > ${filters.databaseName || 'Unknown'} > ${filters.schemaName || 'Unknown'}`;
    
    case 'table':
      return `${filters.connectionName || 'Unknown'} > ${filters.databaseName || 'Unknown'} > ${filters.schemaName || 'Unknown'} > ${filters.tableName || 'Unknown'}`;
    
    case 'manual':
      return 'Manual Selection';
    
    default:
      return 'Unknown Context';
  }
}

