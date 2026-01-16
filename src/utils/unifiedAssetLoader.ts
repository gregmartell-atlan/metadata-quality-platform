/**
 * Unified Asset Loader
 *
 * Backend-aware routing layer that automatically selects between
 * Atlan REST API and MDLH (Snowflake) based on current configuration.
 *
 * Features:
 * - Automatic backend selection based on backendModeStore
 * - Auto-fallback to API when MDLH fails or disconnects
 * - Consistent interface regardless of backend
 * - Logging for debugging backend switches
 */

import { useBackendModeStore } from '../stores/backendModeStore';
import { logger } from './logger';
import type { AtlanAsset } from '../services/atlan/types';
import type { ConnectorInfo, HierarchyItem, AtlanAssetSummary } from '../services/atlan/api';

// Atlan API imports
import * as atlanApi from '../services/atlan/api';

// MDLH client imports
import * as mdlhClient from '../services/mdlhClient';

// ============================================
// Types
// ============================================

export interface LoadResult<T> {
  data: T;
  source: 'api' | 'mdlh';
  fallbackUsed: boolean;
  fallbackReason?: string;
}

// ============================================
// Backend Detection
// ============================================

/**
 * Get the effective backend to use.
 * Returns 'mdlh' only if MDLH is selected AND connected.
 * Falls back to 'api' if MDLH is selected but not connected.
 */
function getEffectiveBackend(): 'api' | 'mdlh' {
  const state = useBackendModeStore.getState();
  
  // Only use MDLH if explicitly selected AND connected
  if (state.dataBackend === 'mdlh') {
    if (state.snowflakeStatus.connected) {
      return 'mdlh';
    }
    // MDLH selected but not connected - log and fall back to API
    logger.debug('[UnifiedLoader] MDLH selected but not connected, using API fallback');
    return 'api';
  }
  
  return 'api';
}

/**
 * Check if MDLH is available (enabled and connected)
 */
export function isMdlhAvailable(): boolean {
  const state = useBackendModeStore.getState();
  return (
    state.dataBackend === 'mdlh' &&
    state.snowflakeStatus.connected &&
    (state.mdlhConfig?.enabled ?? false)
  );
}

/**
 * Trigger fallback to API mode
 */
function triggerFallback(reason: string): void {
  const state = useBackendModeStore.getState();
  if (state.triggerFallback) {
    state.triggerFallback(reason);
  }
  logger.warn('[UnifiedLoader] Fallback triggered:', reason);
}

// ============================================
// Connector Loading
// ============================================

/**
 * Load connectors using the appropriate backend.
 * Auto-falls back to API if MDLH fails.
 */
export async function loadConnectors(): Promise<LoadResult<ConnectorInfo[]>> {
  const backend = getEffectiveBackend();

  if (backend === 'mdlh') {
    try {
      logger.debug('[UnifiedLoader] Loading connectors from MDLH');
      const connectors = await mdlhClient.getHierarchyConnectors();
      return {
        data: connectors,
        source: 'mdlh',
        fallbackUsed: false,
      };
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'MDLH connector fetch failed';
      logger.warn('[UnifiedLoader] MDLH connectors failed, falling back to API:', reason);
      triggerFallback(reason);
      // Fall through to API
    }
  }

  // API path (or fallback)
  logger.debug('[UnifiedLoader] Loading connectors from API');
  const connectors = await atlanApi.getConnectors();
  return {
    data: connectors,
    source: 'api',
    fallbackUsed: backend === 'mdlh',
    fallbackReason: backend === 'mdlh' ? 'MDLH request failed' : undefined,
  };
}

// ============================================
// Database Loading
// ============================================

/**
 * Load databases for a connector using the appropriate backend.
 */
