/**
 * Scores Store
 * 
 * Manages calculated quality scores for selected assets
 */

import { createContext, useContext, useState, useCallback, useMemo, useEffect } from 'react';
import type { ReactNode } from 'react';
import type { AtlanAsset } from '../services/atlan/types';
import type { AssetMetadata, QualityScores } from '../services/qualityMetrics';
import { transformAtlanAsset } from '../services/atlan/transformer';
import { fetchDomainNames } from '../services/atlan/domainResolver';
import { resolveTagNames } from '../services/atlan/tagResolver';
import { setNameCaches } from '../utils/pivotDimensions';
import { calculateAssetQuality } from '../services/qualityMetrics';
import { useScoringSettingsStore } from './scoringSettingsStore';
import { scoreAssets, initializeScoringService, setScoringModeGetter } from '../services/scoringService';
import { getAtlanConfig } from '../services/atlan/api';
import type { AtlanAsset as ScoringAtlanAsset } from '../scoring/contracts';
import { logger } from '../utils/logger';
import { getOwnerNames, getMeaningTexts, isValidScoringType } from '../utils/typeGuards';

interface AssetWithScores {
  asset: AtlanAsset;
  metadata: AssetMetadata;
  scores: QualityScores & { overall: number };
}

interface ScoresStoreContextType {
  assetsWithScores: AssetWithScores[];
  setAssetsWithScores: (assets: AtlanAsset[]) => void;
  clearScores: () => void;
  // Aggregated stats
  stats: {
    assetsWithDescriptions: number;
    assetsWithOwners: number;
    staleAssets: number;
    certifiedAssets: number;
  };
  // Grouped data
  byOwner: Map<string, AssetWithScores[]>;
  byDomain: Map<string, AssetWithScores[]>;
  bySchema: Map<string, AssetWithScores[]>;
  byConnection: Map<string, AssetWithScores[]>;
  byTag: Map<string, AssetWithScores[]>;
  byCertification: Map<string, AssetWithScores[]>;
  byClassification: Map<string, AssetWithScores[]>;
  byAssetType: Map<string, AssetWithScores[]>;
  // Helper to group by any metadata field
  groupBy: (field: string) => Map<string, AssetWithScores[]>;
}

const ScoresStoreContext = createContext<ScoresStoreContextType | undefined>(undefined);

