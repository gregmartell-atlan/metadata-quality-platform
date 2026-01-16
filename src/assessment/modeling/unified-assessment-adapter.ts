/**
 * Unified Assessment Adapter
 *
 * Bridges the unified field catalog and assessment engine to UI components.
 * Provides functions to convert between the unified system's types and
 * presentation formats suitable for dashboards and reports.
 *
 * This adapter allows incremental migration without breaking existing UI.
 *
 * Ported from atlan-metadata-evaluation/assessment/packages/web
 */

import type {
  SignalType,
  SignalDefinition,
  UnifiedField,
  UseCaseProfile,
  FieldSource,
  SignalResult,
  AssetSignalResults,
  UseCaseResult,
} from '../catalog/types';
import { SIGNAL_DEFINITIONS, getSignalById } from '../catalog/signal-definitions';
import { UNIFIED_FIELD_CATALOG, getFieldById, getFieldsForSignal } from '../catalog/unified-fields';
import { USE_CASE_PROFILES, getUseCaseById } from '../catalog/use-case-profiles';

// =============================================================================
// LEGACY TYPE MAPPINGS (for backward compatibility)
// =============================================================================

/**
 * Legacy metadata field types (from existing UI)
 */
export type MetadataFieldType =
  | 'ownerUsers'
  | 'ownerGroups'
  | 'description'
  | 'userDescription'
  | 'readme'
  | 'glossaryTerms'
  | 'atlanTags'
  | 'certificateStatus'
  | 'customMetadata'
  | 'lineage'
  | 'accessPolicies'
  | 'starredBy'
  | 'links';

/**
 * Legacy priority interface
 */
export interface Priority {
  field: MetadataFieldType;
  level: 'P0' | 'P1' | 'P2' | 'P3';
  score: number;
  badge: string;
  label: string;
  reasoning: string[];
}

/**
 * Legacy field coverage interface
 */
export interface FieldCoverage {
  field: MetadataFieldType;
  coveragePercent: number;
  assetsCovered?: number;
  populatedAssets?: number;
  totalAssets: number;
}

/**
 * Persona types
 */
export type PersonaType =
  | 'all'
  | 'governance_lead'
  | 'data_steward'
  | 'compliance_officer'
  | 'data_analyst'
  | 'data_engineer'
  | 'executive'
  | 'atlan_csm';

// =============================================================================
// TYPE MAPPINGS
// =============================================================================

/**
 * Maps unified signal types to legacy field types
 */
const SIGNAL_TO_LEGACY_FIELDS: Record<SignalType, MetadataFieldType[]> = {
  OWNERSHIP: ['ownerUsers', 'ownerGroups'],
  SEMANTICS: ['description', 'readme', 'glossaryTerms'],
  LINEAGE: ['lineage'],
  SENSITIVITY: ['atlanTags', 'certificateStatus'],
  ACCESS: ['atlanTags'],
  QUALITY: ['customMetadata'],
  FRESHNESS: ['customMetadata'],
  USAGE: ['customMetadata'],
  AI_READY: ['description', 'ownerUsers', 'certificateStatus', 'atlanTags'],
  TRUST: ['certificateStatus'],
};

/**
 * Maps legacy field types to unified signal types
 */
export const LEGACY_FIELD_TO_SIGNALS: Record<MetadataFieldType, SignalType[]> = {
  ownerUsers: ['OWNERSHIP'],
  ownerGroups: ['OWNERSHIP'],
  description: ['SEMANTICS', 'AI_READY'],
  userDescription: ['SEMANTICS'],
  readme: ['SEMANTICS'],
  glossaryTerms: ['SEMANTICS'],
  atlanTags: ['SENSITIVITY', 'ACCESS'],
  certificateStatus: ['SENSITIVITY', 'TRUST', 'AI_READY'],
  customMetadata: ['QUALITY', 'FRESHNESS', 'USAGE'],
  lineage: ['LINEAGE'],
  accessPolicies: ['ACCESS'],
  starredBy: ['USAGE'],
  links: ['SEMANTICS'],
};