export async function loadDatabases(
  connectorName: string
): Promise<LoadResult<HierarchyItem[]>> {
  const backend = getEffectiveBackend();

  if (backend === 'mdlh') {
    try {
      logger.debug('[UnifiedLoader] Loading databases from MDLH for:', connectorName);
      const databases = await mdlhClient.getHierarchyDatabases(connectorName);
      return {
        data: databases,
        source: 'mdlh',
        fallbackUsed: false,
      };
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'MDLH database fetch failed';
      logger.warn('[UnifiedLoader] MDLH databases failed, falling back to API:', reason);
      triggerFallback(reason);
      // Fall through to API
    }
  }

  // API path (or fallback)
  logger.debug('[UnifiedLoader] Loading databases from API for:', connectorName);
  const databases = await atlanApi.getDatabases(connectorName);
  return {
    data: databases,
    source: 'api',
    fallbackUsed: backend === 'mdlh',
    fallbackReason: backend === 'mdlh' ? 'MDLH request failed' : undefined,
  };
}

// ============================================
// Schema Loading
// ============================================

/**
 * Load schemas for a database using the appropriate backend.
 */
export async function loadSchemas(
  connectorName: string,
  databaseQualifiedName: string,
  databaseName?: string
): Promise<LoadResult<HierarchyItem[]>> {
  const backend = getEffectiveBackend();

  if (backend === 'mdlh') {
    try {
      // For MDLH, we need the database name (not qualified name)
      const dbName = databaseName || databaseQualifiedName.split('/').pop() || databaseQualifiedName;
      logger.debug('[UnifiedLoader] Loading schemas from MDLH for:', connectorName, dbName);
      const schemas = await mdlhClient.getHierarchySchemas(connectorName, dbName);
      return {
        data: schemas,
        source: 'mdlh',
        fallbackUsed: false,
      };
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'MDLH schema fetch failed';
      logger.warn('[UnifiedLoader] MDLH schemas failed, falling back to API:', reason);
      triggerFallback(reason);
      // Fall through to API
    }
  }

  // API path (or fallback) - uses qualified name
  logger.debug('[UnifiedLoader] Loading schemas from API for:', databaseQualifiedName);
  const schemas = await atlanApi.getSchemas(databaseQualifiedName);
  return {
    data: schemas,
    source: 'api',
    fallbackUsed: backend === 'mdlh',
    fallbackReason: backend === 'mdlh' ? 'MDLH request failed' : undefined,
  };
}

// ============================================
// Table Loading
// ============================================

/**
 * Load tables for a schema using the appropriate backend.
 */
export async function loadTables(
  connectorName: string,
  databaseName: string,
  schemaQualifiedName: string,
  schemaName?: string
): Promise<LoadResult<HierarchyItem[]>> {
  const backend = getEffectiveBackend();

  if (backend === 'mdlh') {
    try {
      // For MDLH, we need the schema name (not qualified name)
      const sName = schemaName || schemaQualifiedName.split('/').pop() || schemaQualifiedName;
      logger.debug('[UnifiedLoader] Loading tables from MDLH for:', connectorName, databaseName, sName);
      const tables = await mdlhClient.getHierarchyTables(connectorName, databaseName, sName);
      return {
        data: tables,
        source: 'mdlh',
        fallbackUsed: false,
      };
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'MDLH table fetch failed';
      logger.warn('[UnifiedLoader] MDLH tables failed, falling back to API:', reason);
      triggerFallback(reason);
      // Fall through to API
    }
  }

  // API path (or fallback) - uses qualified name
  logger.debug('[UnifiedLoader] Loading tables from API for:', schemaQualifiedName);
  const tables = await atlanApi.getTables(schemaQualifiedName);
  return {
    data: tables,
    source: 'api',
    fallbackUsed: backend === 'mdlh',
    fallbackReason: backend === 'mdlh' ? 'MDLH request failed' : undefined,
  };
}

// ============================================
// Asset Details Loading
// ============================================

/**
 * Load full asset details by GUID using the appropriate backend.
 */
export async function loadAssetDetails(guid: string): Promise<LoadResult<AtlanAsset | null>> {
  const backend = getEffectiveBackend();

  if (backend === 'mdlh') {
    try {
      logger.debug('[UnifiedLoader] Loading asset details from MDLH for:', guid);
      const asset = await mdlhClient.getAssetDetails(guid);
      return {
        data: asset,
        source: 'mdlh',
        fallbackUsed: false,
      };
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'MDLH asset detail fetch failed';
      logger.warn('[UnifiedLoader] MDLH asset details failed, falling back to API:', reason);
      triggerFallback(reason);
      // Fall through to API
    }
  }

  // API path (or fallback)
  logger.debug('[UnifiedLoader] Loading asset details from API for:', guid);
  const asset = await atlanApi.getAsset(guid);
  return {
    data: asset,
    source: 'api',
    fallbackUsed: backend === 'mdlh',
    fallbackReason: backend === 'mdlh' ? 'MDLH request failed' : undefined,
  };
}

