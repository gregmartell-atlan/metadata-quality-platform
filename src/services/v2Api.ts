/**
 * V2 Assessment API Service
 *
 * Client for V2 assessment runs, integrating with MDLH backend.
 * Manages assessment runs, evidence collection, gap detection, and plan generation.
 */

import { useBackendModeStore } from '../stores/backendModeStore';

export type RunStatus = 'CREATED' | 'INGESTING' | 'SCORING' | 'COMPLETED' | 'FAILED';

export interface RunDetails {
  id: string;
  createdAt: string;
  status: RunStatus;
  scope?: RunScope;
  selectedCapabilities: string[];
  assetCount?: number;
  gapCount?: number;
}

export interface RunScope {
  domainQualifiedName?: string;
  connectionQualifiedName?: string;
  schemaQualifiedName?: string;
  databaseQualifiedName?: string;
  query?: string;
}

export interface SignalEvidence {
  signalType: string;
  signalValue: any;
  signalSource: string;
  present: boolean;
  observedAt: string | null;
}

export interface AssetEvidence {
  assetGuid: string;
  assetQualifiedName: string;
  assetName: string;
  assetTypeName: string;
  signals: SignalEvidence[];
  impactScore: number | null;
  qualityScore: number | null;
  quadrant: string;
}

export interface DomainScore {
  id: string;
  runId: string;
  subjectType: string;
  subjectId: string;
  impactScore: number;
  qualityScore: number | null;
  qualityUnknown: boolean;
  quadrant: string;
  assetCount: number;
  knownAssetCount: number;
}

export interface Gap {
  id: string;
  runId: string;
  gapType: string;
  subjectType: string;
  subjectId: string;
  subjectName?: string;
  severity: 'HIGH' | 'MED' | 'LOW';
  explanation: string;
  signalType?: string;
}

export interface PlanPhase {
  name: string;
  actions: PlanAction[];
}

export interface PlanAction {
  id?: string;
  workstream: string;
  scope: string;
  effortBucket: 'S' | 'M' | 'L';
  explanation?: string;
  assetCount?: number;
}

// Helper to get session headers
function getHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Requested-With': 'XMLHttpRequest'
  };

  // Add session ID from backend mode store if available
  const sessionId = useBackendModeStore.getState().snowflakeStatus.sessionId;
  if (sessionId) {
    headers['X-Session-ID'] = sessionId;
  }

  return headers;
}

// In-memory store for runs (will be replaced by backend storage)
const runsStore = new Map<string, RunDetails>();
const evidenceStore = new Map<string, AssetEvidence[]>();
const gapsStore = new Map<string, Gap[]>();
const plansStore = new Map<string, PlanPhase[]>();
const scoresStore = new Map<string, DomainScore[]>();

/**
 * Create a new assessment run
 */
