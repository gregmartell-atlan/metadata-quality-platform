/**
 * Unified Asset Loader
 *
 * Backend-aware routing layer that routes requests to either
 * Atlan REST API or MDLH (Snowflake) based on current configuration.
 *
 * IMPORTANT: NO automatic fallback to API when MDLH fails.
 * If MDLH is selected, requests go to MDLH only. Errors propagate
 * to the UI which should prompt the user to connect or switch backends.
 *
 * Features:
 * - Strict backend selection based on backendModeStore
 * - No auto-fallback - errors propagate for UI handling
 * - Consistent interface regardless of backend
 * - Clear error messages for connection issues
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

/**
 * Custom error for when MDLH connection is required but not available.
 * UI should catch this and prompt the user to connect.
 */
export class MdlhConnectionRequiredError extends Error {
  constructor(message: string = 'MDLH connection required. Please connect to Snowflake.') {
    super(message);
    this.name = 'MdlhConnectionRequiredError';
  }
}

// ============================================
// Backend Detection
// ============================================

/**
 * Get the configured backend.
 * Does NOT auto-fallback. If MDLH is selected but not connected,
 * throws MdlhConnectionRequiredError.
 */
function getEffectiveBackend(): 'api' | 'mdlh' {
  const state = useBackendModeStore.getState();

  if (state.dataBackend === 'mdlh') {
    if (state.snowflakeStatus.connected) {
      return 'mdlh';
    }
    // MDLH selected but not connected - throw error for UI to handle
    logger.warn('[UnifiedLoader] MDLH selected but not connected');
    throw new MdlhConnectionRequiredError();
  }

  return 'api';
}

/**
 * Check if MDLH backend is selected (regardless of connection status).
 * Use this to determine if UI should show MDLH-specific prompts.
 */
export function isMdlhSelected(): boolean {
  const state = useBackendModeStore.getState();
  return state.dataBackend === 'mdlh';
}

/**
 * Check if MDLH is selected but not connected.
 * UI should use this to show connection prompts.
 */
