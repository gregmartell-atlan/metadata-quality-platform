/**
 * Methodology Factory
 *
 * Creates scoring methodologies for different assessment approaches.
 * Each methodology defines how to compute scores from signal/field data.
 *
 * Supported methodologies:
 * - WEIGHTED_MEASURES: Weighted average of field coverage percentages
 * - WEIGHTED_DIMENSIONS: Weighted average of signal scores
 * - CHECKLIST: Binary pass/fail against required fields
 * - QTRIPLET: Quotient-based triplet scoring (coverage x breadth x depth)
 * - MATURITY: Maturity model scoring with stage progression
 *
 * Ported from atlan-metadata-evaluation/assessment/packages/web
 */

import type {
  MethodologyType,
  SignalType,
  SignalScore,
  AssetScore,
  UseCaseProfile,
  UnifiedField,
} from '../catalog/types';
import { SIGNAL_DEFINITIONS, getSignalById } from '../catalog/signal-definitions';
import { getUseCaseById, USE_CASE_PROFILES } from '../catalog/use-case-profiles';
import { UNIFIED_FIELD_CATALOG, getFieldsForSignal } from '../catalog/unified-fields';

// =============================================================================
// SCORING INTERFACES
// =============================================================================

/**
 * Input data for scoring
 */
export interface ScoringInput {
  /** Field coverage rates (field ID -> coverage 0-1) */
  fieldCoverage: Record<string, number>;

  /** Signal scores (signal ID -> score 0-1) */
  signalScores: Record<SignalType, number>;

  /** Total assets evaluated */
  totalAssets: number;

  /** Asset type breakdown */
  assetTypeBreakdown?: Record<string, number>;
}

/**
 * Scoring result
 */
export interface ScoringResult {
  /** Overall score (0-100) */
  overallScore: number;

  /** Component scores */
  componentScores: Record<string, number>;

  /** Score breakdown for explanation */
  breakdown: ScoringBreakdown[];

  /** Methodology used */
  methodology: MethodologyType;

  /** Grade label */
  grade: 'A' | 'B' | 'C' | 'D' | 'F';

  /** Interpretation text */
  interpretation: string;
}

/**
 * Score breakdown component
 */
export interface ScoringBreakdown {
  component: string;
  displayName: string;
  score: number;
  weight: number;
  contribution: number;
  details?: string;
}

/**
 * Methodology scorer interface
 */
export interface MethodologyScorer {
  methodology: MethodologyType;
  displayName: string;
  description: string;
  score(input: ScoringInput, useCaseId?: string): ScoringResult;
}

// =============================================================================
// WEIGHTED MEASURES METHODOLOGY
// =============================================================================

/**
 * Weighted Measures scorer
 * Weights field coverage by completeness weights
 */
class WeightedMeasuresScorer implements MethodologyScorer {
  methodology: MethodologyType = 'WEIGHTED_MEASURES';
  displayName = 'Weighted Measures';
  description = 'Scores based on weighted field coverage rates';

  score(input: ScoringInput, useCaseId?: string): ScoringResult {
    const breakdown: ScoringBreakdown[] = [];
    let weightedSum = 0;
    let totalWeight = 0;

    // Get fields with completeness weights
    const fieldsWithWeights = UNIFIED_FIELD_CATALOG
      .filter(f => f.completenessWeight !== undefined && f.completenessWeight > 0);

    // If use case specified, filter to relevant fields
    const relevantFields = useCaseId
      ? fieldsWithWeights.filter(f => f.useCases.includes('*') || f.useCases.includes(useCaseId))
      : fieldsWithWeights;

    for (const field of relevantFields) {
      const coverage = input.fieldCoverage[field.id] ?? 0;
      const weight = field.completenessWeight ?? 1;

      weightedSum += coverage * weight;
      totalWeight += weight;

      breakdown.push({
        component: field.id,
        displayName: field.displayName,
        score: coverage * 100,
        weight,
        contribution: totalWeight > 0 ? (coverage * weight / totalWeight) * 100 : 0,
        details: `${Math.round(coverage * 100)}% coverage`,
      });
    }

    const overallScore = totalWeight > 0 ? (weightedSum / totalWeight) * 100 : 0;

    // Sort breakdown by contribution
    breakdown.sort((a, b) => b.contribution - a.contribution);

    return {
      overallScore,
      componentScores: Object.fromEntries(breakdown.map(b => [b.component, b.score])),
      breakdown: breakdown.slice(0, 10), // Top 10
      methodology: this.methodology,
      grade: getGrade(overallScore),
      interpretation: getInterpretation(overallScore, 'field coverage'),
    };
  }
}

