/**
 * Use Case Assessor
 *
 * Evaluates assets against use case profiles and generates
 * readiness scores, gaps, and recommendations.
 *
 * Ported from atlan-metadata-evaluation/assessment/packages/domain
 */

import type {
  AssetRecord,
  AssetFieldResults,
  AssetSignalResults,
  AssetUseCaseResults,
  FieldResult,
  SignalResult,
  UseCaseResult,
  UseCaseGap,
  AssessmentRequest,
  AssessmentResult,
  AssessmentOptions,
  AssessmentProgress,
  AssessmentRecommendation,
  AssetFetcher,
  SignalType,
  TriState,
  UseCaseProfile,
  UnifiedField,
  TenantConfiguration,
  FieldSource,
  RollupDimension,
} from '../catalog/types';
import { UNIFIED_FIELD_CATALOG, getFieldById } from '../catalog/unified-fields';
import { SIGNAL_DEFINITIONS, getSignalById } from '../catalog/signal-definitions';
import { USE_CASE_PROFILES, getUseCaseById } from '../catalog/use-case-profiles';
import {
  generateAllRollups,
  calculateSignalCoverage,
  calculateUseCaseReadiness,
  identifyTopGaps,
  determineAdoptionPhase,
} from './rollup-engine';

// =============================================================================
// TENANT CONFIG HELPERS
// =============================================================================

/**
 * Get effective field source for a canonical field from tenant config
 */
function getEffectiveFieldSource(
  tenantConfig: TenantConfiguration,
  canonicalFieldId: string
): FieldSource | undefined {
  // Check if excluded
  if (tenantConfig.excludedFields.includes(canonicalFieldId)) {
    return undefined;
  }

  // Check field mappings
  const mapping = tenantConfig.fieldMappings.find(
    m => m.canonicalFieldId === canonicalFieldId
  );

  if (mapping && mapping.status !== 'rejected') {
    return mapping.tenantSource;
  }

  return undefined;
}

// =============================================================================
// FIELD EVALUATION
// =============================================================================

/**
 * Evaluate a single field on an asset using tenant configuration
 */
