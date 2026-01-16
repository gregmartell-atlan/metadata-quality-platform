/**
 * Use Case Profiles
 *
 * Defines assessment criteria for specific AI/data use cases.
 * Each profile specifies:
 * - Which signals matter and their weights
 * - Applicable asset types
 * - Scoring thresholds for readiness classification
 * - Default scoring methodology
 *
 * Ported from atlan-metadata-evaluation/assessment/packages/domain
 */

import type { UseCaseProfile, MethodologyType, SignalType } from './types';

// =============================================================================
// USE CASE PROFILES
// =============================================================================

export const USE_CASE_PROFILES: UseCaseProfile[] = [
  // ---------------------------------------------------------------------------
  // AI / ML USE CASES
  // ---------------------------------------------------------------------------
  {
    id: 'rag',
    displayName: 'RAG / Retrieval',
    description: 'Retrieval-Augmented Generation readiness. Assets must be well-documented and approved for AI use.',
    signals: [
      { signal: 'SEMANTICS', weight: 0.35, required: true },
      { signal: 'AI_READY', weight: 0.30, required: true },
      { signal: 'LINEAGE', weight: 0.15 },
      { signal: 'OWNERSHIP', weight: 0.10 },
      { signal: 'QUALITY', weight: 0.10 },
    ],
    relevantAssetTypes: ['Table', 'View', 'Column', 'MaterialisedView'],
    thresholds: { ready: 0.80, partial: 0.50 },
    defaultMethodology: 'QTRIPLET',
    guidanceUrl: 'https://developer.atlan.com/ai-readiness/rag/',
  },
  {
    id: 'ai_agents',
    displayName: 'AI Agents',
    description: 'AI Agent integration readiness. Assets need clear ownership, documentation, and AI approval.',
    signals: [
      { signal: 'SEMANTICS', weight: 0.30, required: true },
      { signal: 'OWNERSHIP', weight: 0.25, required: true },
      { signal: 'AI_READY', weight: 0.25, required: true },
      { signal: 'SENSITIVITY', weight: 0.10 },
      { signal: 'ACCESS', weight: 0.10 },
    ],
    relevantAssetTypes: ['Table', 'View', 'MaterialisedView'],
    thresholds: { ready: 0.75, partial: 0.40 },
    defaultMethodology: 'WEIGHTED_MEASURES',
    guidanceUrl: 'https://developer.atlan.com/ai-readiness/agents/',
  },
  {
    id: 'text_to_sql',
    displayName: 'Text-to-SQL',
    description: 'Natural language query readiness. Assets need rich semantics and joinability information.',
    signals: [
      { signal: 'SEMANTICS', weight: 0.40, required: true },
      { signal: 'LINEAGE', weight: 0.25 },  // Joinability (PK/FK)
      { signal: 'OWNERSHIP', weight: 0.15 },
      { signal: 'QUALITY', weight: 0.20 },
    ],
    relevantAssetTypes: ['Table', 'View', 'Column'],
    thresholds: { ready: 0.80, partial: 0.50 },
    defaultMethodology: 'WEIGHTED_MEASURES',
    guidanceUrl: 'https://developer.atlan.com/ai-readiness/text-to-sql/',
  },

  // ---------------------------------------------------------------------------
  // COMPLIANCE USE CASES
  // ---------------------------------------------------------------------------
  {
    id: 'dsar_retention',
    displayName: 'DSAR & Retention',
    description: 'Privacy compliance readiness. Assets must have sensitivity classification and access controls.',
    signals: [
      { signal: 'SENSITIVITY', weight: 0.35, required: true },
      { signal: 'ACCESS', weight: 0.25, required: true },
      { signal: 'OWNERSHIP', weight: 0.20, required: true },
      { signal: 'LINEAGE', weight: 0.20 },
    ],
    relevantAssetTypes: ['Table', 'View', 'Column'],
    thresholds: { ready: 0.85, partial: 0.60 },
    defaultMethodology: 'CHECKLIST',
    guidanceUrl: 'https://developer.atlan.com/compliance/dsar/',
  },
  {
    id: 'privacy_compliance',
    displayName: 'Privacy Compliance',
    description: 'General privacy readiness (GDPR, CCPA). Focus on PII identification and protection.',
    signals: [
      { signal: 'SENSITIVITY', weight: 0.40, required: true },
      { signal: 'ACCESS', weight: 0.25, required: true },
      { signal: 'LINEAGE', weight: 0.20 },
      { signal: 'OWNERSHIP', weight: 0.15 },
    ],
    relevantAssetTypes: ['Table', 'View', 'Column'],
    thresholds: { ready: 0.85, partial: 0.60 },
    defaultMethodology: 'CHECKLIST',
  },

  // ---------------------------------------------------------------------------
  // GOVERNANCE USE CASES
  // ---------------------------------------------------------------------------
  {
    id: 'data_governance',
    displayName: 'Data Governance',
    description: 'General governance readiness. Balanced across all signals.',
    signals: [
      { signal: 'OWNERSHIP', weight: 0.20, required: true },
      { signal: 'SEMANTICS', weight: 0.20, required: true },
      { signal: 'TRUST', weight: 0.15 },
      { signal: 'SENSITIVITY', weight: 0.15 },
      { signal: 'ACCESS', weight: 0.15 },
      { signal: 'QUALITY', weight: 0.15 },
    ],
    relevantAssetTypes: ['*'],
    thresholds: { ready: 0.75, partial: 0.50 },
    defaultMethodology: 'QTRIPLET',
    guidanceUrl: 'https://solutions.atlan.com/governance/',
  },
  {
    id: 'self_service_discovery',
    displayName: 'Self-Service Discovery',
    description: 'Data discovery readiness. Assets must be findable and understandable.',
    signals: [
      { signal: 'SEMANTICS', weight: 0.40, required: true },
      { signal: 'OWNERSHIP', weight: 0.25, required: true },
      { signal: 'TRUST', weight: 0.20 },
      { signal: 'USAGE', weight: 0.15 },
    ],
    relevantAssetTypes: ['*'],
    thresholds: { ready: 0.70, partial: 0.40 },
    defaultMethodology: 'WEIGHTED_MEASURES',
    guidanceUrl: 'https://solutions.atlan.com/discovery/',
  },
  {
    id: 'data_products',
    displayName: 'Data Products',
    description: 'Data product readiness. Assets need domain ownership and quality guarantees.',
    signals: [
      { signal: 'OWNERSHIP', weight: 0.25, required: true },
      { signal: 'SEMANTICS', weight: 0.25, required: true },
      { signal: 'QUALITY', weight: 0.20 },
      { signal: 'FRESHNESS', weight: 0.15 },
      { signal: 'TRUST', weight: 0.15 },
    ],
    relevantAssetTypes: ['DataProduct', 'Table', 'View'],
    thresholds: { ready: 0.80, partial: 0.50 },
    defaultMethodology: 'MATURITY',
    guidanceUrl: 'https://solutions.atlan.com/data-products/',
  },

  // ---------------------------------------------------------------------------
  // OPERATIONAL USE CASES
  // ---------------------------------------------------------------------------
  {
    id: 'impact_analysis',
    displayName: 'Impact Analysis',
    description: 'Impact analysis readiness. Assets need lineage for downstream impact assessment.',
    signals: [
      { signal: 'LINEAGE', weight: 0.50, required: true },
      { signal: 'OWNERSHIP', weight: 0.25, required: true },
      { signal: 'SEMANTICS', weight: 0.25 },
    ],
    relevantAssetTypes: ['Table', 'View', 'Column', 'MaterialisedView'],
    thresholds: { ready: 0.75, partial: 0.50 },
    defaultMethodology: 'CHECKLIST',
    guidanceUrl: 'https://developer.atlan.com/lineage/',
  },
  {
    id: 'rca',
    displayName: 'Root Cause Analysis',
    description: 'RCA readiness. Assets need lineage and quality signals for troubleshooting.',
    signals: [
      { signal: 'LINEAGE', weight: 0.40, required: true },
      { signal: 'QUALITY', weight: 0.25 },
      { signal: 'OWNERSHIP', weight: 0.20, required: true },
      { signal: 'FRESHNESS', weight: 0.15 },
    ],
    relevantAssetTypes: ['Table', 'View', 'MaterialisedView'],
    thresholds: { ready: 0.70, partial: 0.45 },
    defaultMethodology: 'WEIGHTED_MEASURES',
  },
  {
    id: 'cost_optimization',
    displayName: 'Cost Optimization',
    description: 'Cost optimization readiness. Assets need usage telemetry for optimization decisions.',
    signals: [
      { signal: 'USAGE', weight: 0.40, required: true },
      { signal: 'OWNERSHIP', weight: 0.30 },
      { signal: 'LINEAGE', weight: 0.30 },
    ],
    relevantAssetTypes: ['Table', 'View', 'MaterialisedView'],
    thresholds: { ready: 0.60, partial: 0.30 },
    defaultMethodology: 'WEIGHTED_MEASURES',
  },

  // ---------------------------------------------------------------------------
  // GLOSSARY USE CASES
  // ---------------------------------------------------------------------------
  {
    id: 'business_glossary',
    displayName: 'Business Glossary',
    description: 'Glossary enrichment readiness. Terms need definitions and asset links.',
    signals: [
      { signal: 'SEMANTICS', weight: 0.50, required: true },
      { signal: 'OWNERSHIP', weight: 0.30 },
      { signal: 'TRUST', weight: 0.20 },
    ],
    relevantAssetTypes: ['AtlasGlossaryTerm', 'AtlasGlossaryCategory'],
    thresholds: { ready: 0.80, partial: 0.50 },
    defaultMethodology: 'WEIGHTED_MEASURES',
    guidanceUrl: 'https://solutions.atlan.com/glossary/',
  },
];

