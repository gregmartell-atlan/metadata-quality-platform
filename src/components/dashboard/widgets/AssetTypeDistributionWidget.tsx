/**
 * Asset Type Distribution Widget
 * Pie chart showing breakdown of assets by type
 */

import { useMemo } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { WidgetWrapper } from './WidgetWrapper';
import type { WidgetProps } from './registry';
import { useScoresStore } from '../../../stores/scoresStore';

const COLORS = ['#00d4aa', '#3b82f6', '#a855f7', '#f59e0b', '#ec4899', '#14b8a6', '#8b5cf6', '#06b6d4'];

export function AssetTypeDistributionWidget({ widgetId, widgetType, isEditMode }: WidgetProps) {
  const { byAssetType } = useScoresStore();

  const chartData = useMemo(() => {
    return Array.from(byAssetType.entries())
      .map(([type, assets]) => ({
        name: type,
        value: assets.length
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8); // Top 8 types
  }, [byAssetType]);

  return (
    <WidgetWrapper
      title="Asset Type Distribution"
      widgetId={widgetId}
      widgetType={widgetType || 'asset-type-distribution'}
      isEditMode={isEditMode || false}
    >
      {chartData.length > 0 ? (
        <div style={{ width: '100%', height: '100%', minHeight: 250 }}>
          <ResponsiveContainer>
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={90}
                fill="#8884d8"
                paddingAngle={2}
                dataKey="value"
                label={(entry) => `${entry.name}: ${entry.value}`}
                labelLine={{ stroke: 'var(--text-muted)' }}
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '6px'
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
          No asset data available
        </div>
      )}
    </WidgetWrapper>
  );
}