// =============================================================================
// WEIGHTED DIMENSIONS METHODOLOGY
// =============================================================================

/**
 * Weighted Dimensions scorer
 * Weights signal scores by use case weights
 */
class WeightedDimensionsScorer implements MethodologyScorer {
  methodology: MethodologyType = 'WEIGHTED_DIMENSIONS';
  displayName = 'Weighted Dimensions';
  description = 'Scores based on weighted signal scores';

  score(input: ScoringInput, useCaseId?: string): ScoringResult {
    const breakdown: ScoringBreakdown[] = [];
    let weightedSum = 0;
    let totalWeight = 0;

    // Get use case profile for weights
    const profile = useCaseId ? getUseCaseById(useCaseId) : undefined;

    if (profile) {
      // Use case-specific weights
      for (const sw of profile.signals) {
        const score = input.signalScores[sw.signal] ?? 0;
        const signalDef = getSignalById(sw.signal);

        weightedSum += score * sw.weight;
        totalWeight += sw.weight;

        breakdown.push({
          component: sw.signal,
          displayName: signalDef?.displayName ?? sw.signal,
          score: score * 100,
          weight: sw.weight,
          contribution: totalWeight > 0 ? (score * sw.weight / totalWeight) * 100 : 0,
          details: sw.required ? 'Required' : undefined,
        });
      }
    } else {
      // Equal weights for all signals
      const signals = Object.keys(input.signalScores) as SignalType[];
      const weight = 1 / signals.length;

      for (const signal of signals) {
        const score = input.signalScores[signal] ?? 0;
        const signalDef = getSignalById(signal);

        weightedSum += score * weight;
        totalWeight += weight;

        breakdown.push({
          component: signal,
          displayName: signalDef?.displayName ?? signal,
          score: score * 100,
          weight,
          contribution: score * 100 / signals.length,
        });
      }
    }

    const overallScore = totalWeight > 0 ? (weightedSum / totalWeight) * 100 : 0;
    breakdown.sort((a, b) => b.contribution - a.contribution);

    return {
      overallScore,
      componentScores: Object.fromEntries(breakdown.map(b => [b.component, b.score])),
      breakdown,
      methodology: this.methodology,
      grade: getGrade(overallScore),
      interpretation: getInterpretation(overallScore, 'signal coverage'),
    };
  }
}

// =============================================================================
// CHECKLIST METHODOLOGY
// =============================================================================

/**
 * Checklist scorer
 * Binary pass/fail based on thresholds
 */
class ChecklistScorer implements MethodologyScorer {
  methodology: MethodologyType = 'CHECKLIST';
  displayName = 'Checklist';
  description = 'Pass/fail scoring against required thresholds';

