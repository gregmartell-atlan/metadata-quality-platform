/**
 * Explanation Generator
 *
 * Generates human-readable explanations for scores, gaps, and assessment results.
 * Creates structured explanations with titles, reasoning, and evidence references.
 *
 * Ported from atlan-metadata-evaluation/assessment/packages/domain/src/engines/explanation-generator.ts
 */

import {
  AssetEvidence,
  AssessmentResult,
  Explanation,
  Gap,
  CanonicalSignal,
  CanonicalSignals,
  CapabilityRequirements,
} from './types';
import { isSignalPresent, isSignalAbsent, isSignalUnknown } from './signal-mapper';

/**
 * Explanation generation engine
 * Creates human-readable explanations for scores, gaps, and assessment results
 */
export class ExplanationGenerator {
  /**
   * Generates explanation for readiness score
   */
  generateReadinessExplanation(
    assessmentResult: AssessmentResult,
    requirements: CapabilityRequirements
  ): Explanation {
    const readiness = assessmentResult.readiness;

    if (readiness === 'UNKNOWN') {
      return {
        title: 'Readiness Unknown',
        reasoning: `Unable to determine readiness for ${requirements.name} - too many signals are UNKNOWN`,
        evidenceRefs: [],
      };
    }

    const score = typeof readiness === 'number' ? readiness : 0;
    const percentage = Math.round(score * 100);

    if (score >= 0.8) {
      return {
        title: `Ready (${percentage}%)`,
        reasoning: `${requirements.name} is ready for use - ${percentage}% of requirements met`,
        evidenceRefs: [],
      };
    }

    if (score >= 0.6) {
      return {
        title: `Mostly Ready (${percentage}%)`,
        reasoning: `${requirements.name} is mostly ready - ${percentage}% of requirements met, minor gaps remain`,
        evidenceRefs: [],
      };
    }

    return {
      title: `Not Ready (${percentage}%)`,
      reasoning: `${requirements.name} has significant gaps - only ${percentage}% of requirements met`,
      evidenceRefs: [],
    };
  }

  /**
   * Generates explanation for gate failures
   */
  generateGateExplanation(
    assessmentResult: AssessmentResult,
    requirements: CapabilityRequirements
  ): Explanation | null {
    if (assessmentResult.gatePass) {
      return null; // No explanation needed if gates pass
    }

    const blockers = assessmentResult.blockers;

    return {
      title: 'Gate Failures',
      reasoning: `${requirements.name} cannot be used due to gate failures: ${blockers.join(', ')}`,
      evidenceRefs: [],
      severity: 'HIGH',
    };
  }

  /**
   * Generates explanation for signal coverage
   */
  generateSignalCoverageExplanation(
    signals: CanonicalSignals,
    requirements: CapabilityRequirements
  ): Explanation {
    const requiredSignals = requirements.requiredSignals;
    let presentCount = 0;
    let absentCount = 0;
    let unknownCount = 0;

    const presentSignals: string[] = [];
    const absentSignals: string[] = [];
    const unknownSignals: string[] = [];

    for (const signal of requiredSignals) {
      const value = signals[signal];

      if (isSignalPresent(value)) {
        presentCount++;
        presentSignals.push(signal);
      } else if (isSignalAbsent(value)) {
        absentCount++;
        absentSignals.push(signal);
      } else if (isSignalUnknown(value)) {
        unknownCount++;
        unknownSignals.push(signal);
      }
    }

    const totalRequired = requiredSignals.length;
    const coveragePercentage = Math.round((presentCount / totalRequired) * 100);

    let reasoning = `Signal coverage: ${presentCount}/${totalRequired} (${coveragePercentage}%) required signals present`;

    if (absentSignals.length > 0) {
      reasoning += `. Missing: ${absentSignals.join(', ')}`;
    }

    if (unknownSignals.length > 0) {
      reasoning += `. Unknown: ${unknownSignals.join(', ')}`;
    }

    return {
      title: `Signal Coverage: ${coveragePercentage}%`,
      reasoning,
      evidenceRefs: [],
    };
  }

  /**
   * Generates explanation for a specific gap
   */
  generateGapDetailExplanation(
    gap: Gap,
    asset: AssetEvidence,
    signals: CanonicalSignals
  ): Explanation {
    const assetDesc = asset.name ? `"${asset.name}"` : `${asset.type}`;

    if (gap.gapType === 'MISSING') {
      return this.generateMissingSignalDetailExplanation(
        gap.signalType,
        assetDesc,
        asset,
        signals
      );
    }

    if (gap.gapType === 'UNKNOWN') {
      return this.generateUnknownSignalDetailExplanation(
        gap.signalType,
        assetDesc,
        asset
      );
    }

    return {
      title: `${gap.gapType} Gap`,
      reasoning: gap.explanation,
      evidenceRefs: gap.evidenceRefs,
      severity: gap.severity,
    };
  }

