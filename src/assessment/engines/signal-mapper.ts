/**
 * Signal Mapper
 *
 * Maps AssetEvidence to CanonicalSignals.
 * Converts evidence fields to the 10 canonical signal presence flags.
 *
 * Ported from atlan-metadata-evaluation/assessment/packages/domain/src/engines/signal-mapper.ts
 */

import {
  AssetEvidence,
  CanonicalSignals,
  SignalValue,
  Tri,
} from './types';

/**
 * Maps AssetEvidence (from scoring library) to CanonicalSignals
 * Converts evidence fields to the 10 canonical signal presence flags
 */
export function mapEvidenceToSignals(evidence: AssetEvidence): CanonicalSignals {
  return {
    OWNERSHIP: mapOwnershipSignal(evidence),
    LINEAGE: mapLineageSignal(evidence),
    SEMANTICS: mapSemanticsSignal(evidence),
    SENSITIVITY: mapSensitivitySignal(evidence),
    ACCESS: mapAccessSignal(evidence),
    QUALITY: mapQualitySignal(evidence),
    FRESHNESS: mapFreshnessSignal(evidence),
    USAGE: mapUsageSignal(evidence),
    AI_READY: mapAiReadySignal(evidence),
    TRUST: mapTrustSignal(evidence),
  };
}

/**
 * OWNERSHIP signal: Asset has assigned owners
 */
function mapOwnershipSignal(evidence: AssetEvidence): SignalValue {
  return triToSignalValue(evidence.ownerPresent);
}

/**
 * LINEAGE signal: Upstream/downstream relationships documented
 */
function mapLineageSignal(evidence: AssetEvidence): SignalValue {
  // Use relationshipsPresent as primary, fallback to hasUpstream || hasDownstream
  if (evidence.relationshipsPresent !== undefined) {
    return triToSignalValue(evidence.relationshipsPresent);
  }

  // If either upstream or downstream exists, lineage is partially present
  const hasUpstream = triToBool(evidence.hasUpstream);
  const hasDownstream = triToBool(evidence.hasDownstream);

  if (hasUpstream === 'UNKNOWN' && hasDownstream === 'UNKNOWN') {
    return 'UNKNOWN';
  }

  if (hasUpstream === true || hasDownstream === true) {
    return true;
  }

  if (hasUpstream === false && hasDownstream === false) {
    return false;
  }

  return 'UNKNOWN';
}

/**
 * SEMANTICS signal: Descriptions, glossary terms, documentation present
 */
function mapSemanticsSignal(evidence: AssetEvidence): SignalValue {
  const hasDescription = triToBool(evidence.descriptionPresent);
  const hasRunbook = triToBool(evidence.runbookPresent);
  const hasGlossaryTerms = triToBool(evidence.glossaryTermsPresent);

  // If any semantic metadata exists, semantics are partially present
  const allUnknown = hasDescription === 'UNKNOWN' &&
                     hasRunbook === 'UNKNOWN' &&
                     hasGlossaryTerms === 'UNKNOWN';

  if (allUnknown) {
    return 'UNKNOWN';
  }

  if (hasDescription === true || hasRunbook === true || hasGlossaryTerms === true) {
    return true;
  }

  const allFalse = hasDescription === false &&
                   hasRunbook === false &&
                   hasGlossaryTerms === false;

  if (allFalse) {
    return false;
  }

  return 'UNKNOWN';
}

/**
 * SENSITIVITY signal: Classification tags and data sensitivity markers
 */
function mapSensitivitySignal(evidence: AssetEvidence): SignalValue {
  const hasClassifiedFields = triToBool(evidence.hasClassifiedFields);
  const hasSensitivityTags = triToBool(evidence.sensitivityTagsPresent);

  // Sensitivity is present if there are classified fields or sensitivity tags
  if (hasClassifiedFields === 'UNKNOWN' && hasSensitivityTags === 'UNKNOWN') {
    return 'UNKNOWN';
  }

  if (hasClassifiedFields === true || hasSensitivityTags === true) {
    return true;
  }

  if (hasClassifiedFields === false && hasSensitivityTags === false) {
    return false;
  }

  return 'UNKNOWN';
}

/**
 * ACCESS signal: Access policies and permissions defined
 */
function mapAccessSignal(evidence: AssetEvidence): SignalValue {
  return triToSignalValue(evidence.accessPoliciesPresent);
}

/**
 * USAGE signal: Usage telemetry and popularity metrics available
 */
