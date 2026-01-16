/**
 * Assessment Engines Module
 *
 * Exports all assessment engines for metadata quality evaluation:
 * - ScoreEngine: Computes Impact/Quality scoring
 * - GapEngine: Detects gaps by comparing required signals against actual
 * - PlanEngine: Generates 3-phase remediation plans
 * - ExplanationGenerator: Generates human-readable explanations
 *
 * Also exports signal mapping utilities and all supporting types.
 *
 * Ported from atlan-metadata-evaluation/assessment/packages/domain/src/engines/
 */

// =============================================================================
// ENGINES
// =============================================================================

export { ScoreEngine } from './score-engine';
export { GapEngine } from './gap-engine';
export { PlanEngine } from './plan-engine';
export { ExplanationGenerator } from './explanation-generator';

// =============================================================================
// SIGNAL MAPPER
// =============================================================================

export {
  mapEvidenceToSignals,
  mapEvidenceBundleToSignals,
  isSignalPresent,
  isSignalAbsent,
  isSignalUnknown,
} from './signal-mapper';

// =============================================================================
// TYPES
// =============================================================================

// Signal types
export type {
  CanonicalSignal,
  SignalValue,
  CanonicalSignals,
  Workstream,
} from './types';

export {
  SIGNAL_TO_WORKSTREAM,
  SIGNAL_SEVERITY_MAP,
} from './types';

// Evidence types
export type {
  Tri,
  AssetEvidence,
  AssessmentResult,
} from './types';

// Gap types
export type {
  GapType,
  GapSeverity,
  SubjectType,
  Gap,
  GapSummary,
} from './types';

export {
  createGapId,
  computeGapSummary,
} from './types';

// Score types
export type {
  Quadrant,
  Explanation,
  SubjectScore,
} from './types';

export {
  computeQuadrant,
  getQuadrantDescription,
  getQuadrantPriority,
} from './types';

// Plan types
export type {
  PhaseName,
  EffortBucket,
  Action,
  WorkstreamActions,
  Phase,
  RemediationPlan,
} from './types';

export {
  computeEffortBucket,
  getWorkstreamName,
  getWorkstreamDescription,
  getPhaseDescription,
  createActionId,
} from './types';

// Capability requirements
export type {
  CapabilityRequirements,
} from './types';

export {
  DEFAULT_CAPABILITY_REQUIREMENTS,
  getCapabilityRequirements,
  getAllCapabilityIds,
  isCriticalSignal,
  isRequiredSignal,
} from './types';
