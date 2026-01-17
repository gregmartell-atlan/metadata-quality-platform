/**
 * Trend Data Hook
 *
 * Provides access to historical trend data for charts and analysis.
 * Supports both localStorage (for API mode) and MDLH backend (for MDLH mode).
 */

import { useState, useEffect, useCallback } from 'react';
import { storageService } from '../services/storage';
import type { DailyAggregation, TrendData } from '../services/storage';
import { logger } from '../utils/logger';
import { useBackendModeStore } from '../stores/backendModeStore';
import * as mdlhClient from '../services/mdlhClient';

interface UseTrendDataResult {
  trendData: TrendData | null;
  isLoading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
  getRecentDays: (days: number) => Promise<DailyAggregation[]>;
  getDateRange: (start: Date, end: Date) => Promise<DailyAggregation[]>;
}

/**
 * Hook to access historical trend data
 */
export function useTrendData(): UseTrendDataResult {
  const [trendData, setTrendData] = useState<TrendData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const refresh = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await storageService.getTrendData();
      setTrendData(data);
      logger.debug('[useTrendData] Loaded', data.dailyAggregations.length, 'days of data');
    } catch (err) {
      logger.error('[useTrendData] Failed to load trend data:', err);
      setError(err instanceof Error ? err : new Error('Failed to load trend data'));
    } finally {
      setIsLoading(false);
    }
  }, []);

  const getRecentDays = useCallback(async (days: number): Promise<DailyAggregation[]> => {
    try {
      return await storageService.getRecentTrend(days);
    } catch (err) {
      logger.error('[useTrendData] Failed to get recent trend:', err);
      return [];
    }
  }, []);

  const getDateRange = useCallback(
    async (start: Date, end: Date): Promise<DailyAggregation[]> => {
      try {
        return await storageService.getAggregationsInRange(start, end);
      } catch (err) {
        logger.error('[useTrendData] Failed to get date range:', err);
        return [];
      }
    },
    []
  );

  useEffect(() => {
    refresh();
  }, [refresh]);

  return {
    trendData,
    isLoading,
    error,
    refresh,
    getRecentDays,
    getDateRange,
  };
}

/**
 * Hook for trend chart data formatted for visualization
 *
 * In MDLH mode: Fetches coverage trends from Snowflake based on asset modification dates
 * In API mode: Uses localStorage-based historical snapshots
 */
export function useTrendChartData(
  days: number = 30,
  options?: { assetType?: string; connector?: string }
) {
  const [chartData, setChartData] = useState<
    Array<{
      date: string;
      timestamp: number;
      overall: number;
      completeness: number;
      accuracy: number;
      timeliness: number;
      consistency: number;
      usability: number;
      totalAssets: number;
      // MDLH-specific coverage metrics
      pctWithDescription?: number;
      pctWithOwner?: number;
      pctWithTags?: number;
      pctCertified?: number;
      pctWithLineage?: number;
    }>
  >([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dataSource, setDataSource] = useState<'localStorage' | 'mdlh'>('localStorage');

  const { dataBackend, snowflakeStatus } = useBackendModeStore();

  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true);

        // Use MDLH if connected and selected
        if (dataBackend === 'mdlh' && snowflakeStatus.connected) {
          setDataSource('mdlh');
          logger.debug('[useTrendChartData] Using MDLH backend');

          const result = await mdlhClient.getCoverageTrends({
            days,
            assetType: options?.assetType,
            connector: options?.connector,
          });

          // Transform MDLH trend points to chart format
          const data = result.trend_points.map((point) => ({
            date: point.date,
            timestamp: new Date(point.date).getTime(),
            // Derive overall from completeness for now
            overall: Math.round(point.avg_completeness),
            completeness: Math.round(point.avg_completeness),
            // These are coverage-based, not full quality scores
            accuracy: 0,
            timeliness: 0,
            consistency: 0,
            usability: 0,
            totalAssets: point.assets_modified,
            // Additional coverage metrics from MDLH
            pctWithDescription: Math.round(point.pct_with_description * 100),
            pctWithOwner: Math.round(point.pct_with_owner * 100),
            pctWithTags: Math.round(point.pct_with_tags * 100),
            pctCertified: Math.round(point.pct_certified * 100),
            pctWithLineage: Math.round(point.pct_with_lineage * 100),
          }));

          // Sort by date ascending for charts
          const sorted = [...data].sort((a, b) => a.timestamp - b.timestamp);

          setChartData(sorted);
          logger.debug('[useTrendChartData] MDLH prepared', sorted.length, 'data points');
        } else {
          // Fallback to localStorage
          setDataSource('localStorage');
          logger.debug('[useTrendChartData] Using localStorage backend');

          const aggregations = await storageService.getRecentTrend(days);

          // Sort by date ascending for charts
          const sorted = [...aggregations].sort((a, b) => a.timestamp - b.timestamp);

          const data = sorted.map((agg) => ({
            date: agg.date,
            timestamp: agg.timestamp,
            overall: agg.scores.overall,
            completeness: agg.scores.completeness,
            accuracy: agg.scores.accuracy,
            timeliness: agg.scores.timeliness,
            consistency: agg.scores.consistency,
            usability: agg.scores.usability,
            totalAssets: agg.totalAssets,
          }));

          setChartData(data);
          logger.debug('[useTrendChartData] localStorage prepared', data.length, 'data points');
        }
      } catch (err) {
        logger.error('[useTrendChartData] Failed to load chart data:', err);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [days, dataBackend, snowflakeStatus.connected, options?.assetType, options?.connector]);

  return { chartData, isLoading, dataSource };
}

