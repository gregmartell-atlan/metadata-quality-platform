/**
 * MDLH Dashboard Stats Hook
 * 
 * Provides server-side aggregated stats from MDLH when connected.
 * Falls back to client-side computation when not connected.
 */

import { useState, useEffect, useCallback } from 'react';
import { useBackendModeStore } from '../stores/backendModeStore';
import * as mdlhClient from '../services/mdlhClient';
import { logger } from '../utils/logger';

export interface MdlhDashboardStats {
  totalAssets: number;
  avgScores: {
    completeness: number;
    accuracy: number;
    timeliness: number;
    consistency: number;
    usability: number;
    overall: number;
  };
  coverage: {
    pctWithDescription: number;
    pctWithOwner: number;
    pctWithTags: number;
    pctCertified: number;
    pctWithLineage: number;
    pctWithReadme: number;
    pctWithTerms: number;
  };
  byConnector: Array<{
    name: string;
    assetCount: number;
    avgCompleteness: number;
    avgAccuracy: number;
    avgTimeliness: number;
    avgConsistency: number;
    avgUsability: number;
    avgOverall: number;
  }>;
}

interface UseMdlhDashboardStatsResult {
  stats: MdlhDashboardStats | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  isMdlhMode: boolean;
}

/**
 * Hook to fetch dashboard stats from MDLH server-side aggregations.
 * Returns null for stats when not in MDLH mode.
 */