export async function createRun(scope: RunScope | undefined, capabilities: string[]): Promise<RunDetails> {
  const id = `run_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const run: RunDetails = {
    id,
    createdAt: new Date().toISOString(),
    status: 'CREATED',
    scope,
    selectedCapabilities: capabilities,
    assetCount: 0,
    gapCount: 0
  };

  runsStore.set(id, run);
  evidenceStore.set(id, []);
  gapsStore.set(id, []);
  plansStore.set(id, []);
  scoresStore.set(id, []);

  return run;
}

/**
 * Get run details
 */
export async function getRun(id: string): Promise<RunDetails | null> {
  return runsStore.get(id) || null;
}

/**
 * Get all runs
 */
export async function getRuns(): Promise<RunDetails[]> {
  return Array.from(runsStore.values()).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

/**
 * Ingest assets from MDLH into a run
 * This fetches assets from Snowflake/MDLH based on the run scope
 */
export async function ingestRun(runId: string): Promise<{ status: string; assetCount: number }> {
  const run = runsStore.get(runId);
  if (!run) throw new Error('Run not found');

  // Update status to ingesting
  run.status = 'INGESTING';
  runsStore.set(runId, run);

  try {
    // Build search params based on scope
    const searchParams = new URLSearchParams();
    if (run.scope?.schemaQualifiedName) {
      // Extract schema name from qualified name
      const parts = run.scope.schemaQualifiedName.split('/');
      const schemaName = parts[parts.length - 1];
      searchParams.set('schema', schemaName);
    }
    if (run.scope?.databaseQualifiedName) {
      const parts = run.scope.databaseQualifiedName.split('/');
      const dbName = parts[parts.length - 1];
      searchParams.set('database', dbName);
    }
    searchParams.set('limit', '500');

    // Fetch assets from MDLH
    const response = await fetch(`/api/mdlh/assets?${searchParams.toString()}`, {
      headers: getHeaders()
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch assets: ${response.statusText}`);
    }

    const data = await response.json();
    const assets = data.assets || [];

    // Transform MDLH assets to evidence format
    const evidence: AssetEvidence[] = assets.map((asset: any) => ({
      assetGuid: asset.guid || '',
      assetQualifiedName: asset.qualified_name || asset.qualifiedName || '',
      assetName: asset.asset_name || asset.name || '',
      assetTypeName: asset.asset_type || asset.typeName || 'Unknown',
      signals: extractSignals(asset),
      impactScore: null, // Computed during scoring
      qualityScore: null,
      quadrant: 'QUALITY_UNKNOWN'
    }));

    evidenceStore.set(runId, evidence);

    // Update run status
    run.status = 'SCORING';
    run.assetCount = evidence.length;
    runsStore.set(runId, run);

    // Auto-trigger scoring
    await scoreRun(runId);

    return { status: 'COMPLETED', assetCount: evidence.length };
  } catch (error) {
    run.status = 'FAILED';
    runsStore.set(runId, run);
    throw error;
  }
}

/**
 * Extract signals from MDLH asset data
 */
function extractSignals(asset: any): SignalEvidence[] {
  const signals: SignalEvidence[] = [];
  const now = new Date().toISOString();

  // OWNERSHIP signal
  const hasOwner = Boolean(
    asset.owner_users?.length > 0 ||
    asset.owner_groups?.length > 0 ||
    asset.ownerUsers?.length > 0
  );
  signals.push({
    signalType: 'OWNERSHIP',
    signalValue: hasOwner ? { owners: asset.owner_users || asset.ownerUsers || [] } : null,
    signalSource: hasOwner ? 'MDLH' : 'NOT_OBSERVED',
    present: hasOwner,
    observedAt: hasOwner ? now : null
  });

  // SEMANTICS signal (description, glossary terms)
  const hasSemantics = Boolean(
    (asset.description && asset.description.trim().length > 0) ||
    (asset.user_description && asset.user_description.trim().length > 0) ||
    asset.term_guids?.length > 0 ||
    asset.termGuids?.length > 0
  );
  signals.push({
    signalType: 'SEMANTICS',
    signalValue: hasSemantics ? {
      description: asset.description || asset.user_description,
      termCount: (asset.term_guids || asset.termGuids || []).length
    } : null,
    signalSource: hasSemantics ? 'MDLH' : 'NOT_OBSERVED',
    present: hasSemantics,
    observedAt: hasSemantics ? now : null
  });

  // LINEAGE signal
  const hasLineage = Boolean(
    asset.has_lineage ||
    asset.lineage_depth > 0 ||
    asset.upstream_count > 0 ||
    asset.downstream_count > 0
  );
  signals.push({
    signalType: 'LINEAGE',
    signalValue: hasLineage ? {
      depth: asset.lineage_depth || 0,
      upstream: asset.upstream_count || 0,
      downstream: asset.downstream_count || 0
    } : null,
    signalSource: hasLineage ? 'MDLH' : 'NOT_OBSERVED',
    present: hasLineage,
    observedAt: hasLineage ? now : null
  });

  // SENSITIVITY signal
  const hasSensitivity = Boolean(
    asset.classification_names?.length > 0 ||
    asset.tags?.length > 0 ||
    asset.sensitivity_level
  );
  signals.push({
    signalType: 'SENSITIVITY',
    signalValue: hasSensitivity ? {
      classifications: asset.classification_names || [],
      tags: asset.tags || [],
      level: asset.sensitivity_level
    } : null,
    signalSource: hasSensitivity ? 'MDLH' : 'NOT_OBSERVED',
    present: hasSensitivity,
    observedAt: hasSensitivity ? now : null
  });

  // FRESHNESS signal
  const hasFreshness = Boolean(
    asset.last_sync_run_at ||
    asset.source_updated_at ||
    asset.source_created_at
  );
  signals.push({
    signalType: 'FRESHNESS',
    signalValue: hasFreshness ? {
      lastSyncAt: asset.last_sync_run_at,
      sourceUpdatedAt: asset.source_updated_at
    } : null,
    signalSource: hasFreshness ? 'MDLH' : 'NOT_OBSERVED',
    present: hasFreshness,
    observedAt: hasFreshness ? now : null
  });

  // QUALITY signal
  const hasQuality = Boolean(
    asset.quality_score !== undefined && asset.quality_score !== null
  );
  signals.push({
    signalType: 'QUALITY',
    signalValue: hasQuality ? { score: asset.quality_score } : null,
    signalSource: hasQuality ? 'MDLH' : 'NOT_OBSERVED',
    present: hasQuality,
    observedAt: hasQuality ? now : null
  });

  return signals;
}