/**
 * Hook for comparing two time periods
 */
export function useTrendComparison(
  currentDays: number = 7,
  previousDays: number = 7
) {
  const [comparison, setComparison] = useState<{
    current: { avgScore: number; avgAssets: number } | null;
    previous: { avgScore: number; avgAssets: number } | null;
    scoreDelta: number;
    assetsDelta: number;
    percentChange: number;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadComparison = async () => {
      try {
        setIsLoading(true);

        const now = new Date();
        const currentEnd = now;
        const currentStart = new Date(now.getTime() - currentDays * 24 * 60 * 60 * 1000);
        const previousEnd = currentStart;
        const previousStart = new Date(previousEnd.getTime() - previousDays * 24 * 60 * 60 * 1000);

        const [currentData, previousData] = await Promise.all([
          storageService.getAggregationsInRange(currentStart, currentEnd),
          storageService.getAggregationsInRange(previousStart, previousEnd),
        ]);

        const calcAverage = (data: DailyAggregation[]) => {
          if (data.length === 0) return null;
          // Single-pass aggregation
          const totals = data.reduce(
            (acc, d) => ({ score: acc.score + d.scores.overall, assets: acc.assets + d.totalAssets }),
            { score: 0, assets: 0 }
          );
          return {
            avgScore: Math.round(totals.score / data.length),
            avgAssets: Math.round(totals.assets / data.length),
          };
        };

        const current = calcAverage(currentData);
        const previous = calcAverage(previousData);

        const scoreDelta = current && previous ? current.avgScore - previous.avgScore : 0;
        const assetsDelta = current && previous ? current.avgAssets - previous.avgAssets : 0;
        const percentChange =
          previous && previous.avgScore > 0
            ? Math.round((scoreDelta / previous.avgScore) * 100)
            : 0;

        setComparison({
          current,
          previous,
          scoreDelta,
          assetsDelta,
          percentChange,
        });
      } catch (err) {
        logger.error('[useTrendComparison] Failed to load comparison:', err);
      } finally {
        setIsLoading(false);
      }
    };

    loadComparison();
  }, [currentDays, previousDays]);

  return { comparison, isLoading };
}

// ============================================
// MDLH-Specific Hooks
// ============================================

/**
 * Hook to fetch current quality snapshot from MDLH
 *
 * Returns real-time quality metrics for the current state of assets.
 * Can be used to take periodic snapshots for trend tracking.
 */
