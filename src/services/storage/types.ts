/**
 * Storage Service Types
 *
 * Defines interfaces for the storage abstraction layer.
 * Designed to work with localStorage now, Dapr/backend later.
 */

import type { QualitySnapshot } from '../../stores/qualitySnapshotStore';

/**
 * Storage backend interface - implement this for different backends
 */
export interface StorageBackend {
  // Key-value state operations
  getState<T>(key: string): Promise<T | null>;
  setState<T>(key: string, value: T, options?: StateOptions): Promise<void>;
  deleteState(key: string): Promise<void>;

  // Object storage operations (for larger data)
  getObject<T>(key: string): Promise<T | null>;
  putObject<T>(key: string, value: T, options?: ObjectOptions): Promise<void>;
  deleteObject(key: string): Promise<void>;
  listObjects(prefix?: string): Promise<string[]>;

  // Bulk operations
  getMultiple<T>(keys: string[]): Promise<Map<string, T>>;
  setMultiple<T>(entries: Map<string, T>): Promise<void>;

  // Health check
  isAvailable(): Promise<boolean>;
}

export interface StateOptions {
  ttlSeconds?: number;  // Time-to-live in seconds
  namespace?: string;   // Optional namespace prefix
}

export interface ObjectOptions {
  contentType?: string;
  metadata?: Record<string, string>;
}

/**
 * Session state - persisted working context
 */
export interface SessionState {
  // Last query context
  lastQuery?: {
    connectionFilter?: string;
    domainFilter?: string;
    assetTypeFilters?: string[];
    searchQuery?: string;
    timestamp: number;
  };

  // Last loaded asset GUIDs (not full assets - fetch fresh on restore)
  lastAssetGUIDs?: string[];

  // Session metadata
  lastActiveTimestamp: number;
  sessionId: string;
}

/**
 * Daily aggregation for trend analysis
 */
export interface DailyAggregation {
  date: string;  // ISO date string (YYYY-MM-DD)
  timestamp: number;

  // Asset counts
  totalAssets: number;
  assetsByType: Record<string, number>;

  // Overall scores
  scores: {
    completeness: number;
    accuracy: number;
    timeliness: number;
    consistency: number;
    usability: number;
    overall: number;
  };

  // Key metrics
  stats: {
    assetsWithDescriptions: number;
    assetsWithOwners: number;
    staleAssets: number;
    certifiedAssets: number;
  };

  // Query context (what was measured)
  queryContext?: {
    connectionFilter?: string;
    domainFilter?: string;
  };
}

/**
 * Historical trend data
 */
export interface TrendData {
  // Daily aggregations (up to 90 days)
  dailyAggregations: DailyAggregation[];

  // Metadata
  lastUpdated: number;
  oldestDate: string;
  newestDate: string;
}

/**
 * Storage service configuration
 */
export interface StorageConfig {
  // Backend type
  backend: 'localStorage' | 'dapr' | 'api';

  // Storage limits
  maxSnapshots: number;
  maxDailyAggregations: number;

  // Auto-snapshot settings
  autoSnapshotEnabled: boolean;
  autoSnapshotIntervalMs: number;  // Minimum time between auto-snapshots

  // Namespace for multi-tenant support
  namespace?: string;
}

/**
 * Default storage configuration
 */
export const DEFAULT_STORAGE_CONFIG: StorageConfig = {
  backend: 'localStorage',
  maxSnapshots: 50,
  maxDailyAggregations: 90,
  autoSnapshotEnabled: true,
  autoSnapshotIntervalMs: 60 * 60 * 1000,  // 1 hour minimum between auto-snapshots
};

/**
 * Storage keys constants
 */
export const STORAGE_KEYS = {
  SESSION: 'mqp:session',
  TREND_DATA: 'mqp:trends',
  SNAPSHOTS: 'mqp:snapshots',
  CONFIG: 'mqp:config',
  LAST_AUTO_SNAPSHOT: 'mqp:lastAutoSnapshot',
} as const;
