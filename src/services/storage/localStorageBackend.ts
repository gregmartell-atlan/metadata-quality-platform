/**
 * LocalStorage Backend
 *
 * Implements StorageBackend interface using browser localStorage.
 * Handles serialization, TTL, and storage limits.
 */

import type { StorageBackend, StateOptions, ObjectOptions } from './types';
import { logger } from '../../utils/logger';

interface StoredItem<T> {
  value: T;
  expiresAt?: number;  // Unix timestamp
  createdAt: number;
  metadata?: Record<string, string>;
}

const PREFIX = 'mqp:';
const MAX_STORAGE_MB = 4;  // Leave 1MB buffer from 5MB limit

/**
 * Get current storage usage in bytes
 */
function getStorageUsage(): number {
  let total = 0;
  for (const key in localStorage) {
    if (key.startsWith(PREFIX)) {
      total += localStorage.getItem(key)?.length || 0;
    }
  }
  return total * 2;  // UTF-16 encoding = 2 bytes per char
}

/**
 * Check if we're approaching storage limit
 */
function isNearLimit(): boolean {
  const usage = getStorageUsage();
  const limitBytes = MAX_STORAGE_MB * 1024 * 1024;
  return usage > limitBytes * 0.9;
}

/**
 * Prune expired and old items if approaching limit
 */
function pruneIfNeeded(): void {
  if (!isNearLimit()) return;

  logger.info('[LocalStorage] Approaching storage limit, pruning old items...');

  const now = Date.now();
  const items: Array<{ key: string; createdAt: number; size: number }> = [];

  // Collect all items with metadata
  for (const key in localStorage) {
    if (!key.startsWith(PREFIX)) continue;

    try {
      const raw = localStorage.getItem(key);
      if (!raw) continue;

      const item = JSON.parse(raw) as StoredItem<unknown>;

      // Remove expired items immediately
      if (item.expiresAt && item.expiresAt < now) {
        localStorage.removeItem(key);
        continue;
      }

      items.push({
        key,
        createdAt: item.createdAt || 0,
        size: raw.length * 2,
      });
    } catch {
      // Invalid JSON, remove it
      localStorage.removeItem(key);
    }
  }

  // Sort by age (oldest first) and remove until under limit
  items.sort((a, b) => a.createdAt - b.createdAt);

  let removed = 0;
  while (isNearLimit() && items.length > 0) {
    const oldest = items.shift();
    if (oldest) {
      localStorage.removeItem(oldest.key);
      removed++;
    }
  }

  if (removed > 0) {
    logger.info(`[LocalStorage] Pruned ${removed} old items`);
  }
}

/**
 * LocalStorage implementation of StorageBackend
 */
export class LocalStorageBackend implements StorageBackend {
  private namespace: string;

  constructor(namespace: string = '') {
    this.namespace = namespace;
  }

  private getKey(key: string): string {
    return `${PREFIX}${this.namespace}${key}`;
  }

  async getState<T>(key: string): Promise<T | null> {
    try {
      const fullKey = this.getKey(key);
      const raw = localStorage.getItem(fullKey);

      if (!raw) return null;

      const item = JSON.parse(raw) as StoredItem<T>;

      // Check expiration
      if (item.expiresAt && item.expiresAt < Date.now()) {
        localStorage.removeItem(fullKey);
        return null;
      }

      return item.value;
    } catch (error) {
      logger.warn(`[LocalStorage] Error getting state for ${key}:`, error);
      return null;
    }
  }

  async setState<T>(key: string, value: T, options?: StateOptions): Promise<void> {
    try {
      pruneIfNeeded();

      const fullKey = this.getKey(key);
      const item: StoredItem<T> = {
        value,
        createdAt: Date.now(),
      };

      if (options?.ttlSeconds) {
        item.expiresAt = Date.now() + options.ttlSeconds * 1000;
      }

      localStorage.setItem(fullKey, JSON.stringify(item));
    } catch (error) {
      logger.error(`[LocalStorage] Error setting state for ${key}:`, error);
      throw error;
    }
  }

  async deleteState(key: string): Promise<void> {
    localStorage.removeItem(this.getKey(key));
  }

  async getObject<T>(key: string): Promise<T | null> {
    // For localStorage, objects and state are stored the same way
    return this.getState<T>(`obj:${key}`);
  }

  async putObject<T>(key: string, value: T, options?: ObjectOptions): Promise<void> {
    try {
      pruneIfNeeded();

      const fullKey = this.getKey(`obj:${key}`);
      const item: StoredItem<T> = {
        value,
        createdAt: Date.now(),
        metadata: options?.metadata,
      };

      localStorage.setItem(fullKey, JSON.stringify(item));
    } catch (error) {
      logger.error(`[LocalStorage] Error putting object for ${key}:`, error);
      throw error;
    }
  }

  async deleteObject(key: string): Promise<void> {
    localStorage.removeItem(this.getKey(`obj:${key}`));
  }

  async listObjects(prefix?: string): Promise<string[]> {
    const keys: string[] = [];
    const searchPrefix = this.getKey(`obj:${prefix || ''}`);

    for (const key in localStorage) {
      if (key.startsWith(searchPrefix)) {
        // Extract the object key without the prefix
        const objKey = key.slice(this.getKey('obj:').length);
        keys.push(objKey);
      }
    }

    return keys;
  }

  async getMultiple<T>(keys: string[]): Promise<Map<string, T>> {
    const results = new Map<string, T>();

    for (const key of keys) {
      const value = await this.getState<T>(key);
      if (value !== null) {
        results.set(key, value);
      }
    }

    return results;
  }

  async setMultiple<T>(entries: Map<string, T>): Promise<void> {
    for (const [key, value] of entries) {
      await this.setState(key, value);
    }
  }

  async isAvailable(): Promise<boolean> {
    try {
      const testKey = this.getKey('__test__');
      localStorage.setItem(testKey, 'test');
      localStorage.removeItem(testKey);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get storage statistics
   */
  getStats(): { usedBytes: number; usedMB: number; itemCount: number } {
    let usedBytes = 0;
    let itemCount = 0;

    for (const key in localStorage) {
      if (key.startsWith(PREFIX)) {
        usedBytes += (localStorage.getItem(key)?.length || 0) * 2;
        itemCount++;
      }
    }

    return {
      usedBytes,
      usedMB: usedBytes / (1024 * 1024),
      itemCount,
    };
  }

  /**
   * Clear all stored data (use with caution)
   */
  clearAll(): void {
    const keysToRemove: string[] = [];

    for (const key in localStorage) {
      if (key.startsWith(PREFIX)) {
        keysToRemove.push(key);
      }
    }

    keysToRemove.forEach(key => localStorage.removeItem(key));
    logger.info(`[LocalStorage] Cleared ${keysToRemove.length} items`);
  }
}

/**
 * Singleton instance
 */
export const localStorageBackend = new LocalStorageBackend();