export function ScoresStoreProvider({ children }: { children: ReactNode }) {
  const [assetsWithScores, setAssetsWithScoresState] = useState<AssetWithScores[]>([]);
  const { scoringMode } = useScoringSettingsStore();

  // Initialize scoring service when mode is config-driven
  useEffect(() => {
    if (scoringMode === "config-driven") {
      const config = getAtlanConfig();
      if (config) {
        initializeScoringService(config.baseUrl, config.apiKey);
        setScoringModeGetter(() => scoringMode);
      }
    }
  }, [scoringMode]);

  const setAssetsWithScores = useCallback(async (assets: AtlanAsset[]) => {
    // Pre-fetch domain and tag names for human-readable display
    let domainNameMap: Map<string, string> | undefined;
    let tagNameMap: Map<string, string> | undefined;

    // Collect all unique domain GUIDs and tag type names
    const domainGUIDs = [...new Set(assets.flatMap(a => a.domainGUIDs || []).filter(Boolean))];

    // Build initial tag name map from atlanTags displayNames (if available)
    // This gives us immediate display names without needing API lookups
    const tagDisplayNamesFromAssets = new Map<string, string>();
    assets.forEach(a => {
      if (a.atlanTags) {
        a.atlanTags.forEach(tag => {
          if (tag.typeName && tag.displayName) {
            tagDisplayNamesFromAssets.set(tag.typeName, tag.displayName);
          }
        });
      }
    });
    logger.debug(`[ScoresStore] Found ${tagDisplayNamesFromAssets.size} tag display names directly from atlanTags`);
    if (tagDisplayNamesFromAssets.size > 0) {
      logger.debug('[ScoresStore] Sample atlanTags displayNames:', Object.fromEntries([...tagDisplayNamesFromAssets.entries()].slice(0, 5)));
    }

    // Collect tag type names that still need resolution
    const tagTypeNames = [...new Set(assets.flatMap(a => {
      const names: string[] = [];
      if (a.classificationNames) names.push(...a.classificationNames);
      if (a.atlanTags) names.push(...a.atlanTags.map(t => t.typeName).filter(Boolean));
      return names;
    }))];

    // Fetch both in parallel
    const [domainResult, tagResult] = await Promise.allSettled([
      domainGUIDs.length > 0 ? fetchDomainNames(domainGUIDs) : Promise.resolve(new Map<string, string>()),
      tagTypeNames.length > 0 ? resolveTagNames(tagTypeNames) : Promise.resolve(new Map<string, string>()),
    ]);

    if (domainResult.status === 'fulfilled') {
      domainNameMap = domainResult.value;
    } else {
      logger.warn('Failed to fetch domain names, using fallback:', domainResult.reason);
    }

    if (tagResult.status === 'fulfilled') {
      tagNameMap = tagResult.value;
    } else {
      logger.warn('Failed to fetch tag names, using fallback:', tagResult.reason);
    }

    // Merge tag names: API results take precedence, but use atlanTags displayNames as fallback
    const mergedTagNameMap = new Map<string, string>(tagDisplayNamesFromAssets);
    if (tagNameMap) {
      for (const [typeName, displayName] of tagNameMap.entries()) {
        mergedTagNameMap.set(typeName, displayName);
      }
    }
    tagNameMap = mergedTagNameMap;
    logger.debug(`[ScoresStore] Final merged tag name map size: ${tagNameMap.size}`);

    // Update the pivot dimensions cache for consistent name resolution
    setNameCaches(domainNameMap, tagNameMap);

    // Create name resolution maps object
    const nameMaps = { domainNameMap, tagNameMap };

    if (scoringMode === "config-driven") {
      try {
        // Transform to scoring format
        const scoringAssets: ScoringAtlanAsset[] = assets.map(asset => {
          const ownerUsers = getOwnerNames(asset.ownerUsers);
          const ownerGroups = getOwnerNames(asset.ownerGroups);
          const meanings = getMeaningTexts(asset.meanings);

          return {
            guid: asset.guid,
            typeName: isValidScoringType(asset.typeName) ? asset.typeName : 'Table',
            name: asset.name,
            qualifiedName: asset.qualifiedName,
            connectionName: asset.connectionName,
            description: asset.description,
            userDescription: asset.userDescription,
            ownerUsers: ownerUsers.length > 0 ? ownerUsers : null,
            ownerGroups: ownerGroups.length > 0 ? ownerGroups : null,
            certificateStatus: asset.certificateStatus,
            certificateUpdatedAt: asset.certificateUpdatedAt,
            classificationNames: asset.classificationNames,
            meanings: meanings.length > 0 ? meanings : null,
            domainGUIDs: asset.domainGUIDs,
            updateTime: asset.updateTime,
            sourceUpdatedAt: asset.sourceUpdatedAt,
            sourceLastReadAt: asset.sourceLastReadAt,
            lastRowChangedAt: asset.lastRowChangedAt,
            popularityScore: asset.popularityScore,
            viewScore: asset.viewScore,
            starredCount: asset.starredCount,
            __hasLineage: asset.__hasLineage,
            readme: asset.readme ? { hasReadme: true } : null,
            isDiscoverable: asset.isDiscoverable,
          };
        });

        const results = await scoreAssets(scoringAssets);
        
        // Convert ProfileScoreResult[] to QualityScores format
        const withScores: AssetWithScores[] = assets.map((asset) => {
          const metadata = transformAtlanAsset(asset, nameMaps);
          const profileResults = results.get(asset.guid) || [];
          
          // Aggregate scores from all profiles
          let completeness = 0, accuracy = 0, timeliness = 0, consistency = 0, usability = 0;
          let count = 0;
          
          profileResults.forEach(result => {
            if (result.dimensions) {
              result.dimensions.forEach(dim => {
                const score100 = dim.score01 * 100;
                if (dim.dimension === "completeness") completeness += score100;
                else if (dim.dimension === "accuracy") accuracy += score100;
                else if (dim.dimension === "timeliness") timeliness += score100;
                else if (dim.dimension === "consistency") consistency += score100;
                else if (dim.dimension === "usability") usability += score100;
              });
              count++;
            }
          });
          
          const n = count || 1;
          const scores: QualityScores & { overall: number } = {
            completeness: Math.round(completeness / n),
            accuracy: Math.round(accuracy / n),
            timeliness: Math.round(timeliness / n),
            consistency: Math.round(consistency / n),
            usability: Math.round(usability / n),
            overall: Math.round((completeness + accuracy + timeliness + consistency + usability) / (n * 5)),
          };
          
          return { asset, metadata, scores };
        });
        
        setAssetsWithScoresState(withScores);
      } catch (error) {
        logger.error('Error calculating config-driven scores', error);
        // Fallback to legacy scoring
        const withScores: AssetWithScores[] = assets.map((asset) => {
          const metadata = transformAtlanAsset(asset, nameMaps);
          const scores = calculateAssetQuality(metadata);
          return { asset, metadata, scores };
        });
        setAssetsWithScoresState(withScores);
      }
    } else {
      // Legacy scoring
      const withScores: AssetWithScores[] = assets.map((asset) => {
        const metadata = transformAtlanAsset(asset, nameMaps);
        const scores = calculateAssetQuality(metadata);
        return { asset, metadata, scores };
      });
      setAssetsWithScoresState(withScores);
    }
  }, [scoringMode]);

  const clearScores = useCallback(() => {
    setAssetsWithScoresState([]);
  }, []);

  // Calculate stats
  const stats = useMemo(() => {
    const now = Date.now();
    const ninetyDaysAgo = now - 90 * 24 * 60 * 60 * 1000;

    let assetsWithDescriptions = 0;
    let assetsWithOwners = 0;
    let staleAssets = 0;
    let certifiedAssets = 0;

    assetsWithScores.forEach(({ metadata }) => {
      if (metadata.description) assetsWithDescriptions++;
      if (metadata.owner || metadata.ownerGroup) assetsWithOwners++;
      if (metadata.lastUpdated && new Date(metadata.lastUpdated).getTime() < ninetyDaysAgo) {
        staleAssets++;
      }
      if (metadata.certificationStatus === 'certified') certifiedAssets++;
    });

    return {
      assetsWithDescriptions,
      assetsWithOwners,
      staleAssets,
      certifiedAssets,
    };
  }, [assetsWithScores]);

  /**
   * Generic grouping helper - consolidates duplicate groupBy logic
   * @param keyExtractor - Function to extract key(s) from an asset
   * @param defaultKey - Default key when no value exists
   */
  const createGroupedMap = useCallback(
    (
      keyExtractor: (item: AssetWithScores) => string | string[],
      defaultKey: string
    ): Map<string, AssetWithScores[]> => {
      const map = new Map<string, AssetWithScores[]>();

      assetsWithScores.forEach((item) => {
        const keys = keyExtractor(item);
        const keyArray = Array.isArray(keys) ? keys : [keys];

        if (keyArray.length === 0) {
          if (!map.has(defaultKey)) map.set(defaultKey, []);
          map.get(defaultKey)!.push(item);
        } else {
          keyArray.forEach((key) => {
            if (!map.has(key)) map.set(key, []);
            map.get(key)!.push(item);
          });
        }
      });

      return map;
    },
    [assetsWithScores]
  );

  // All grouped data computed from single helper
  const byOwner = useMemo(() =>
    createGroupedMap(
      (item) => item.metadata.owner || item.metadata.ownerGroup || 'Unowned',
      'Unowned'
    ), [createGroupedMap]);

  const byDomain = useMemo(() =>
    createGroupedMap(
      (item) => item.metadata.domain || 'No Domain',
      'No Domain'
    ), [createGroupedMap]);

  const bySchema = useMemo(() =>
    createGroupedMap(
      (item) => {
        const tableAsset = item.asset as any;
        return item.metadata.customProperties?.schemaName ||
               tableAsset.schemaQualifiedName?.split('.').pop() ||
               tableAsset.schemaName ||
               'No Schema';
      },
      'No Schema'
    ), [createGroupedMap]);

  const byConnection = useMemo(() =>
    createGroupedMap(
      (item) => item.metadata.connection || 'No Connection',
      'No Connection'
    ), [createGroupedMap]);

  const byTag = useMemo(() =>
    createGroupedMap(
      (item) => item.metadata.tags || [],
      'No Tags'
    ), [createGroupedMap]);

  const byCertification = useMemo(() =>
    createGroupedMap(
      (item) => {
        const cert = item.metadata.certificationStatus || 'none';
        return cert === 'certified' ? 'Certified'
             : cert === 'draft' ? 'Draft'
             : cert === 'deprecated' ? 'Deprecated'
             : 'Not Certified';
      },
      'Not Certified'
    ), [createGroupedMap]);

  const byClassification = useMemo(() =>
    createGroupedMap(
      (item) => item.metadata.tags || [],
      'No Classification'
    ), [createGroupedMap]);

  const byAssetType = useMemo(() =>
    createGroupedMap(
      (item) => item.metadata.assetType || 'Unknown',
      'Unknown'
    ), [createGroupedMap]);

  // Generic groupBy function for any metadata field
  const groupBy = useCallback((field: string): Map<string, AssetWithScores[]> => {
    const map = new Map<string, AssetWithScores[]>();
    
    assetsWithScores.forEach((item) => {
      let value: string | string[] | undefined;
      
      // Handle different field paths
      if (field === 'owner') {
        value = item.metadata.owner || item.metadata.ownerGroup || 'Unowned';
      } else if (field === 'ownerGroup') {
        value = item.metadata.ownerGroup || 'Unowned';
      } else if (field === 'domain') {
        value = item.metadata.domain || 'No Domain';
      } else if (field === 'schema') {
        value = item.metadata.customProperties?.schemaName || 'No Schema';
      } else if (field === 'connection') {
        value = item.metadata.connection || 'No Connection';
      } else if (field === 'tag') {
        value = item.metadata.tags || [];
      } else if (field === 'certification') {
        const cert = item.metadata.certificationStatus || 'none';
        value = cert === 'certified' ? 'Certified' : cert === 'draft' ? 'Draft' : cert === 'deprecated' ? 'Deprecated' : 'Not Certified';
      } else if (field === 'classification') {
        value = item.metadata.tags || [];
      } else if (field === 'assetType') {
        value = item.metadata.assetType || 'Unknown';
      } else if (field.startsWith('customProperties.')) {
        const prop = field.replace('customProperties.', '');
        value = item.metadata.customProperties?.[prop] || 'N/A';
      } else {
        // Try to get from metadata directly
        value = (item.metadata as any)[field] || 'N/A';
      }
      
      // Handle array values (like tags)
      if (Array.isArray(value)) {
        if (value.length === 0) {
          const key = `No ${field}`;
          if (!map.has(key)) map.set(key, []);
          map.get(key)!.push(item);
        } else {
          value.forEach((v) => {
            const key = String(v);
            if (!map.has(key)) map.set(key, []);
            map.get(key)!.push(item);
          });
        }
      } else {
        const key = String(value);
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push(item);
      }
    });
    
    return map;
  }, [assetsWithScores]);

  const value: ScoresStoreContextType = {
    assetsWithScores,
    setAssetsWithScores,
    clearScores,
    stats,
    byOwner,
    byDomain,
    bySchema,
    byConnection,
    byTag,
    byCertification,
    byClassification,
    byAssetType,
    groupBy,
  };

  return <ScoresStoreContext.Provider value={value}>{children}</ScoresStoreContext.Provider>;
}

export function useScoresStore() {
  const context = useContext(ScoresStoreContext);
  if (context === undefined) {
    throw new Error('useScoresStore must be used within a ScoresStoreProvider');
  }
  return context;
}