  score(input: ScoringInput, useCaseId?: string): ScoringResult {
    const breakdown: ScoringBreakdown[] = [];
    let passed = 0;
    let total = 0;

    const profile = useCaseId ? getUseCaseById(useCaseId) : undefined;
    const threshold = 0.5; // 50% threshold for passing

    if (profile) {
      // Check required signals first
      const requiredSignals = profile.signals.filter(s => s.required);
      const optionalSignals = profile.signals.filter(s => !s.required);

      for (const sw of requiredSignals) {
        const score = input.signalScores[sw.signal] ?? 0;
        const passes = score >= threshold;
        const signalDef = getSignalById(sw.signal);

        total++;
        if (passes) passed++;

        breakdown.push({
          component: sw.signal,
          displayName: signalDef?.displayName ?? sw.signal,
          score: passes ? 100 : 0,
          weight: 1,
          contribution: passes ? 100 / total : 0,
          details: `Required: ${passes ? 'PASS' : 'FAIL'}`,
        });
      }

      for (const sw of optionalSignals) {
        const score = input.signalScores[sw.signal] ?? 0;
        const passes = score >= threshold;
        const signalDef = getSignalById(sw.signal);

        total++;
        if (passes) passed++;

        breakdown.push({
          component: sw.signal,
          displayName: signalDef?.displayName ?? sw.signal,
          score: passes ? 100 : 0,
          weight: 0.5,
          contribution: passes ? 50 / total : 0,
          details: `Optional: ${passes ? 'PASS' : 'FAIL'}`,
        });
      }
    } else {
      // Check all signals
      for (const signal of Object.keys(input.signalScores) as SignalType[]) {
        const score = input.signalScores[signal];
        const passes = score >= threshold;
        const signalDef = getSignalById(signal);

        total++;
        if (passes) passed++;

        breakdown.push({
          component: signal,
          displayName: signalDef?.displayName ?? signal,
          score: passes ? 100 : 0,
          weight: 1,
          contribution: passes ? 100 / total : 0,
          details: passes ? 'PASS' : 'FAIL',
        });
      }
    }

    const overallScore = total > 0 ? (passed / total) * 100 : 0;

    return {
      overallScore,
      componentScores: Object.fromEntries(breakdown.map(b => [b.component, b.score])),
      breakdown,
      methodology: this.methodology,
      grade: getGrade(overallScore),
      interpretation: `${passed} of ${total} checks passed`,
    };
  }
}

// =============================================================================
// QTRIPLET METHODOLOGY
// =============================================================================

/**
 * QTriplet scorer
 * Quotient-based triplet: Coverage x Breadth x Depth
 */
class QTripletScorer implements MethodologyScorer {
  methodology: MethodologyType = 'QTRIPLET';
  displayName = 'Q-Triplet';
  description = 'Quotient-based scoring: Coverage x Breadth x Depth';

  score(input: ScoringInput, useCaseId?: string): ScoringResult {
    // Coverage: Average field coverage
    const fieldCoverages = Object.values(input.fieldCoverage);
    const coverageScore = fieldCoverages.length > 0
      ? fieldCoverages.reduce((a, b) => a + b, 0) / fieldCoverages.length
      : 0;

    // Breadth: % of fields with any coverage (> 0)
    const fieldsWithCoverage = fieldCoverages.filter(c => c > 0).length;
    const breadthScore = fieldCoverages.length > 0
      ? fieldsWithCoverage / fieldCoverages.length
      : 0;

    // Depth: % of fields with high coverage (> 80%)
    const fieldsWithHighCoverage = fieldCoverages.filter(c => c >= 0.8).length;
    const depthScore = fieldCoverages.length > 0
      ? fieldsWithHighCoverage / fieldCoverages.length
      : 0;

    // Q-Triplet formula: geometric mean
    const overallScore = Math.pow(coverageScore * breadthScore * depthScore, 1/3) * 100;

    const breakdown: ScoringBreakdown[] = [
      {
        component: 'coverage',
        displayName: 'Coverage',
        score: coverageScore * 100,
        weight: 1/3,
        contribution: coverageScore * 100 / 3,
        details: 'Average field coverage',
      },
      {
        component: 'breadth',
        displayName: 'Breadth',
        score: breadthScore * 100,
        weight: 1/3,
        contribution: breadthScore * 100 / 3,
        details: `${fieldsWithCoverage}/${fieldCoverages.length} fields populated`,
      },
      {
        component: 'depth',
        displayName: 'Depth',
        score: depthScore * 100,
        weight: 1/3,
        contribution: depthScore * 100 / 3,
        details: `${fieldsWithHighCoverage}/${fieldCoverages.length} fields > 80% coverage`,
      },
    ];

    return {
      overallScore,
      componentScores: {
        coverage: coverageScore * 100,
        breadth: breadthScore * 100,
        depth: depthScore * 100,
      },
      breakdown,
      methodology: this.methodology,
      grade: getGrade(overallScore),
      interpretation: getQTripletInterpretation(coverageScore, breadthScore, depthScore),
    };
  }
}

