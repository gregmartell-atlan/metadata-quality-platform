/**
 * Assessment Module
 *
 * Provides metadata quality assessment capabilities including:
 * - Signal-based scoring (10 canonical signals)
 * - Unified field catalog (50+ metadata fields)
 * - Gap detection and remediation planning
 * - Use case readiness assessment
 * - Scoring methodologies (weighted, checklist, maturity, Q-triplet)
 * - Rollup engine for hierarchical aggregation
 * - UI adapters for backward compatibility
 *
 * Ported from atlan-metadata-evaluation/assessment/packages/domain
 */

// Re-export everything from the catalog module
export * from './catalog';

// Re-export everything from the engines module
export * from './engines';

// Re-export everything from the modeling module
export * from './modeling';

// Re-export utilities
export * from './utils';