/**
 * Score a run - compute impact and quality scores for assets
 */
export async function scoreRun(runId: string): Promise<{ status: string }> {
  const run = runsStore.get(runId);
  if (!run) throw new Error('Run not found');

  const evidence = evidenceStore.get(runId) || [];

  // Compute scores for each asset
  for (const asset of evidence) {
    // Quality score = percentage of signals present
    const presentSignals = asset.signals.filter(s => s.present).length;
    const totalSignals = asset.signals.length;
    asset.qualityScore = totalSignals > 0 ? (presentSignals / totalSignals) * 100 : 0;

    // Impact score - simplified heuristic based on asset type
    // Tables/Views have higher base impact than columns
    const typeImpact: Record<string, number> = {
      'Table': 80,
      'View': 75,
      'MaterializedView': 75,
      'Schema': 90,
      'Database': 95,
      'Column': 40,
      'default': 60
    };
    asset.impactScore = typeImpact[asset.assetTypeName] || typeImpact.default;

    // Determine quadrant
    const highImpact = asset.impactScore >= 50;
    const highQuality = asset.qualityScore >= 50;

    if (highImpact && highQuality) {
      asset.quadrant = 'HIGH_IMPACT_HIGH_QUALITY';
    } else if (highImpact && !highQuality) {
      asset.quadrant = 'HIGH_IMPACT_LOW_QUALITY';
    } else if (!highImpact && highQuality) {
      asset.quadrant = 'LOW_IMPACT_HIGH_QUALITY';
    } else {
      asset.quadrant = 'LOW_IMPACT_LOW_QUALITY';
    }
  }

  // Generate domain scores (group by schema/database)
  const domainGroups = new Map<string, AssetEvidence[]>();
  for (const asset of evidence) {
    // Extract domain from qualified name (schema level)
    const parts = asset.assetQualifiedName.split('/');
    const domain = parts.length >= 3 ? parts.slice(0, 3).join('/') : asset.assetQualifiedName;

    if (!domainGroups.has(domain)) {
      domainGroups.set(domain, []);
    }
    domainGroups.get(domain)!.push(asset);
  }

  const domainScores: DomainScore[] = [];
  for (const [domain, assets] of domainGroups) {
    const avgImpact = assets.reduce((sum, a) => sum + (a.impactScore || 0), 0) / assets.length;
    const avgQuality = assets.reduce((sum, a) => sum + (a.qualityScore || 0), 0) / assets.length;
    const knownCount = assets.filter(a => a.qualityScore !== null).length;

    const highImpact = avgImpact >= 50;
    const highQuality = avgQuality >= 50;
    let quadrant = 'QUALITY_UNKNOWN';

    if (knownCount > 0) {
      if (highImpact && highQuality) quadrant = 'HIGH_IMPACT_HIGH_QUALITY';
      else if (highImpact && !highQuality) quadrant = 'HIGH_IMPACT_LOW_QUALITY';
      else if (!highImpact && highQuality) quadrant = 'LOW_IMPACT_HIGH_QUALITY';
      else quadrant = 'LOW_IMPACT_LOW_QUALITY';
    }

    domainScores.push({
      id: `score_${runId}_${domain}`,
      runId,
      subjectType: 'DOMAIN',
      subjectId: domain,
      impactScore: avgImpact / 100,
      qualityScore: avgQuality / 100,
      qualityUnknown: knownCount === 0,
      quadrant,
      assetCount: assets.length,
      knownAssetCount: knownCount
    });
  }

  scoresStore.set(runId, domainScores);
  evidenceStore.set(runId, evidence);

  // Update run status
  run.status = 'COMPLETED';
  runsStore.set(runId, run);

  // Auto-detect gaps
  await recomputeGaps(runId);

  return { status: 'COMPLETED' };
}

