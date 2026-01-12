/**
 * Pivot Measure Calculations
 * 
 * Functions to calculate various measures for pivot tables
 */

import type { AtlanAsset } from '../services/atlan/types';
import { scoreAssetQuality } from '../services/qualityMetrics';
import type { LineageInfo } from '../services/atlan/lineageEnricher';
import { logger } from './logger';

// Type adapter for scoring (matches qualityMetrics.ts)
interface AtlanAssetSummary {
  guid: string;
  typeName: string;
  name: string;
  qualifiedName: string;
  connectionName?: string;
  description?: string;
  userDescription?: string;
  ownerUsers?: string[];
  ownerGroups?: string[];
  certificateStatus?: string;
  certificateUpdatedAt?: number;
  classificationNames?: string[];
  meanings?: string[];
  domainGUIDs?: string[];
  updateTime?: number;
  sourceUpdatedAt?: number;
  sourceLastReadAt?: number;
  lastRowChangedAt?: number;
  popularityScore?: number;
  viewScore?: number;
  starredCount?: number;
  __hasLineage?: boolean;
  isDiscoverable?: boolean;
  readme?: any;
}

function assetToSummary(asset: AtlanAsset): AtlanAssetSummary {
  return {
    guid: asset.guid,
    typeName: asset.typeName,
    name: asset.name || '',
    qualifiedName: asset.qualifiedName || '',
    connectionName: asset.connectionName,
    description: asset.description,
    userDescription: asset.userDescription,
    ownerUsers: Array.isArray(asset.ownerUsers)
      ? asset.ownerUsers.map((u) => (typeof u === 'string' ? u : (u as any).name || ''))
      : undefined,
    ownerGroups: Array.isArray(asset.ownerGroups)
      ? asset.ownerGroups.map((g) => (typeof g === 'string' ? g : (g as any).name || ''))
      : undefined,
    certificateStatus: asset.certificateStatus || undefined,
    certificateUpdatedAt: asset.certificateUpdatedAt,
    classificationNames: asset.classificationNames,
    meanings: asset.meanings?.map((m) => (typeof m === 'string' ? m : (m as any).displayText || '')),
    domainGUIDs: asset.domainGUIDs,
    updateTime: asset.updateTime,
    sourceUpdatedAt: asset.sourceUpdatedAt,
    sourceLastReadAt: asset.sourceLastReadAt,
    lastRowChangedAt: asset.lastRowChangedAt,
    popularityScore: asset.popularityScore,
    viewScore: asset.viewScore,
    starredCount: asset.starredCount,
    __hasLineage: asset.__hasLineage || false,
    isDiscoverable: asset.isDiscoverable !== false,
    readme: asset.readme,
  };
}

/**
 * Calculate measure values for a set of assets
 * @param measure - The measure to calculate
 * @param assets - The assets to calculate the measure for
 * @param lineageMap - Optional map of lineage info by asset GUID (for lineage measures)
 * @param scoresMap - Optional map of scores by asset GUID (from scoresStore) to avoid recalculation
 */
