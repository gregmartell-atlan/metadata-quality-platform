/**
 * Plan Engine
 *
 * Generates 3-phase remediation plans from detected gaps.
 * Creates MVP, Expanded, and Hardening phases based on gap severity.
 *
 * Ported from atlan-metadata-evaluation/assessment/packages/domain/src/engines/plan-engine.ts
 */

import {
  RemediationPlan,
  Phase,
  WorkstreamActions,
  Action,
  PhaseName,
  Workstream,
  Gap,
  GapSeverity,
  computeEffortBucket,
  getWorkstreamName,
  getWorkstreamDescription,
  getPhaseDescription,
  createActionId,
} from './types';

/**
 * Plan generation engine
 * Creates 3-phase remediation plans from detected gaps
 */
export class PlanEngine {
  /**
   * Generates a complete remediation plan from gaps
   */
  generatePlan(
    capabilityId: string,
    scopeId: string,
    gaps: Gap[]
  ): RemediationPlan {
    // Group gaps by severity and workstream
    const gapsByPriority = this.groupGapsByPriority(gaps);

    // Generate three phases
    const phases: Phase[] = [
      this.generateMVPPhase(gapsByPriority),
      this.generateExpandedPhase(gapsByPriority),
      this.generateHardeningPhase(gapsByPriority),
    ];

    // Compute summary statistics
    const summary = this.computePlanSummary(phases);

    return {
      capabilityId,
      scopeId,
      generatedAt: new Date().toISOString(),
      phases,
      summary,
    };
  }

  /**
   * Phase 1 (MVP): Address highest severity gaps on highest impact assets
   * - HIGH severity gaps
   * - Prioritize OWNERSHIP and SEMANTICS workstreams
   * - Focus on smallest gap counts first (quick wins)
   */
  private generateMVPPhase(
    gapsByPriority: PriorityGroupedGaps
  ): Phase {
    const highSeverityGaps = gapsByPriority.HIGH;

    // Group by workstream
    const gapsByWorkstream = this.groupGapsByWorkstream(highSeverityGaps);

    // Prioritize OWNERSHIP and SEMANTICS
    const priorityWorkstreams: Workstream[] = ['OWNERSHIP', 'SEMANTICS'];
    const otherWorkstreams: Workstream[] = [
      'LINEAGE',
      'SENSITIVITY_ACCESS',
      'QUALITY_FRESHNESS',
    ];

    const workstreams: WorkstreamActions[] = [];

    // Add priority workstreams first
    for (const ws of priorityWorkstreams) {
      const wsGaps = gapsByWorkstream.get(ws) || [];
      if (wsGaps.length > 0) {
        workstreams.push(this.createWorkstreamActions('MVP', ws, wsGaps));
      }
    }

    // Add other workstreams (only if gaps exist and effort <= M)
    for (const ws of otherWorkstreams) {
      const wsGaps = gapsByWorkstream.get(ws) || [];
      if (wsGaps.length > 0 && wsGaps.length <= 20) {
        // Only include if not too large
        workstreams.push(this.createWorkstreamActions('MVP', ws, wsGaps));
      }
    }

    return {
      name: 'MVP',
      description: getPhaseDescription('MVP'),
      workstreams,
      totalActions: this.countActions(workstreams),
      totalAssets: this.countAssets(workstreams),
      totalGaps: this.countGaps(workstreams),
    };
  }

  /**
   * Phase 2 (Expanded): Expand coverage to medium severity gaps
   * - MED severity gaps
   * - All workstreams
   * - Broaden asset coverage
   */
  private generateExpandedPhase(
    gapsByPriority: PriorityGroupedGaps
  ): Phase {
    const medSeverityGaps = gapsByPriority.MED;

    // Group by workstream
    const gapsByWorkstream = this.groupGapsByWorkstream(medSeverityGaps);

    const workstreams: WorkstreamActions[] = [];

    // Add all workstreams with MED severity gaps
    const allWorkstreams: Workstream[] = [
      'OWNERSHIP',
      'SEMANTICS',
      'LINEAGE',
      'SENSITIVITY_ACCESS',
      'QUALITY_FRESHNESS',
    ];

    for (const ws of allWorkstreams) {
      const wsGaps = gapsByWorkstream.get(ws) || [];
      if (wsGaps.length > 0) {
        workstreams.push(this.createWorkstreamActions('Expanded', ws, wsGaps));
      }
    }

    return {
      name: 'Expanded',
      description: getPhaseDescription('Expanded'),
      workstreams,
      totalActions: this.countActions(workstreams),
      totalAssets: this.countAssets(workstreams),
      totalGaps: this.countGaps(workstreams),
    };
  }

  /**
   * Phase 3 (Hardening): Address remaining gaps and quality hardening
   * - LOW severity gaps
   * - Focus on QUALITY_FRESHNESS workstream
   * - Establish monitoring
   */
  private generateHardeningPhase(
    gapsByPriority: PriorityGroupedGaps
  ): Phase {
    const lowSeverityGaps = gapsByPriority.LOW;

    // Group by workstream
    const gapsByWorkstream = this.groupGapsByWorkstream(lowSeverityGaps);

    const workstreams: WorkstreamActions[] = [];

    // Prioritize QUALITY_FRESHNESS in hardening phase
    const priorityWorkstreams: Workstream[] = ['QUALITY_FRESHNESS'];
    const otherWorkstreams: Workstream[] = [
      'OWNERSHIP',
      'SEMANTICS',
      'LINEAGE',
      'SENSITIVITY_ACCESS',
    ];

    for (const ws of priorityWorkstreams) {
      const wsGaps = gapsByWorkstream.get(ws) || [];
      if (wsGaps.length > 0) {
        workstreams.push(this.createWorkstreamActions('Hardening', ws, wsGaps));
      }
    }

    for (const ws of otherWorkstreams) {
      const wsGaps = gapsByWorkstream.get(ws) || [];
      if (wsGaps.length > 0) {
        workstreams.push(this.createWorkstreamActions('Hardening', ws, wsGaps));
      }
    }

    return {
      name: 'Hardening',
      description: getPhaseDescription('Hardening'),
      workstreams,
      totalActions: this.countActions(workstreams),
      totalAssets: this.countAssets(workstreams),
      totalGaps: this.countGaps(workstreams),
    };
  }

