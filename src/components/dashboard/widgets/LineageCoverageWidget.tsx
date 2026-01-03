/**
 * Lineage Coverage Gauge Widget
 * Assets with lineage vs without, with upstream/downstream breakdown
 */

import { useMemo } from 'react';
import { GitBranch, AlertCircle } from 'lucide-react';
import { WidgetWrapper } from './WidgetWrapper';
import type { WidgetProps } from './registry';
import { useScoresStore } from '../../../stores/scoresStore';

export function LineageCoverageWidget({ widgetId, widgetType, isEditMode }: WidgetProps) {
  const { assetsWithScores } = useScoresStore();

  const lineageStats = useMemo(() => {
    // Count assets with lineage flag set
    const withLineage = assetsWithScores.filter(a => {
      // Access __hasLineage from the asset or metadata depending on structure
      const asset = a as any;
      return asset.__hasLineage === true || asset.asset?.__hasLineage === true;
    }).length;
    const total = assetsWithScores.length;
    const coverage = total > 0 ? Math.round((withLineage / total) * 100) : 0;

    return {
      withLineage,
      withoutLineage: total - withLineage,
      total,
      coverage
    };
  }, [assetsWithScores]);

  return (
    <WidgetWrapper
      title="Lineage Coverage"
      widgetId={widgetId}
      widgetType={widgetType || 'lineage-coverage'}
      isEditMode={isEditMode || false}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {/* Main gauge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{
            width: '80px',
            height: '80px',
            borderRadius: '50%',
            background: `conic-gradient(var(--accent-primary) 0% ${lineageStats.coverage}%, var(--bg-tertiary) ${lineageStats.coverage}% 100%)`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative'
          }}>
            <div style={{
              width: '60px',
              height: '60px',
              borderRadius: '50%',
              background: 'var(--bg-secondary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '18px',
              fontWeight: 'bold'
            }}>
              {lineageStats.coverage}%
            </div>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: 'var(--accent-primary)' }}>
              {lineageStats.withLineage}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              assets with lineage
            </div>
            <div style={{ fontSize: '12px', color: 'var(--score-critical)', marginTop: '4px' }}>
              {lineageStats.withoutLineage} without
            </div>
          </div>
        </div>

        {/* Stats breakdown */}
        <div style={{ display: 'flex', gap: '12px' }}>
          <div style={{ flex: 1, padding: '12px', background: 'var(--bg-tertiary)', borderRadius: '6px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
              <GitBranch size={14} color="var(--score-excellent)" />
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Connected</span>
            </div>
            <div style={{ fontSize: '18px', fontWeight: 'bold' }}>{lineageStats.withLineage}</div>
          </div>
          <div style={{ flex: 1, padding: '12px', background: 'var(--bg-tertiary)', borderRadius: '6px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
              <AlertCircle size={14} color="var(--score-critical)" />
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Orphaned</span>
            </div>
            <div style={{ fontSize: '18px', fontWeight: 'bold' }}>{lineageStats.withoutLineage}</div>
          </div>
          <div style={{ flex: 1, padding: '12px', background: 'var(--bg-tertiary)', borderRadius: '6px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Total</span>
            </div>
            <div style={{ fontSize: '18px', fontWeight: 'bold' }}>{lineageStats.total}</div>
          </div>
        </div>
      </div>
    </WidgetWrapper>
  );
}