  /**
   * Generates detailed explanation for missing signal
   */
  private generateMissingSignalDetailExplanation(
    signal: CanonicalSignal,
    assetDesc: string,
    asset: AssetEvidence,
    _signals: CanonicalSignals
  ): Explanation {
    const explanations: Record<CanonicalSignal, string> = {
      OWNERSHIP: `${assetDesc} has no owner assigned. Assign an owner (user or group) to establish accountability and stewardship.`,
      SEMANTICS: `${assetDesc} lacks description or documentation. Add a description to improve discoverability and understanding.`,
      LINEAGE: `${assetDesc} has no documented relationships. Map upstream sources and downstream consumers to understand data flow.`,
      SENSITIVITY: `${assetDesc} has no classification tags. Tag sensitive data to enable proper access control and compliance.`,
      ACCESS: `${assetDesc} has no access policies defined. Define access policies to control who can view and use this asset.`,
      USAGE: `${assetDesc} has no usage telemetry. Enable usage tracking to understand impact and prioritize improvements.`,
      FRESHNESS: `${assetDesc} has no freshness monitoring. Set up SLAs and quality checks to ensure data reliability.`,
    };

    return {
      title: `Missing ${signal}`,
      reasoning: explanations[signal],
      evidenceRefs: [`atlan://asset/${asset.assetId}`],
      severity: 'HIGH',
    };
  }

  /**
   * Generates detailed explanation for unknown signal
   */
  private generateUnknownSignalDetailExplanation(
    signal: CanonicalSignal,
    assetDesc: string,
    asset: AssetEvidence
  ): Explanation {
    const explanations: Record<CanonicalSignal, string> = {
      OWNERSHIP: `${assetDesc} ownership status unavailable. Verify metadata sync or check asset configuration.`,
      SEMANTICS: `${assetDesc} semantics metadata unavailable. Verify metadata sync or check asset configuration.`,
      LINEAGE: `${assetDesc} lineage information unavailable. Enable lineage extraction or verify source connection.`,
      SENSITIVITY: `${assetDesc} classification information unavailable. Enable classification scanning or verify policy configuration.`,
      ACCESS: `${assetDesc} access policy information unavailable. Enable access policy extraction or verify source connection.`,
      USAGE: `${assetDesc} usage telemetry unavailable. Enable usage tracking in Atlan or verify source connection.`,
      FRESHNESS: `${assetDesc} freshness monitoring unavailable. Enable quality monitoring or verify data quality configuration.`,
    };

    return {
      title: `Unknown ${signal}`,
      reasoning: explanations[signal],
      evidenceRefs: [`atlan://asset/${asset.assetId}`],
      severity: 'MED',
    };
  }

  /**
   * Generates explanation for dimension score
   */
  generateDimensionExplanation(
    dimensionId: string,
    score: number,
    measureValues: Record<string, number | 'UNKNOWN'>
  ): Explanation {
    const percentage = Math.round(score * 100);

    // Extract measures that contributed to this dimension
    const contributingMeasures: string[] = [];

    for (const [measureId, value] of Object.entries(measureValues)) {
      if (typeof value === 'number' && measureId.includes(dimensionId.toLowerCase())) {
        contributingMeasures.push(`${measureId}: ${Math.round(value * 100)}%`);
      }
    }

    let reasoning = `${dimensionId} dimension score: ${percentage}%`;

    if (contributingMeasures.length > 0) {
      reasoning += `. Contributing measures: ${contributingMeasures.join(', ')}`;
    }

    return {
      title: `${dimensionId}: ${percentage}%`,
      reasoning,
      evidenceRefs: [],
    };
  }

  /**
   * Generates explanation for overall assessment
   */
  generateAssessmentSummaryExplanation(
    assessmentResult: AssessmentResult,
    requirements: CapabilityRequirements,
    gapCount: number,
    highSeverityCount: number
  ): Explanation {
    const readiness = assessmentResult.readiness;
    const score = typeof readiness === 'number' ? readiness : 0;
    const percentage = Math.round(score * 100);

    let reasoning = `${requirements.name} assessment complete: ${percentage}% ready, ${gapCount} gap${gapCount !== 1 ? 's' : ''} detected`;

    if (highSeverityCount > 0) {
      reasoning += ` (${highSeverityCount} high severity)`;
    }

    if (!assessmentResult.gatePass) {
      reasoning += `. Gate failures: ${assessmentResult.blockers.join(', ')}`;
    }

    const severity = highSeverityCount > 0 ? 'HIGH' : gapCount > 0 ? 'MED' : undefined;

    return {
      title: 'Assessment Summary',
      reasoning,
      evidenceRefs: [],
      severity,
    };
  }
}
