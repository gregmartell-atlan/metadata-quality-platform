/**
 * Quality Snapshot Store
 *
 * Manages historical snapshots of quality metrics for "Open Recent" functionality.
 * Stores aggregated quality scores, stats, and query context for each snapshot.
 * Persisted to localStorage for consistency across sessions.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { QualityScores } from '../services/qualityMetrics';

// Maximum number of snapshots to retain
const MAX_SNAPSHOTS = 20;

/**
 * Query parameters used when capturing the snapshot
 */
export interface SnapshotQueryParams {
  connectionFilter?: string;
  domainFilter?: string;
  assetTypeFilters?: string[];
  searchQuery?: string;
}

/**
 * Aggregated stats at time of snapshot
 */
export interface SnapshotStats {
  assetsWithDescriptions: number;
  assetsWithOwners: number;
  staleAssets: number;
  certifiedAssets: number;
}

/**
 * Aggregated scores by dimension (e.g., by domain, owner, connection)
 */
export interface DimensionAggregation {
  [dimensionValue: string]: {
    count: number;
    avgScores: QualityScores & { overall: number };
  };
}

/**
 * Full quality snapshot
 */
export interface QualitySnapshot {
  // Metadata
  id: string;
  timestamp: number;
  label: string;

  // Query context
  queryParams?: SnapshotQueryParams;

  // Asset summary
  totalAssets: number;
  assetsByType: Record<string, number>;

  // Overall aggregated scores
  overallScores: QualityScores & { overall: number };

  // Stats
  stats: SnapshotStats;

  // Aggregations by dimension (for trend analysis)
  byDomain?: DimensionAggregation;
  byOwner?: DimensionAggregation;
  byConnection?: DimensionAggregation;
}

/**
 * Store state and actions
 */
interface QualitySnapshotState {
  snapshots: QualitySnapshot[];

  // Actions
  captureSnapshot: (
    label: string,
    assetsWithScores: Array<{
      metadata: { assetType?: string; domain?: string; owner?: string; ownerGroup?: string; connection?: string };
      scores: QualityScores & { overall: number };
    }>,
    stats: SnapshotStats,
    queryParams?: SnapshotQueryParams
  ) => QualitySnapshot;

  deleteSnapshot: (id: string) => void;
  renameSnapshot: (id: string, newLabel: string) => void;
  getSnapshot: (id: string) => QualitySnapshot | undefined;
  getRecentSnapshots: (limit?: number) => QualitySnapshot[];
  clearAllSnapshots: () => void;

  // Comparison helpers
  compareSnapshots: (id1: string, id2: string) => SnapshotComparison | null;
}

/**
 * Comparison result between two snapshots
 */
export interface SnapshotComparison {
  snapshot1: QualitySnapshot;
  snapshot2: QualitySnapshot;
  timeDelta: number; // milliseconds between snapshots
  assetCountDelta: number;
  scoreDelta: {
    completeness: number;
    accuracy: number;
    timeliness: number;
    consistency: number;
    usability: number;
    overall: number;
  };
  statsDelta: {
    assetsWithDescriptions: number;
    assetsWithOwners: number;
    staleAssets: number;
    certifiedAssets: number;
  };
}

/**
 * Generate unique ID for snapshot
 */
