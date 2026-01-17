/**
 * Quality Metrics Scoring for Atlan Assets
 */

import type { AtlanAssetSummary } from './atlan/api';

export interface QualityScores {
  completeness: number;
  accuracy: number;
  timeliness: number;
  consistency: number;
  usability: number;
}

// Utility: presence check (type guard)
function hasValue<T>(val: T | null | undefined): val is T {
  return val !== undefined && val !== null && val !== '';
}

// Completeness: coverage of key fields
export function scoreCompleteness(asset: AtlanAssetSummary): number {
  // TODO: Add DQ rule coverage and profiling coverage once aggregated data is wired in.
  const checks = [
    hasValue(asset.userDescription || asset.description),
    hasValue(asset.ownerUsers) || hasValue(asset.ownerGroups),
    hasValue(asset.certificateStatus),
    hasValue(asset.classificationNames),
    hasValue(asset.meanings),
    hasValue(asset.readme),
    hasValue(asset.domainGUIDs),
    asset.__hasLineage === true,
  ];
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}

// Accuracy: validity/conformance checks
export function scoreAccuracy(asset: AtlanAssetSummary): number {
  let score = 0;
  let total = 0;
  // Naming convention (simple regex)
  total++;
  if (/^[\w\-\.]+$/.test(asset.name)) score++;
  // Owner validity
  total++;
  if (hasValue(asset.ownerUsers) && asset.ownerUsers.length > 0) score++;
  // Certificate recency
  total++;
  if (hasValue(asset.certificateStatus) && hasValue(asset.certificateUpdatedAt)) score++;
  // Classification sanity
  total++;
  if (hasValue(asset.classificationNames)) score++;
  // AI generated flag
  total++;
  if (!asset.isAIGenerated) score++;
  return Math.round((score / total) * 100);
}

// Timeliness: staleness checks
export function scoreTimeliness(asset: AtlanAssetSummary): number {
  const now = Date.now();
  const clocks = [
    asset.updateTime,
    asset.sourceUpdatedAt,
    asset.lastRowChangedAt,
    asset.certificateUpdatedAt,
    asset.lastProfiledAt,
  ].filter(hasValue);
  if (clocks.length === 0) return 0;
  // Score: 1 if any clock is <90 days old, else 0
  const recent = clocks.some(ts => now - new Date(ts).getTime() < 90 * 24 * 3600 * 1000);
  return recent ? 100 : 0;
}

// Consistency: policy checks
export function scoreConsistency(asset: AtlanAssetSummary): number {
  let score = 0;
  let total = 0;
  // Domain/terms alignment
  total++;
  if (hasValue(asset.domainGUIDs) && hasValue(asset.meanings)) score++;
  // Tag/classification rules
  total++;
  if (hasValue(asset.classificationNames)) score++;
  // Hierarchy consistency
  total++;
  if (hasValue(asset.databaseQualifiedName) && hasValue(asset.schemaQualifiedName)) score++;
  // Connection consistency
  total++;
  if (hasValue(asset.connectionQualifiedName)) score++;
  return Math.round((score / total) * 100);
}

// Usability: engagement/consumption proxies
export function scoreUsability(asset: AtlanAssetSummary): number {
  // TODO: Incorporate aggregated usage rollups (searchlog) once available.
  let score = 0;
  let total = 0;
  // Engagement
  total++;
  if (hasValue(asset.popularityScore) || hasValue(asset.viewScore)) score++;
  // Consumption
  total++;
  if (hasValue(asset.sourceReadCount) || hasValue(asset.sourceReadUserCount)) score++;
  // Table usage
  total++;
  if (hasValue(asset.queryCount) || hasValue(asset.queryUserCount)) score++;
  // Discoverability
  total++;
  if (asset.isDiscoverable !== false) score++;
  return Math.round((score / total) * 100);
}