// =============================================================================
// USE CASE LOOKUP UTILITIES
// =============================================================================

/**
 * Get use case profile by ID
 */
export function getUseCaseById(id: string): UseCaseProfile | undefined {
  return USE_CASE_PROFILES.find(uc => uc.id === id);
}

/**
 * Get use cases relevant for an asset type
 */
export function getUseCasesForAssetType(assetType: string): UseCaseProfile[] {
  return USE_CASE_PROFILES.filter(uc =>
    uc.relevantAssetTypes.includes('*') || uc.relevantAssetTypes.includes(assetType)
  );
}

/**
 * Get use cases that require a specific signal
 */
export function getUseCasesRequiringSignal(signal: SignalType): UseCaseProfile[] {
  return USE_CASE_PROFILES.filter(uc =>
    uc.signals.some(s => s.signal === signal && s.required)
  );
}

/**
 * Get use cases by default methodology
 */
export function getUseCasesByMethodology(methodology: MethodologyType): UseCaseProfile[] {
  return USE_CASE_PROFILES.filter(uc => uc.defaultMethodology === methodology);
}

/**
 * Get all use case IDs
 */
export function getAllUseCaseIds(): string[] {
  return USE_CASE_PROFILES.map(uc => uc.id);
}

/**
 * Create use case ID -> profile map
 */
