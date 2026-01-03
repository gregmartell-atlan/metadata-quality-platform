/**
 * Trend Data Hook
 *
 * Provides access to historical trend data for charts and analysis.
 */

import { useState, useEffect, useCallback } from 'react';
import { storageService } from '../services/storage';
import type { DailyAggregation, TrendData } from '../services/storage';
import { logger } from '../utils/logger';

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
 */
export function useTrendChartData(days: number = 30) {
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
    }>
  >([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true);
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
        logger.debug('[useTrendChartData] Prepared', data.length, 'data points');
      } catch (err) {
        logger.error('[useTrendChartData] Failed to load chart data:', err);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [days]);

  return { chartData, isLoading };
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