  /**
   * Creates workstream actions from gaps
   */
  private createWorkstreamActions(
    phase: PhaseName,
    workstream: Workstream,
    gaps: Gap[]
  ): WorkstreamActions {
    // Group gaps by signal type to create actions
    const gapsBySignal = new Map<string, Gap[]>();

    for (const gap of gaps) {
      const signal = gap.signalType;
      if (!gapsBySignal.has(signal)) {
        gapsBySignal.set(signal, []);
      }
      gapsBySignal.get(signal)!.push(gap);
    }

    // Create actions
    const actions: Action[] = [];
    let actionIndex = 0;

    for (const [signal, signalGaps] of gapsBySignal.entries()) {
      const action = this.createAction(
        phase,
        workstream,
        signal,
        signalGaps,
        actionIndex++
      );
      actions.push(action);
    }

    return {
      workstream,
      name: getWorkstreamName(workstream),
      description: getWorkstreamDescription(workstream),
      actions,
      totalAssetCount: this.sumAssetCounts(actions),
      totalGapsAddressed: this.sumGapsAddressed(actions),
    };
  }

  /**
   * Creates a single action from gaps
   */
  private createAction(
    phase: PhaseName,
    workstream: Workstream,
    signal: string,
    gaps: Gap[],
    index: number
  ): Action {
    // Collect unique asset IDs
    const assetIds = Array.from(new Set(gaps.map((g) => g.subjectId)));

    // Generate action description
    const description = this.generateActionDescription(signal, gaps);

    // Compute effort bucket
    const effortBucket = computeEffortBucket(assetIds.length);

    // Expected effect: gap IDs that will close
    const expectedEffect = gaps.map((g) => g.id);

    return {
      id: createActionId(workstream, phase, index),
      workstream,
      description,
      scope: assetIds,
      assetCount: assetIds.length,
      effortBucket,
      expectedEffect,
      gapsAddressed: gaps.length,
      priority: index,
    };
  }

  /**
   * Generates action description
   */
  private generateActionDescription(signal: string, gaps: Gap[]): string {
    const assetCount = new Set(gaps.map((g) => g.subjectId)).size;
    const gapType = gaps[0].gapType;

    if (gapType === 'MISSING') {
      return `Add ${signal.toLowerCase()} to ${assetCount} asset${assetCount > 1 ? 's' : ''}`;
    }

    if (gapType === 'UNKNOWN') {
      return `Investigate ${signal.toLowerCase()} availability for ${assetCount} asset${assetCount > 1 ? 's' : ''}`;
    }

    return `Address ${signal.toLowerCase()} gaps for ${assetCount} asset${assetCount > 1 ? 's' : ''}`;
  }

  /**
   * Groups gaps by severity
   */
  private groupGapsByPriority(gaps: Gap[]): PriorityGroupedGaps {
    const grouped: PriorityGroupedGaps = {
      HIGH: [],
      MED: [],
      LOW: [],
    };

    for (const gap of gaps) {
      grouped[gap.severity].push(gap);
    }

    return grouped;
  }

  /**
   * Groups gaps by workstream
   */
  private groupGapsByWorkstream(gaps: Gap[]): Map<Workstream, Gap[]> {
    const grouped = new Map<Workstream, Gap[]>();

    for (const gap of gaps) {
      if (!grouped.has(gap.workstream)) {
        grouped.set(gap.workstream, []);
      }
      grouped.get(gap.workstream)!.push(gap);
    }

    return grouped;
  }

  /**
   * Computes plan summary statistics
   */
  private computePlanSummary(phases: Phase[]) {
    let totalActions = 0;
    let totalAssets = 0;
    let totalGaps = 0;

    const phaseDistribution: Record<PhaseName, number> = {
      MVP: 0,
      Expanded: 0,
      Hardening: 0,
    };

    for (const phase of phases) {
      totalActions += phase.totalActions;
      totalAssets += phase.totalAssets;
      totalGaps += phase.totalGaps;
      phaseDistribution[phase.name] = phase.totalActions;
    }

    return {
      totalActions,
      totalAssets,
      totalGaps,
      phaseDistribution,
    };
  }

  /**
   * Helper methods for counting
   */
  private countActions(workstreams: WorkstreamActions[]): number {
    return workstreams.reduce((sum, ws) => sum + ws.actions.length, 0);
  }

  private countAssets(workstreams: WorkstreamActions[]): number {
    return workstreams.reduce((sum, ws) => sum + ws.totalAssetCount, 0);
  }

  private countGaps(workstreams: WorkstreamActions[]): number {
    return workstreams.reduce((sum, ws) => sum + ws.totalGapsAddressed, 0);
  }

  private sumAssetCounts(actions: Action[]): number {
    return actions.reduce((sum, action) => sum + action.assetCount, 0);
  }

  private sumGapsAddressed(actions: Action[]): number {
    return actions.reduce((sum, action) => sum + action.gapsAddressed, 0);
  }
}

/**
 * Internal type for priority-grouped gaps
 */
interface PriorityGroupedGaps {
  HIGH: Gap[];
  MED: Gap[];
  LOW: Gap[];
}
