/**
 * Data Quality Trends Widget
 * Shows historical quality scores across 5 dimensions over 90 days
 */

import { useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { WidgetWrapper } from './WidgetWrapper';
import type { WidgetProps } from './registry';

export function DataQualityTrendsWidget({ widgetId, isEditMode }: WidgetProps) {
  // Generate 90-day trend data
  const trendData = useMemo(() => {
    const days = 90;
    const data = [];
    const today = new Date();

    for (let i = days; i >= 0; i -= 7) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);

      // Mock trend - replace with real historical data from API
      data.push({
        date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        completeness: 65 + Math.random() * 15,
        accuracy: 58 + Math.random() * 12,
        timeliness: 70 + Math.random() * 10,
        consistency: 55 + Math.random() * 20,
        usability: 62 + Math.random() * 18
      });
    }

    return data;
  }, []);

  return (
    <WidgetWrapper
      title="Data Quality Trends (90 Days)"
      widgetId={widgetId}
      isEditMode={isEditMode || false}
    >
      <div style={{ width: '100%', height: '100%', minHeight: 250 }}>
        <ResponsiveContainer>
          <LineChart data={trendData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
            <XAxis
              dataKey="date"
              stroke="var(--text-muted)"
              style={{ fontSize: '11px' }}
            />
            <YAxis
              stroke="var(--text-muted)"
              style={{ fontSize: '11px' }}
              domain={[0, 100]}
            />
            <Tooltip
              contentStyle={{
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border-color)',
                borderRadius: '6px'
              }}
            />
            <Legend />
            <Line type="monotone" dataKey="completeness" stroke="#22c55e" strokeWidth={2} dot={false} name="Completeness" />
            <Line type="monotone" dataKey="accuracy" stroke="#3b82f6" strokeWidth={2} dot={false} name="Accuracy" />
            <Line type="monotone" dataKey="timeliness" stroke="#a855f7" strokeWidth={2} dot={false} name="Timeliness" />
            <Line type="monotone" dataKey="consistency" stroke="#f59e0b" strokeWidth={2} dot={false} name="Consistency" />
            <Line type="monotone" dataKey="usability" stroke="#ec4899" strokeWidth={2} dot={false} name="Usability" />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </WidgetWrapper>
  );
}
