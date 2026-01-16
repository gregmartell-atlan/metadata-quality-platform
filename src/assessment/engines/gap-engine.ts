/**
 * Gap Engine
 *
 * Detects gaps by comparing required signals against actual signals.
 * Compares required signals (from capability requirements) against actual signals.
 *
 * Ported from atlan-metadata-evaluation/assessment/packages/domain/src/engines/gap-engine.ts
 */

import {
  AssetEvidence,
  Gap,
  GapType,
  GapSeverity,
  CanonicalSignal,
  CanonicalSignals,
  Workstream,
  CapabilityRequirements,
  GapSummary,
  createGapId,
  computeGapSummary,
  SIGNAL_TO_WORKSTREAM,
  SIGNAL_SEVERITY_MAP,
  isCriticalSignal,
} from './types';
import { isSignalPresent, isSignalAbsent, isSignalUnknown } from './signal-mapper';

/**
 * Gap detection engine
 * Compares required signals (from capability requirements) against actual signals
 */
export class GapEngine {
  /**
   * Computes gaps for a single asset
   */
  computeAssetGaps(
    asset: AssetEvidence,
    signals: CanonicalSignals,
    requirements: CapabilityRequirements
  ): Gap[] {
    const gaps: Gap[] = [];

    for (const requiredSignal of requirements.requiredSignals) {
      const signalValue = signals[requiredSignal];

      // Check for MISSING gap (signal is explicitly absent)
      if (isSignalAbsent(signalValue)) {
        gaps.push(
          this.createGap({
            gapType: 'MISSING',
            signalType: requiredSignal,
            asset,
            requirements,
          })
        );
      }

      // Check for UNKNOWN gap (signal availability unknown)
      if (isSignalUnknown(signalValue)) {
        gaps.push(
          this.createGap({
            gapType: 'UNKNOWN',
            signalType: requiredSignal,
            asset,
            requirements,
          })
        );
      }
    }

    return gaps;
  }

  /**
   * Computes gaps for all assets in a capability evaluation
   */
  computeAllGaps(
    assets: AssetEvidence[],
    signalsMap: Map<string, CanonicalSignals>,
    requirements: CapabilityRequirements
  ): { gaps: Gap[]; summary: GapSummary } {
    const allGaps: Gap[] = [];

    for (const asset of assets) {
      const signals = signalsMap.get(asset.assetId);
      if (!signals) {
        console.warn(`No signals found for asset ${asset.assetId}`);
        continue;
      }

      const assetGaps = this.computeAssetGaps(asset, signals, requirements);
      allGaps.push(...assetGaps);
    }

    // Compute summary statistics
    const summary = computeGapSummary(allGaps);

    return { gaps: allGaps, summary };
  }

  /**
   * Creates a gap object with all required metadata
   */
  private createGap(params: {
    gapType: GapType;
    signalType: CanonicalSignal;
    asset: AssetEvidence;
    requirements: CapabilityRequirements;
  }): Gap {
    const { gapType, signalType, asset, requirements } = params;

    // Compute severity based on signal importance and whether it's critical for this capability
    const severity = this.computeSeverity(signalType, requirements);

    // Map to workstream
    const workstream = SIGNAL_TO_WORKSTREAM[signalType];

    // Generate explanation
    const explanation = this.generateGapExplanation(gapType, signalType, asset);

    // Create evidence references (would link to Atlan in production)
    const evidenceRefs = this.createEvidenceRefs(asset);

    return {
      id: createGapId(gapType, signalType, asset.assetId),
      gapType,
      signalType,
      subjectType: 'ASSET', // MVP: only asset-level gaps
      subjectId: asset.assetId,
      subjectName: asset.name,
      assetType: asset.type,
      qualifiedName: asset.assetId, // Using assetId as qualified name for now
      severity,
      workstream,
      explanation,
      evidenceRefs,
      detectedAt: new Date().toISOString(),
    };
  }

