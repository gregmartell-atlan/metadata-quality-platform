/**
 * Connector Health Matrix Widget
 * Quality scores by connector type with asset counts
 */

import { useMemo } from 'react';
import { Database } from 'lucide-react';
import { WidgetWrapper } from './WidgetWrapper';
import type { WidgetProps } from './registry';
import { useScoresStore } from '../../../stores/scoresStore';
import { ScoreBadge } from '../../shared/ScoreBadge';

export function ConnectorHealthWidget({ widgetId, widgetType, isEditMode }: WidgetProps) {
  const { assetsWithScores } = useScoresStore();

  const connectorStats = useMemo(() => {
    const connectorMap = new Map<string, any[]>();

    assetsWithScores.forEach(asset => {
      const connector = asset.connectorName || asset.connectionName || 'Unknown';
      if (!connectorMap.has(connector)) {
        connectorMap.set(connector, []);
      }
      connectorMap.get(connector)!.push(asset);
    });

    return Array.from(connectorMap.entries()).map(([connector, assets]) => {
      const scores = assets.map(a => a.score || 0);
      const avgScore = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;

      return {
        connector,
        assetCount: assets.length,
        avgScore: Math.round(avgScore),
        withOwner: assets.filter(a => a.ownerUsers && a.ownerUsers.length > 0).length,
        certified: assets.filter(a => a.certificateStatus === 'VERIFIED').length
      };
    }).sort((a, b) => b.avgScore - a.avgScore);
  }, [assetsWithScores]);

  return (
    <WidgetWrapper
      title="Connector Health Matrix"
      widgetId={widgetId}
      widgetType={widgetType || 'connector-health'}
      isEditMode={isEditMode || false}
    >
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
              <th style={{ padding: '8px', textAlign: 'left', fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>Connector</th>
              <th style={{ padding: '8px', textAlign: 'center', fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>Assets</th>
              <th style={{ padding: '8px', textAlign: 'center', fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>Health</th>
              <th style={{ padding: '8px', textAlign: 'center', fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>Owner%</th>
              <th style={{ padding: '8px', textAlign: 'center', fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>Cert%</th>
            </tr>
          </thead>
          <tbody>
            {connectorStats.map((conn) => (
              <tr key={conn.connector} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                <td style={{ padding: '10px 8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Database size={14} color="var(--accent-primary)" />
                    <span style={{ fontSize: '13px', fontWeight: 500 }}>{conn.connector}</span>
                  </div>
                </td>
                <td style={{ padding: '10px 8px', textAlign: 'center', fontSize: '13px' }}>{conn.assetCount}</td>
                <td style={{ padding: '10px 8px', textAlign: 'center' }}>
                  <ScoreBadge score={conn.avgScore} showLabel={false} />
                </td>
                <td style={{ padding: '10px 8px', textAlign: 'center', fontSize: '12px' }}>
                  {Math.round((conn.withOwner / conn.assetCount) * 100)}%
                </td>
                <td style={{ padding: '10px 8px', textAlign: 'center', fontSize: '12px' }}>
                  {Math.round((conn.certified / conn.assetCount) * 100)}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </WidgetWrapper>
  );
}
