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
import { calculateAssetQuality } from '../services/qualityMetrics';
import { useScoringSettingsStore } from './scoringSettingsStore';
import { scoreAssets, initializeScoringService, setScoringModeGetter } from '../services/scoringService';
import { getAtlanConfig } from '../services/atlan/api';
import type { AtlanAsset as ScoringAtlanAsset } from '../scoring/contracts';
import { logger } from '../utils/logger';

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
    // Pre-fetch domain names for human-readable display
    let domainNameMap: Map<string, string> | undefined;
    try {
      const domainGUIDs = assets.flatMap(a => a.domainGUIDs || []).filter(Boolean);
      const uniqueGUIDs = [...new Set(domainGUIDs)];
      if (uniqueGUIDs.length > 0) {
        domainNameMap = await fetchDomainNames(uniqueGUIDs);
      }
    } catch (error) {
      logger.warn('Failed to fetch domain names, using fallback:', error);
    }

    if (scoringMode === "config-driven") {
      try {
        // Transform to scoring format
        const scoringAssets: ScoringAtlanAsset[] = assets.map(asset => ({
          guid: asset.guid,
          typeName: asset.typeName as any,
          name: asset.name,
          qualifiedName: asset.qualifiedName,
          connectionName: asset.connectionName,
          description: asset.description,
          userDescription: asset.userDescription,
          ownerUsers: Array.isArray(asset.ownerUsers) 
            ? asset.ownerUsers.map((u: any) => typeof u === 'string' ? u : u.name || u.guid || '')
            : asset.ownerUsers || null,
          ownerGroups: Array.isArray(asset.ownerGroups)
            ? asset.ownerGroups.map((g: any) => typeof g === 'string' ? g : g.name || g.guid || '')
            : asset.ownerGroups || null,
          certificateStatus: asset.certificateStatus,
          certificateUpdatedAt: asset.certificateUpdatedAt,
          classificationNames: asset.classificationNames,
          meanings: asset.meanings?.map((m: { guid: string; displayText: string } | string) =>
            typeof m === 'string' ? m : m.displayText
          ) ?? null,
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
        }));

        const results = await scoreAssets(scoringAssets);
        
        // Convert ProfileScoreResult[] to QualityScores format
        const withScores: AssetWithScores[] = assets.map((asset) => {
          const metadata = transformAtlanAsset(asset, domainNameMap);
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
          const metadata = transformAtlanAsset(asset, domainNameMap);
          const scores = calculateAssetQuality(metadata);
          return { asset, metadata, scores };
        });
        setAssetsWithScoresState(withScores);
      }
    } else {
      // Legacy scoring
      const withScores: AssetWithScores[] = assets.map((asset) => {
        const metadata = transformAtlanAsset(asset, domainNameMap);
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

    assetsWithScores.forEach(({ metadata, asset }) => {
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

  // Group by owner
  const byOwner = useMemo(() => {
    const map = new Map<string, AssetWithScores[]>();
    assetsWithScores.forEach((item) => {
      const owner = item.metadata.owner || item.metadata.ownerGroup || 'Unowned';
      if (!map.has(owner)) {
        map.set(owner, []);
      }
      map.get(owner)!.push(item);
    });
    return map;
  }, [assetsWithScores]);

  // Group by domain
  const byDomain = useMemo(() => {
    const map = new Map<string, AssetWithScores[]>();
    assetsWithScores.forEach((item) => {
      const domain = item.metadata.domain || 'No Domain';
      if (!map.has(domain)) {
        map.set(domain, []);
      }
      map.get(domain)!.push(item);
    });
    return map;
  }, [assetsWithScores]);

  // Group by schema
  const bySchema = useMemo(() => {
    const map = new Map<string, AssetWithScores[]>();
    assetsWithScores.forEach((item) => {
      const tableAsset = item.asset as any; // Type assertion for table-specific properties
      const schema = item.metadata.customProperties?.schemaName || 
                     tableAsset.schemaQualifiedName?.split('.').pop() || 
                     tableAsset.schemaName ||
                     'No Schema';
      if (!map.has(schema)) {
        map.set(schema, []);
      }
      map.get(schema)!.push(item);
    });
    return map;
  }, [assetsWithScores]);

  // Group by connection
  const byConnection = useMemo(() => {
    const map = new Map<string, AssetWithScores[]>();
    assetsWithScores.forEach((item) => {
      const connection = item.metadata.connection || 'No Connection';
      if (!map.has(connection)) {
        map.set(connection, []);
      }
      map.get(connection)!.push(item);
    });
    return map;
  }, [assetsWithScores]);

  // Group by tag
  const byTag = useMemo(() => {
    const map = new Map<string, AssetWithScores[]>();
    assetsWithScores.forEach((item) => {
      const tags = item.metadata.tags || [];
      if (tags.length === 0) {
        const key = 'No Tags';
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push(item);
      } else {
        tags.forEach((tag) => {
          if (!map.has(tag)) map.set(tag, []);
          map.get(tag)!.push(item);
        });
      }
    });
    return map;
  }, [assetsWithScores]);

  // Group by certification status
  const byCertification = useMemo(() => {
    const map = new Map<string, AssetWithScores[]>();
    assetsWithScores.forEach((item) => {
      const cert = item.metadata.certificationStatus || 'none';
      const key = cert === 'certified' ? 'Certified' : cert === 'draft' ? 'Draft' : cert === 'deprecated' ? 'Deprecated' : 'Not Certified';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(item);
    });
    return map;
  }, [assetsWithScores]);

  // Group by classification
  const byClassification = useMemo(() => {
    const map = new Map<string, AssetWithScores[]>();
    assetsWithScores.forEach((item) => {
      const classifications = item.metadata.tags || []; // Using tags as classifications
      if (classifications.length === 0) {
        const key = 'No Classification';
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push(item);
      } else {
        classifications.forEach((cls) => {
          if (!map.has(cls)) map.set(cls, []);
          map.get(cls)!.push(item);
        });
      }
    });
    return map;
  }, [assetsWithScores]);

  // Group by asset type
  const byAssetType = useMemo(() => {
    const map = new Map<string, AssetWithScores[]>();
    assetsWithScores.forEach((item) => {
      const type = item.metadata.assetType || 'Unknown';
      if (!map.has(type)) map.set(type, []);
      map.get(type)!.push(item);
    });
    return map;
  }, [assetsWithScores]);

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