// ============================================
// Bulk Asset Loading for Context
// ============================================

/**
 * Load assets for a connection context using the appropriate backend.
 */
export async function loadAssetsForConnection(
  connectionName: string,
  options?: {
    limit?: number;
    offset?: number;
    onProgress?: (loaded: number, total: number) => void;
  }
): Promise<LoadResult<{ assets: AtlanAssetSummary[]; totalCount: number }>> {
  const backend = getEffectiveBackend();

  if (backend === 'mdlh') {
    try {
      logger.debug('[UnifiedLoader] Loading connection assets from MDLH:', connectionName);
      const result = await mdlhClient.getHierarchyAssets({
        connector: connectionName,
        limit: options?.limit || 1000,
        offset: options?.offset || 0,
      });
      options?.onProgress?.(result.assets.length, result.totalCount);
      return {
        data: { assets: result.assets, totalCount: result.totalCount },
        source: 'mdlh',
        fallbackUsed: false,
      };
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'MDLH connection assets fetch failed';
      logger.warn('[UnifiedLoader] MDLH connection assets failed, falling back to API:', reason);
      triggerFallback(reason);
      // Fall through to API
    }
  }

  // API path - use the bulk loader
  logger.debug('[UnifiedLoader] Loading connection assets from API:', connectionName);
  const { loadAssetsBulk } = await import('../services/atlan/bulkLoader');
  const result = await loadAssetsBulk({
    connectionName,
    assetTypes: ['Table', 'View', 'MaterializedView'],
    maxAssets: options?.limit || 10000,
    batchSize: 1000,
    onProgress: options?.onProgress,
  });

  return {
    data: { assets: result.assets as AtlanAssetSummary[], totalCount: result.totalCount },
    source: 'api',
    fallbackUsed: backend === 'mdlh',
    fallbackReason: backend === 'mdlh' ? 'MDLH request failed' : undefined,
  };
}

/**
 * Load assets for a database context using the appropriate backend.
 */
export async function loadAssetsForDatabase(
  connectionName: string,
  databaseName: string,
  options?: {
    limit?: number;
    offset?: number;
  }
): Promise<LoadResult<{ assets: AtlanAssetSummary[]; totalCount: number }>> {
  const backend = getEffectiveBackend();

  if (backend === 'mdlh') {
    try {
      logger.debug('[UnifiedLoader] Loading database assets from MDLH:', connectionName, databaseName);
      const result = await mdlhClient.getHierarchyAssets({
        connector: connectionName,
        database: databaseName,
        limit: options?.limit || 1000,
        offset: options?.offset || 0,
      });
      return {
        data: { assets: result.assets, totalCount: result.totalCount },
        source: 'mdlh',
        fallbackUsed: false,
      };
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'MDLH database assets fetch failed';
      logger.warn('[UnifiedLoader] MDLH database assets failed, falling back to API:', reason);
      triggerFallback(reason);
      // Fall through to API
    }
  }

  // API path - use fetchAssetsForModel
  logger.debug('[UnifiedLoader] Loading database assets from API:', connectionName, databaseName);
  const databases = await atlanApi.getDatabases(connectionName);
  const database = databases.find((db) => db.name === databaseName);

  if (!database) {
    throw new Error(`Database ${databaseName} not found in ${connectionName}`);
  }

  const assets = await atlanApi.fetchAssetsForModel({
    databaseQualifiedName: database.qualifiedName,
    assetTypes: ['Table', 'View', 'MaterializedView'],
    size: options?.limit || 1000,
  });

  return {
    data: { assets: assets as AtlanAssetSummary[], totalCount: assets.length },
    source: 'api',
    fallbackUsed: backend === 'mdlh',
    fallbackReason: backend === 'mdlh' ? 'MDLH request failed' : undefined,
  };
}