export function evaluateField(
  field: UnifiedField,
  asset: AssetRecord,
  tenantConfig: TenantConfiguration
): FieldResult {
  // Get effective source from tenant config
  const effectiveSource = getEffectiveFieldSource(tenantConfig, field.id);

  // Fall back to canonical source if not mapped
  const source = effectiveSource || field.source;

  try {
    const { present, value } = evaluateSource(source, asset);

    return {
      fieldId: field.id,
      fieldName: field.displayName,
      present,
      value,
      source: describeSource(source),
    };
  } catch (error) {
    return {
      fieldId: field.id,
      fieldName: field.displayName,
      present: 'UNKNOWN',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Evaluate a field source against an asset
 */
function evaluateSource(
  source: FieldSource,
  asset: AssetRecord
): { present: TriState; value?: unknown } {
  switch (source.type) {
    case 'native': {
      const value = asset.attributes[source.attribute];
      return {
        present: isValuePresent(value),
        value,
      };
    }

    case 'native_any': {
      for (const attr of source.attributes) {
        const value = asset.attributes[attr];
        if (isValuePresent(value) === true) {
          return { present: true, value };
        }
      }
      return { present: false };
    }

    case 'custom_metadata': {
      const cm = asset.customMetadata?.[source.businessAttribute];
      if (!cm) return { present: false };

      const value = cm[source.attribute];
      return {
        present: isValuePresent(value),
        value,
      };
    }

    case 'classification': {
      if (!asset.classifications) return { present: false };

      // Classification source may have a pattern or specific tag
      const classificationSource = source as { type: 'classification'; pattern?: string; anyOf?: string[] };
      const patternStr = classificationSource.pattern || '.*';
      const pattern = new RegExp(patternStr, 'i');

      let hasMatch = false;
      if (classificationSource.anyOf && classificationSource.anyOf.length > 0) {
        hasMatch = asset.classifications.some(c => classificationSource.anyOf!.includes(c));
      } else {
        hasMatch = asset.classifications.some(c => pattern.test(c));
      }

      return {
        present: hasMatch,
        value: hasMatch ? asset.classifications.filter(c => pattern.test(c)) : undefined,
      };
    }

    case 'relationship': {
      // Relationships would need additional API calls
      // For now, check if relationship count > 0 in attributes
      const countAttr = `${source.relation}Count`;
      const count = asset.attributes[countAttr] as number | undefined;

      return {
        present: count !== undefined && count > (source.countThreshold ?? 0),
        value: count,
      };
    }

    case 'derived': {
      // Derived fields have a derivation description
      // For now, return UNKNOWN as they require custom evaluation logic
      // In a full implementation, this would look up a registered evaluator
      return { present: 'UNKNOWN' };
    }

    default:
      return { present: 'UNKNOWN' };
  }
}

/**
 * Check if a value is present (non-null, non-empty)
 */
function isValuePresent(value: unknown): TriState {
  if (value === undefined || value === null) return false;
  if (typeof value === 'string' && value.trim() === '') return false;
  if (Array.isArray(value) && value.length === 0) return false;
  if (typeof value === 'object' && Object.keys(value).length === 0) return false;
  return true;
}

/**
 * Describe a field source for debugging
 */
function describeSource(source: FieldSource): string {
  switch (source.type) {
    case 'native':
      return `native:${source.attribute}`;
    case 'native_any':
      return `native_any:[${source.attributes.join(', ')}]`;
    case 'custom_metadata':
      return `cm:${source.businessAttribute}.${source.attribute}`;
    case 'classification': {
      const classSource = source as { type: 'classification'; pattern?: string; anyOf?: string[] };
      return `classification:${classSource.pattern || classSource.anyOf?.join(',') || '*'}`;
    }
    case 'relationship':
      return `relationship:${source.relation}`;
    case 'derived':
      return `derived:${source.derivation}`;
    default:
      return 'unknown';
  }
}

/**
 * Evaluate all fields on an asset
 */
export function evaluateAllFields(
  asset: AssetRecord,
  tenantConfig: TenantConfiguration
): AssetFieldResults {
  const fields: FieldResult[] = [];

  for (const field of UNIFIED_FIELD_CATALOG) {
    // Skip fields not applicable to this asset type
    if (field.supportedAssetTypes.length > 0 &&
        !field.supportedAssetTypes.includes('*') &&
        !field.supportedAssetTypes.includes(asset.typeName)) {
      continue;
    }

    fields.push(evaluateField(field, asset, tenantConfig));
  }

  return {
    assetGuid: asset.guid,
    assetType: asset.typeName,
    qualifiedName: asset.qualifiedName,
    fields,
    evaluatedAt: new Date().toISOString(),
  };
}

// =============================================================================
// SIGNAL COMPOSITION
// =============================================================================

/**
 * Compose a signal from field results
 */
export function composeSignal(
  signalId: SignalType,
  fieldResults: FieldResult[]
): SignalResult {
  const signalDef = getSignalById(signalId);
  if (!signalDef) {
    return {
      signal: signalId,
      present: 'UNKNOWN',
      score: 0,
      confidence: 0,
      contributingFields: [],
    };
  }

  // Get fields that contribute to this signal
  const contributingFields = UNIFIED_FIELD_CATALOG
    .filter(f => f.contributesToSignals.some(c => c.signal === signalId))
    .map(f => {
      const contribution = f.contributesToSignals.find(c => c.signal === signalId)!;
      const result = fieldResults.find(r => r.fieldId === f.id);

      return {
        fieldId: f.id,
        present: result?.present ?? 'UNKNOWN' as TriState,
        weight: contribution.weight,
      };
    });

  // Apply aggregation method
  const { present, score } = aggregateSignal(contributingFields, signalDef.aggregation);

  // Calculate confidence based on known values
  const knownCount = contributingFields.filter(f => f.present !== 'UNKNOWN').length;
  const confidence = contributingFields.length > 0
    ? knownCount / contributingFields.length
    : 0;

  return {
    signal: signalId,
    present,
    score,
    confidence,
    contributingFields,
  };
}

/**
 * Aggregate signal based on method
 */
function aggregateSignal(
  fields: Array<{ present: TriState; weight: number }>,
  aggregation: { method: string; threshold?: number }
): { present: TriState; score: number } {
  if (fields.length === 0) {
    return { present: 'UNKNOWN', score: 0 };
  }

  const presentFields = fields.filter(f => f.present === true);
  const absentFields = fields.filter(f => f.present === false);
  const unknownFields = fields.filter(f => f.present === 'UNKNOWN');

  switch (aggregation.method) {
    case 'any': {
      if (presentFields.length > 0) {
        // Score based on best contributing field
        const maxWeight = Math.max(...presentFields.map(f => f.weight));
        return { present: true, score: maxWeight };
      }
      if (unknownFields.length === fields.length) {
        return { present: 'UNKNOWN', score: 0 };
      }
      return { present: false, score: 0 };
    }

    case 'all': {
      if (absentFields.length > 0) {
        return { present: false, score: presentFields.length / fields.length };
      }
      if (unknownFields.length > 0) {
        return { present: 'UNKNOWN', score: presentFields.length / fields.length };
      }
      return { present: true, score: 1.0 };
    }

    case 'weighted_threshold': {
      const totalWeight = fields.reduce((sum, f) => sum + f.weight, 0);
      const presentWeight = presentFields.reduce((sum, f) => sum + f.weight, 0);
      const score = totalWeight > 0 ? presentWeight / totalWeight : 0;
      const threshold = aggregation.threshold ?? 0.5;

      return {
        present: score >= threshold,
        score,
      };
    }

    default:
      return { present: 'UNKNOWN', score: 0 };
  }
}

/**
 * Compose all signals for an asset
 */
export function composeAllSignals(
  fieldResults: AssetFieldResults
): AssetSignalResults {
  const signals: SignalResult[] = [];

  for (const signalDef of SIGNAL_DEFINITIONS) {
    signals.push(composeSignal(signalDef.id, fieldResults.fields));
  }

  // Calculate overall score
  const overallScore = signals.length > 0
    ? signals.reduce((sum, s) => sum + s.score, 0) / signals.length
    : 0;

  return {
    assetGuid: fieldResults.assetGuid,
    assetType: fieldResults.assetType,
    qualifiedName: fieldResults.qualifiedName,
    signals,
    overallScore,
    evaluatedAt: fieldResults.evaluatedAt,
  };
}

// =============================================================================
// USE CASE ASSESSMENT
// =============================================================================

/**
 * Assess an asset against a use case profile
 */
export function assessUseCase(
  useCaseId: string,
  signalResults: AssetSignalResults
): UseCaseResult {
  const profile = getUseCaseById(useCaseId);
  if (!profile) {
    return {
      useCaseId,
      useCaseName: useCaseId,
      readinessScore: 0,
      readinessLevel: 'NOT_READY',
      requiredSignalsMet: 0,
      requiredSignalsTotal: 0,
      signalScores: [],
      gaps: [],
    };
  }

  const signalScores: UseCaseResult['signalScores'] = [];
  const gaps: UseCaseGap[] = [];
  let weightedScore = 0;
  let totalWeight = 0;
  let requiredMet = 0;
  let requiredTotal = 0;

  for (const signalWeight of profile.signals) {
    const signalResult = signalResults.signals.find(s => s.signal === signalWeight.signal);
    const score = signalResult?.score ?? 0;
    const isRequired = signalWeight.required ?? false;
    const met = score >= 0.5; // Default threshold

    signalScores.push({
      signal: signalWeight.signal,
      weight: signalWeight.weight,
      required: isRequired,
      score,
      met,
    });

    weightedScore += score * signalWeight.weight;
    totalWeight += signalWeight.weight;

    if (isRequired) {
      requiredTotal++;
      if (met) requiredMet++;
    }

    // Generate gaps for unmet signals
    if (!met) {
      const signalDef = getSignalById(signalWeight.signal);
      gaps.push({
        signal: signalWeight.signal,
        severity: isRequired ? 'CRITICAL' : getSeverityFromWeight(signalWeight.weight),
        description: `${signalDef?.displayName || signalWeight.signal} signal is insufficient for ${profile.displayName}`,
        remediation: signalDef?.guidanceUrl || `Improve ${signalWeight.signal} coverage`,
        affectedFields: getFieldsForSignal(signalWeight.signal),
        estimatedEffort: getEffortEstimate(signalWeight.signal),
      });
    }
  }

  const readinessScore = totalWeight > 0 ? weightedScore / totalWeight : 0;
  const readinessLevel = getReadinessLevel(readinessScore, requiredMet, requiredTotal);

  return {
    useCaseId,
    useCaseName: profile.displayName,
    readinessScore,
    readinessLevel,
    requiredSignalsMet: requiredMet,
    requiredSignalsTotal: requiredTotal,
    signalScores,
    gaps,
  };
}

/**
 * Get severity from signal weight
 */
function getSeverityFromWeight(weight: number): 'HIGH' | 'MEDIUM' | 'LOW' {
  if (weight >= 0.3) return 'HIGH';
  if (weight >= 0.15) return 'MEDIUM';
  return 'LOW';
}

/**
 * Get field IDs that contribute to a signal
 */
function getFieldsForSignal(signalId: SignalType): string[] {
  return UNIFIED_FIELD_CATALOG
    .filter(f => f.contributesToSignals.some(c => c.signal === signalId))
    .map(f => f.id);
}

/**
 * Estimate effort to improve a signal
 */
function getEffortEstimate(signalId: SignalType): 'LOW' | 'MEDIUM' | 'HIGH' {
  // Signals that typically require more effort
  const highEffortSignals: SignalType[] = ['LINEAGE', 'QUALITY'];
  const mediumEffortSignals: SignalType[] = ['SENSITIVITY', 'ACCESS', 'FRESHNESS'];

  if (highEffortSignals.includes(signalId)) return 'HIGH';
  if (mediumEffortSignals.includes(signalId)) return 'MEDIUM';
  return 'LOW';
}

/**
 * Determine readiness level from score and required signals
 */
function getReadinessLevel(
  score: number,
  requiredMet: number,
  requiredTotal: number
): 'NOT_READY' | 'PARTIAL' | 'READY' | 'EXCELLENT' {
  const allRequiredMet = requiredTotal === 0 || requiredMet === requiredTotal;

  if (score >= 0.9 && allRequiredMet) return 'EXCELLENT';
  if (score >= 0.7 && allRequiredMet) return 'READY';
  if (score >= 0.4 || requiredMet > 0) return 'PARTIAL';
  return 'NOT_READY';
}

/**
 * Assess all use cases for an asset
 */
export function assessAllUseCases(
  signalResults: AssetSignalResults,
  useCaseIds?: string[]
): AssetUseCaseResults {
  const profiles = useCaseIds
    ? useCaseIds.map(id => getUseCaseById(id)).filter((p): p is UseCaseProfile => p !== undefined)
    : USE_CASE_PROFILES;

  const useCases = profiles.map(p => assessUseCase(p.id, signalResults));

  // Find best and worst
  const sorted = [...useCases].sort((a, b) => b.readinessScore - a.readinessScore);
  const bestReadyUseCase = sorted.find(uc => uc.readinessLevel !== 'NOT_READY')?.useCaseId;
  const worstGapUseCase = sorted[sorted.length - 1]?.useCaseId;

  return {
    assetGuid: signalResults.assetGuid,
    assetType: signalResults.assetType,
    qualifiedName: signalResults.qualifiedName,
    useCases,
    bestReadyUseCase,
    worstGapUseCase,
    evaluatedAt: signalResults.evaluatedAt,
  };
}

// =============================================================================
// FULL ASSESSMENT ORCHESTRATION
// =============================================================================

/**
 * Run a complete assessment
 */
export async function runAssessment(
  request: AssessmentRequest,
  fetcher: AssetFetcher,
  options: AssessmentOptions = {}
): Promise<AssessmentResult> {
  const startTime = Date.now();
  const { batchSize = 100, onProgress, onError = 'warn' } = options;

  // Progress tracking
  let assetsProcessed = 0;
  let totalAssets = 0;

  const reportProgress = (phase: AssessmentProgress['phase']) => {
    if (onProgress) {
      onProgress({
        phase,
        assetsProcessed,
        assetsTotal: totalAssets,
        percentComplete: totalAssets > 0 ? (assetsProcessed / totalAssets) * 100 : 0,
        elapsedMs: Date.now() - startTime,
      });
    }
  };

  // 1. Fetch assets
  reportProgress('FETCHING');
  const assets = await fetcher.fetchAssets(request.scope, request.tenantConfig);
  totalAssets = assets.length;

  // 2. Evaluate fields and compose signals
  reportProgress('EVALUATING');
  const signalResultsMap = new Map<string, AssetSignalResults>();
  const useCaseResultsMap = new Map<string, AssetUseCaseResults>();
  const assetDetails: AssetUseCaseResults[] = [];

  for (let i = 0; i < assets.length; i += batchSize) {
    const batch = assets.slice(i, i + batchSize);

    for (const asset of batch) {
      try {
        // Evaluate fields
        const fieldResults = evaluateAllFields(asset, request.tenantConfig);

        // Compose signals
        const signalResults = composeAllSignals(fieldResults);
        signalResultsMap.set(asset.guid, signalResults);

        // Assess use cases
        const useCaseResults = assessAllUseCases(signalResults, request.useCases);
        useCaseResultsMap.set(asset.guid, useCaseResults);

        if (request.includeEvidence) {
          assetDetails.push(useCaseResults);
        }

        assetsProcessed++;
      } catch (error) {
        if (onError === 'fail') {
          throw error;
        }
        // For 'warn' and 'skip' modes, continue processing
        assetsProcessed++;
      }
    }

    reportProgress('EVALUATING');
  }

  // 3. Generate rollups
  reportProgress('ROLLING_UP');
  const dimensions = request.rollupDimensions || ['connection', 'schema', 'owner'] as RollupDimension[];
  const rollups = generateAllRollups(
    dimensions,
    assets,
    signalResultsMap,
    useCaseResultsMap
  );

  // 4. Calculate summary
  const signalCoverage = calculateSignalCoverage(Array.from(signalResultsMap.values()));
  const useCaseReadiness = calculateUseCaseReadiness(Array.from(useCaseResultsMap.values()));
  const topGaps = identifyTopGaps(Array.from(useCaseResultsMap.values()));
  const adoptionPhase = determineAdoptionPhase(signalCoverage, useCaseReadiness);

  // Calculate overall score
  const overallScore = Object.values(signalCoverage).reduce((a, b) => a + b, 0) /
    Object.values(signalCoverage).length;

  // 5. Generate recommendations
  let recommendations: AssessmentRecommendation[] | undefined;
  if (request.includeRecommendations) {
    recommendations = generateRecommendations(
      topGaps,
      signalCoverage,
      useCaseReadiness,
      totalAssets
    );
  }

  reportProgress('COMPLETE');

  return {
    request,
    metadata: {
      assessedAt: new Date().toISOString(),
      durationMs: Date.now() - startTime,
      totalAssets,
      sampledAssets: assetsProcessed,
      scope: request.scope,
    },
    summary: {
      overallScore,
      signalCoverage,
      useCaseReadiness,
      topGaps,
      adoptionPhase,
    },
    rollups,
    assetDetails: request.includeEvidence ? assetDetails : undefined,
    recommendations,
  };
}

/**
 * Generate recommendations from assessment results
 */
function generateRecommendations(
  topGaps: UseCaseGap[],
  signalCoverage: Record<SignalType, number>,
  useCaseReadiness: Record<string, number>,
  totalAssets: number
): AssessmentRecommendation[] {
  const recommendations: AssessmentRecommendation[] = [];

  // Recommendations from gaps
  for (const gap of topGaps.slice(0, 5)) {
    recommendations.push({
      priority: gap.severity === 'CRITICAL' ? 'CRITICAL' :
                gap.severity === 'HIGH' ? 'HIGH' : 'MEDIUM',
      category: 'SIGNAL_GAP',
      title: `Improve ${gap.signal} signal coverage`,
      description: gap.description,
      affectedSignals: [gap.signal],
      estimatedImpact: {
        assetsAffected: Math.round(totalAssets * (1 - (signalCoverage[gap.signal] || 0))),
        scoreImprovement: 0.1,
      },
      remediation: {
        steps: [gap.remediation],
        effort: gap.estimatedEffort || 'MEDIUM',
      },
    });
  }

  // Recommendations from low coverage signals
  const lowCoverageSignals = Object.entries(signalCoverage)
    .filter(([_, coverage]) => coverage < 0.3)
    .map(([signal]) => signal as SignalType);

  for (const signal of lowCoverageSignals) {
    const signalDef = getSignalById(signal);
    if (!signalDef) continue;

    // Skip if already recommended from gaps
    if (recommendations.some(r => r.affectedSignals?.includes(signal))) continue;

    recommendations.push({
      priority: signalDef.severity === 'HIGH' ? 'HIGH' : 'MEDIUM',
      category: 'COVERAGE_GAP',
      title: `Increase ${signalDef.displayName} coverage`,
      description: `Only ${Math.round(signalCoverage[signal] * 100)}% of assets have ${signalDef.displayName} information`,
      affectedSignals: [signal],
      estimatedImpact: {
        assetsAffected: Math.round(totalAssets * (1 - signalCoverage[signal])),
        scoreImprovement: (0.7 - signalCoverage[signal]) * 0.2,
      },
      remediation: {
        steps: [
          `Identify assets missing ${signalDef.displayName}`,
          signalDef.guidanceUrl || `Add ${signal.toLowerCase()} metadata`,
        ],
        effort: 'MEDIUM',
      },
    });
  }

  // Sort by priority
  const priorityOrder = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
  recommendations.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

  return recommendations;
}