// =============================================================================
// SIGNAL COVERAGE ADAPTER
// =============================================================================

/**
 * Unified signal coverage for UI display
 */
export interface UnifiedSignalCoverage {
  signal: SignalType;
  displayName: string;
  description: string;
  coveragePercent: number;
  assetsCovered: number;
  totalAssets: number;
  severity: 'HIGH' | 'MED' | 'LOW';
  workstream: string;
  contributingFields: Array<{
    fieldId: string;
    fieldName: string;
    coverage: number;
    weight: number;
  }>;
}

/**
 * Converts legacy field coverage to unified signal coverage
 */
export function convertToSignalCoverage(
  fieldCoverage: FieldCoverage[],
  signalDefinitions: SignalDefinition[] = SIGNAL_DEFINITIONS,
  unifiedFields: UnifiedField[] = UNIFIED_FIELD_CATALOG
): UnifiedSignalCoverage[] {
  return signalDefinitions.map((signalDef) => {
    // Find all fields that contribute to this signal
    const contributingFieldDefs = unifiedFields.filter((f) =>
      f.contributesToSignals.some((c) => c.signal === signalDef.id)
    );

    // Map to legacy field names and find coverage
    const contributingFields = contributingFieldDefs.map((fieldDef) => {
      const legacyFieldName = getLegacyFieldName(fieldDef);
      const coverage = fieldCoverage.find((fc) => fc.field === legacyFieldName);
      const contribution = fieldDef.contributesToSignals.find(
        (c) => c.signal === signalDef.id
      );

      return {
        fieldId: fieldDef.id,
        fieldName: fieldDef.displayName,
        coverage: coverage?.coveragePercent || 0,
        weight: contribution?.weight || 0,
      };
    });

    // Calculate signal coverage based on aggregation method
    let signalCoverage = 0;
    if (signalDef.aggregation.method === 'any') {
      // ANY: Max coverage among contributing fields
      signalCoverage = Math.max(
        0,
        ...contributingFields.map((f) => f.coverage)
      );
    } else if (signalDef.aggregation.method === 'all') {
      // ALL: Min coverage among contributing fields
      const coverages = contributingFields.map((f) => f.coverage);
      signalCoverage = coverages.length > 0 ? Math.min(...coverages) : 0;
    } else if (signalDef.aggregation.method === 'weighted_threshold') {
      // WEIGHTED: Weighted average
      const totalWeight = contributingFields.reduce((sum, f) => sum + f.weight, 0);
      if (totalWeight > 0) {
        signalCoverage = contributingFields.reduce(
          (sum, f) => sum + f.coverage * f.weight,
          0
        ) / totalWeight;
      }
    }

    // Get total assets from first matching field coverage
    const sampleCoverage = fieldCoverage[0];
    const totalAssets = sampleCoverage?.totalAssets || 0;

    return {
      signal: signalDef.id,
      displayName: signalDef.displayName,
      description: signalDef.description,
      coveragePercent: signalCoverage,
      assetsCovered: Math.round(signalCoverage * totalAssets),
      totalAssets,
      severity: signalDef.severity,
      workstream: signalDef.workstream,
      contributingFields,
    };
  });
}

// =============================================================================
// USE CASE READINESS ADAPTER
// =============================================================================

/**
 * Use case readiness for UI display
 */
export interface UseCaseReadiness {
  useCaseId: string;
  displayName: string;
  readinessScore: number;
  status: 'ready' | 'partial' | 'not_ready';
  signalScores: Array<{
    signal: SignalType;
    signalName: string;
    score: number;
    weight: number;
    required: boolean;
    passing: boolean;
  }>;
  missingRequirements: string[];
  topGaps: string[];
}

/**
 * Calculates use case readiness from signal coverage
 */