export function useMdlhDashboardStats(): UseMdlhDashboardStatsResult {
  const { dataBackend, snowflakeStatus, connectionVersion } = useBackendModeStore();
  const [stats, setStats] = useState<MdlhDashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isMdlhMode = dataBackend === 'mdlh' && snowflakeStatus.connected;

  const fetchStats = useCallback(async () => {
    if (!isMdlhMode) {
      setStats(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      logger.debug('[useMdlhDashboardStats] Fetching MDLH dashboard stats');

      // Fetch rollup by connector for overview
      const rollupResult = await mdlhClient.getQualityRollup({
        dimension: 'connector',
      });

      // Calculate totals from rollups
      let totalAssets = 0;
      let sumCompleteness = 0;
      let sumAccuracy = 0;
      let sumTimeliness = 0;
      let sumConsistency = 0;
      let sumUsability = 0;
      let sumPctDescription = 0;
      let sumPctOwner = 0;
      let sumPctTags = 0;
      let sumPctCertified = 0;
      let sumPctLineage = 0;
      let sumPctReadme = 0;
      let sumPctTerms = 0;

      const byConnector: MdlhDashboardStats['byConnector'] = [];

      for (const r of rollupResult.rollups) {
        totalAssets += r.TOTAL_ASSETS;
        sumCompleteness += r.AVG_COMPLETENESS * r.TOTAL_ASSETS;
        sumAccuracy += r.AVG_ACCURACY * r.TOTAL_ASSETS;
        sumTimeliness += r.AVG_TIMELINESS * r.TOTAL_ASSETS;
        sumConsistency += r.AVG_CONSISTENCY * r.TOTAL_ASSETS;
        sumUsability += r.AVG_USABILITY * r.TOTAL_ASSETS;
        sumPctDescription += r.PCT_WITH_DESCRIPTION * r.TOTAL_ASSETS;
        sumPctOwner += r.PCT_WITH_OWNER * r.TOTAL_ASSETS;
        sumPctTags += r.PCT_WITH_TAGS * r.TOTAL_ASSETS;
        sumPctCertified += r.PCT_CERTIFIED * r.TOTAL_ASSETS;
        sumPctLineage += r.PCT_WITH_LINEAGE * r.TOTAL_ASSETS;
        sumPctReadme += (r as any).PCT_WITH_README * r.TOTAL_ASSETS || 0;
        sumPctTerms += (r as any).PCT_WITH_TERMS * r.TOTAL_ASSETS || 0;

        const avgOverall = r.AVG_OVERALL ?? (
          r.AVG_COMPLETENESS * 0.25 +
          r.AVG_ACCURACY * 0.2 +
          r.AVG_TIMELINESS * 0.2 +
          r.AVG_CONSISTENCY * 0.15 +
          r.AVG_USABILITY * 0.2
        );

        byConnector.push({
          name: r.DIMENSION_VALUE || 'Unknown',
          assetCount: r.TOTAL_ASSETS,
          avgCompleteness: Math.round(r.AVG_COMPLETENESS),
          avgAccuracy: Math.round(r.AVG_ACCURACY),
          avgTimeliness: Math.round(r.AVG_TIMELINESS),
          avgConsistency: Math.round(r.AVG_CONSISTENCY),
          avgUsability: Math.round(r.AVG_USABILITY),
          avgOverall: Math.round(avgOverall),
        });
      }

      const avgCompleteness = totalAssets > 0 ? sumCompleteness / totalAssets : 0;
      const avgAccuracy = totalAssets > 0 ? sumAccuracy / totalAssets : 0;
      const avgTimeliness = totalAssets > 0 ? sumTimeliness / totalAssets : 0;
      const avgConsistency = totalAssets > 0 ? sumConsistency / totalAssets : 0;
      const avgUsability = totalAssets > 0 ? sumUsability / totalAssets : 0;
      const avgOverall = avgCompleteness * 0.25 +
        avgAccuracy * 0.2 +
        avgTimeliness * 0.2 +
        avgConsistency * 0.15 +
        avgUsability * 0.2;

      setStats({
        totalAssets,
        avgScores: {
          completeness: Math.round(avgCompleteness),
          accuracy: Math.round(avgAccuracy),
          timeliness: Math.round(avgTimeliness),
          consistency: Math.round(avgConsistency),
          usability: Math.round(avgUsability),
          overall: Math.round(avgOverall),
        },
        coverage: {
          pctWithDescription: totalAssets > 0 ? Math.round(sumPctDescription / totalAssets) : 0,
          pctWithOwner: totalAssets > 0 ? Math.round(sumPctOwner / totalAssets) : 0,
          pctWithTags: totalAssets > 0 ? Math.round(sumPctTags / totalAssets) : 0,
          pctCertified: totalAssets > 0 ? Math.round(sumPctCertified / totalAssets) : 0,
          pctWithLineage: totalAssets > 0 ? Math.round(sumPctLineage / totalAssets) : 0,
          pctWithReadme: totalAssets > 0 ? Math.round(sumPctReadme / totalAssets) : 0,
          pctWithTerms: totalAssets > 0 ? Math.round(sumPctTerms / totalAssets) : 0,
        },
        byConnector,
      });

      logger.info('[useMdlhDashboardStats] Fetched MDLH stats:', {
        totalAssets,
        connectorCount: byConnector.length,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch MDLH stats';
      logger.error('[useMdlhDashboardStats] Error:', message);
      setError(message);
      setStats(null);
    } finally {
      setIsLoading(false);
    }
  }, [isMdlhMode]);

  // Fetch stats when MDLH mode changes or connection version changes
  useEffect(() => {
    fetchStats();
  }, [fetchStats, connectionVersion]);

  return {
    stats,
    isLoading,
    error,
    refresh: fetchStats,
    isMdlhMode,
  };
}

/**
 * Hook for fetching MDLH pivot data with server-side aggregation.
 */
export function useMdlhPivotData(options?: {
  rowDimension?: string;
  columnDimension?: string;
  metric?: string;
  assetType?: string;
}) {
  const { dataBackend, snowflakeStatus, connectionVersion } = useBackendModeStore();
  const [pivotData, setPivotData] = useState<{
    columns: string[];
    data: Record<string, Record<string, number>>;
    rowDimension: string;
    columnDimension: string;
    metric: string;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isMdlhMode = dataBackend === 'mdlh' && snowflakeStatus.connected;

  const fetchPivotData = useCallback(async () => {
    if (!isMdlhMode) {
      setPivotData(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      logger.debug('[useMdlhPivotData] Fetching MDLH pivot data');

      const result = await mdlhClient.getPivotData({
        rowDimension: options?.rowDimension || 'connector',
        columnDimension: options?.columnDimension || 'asset_type',
        metric: options?.metric || 'count',
        assetType: options?.assetType,
      });

      setPivotData({
        columns: result.columns,
        data: result.data,
        rowDimension: result.row_dimension,
        columnDimension: result.column_dimension,
        metric: result.metric,
      });

      logger.info('[useMdlhPivotData] Fetched MDLH pivot data:', {
        rows: Object.keys(result.data).length,
        columns: result.columns.length,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch pivot data';
      logger.error('[useMdlhPivotData] Error:', message);
      setError(message);
      setPivotData(null);
    } finally {
      setIsLoading(false);
    }
  }, [isMdlhMode, options?.rowDimension, options?.columnDimension, options?.metric, options?.assetType]);

  useEffect(() => {
    fetchPivotData();
  }, [fetchPivotData, connectionVersion]);

  return {
    pivotData,
    isLoading,
    error,
    refresh: fetchPivotData,
    isMdlhMode,
  };
}