function generateSnapshotId(): string {
  return `snap-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Calculate average scores from array of scored assets
 */
function calculateAverageScores(
  assets: Array<{ scores: QualityScores & { overall: number } }>
): QualityScores & { overall: number } {
  if (assets.length === 0) {
    return { completeness: 0, accuracy: 0, timeliness: 0, consistency: 0, usability: 0, overall: 0 };
  }

  const sum = assets.reduce(
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

  const count = assets.length;
  return {
    completeness: Math.round(sum.completeness / count),
    accuracy: Math.round(sum.accuracy / count),
    timeliness: Math.round(sum.timeliness / count),
    consistency: Math.round(sum.consistency / count),
    usability: Math.round(sum.usability / count),
    overall: Math.round(sum.overall / count),
  };
}

/**
 * Group assets by dimension and calculate aggregated scores
 */
function aggregateByDimension(
  assets: Array<{
    metadata: { domain?: string; owner?: string; ownerGroup?: string; connection?: string };
    scores: QualityScores & { overall: number };
  }>,
  getDimensionValue: (asset: { metadata: { domain?: string; owner?: string; ownerGroup?: string; connection?: string } }) => string
): DimensionAggregation {
  const groups = new Map<string, Array<{ scores: QualityScores & { overall: number } }>>();

  assets.forEach((asset) => {
    const key = getDimensionValue(asset);
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(asset);
  });

  const result: DimensionAggregation = {};
  groups.forEach((groupAssets, key) => {
    result[key] = {
      count: groupAssets.length,
      avgScores: calculateAverageScores(groupAssets),
    };
  });

  return result;
}

/**
 * Quality Snapshot Store
 */
export const useQualitySnapshotStore = create<QualitySnapshotState>()(
  persist(
    (set, get) => ({
      snapshots: [],

      captureSnapshot: (label, assetsWithScores, stats, queryParams) => {
        // Calculate overall scores
        const overallScores = calculateAverageScores(assetsWithScores);

        // Count assets by type
        const assetsByType: Record<string, number> = {};
        assetsWithScores.forEach(({ metadata }) => {
          const type = metadata.assetType || 'Unknown';
          assetsByType[type] = (assetsByType[type] || 0) + 1;
        });

        // Calculate dimension aggregations
        const byDomain = aggregateByDimension(assetsWithScores, (a) => a.metadata.domain || 'No Domain');
        const byOwner = aggregateByDimension(
          assetsWithScores,
          (a) => a.metadata.owner || a.metadata.ownerGroup || 'Unowned'
        );
        const byConnection = aggregateByDimension(
          assetsWithScores,
          (a) => a.metadata.connection || 'No Connection'
        );

        const snapshot: QualitySnapshot = {
          id: generateSnapshotId(),
          timestamp: Date.now(),
          label,
          queryParams,
          totalAssets: assetsWithScores.length,
          assetsByType,
          overallScores,
          stats,
          byDomain,
          byOwner,
          byConnection,
        };

        set((state) => {
          // Add new snapshot at the beginning, trim to max
          const updated = [snapshot, ...state.snapshots].slice(0, MAX_SNAPSHOTS);
          return { snapshots: updated };
        });

        console.log('[QualitySnapshotStore] Captured snapshot:', snapshot.id, label);
        return snapshot;
      },

      deleteSnapshot: (id) => {
        set((state) => ({
          snapshots: state.snapshots.filter((s) => s.id !== id),
        }));
      },

      renameSnapshot: (id, newLabel) => {
        set((state) => ({
          snapshots: state.snapshots.map((s) =>
            s.id === id ? { ...s, label: newLabel } : s
          ),
        }));
      },

      getSnapshot: (id) => {
        return get().snapshots.find((s) => s.id === id);
      },

      getRecentSnapshots: (limit = 10) => {
        return get().snapshots.slice(0, limit);
      },

      clearAllSnapshots: () => {
        set({ snapshots: [] });
      },

      compareSnapshots: (id1, id2) => {
        const s1 = get().getSnapshot(id1);
        const s2 = get().getSnapshot(id2);

        if (!s1 || !s2) return null;

        // Ensure s1 is older
        const [older, newer] = s1.timestamp < s2.timestamp ? [s1, s2] : [s2, s1];

        return {
          snapshot1: older,
          snapshot2: newer,
          timeDelta: newer.timestamp - older.timestamp,
          assetCountDelta: newer.totalAssets - older.totalAssets,
          scoreDelta: {
            completeness: newer.overallScores.completeness - older.overallScores.completeness,
            accuracy: newer.overallScores.accuracy - older.overallScores.accuracy,
            timeliness: newer.overallScores.timeliness - older.overallScores.timeliness,
            consistency: newer.overallScores.consistency - older.overallScores.consistency,
            usability: newer.overallScores.usability - older.overallScores.usability,
            overall: newer.overallScores.overall - older.overallScores.overall,
          },
          statsDelta: {
            assetsWithDescriptions:
              newer.stats.assetsWithDescriptions - older.stats.assetsWithDescriptions,
            assetsWithOwners: newer.stats.assetsWithOwners - older.stats.assetsWithOwners,
            staleAssets: newer.stats.staleAssets - older.stats.staleAssets,
            certifiedAssets: newer.stats.certifiedAssets - older.stats.certifiedAssets,
          },
        };
      },
    }),
    {
      name: 'quality-snapshot-storage',
      version: 1,
    }
  )
);

/**
 * Hook to get formatted time ago string
 */
export function formatTimeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);

  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;

  return new Date(timestamp).toLocaleDateString();
}
