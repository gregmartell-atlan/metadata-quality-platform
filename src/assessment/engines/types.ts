/**
 * Assessment Engine Types
 *
 * Type definitions used by the assessment engines.
 * Adapted from atlan-metadata-evaluation/assessment/packages/domain
 */

import { SignalType, TriState, GapSeverity as CatalogGapSeverity } from '../catalog/types';

// =============================================================================
// SIGNAL TYPES (Canonical 10 signals - aligned with catalog/types.ts)
// =============================================================================

/**
 * Canonical signal types for the assessment engines
 * These map to the 10 signals defined in catalog/types.ts SignalType
 */
export type CanonicalSignal =
  | 'OWNERSHIP'       // Assets have assigned owners
  | 'LINEAGE'         // Data flow relationships documented
  | 'SEMANTICS'       // Documentation and context present
  | 'SENSITIVITY'     // Classification and sensitivity markers
  | 'ACCESS'          // Access policies defined
  | 'QUALITY'         // DQ monitoring configured
  | 'FRESHNESS'       // Timeliness monitoring configured
  | 'USAGE'           // Usage telemetry available
  | 'AI_READY'        // AI/ML use approved
  | 'TRUST';          // Certification and trust markers

/**
 * Tri-state value for signal presence
 */
export type SignalValue = true | false | 'UNKNOWN';

/**
 * Complete signal profile for an asset
 */
export interface CanonicalSignals {
  OWNERSHIP: SignalValue;
  LINEAGE: SignalValue;
  SEMANTICS: SignalValue;
  SENSITIVITY: SignalValue;
  ACCESS: SignalValue;
  QUALITY: SignalValue;
  FRESHNESS: SignalValue;
  USAGE: SignalValue;
  AI_READY: SignalValue;
  TRUST: SignalValue;
}

/**
 * Workstream categorization for remediation activities
 */
export type Workstream =
  | 'OWNERSHIP'
  | 'SEMANTICS'
  | 'LINEAGE'
  | 'SENSITIVITY_ACCESS'
  | 'QUALITY_FRESHNESS';

/**
 * Maps canonical signals to their remediation workstreams
 * Aligned with catalog/signal-definitions.ts WORKSTREAM_DEFINITIONS
 */
export const SIGNAL_TO_WORKSTREAM: Record<CanonicalSignal, Workstream> = {
  OWNERSHIP: 'OWNERSHIP',
  TRUST: 'OWNERSHIP',          // Trust/certification belongs to ownership workstream
  SEMANTICS: 'SEMANTICS',
  LINEAGE: 'LINEAGE',
  SENSITIVITY: 'SENSITIVITY_ACCESS',
  ACCESS: 'SENSITIVITY_ACCESS',
  AI_READY: 'SENSITIVITY_ACCESS',  // AI readiness relates to access governance
  QUALITY: 'QUALITY_FRESHNESS',
  FRESHNESS: 'QUALITY_FRESHNESS',
  USAGE: 'QUALITY_FRESHNESS',
};

/**
 * Signal importance for gap severity calculation
 * Aligned with catalog/signal-definitions.ts severity definitions
 */
export const SIGNAL_SEVERITY_MAP: Record<CanonicalSignal, GapSeverity> = {
  OWNERSHIP: 'HIGH',
  SEMANTICS: 'HIGH',
  AI_READY: 'HIGH',
  LINEAGE: 'MED',
  SENSITIVITY: 'MED',
  ACCESS: 'MED',
  TRUST: 'MED',
  QUALITY: 'LOW',
  FRESHNESS: 'LOW',
  USAGE: 'LOW',
};

// =============================================================================
// ASSET EVIDENCE (simplified from @atlan/assessment-lib)
// =============================================================================

/**
 * Tri-state type for evidence fields
 */
export type Tri = boolean | 'UNKNOWN';

/**
 * Asset evidence from the assessment library
 * Contains all metadata signals for an asset
 * Updated to support all 10 canonical signals
 */
export interface AssetEvidence {
  assetId: string;
  name?: string;
  type: string;
  qualifiedName?: string;

  // Ownership signal
  ownerPresent?: Tri;

  // Semantics signal
  descriptionPresent?: Tri;
  runbookPresent?: Tri;
  glossaryTermsPresent?: Tri;

  // Lineage signal
  relationshipsPresent?: Tri;
  hasUpstream?: Tri;
  hasDownstream?: Tri;

  // Sensitivity signal
  hasClassifiedFields?: Tri;
  sensitivityTagsPresent?: Tri;

  // Access signal
  accessPoliciesPresent?: Tri;

  // Quality signal
  dqSignalsPresent?: Tri;
  dqMonitoringConfigured?: Tri;