export function calculateUseCaseReadiness(
  signalCoverage: UnifiedSignalCoverage[],
  useCaseProfile: UseCaseProfile
): UseCaseReadiness {
  const signalMap = new Map(signalCoverage.map((s) => [s.signal, s]));

  const signalScores = useCaseProfile.signals.map((signalWeight) => {
    const coverage = signalMap.get(signalWeight.signal);
    const score = coverage?.coveragePercent || 0;
    const passing = score >= (useCaseProfile.thresholds.partial);

    return {
      signal: signalWeight.signal,
      signalName: coverage?.displayName || signalWeight.signal,
      score,
      weight: signalWeight.weight,
      required: signalWeight.required || false,
      passing,
    };
  });

  // Calculate weighted readiness score
  const totalWeight = signalScores.reduce((sum, s) => sum + s.weight, 0);
  const readinessScore =
    totalWeight > 0
      ? signalScores.reduce((sum, s) => sum + s.score * s.weight, 0) / totalWeight
      : 0;

  // Check required signals
  const missingRequirements = signalScores
    .filter((s) => s.required && !s.passing)
    .map((s) => s.signalName);

  // Determine status
  let status: 'ready' | 'partial' | 'not_ready' = 'not_ready';
  if (readinessScore >= useCaseProfile.thresholds.ready && missingRequirements.length === 0) {
    status = 'ready';
  } else if (readinessScore >= useCaseProfile.thresholds.partial) {
    status = 'partial';
  }

  // Top gaps - lowest scoring signals
  const topGaps = signalScores
    .filter((s) => s.score < 0.7)
    .sort((a, b) => a.score - b.score)
    .slice(0, 3)
    .map((s) => s.signalName);

  return {
    useCaseId: useCaseProfile.id,
    displayName: useCaseProfile.displayName,
    readinessScore: readinessScore * 100,
    status,
    signalScores,
    missingRequirements,
    topGaps,
  };
}

// =============================================================================
// PRIORITY ADAPTER
// =============================================================================

/**
 * Converts unified signal coverage to legacy Priority format
 */
export function convertSignalsToPriorities(
  signalCoverage: UnifiedSignalCoverage[]
): Priority[] {
  const priorities: Priority[] = [];

  for (const signal of signalCoverage) {
    // Map signal back to legacy field(s)
    const legacyFields = SIGNAL_TO_LEGACY_FIELDS[signal.signal] || [];

    for (const legacyField of legacyFields) {
      // Calculate priority score (inverse of coverage)
      const gapScore = (1 - signal.coveragePercent) * 100;

      // Determine priority level
      let level: 'P0' | 'P1' | 'P2' | 'P3' = 'P3';
      if (gapScore >= 80) level = 'P0';
      else if (gapScore >= 60) level = 'P1';
      else if (gapScore >= 40) level = 'P2';

      const reasoning: string[] = [];
      if (signal.severity === 'HIGH') {
        reasoning.push(`High severity: ${signal.displayName} signal`);
      }
      if (signal.coveragePercent < 0.3) {
        reasoning.push(`Critical gap: only ${Math.round(signal.coveragePercent * 100)}% coverage`);
      }

      priorities.push({
        field: legacyField,
        level,
        score: Math.round(gapScore),
        badge: level === 'P0' ? 'Critical' : level === 'P1' ? 'High' : level === 'P2' ? 'Medium' : 'Low',
        label: level === 'P0' ? 'Critical Priority' : level === 'P1' ? 'High Priority' : level === 'P2' ? 'Medium Priority' : 'Low Priority',
        reasoning,
      });
    }
  }

  // Deduplicate by field, keeping highest priority
  const fieldMap = new Map<string, Priority>();
  for (const priority of priorities) {
    const existing = fieldMap.get(priority.field);
    if (!existing || priority.score > existing.score) {
      fieldMap.set(priority.field, priority);
    }
  }

  return Array.from(fieldMap.values()).sort((a, b) => b.score - a.score);
}

