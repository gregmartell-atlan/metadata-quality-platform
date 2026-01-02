/**
 * Data Quality Trends Widget
 * Shows historical quality scores across 5 dimensions from snapshots and daily aggregations
 */

import { useMemo, useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { WidgetWrapper } from './WidgetWrapper';
import { useQualitySnapshotStore } from '../../../stores/qualitySnapshotStore';
import { useScoresStore } from '../../../stores/scoresStore';
import { storageService } from '../../../services/storage';
import type { DailyAggregation } from '../../../services/storage';
import type { WidgetProps } from './registry';

export function DataQualityTrendsWidget({ widgetId, widgetType, isEditMode }: WidgetProps) {
  const { snapshots } = useQualitySnapshotStore();
  const { assetsWithScores } = useScoresStore();
  const [dailyAggregations, setDailyAggregations] = useState<DailyAggregation[]>([]);

  // Load historical daily aggregations on mount
  useEffect(() => {
    const loadTrendData = async () => {
      try {
        const aggregations = await storageService.getRecentTrend(90);
        setDailyAggregations(aggregations);
        console.log('[DataQualityTrendsWidget] Loaded', aggregations.length, 'daily aggregations');
      } catch (error) {
        console.error('[DataQualityTrendsWidget] Failed to load trend data:', error);
      }
    };
    loadTrendData();
  }, []);

  // Build trend data from daily aggregations, snapshots, and current state
  const trendData = useMemo(() => {
    const data: Array<{
      date: string;
      timestamp: number;
      completeness: number;
      accuracy: number;
      timeliness: number;
      consistency: number;
      usability: number;
    }> = [];

    // Create a map to deduplicate by date
    const byDate = new Map<string, {
      timestamp: number;
      completeness: number;
      accuracy: number;
      timeliness: number;
      consistency: number;
      usability: number;
    }>();

    // Add daily aggregations from storage (these are the persistent historical data)
    dailyAggregations.forEach((agg) => {
      byDate.set(agg.date, {
        timestamp: agg.timestamp,
        completeness: agg.scores.completeness,
        accuracy: agg.scores.accuracy,
        timeliness: agg.scores.timeliness,
        consistency: agg.scores.consistency,
        usability: agg.scores.usability,
      });
    });

    // Add snapshots (these may have more granular data)
    snapshots.forEach((snapshot) => {
      const dateStr = new Date(snapshot.timestamp).toISOString().split('T')[0];
      // Only use snapshot if we don't have a daily aggregation for that date
      if (!byDate.has(dateStr)) {
        byDate.set(dateStr, {
          timestamp: snapshot.timestamp,
          completeness: snapshot.overallScores.completeness,
          accuracy: snapshot.overallScores.accuracy,
          timeliness: snapshot.overallScores.timeliness,
          consistency: snapshot.overallScores.consistency,
          usability: snapshot.overallScores.usability,
        });
      }
    });

    // Convert map to sorted array
    const sortedDates = [...byDate.entries()]
      .sort((a, b) => a[1].timestamp - b[1].timestamp);

    sortedDates.forEach(([dateStr, scores]) => {
      data.push({
        date: new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        ...scores,
      });
    });

    // Add current scores if we have assets loaded
    if (assetsWithScores.length > 0) {
      const currentScores = assetsWithScores.reduce(
        (acc, { scores }) => ({
          completeness: acc.completeness + scores.completeness,
          accuracy: acc.accuracy + scores.accuracy,
          timeliness: acc.timeliness + scores.timeliness,
          consistency: acc.consistency + scores.consistency,
          usability: acc.usability + scores.usability,
        }),
        { completeness: 0, accuracy: 0, timeliness: 0, consistency: 0, usability: 0 }
      );

      const count = assetsWithScores.length;
      const now = Date.now();

      // Only add current if it's different from last data point
      const lastDataPoint = data[data.length - 1];
      if (!lastDataPoint || now - lastDataPoint.timestamp > 60000) {
        data.push({
          date: 'Now',
          timestamp: now,
          completeness: Math.round(currentScores.completeness / count),
          accuracy: Math.round(currentScores.accuracy / count),
          timeliness: Math.round(currentScores.timeliness / count),
          consistency: Math.round(currentScores.consistency / count),
          usability: Math.round(currentScores.usability / count),
        });
      }
    }

    return data;
  }, [dailyAggregations, snapshots, assetsWithScores]);

  const hasData = trendData.length > 0;

  return (
    <WidgetWrapper
      title="Data Quality Trends"
      widgetId={widgetId}
      widgetType={widgetType || 'data-quality-trends'}
      isEditMode={isEditMode || false}
    >
      <div style={{ width: '100%', height: '100%', minHeight: 250 }}>
        {!hasData ? (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            color: 'var(--text-muted)',
            textAlign: 'center',
            padding: '20px'
          }}>
            <p style={{ marginBottom: '8px' }}>No trend data yet</p>
            <p style={{ fontSize: '12px' }}>
              Capture snapshots to track quality over time
            </p>
          </div>
        ) : (
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
        )}
      </div>
    </WidgetWrapper>
  );
}