export function calculateMeasure(
  measure: string,
  assets: AtlanAsset[],
  lineageMap?: Map<string, LineageInfo>,
  scoresMap?: Map<string, { completeness: number; accuracy: number; timeliness: number; consistency: number; usability: number; overall: number }>
): number {
  const startTime = performance.now();
  if (assets.length === 0) {
    logger.debug('calculateMeasure: No assets provided', { measure });
    return 0;
  }
  logger.debug('calculateMeasure: Starting calculation', { 
    measure, 
    assetCount: assets.length,
    hasLineageMap: !!lineageMap 
  });

  switch (measure) {
    case 'assetCount':
      return assets.length;

    case 'completeness':
    case 'accuracy':
    case 'timeliness':
    case 'consistency':
    case 'usability': {
      // Use scores from scoresMap if available, otherwise calculate
      if (scoresMap && scoresMap.size > 0) {
        let total = 0;
        let count = 0;
        assets.forEach(asset => {
          const cachedScores = scoresMap.get(asset.guid);
          if (cachedScores) {
            total += cachedScores[measure as keyof typeof cachedScores] as number;
            count++;
          }
        });
        // If we have scores for all assets, use them; otherwise calculate for missing ones
        if (count === assets.length) {
          return Math.round(total / count);
        }
        // Fall through to calculate for missing assets
      }
      // Calculate scores for assets not in scoresMap or if scoresMap not provided
      const summaries = assets.map(assetToSummary);
      const scores = summaries.map((s) => scoreAssetQuality(s));
      const total = scores.reduce((sum, s) => sum + (s[measure as keyof typeof s] as number), 0);
      return Math.round(total / scores.length);
    }

    case 'overall': {
      // Use scores from scoresMap if available, otherwise calculate
      if (scoresMap && scoresMap.size > 0) {
        let total = 0;
        let count = 0;
        assets.forEach(asset => {
          const cachedScores = scoresMap.get(asset.guid);
          if (cachedScores) {
            total += cachedScores.overall;
            count++;
          }
        });
        // If we have scores for all assets, use them; otherwise calculate for missing ones
        if (count === assets.length) {
          const result = Math.round(total / count);
          const duration = performance.now() - startTime;
          logger.debug('calculateMeasure: Overall score calculated from cache', { 
            measure, 
            result, 
            duration: `${duration.toFixed(2)}ms` 
          });
          return result;
        }
        // Fall through to calculate for missing assets
      }
      // Calculate scores for assets not in scoresMap or if scoresMap not provided
      const summaries = assets.map(assetToSummary);
      const scores = summaries.map((s) => scoreAssetQuality(s));
      const overalls = scores.map((s) => 
        (s.completeness + s.accuracy + s.timeliness + s.consistency + s.usability) / 5
      );
      const result = Math.round(overalls.reduce((sum, o) => sum + o, 0) / overalls.length);
      const duration = performance.now() - startTime;
      logger.debug('calculateMeasure: Overall score calculated', { 
        measure, 
        result, 
        duration: `${duration.toFixed(2)}ms` 
      });
      return result;
    }

    case 'descriptionCoverage': {
      const withDescription = assets.filter(
        (a) => a.description || a.userDescription
      ).length;
      return Math.round((withDescription / assets.length) * 100);
    }

    case 'ownerCoverage': {
      const withOwner = assets.filter(
        (a) => 
          (Array.isArray(a.ownerUsers) && a.ownerUsers.length > 0) ||
          (Array.isArray(a.ownerGroups) && a.ownerGroups.length > 0)
      ).length;
      return Math.round((withOwner / assets.length) * 100);
    }

    case 'certificationCoverage': {
      const certified = assets.filter(
        (a) => a.certificateStatus === 'VERIFIED'
      ).length;
      return Math.round((certified / assets.length) * 100);
    }

    case 'lineageCoverage': {
      const withLineage = assets.filter((a) => a.__hasLineage === true).length;
      return Math.round((withLineage / assets.length) * 100);
    }

    case 'totalViews': {
      // TODO: Replace with aggregated searchlog rollups once available.
      const total = assets.reduce((sum, asset) => sum + (asset.sourceReadCount || 0), 0);
      return total;
    }

    case 'distinctViewers': {
      // TODO: Replace with aggregated searchlog rollups once available.
      const total = assets.reduce((sum, asset) => sum + (asset.sourceReadUserCount || 0), 0);
      return total;
    }

    case 'profilingCoverage': {
      const profiled = assets.filter((asset) => (asset as any).lastProfiledAt || (asset as any).isProfiled).length;
      return Math.round((profiled / assets.length) * 100);
    }

    case 'dqRuleCoverage': {
      const withDq = assets.filter((asset) => {
        const summary = (asset as any).dataQualitySummary;
        const sodaCount = (asset as any).assetSodaCheckCount;
        const mcCount = (asset as any).assetMcMonitorCount;
        return (summary && summary.total > 0) || (sodaCount && sodaCount > 0) || (mcCount && mcCount > 0);
      }).length;
      return Math.round((withDq / assets.length) * 100);
    }

    case 'churnEvents': {
      // TODO: Implement using auditSearch aggregates (change events per asset).
      logger.debug('calculateMeasure: churnEvents requires auditSearch rollups');
      return 0;
    }

    case 'timeToSteward': {
      // TODO: Implement using auditSearch (created -> first owner assignment).
      logger.debug('calculateMeasure: timeToSteward requires auditSearch rollups');
      return 0;
    }

    case 'hasUpstream': {
      // Assets with upstream lineage (has inputs)
      if (lineageMap) {
        const withUpstream = assets.filter((a) => {
          const lineage = lineageMap.get(a.guid);
          return lineage?.hasUpstream === true;
        }).length;
        return Math.round((withUpstream / assets.length) * 100);
      }
      // Fallback: use __hasLineage flag as proxy
      const withUpstream = assets.filter((a) => a.__hasLineage === true).length;
      return Math.round((withUpstream / assets.length) * 100);
    }

    case 'hasDownstream': {
      // Assets with downstream lineage (has outputs)
      if (lineageMap) {
        const withDownstream = assets.filter((a) => {
          const lineage = lineageMap.get(a.guid);
          return lineage?.hasDownstream === true;
        }).length;
        return Math.round((withDownstream / assets.length) * 100);
      }
      // Fallback: use __hasLineage flag as proxy
      const withDownstream = assets.filter((a) => a.__hasLineage === true).length;
      return Math.round((withDownstream / assets.length) * 100);
    }

    case 'fullLineage': {
      // Assets with both upstream and downstream lineage
      if (lineageMap) {
        const withFullLineage = assets.filter((a) => {
          const lineage = lineageMap.get(a.guid);
          return lineage?.hasUpstream === true && lineage?.hasDownstream === true;
        }).length;
        return Math.round((withFullLineage / assets.length) * 100);
      }
      // Fallback: use __hasLineage as proxy
      const withFullLineage = assets.filter((a) => a.__hasLineage === true).length;
      return Math.round((withFullLineage / assets.length) * 100);
    }

    case 'orphaned': {
      // Assets with no lineage at all
      if (lineageMap) {
        const orphaned = assets.filter((a) => {
          const lineage = lineageMap.get(a.guid);
          return !lineage || (!lineage.hasUpstream && !lineage.hasDownstream);
        }).length;
        return orphaned; // Return count, not percentage
      }
      // Fallback: use __hasLineage flag
      const orphaned = assets.filter((a) => !a.__hasLineage).length;
      return orphaned; // Return count, not percentage
    }

    case 'avgCompleteness': {
      // Use scores from scoresMap if available, otherwise calculate
      if (scoresMap && scoresMap.size > 0) {
        let total = 0;
        let count = 0;
        assets.forEach(asset => {
          const cachedScores = scoresMap.get(asset.guid);
          if (cachedScores) {
            total += cachedScores.completeness;
            count++;
          }
        });
        // If we have scores for all assets, use them; otherwise calculate for missing ones
        if (count === assets.length) {
          return Math.round(total / count);
        }
        // Fall through to calculate for missing assets
      }
      // Calculate scores for assets not in scoresMap or if scoresMap not provided
      const summaries = assets.map(assetToSummary);
      const scores = summaries.map((s) => scoreAssetQuality(s));
      const total = scores.reduce((sum, s) => sum + s.completeness, 0);
      return Math.round(total / scores.length);
    }

    default:
      logger.warn('calculateMeasure: Unknown measure type', { measure });
      return 0;
  }
  
  const duration = performance.now() - startTime;
  logger.debug('calculateMeasure: Calculation complete', { 
    measure, 
    duration: `${duration.toFixed(2)}ms` 
  });
}