export function createUseCaseMap(): Map<string, UseCaseProfile> {
  return new Map(USE_CASE_PROFILES.map(uc => [uc.id, uc]));
}

// =============================================================================
// USE CASE CATEGORIES
// =============================================================================

export interface UseCaseCategory {
  id: string;
  displayName: string;
  description: string;
  useCases: string[];
}

export const USE_CASE_CATEGORIES: UseCaseCategory[] = [
  {
    id: 'ai_ml',
    displayName: 'AI / ML',
    description: 'AI and machine learning use cases requiring AI governance.',
    useCases: ['rag', 'ai_agents', 'text_to_sql'],
  },
  {
    id: 'compliance',
    displayName: 'Compliance',
    description: 'Regulatory and privacy compliance use cases.',
    useCases: ['dsar_retention', 'privacy_compliance'],
  },
  {
    id: 'governance',
    displayName: 'Governance',
    description: 'Data governance and discovery use cases.',
    useCases: ['data_governance', 'self_service_discovery', 'data_products', 'business_glossary'],
  },
  {
    id: 'operational',
    displayName: 'Operational',
    description: 'Operational and analytical use cases.',
    useCases: ['impact_analysis', 'rca', 'cost_optimization'],
  },
];

/**
 * Get use cases by category
 */
export function getUseCasesByCategory(categoryId: string): UseCaseProfile[] {
  const category = USE_CASE_CATEGORIES.find(c => c.id === categoryId);
  if (!category) return [];
  return category.useCases
    .map(id => getUseCaseById(id))
    .filter((uc): uc is UseCaseProfile => uc !== undefined);
}