export function needsMdlhConnection(): boolean {
  const state = useBackendModeStore.getState();
  return state.dataBackend === 'mdlh' && !state.snowflakeStatus.connected;
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

// ============================================
// Connector Loading
// ============================================

/**
 * Load connectors using the configured backend.
 * Throws MdlhConnectionRequiredError if MDLH selected but not connected.
 */
export async function loadConnectors(): Promise<LoadResult<ConnectorInfo[]>> {
  const backend = getEffectiveBackend(); // May throw MdlhConnectionRequiredError

  if (backend === 'mdlh') {
    logger.debug('[UnifiedLoader] Loading connectors from MDLH');
    const connectors = await mdlhClient.getHierarchyConnectors();
    return {
      data: connectors,
      source: 'mdlh',
      fallbackUsed: false,
    };
  }

  // API path
  logger.debug('[UnifiedLoader] Loading connectors from API');
  const connectors = await atlanApi.getConnectors();
  return {
    data: connectors,
    source: 'api',
    fallbackUsed: false,
  };
}

// ============================================
// Database Loading
// ============================================

/**
 * Load databases for a connector using the configured backend.
 * Throws MdlhConnectionRequiredError if MDLH selected but not connected.
 */
export async function loadDatabases(
  connectorName: string
): Promise<LoadResult<HierarchyItem[]>> {
  const backend = getEffectiveBackend(); // May throw MdlhConnectionRequiredError

  if (backend === 'mdlh') {
    logger.debug('[UnifiedLoader] Loading databases from MDLH for:', connectorName);
    const databases = await mdlhClient.getHierarchyDatabases(connectorName);
    return {
      data: databases,
      source: 'mdlh',
      fallbackUsed: false,
    };
  }

  // API path
  logger.debug('[UnifiedLoader] Loading databases from API for:', connectorName);
  const databases = await atlanApi.getDatabases(connectorName);
  return {
    data: databases,
    source: 'api',
    fallbackUsed: false,
  };
}

// ============================================
// Schema Loading
// ============================================

/**
 * Load schemas for a database using the configured backend.
 * Throws MdlhConnectionRequiredError if MDLH selected but not connected.
 */
export async function loadSchemas(
  connectorName: string,
  databaseQualifiedName: string,
  databaseName?: string
): Promise<LoadResult<HierarchyItem[]>> {
  const backend = getEffectiveBackend(); // May throw MdlhConnectionRequiredError

  if (backend === 'mdlh') {
    // For MDLH, we need the database name (not qualified name)
    const dbName = databaseName || databaseQualifiedName.split('/').pop() || databaseQualifiedName;
    logger.debug('[UnifiedLoader] Loading schemas from MDLH for:', connectorName, dbName);
    const schemas = await mdlhClient.getHierarchySchemas(connectorName, dbName);
    return {
      data: schemas,
      source: 'mdlh',
      fallbackUsed: false,
    };
  }

  // API path - uses qualified name
  logger.debug('[UnifiedLoader] Loading schemas from API for:', databaseQualifiedName);
  const schemas = await atlanApi.getSchemas(databaseQualifiedName);
  return {
    data: schemas,
    source: 'api',
    fallbackUsed: false,
  };
}

// ============================================
// Table Loading
// ============================================

/**
 * Load tables for a schema using the configured backend.
 * Throws MdlhConnectionRequiredError if MDLH selected but not connected.
 */
export async function loadTables(
  connectorName: string,
  databaseName: string,
  schemaQualifiedName: string,
  schemaName?: string
): Promise<LoadResult<HierarchyItem[]>> {
  const backend = getEffectiveBackend(); // May throw MdlhConnectionRequiredError

  if (backend === 'mdlh') {
    // For MDLH, we need the schema name (not qualified name)
    const sName = schemaName || schemaQualifiedName.split('/').pop() || schemaQualifiedName;
    logger.debug('[UnifiedLoader] Loading tables from MDLH for:', connectorName, databaseName, sName);
    const tables = await mdlhClient.getHierarchyTables(connectorName, databaseName, sName);
    return {
      data: tables,
      source: 'mdlh',
      fallbackUsed: false,
    };
  }

  // API path - uses qualified name
  logger.debug('[UnifiedLoader] Loading tables from API for:', schemaQualifiedName);
  const tables = await atlanApi.getTables(schemaQualifiedName);
  return {
    data: tables,
    source: 'api',
    fallbackUsed: false,
  };
}

// ============================================
// Asset Details Loading
// ============================================

/**
 * Load full asset details by GUID using the configured backend.
 * Throws MdlhConnectionRequiredError if MDLH selected but not connected.
 */
export async function loadAssetDetails(guid: string): Promise<LoadResult<AtlanAsset | null>> {
  const backend = getEffectiveBackend(); // May throw MdlhConnectionRequiredError

  if (backend === 'mdlh') {
    logger.debug('[UnifiedLoader] Loading asset details from MDLH for:', guid);
    const asset = await mdlhClient.getAssetDetails(guid);
    return {
      data: asset,
      source: 'mdlh',
      fallbackUsed: false,
    };
  }

  // API path
  logger.debug('[UnifiedLoader] Loading asset details from API for:', guid);
  const asset = await atlanApi.getAsset(guid);
  return {
    data: asset,
    source: 'api',
    fallbackUsed: false,
  };
}

// ============================================
// Bulk Asset Loading for Context
// ============================================

/**
 * Load assets for a connection context using the configured backend.
 * Throws MdlhConnectionRequiredError if MDLH selected but not connected.
 */
export async function loadAssetsForConnection(
  connectionName: string,
  options?: {
    limit?: number;
    offset?: number;
    onProgress?: (loaded: number, total: number) => void;
  }
): Promise<LoadResult<{ assets: AtlanAssetSummary[]; totalCount: number }>> {
  const backend = getEffectiveBackend(); // May throw MdlhConnectionRequiredError

  if (backend === 'mdlh') {
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
    fallbackUsed: false,
  };
}

/**
 * Load assets for a database context using the configured backend.
 * Throws MdlhConnectionRequiredError if MDLH selected but not connected.
 */
export async function loadAssetsForDatabase(
  connectionName: string,
  databaseName: string,
  options?: {
    limit?: number;
    offset?: number;
  }
): Promise<LoadResult<{ assets: AtlanAssetSummary[]; totalCount: number }>> {
  const backend = getEffectiveBackend(); // May throw MdlhConnectionRequiredError

  if (backend === 'mdlh') {
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
    fallbackUsed: false,
  };
}

/**
 * Load assets for a schema context using the configured backend.
 * Throws MdlhConnectionRequiredError if MDLH selected but not connected.
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
  const backend = getEffectiveBackend(); // May throw MdlhConnectionRequiredError

  if (backend === 'mdlh') {
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
    fallbackUsed: false,
  };
}

/**
 * Load all assets using the configured backend.
 * Throws MdlhConnectionRequiredError if MDLH selected but not connected.
 */
export async function loadAllAssets(options?: {
  limit?: number;
  offset?: number;
  onProgress?: (loaded: number, total: number) => void;
}): Promise<LoadResult<{ assets: AtlanAssetSummary[]; totalCount: number }>> {
  const backend = getEffectiveBackend(); // May throw MdlhConnectionRequiredError

  if (backend === 'mdlh') {
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
    fallbackUsed: false,
  };
}

// ============================================
// Utility Exports
// ============================================

// Note: MdlhConnectionRequiredError is already exported at its class definition
export { getEffectiveBackend };