  // Freshness signal
  freshnessSlaPass?: Tri;
  freshnessMonitoringConfigured?: Tri;

  // Usage signal
  usageTelemetryPresent?: Tri;
  popularityAvailable?: Tri;

  // AI_READY signal
  aiApproved?: Tri;
  aiGovernanceConfigured?: Tri;

  // Trust signal
  certificationPresent?: Tri;
  verifiedStatus?: Tri;
}

/**
 * Assessment result from the scoring engine
 */
export interface AssessmentResult {
  readiness: number | 'UNKNOWN';
  gatePass: boolean;
  blockers: string[];
  dimensionScores?: Record<string, number | 'UNKNOWN'>;
}

// =============================================================================
// GAP TYPES
// =============================================================================

/**
 * Types of gaps detected in metadata quality assessment
 */
export type GapType = 'MISSING' | 'UNKNOWN' | 'CONFLICT';

/**
 * Severity level for gap prioritization
 */
export type GapSeverity = 'HIGH' | 'MED' | 'LOW';

/**
 * Subject type for gap attribution
 */
export type SubjectType = 'DOMAIN' | 'ASSET' | 'MODEL_ELEMENT';

/**
 * A detected gap in metadata quality
 */
export interface Gap {
  id: string;
  gapType: GapType;
  signalType: CanonicalSignal;
  subjectType: SubjectType;
  subjectId: string;
  subjectName?: string;
  assetType?: string;
  qualifiedName?: string;
  severity: GapSeverity;
  workstream: Workstream;
  explanation: string;
  evidenceRefs: string[];
  detectedAt?: string;
}

/**
 * Summary statistics for gaps
 */
export interface GapSummary {
  total: number;
  byGapType: Record<GapType, number>;
  bySeverity: Record<GapSeverity, number>;
  byWorkstream: Record<Workstream, number>;
  bySignal: Record<CanonicalSignal, number>;
}

/**
 * Creates a unique gap ID
 */
export function createGapId(
  gapType: GapType,
  signalType: CanonicalSignal,
  subjectId: string
): string {
  return `gap-${gapType.toLowerCase()}-${signalType.toLowerCase()}-${subjectId}`;
}

/**
 * Computes gap summary statistics
 */
export function computeGapSummary(gaps: Gap[]): GapSummary {
  const summary: GapSummary = {
    total: gaps.length,
    byGapType: { MISSING: 0, UNKNOWN: 0, CONFLICT: 0 },
    bySeverity: { HIGH: 0, MED: 0, LOW: 0 },
    byWorkstream: {
      OWNERSHIP: 0,
      SEMANTICS: 0,
      LINEAGE: 0,
      SENSITIVITY_ACCESS: 0,
      QUALITY_FRESHNESS: 0,
    },
    bySignal: {
      OWNERSHIP: 0,
      LINEAGE: 0,
      SEMANTICS: 0,
      SENSITIVITY: 0,
      ACCESS: 0,
      QUALITY: 0,
      FRESHNESS: 0,
      USAGE: 0,
      AI_READY: 0,
      TRUST: 0,
    },
  };

  for (const gap of gaps) {
    summary.byGapType[gap.gapType]++;
    summary.bySeverity[gap.severity]++;
    summary.byWorkstream[gap.workstream]++;
    summary.bySignal[gap.signalType]++;
  }

  return summary;
}

// =============================================================================
// SCORE TYPES
// =============================================================================

/**
 * Quadrant classification based on impact and quality scores
 */
export type Quadrant = 'HH' | 'HL' | 'LH' | 'LL' | 'HU' | 'LU';

/**
 * Explanation for a score or assessment result
 */
export interface Explanation {
  title: string;
  reasoning: string;
  evidenceRefs: string[];
  severity?: 'HIGH' | 'MED' | 'LOW';
}

/**
 * Score for a specific subject (domain or asset)
 */
export interface SubjectScore {
  subjectType: SubjectType;
  subjectId: string;
  subjectName?: string;
  assetType?: string;
  qualifiedName?: string;
  impactScore: number;
  qualityScore: number | null;
  qualityUnknown: boolean;
  quadrant: Quadrant;
  readinessScore?: number;
  explanations: Explanation[];
  dimensionScores?: Record<string, number>;
}

/**
 * Computes quadrant from impact and quality scores
 */
export function computeQuadrant(
  impactScore: number,
  qualityScore: number | null,
  impactThreshold: number = 0.5,
  qualityThreshold: number = 0.7
): Quadrant {
  const highImpact = impactScore >= impactThreshold;

  if (qualityScore === null) {
    return highImpact ? 'HU' : 'LU';
  }

  const highQuality = qualityScore >= qualityThreshold;

  if (highImpact && highQuality) return 'HH';
  if (highImpact && !highQuality) return 'HL';
  if (!highImpact && highQuality) return 'LH';
  return 'LL';
}

