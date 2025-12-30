/**
 * Atlan Integration Service
 * 
 * Provides authentication, asset fetching, and data transformation
 * for integrating with Atlan APIs
 */

export * from './types';
export * from './api';
export * from './transformer';

// Re-export commonly used functions
export {
  configureAtlanApi,
  getAtlanConfig,
  getAtlanClient,
  getSavedAtlanBaseUrl,
  isConfigured,
  testConnection,
  testAtlanConnection,
  searchAssets,
  searchByType,
  getAssetsByConnection,
  fetchAssetsForModel,
  getAsset,
  getLineage,
  getConnectors,
  getDatabases,
  getSchemas,
  clearCache,
  clearAtlanConfig,
} from './api';

// Re-export types
export type { ConnectorInfo, HierarchyItem } from './api';

export {
  transformAtlanAsset,
  transformAtlanAssets,
  extractHierarchy,
} from './transformer';