  /**
   * Computes gap severity
   * Critical signals for this capability -> HIGH
   * Non-critical but baseline important signals -> Use signal severity map
   */
  private computeSeverity(
    signal: CanonicalSignal,
    requirements: CapabilityRequirements
  ): GapSeverity {
    // If this signal is critical for this specific capability, always HIGH
    if (isCriticalSignal(requirements.capabilityId, signal)) {
      return 'HIGH';
    }

    // Otherwise use the baseline signal severity map
    return SIGNAL_SEVERITY_MAP[signal];
  }

  /**
   * Generates human-readable explanation for a gap
   */
  private generateGapExplanation(
    gapType: GapType,
    signalType: CanonicalSignal,
    asset: AssetEvidence
  ): string {
    const assetDesc = asset.name ? `"${asset.name}"` : `${asset.type} ${asset.assetId}`;

    if (gapType === 'MISSING') {
      return this.getMissingSignalExplanation(signalType, assetDesc);
    }

    if (gapType === 'UNKNOWN') {
      return this.getUnknownSignalExplanation(signalType, assetDesc);
    }

    return `${gapType} gap for ${signalType} on ${assetDesc}`;
  }

  /**
   * Gets explanation for MISSING signal
   */
  private getMissingSignalExplanation(signal: CanonicalSignal, assetDesc: string): string {
    const explanations: Record<CanonicalSignal, string> = {
      OWNERSHIP: `${assetDesc} has no owner assigned`,
      SEMANTICS: `${assetDesc} lacks description or documentation`,
      LINEAGE: `${assetDesc} has no documented upstream or downstream relationships`,
      SENSITIVITY: `${assetDesc} has no classification tags or sensitivity markers`,
      ACCESS: `${assetDesc} has no access policies defined`,
      USAGE: `${assetDesc} has no usage telemetry or popularity metrics`,
      FRESHNESS: `${assetDesc} has no freshness SLA or quality monitoring configured`,
    };
    return explanations[signal];
  }

  /**
   * Gets explanation for UNKNOWN signal
   */
  private getUnknownSignalExplanation(signal: CanonicalSignal, assetDesc: string): string {
    const explanations: Record<CanonicalSignal, string> = {
      OWNERSHIP: `${assetDesc} ownership status unavailable`,
      SEMANTICS: `${assetDesc} semantics metadata unavailable`,
      LINEAGE: `${assetDesc} lineage information unavailable`,
      SENSITIVITY: `${assetDesc} sensitivity classification unavailable`,
      ACCESS: `${assetDesc} access policy information unavailable`,
      USAGE: `${assetDesc} usage telemetry unavailable`,
      FRESHNESS: `${assetDesc} freshness monitoring data unavailable`,
    };
    return explanations[signal];
  }

  /**
   * Creates evidence reference URLs
   * In production, these would link to Atlan asset pages
   */
  private createEvidenceRefs(asset: AssetEvidence): string[] {
    // MVP: Return placeholder URLs
    // In production, construct Atlan URLs like: https://tenant.atlan.com/assets/{guid}
    return [`atlan://asset/${asset.assetId}`];
  }

  /**
   * Filters gaps by severity
   */
  filterBySeverity(gaps: Gap[], severity: GapSeverity): Gap[] {
    return gaps.filter((gap) => gap.severity === severity);
  }

  /**
   * Gets gaps for a specific workstream
   */
  getGapsByWorkstream(gaps: Gap[], workstream: Workstream): Gap[] {
    return gaps.filter((gap) => gap.workstream === workstream);
  }

  /**
   * Gets gaps for a specific signal
   */
  getGapsBySignal(gaps: Gap[], signal: CanonicalSignal): Gap[] {
    return gaps.filter((gap) => gap.signalType === signal);
  }

  /**
   * Gets top N gaps sorted by severity
   */
  getTopGaps(gaps: Gap[], limit: number): Gap[] {
    // Sort by severity (HIGH > MED > LOW), then by workstream
    const severityOrder: Record<GapSeverity, number> = { HIGH: 3, MED: 2, LOW: 1 };

    return gaps
      .sort((a, b) => {
        const severityDiff = severityOrder[b.severity] - severityOrder[a.severity];
        if (severityDiff !== 0) return severityDiff;

        // Secondary sort by workstream
        return a.workstream.localeCompare(b.workstream);
      })
      .slice(0, limit);
  }
}