/**
 * Gets human-readable description for a quadrant
 */
export function getQuadrantDescription(quadrant: Quadrant): string {
  const descriptions: Record<Quadrant, string> = {
    HH: 'High Impact, High Quality - Ready to use for AI workloads',
    HL: 'High Impact, Low Quality - Fix urgently, high business value',
    LH: 'Low Impact, High Quality - Maintain current standards',
    LL: 'Low Impact, Low Quality - Low priority for remediation',
    HU: 'High Impact, Unknown Quality - Investigate to determine readiness',
    LU: 'Low Impact, Unknown Quality - Defer investigation',
  };
  return descriptions[quadrant];
}

/**
 * Gets priority level for a quadrant
 */
export function getQuadrantPriority(quadrant: Quadrant): 'HIGH' | 'MED' | 'LOW' {
  const priorities: Record<Quadrant, 'HIGH' | 'MED' | 'LOW'> = {
    HL: 'HIGH',
    HU: 'HIGH',
    HH: 'MED',
    LH: 'MED',
    LU: 'LOW',
    LL: 'LOW',
  };
  return priorities[quadrant];
}

// =============================================================================
// PLAN TYPES
// =============================================================================

/**
 * Remediation plan phases
 */
export type PhaseName = 'MVP' | 'Expanded' | 'Hardening';

/**
 * Effort bucket for action sizing
 */
export type EffortBucket = 'S' | 'M' | 'L';

/**
 * A specific remediation action
 */
export interface Action {
  id: string;
  workstream: Workstream;
  description: string;
  scope: string[];
  assetCount: number;
  effortBucket: EffortBucket;
  expectedEffect: string[];
  gapsAddressed: number;
  priority?: number;
}

/**
 * Workstream-grouped actions
 */
export interface WorkstreamActions {
  workstream: Workstream;
  name: string;
  description: string;
  actions: Action[];
  totalAssetCount: number;
  totalGapsAddressed: number;
}

/**
 * A remediation phase
 */
export interface Phase {
  name: PhaseName;
  description: string;
  workstreams: WorkstreamActions[];
  totalActions: number;
  totalAssets: number;
  totalGaps: number;
}

/**
 * Complete remediation plan
 */
export interface RemediationPlan {
  capabilityId: string;
  scopeId: string;
  generatedAt: string;
  phases: Phase[];
  summary: {
    totalActions: number;
    totalAssets: number;
    totalGaps: number;
    phaseDistribution: Record<PhaseName, number>;
  };
}

/**
 * Computes effort bucket based on asset count
 */
export function computeEffortBucket(assetCount: number): EffortBucket {
  if (assetCount < 5) return 'S';
  if (assetCount <= 20) return 'M';
  return 'L';
}

/**
 * Gets human-readable name for a workstream
 */
export function getWorkstreamName(workstream: Workstream): string {
  const names: Record<Workstream, string> = {
    OWNERSHIP: 'Ownership',
    SEMANTICS: 'Semantics & Documentation',
    LINEAGE: 'Lineage & Relationships',
    SENSITIVITY_ACCESS: 'Sensitivity & Access Control',
    QUALITY_FRESHNESS: 'Quality & Freshness Monitoring',
  };
  return names[workstream];
}

/**
 * Gets human-readable description for a workstream
 */
export function getWorkstreamDescription(workstream: Workstream): string {
  const descriptions: Record<Workstream, string> = {
    OWNERSHIP: 'Assign owners and establish stewardship for assets',
    SEMANTICS: 'Add descriptions, glossary terms, and documentation',
    LINEAGE: 'Document upstream and downstream dependencies',
    SENSITIVITY_ACCESS: 'Tag sensitive data and define access policies',
    QUALITY_FRESHNESS: 'Set up quality monitoring and freshness SLAs',
  };
  return descriptions[workstream];
}

/**
 * Gets description for a phase
 */
export function getPhaseDescription(phase: PhaseName): string {
  const descriptions: Record<PhaseName, string> = {
    MVP: 'Minimum viable improvements - address highest severity gaps on highest impact assets',
    Expanded: 'Expand coverage - address medium severity gaps and broaden asset coverage',
    Hardening: 'Quality hardening - address remaining gaps and establish monitoring',
  };
  return descriptions[phase];
}

/**
 * Creates a unique action ID
 */
export function createActionId(
  workstream: Workstream,
  phase: PhaseName,
  index: number
): string {
  return `action-${phase.toLowerCase()}-${workstream.toLowerCase()}-${index}`;
}

// =============================================================================
// CAPABILITY REQUIREMENTS
// =============================================================================