export function useMdlhSnapshot(options?: {
  assetType?: string;
  connector?: string;
  enabled?: boolean;
}) {
  const [snapshot, setSnapshot] = useState<mdlhClient.MdlhSnapshot | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const { dataBackend, snowflakeStatus } = useBackendModeStore();
  const enabled = options?.enabled !== false;

  const refresh = useCallback(async () => {
    if (!enabled || dataBackend !== 'mdlh' || !snowflakeStatus.connected) {
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const result = await mdlhClient.getSnapshot({
        assetType: options?.assetType,
        connector: options?.connector,
      });

      setSnapshot(result);
      logger.debug('[useMdlhSnapshot] Loaded snapshot:', {
        totalAssets: result.total_assets,
        avgOverall: result.avg_overall,
      });
    } catch (err) {
      logger.error('[useMdlhSnapshot] Failed to load snapshot:', err);
      setError(err instanceof Error ? err : new Error('Failed to load snapshot'));
    } finally {
      setIsLoading(false);
    }
  }, [enabled, dataBackend, snowflakeStatus.connected, options?.assetType, options?.connector]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return {
    snapshot,
    isLoading,
    error,
    refresh,
    isAvailable: dataBackend === 'mdlh' && snowflakeStatus.connected,
  };
}

/**
 * Hook to fetch lineage metrics from MDLH
 *
 * Returns detailed lineage breakdown (upstream/downstream counts, orphaned status)
 */
export function useMdlhLineageMetrics(options?: {
  assetType?: string;
  connector?: string;
  limit?: number;
  enabled?: boolean;
}) {
  const [metrics, setMetrics] = useState<mdlhClient.MdlhLineageMetric[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const { dataBackend, snowflakeStatus } = useBackendModeStore();
  const enabled = options?.enabled !== false;

  const refresh = useCallback(async () => {
    if (!enabled || dataBackend !== 'mdlh' || !snowflakeStatus.connected) {
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const result = await mdlhClient.getLineageMetrics({
        assetType: options?.assetType,
        connector: options?.connector,
        limit: options?.limit || 1000,
      });

      setMetrics(result.assets);
      setTotalCount(result.total_count);
      logger.debug('[useMdlhLineageMetrics] Loaded metrics:', {
        count: result.assets.length,
        total: result.total_count,
      });
    } catch (err) {
      logger.error('[useMdlhLineageMetrics] Failed to load metrics:', err);
      setError(err instanceof Error ? err : new Error('Failed to load lineage metrics'));
    } finally {
      setIsLoading(false);
    }
  }, [
    enabled,
    dataBackend,
    snowflakeStatus.connected,
    options?.assetType,
    options?.connector,
    options?.limit,
  ]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Calculate summary statistics
  const summary = metrics.length > 0
    ? {
        totalAssets: metrics.length,
        withUpstream: metrics.filter((m) => m.has_upstream === 1).length,
        withDownstream: metrics.filter((m) => m.has_downstream === 1).length,
        withFullLineage: metrics.filter((m) => m.full_lineage === 1).length,
        orphaned: metrics.filter((m) => m.orphaned === 1).length,
        avgUpstreamCount: metrics.reduce((sum, m) => sum + m.upstream_count, 0) / metrics.length,
        avgDownstreamCount: metrics.reduce((sum, m) => sum + m.downstream_count, 0) / metrics.length,
      }
    : null;

  return {
    metrics,
    totalCount,
    summary,
    isLoading,
    error,
    refresh,
    isAvailable: dataBackend === 'mdlh' && snowflakeStatus.connected,
  };
}

/**
 * Hook to fetch lineage rollup by dimension from MDLH
 */
export function useMdlhLineageRollup(options?: {
  dimension?: 'connector' | 'database' | 'schema' | 'asset_type' | 'certificate_status';
  assetType?: string;
  enabled?: boolean;
}) {
  const [rollup, setRollup] = useState<mdlhClient.MdlhLineageRollup[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const { dataBackend, snowflakeStatus } = useBackendModeStore();
  const enabled = options?.enabled !== false;

  const refresh = useCallback(async () => {
    if (!enabled || dataBackend !== 'mdlh' || !snowflakeStatus.connected) {
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const result = await mdlhClient.getLineageRollup({
        dimension: options?.dimension,
        assetType: options?.assetType,
      });

      setRollup(result.rollups);
      logger.debug('[useMdlhLineageRollup] Loaded rollup:', {
        dimension: result.dimension,
        count: result.rollups.length,
      });
    } catch (err) {
      logger.error('[useMdlhLineageRollup] Failed to load rollup:', err);
      setError(err instanceof Error ? err : new Error('Failed to load lineage rollup'));
    } finally {
      setIsLoading(false);
    }
  }, [enabled, dataBackend, snowflakeStatus.connected, options?.dimension, options?.assetType]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return {
    rollup,
    isLoading,
    error,
    refresh,
    isAvailable: dataBackend === 'mdlh' && snowflakeStatus.connected,
  };
}

/**
 * Hook to fetch owner list from MDLH
 */
export function useMdlhOwners(options?: {
  assetType?: string;
  limit?: number;
  enabled?: boolean;
}) {
  const [owners, setOwners] = useState<mdlhClient.MdlhOwnerInfo[]>([]);
  const [totalOwners, setTotalOwners] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const { dataBackend, snowflakeStatus } = useBackendModeStore();
  const enabled = options?.enabled !== false;

  const refresh = useCallback(async () => {
    if (!enabled || dataBackend !== 'mdlh' || !snowflakeStatus.connected) {
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const result = await mdlhClient.getOwners({
        assetType: options?.assetType,
        limit: options?.limit,
      });

      setOwners(result.owners);
      setTotalOwners(result.total_owners);
      logger.debug('[useMdlhOwners] Loaded owners:', {
        count: result.owners.length,
        total: result.total_owners,
      });
    } catch (err) {
      logger.error('[useMdlhOwners] Failed to load owners:', err);
      setError(err instanceof Error ? err : new Error('Failed to load owners'));
    } finally {
      setIsLoading(false);
    }
  }, [enabled, dataBackend, snowflakeStatus.connected, options?.assetType, options?.limit]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return {
    owners,
    totalOwners,
    isLoading,
    error,
    refresh,
    isAvailable: dataBackend === 'mdlh' && snowflakeStatus.connected,
  };
}
