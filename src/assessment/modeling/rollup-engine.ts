/**
 * Rollup Engine
 *
 * Aggregates assessment results across dimensions to produce
 * hierarchical rollups for connections, databases, schemas,
 * domains, owners, etc.
 *
 * Ported from atlan-metadata-evaluation/assessment/packages/domain
 */

import type {
  RollupDimension,
  ExtendedRollupNode,
  SignalAggregationResult,
  UseCaseAggregation,
  AssetSignalResults,
  AssetUseCaseResults,
  AssetRecord,
  SignalType,
  UseCaseGap,
} from '../catalog/types';
import { groupAssetsByDimension } from './scope-resolver';
import { SIGNAL_DEFINITIONS } from '../catalog/signal-definitions';
import { USE_CASE_PROFILES } from '../catalog/use-case-profiles';

// =============================================================================
// SIGNAL AGGREGATION
// =============================================================================

/**
 * Aggregate signal results across multiple assets
 */
export function aggregateSignals(
  assetResults: AssetSignalResults[]
): Record<SignalType, SignalAggregationResult> {
  const aggregations: Record<SignalType, SignalAggregationResult> = {} as Record<SignalType, SignalAggregationResult>;

  // Initialize for all signals
  for (const signalDef of SIGNAL_DEFINITIONS) {
    aggregations[signalDef.id] = {
      signal: signalDef.id,
      presentCount: 0,
      absentCount: 0,
      unknownCount: 0,
      presenceRate: 0,
      averageScore: 0,
      distribution: { excellent: 0, good: 0, fair: 0, poor: 0 },
    };
  }

  if (assetResults.length === 0) {
    return aggregations;
  }

  // Accumulate counts
  for (const asset of assetResults) {
    for (const signalResult of asset.signals) {
      const agg = aggregations[signalResult.signal];
      if (!agg) continue;

      // Count presence
      if (signalResult.present === true) {
        agg.presentCount++;
      } else if (signalResult.present === false) {
        agg.absentCount++;
      } else {
        agg.unknownCount++;
      }

      // Accumulate score for average
      agg.averageScore += signalResult.score;

      // Distribution buckets
      if (signalResult.score >= 0.9) {
        agg.distribution.excellent++;
      } else if (signalResult.score >= 0.7) {
        agg.distribution.good++;
      } else if (signalResult.score >= 0.5) {
        agg.distribution.fair++;
      } else {
        agg.distribution.poor++;
      }
    }
  }

  // Calculate rates and averages
  const totalAssets = assetResults.length;
  for (const signalId of Object.keys(aggregations) as SignalType[]) {
    const agg = aggregations[signalId];
    agg.presenceRate = agg.presentCount / totalAssets;
    agg.averageScore = agg.averageScore / totalAssets;
  }

  return aggregations;
}

/**
 * Aggregate use case results across multiple assets
 */