/**
 * Capability requirements definition
 */
export interface CapabilityRequirements {
  capabilityId: string;
  name: string;
  description: string;
  requiredSignals: CanonicalSignal[];
  criticalSignals: CanonicalSignal[];
  optionalSignals: CanonicalSignal[];
}

/**
 * Default capability requirements
 * Updated to include all 10 canonical signals: OWNERSHIP, SEMANTICS, LINEAGE,
 * SENSITIVITY, ACCESS, QUALITY, FRESHNESS, USAGE, AI_READY, TRUST
 */
export const DEFAULT_CAPABILITY_REQUIREMENTS: CapabilityRequirements[] = [
  {
    capabilityId: 'meta_ai_readiness',
    name: 'Meta AI Readiness',
    description: 'Cross-cutting readiness for AI/ML workloads',
    requiredSignals: ['OWNERSHIP', 'SEMANTICS', 'LINEAGE', 'SENSITIVITY', 'AI_READY', 'USAGE', 'FRESHNESS'],
    criticalSignals: ['OWNERSHIP', 'SEMANTICS', 'AI_READY'],
    optionalSignals: ['ACCESS', 'QUALITY', 'TRUST'],
  },
  {
    capabilityId: 'rag',
    name: 'RAG (Retrieval-Augmented Generation)',
    description: 'Readiness for document retrieval and AI grounding',
    requiredSignals: ['SEMANTICS', 'OWNERSHIP', 'FRESHNESS', 'LINEAGE', 'TRUST'],
    criticalSignals: ['SEMANTICS', 'OWNERSHIP', 'TRUST'],
    optionalSignals: ['USAGE', 'SENSITIVITY', 'ACCESS', 'QUALITY', 'AI_READY'],
  },
  {
    capabilityId: 'text_to_sql',
    name: 'Text-to-SQL',
    description: 'Natural language query generation',
    requiredSignals: ['SEMANTICS', 'OWNERSHIP', 'LINEAGE', 'SENSITIVITY'],
    criticalSignals: ['SEMANTICS', 'OWNERSHIP'],
    optionalSignals: ['USAGE', 'FRESHNESS', 'ACCESS', 'QUALITY', 'AI_READY', 'TRUST'],
  },
  {
    capabilityId: 'ai_agents',
    name: 'AI Agents',
    description: 'Autonomous data access',
    requiredSignals: ['OWNERSHIP', 'SEMANTICS', 'ACCESS', 'SENSITIVITY', 'LINEAGE', 'AI_READY'],
    criticalSignals: ['OWNERSHIP', 'ACCESS', 'SENSITIVITY', 'AI_READY'],
    optionalSignals: ['USAGE', 'FRESHNESS', 'QUALITY', 'TRUST'],
  },
  {
    capabilityId: 'governance_fundamentals',
    name: 'Governance Fundamentals',
    description: 'Basic metadata hygiene',
    requiredSignals: ['OWNERSHIP', 'SEMANTICS', 'TRUST'],
    criticalSignals: ['OWNERSHIP', 'SEMANTICS'],
    optionalSignals: ['LINEAGE', 'SENSITIVITY', 'ACCESS', 'USAGE', 'FRESHNESS', 'QUALITY', 'AI_READY'],
  },
  {
    capabilityId: 'data_quality',
    name: 'Data Quality Management',
    description: 'DQ monitoring and observability readiness',
    requiredSignals: ['OWNERSHIP', 'QUALITY', 'FRESHNESS', 'LINEAGE'],
    criticalSignals: ['OWNERSHIP', 'QUALITY'],
    optionalSignals: ['SEMANTICS', 'SENSITIVITY', 'ACCESS', 'USAGE', 'AI_READY', 'TRUST'],
  },
];

/**
 * Gets capability requirements by ID
 */
export function getCapabilityRequirements(capabilityId: string): CapabilityRequirements | undefined {
  return DEFAULT_CAPABILITY_REQUIREMENTS.find((req) => req.capabilityId === capabilityId);
}

/**
 * Gets all capability IDs
 */
export function getAllCapabilityIds(): string[] {
  return DEFAULT_CAPABILITY_REQUIREMENTS.map((req) => req.capabilityId);
}

/**
 * Checks if a signal is critical for a capability
 */
export function isCriticalSignal(capabilityId: string, signal: CanonicalSignal): boolean {
  const requirements = getCapabilityRequirements(capabilityId);
  return requirements?.criticalSignals.includes(signal) ?? false;
}

/**
 * Checks if a signal is required for a capability
 */
export function isRequiredSignal(capabilityId: string, signal: CanonicalSignal): boolean {
  const requirements = getCapabilityRequirements(capabilityId);
  return requirements?.requiredSignals.includes(signal) ?? false;
}