// Aggregate all scores
export function scoreAssetQuality(asset: AtlanAssetSummary): QualityScores {
  return {
    completeness: scoreCompleteness(asset),
    accuracy: scoreAccuracy(asset),
    timeliness: scoreTimeliness(asset),
    consistency: scoreConsistency(asset),
    usability: scoreUsability(asset),
  };
}
/**
 * Quality Metrics Calculation Service
 * 
 * Defines the underlying calculations and metrics that drive the five
 * quality dimensions: Completeness, Accuracy, Timeliness, Consistency, and Usability
 */

export interface AssetMetadata {
  // Core identification
  id: string;
  name: string;
  assetType: string;
  connection: string;
  domain?: string;
  owner?: string;
  ownerGroup?: string;

  // Completeness factors
  description?: string;
  descriptionLength?: number;
  tags?: string[];
  enrichedTags?: Array<{
    name: string;
    guid?: string;
    isDirect: boolean;          // true if directly assigned, false if propagated
    propagates: boolean;        // whether this tag propagates to children
    propagatesToLineage: boolean;
    propagatesToHierarchy: boolean;
  }>;
  customProperties?: Record<string, any>;
  columnDescriptions?: number; // For tables
  totalColumns?: number;

  // Accuracy factors
  lastValidated?: Date;
  validationErrors?: number;
  schemaMatchesSource?: boolean;
  dataTypeAccuracy?: number; // 0-100
  businessGlossaryMatch?: boolean;

  // Timeliness factors
  lastUpdated?: Date;
  lastProfiled?: Date;
  schemaLastChanged?: Date;
  metadataLastRefreshed?: Date;
  stalenessThreshold?: number; // days

  // Consistency factors
  namingConvention?: string;
  expectedNamingPattern?: string;
  fieldNameConsistency?: number; // 0-100
  dataTypeConsistency?: number; // 0-100
  formatConsistency?: number; // 0-100
  domainConsistency?: number; // 0-100

  // Usability factors
  certified?: boolean;
  certificationStatus?: 'certified' | 'draft' | 'deprecated' | 'none';
  hasLineage?: boolean;
  upstreamCount?: number;
  downstreamCount?: number;
  hasDocumentation?: boolean;
  documentationQuality?: number; // 0-100
  searchable?: boolean;
  hasBusinessContext?: boolean;
}

/**
 * COMPLETENESS METRICS
 * Measures how fully documented an asset is
 * 
 * Factors:
 * - Description presence and quality
 * - Owner assignment
 * - Tag coverage
 * - Custom property completeness
 * - Column-level documentation (for tables)
 */
export function calculateCompleteness(asset: AssetMetadata): number {
  let score = 0;
  let maxScore = 0;

  // Description (30% weight)
  maxScore += 30;
  if (asset.description) {
    const descLength = asset.descriptionLength || asset.description.length;
    if (descLength >= 100) {
      score += 30; // Full points for substantial description
    } else if (descLength >= 50) {
      score += 20; // Partial for medium description
    } else if (descLength > 0) {
      score += 10; // Minimal for short description
    }
  }

  // Owner assignment (25% weight)
  maxScore += 25;
  if (asset.owner || asset.ownerGroup) {
    score += 25;
  }

  // Tags (15% weight)
  maxScore += 15;
  if (asset.tags && asset.tags.length > 0) {
    const tagScore = Math.min(15, asset.tags.length * 3); // 3 points per tag, max 15
    score += tagScore;
  }

  // Custom properties (10% weight)
  maxScore += 10;
  if (asset.customProperties) {
    const propCount = Object.keys(asset.customProperties).length;
    if (propCount >= 3) {
      score += 10;
    } else if (propCount >= 1) {
      score += 5;
    }
  }

  // Column-level documentation (20% weight, for tables only)
  maxScore += 20;
  if (asset.assetType?.toLowerCase().includes('table') && asset.totalColumns) {
    const columnDocRate = (asset.columnDescriptions || 0) / asset.totalColumns;
    score += columnDocRate * 20;
  } else {
    // For non-table assets, give full points if other factors are good
    if (asset.description && asset.owner) {
      score += 20;
    }
  }

  return Math.round((score / maxScore) * 100);
}

