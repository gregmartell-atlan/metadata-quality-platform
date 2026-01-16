/**
 * Score Engine
 *
 * Computes Impact/Quality scoring for assets.
 * Wraps the existing assessment engine and adds Impact/Quality dimensions.
 *
 * Ported from atlan-metadata-evaluation/assessment/packages/domain/src/engines/score-engine.ts
 */

import {
  AssetEvidence,
  AssessmentResult,
  SubjectScore,
  Quadrant,
  computeQuadrant,
  Explanation,
  CanonicalSignals,
  CapabilityRequirements,
} from './types';
import { isSignalPresent, isSignalUnknown } from './signal-mapper';

/**
 * Score enrichment engine
 * Wraps the existing assessment engine and adds Impact/Quality scoring
 */
export class ScoreEngine {
  /**
   * Impact score thresholds
   */
  private static readonly IMPACT_THRESHOLD = 0.5;

  /**
   * Quality score thresholds
   */
  private static readonly QUALITY_THRESHOLD = 0.7;

  /**
   * Default impact score when usage telemetry unavailable
   */
  private static readonly DEFAULT_IMPACT = 0.25;

  /**
   * Computes enriched subject scores for all assets
   */
  computeSubjectScores(
    assets: AssetEvidence[],
    signalsMap: Map<string, CanonicalSignals>,
    requirements: CapabilityRequirements,
    assessmentResult: AssessmentResult
  ): SubjectScore[] {
    return assets.map((asset) => {
      const signals = signalsMap.get(asset.assetId);
      if (!signals) {
        throw new Error(`No signals found for asset ${asset.assetId}`);
      }

      return this.computeAssetScore(asset, signals, requirements, assessmentResult);
    });
  }

  /**
   * Computes enriched score for a single asset
   */
  private computeAssetScore(
    asset: AssetEvidence,
    signals: CanonicalSignals,
    requirements: CapabilityRequirements,
    assessmentResult: AssessmentResult
  ): SubjectScore {
    // Compute impact score from usage signals
    const impactScore = this.computeImpactScore(asset, signals);

    // Compute quality score from signal coverage
    const { qualityScore, qualityUnknown } = this.computeQualityScore(
      signals,
      requirements
    );

    // Compute quadrant
    const quadrant = computeQuadrant(
      impactScore,
      qualityScore,
      ScoreEngine.IMPACT_THRESHOLD,
      ScoreEngine.QUALITY_THRESHOLD
    );

    // Generate explanations
    const explanations = this.generateExplanations(
      asset,
      signals,
      requirements,
      impactScore,
      qualityScore,
      qualityUnknown
    );

    return {
      subjectType: 'ASSET',
      subjectId: asset.assetId,
      subjectName: asset.name,
      assetType: asset.type,
      qualifiedName: asset.assetId,
      impactScore,
      qualityScore,
      qualityUnknown,
      quadrant,
      readinessScore: typeof assessmentResult.readiness === 'number'
        ? assessmentResult.readiness
        : undefined,
      dimensionScores: this.extractDimensionScores(assessmentResult),
      explanations,
    };
  }

  /**
   * Computes impact score from usage signals
   * High usage -> high impact
   * No usage data -> default low impact (0.25)
   */
  private computeImpactScore(
    _asset: AssetEvidence,
    signals: CanonicalSignals
  ): number {
    // Check if usage telemetry is present
    if (isSignalPresent(signals.USAGE)) {
      // MVP: Usage is boolean presence, so return high impact if present
      // Future: Use actual usage metrics (query count, user count, etc.)
      return 0.8;
    }

    // Default to low impact when usage unavailable
    return ScoreEngine.DEFAULT_IMPACT;
  }

