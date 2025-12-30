/**
 * Asset Context Loader
 * 
 * Utility functions to load assets based on context type and filters
 */

import type { AtlanAsset } from '../services/atlan/types';
import type { AssetContextType, AssetContextFilters } from '../stores/assetContextStore';
import {
  getConnectors,
  getDatabases,
  getSchemas,
  fetchAssetsForModel,
} from '../services/atlan/api';
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
 * Note: This may be a large dataset - consider pagination or limiting to specific types
 */
export async function loadAllAssets(options?: {
  assetTypes?: string[];
  limit?: number;
}): Promise<AtlanAsset[]> {
  const cacheKey = getCacheKey('all', {});
  const cached = getCachedAssets(cacheKey);
  if (cached) {
    logger.debug('Returning cached all assets', { count: cached.length });
    return cached;
  }

  logger.debug('Loading all assets from all connections', options);
  const allAssets: AtlanAsset[] = [];

  try {
    const connectors = await getConnectors();
    if (!connectors || connectors.length === 0) {
      logger.warn('No connectors found for All Assets mode');
      return [];
    }
    logger.debug('Found connectors', { count: connectors.length });

    // Load assets from each connector
    for (const connector of connectors) {
      try {
        const databases = await getDatabases(connector.name);
        logger.debug(`Loading assets from ${connector.name}`, { databases: databases.length });

        for (const database of databases) {
          try {
            const schemas = await getSchemas(database.qualifiedName);
            logger.debug(`Loading assets from ${database.name}`, { schemas: schemas.length });

            for (const schema of schemas) {
              try {
                const assets = await fetchAssetsForModel({
                  connector: connector.name,
                  schemaQualifiedName: schema.qualifiedName,
                  assetTypes: options?.assetTypes || ['Table', 'View', 'MaterializedView'],
                  size: options?.limit || 200,
                });

                allAssets.push(...assets);
                logger.debug(`Loaded ${assets.length} assets from ${schema.name}`);
              } catch (err) {
                logger.error(`Failed to load assets from schema ${schema.name}`, err);
              }
            }
          } catch (err) {
            logger.error(`Failed to load schemas from database ${database.name}`, err);
          }
        }
      } catch (err) {
        logger.error(`Failed to load databases from connector ${connector.name}`, err);
      }
    }

    logger.debug('Loaded all assets', { total: allAssets.length });
    setCachedAssets(cacheKey, allAssets);
    return allAssets;
  } catch (err) {
    logger.error('Failed to load all assets', err);
    throw err;
  }
}

/**
 * Load assets for a specific connection
 */
export async function loadAssetsForConnection(
  connectionName: string,
  options?: { assetTypes?: string[]; limit?: number }
): Promise<AtlanAsset[]> {
  const cacheKey = getCacheKey('connection', { connectionName });
  const cached = getCachedAssets(cacheKey);
  if (cached) {
    return cached;
  }

  const assets: AtlanAsset[] = [];

  try {
    const databases = await getDatabases(connectionName);

    for (const database of databases) {
      try {
        const schemas = await getSchemas(database.qualifiedName);

        for (const schema of schemas) {
          try {
            const schemaAssets = await fetchAssetsForModel({
              connector: connectionName,
              schemaQualifiedName: schema.qualifiedName,
              assetTypes: options?.assetTypes || ['Table', 'View', 'MaterializedView'],
              size: options?.limit || 200,
            });
            assets.push(...schemaAssets);
          } catch (err) {
            logger.error(`loadAssetsForConnection: Failed to load schema ${schema.name}`, err);
          }
        }
      } catch (err) {
        logger.error(`loadAssetsForConnection: Failed to load database ${database.name}`, err);
      }
    }

    logger.info('loadAssetsForConnection: Completed', { connectionName, totalAssets: assets.length });
    setCachedAssets(cacheKey, assets);
    return assets;
  } catch (err) {
    logger.error(`loadAssetsForConnection: Failed for ${connectionName}`, err);
    throw err;
  }
}

/**
 * Load assets for a specific database
 */
export async function loadAssetsForDatabase(
  connectionName: string,
  databaseName: string,
  options?: { assetTypes?: string[]; limit?: number }
): Promise<AtlanAsset[]> {
  logger.debug('loadAssetsForDatabase: Starting', { connectionName, databaseName, options });

  const cacheKey = getCacheKey('database', { connectionName, databaseName });

  const cached = getCachedAssets(cacheKey);
  if (cached) {
    logger.debug('loadAssetsForDatabase: Cache hit', { count: cached.length });
    return cached;
  }

  const assets: AtlanAsset[] = [];

  try {
    const databases = await getDatabases(connectionName);
    const database = databases.find((db) => db.name === databaseName);

    if (!database) {
      throw new Error(`Database ${databaseName} not found in ${connectionName}`);
    }

    const schemas = await getSchemas(database.qualifiedName);
    logger.debug('loadAssetsForDatabase: Found schemas', { count: schemas.length });

    for (const schema of schemas) {
      try {
        const schemaAssets = await fetchAssetsForModel({
          connector: connectionName,
          schemaQualifiedName: schema.qualifiedName,
          assetTypes: options?.assetTypes || ['Table', 'View', 'MaterializedView'],
          size: options?.limit || 200,
        });
        assets.push(...schemaAssets);
      } catch (err) {
        logger.error(`loadAssetsForDatabase: Failed to load schema ${schema.name}`, err);
      }
    }

    logger.info('loadAssetsForDatabase: Completed', { connectionName, databaseName, totalAssets: assets.length });
    setCachedAssets(cacheKey, assets);
    return assets;
  } catch (err) {
    logger.error(`loadAssetsForDatabase: Failed for ${databaseName}`, err);
    throw err;
  }
}

/**
 * Load assets for a specific schema
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
    const databases = await getDatabases(connectionName);
    const database = databases.find((db) => db.name === databaseName);
    
    if (!database) {
      throw new Error(`Database ${databaseName} not found in ${connectionName}`);
    }

    const schemas = await getSchemas(database.qualifiedName);
    const schema = schemas.find((s) => s.name === schemaName);
    
    if (!schema) {
      throw new Error(`Schema ${schemaName} not found in ${databaseName}`);
    }

    const assets = await fetchAssetsForModel({
      connector: connectionName,
      schemaQualifiedName: schema.qualifiedName,
      assetTypes: options?.assetTypes || ['Table', 'View', 'MaterializedView'],
      size: options?.limit || 200,
    });

    logger.debug('Loaded schema assets', { connectionName, databaseName, schemaName, count: assets.length });
    setCachedAssets(cacheKey, assets);
    return assets;
  } catch (err) {
    logger.error(`Failed to load assets for schema ${schemaName}`, err);
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
      if (!filters.assetGuid) {
        throw new Error('assetGuid is required for table context');
      }
      // For single table, we'd need to fetch the specific asset
      // This is a placeholder - you'd implement based on your API
      assets = [];
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
      return filters.tableName || 'Unknown Table';
    
    case 'manual':
      return 'Manual Selection';
    
    default:
      return 'Unknown Context';
  }
}

