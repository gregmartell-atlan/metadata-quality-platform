/**
 * Domain Coverage Matrix Widget
 * Quality scores broken down by data domain
 */

import { useMemo } from 'react';
import { WidgetWrapper } from './WidgetWrapper';
import type { WidgetProps } from './registry';
import { useScoresStore } from '../../../stores/scoresStore';
import { ScoreBadge } from '../../shared/ScoreBadge';

export function DomainCoverageWidget({ widgetId, widgetType, isEditMode }: WidgetProps) {
  const { byDomain } = useScoresStore();

  const domainStats = useMemo(() => {
    return Array.from(byDomain.entries()).map(([domain, assets]) => {
      const scores = assets.map(a => a.score || 0);
      const avgScore = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;

      return {
        domain: domain || 'Unassigned',
        assetCount: assets.length,
        avgScore: Math.round(avgScore),
        withOwner: assets.filter(a => a.ownerUsers && a.ownerUsers.length > 0).length,
        withDescription: assets.filter(a => a.description || a.userDescription).length,
        certified: assets.filter(a => a.certificateStatus === 'VERIFIED').length
      };
    }).sort((a, b) => b.avgScore - a.avgScore);
  }, [byDomain]);

  return (
    <WidgetWrapper
      title="Domain Coverage Matrix"
      widgetId={widgetId}
      widgetType={widgetType || 'domain-coverage'}
      isEditMode={isEditMode || false}
    >
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
              <th style={{ padding: '8px', textAlign: 'left', fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>Domain</th>
              <th style={{ padding: '8px', textAlign: 'center', fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>Assets</th>
              <th style={{ padding: '8px', textAlign: 'center', fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>Score</th>
              <th style={{ padding: '8px', textAlign: 'center', fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>Owner%</th>
              <th style={{ padding: '8px', textAlign: 'center', fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>Desc%</th>
              <th style={{ padding: '8px', textAlign: 'center', fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>Cert%</th>
            </tr>
          </thead>
          <tbody>
            {domainStats.map((domain) => (
              <tr key={domain.domain} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                <td style={{ padding: '10px 8px', fontSize: '13px', fontWeight: 500 }}>{domain.domain}</td>
                <td style={{ padding: '10px 8px', textAlign: 'center', fontSize: '13px' }}>{domain.assetCount}</td>
                <td style={{ padding: '10px 8px', textAlign: 'center' }}>
                  <ScoreBadge score={domain.avgScore} showLabel={false} />
                </td>
                <td style={{ padding: '10px 8px', textAlign: 'center', fontSize: '12px' }}>
                  {Math.round((domain.withOwner / domain.assetCount) * 100)}%
                </td>
                <td style={{ padding: '10px 8px', textAlign: 'center', fontSize: '12px' }}>
                  {Math.round((domain.withDescription / domain.assetCount) * 100)}%
                </td>
                <td style={{ padding: '10px 8px', textAlign: 'center', fontSize: '12px' }}>
                  {Math.round((domain.certified / domain.assetCount) * 100)}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </WidgetWrapper>
  );
}