// =============================================================================
// FIELD SOURCE UTILITIES
// =============================================================================

/**
 * Gets a human-readable description of a field source
 */
export function describeFieldSource(source: FieldSource): string {
  switch (source.type) {
    case 'native':
      return `Native attribute: ${source.attribute}`;
    case 'native_any':
      return `Native attributes (any): ${(source.attributes as string[]).join(' | ')}`;
    case 'custom_metadata':
      return `Custom Metadata: ${source.businessAttribute}.${source.attribute}`;
    case 'classification':
      if (source.pattern) return `Classification pattern: ${source.pattern}`;
      if (source.anyOf) return `Classifications: ${(source.anyOf as string[]).join(', ')}`;
      return 'Classification tags';
    case 'relationship':
      return `Relationship: ${source.relation}${source.direction ? ` (${source.direction})` : ''}`;
    case 'derived':
      return `Derived: ${source.derivation}`;
    default:
      return 'Unknown source';
  }
}

/**
 * Gets the legacy field name from a unified field definition
 */
function getLegacyFieldName(field: UnifiedField): MetadataFieldType {
  const source = field.source;
  if (source.type === 'native') {
    return source.attribute as MetadataFieldType;
  }
  if (source.type === 'native_any') {
    return (source.attributes as string[])[0] as MetadataFieldType;
  }
  if (source.type === 'relationship') {
    if (source.relation === 'meanings') return 'glossaryTerms';
    if (source.relation === 'readme') return 'readme';
    if (source.relation.includes('lineage') || source.relation.includes('Process')) {
      return 'lineage';
    }
  }
  if (source.type === 'classification') {
    return 'atlanTags';
  }
  if (source.type === 'custom_metadata') {
    return 'customMetadata';
  }
  // Default fallback
  return field.id as MetadataFieldType;
}

// =============================================================================
// EVIDENCE TYPES
// =============================================================================

/**
 * Field evidence for detailed view
 */
export interface FieldEvidence {
  fieldId: string;
  fieldName: string;
  description: string;
  source: FieldSource;
  sourceDescription: string;
  contributesToSignals: Array<{
    signal: SignalType;
    signalName: string;
    weight: number;
  }>;
  coverage: {
    percent: number;
    assetsCovered: number;
    totalAssets: number;
  };
  examples: Array<{
    assetName: string;
    assetType: string;
    value: unknown;
    qualifiedName?: string;
  }>;
  useCases: string[];
  coreForUseCases: string[];
  completenessWeight?: number;
  atlanDocsUrl?: string;
}

/**
 * Builds field evidence data for the Evidence Drawer
 */
export function buildFieldEvidence(
  field: UnifiedField,
  coverage: FieldCoverage | undefined,
  signalDefinitions: SignalDefinition[] = SIGNAL_DEFINITIONS,
  sampleAssets?: Array<{ name: string; typeName: string; [key: string]: unknown }>
): FieldEvidence {
  const signalMap = new Map(signalDefinitions.map((s) => [s.id, s]));

  return {
    fieldId: field.id,
    fieldName: field.displayName,
    description: field.description,
    source: field.source,
    sourceDescription: describeFieldSource(field.source),
    contributesToSignals: field.contributesToSignals.map((c) => ({
      signal: c.signal,
      signalName: signalMap.get(c.signal)?.displayName || c.signal,
      weight: c.weight,
    })),
    coverage: {
      percent: coverage?.coveragePercent || 0,
      assetsCovered: coverage?.assetsCovered || coverage?.populatedAssets || 0,
      totalAssets: coverage?.totalAssets || 0,
    },
    examples: (sampleAssets || []).slice(0, 5).map((asset) => {
      const legacyField = getLegacyFieldName(field);
      return {
        assetName: asset.name,
        assetType: asset.typeName,
        value: asset[legacyField],
        qualifiedName: asset.qualifiedName as string | undefined,
      };
    }),
    useCases: field.useCases,
    coreForUseCases: field.coreForUseCases,
    completenessWeight: field.completenessWeight,
    atlanDocsUrl: field.atlanDocsUrl,
  };
}

