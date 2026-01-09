/**
 * Auto-Snapshot Provider
 *
 * Wraps the app to automatically capture quality snapshots and persist session data.
 * Uses the storage service for historical trend data.
 */

import { useEffect, useRef, type ReactNode } from 'react';
import { useScoresStore } from '../../stores/scoresStore';
import { useSessionStore } from '../../stores/sessionStore';
import { storageService } from '../../services/storage';
import { logger } from '../../utils/logger';

interface AutoSnapshotProviderProps {
  children: ReactNode;
  enabled?: boolean;
  minAssets?: number;
}

/**
 * Provider that automatically captures snapshots when quality scores change
 */
export function AutoSnapshotProvider({
  children,
  enabled = true,
  minAssets = 10,
}: AutoSnapshotProviderProps) {
  const { assetsWithScores, stats } = useScoresStore();
  const { initialize, shouldAutoSnapshot, recordAutoSnapshot, saveAssetGUIDs } = useSessionStore();
  const lastDataHashRef = useRef<string | null>(null);
  const isInitializedRef = useRef(false);
  const isProcessingRef = useRef(false);

  // Initialize session store on mount
  useEffect(() => {
    if (!isInitializedRef.current) {
      isInitializedRef.current = true;
      initialize();
    }
  }, [initialize]);

  // Auto-capture snapshot when data changes
  useEffect(() => {
    if (!enabled) return;
    if (assetsWithScores.length < minAssets) return;

    // Create hash to detect data changes
    const dataHash = `${assetsWithScores.length}-${stats.assetsWithDescriptions}-${stats.certifiedAssets}-${stats.assetsWithOwners}`;

    // Skip if already processed or currently processing
    if (lastDataHashRef.current === dataHash) return;
    if (isProcessingRef.current) return;

    let cancelled = false;

    const captureAndPersist = async () => {
      isProcessingRef.current = true;
      try {
        // Check if enough time has passed for auto-snapshot
        const shouldCapture = await shouldAutoSnapshot();
        if (cancelled) return;

        if (shouldCapture) {
          logger.info('[AutoSnapshotProvider] Capturing daily aggregation...');

          // Create daily aggregation from current data
          const aggregation = storageService.createDailyAggregation(
            assetsWithScores,
            stats
          );

          // Save to trend data
          await storageService.addDailyAggregation(aggregation);
          if (cancelled) return;

          // Record snapshot time
          await recordAutoSnapshot();

          logger.info('[AutoSnapshotProvider] Daily aggregation saved:', {
            date: aggregation.date,
            totalAssets: aggregation.totalAssets,
            overallScore: aggregation.scores.overall,
          });
        }

        if (cancelled) return;

        // Save asset GUIDs for session restore
        const guids = assetsWithScores.map((a) => a.asset.guid);
        await saveAssetGUIDs(guids);

        // Update hash only if not cancelled
        if (!cancelled) {
          lastDataHashRef.current = dataHash;
        }

      } catch (error) {
        if (!cancelled) {
          logger.error('[AutoSnapshotProvider] Failed to capture snapshot:', error);
        }
      } finally {
        isProcessingRef.current = false;
      }
    };

    void captureAndPersist();

    return () => {
      cancelled = true;
    };
  }, [
    assetsWithScores,
    stats,
    enabled,
    minAssets,
    shouldAutoSnapshot,
    recordAutoSnapshot,
    saveAssetGUIDs,
  ]);

  return <>{children}</>;
}