/**
 * ACCURACY METRICS
 * Measures how correct and validated the metadata is
 * 
 * Factors:
 * - Schema validation
 * - Data type accuracy
 * - Business glossary alignment
 * - Validation error count
 * - Last validation timestamp
 */
export function calculateAccuracy(asset: AssetMetadata): number {
  let score = 0;
  let maxScore = 0;

  // Schema matches source (30% weight)
  maxScore += 30;
  if (asset.schemaMatchesSource === true) {
    score += 30;
  } else if (asset.schemaMatchesSource === false) {
    score += 0;
  } else {
    score += 15; // Unknown = partial credit
  }

  // Data type accuracy (25% weight)
  maxScore += 25;
  if (asset.dataTypeAccuracy !== undefined) {
    score += (asset.dataTypeAccuracy / 100) * 25;
  } else {
    score += 12.5; // Unknown = partial credit
  }

  // Business glossary match (20% weight)
  maxScore += 20;
  if (asset.businessGlossaryMatch === true) {
    score += 20;
  } else if (asset.businessGlossaryMatch === false) {
    score += 0;
  } else {
    score += 10; // Unknown = partial credit
  }

  // Validation errors (15% weight - inverse)
  maxScore += 15;
  const errorCount = asset.validationErrors || 0;
  if (errorCount === 0) {
    score += 15;
  } else if (errorCount <= 2) {
    score += 10;
  } else if (errorCount <= 5) {
    score += 5;
  }

  // Recent validation (10% weight)
  maxScore += 10;
  if (asset.lastValidated) {
    const daysSinceValidation = Math.floor(
      (Date.now() - new Date(asset.lastValidated).getTime()) / (1000 * 60 * 60 * 24)
    );
    if (daysSinceValidation <= 30) {
      score += 10;
    } else if (daysSinceValidation <= 90) {
      score += 5;
    }
  }

  return Math.round((score / maxScore) * 100);
}

/**
 * TIMELINESS METRICS
 * Measures how up-to-date the metadata is
 * 
 * Factors:
 * - Last update timestamp
 * - Schema change detection
 * - Metadata refresh frequency
 * - Staleness threshold violations
 */
export function calculateTimeliness(asset: AssetMetadata): number {
  let score = 0;
  let maxScore = 0;
  const now = Date.now();
  const stalenessThreshold = asset.stalenessThreshold || 90; // Default 90 days

  // Last updated (40% weight)
  maxScore += 40;
  if (asset.lastUpdated) {
    const daysSinceUpdate = Math.floor((now - new Date(asset.lastUpdated).getTime()) / (1000 * 60 * 60 * 24));
    if (daysSinceUpdate <= 7) {
      score += 40; // Very recent
    } else if (daysSinceUpdate <= 30) {
      score += 30; // Recent
    } else if (daysSinceUpdate <= stalenessThreshold) {
      score += 20; // Acceptable
    } else {
      score += 0; // Stale
    }
  } else {
    score += 0; // Never updated
  }

  // Schema change detection (25% weight)
  maxScore += 25;
  if (asset.schemaLastChanged) {
    const daysSinceSchemaChange = Math.floor(
      (now - new Date(asset.schemaLastChanged).getTime()) / (1000 * 60 * 60 * 24)
    );
    if (daysSinceSchemaChange <= 30) {
      // Schema changed recently - metadata should be updated
      if (asset.lastUpdated && asset.lastUpdated >= asset.schemaLastChanged) {
        score += 25; // Metadata updated after schema change
      } else {
        score += 5; // Schema changed but metadata not updated
      }
    } else {
      score += 25; // Schema stable
    }
  } else {
    score += 12.5; // Unknown schema change status
  }

  // Metadata refresh frequency (20% weight)
  maxScore += 20;
  if (asset.metadataLastRefreshed) {
    const daysSinceRefresh = Math.floor(
      (now - new Date(asset.metadataLastRefreshed).getTime()) / (1000 * 60 * 60 * 24)
    );
    if (daysSinceRefresh <= 7) {
      score += 20;
    } else if (daysSinceRefresh <= 30) {
      score += 15;
    } else if (daysSinceRefresh <= stalenessThreshold) {
      score += 10;
    }
  } else {
    score += 0;
  }

  // Last profiled (15% weight)
  maxScore += 15;
  if (asset.lastProfiled) {
    const daysSinceProfiled = Math.floor(
      (now - new Date(asset.lastProfiled).getTime()) / (1000 * 60 * 60 * 24)
    );
    if (daysSinceProfiled <= 30) {
      score += 15;
    } else if (daysSinceProfiled <= 90) {
      score += 10;
    } else if (daysSinceProfiled <= 180) {
      score += 5;
    }
  }

  return Math.round((score / maxScore) * 100);
}