// =============================================================================
// ADOPTION PHASE MAPPING
// =============================================================================

export type AdoptionPhase = 'FOUNDATION' | 'EXPANSION' | 'OPTIMIZATION' | 'EXCELLENCE';

/**
 * Maps unified adoption phases to legacy phases
 */
export function mapAdoptionPhase(
  unifiedPhase: AdoptionPhase
): {
  phase: 'Seeding' | 'Gamification' | 'Operationalization';
  recommendation: string;
  tactics: string[];
} {
  switch (unifiedPhase) {
    case 'FOUNDATION':
      return {
        phase: 'Seeding',
        recommendation: 'Focus on automated enrichment - crawlers, AI descriptions, bulk imports',
        tactics: [
          'Enable Snowflake/dbt comment crawling',
          'Use Atlan AI for description drafts',
          'Bulk CSV upload for owners',
          'Set up Playbooks for tag automation',
        ],
      };
    case 'EXPANSION':
      return {
        phase: 'Gamification',
        recommendation: 'Engage stewards with gamification and working sessions',
        tactics: [
          'Launch Metadata Bingo campaigns',
          'Run Treasure Hunt challenges',
          'Host steward enrichment sprints',
          'Celebrate top contributors',
        ],
      };
    case 'OPTIMIZATION':
    case 'EXCELLENCE':
      return {
        phase: 'Operationalization',
        recommendation: 'Lock in gains with process changes and automation',
        tactics: [
          'Add metadata checks to CI/CD pipelines',
          'Update PR templates to require metadata',
          'Enable Metadata Propagator',
          'Set up governance approval workflows',
          'Monitor completeness dashboards',
        ],
      };
  }
}

// =============================================================================
// PERSONA FILTERING
// =============================================================================

/**
 * Filters signals by persona relevance
 */
export function filterSignalsByPersona(
  signalCoverage: UnifiedSignalCoverage[],
  persona: PersonaType
): UnifiedSignalCoverage[] {
  if (persona === 'all') return signalCoverage;

  // Persona -> Signal relevance mapping
  const personaSignals: Record<Exclude<PersonaType, 'all'>, SignalType[]> = {
    governance_lead: ['OWNERSHIP', 'TRUST', 'SENSITIVITY', 'ACCESS', 'QUALITY'],
    data_steward: ['OWNERSHIP', 'SEMANTICS', 'SENSITIVITY'],
    compliance_officer: ['SENSITIVITY', 'ACCESS', 'TRUST', 'LINEAGE'],
    data_analyst: ['SEMANTICS', 'LINEAGE', 'QUALITY', 'USAGE'],
    data_engineer: ['LINEAGE', 'QUALITY', 'FRESHNESS'],
    executive: ['TRUST', 'OWNERSHIP', 'AI_READY'],
    atlan_csm: ['OWNERSHIP', 'SEMANTICS', 'TRUST', 'QUALITY'],
  };

  const relevantSignals = personaSignals[persona] || [];

  return signalCoverage.filter((s) => relevantSignals.includes(s.signal));
}

// =============================================================================
// SIGNAL RESULT CONVERSION
// =============================================================================

/**
 * Converts internal SignalResult to UI-friendly format
 */