/**
 * Load assets for a schema context using the appropriate backend.
 */
export async function loadAssetsForSchema(
  connectionName: string,
  databaseName: string,
  schemaName: string,
  options?: {
    limit?: number;
    offset?: number;
  }
): Promise<LoadResult<{ assets: AtlanAssetSummary[]; totalCount: number }>> {
  const backend = getEffectiveBackend();

  if (backend === 'mdlh') {
    try {
      logger.debug('[UnifiedLoader] Loading schema assets from MDLH:', connectionName, databaseName, schemaName);
      const result = await mdlhClient.getHierarchyAssets({
        connector: connectionName,
        database: databaseName,
        schema: schemaName,
        limit: options?.limit || 1000,
        offset: options?.offset || 0,
      });
      return {
        data: { assets: result.assets, totalCount: result.totalCount },
        source: 'mdlh',
        fallbackUsed: false,
      };
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'MDLH schema assets fetch failed';
      logger.warn('[UnifiedLoader] MDLH schema assets failed, falling back to API:', reason);
      triggerFallback(reason);
      // Fall through to API
    }
  }

  // API path
  logger.debug('[UnifiedLoader] Loading schema assets from API:', connectionName, databaseName, schemaName);
  const databases = await atlanApi.getDatabases(connectionName);
  const database = databases.find((db) => db.name === databaseName);

  if (!database) {
    throw new Error(`Database ${databaseName} not found in ${connectionName}`);
  }

  const schemas = await atlanApi.getSchemas(database.qualifiedName);
  const schema = schemas.find((s) => s.name === schemaName);

  if (!schema) {
    throw new Error(`Schema ${schemaName} not found in ${databaseName}`);
  }

  const assets = await atlanApi.fetchAssetsForModel({
    connector: connectionName,
    schemaQualifiedName: schema.qualifiedName,
    assetTypes: ['Table', 'View', 'MaterializedView'],
    size: options?.limit || 1000,
  });

  return {
    data: { assets: assets as AtlanAssetSummary[], totalCount: assets.length },
    source: 'api',
    fallbackUsed: backend === 'mdlh',
    fallbackReason: backend === 'mdlh' ? 'MDLH request failed' : undefined,
  };
}

/**
 * Load all assets using the appropriate backend.
 */
export async function loadAllAssets(options?: {
  limit?: number;
  offset?: number;
  onProgress?: (loaded: number, total: number) => void;
}): Promise<LoadResult<{ assets: AtlanAssetSummary[]; totalCount: number }>> {
  const backend = getEffectiveBackend();

  if (backend === 'mdlh') {
    try {
      logger.debug('[UnifiedLoader] Loading all assets from MDLH');
      const result = await mdlhClient.getHierarchyAssets({
        limit: options?.limit || 1000,
        offset: options?.offset || 0,
      });
      options?.onProgress?.(result.assets.length, result.totalCount);
      return {
        data: { assets: result.assets, totalCount: result.totalCount },
        source: 'mdlh',
        fallbackUsed: false,
      };
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'MDLH all assets fetch failed';
      logger.warn('[UnifiedLoader] MDLH all assets failed, falling back to API:', reason);
      triggerFallback(reason);
      // Fall through to API
    }
  }

  // API path - use the bulk loader
  logger.debug('[UnifiedLoader] Loading all assets from API');
  const { loadAssetsBulk } = await import('../services/atlan/bulkLoader');
  const result = await loadAssetsBulk({
    assetTypes: ['Table', 'View', 'MaterializedView'],
    maxAssets: options?.limit || 10000,
    batchSize: 1000,
    onProgress: options?.onProgress,
  });

  return {
    data: { assets: result.assets as AtlanAssetSummary[], totalCount: result.totalCount },
    source: 'api',
    fallbackUsed: backend === 'mdlh',
    fallbackReason: backend === 'mdlh' ? 'MDLH request failed' : undefined,
  };
}

// ============================================
// Utility Exports
// ============================================

export { getEffectiveBackend };
