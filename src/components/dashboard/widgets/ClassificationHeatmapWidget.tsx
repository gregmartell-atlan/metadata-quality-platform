/**
 * Classification Heatmap Widget
 * Asset breakdown by classification tags across connections
 */

import { useMemo } from 'react';
import { WidgetWrapper } from './WidgetWrapper';
import type { WidgetProps } from './registry';
import { useScoresStore } from '../../../stores/scoresStore';

export function ClassificationHeatmapWidget({ widgetId, widgetType, isEditMode }: WidgetProps) {
  const { byClassification, assetsWithScores } = useScoresStore();

  const heatmapData = useMemo(() => {
    // Get top classifications
    const topClassifications = Array.from(byClassification.entries())
      .sort((a, b) => b[1].length - a[1].length)
      .slice(0, 6)
      .map(([name]) => name);

    // Get connections
    const connections = new Set(assetsWithScores.map(a => a.connectionName).filter(Boolean));
    const topConnections = Array.from(connections).slice(0, 5);

    // Build matrix
    const matrix = topConnections.map(connection => {
      const row: any = { connection };
      topClassifications.forEach(classification => {
        const count = assetsWithScores.filter(a =>
          a.connectionName === connection &&
          a.classificationNames?.includes(classification)
        ).length;
        row[classification] = count;
      });
      return row;
    });

    return { matrix, classifications: topClassifications };
  }, [byClassification, assetsWithScores]);

  const maxCount = Math.max(...heatmapData.matrix.flatMap(row =>
    heatmapData.classifications.map(c => row[c] || 0)
  ), 1);

  return (
    <WidgetWrapper
      title="Classification Heatmap"
      widgetId={widgetId}
      widgetType={widgetType || 'classification-heatmap'}
      isEditMode={isEditMode || false}
    >
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
          <thead>
            <tr>
              <th style={{ padding: '8px', textAlign: 'left', borderBottom: '1px solid var(--border-color)' }}>Connection</th>
              {heatmapData.classifications.map(c => (
                <th key={c} style={{ padding: '8px', textAlign: 'center', borderBottom: '1px solid var(--border-color)' }}>
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {heatmapData.matrix.map(row => (
              <tr key={row.connection}>
                <td style={{ padding: '8px', fontWeight: 500, borderBottom: '1px solid var(--border-subtle)' }}>
                  {row.connection}
                </td>
                {heatmapData.classifications.map(c => {
                  const count = row[c] || 0;
                  const intensity = count / maxCount;
                  const bgColor = `rgba(0, 212, 170, ${intensity * 0.8})`;

                  return (
                    <td key={c} style={{
                      padding: '8px',
                      textAlign: 'center',
                      background: count > 0 ? bgColor : 'transparent',
                      borderBottom: '1px solid var(--border-subtle)',
                      fontWeight: count > 0 ? 'bold' : 'normal',
                      color: intensity > 0.5 ? 'white' : 'var(--text-primary)'
                    }}>
                      {count || '-'}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </WidgetWrapper>
  );
}