export function convertSignalResultToUI(
  signalResult: SignalResult
): {
  signal: SignalType;
  displayName: string;
  score: number;
  scorePercent: number;
  status: 'good' | 'warning' | 'critical';
  confidence: number;
  contributingFieldCount: number;
  presentFieldCount: number;
} {
  const signalDef = getSignalById(signalResult.signal);
  const presentCount = signalResult.contributingFields.filter(f => f.present === true).length;

  let status: 'good' | 'warning' | 'critical' = 'good';
  if (signalResult.score < 0.3) {
    status = 'critical';
  } else if (signalResult.score < 0.7) {
    status = 'warning';
  }

  return {
    signal: signalResult.signal,
    displayName: signalDef?.displayName || signalResult.signal,
    score: signalResult.score,
    scorePercent: Math.round(signalResult.score * 100),
    status,
    confidence: signalResult.confidence,
    contributingFieldCount: signalResult.contributingFields.length,
    presentFieldCount: presentCount,
  };
}

/**
 * Converts internal UseCaseResult to UI-friendly format
 */
export function convertUseCaseResultToUI(
  useCaseResult: UseCaseResult
): {
  useCaseId: string;
  displayName: string;
  score: number;
  scorePercent: number;
  status: 'ready' | 'partial' | 'not_ready';
  statusBadge: string;
  statusColor: string;
  requiredSignalsMet: string;
  gapCount: number;
  topGap?: string;
} {
  const profile = getUseCaseById(useCaseResult.useCaseId);

  let statusBadge = 'Not Ready';
  let statusColor = 'red';

  switch (useCaseResult.readinessLevel) {
    case 'EXCELLENT':
    case 'READY':
      statusBadge = 'Ready';
      statusColor = 'green';
      break;
    case 'PARTIAL':
      statusBadge = 'Partial';
      statusColor = 'yellow';
      break;
  }

  return {
    useCaseId: useCaseResult.useCaseId,
    displayName: profile?.displayName || useCaseResult.useCaseName,
    score: useCaseResult.readinessScore,
    scorePercent: Math.round(useCaseResult.readinessScore * 100),
    status: useCaseResult.readinessLevel === 'READY' || useCaseResult.readinessLevel === 'EXCELLENT'
      ? 'ready'
      : useCaseResult.readinessLevel === 'PARTIAL'
        ? 'partial'
        : 'not_ready',
    statusBadge,
    statusColor,
    requiredSignalsMet: `${useCaseResult.requiredSignalsMet}/${useCaseResult.requiredSignalsTotal}`,
    gapCount: useCaseResult.gaps.length,
    topGap: useCaseResult.gaps[0]?.description,
  };
}

// =============================================================================
// SUMMARY FORMATTERS
// =============================================================================

/**
 * Format assessment summary for display
 */
export function formatAssessmentSummary(
  overallScore: number,
  signalCoverage: Record<SignalType, number>,
  adoptionPhase: AdoptionPhase
): {
  scoreDisplay: string;
  scoreGrade: 'A' | 'B' | 'C' | 'D' | 'F';
  phaseDisplay: string;
  phaseRecommendation: string;
  topSignal: { signal: SignalType; coverage: number } | null;
  lowestSignal: { signal: SignalType; coverage: number } | null;
} {
  const entries = Object.entries(signalCoverage) as [SignalType, number][];
  const sorted = entries.sort((a, b) => b[1] - a[1]);

  const topSignal = sorted.length > 0 ? { signal: sorted[0][0], coverage: sorted[0][1] } : null;
  const lowestSignal = sorted.length > 0 ? { signal: sorted[sorted.length - 1][0], coverage: sorted[sorted.length - 1][1] } : null;

  const phaseInfo = mapAdoptionPhase(adoptionPhase);

  let scoreGrade: 'A' | 'B' | 'C' | 'D' | 'F' = 'F';
  if (overallScore >= 0.9) scoreGrade = 'A';
  else if (overallScore >= 0.8) scoreGrade = 'B';
  else if (overallScore >= 0.7) scoreGrade = 'C';
  else if (overallScore >= 0.6) scoreGrade = 'D';

  return {
    scoreDisplay: `${Math.round(overallScore * 100)}%`,
    scoreGrade,
    phaseDisplay: phaseInfo.phase,
    phaseRecommendation: phaseInfo.recommendation,
    topSignal,
    lowestSignal,
  };
}