/**
 * CONSISTENCY METRICS
 * Measures how consistent metadata is across assets and domains
 * 
 * Factors:
 * - Naming convention adherence
 * - Field name consistency
 * - Data type consistency
 * - Format consistency
 * - Domain-level consistency
 */
export function calculateConsistency(asset: AssetMetadata): number {
  let score = 0;
  let maxScore = 0;

  // Naming convention (30% weight)
  maxScore += 30;
  if (asset.namingConvention && asset.expectedNamingPattern) {
    // Simple pattern matching - in production, use regex or more sophisticated matching
    const matches = asset.name.match(new RegExp(asset.expectedNamingPattern, 'i'));
    if (matches) {
      score += 30;
    } else {
      score += 10; // Partial match or close
    }
  } else if (asset.namingConvention) {
    score += 15; // Has convention but no pattern to check
  }

  // Field name consistency (25% weight)
  maxScore += 25;
  if (asset.fieldNameConsistency !== undefined) {
    score += (asset.fieldNameConsistency / 100) * 25;
  } else {
    score += 12.5; // Unknown
  }

  // Data type consistency (20% weight)
  maxScore += 20;
  if (asset.dataTypeConsistency !== undefined) {
    score += (asset.dataTypeConsistency / 100) * 20;
  } else {
    score += 10; // Unknown
  }

  // Format consistency (15% weight)
  maxScore += 15;
  if (asset.formatConsistency !== undefined) {
    score += (asset.formatConsistency / 100) * 15;
  } else {
    score += 7.5; // Unknown
  }

  // Domain consistency (10% weight)
  maxScore += 10;
  if (asset.domainConsistency !== undefined) {
    score += (asset.domainConsistency / 100) * 10;
  } else if (asset.domain) {
    score += 5; // Has domain but no consistency metric
  }

  return Math.round((score / maxScore) * 100);
}

/**
 * USABILITY METRICS
 * Measures how useful and accessible the metadata is
 * 
 * Factors:
 * - Certification status
 * - Lineage coverage
 * - Documentation quality
 * - Searchability
 * - Business context
 */
