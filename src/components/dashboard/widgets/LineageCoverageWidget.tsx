/**
 * Lineage Coverage Gauge Widget
 * Assets with lineage vs without, with upstream/downstream breakdown
 */

import { useMemo } from 'react';
import { GitBranch, ArrowUp, ArrowDown, AlertCircle } from 'lucide-react';
import { WidgetWrapper } from './WidgetWrapper';
import type { WidgetProps } from './registry';
import { useScoresStore } from '../../../stores/scoresStore';

export function LineageCoverageWidget({ widgetId, isEditMode }: WidgetProps) {
  const { assetsWithScores } = useScoresStore();

  const lineageStats = useMemo(() => {
    const withLineage = assetsWithScores.filter(a => a.__hasLineage).length;
    const total = assetsWithScores.length;
    const coverage = total > 0 ? Math.round((withLineage / total) * 100) : 0;

    // Mock upstream/downstream counts (in production, get from lineage API)
    const withUpstream = Math.floor(withLineage * 0.7);
    const withDownstream = Math.floor(withLineage * 0.8);
    const bidirectional = Math.floor(withLineage * 0.5);

    return {
      withLineage,
      withoutLineage: total - withLineage,
      total,
      coverage,
      withUpstream,
      withDownstream,
      bidirectional
    };
  }, [assetsWithScores]);

  return (
    <WidgetWrapper
      title="Lineage Coverage"
      widgetId={widgetId}
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

        {/* Upstream/Downstream breakdown */}
        <div style={{ display: 'flex', gap: '12px' }}>
          <div style={{ flex: 1, padding: '12px', background: 'var(--bg-tertiary)', borderRadius: '6px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
              <ArrowUp size={14} color="var(--accent-primary)" />
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Upstream</span>
            </div>
            <div style={{ fontSize: '18px', fontWeight: 'bold' }}>{lineageStats.withUpstream}</div>
          </div>
          <div style={{ flex: 1, padding: '12px', background: 'var(--bg-tertiary)', borderRadius: '6px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
              <ArrowDown size={14} color="var(--accent-secondary)" />
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Downstream</span>
            </div>
            <div style={{ fontSize: '18px', fontWeight: 'bold' }}>{lineageStats.withDownstream}</div>
          </div>
          <div style={{ flex: 1, padding: '12px', background: 'var(--bg-tertiary)', borderRadius: '6px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
              <GitBranch size={14} color="var(--score-excellent)" />
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Both</span>
            </div>
            <div style={{ fontSize: '18px', fontWeight: 'bold' }}>{lineageStats.bidirectional}</div>
          </div>
        </div>
      </div>
    </WidgetWrapper>
  );
}
