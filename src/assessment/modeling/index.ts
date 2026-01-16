/**
 * Metadata Modeling Module
 *
 * Provides tools for metadata quality assessment including:
 * - Scope resolution and hierarchy management
 * - Rollup engine for aggregating results
 * - Use case assessment and gap analysis
 * - Scoring methodologies (weighted, checklist, maturity, Q-triplet)
 * - UI adapters for backward compatibility
 *
 * Ported from atlan-metadata-evaluation/assessment/packages/domain
 */

// Scope resolution and hierarchy utilities
export {
  parseQualifiedName,
  buildScopePrefix,
  buildScopeFilter,
  getParentLevel,
  getChildLevel,
  getAncestorLevels,
  getDescendantLevels,
  getDefaultAssetTypes,
  groupAssetsByDimension,
  getDimensionValue,
  buildHierarchyPath,
  enrichAssetHierarchy,
  validateScope,
  createConnectionScope,
  createSchemaScope,
  createDomainScope,
  createTenantScope,
} from './scope-resolver';

// Rollup engine for aggregation
export {
  aggregateSignals,
  aggregateUseCases,
  createRollupNode,
  generateDimensionRollup,
  generateAllRollups,
  generateHierarchicalRollup,
  calculateSignalCoverage,
  calculateUseCaseReadiness,
  identifyTopGaps,
  determineAdoptionPhase,
  compareRollupNodes,
  findLowestScoringNodes,
  findHighestGapNodes,
} from './rollup-engine';

// Use case assessor
export {
  evaluateField,
  evaluateAllFields,
  composeSignal,
  composeAllSignals,
  assessUseCase,
  assessAllUseCases,
  runAssessment,
} from './use-case-assessor';

// Methodology factory
export type {
  ScoringInput,
  ScoringResult,
  ScoringBreakdown,
  MethodologyScorer,
} from './methodology-factory';

export {
  getScorer,
  getAvailableMethodologies,
  getDefaultMethodology,
  scoreWithMethodology,
  compareMethodologies,
  recommendMethodology,
} from './methodology-factory';

// Unified assessment adapter
export type {
  MetadataFieldType,
  Priority,
  FieldCoverage,
  PersonaType,
  UnifiedSignalCoverage,
  UseCaseReadiness,
  FieldEvidence,
  AdoptionPhase,
} from './unified-assessment-adapter';

export {
  LEGACY_FIELD_TO_SIGNALS,
  convertToSignalCoverage,
  calculateUseCaseReadiness as calculateUseCaseReadinessFromSignals,
  convertSignalsToPriorities,
  describeFieldSource,
  buildFieldEvidence,
  mapAdoptionPhase,
  filterSignalsByPersona,
  convertSignalResultToUI,
  convertUseCaseResultToUI,
  formatAssessmentSummary,
} from './unified-assessment-adapter';