/**
 * Get Q-Triplet interpretation
 */
function getQTripletInterpretation(coverage: number, breadth: number, depth: number): string {
  const weakest = Math.min(coverage, breadth, depth);
  const strongest = Math.max(coverage, breadth, depth);

  if (weakest === coverage) {
    return 'Focus on increasing field coverage rates';
  } else if (weakest === breadth) {
    return 'Focus on populating more field types';
  } else {
    return 'Focus on achieving high coverage (>80%) on more fields';
  }
}

// =============================================================================
// MATURITY METHODOLOGY
// =============================================================================

/**
 * Maturity scorer
 * Stage-based maturity model
 */
class MaturityScorer implements MethodologyScorer {
  methodology: MethodologyType = 'MATURITY';
  displayName = 'Maturity Model';
  description = 'Stage-based maturity assessment';

  score(input: ScoringInput, useCaseId?: string): ScoringResult {
    // Maturity stages based on signal coverage
    const stages = [
      { name: 'Foundation', signals: ['OWNERSHIP', 'SEMANTICS'] as SignalType[], threshold: 0.5 },
      { name: 'Documented', signals: ['LINEAGE', 'SENSITIVITY'] as SignalType[], threshold: 0.5 },
      { name: 'Governed', signals: ['ACCESS', 'TRUST'] as SignalType[], threshold: 0.5 },
      { name: 'Optimized', signals: ['QUALITY', 'FRESHNESS', 'USAGE'] as SignalType[], threshold: 0.5 },
      { name: 'AI-Ready', signals: ['AI_READY'] as SignalType[], threshold: 0.7 },
    ];

    const breakdown: ScoringBreakdown[] = [];
    let currentStage = 0;
    let stageProgress = 0;

    for (let i = 0; i < stages.length; i++) {
      const stage = stages[i];
      const stageScores = stage.signals.map(s => input.signalScores[s] ?? 0);
      const avgScore = stageScores.reduce((a, b) => a + b, 0) / stageScores.length;
      const passed = avgScore >= stage.threshold;

      breakdown.push({
        component: `stage_${i}`,
        displayName: stage.name,
        score: avgScore * 100,
        weight: 1,
        contribution: passed ? 20 : avgScore * 20,
        details: passed ? 'Achieved' : `${Math.round(avgScore * 100)}% progress`,
      });

      if (passed) {
        currentStage = i + 1;
        stageProgress = 1.0;
      } else if (currentStage === i) {
        stageProgress = avgScore / stage.threshold;
      }
    }

    // Overall score: stage level + progress to next stage
    const overallScore = (currentStage + stageProgress * 0.2) / stages.length * 100;

    return {
      overallScore,
      componentScores: Object.fromEntries(breakdown.map(b => [b.component, b.score])),
      breakdown,
      methodology: this.methodology,
      grade: getMaturityGrade(currentStage),
      interpretation: getMaturityInterpretation(currentStage, stages[currentStage]?.name || 'AI-Ready'),
    };
  }
}

/**
 * Get maturity grade
 */
function getMaturityGrade(stage: number): 'A' | 'B' | 'C' | 'D' | 'F' {
  if (stage >= 5) return 'A';
  if (stage >= 4) return 'B';
  if (stage >= 3) return 'C';
  if (stage >= 2) return 'D';
  return 'F';
}

