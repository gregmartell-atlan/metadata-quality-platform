/**
 * Storage Service Exports
 */

export { storageService, StorageService } from './storageService';
export { localStorageBackend, LocalStorageBackend } from './localStorageBackend';
export type {
  StorageBackend,
  StateOptions,
  ObjectOptions,
  SessionState,
  DailyAggregation,
  TrendData,
  StorageConfig,
} from './types';
export { DEFAULT_STORAGE_CONFIG, STORAGE_KEYS } from './types';