/**
 * Get catalog (evidence) for a run
 */
export async function getCatalog(runId: string): Promise<AssetEvidence[]> {
  return evidenceStore.get(runId) || [];
}

/**
 * Get domain scores for a run
 */
export async function getDomainScores(runId: string): Promise<DomainScore[]> {
  return scoresStore.get(runId) || [];
}

/**
 * Get assets for a specific domain
 */
export async function getDomainAssets(runId: string, domainId: string): Promise<AssetEvidence[]> {
  const evidence = evidenceStore.get(runId) || [];
  return evidence.filter(a => a.assetQualifiedName.startsWith(domainId));
}

/**
 * Recompute gaps for a run based on selected capabilities
 */
export async function recomputeGaps(runId: string): Promise<{ count: number; gaps: Gap[] }> {
  const run = runsStore.get(runId);
  if (!run) throw new Error('Run not found');

  const evidence = evidenceStore.get(runId) || [];
  const gaps: Gap[] = [];

  // Map capabilities to required signals
  const capabilitySignals: Record<string, string[]> = {
    'ai_rag': ['SEMANTICS', 'LINEAGE', 'OWNERSHIP'],
    'ai_agent': ['SEMANTICS', 'FRESHNESS', 'OWNERSHIP', 'SENSITIVITY'],
    'ai_forecast': ['QUALITY', 'FRESHNESS', 'LINEAGE'],
    'data_ownership': ['OWNERSHIP'],
    'data_lineage': ['LINEAGE'],
    'data_semantics': ['SEMANTICS'],
    'data_quality': ['QUALITY', 'FRESHNESS'],
    'data_security': ['SENSITIVITY']
  };

  // Collect required signals from selected capabilities
  const requiredSignals = new Set<string>();
  for (const cap of run.selectedCapabilities) {
    const signals = capabilitySignals[cap] || [];
    signals.forEach(s => requiredSignals.add(s));
  }

  // Check each asset for missing required signals
  for (const asset of evidence) {
    for (const signalType of requiredSignals) {
      const signal = asset.signals.find(s => s.signalType === signalType);
      if (!signal || !signal.present) {
        // Determine severity based on impact
        let severity: 'HIGH' | 'MED' | 'LOW' = 'MED';
        if (asset.impactScore && asset.impactScore >= 80) severity = 'HIGH';
        else if (asset.impactScore && asset.impactScore < 50) severity = 'LOW';

        gaps.push({
          id: `gap_${runId}_${asset.assetGuid}_${signalType}`,
          runId,
          gapType: `MISSING_${signalType}`,
          subjectType: 'ASSET',
          subjectId: asset.assetGuid,
          subjectName: asset.assetName,
          severity,
          explanation: `Missing ${signalType.toLowerCase()} signal for ${asset.assetName}`,
          signalType
        });
      }
    }
  }

  // Sort gaps by severity
  const severityOrder = { 'HIGH': 0, 'MED': 1, 'LOW': 2 };
  gaps.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  gapsStore.set(runId, gaps);
  run.gapCount = gaps.length;
  runsStore.set(runId, run);

  return { count: gaps.length, gaps };
}