export function aggregateUseCases(
  assetResults: AssetUseCaseResults[]
): Record<string, UseCaseAggregation> {
  const aggregations: Record<string, UseCaseAggregation> = {};

  // Initialize for all use cases
  for (const ucProfile of USE_CASE_PROFILES) {
    aggregations[ucProfile.id] = {
      useCaseId: ucProfile.id,
      useCaseName: ucProfile.displayName,
      readyCount: 0,
      partialCount: 0,
      notReadyCount: 0,
      readinessRate: 0,
      averageScore: 0,
      topGaps: [],
    };
  }

  if (assetResults.length === 0) {
    return aggregations;
  }

  // Track gap frequencies
  const gapFrequency: Record<string, Map<SignalType, number>> = {};
  for (const ucProfile of USE_CASE_PROFILES) {
    gapFrequency[ucProfile.id] = new Map();
  }

  // Accumulate counts
  for (const asset of assetResults) {
    for (const ucResult of asset.useCases) {
      const agg = aggregations[ucResult.useCaseId];
      if (!agg) continue;

      // Count readiness levels
      switch (ucResult.readinessLevel) {
        case 'READY':
        case 'EXCELLENT':
          agg.readyCount++;
          break;
        case 'PARTIAL':
          agg.partialCount++;
          break;
        case 'NOT_READY':
          agg.notReadyCount++;
          break;
      }

      // Accumulate score
      agg.averageScore += ucResult.readinessScore;

      // Track gaps
      const gapMap = gapFrequency[ucResult.useCaseId];
      for (const gap of ucResult.gaps) {
        const current = gapMap.get(gap.signal) || 0;
        gapMap.set(gap.signal, current + 1);
      }
    }
  }

  // Calculate rates and top gaps
  const totalAssets = assetResults.length;
  for (const ucId of Object.keys(aggregations)) {
    const agg = aggregations[ucId];
    agg.readinessRate = agg.readyCount / totalAssets;
    agg.averageScore = agg.averageScore / totalAssets;

    // Build top gaps
    const gapMap = gapFrequency[ucId];
    const sortedGaps = Array.from(gapMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    agg.topGaps = sortedGaps.map(([signal, count]) => ({
      signal,
      affectedCount: count,
      percentAffected: count / totalAssets,
    }));
  }

  return aggregations;
}

// =============================================================================
// ROLLUP NODE CREATION
// =============================================================================

/**
 * Create a rollup node from asset results
 */
export function createRollupNode(
  id: string,
  name: string,
  dimension: RollupDimension,
  dimensionValue: string,
  signalResults: AssetSignalResults[],
  useCaseResults: AssetUseCaseResults[]
): ExtendedRollupNode {
  const signals = aggregateSignals(signalResults);
  const useCases = aggregateUseCases(useCaseResults);

  // Calculate overall completeness score
  const signalScores = Object.values(signals).map(s => s.averageScore);
  const completenessScore = signalScores.length > 0
    ? signalScores.reduce((a, b) => a + b, 0) / signalScores.length
    : 0;

  return {
    id,
    name,
    dimension,
    dimensionValue,
    assetCount: signalResults.length,
    signals,
    useCases,
    completenessScore,
  };
}

// =============================================================================
// DIMENSION ROLLUPS
// =============================================================================

/**
 * Generate rollups for a single dimension
 */
export function generateDimensionRollup(
  dimension: RollupDimension,
  assets: AssetRecord[],
  signalResults: Map<string, AssetSignalResults>,
  useCaseResults: Map<string, AssetUseCaseResults>
): ExtendedRollupNode[] {
  // Group assets by dimension
  const groups = groupAssetsByDimension(assets, dimension);

  const nodes: ExtendedRollupNode[] = [];

  for (const [dimensionValue, groupAssets] of groups) {
    // Get results for assets in this group
    const groupSignalResults: AssetSignalResults[] = [];
    const groupUseCaseResults: AssetUseCaseResults[] = [];

    for (const asset of groupAssets) {
      const sr = signalResults.get(asset.guid);
      const ur = useCaseResults.get(asset.guid);

      if (sr) groupSignalResults.push(sr);
      if (ur) groupUseCaseResults.push(ur);
    }

    // Create node
    const node = createRollupNode(
      `${dimension}:${dimensionValue}`,
      dimensionValue,
      dimension,
      dimensionValue,
      groupSignalResults,
      groupUseCaseResults
    );

    nodes.push(node);
  }

  // Sort by asset count descending
  nodes.sort((a, b) => b.assetCount - a.assetCount);

  return nodes;
}

/**
 * Generate rollups for multiple dimensions
 */
export function generateAllRollups(
  dimensions: RollupDimension[],
  assets: AssetRecord[],
  signalResults: Map<string, AssetSignalResults>,
  useCaseResults: Map<string, AssetUseCaseResults>
): Record<RollupDimension, ExtendedRollupNode[]> {
  const rollups: Record<RollupDimension, ExtendedRollupNode[]> = {} as Record<RollupDimension, ExtendedRollupNode[]>;

  for (const dimension of dimensions) {
    rollups[dimension] = generateDimensionRollup(
      dimension,
      assets,
      signalResults,
      useCaseResults
    );
  }

  return rollups;
}

// =============================================================================
// HIERARCHICAL ROLLUPS
// =============================================================================

/**
 * Generate nested hierarchical rollup (connection -> database -> schema)
 */
export function generateHierarchicalRollup(
  assets: AssetRecord[],
  signalResults: Map<string, AssetSignalResults>,
  useCaseResults: Map<string, AssetUseCaseResults>
): ExtendedRollupNode[] {
  // Group by connection first
  const connectionGroups = groupAssetsByDimension(assets, 'connection');
  const connectionNodes: ExtendedRollupNode[] = [];

  for (const [connectionName, connectionAssets] of connectionGroups) {
    // Get results for connection
    const connSignalResults: AssetSignalResults[] = [];
    const connUseCaseResults: AssetUseCaseResults[] = [];

    for (const asset of connectionAssets) {
      const sr = signalResults.get(asset.guid);
      const ur = useCaseResults.get(asset.guid);
      if (sr) connSignalResults.push(sr);
      if (ur) connUseCaseResults.push(ur);
    }

    // Create connection node
    const connectionNode = createRollupNode(
      `connection:${connectionName}`,
      connectionName,
      'connection',
      connectionName,
      connSignalResults,
      connUseCaseResults
    );

    // Generate database children
    const dbGroups = groupAssetsByDimension(connectionAssets, 'database');
    const dbNodes: ExtendedRollupNode[] = [];

    for (const [dbName, dbAssets] of dbGroups) {
      const dbSignalResults: AssetSignalResults[] = [];
      const dbUseCaseResults: AssetUseCaseResults[] = [];

      for (const asset of dbAssets) {
        const sr = signalResults.get(asset.guid);
        const ur = useCaseResults.get(asset.guid);
        if (sr) dbSignalResults.push(sr);
        if (ur) dbUseCaseResults.push(ur);
      }

      const dbNode = createRollupNode(
        `database:${dbName}`,
        dbName,
        'database',
        dbName,
        dbSignalResults,
        dbUseCaseResults
      );

      // Generate schema children
      const schemaGroups = groupAssetsByDimension(dbAssets, 'schema');
      const schemaNodes: ExtendedRollupNode[] = [];

      for (const [schemaName, schemaAssets] of schemaGroups) {
        const schemaSignalResults: AssetSignalResults[] = [];
        const schemaUseCaseResults: AssetUseCaseResults[] = [];

        for (const asset of schemaAssets) {
          const sr = signalResults.get(asset.guid);
          const ur = useCaseResults.get(asset.guid);
          if (sr) schemaSignalResults.push(sr);
          if (ur) schemaUseCaseResults.push(ur);
        }

        const schemaNode = createRollupNode(
          `schema:${schemaName}`,
          schemaName,
          'schema',
          schemaName,
          schemaSignalResults,
          schemaUseCaseResults
        );

        schemaNodes.push(schemaNode);
      }

      dbNode.children = schemaNodes.sort((a, b) => b.assetCount - a.assetCount);
      dbNodes.push(dbNode);
    }

    connectionNode.children = dbNodes.sort((a, b) => b.assetCount - a.assetCount);
    connectionNodes.push(connectionNode);
  }

  return connectionNodes.sort((a, b) => b.assetCount - a.assetCount);
}

// =============================================================================
// SUMMARY CALCULATIONS
// =============================================================================

/**
 * Calculate overall signal coverage from rollup
 */
export function calculateSignalCoverage(
  signalResults: AssetSignalResults[]
): Record<SignalType, number> {
  const aggregated = aggregateSignals(signalResults);
  const coverage: Record<SignalType, number> = {} as Record<SignalType, number>;

  for (const [signalId, agg] of Object.entries(aggregated)) {
    coverage[signalId as SignalType] = agg.presenceRate;
  }

  return coverage;
}

/**
 * Calculate use case readiness rates
 */
export function calculateUseCaseReadiness(
  useCaseResults: AssetUseCaseResults[]
): Record<string, number> {
  const aggregated = aggregateUseCases(useCaseResults);
  const readiness: Record<string, number> = {};

  for (const [ucId, agg] of Object.entries(aggregated)) {
    readiness[ucId] = agg.readinessRate;
  }

  return readiness;
}

/**
 * Identify top gaps across all assets
 */
export function identifyTopGaps(
  useCaseResults: AssetUseCaseResults[],
  limit = 10
): UseCaseGap[] {
  // Collect all gaps with frequency
  const gapFrequency = new Map<string, { gap: UseCaseGap; count: number }>();

  for (const asset of useCaseResults) {
    for (const uc of asset.useCases) {
      for (const gap of uc.gaps) {
        const key = `${gap.signal}:${gap.description}`;
        const existing = gapFrequency.get(key);

        if (existing) {
          existing.count++;
        } else {
          gapFrequency.set(key, { gap, count: 1 });
        }
      }
    }
  }

  // Sort by frequency and severity
  const severityOrder: Record<string, number> = {
    CRITICAL: 0,
    HIGH: 1,
    MEDIUM: 2,
    LOW: 3,
  };

  return Array.from(gapFrequency.values())
    .sort((a, b) => {
      // First by count
      if (b.count !== a.count) return b.count - a.count;
      // Then by severity
      return severityOrder[a.gap.severity] - severityOrder[b.gap.severity];
    })
    .slice(0, limit)
    .map(({ gap }) => gap);
}

/**
 * Determine adoption phase based on overall metrics
 */
export function determineAdoptionPhase(
  signalCoverage: Record<SignalType, number>,
  useCaseReadiness: Record<string, number>
): 'FOUNDATION' | 'EXPANSION' | 'OPTIMIZATION' | 'EXCELLENCE' {
  // Core signals for adoption phase
  const coreSignals: SignalType[] = ['OWNERSHIP', 'SEMANTICS', 'LINEAGE', 'SENSITIVITY'];

  const coreSignalCoverage = coreSignals
    .map(s => signalCoverage[s] || 0)
    .reduce((a, b) => a + b, 0) / coreSignals.length;

  const avgUseCaseReadiness = Object.values(useCaseReadiness).length > 0
    ? Object.values(useCaseReadiness).reduce((a, b) => a + b, 0) / Object.values(useCaseReadiness).length
    : 0;

  // Determine phase
  if (coreSignalCoverage >= 0.9 && avgUseCaseReadiness >= 0.8) {
    return 'EXCELLENCE';
  } else if (coreSignalCoverage >= 0.7 && avgUseCaseReadiness >= 0.6) {
    return 'OPTIMIZATION';
  } else if (coreSignalCoverage >= 0.4 && avgUseCaseReadiness >= 0.3) {
    return 'EXPANSION';
  } else {
    return 'FOUNDATION';
  }
}

// =============================================================================
// COMPARISON UTILITIES
// =============================================================================

/**
 * Compare two rollup nodes
 */
export function compareRollupNodes(
  nodeA: ExtendedRollupNode,
  nodeB: ExtendedRollupNode
): {
  scoreDelta: number;
  signalDeltas: Record<SignalType, number>;
  useCaseDeltas: Record<string, number>;
  improved: SignalType[];
  degraded: SignalType[];
} {
  const signalDeltas: Record<SignalType, number> = {} as Record<SignalType, number>;
  const useCaseDeltas: Record<string, number> = {};
  const improved: SignalType[] = [];
  const degraded: SignalType[] = [];

  // Compare signals
  for (const signalId of Object.keys(nodeA.signals) as SignalType[]) {
    const scoreA = nodeA.signals[signalId]?.averageScore || 0;
    const scoreB = nodeB.signals[signalId]?.averageScore || 0;
    const delta = scoreB - scoreA;

    signalDeltas[signalId] = delta;

    if (delta > 0.05) improved.push(signalId);
    if (delta < -0.05) degraded.push(signalId);
  }

  // Compare use cases
  for (const ucId of Object.keys(nodeA.useCases)) {
    const scoreA = nodeA.useCases[ucId]?.averageScore || 0;
    const scoreB = nodeB.useCases[ucId]?.averageScore || 0;
    useCaseDeltas[ucId] = scoreB - scoreA;
  }

  return {
    scoreDelta: nodeB.completenessScore - nodeA.completenessScore,
    signalDeltas,
    useCaseDeltas,
    improved,
    degraded,
  };
}

/**
 * Find nodes with lowest scores
 */
export function findLowestScoringNodes(
  nodes: ExtendedRollupNode[],
  limit = 10
): ExtendedRollupNode[] {
  return [...nodes]
    .sort((a, b) => a.completenessScore - b.completenessScore)
    .slice(0, limit);
}

/**
 * Find nodes with highest gap counts
 */
export function findHighestGapNodes(
  nodes: ExtendedRollupNode[],
  useCaseId: string,
  limit = 10
): ExtendedRollupNode[] {
  return [...nodes]
    .filter(n => n.useCases[useCaseId])
    .sort((a, b) => {
      const gapsA = a.useCases[useCaseId].topGaps.reduce((sum, g) => sum + g.affectedCount, 0);
      const gapsB = b.useCases[useCaseId].topGaps.reduce((sum, g) => sum + g.affectedCount, 0);
      return gapsB - gapsA;
    })
    .slice(0, limit);
}
