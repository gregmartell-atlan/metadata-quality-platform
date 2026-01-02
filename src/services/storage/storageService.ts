/**
 * Storage Service
 *
 * Main storage abstraction that provides:
 * - Session persistence (working context)
 * - Historical trend data management
 * - Auto-snapshot functionality
 *
 * Designed to work with localStorage now, Dapr/backend API later.
 */

import type {
  StorageBackend,
  SessionState,
  DailyAggregation,
  TrendData,
  StorageConfig,
} from './types';
import { DEFAULT_STORAGE_CONFIG, STORAGE_KEYS } from './types';
import { LocalStorageBackend } from './localStorageBackend';
import type { QualitySnapshot } from '../../stores/qualitySnapshotStore';
import { logger } from '../../utils/logger';

/**
 * Generate a unique session ID
 */
function generateSessionId(): string {
  return `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Get today's date as ISO string (YYYY-MM-DD)
 */
function getTodayDateString(): string {
  return new Date().toISOString().split('T')[0];
}

/**
 * Storage Service class
 */
class StorageService {
  private backend: StorageBackend;
  private config: StorageConfig;
  private sessionId: string;

  constructor(config: Partial<StorageConfig> = {}) {
    this.config = { ...DEFAULT_STORAGE_CONFIG, ...config };
    this.backend = new LocalStorageBackend(this.config.namespace || '');
    this.sessionId = generateSessionId();

    logger.info('[StorageService] Initialized with backend:', this.config.backend);
  }

  /**
   * Set a different storage backend (for future Dapr/API integration)
   */
  setBackend(backend: StorageBackend): void {
    this.backend = backend;
    logger.info('[StorageService] Backend changed');
  }

  // ============================================================
  // Session Management
  // ============================================================

  /**
   * Save current session state
   */
  async saveSession(state: Partial<SessionState>): Promise<void> {
    const current = await this.getSession();
    const updated: SessionState = {
      ...current,
      ...state,
      lastActiveTimestamp: Date.now(),
      sessionId: this.sessionId,
    };

    await this.backend.setState(STORAGE_KEYS.SESSION, updated);
    logger.debug('[StorageService] Session saved');
  }

  /**
   * Get current session state
   */
  async getSession(): Promise<SessionState> {
    const session = await this.backend.getState<SessionState>(STORAGE_KEYS.SESSION);

    if (!session) {
      return {
        lastActiveTimestamp: Date.now(),
        sessionId: this.sessionId,
      };
    }

    return session;
  }

  /**
   * Update last query context
   */
  async saveLastQuery(query: SessionState['lastQuery']): Promise<void> {
    await this.saveSession({ lastQuery: query });
  }

  /**
   * Save last loaded asset GUIDs (for session restore)
   */
  async saveLastAssetGUIDs(guids: string[]): Promise<void> {
    await this.saveSession({ lastAssetGUIDs: guids });
  }

  /**
   * Check if there's a restorable session
   */
  async hasRestorableSession(): Promise<boolean> {
    const session = await this.getSession();
    const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days

    return !!(
      session.lastAssetGUIDs?.length &&
      session.lastActiveTimestamp &&
      Date.now() - session.lastActiveTimestamp < maxAge
    );
  }

  // ============================================================
  // Trend Data Management
  // ============================================================

  /**
   * Get historical trend data
   */
  async getTrendData(): Promise<TrendData> {
    const data = await this.backend.getState<TrendData>(STORAGE_KEYS.TREND_DATA);

    if (!data) {
      return {
        dailyAggregations: [],
        lastUpdated: Date.now(),
        oldestDate: getTodayDateString(),
        newestDate: getTodayDateString(),
      };
    }

    return data;
  }

  /**
   * Add or update daily aggregation
   */
  async addDailyAggregation(aggregation: DailyAggregation): Promise<void> {
    const data = await this.getTrendData();

    // Check if we already have an entry for this date
    const existingIndex = data.dailyAggregations.findIndex(
      (a) => a.date === aggregation.date
    );

    if (existingIndex >= 0) {
      // Update existing entry
      data.dailyAggregations[existingIndex] = aggregation;
    } else {
      // Add new entry
      data.dailyAggregations.push(aggregation);
    }

    // Sort by date (newest first)
    data.dailyAggregations.sort((a, b) => b.timestamp - a.timestamp);

    // Trim to max aggregations
    if (data.dailyAggregations.length > this.config.maxDailyAggregations) {
      data.dailyAggregations = data.dailyAggregations.slice(
        0,
        this.config.maxDailyAggregations
      );
    }

    // Update metadata
    data.lastUpdated = Date.now();
    if (data.dailyAggregations.length > 0) {
      data.newestDate = data.dailyAggregations[0].date;
      data.oldestDate = data.dailyAggregations[data.dailyAggregations.length - 1].date;
    }

    await this.backend.setState(STORAGE_KEYS.TREND_DATA, data);
    logger.debug('[StorageService] Daily aggregation saved for', aggregation.date);
  }

  /**
   * Get aggregations for a date range
   */
  async getAggregationsInRange(
    startDate: Date,
    endDate: Date
  ): Promise<DailyAggregation[]> {
    const data = await this.getTrendData();
    const startStr = startDate.toISOString().split('T')[0];
    const endStr = endDate.toISOString().split('T')[0];

    return data.dailyAggregations.filter(
      (a) => a.date >= startStr && a.date <= endStr
    );
  }

  /**
   * Get trend data for last N days
   */
  async getRecentTrend(days: number = 30): Promise<DailyAggregation[]> {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    return this.getAggregationsInRange(startDate, endDate);
  }

  // ============================================================
  // Auto-Snapshot Functionality
  // ============================================================

  /**
   * Check if enough time has passed for auto-snapshot
   */
  async shouldAutoSnapshot(): Promise<boolean> {
    if (!this.config.autoSnapshotEnabled) return false;

    const lastSnapshot = await this.backend.getState<number>(
      STORAGE_KEYS.LAST_AUTO_SNAPSHOT
    );

    if (!lastSnapshot) return true;

    return Date.now() - lastSnapshot >= this.config.autoSnapshotIntervalMs;
  }

  /**
   * Record that an auto-snapshot was taken
   */
  async recordAutoSnapshot(): Promise<void> {
    await this.backend.setState(STORAGE_KEYS.LAST_AUTO_SNAPSHOT, Date.now());
  }

  /**
   * Create daily aggregation from current scores
   */
  createDailyAggregation(
    assetsWithScores: Array<{
      metadata: { assetType?: string };
      scores: { completeness: number; accuracy: number; timeliness: number; consistency: number; usability: number; overall: number };
    }>,
    stats: {
      assetsWithDescriptions: number;
      assetsWithOwners: number;
      staleAssets: number;
      certifiedAssets: number;
    },
    queryContext?: { connectionFilter?: string; domainFilter?: string }
  ): DailyAggregation {
    const now = new Date();

    // Calculate average scores
    const totalScores = assetsWithScores.reduce(
      (acc, { scores }) => ({
        completeness: acc.completeness + scores.completeness,
        accuracy: acc.accuracy + scores.accuracy,
        timeliness: acc.timeliness + scores.timeliness,
        consistency: acc.consistency + scores.consistency,
        usability: acc.usability + scores.usability,
        overall: acc.overall + scores.overall,
      }),
      { completeness: 0, accuracy: 0, timeliness: 0, consistency: 0, usability: 0, overall: 0 }
    );

    const count = assetsWithScores.length || 1;

    // Count by asset type
    const assetsByType: Record<string, number> = {};
    assetsWithScores.forEach(({ metadata }) => {
      const type = metadata.assetType || 'Unknown';
      assetsByType[type] = (assetsByType[type] || 0) + 1;
    });

    return {
      date: now.toISOString().split('T')[0],
      timestamp: now.getTime(),
      totalAssets: assetsWithScores.length,
      assetsByType,
      scores: {
        completeness: Math.round(totalScores.completeness / count),
        accuracy: Math.round(totalScores.accuracy / count),
        timeliness: Math.round(totalScores.timeliness / count),
        consistency: Math.round(totalScores.consistency / count),
        usability: Math.round(totalScores.usability / count),
        overall: Math.round(totalScores.overall / count),
      },
      stats,
      queryContext,
    };
  }

  // ============================================================
  // Utility Methods
  // ============================================================

  /**
   * Get storage statistics
   */
  async getStorageStats(): Promise<{
    isAvailable: boolean;
    trendDataDays: number;
    sessionAge: number | null;
  }> {
    const isAvailable = await this.backend.isAvailable();
    const trendData = await this.getTrendData();
    const session = await this.getSession();

    return {
      isAvailable,
      trendDataDays: trendData.dailyAggregations.length,
      sessionAge: session.lastActiveTimestamp
        ? Date.now() - session.lastActiveTimestamp
        : null,
    };
  }

  /**
   * Clear all storage data
   */
  async clearAll(): Promise<void> {
    await this.backend.deleteState(STORAGE_KEYS.SESSION);
    await this.backend.deleteState(STORAGE_KEYS.TREND_DATA);
    await this.backend.deleteState(STORAGE_KEYS.LAST_AUTO_SNAPSHOT);
    logger.info('[StorageService] All storage cleared');
  }

  /**
   * Export all data (for backup/debugging)
   */
  async exportData(): Promise<{
    session: SessionState;
    trendData: TrendData;
    exportedAt: number;
  }> {
    return {
      session: await this.getSession(),
      trendData: await this.getTrendData(),
      exportedAt: Date.now(),
    };
  }
}

/**
 * Singleton instance
 */
export const storageService = new StorageService();

/**
 * Export class for testing/custom instances
 */
export { StorageService };