/**
 * Get gaps for a run
 */
export async function getGaps(runId: string): Promise<Gap[]> {
  return gapsStore.get(runId) || [];
}

/**
 * Generate remediation plan for a run
 */
export async function generatePlan(runId: string): Promise<PlanPhase[]> {
  const gaps = gapsStore.get(runId) || [];

  // Group gaps by signal type for workstreams
  const gapsBySignal = new Map<string, Gap[]>();
  for (const gap of gaps) {
    const signalType = gap.signalType || 'GENERAL';
    if (!gapsBySignal.has(signalType)) {
      gapsBySignal.set(signalType, []);
    }
    gapsBySignal.get(signalType)!.push(gap);
  }

  // Generate phases based on priority
  const phases: PlanPhase[] = [];

  // Phase 1: High severity gaps
  const phase1Actions: PlanAction[] = [];
  for (const [signalType, signalGaps] of gapsBySignal) {
    const highGaps = signalGaps.filter(g => g.severity === 'HIGH');
    if (highGaps.length > 0) {
      phase1Actions.push({
        workstream: signalType,
        scope: `Address ${highGaps.length} high-priority ${signalType.toLowerCase()} gaps`,
        effortBucket: highGaps.length > 10 ? 'L' : highGaps.length > 5 ? 'M' : 'S',
        explanation: `Critical ${signalType.toLowerCase()} enrichment for high-impact assets`,
        assetCount: highGaps.length
      });
    }
  }
  if (phase1Actions.length > 0) {
    phases.push({ name: 'Critical Remediation', actions: phase1Actions });
  }

  // Phase 2: Medium severity gaps
  const phase2Actions: PlanAction[] = [];
  for (const [signalType, signalGaps] of gapsBySignal) {
    const medGaps = signalGaps.filter(g => g.severity === 'MED');
    if (medGaps.length > 0) {
      phase2Actions.push({
        workstream: signalType,
        scope: `Address ${medGaps.length} medium-priority ${signalType.toLowerCase()} gaps`,
        effortBucket: medGaps.length > 20 ? 'L' : medGaps.length > 10 ? 'M' : 'S',
        explanation: `Standard ${signalType.toLowerCase()} enrichment`,
        assetCount: medGaps.length
      });
    }
  }
  if (phase2Actions.length > 0) {
    phases.push({ name: 'Standard Enrichment', actions: phase2Actions });
  }

  // Phase 3: Low severity gaps
  const phase3Actions: PlanAction[] = [];
  for (const [signalType, signalGaps] of gapsBySignal) {
    const lowGaps = signalGaps.filter(g => g.severity === 'LOW');
    if (lowGaps.length > 0) {
      phase3Actions.push({
        workstream: signalType,
        scope: `Address ${lowGaps.length} low-priority ${signalType.toLowerCase()} gaps`,
        effortBucket: 'S',
        explanation: `Optional ${signalType.toLowerCase()} enrichment`,
        assetCount: lowGaps.length
      });
    }
  }
  if (phase3Actions.length > 0) {
    phases.push({ name: 'Optional Improvements', actions: phase3Actions });
  }

  plansStore.set(runId, phases);
  return phases;
}

/**
 * Get plan for a run
 */
export async function getPlan(runId: string): Promise<PlanPhase[] | null> {
  const phases = plansStore.get(runId);
  return phases && phases.length > 0 ? phases : null;
}

/**
 * Get model for a run (placeholder - model feature)
 */
export async function getModel(runId: string): Promise<any | null> {
  // Model feature not implemented in this version
  return null;
}