export function calculateUsability(asset: AssetMetadata): number {
  let score = 0;
  let maxScore = 0;

  // Certification status (30% weight)
  maxScore += 30;
  if (asset.certificationStatus === 'certified') {
    score += 30;
  } else if (asset.certificationStatus === 'draft') {
    score += 15;
  } else if (asset.certificationStatus === 'deprecated') {
    score += 5;
  } else {
    score += 0; // None
  }

  // Lineage coverage (25% weight)
  maxScore += 25;
  const hasUpstream = (asset.upstreamCount || 0) > 0;
  const hasDownstream = (asset.downstreamCount || 0) > 0;
  if (hasUpstream && hasDownstream) {
    score += 25; // Full lineage
  } else if (hasUpstream || hasDownstream) {
    score += 15; // Partial lineage
  } else if (asset.hasLineage === false) {
    score += 0; // No lineage
  } else {
    score += 5; // Unknown
  }

  // Documentation quality (20% weight)
  maxScore += 20;
  if (asset.hasDocumentation) {
    if (asset.documentationQuality !== undefined) {
      score += (asset.documentationQuality / 100) * 20;
    } else {
      score += 15; // Has docs but no quality metric
    }
  }

  // Searchability (15% weight)
  maxScore += 15;
  if (asset.searchable === true) {
    score += 15;
  } else if (asset.searchable === false) {
    score += 0;
  } else {
    // Default: searchable if has description and tags
    if (asset.description && asset.tags && asset.tags.length > 0) {
      score += 15;
    } else if (asset.description) {
      score += 10;
    }
  }

  // Business context (10% weight)
  maxScore += 10;
  if (asset.hasBusinessContext === true) {
    score += 10;
  } else if (asset.hasBusinessContext === false) {
    score += 0;
  } else {
    // Default: has context if has owner and description
    if (asset.owner && asset.description) {
      score += 10;
    } else if (asset.owner || asset.description) {
      score += 5;
    }
  }

  return Math.round((score / maxScore) * 100);
}

/**
 * Scoring Weights Configuration
 *
 * These weights determine how the five quality dimensions combine
 * into a single overall score. They should match config/scoring-weights.yaml
 * and backend/app/scoring_config.py
 */
export const DIMENSION_WEIGHTS = {
  completeness: 0.30,  // 30%
  accuracy: 0.25,      // 25%
  timeliness: 0.20,    // 20%
  consistency: 0.15,   // 15%
  usability: 0.10,     // 10%
} as const;

/**
 * Calculate overall quality score using weighted average
 *
 * Uses DIMENSION_WEIGHTS for proper weighting of each dimension.
 * Matches the calculation in backend/app/scoring_config.py
 */
export function calculateOverallScore(scores: {
  completeness: number;
  accuracy: number;
  timeliness: number;
  consistency: number;
  usability: number;
}): number {
  return Math.round(
    DIMENSION_WEIGHTS.completeness * scores.completeness +
    DIMENSION_WEIGHTS.accuracy * scores.accuracy +
    DIMENSION_WEIGHTS.timeliness * scores.timeliness +
    DIMENSION_WEIGHTS.consistency * scores.consistency +
    DIMENSION_WEIGHTS.usability * scores.usability
  );
}

/**
 * Calculate quality scores for a single asset
 */
export function calculateAssetQuality(asset: AssetMetadata): {
  completeness: number;
  accuracy: number;
  timeliness: number;
  consistency: number;
  usability: number;
  overall: number;
} {
  const completeness = calculateCompleteness(asset);
  const accuracy = calculateAccuracy(asset);
  const timeliness = calculateTimeliness(asset);
  const consistency = calculateConsistency(asset);
  const usability = calculateUsability(asset);

  return {
    completeness,
    accuracy,
    timeliness,
    consistency,
    usability,
    overall: calculateOverallScore({
      completeness,
      accuracy,
      timeliness,
      consistency,
      usability,
    }),
  };
}

/**
 * Aggregate quality scores across multiple assets
 */
export function aggregateQualityScores(assets: AssetMetadata[]): {
  completeness: number;
  accuracy: number;
  timeliness: number;
  consistency: number;
  usability: number;
  overall: number;
} {
  if (assets.length === 0) {
    return {
      completeness: 0,
      accuracy: 0,
      timeliness: 0,
      consistency: 0,
      usability: 0,
      overall: 0,
    };
  }

  const scores = assets.map((asset) => calculateAssetQuality(asset));

  // Single-pass aggregation instead of 6 separate reduces
  const totals = scores.reduce(
    (acc, s) => {
      acc.completeness += s.completeness;
      acc.accuracy += s.accuracy;
      acc.timeliness += s.timeliness;
      acc.consistency += s.consistency;
      acc.usability += s.usability;
      acc.overall += s.overall;
      return acc;
    },
    { completeness: 0, accuracy: 0, timeliness: 0, consistency: 0, usability: 0, overall: 0 }
  );

  const count = scores.length;
  return {
    completeness: Math.round(totals.completeness / count),
    accuracy: Math.round(totals.accuracy / count),
    timeliness: Math.round(totals.timeliness / count),
    consistency: Math.round(totals.consistency / count),
    usability: Math.round(totals.usability / count),
    overall: Math.round(totals.overall / count),
  };
}