  /**
   * Computes quality score as ratio of present signals to required signals
   * Returns null if too many signals are UNKNOWN (>= 50%)
   */
  private computeQualityScore(
    signals: CanonicalSignals,
    requirements: CapabilityRequirements
  ): { qualityScore: number | null; qualityUnknown: boolean } {
    const requiredSignals = requirements.requiredSignals;
    let presentCount = 0;
    let unknownCount = 0;

    for (const requiredSignal of requiredSignals) {
      const signalValue = signals[requiredSignal];

      if (isSignalPresent(signalValue)) {
        presentCount++;
      } else if (isSignalUnknown(signalValue)) {
        unknownCount++;
      }
      // Note: absent signals (false) don't count toward present or unknown
    }

    // If too many unknowns (>= 50%), quality is unknown
    const unknownRatio = unknownCount / requiredSignals.length;
    if (unknownRatio >= 0.5) {
      return {
        qualityScore: null,
        qualityUnknown: true,
      };
    }

    // Quality score = present signals / total required signals
    const qualityScore = presentCount / requiredSignals.length;

    return {
      qualityScore,
      qualityUnknown: false,
    };
  }

  /**
   * Generates explanations for scores
   */
  private generateExplanations(
    asset: AssetEvidence,
    signals: CanonicalSignals,
    requirements: CapabilityRequirements,
    impactScore: number,
    qualityScore: number | null,
    qualityUnknown: boolean
  ): Explanation[] {
    const explanations: Explanation[] = [];
    const assetDesc = asset.name ? `"${asset.name}"` : `${asset.type} ${asset.assetId}`;

    // Impact score explanation
    if (isSignalPresent(signals.USAGE)) {
      explanations.push({
        title: 'High Impact',
        reasoning: `${assetDesc} has usage telemetry indicating active use (impact score: ${impactScore.toFixed(2)})`,
        evidenceRefs: [`atlan://asset/${asset.assetId}`],
      });
    } else {
      explanations.push({
        title: 'Low Impact (Default)',
        reasoning: `${assetDesc} has no usage telemetry; impact score defaulted to low (${impactScore.toFixed(2)})`,
        evidenceRefs: [`atlan://asset/${asset.assetId}`],
      });
    }

    // Quality score explanation
    if (qualityUnknown) {
      explanations.push({
        title: 'Quality Unknown',
        reasoning: `${assetDesc} has too many unknown signals (>= 50% of required signals unavailable)`,
        evidenceRefs: [`atlan://asset/${asset.assetId}`],
      });
    } else if (qualityScore !== null) {
      const presentCount = Math.round(qualityScore * requirements.requiredSignals.length);
      const totalRequired = requirements.requiredSignals.length;

      explanations.push({
        title: 'Quality Score',
        reasoning: `${assetDesc} has ${presentCount} of ${totalRequired} required signals present (quality score: ${qualityScore.toFixed(2)})`,
        evidenceRefs: [`atlan://asset/${asset.assetId}`],
      });
    }

    return explanations;
  }

  /**
   * Extracts dimension scores from assessment result
   */
  private extractDimensionScores(
    assessmentResult: AssessmentResult
  ): Record<string, number> | undefined {
    if (!assessmentResult.dimensionScores) {
      return undefined;
    }

    // Convert Score type to number (filter out UNKNOWN)
    const dimensionScores: Record<string, number> = {};

    for (const [dim, score] of Object.entries(assessmentResult.dimensionScores)) {
      if (typeof score === 'number') {
        dimensionScores[dim] = score;
      }
    }

    return Object.keys(dimensionScores).length > 0 ? dimensionScores : undefined;
  }

  /**
   * Gets aggregate quadrant distribution
   */
  getQuadrantDistribution(scores: SubjectScore[]): Record<Quadrant, number> {
    const distribution: Record<Quadrant, number> = {
      HH: 0,
      HL: 0,
      LH: 0,
      LL: 0,
      HU: 0,
      LU: 0,
    };

    for (const score of scores) {
      distribution[score.quadrant]++;
    }

    return distribution;
  }

  /**
   * Gets assets by quadrant
   */
  getAssetsByQuadrant(scores: SubjectScore[], quadrant: Quadrant): SubjectScore[] {
    return scores.filter((score) => score.quadrant === quadrant);
  }

  /**
   * Gets high-priority assets (HL and HU quadrants)
   */
  getHighPriorityAssets(scores: SubjectScore[]): SubjectScore[] {
    return scores.filter((score) => score.quadrant === 'HL' || score.quadrant === 'HU');
  }
}
