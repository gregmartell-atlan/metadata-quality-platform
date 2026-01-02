/**
 * Auto-Snapshot Hook
 *
 * Automatically captures quality snapshots when data is loaded.
 * Creates daily aggregations for historical trend analysis.
 */

import { useEffect, useRef } from 'react';
import { storageService } from '../services/storage';
import { useQualitySnapshotStore } from '../stores/qualitySnapshotStore';
import { useSessionStore } from '../stores/sessionStore';
import { logger } from '../utils/logger';

interface AutoSnapshotOptions {
  enabled?: boolean;
  minAssets?: number;  // Minimum assets to trigger snapshot
}

/**
 * Hook to automatically capture snapshots and daily aggregations
 */
export function useAutoSnapshot(
  assetsWithScores: Array<{
    asset: any;
    metadata: { assetType?: string; domain?: string; owner?: string; connection?: string };
    scores: { completeness: number; accuracy: number; timeliness: number; consistency: number; usability: number; overall: number };
  }>,
  stats: {
    assetsWithDescriptions: number;
    assetsWithOwners: number;
    staleAssets: number;
    certifiedAssets: number;
  },
  queryContext?: { connectionFilter?: string; domainFilter?: string },
  options: AutoSnapshotOptions = {}
) {
  const { enabled = true, minAssets = 10 } = options;
  const { shouldAutoSnapshot, recordAutoSnapshot } = useSessionStore();
  const lastSnapshotRef = useRef<string | null>(null);

  useEffect(() => {
    if (!enabled) return;
    if (assetsWithScores.length < minAssets) return;

    // Create a hash of the current data to detect changes
    const dataHash = `${assetsWithScores.length}-${stats.assetsWithDescriptions}-${stats.certifiedAssets}`;

    // Skip if we already processed this exact data
    if (lastSnapshotRef.current === dataHash) return;

    const captureSnapshot = async () => {
      try {
        const shouldCapture = await shouldAutoSnapshot();

        if (shouldCapture) {
          logger.info('[AutoSnapshot] Capturing daily aggregation...');

          // Create daily aggregation
          const aggregation = storageService.createDailyAggregation(
            assetsWithScores,
            stats,
            queryContext
          );

          // Save to trend data
          await storageService.addDailyAggregation(aggregation);

          // Record that we captured a snapshot
          await recordAutoSnapshot();

          // Update the hash
          lastSnapshotRef.current = dataHash;

          logger.info('[AutoSnapshot] Daily aggregation saved for', aggregation.date, {
            totalAssets: aggregation.totalAssets,
            overallScore: aggregation.scores.overall,
          });
        }
      } catch (error) {
        logger.error('[AutoSnapshot] Failed to capture snapshot:', error);
      }
    };

    captureSnapshot();
  }, [assetsWithScores, stats, queryContext, enabled, minAssets, shouldAutoSnapshot, recordAutoSnapshot]);
}

/**
 * Hook to save asset GUIDs for session restoration
 */
export function useSessionPersistence(
  assets: Array<{ guid: string }>,
  queryContext?: { connectionFilter?: string; domainFilter?: string }
) {
  const { saveAssetGUIDs, saveQueryContext } = useSessionStore();
  const lastSavedRef = useRef<string | null>(null);

  useEffect(() => {
    if (assets.length === 0) return;

    const guids = assets.map((a) => a.guid);
    const guidsHash = guids.slice(0, 10).join(','); // Hash based on first 10 GUIDs

    // Skip if we already saved this set
    if (lastSavedRef.current === guidsHash) return;

    const saveSession = async () => {
      try {
        await saveAssetGUIDs(guids);

        if (queryContext) {
          await saveQueryContext({
            ...queryContext,
            timestamp: Date.now(),
          });
        }

        lastSavedRef.current = guidsHash;
        logger.debug('[SessionPersistence] Saved', guids.length, 'asset GUIDs');
      } catch (error) {
        logger.error('[SessionPersistence] Failed to save session:', error);
      }
    };

    saveSession();
  }, [assets, queryContext, saveAssetGUIDs, saveQueryContext]);
}
