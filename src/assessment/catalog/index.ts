/**
 * Assessment Catalog Module
 *
 * Exports the unified field catalog, signal definitions, use case profiles,
 * and assessment types. This is the foundation for metadata quality assessment.
 */

// Types
export * from './types';

// Signal definitions and utilities
export {
  SIGNAL_DEFINITIONS,
  getSignalById,
  getSignalsByWorkstream,
  getSignalsBySeverity,
  getAllSignalIds,
  createSignalMap,
  WORKSTREAM_DEFINITIONS,
  getWorkstreamForSignal,
  SEVERITY_TO_PRIORITY,
  getSignalPriority,
} from './signal-definitions';

// Unified field catalog and utilities
export {
  UNIFIED_FIELD_CATALOG,
  getFieldById,
  getFieldsByCategory,
  getFieldsForSignal,
  getFieldsForUseCase,
  getCoreFieldsForUseCase,
  getFieldsForAssetType,
  getCompletenessFields,
  getMeasureFields,
  getActiveFields,
  createFieldMap,
} from './unified-fields';

// Use case profiles and utilities
export type { UseCaseCategory } from './use-case-profiles';

export {
  USE_CASE_PROFILES,
  getUseCaseById,
  getUseCasesForAssetType,
  getUseCasesRequiringSignal,
  getUseCasesByMethodology,
  getAllUseCaseIds,
  createUseCaseMap,
  USE_CASE_CATEGORIES,
  getUseCasesByCategory,
} from './use-case-profiles';