/**
 * Get maturity interpretation
 */
function getMaturityInterpretation(stage: number, stageName: string): string {
  if (stage >= 5) return 'Achieved AI-Ready maturity level';
  if (stage >= 4) return `Working towards AI-Ready level (currently at ${stageName})`;
  return `At ${stageName} stage - focus on advancing to next level`;
}

// =============================================================================
// FACTORY
// =============================================================================

const scorers: Record<MethodologyType, MethodologyScorer> = {
  WEIGHTED_MEASURES: new WeightedMeasuresScorer(),
  WEIGHTED_DIMENSIONS: new WeightedDimensionsScorer(),
  CHECKLIST: new ChecklistScorer(),
  QTRIPLET: new QTripletScorer(),
  MATURITY: new MaturityScorer(),
};

/**
 * Get a scorer by methodology type
 */
export function getScorer(methodology: MethodologyType): MethodologyScorer {
  return scorers[methodology];
}

/**
 * Get all available methodologies
 */
export function getAvailableMethodologies(): Array<{
  methodology: MethodologyType;
  displayName: string;
  description: string;
}> {
  return Object.values(scorers).map(s => ({
    methodology: s.methodology,
    displayName: s.displayName,
    description: s.description,
  }));
}

/**
 * Get default methodology for a use case
 */
export function getDefaultMethodology(useCaseId: string): MethodologyType {
  const profile = getUseCaseById(useCaseId);
  return profile?.defaultMethodology ?? 'WEIGHTED_MEASURES';
}

/**
 * Score using specified methodology
 */
export function scoreWithMethodology(
  methodology: MethodologyType,
  input: ScoringInput,
  useCaseId?: string
): ScoringResult {
  const scorer = getScorer(methodology);
  return scorer.score(input, useCaseId);
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Get grade from score
 */
function getGrade(score: number): 'A' | 'B' | 'C' | 'D' | 'F' {
  if (score >= 90) return 'A';
  if (score >= 80) return 'B';
  if (score >= 70) return 'C';
  if (score >= 60) return 'D';
  return 'F';
}

/**
 * Get interpretation text
 */
function getInterpretation(score: number, metric: string): string {
  if (score >= 90) return `Excellent ${metric} - well above industry standards`;
  if (score >= 80) return `Good ${metric} - meets most best practices`;
  if (score >= 70) return `Adequate ${metric} - room for improvement`;
  if (score >= 60) return `Below average ${metric} - significant gaps exist`;
  return `Poor ${metric} - immediate attention required`;
}

/**
 * Compare scores between methodologies
 */
export function compareMethodologies(
  input: ScoringInput,
  useCaseId?: string
): Record<MethodologyType, ScoringResult> {
  const results: Record<MethodologyType, ScoringResult> = {} as Record<MethodologyType, ScoringResult>;

  for (const [methodology, scorer] of Object.entries(scorers)) {
    results[methodology as MethodologyType] = scorer.score(input, useCaseId);
  }

  return results;
}

/**
 * Get recommended methodology based on data characteristics
 */
export function recommendMethodology(input: ScoringInput): MethodologyType {
  const fieldCoverages = Object.values(input.fieldCoverage);
  const avgCoverage = fieldCoverages.reduce((a, b) => a + b, 0) / fieldCoverages.length;

  // If coverage is very low, use maturity to show progression
  if (avgCoverage < 0.3) {
    return 'MATURITY';
  }

  // If coverage is uneven, use Q-Triplet to highlight gaps
  const minCoverage = Math.min(...fieldCoverages);
  const maxCoverage = Math.max(...fieldCoverages);
  if (maxCoverage - minCoverage > 0.5) {
    return 'QTRIPLET';
  }

  // Default to weighted measures for balanced scoring
  return 'WEIGHTED_MEASURES';
}