/**
 * Create model from template
 */
export async function createModelFromTemplate(runId: string, templateId: string): Promise<any> {
  // Placeholder implementation
  return { id: `model_${runId}`, name: templateId, graphJson: '{"nodes":[],"edges":[]}' };
}

/**
 * Get model templates
 */
export async function getModelTemplates(): Promise<any[]> {
  return [
    { id: 'data_mesh', name: 'Data Mesh', description: 'Domain-oriented data architecture' },
    { id: 'data_warehouse', name: 'Data Warehouse', description: 'Traditional centralized architecture' },
    { id: 'lakehouse', name: 'Lakehouse', description: 'Combined data lake and warehouse' }
  ];
}

/**
 * Generate artifacts (exports)
 */
export async function generateArtifacts(runId: string): Promise<{ type: string; format: string }[]> {
  return [
    { type: 'READINESS', format: 'markdown' },
    { type: 'GAPS', format: 'markdown' },
    { type: 'PLAN', format: 'markdown' }
  ];
}

/**
 * Get artifacts for a run
 */
export async function getArtifacts(runId: string): Promise<{ type: string; format: string }[]> {
  return [
    { type: 'READINESS', format: 'markdown' },
    { type: 'GAPS', format: 'markdown' },
    { type: 'PLAN', format: 'markdown' }
  ];
}

/**
 * Get artifact content
 */
export async function getArtifactContent(runId: string, type: string): Promise<string> {
  const run = runsStore.get(runId);
  const gaps = gapsStore.get(runId) || [];
  const plan = plansStore.get(runId) || [];
  const evidence = evidenceStore.get(runId) || [];

  if (type === 'READINESS') {
    return `# Assessment Readiness Report

## Run Summary
- **Run ID**: ${runId}
- **Created**: ${run?.createdAt || 'N/A'}
- **Status**: ${run?.status || 'N/A'}
- **Assets Scanned**: ${evidence.length}
- **Gaps Found**: ${gaps.length}

## Selected Capabilities
${run?.selectedCapabilities.map(c => `- ${c}`).join('\n') || 'None selected'}

## Quality Overview
${evidence.length > 0 ? `
- High Quality Assets: ${evidence.filter(a => (a.qualityScore || 0) >= 70).length}
- Medium Quality Assets: ${evidence.filter(a => (a.qualityScore || 0) >= 40 && (a.qualityScore || 0) < 70).length}
- Low Quality Assets: ${evidence.filter(a => (a.qualityScore || 0) < 40).length}
` : 'No assets assessed'}
`;
  }

  if (type === 'GAPS') {
    return `# Gap Analysis Report

## Summary
- **Total Gaps**: ${gaps.length}
- **High Severity**: ${gaps.filter(g => g.severity === 'HIGH').length}
- **Medium Severity**: ${gaps.filter(g => g.severity === 'MED').length}
- **Low Severity**: ${gaps.filter(g => g.severity === 'LOW').length}

## Gaps by Signal Type
${Array.from(new Set(gaps.map(g => g.signalType))).map(signal => {
  const signalGaps = gaps.filter(g => g.signalType === signal);
  return `### ${signal}
- Count: ${signalGaps.length}
${signalGaps.slice(0, 5).map(g => `  - ${g.subjectName}: ${g.explanation}`).join('\n')}
${signalGaps.length > 5 ? `  - ...and ${signalGaps.length - 5} more` : ''}`;
}).join('\n\n')}
`;
  }

  if (type === 'PLAN') {
    return `# Remediation Plan

${plan.map((phase, i) => `## Phase ${i + 1}: ${phase.name}

${phase.actions.map(a => `### ${a.workstream}
- **Scope**: ${a.scope}
- **Effort**: ${a.effortBucket}
- **Assets**: ${a.assetCount || 'N/A'}
${a.explanation ? `- **Details**: ${a.explanation}` : ''}
`).join('\n')}`).join('\n\n')}
`;
  }

  return `# Unknown Artifact Type: ${type}`;
}