/**
 * Get measure label
 */
export function getMeasureLabel(measure: string): string {
  const labels: Record<string, string> = {
    assetCount: '# Assets',
    completeness: '% Completeness',
    accuracy: '% Accuracy',
    timeliness: '% Timeliness',
    consistency: '% Consistency',
    usability: '% Usability',
    overall: 'Overall Score',
    descriptionCoverage: '% with Description',
    ownerCoverage: '% with Owner',
    certificationCoverage: '% Certified',
    lineageCoverage: '% with Lineage',
    totalViews: 'Total Views',
    distinctViewers: 'Distinct Viewers',
    profilingCoverage: '% Profiled',
    dqRuleCoverage: '% with DQ Rules',
    churnEvents: 'Churn Events',
    timeToSteward: 'Avg Time to Steward (days)',
    hasUpstream: 'Has Upstream',
    hasDownstream: 'Has Downstream',
    fullLineage: 'Full Lineage',
    orphaned: 'Orphaned',
    avgCompleteness: 'Avg Completeness',
  };
  return labels[measure] || measure;
}

/**
 * Format measure value
 */
export function formatMeasure(measure: string, value: number): string {
  if (measure === 'assetCount' || measure === 'orphaned' || measure === 'totalViews' || measure === 'distinctViewers' || measure === 'churnEvents' || measure === 'timeToSteward') {
    return value.toString();
  }
  if (measure === 'overall' || measure === 'avgCompleteness' || measure === 'completeness' || measure === 'accuracy' || measure === 'timeliness' || measure === 'consistency' || measure === 'usability') {
    return value.toString();
  }
  // All others are percentages
  return `${value}%`;
}