// ============================================
// MDLH Integration
// ============================================

import { useBackendModeStore } from '../stores/backendModeStore';
import * as mdlhClient from './mdlhClient';

/**
 * Fetch quality scores using the appropriate backend.
 * 
 * In API mode: Fetches assets and calculates scores client-side
 * In MDLH mode: Fetches pre-calculated scores from Snowflake
 */
export async function fetchQualityScores(options?: {
  assetType?: string;
  connector?: string;
  limit?: number;
  offset?: number;
}): Promise<{
  scores: Array<{
    guid: string;
    name: string;
    typeName: string;
    connector: string | null;
    completeness: number;
    accuracy: number;
    timeliness: number;
    consistency: number;
    usability: number;
    overall: number;
  }>;
  totalCount?: number;
}> {
  const { dataBackend, snowflakeStatus } = useBackendModeStore.getState();

  // Use MDLH if selected and connected
  if (dataBackend === 'mdlh' && snowflakeStatus.connected) {
    const result = await mdlhClient.getQualityScores({
      assetType: options?.assetType,
      connector: options?.connector,
      limit: options?.limit || 100,
      offset: options?.offset || 0,
    });

    return {
      scores: result.scores,
    };
  }

  // Fallback to API mode - return empty for now
  // (actual asset fetching and scoring would be done in the component)
  return { scores: [] };
}

/**
 * Fetch aggregated quality metrics using the appropriate backend.
 * 
 * In API mode: Fetches assets and aggregates client-side
 * In MDLH mode: Uses server-side aggregation for better performance
 */
export async function fetchAggregatedMetrics(options?: {
  dimension?: 'connector' | 'database' | 'schema' | 'asset_type';
  assetType?: string;
}): Promise<{
  totalAssets: number;
  averageScores: {
    completeness: number;
    accuracy: number;
    timeliness: number;
    consistency: number;
    usability: number;
    overall: number;
  };
  byDimension: Array<{
    dimensionValue: string;
    totalAssets: number;
    avgCompleteness: number;
    avgAccuracy: number;
    avgTimeliness: number;
    avgConsistency: number;
    avgUsability: number;
    avgOverall?: number;
  }>;
}> {
  const { dataBackend, snowflakeStatus } = useBackendModeStore.getState();

  // Use MDLH if selected and connected
  if (dataBackend === 'mdlh' && snowflakeStatus.connected) {
    const result = await mdlhClient.getAggregatedQualityMetrics({
      dimension: options?.dimension,
      assetType: options?.assetType,
    });

    return {
      totalAssets: result.totalAssets,
      averageScores: result.averageScores,
      byDimension: result.byDimension.map((r) => ({
        dimensionValue: r.DIMENSION_VALUE,
        totalAssets: r.TOTAL_ASSETS,
        avgCompleteness: r.AVG_COMPLETENESS,
        avgAccuracy: r.AVG_ACCURACY,
        avgTimeliness: r.AVG_TIMELINESS,
        avgConsistency: r.AVG_CONSISTENCY,
        avgUsability: r.AVG_USABILITY,
        avgOverall: r.AVG_OVERALL,
      })),
    };
  }

  // Fallback to empty for API mode
  return {
    totalAssets: 0,
    averageScores: {
      completeness: 0,
      accuracy: 0,
      timeliness: 0,
      consistency: 0,
      usability: 0,
      overall: 0,
    },
    byDimension: [],
  };
}