function mapUsageSignal(evidence: AssetEvidence): SignalValue {
  const hasUsageTelemetry = triToBool(evidence.usageTelemetryPresent);
  const hasPopularity = triToBool(evidence.popularityAvailable);

  // Usage is present if telemetry or popularity data exists
  if (hasUsageTelemetry === 'UNKNOWN' && hasPopularity === 'UNKNOWN') {
    return 'UNKNOWN';
  }

  if (hasUsageTelemetry === true || hasPopularity === true) {
    return true;
  }

  if (hasUsageTelemetry === false && hasPopularity === false) {
    return false;
  }

  return 'UNKNOWN';
}

/**
 * FRESHNESS signal: Data freshness SLAs and timeliness monitoring
 */
function mapFreshnessSignal(evidence: AssetEvidence): SignalValue {
  const hasFreshnessSla = triToBool(evidence.freshnessSlaPass);
  const hasFreshnessMonitoring = triToBool(evidence.freshnessMonitoringConfigured);

  // If either SLA or monitoring configured, freshness is partially present
  if (hasFreshnessSla === 'UNKNOWN' && hasFreshnessMonitoring === 'UNKNOWN') {
    return 'UNKNOWN';
  }

  if (hasFreshnessSla === true || hasFreshnessMonitoring === true) {
    return true;
  }

  if (hasFreshnessSla === false && hasFreshnessMonitoring === false) {
    return false;
  }

  return 'UNKNOWN';
}

/**
 * QUALITY signal: DQ monitoring and observability configured
 */
function mapQualitySignal(evidence: AssetEvidence): SignalValue {
  const hasDqSignals = triToBool(evidence.dqSignalsPresent);
  const hasDqMonitoring = triToBool(evidence.dqMonitoringConfigured);

  // If either DQ signals or monitoring configured, quality is partially present
  if (hasDqSignals === 'UNKNOWN' && hasDqMonitoring === 'UNKNOWN') {
    return 'UNKNOWN';
  }

  if (hasDqSignals === true || hasDqMonitoring === true) {
    return true;
  }

  if (hasDqSignals === false && hasDqMonitoring === false) {
    return false;
  }

  return 'UNKNOWN';
}

/**
 * AI_READY signal: Asset is approved for AI/ML training and usage
 */
function mapAiReadySignal(evidence: AssetEvidence): SignalValue {
  const hasAiApproval = triToBool(evidence.aiApproved);
  const hasAiGovernance = triToBool(evidence.aiGovernanceConfigured);

  // AI_READY requires explicit approval or governance configuration
  if (hasAiApproval === 'UNKNOWN' && hasAiGovernance === 'UNKNOWN') {
    return 'UNKNOWN';
  }

  if (hasAiApproval === true || hasAiGovernance === true) {
    return true;
  }

  if (hasAiApproval === false && hasAiGovernance === false) {
    return false;
  }

  return 'UNKNOWN';
}

/**
 * TRUST signal: Asset has certification or trust markers
 */
function mapTrustSignal(evidence: AssetEvidence): SignalValue {
  const hasCertification = triToBool(evidence.certificationPresent);
  const hasVerifiedStatus = triToBool(evidence.verifiedStatus);

  // Trust is present if certification or verified status exists
  if (hasCertification === 'UNKNOWN' && hasVerifiedStatus === 'UNKNOWN') {
    return 'UNKNOWN';
  }

  if (hasCertification === true || hasVerifiedStatus === true) {
    return true;
  }

  if (hasCertification === false && hasVerifiedStatus === false) {
    return false;
  }

  return 'UNKNOWN';
}

/**
 * Converts Tri to SignalValue (direct mapping)
 */
function triToSignalValue(tri: Tri | undefined): SignalValue {
  if (tri === undefined) return 'UNKNOWN';
  if (tri === 'UNKNOWN') return 'UNKNOWN';
  return tri;
}

/**
 * Converts Tri to boolean or UNKNOWN
 */
function triToBool(tri: Tri | undefined): boolean | 'UNKNOWN' {
  if (tri === undefined) return 'UNKNOWN';
  if (tri === 'UNKNOWN') return 'UNKNOWN';
  return tri;
}

/**
 * Maps all assets in an evidence bundle to canonical signals
 */
export function mapEvidenceBundleToSignals(
  assets: AssetEvidence[]
): Map<string, CanonicalSignals> {
  const signalsMap = new Map<string, CanonicalSignals>();

  for (const asset of assets) {
    signalsMap.set(asset.assetId, mapEvidenceToSignals(asset));
  }

  return signalsMap;
}

/**
 * Checks if a signal is explicitly present (true)
 */
export function isSignalPresent(signalValue: SignalValue): boolean {
  return signalValue === true;
}

/**
 * Checks if a signal is explicitly absent (false)
 */
export function isSignalAbsent(signalValue: SignalValue): boolean {
  return signalValue === false;
}

/**
 * Checks if a signal is unknown
 */
export function isSignalUnknown(signalValue: SignalValue): boolean {
  return signalValue === 'UNKNOWN';
}
