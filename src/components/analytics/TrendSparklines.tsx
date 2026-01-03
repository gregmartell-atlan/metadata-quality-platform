/**
 * TrendSparklines - Quality Dimension Mini-Trends
 *
 * Shows mini trend charts for each quality dimension.
 * Useful for quickly seeing which dimensions are improving or declining.
 */

import { memo, useMemo } from 'react';
import { TrendingUp, TrendingDown, Minus, ArrowRight } from 'lucide-react';
import { LineChart, Line, ResponsiveContainer, Tooltip } from 'recharts';
import { InfoTooltip } from '../shared';
import { getScoreBand } from '../../utils/scoreThresholds';
import type { AssetWithScores } from '../../stores/scoresStore';
import './TrendSparklines.css';

interface TrendSparklinesProps {
  assets: AssetWithScores[];
  /**
   * Number of time periods to simulate (for demo purposes).
   * In production, this would come from historical data.
   */
  periods?: number;
}

interface DimensionTrend {
  dimension: string;
  label: string;
  current: number;
  previous: number;
  change: number;
  trend: 'up' | 'down' | 'stable';
  data: { period: number; value: number }[];
  color: string;
}

const DIMENSION_CONFIG: { key: string; label: string; color: string }[] = [
  { key: 'overall', label: 'Overall', color: 'var(--color-purple-500)' },
  { key: 'completeness', label: 'Completeness', color: 'var(--color-blue-500)' },
  { key: 'accuracy', label: 'Accuracy', color: 'var(--color-green-500)' },
  { key: 'timeliness', label: 'Timeliness', color: 'var(--color-yellow-500)' },
  { key: 'consistency', label: 'Consistency', color: 'var(--color-orange-500)' },
  { key: 'coverage', label: 'Coverage', color: 'var(--color-cyan-500)' },
];

export const TrendSparklines = memo(function TrendSparklines({
  assets,
  periods = 7,
}: TrendSparklinesProps) {
  // Calculate current averages and simulate historical trend data
  const trends = useMemo(() => {
    if (assets.length === 0) return [];

    const results: DimensionTrend[] = [];

    DIMENSION_CONFIG.forEach(({ key, label, color }) => {
      // Calculate current average
      const current = Math.round(
        assets.reduce((sum, a) => sum + a.scores[key as keyof typeof a.scores], 0) / assets.length
      );

      // Simulate historical data with some variance
      // In production, this would come from actual historical snapshots
      const data: { period: number; value: number }[] = [];
      const variance = 8; // Max variance per period

      // Work backwards from current value with some randomness
      let value = current;
      for (let i = periods; i >= 0; i--) {
        if (i === 0) {
          // Current period is always the actual current value
          data.push({ period: i, value: current });
        } else {
          // Previous periods have some variance
          // Use a seeded approach based on dimension index for consistency
          const seed = (key.charCodeAt(0) + i) % 10;
          const change = (seed - 5) * (variance / 5);
          value = Math.max(0, Math.min(100, Math.round(value - change)));
          data.unshift({ period: i, value });
        }
      }

      const previous = data[data.length - 2]?.value || current;
      const change = current - previous;

      results.push({
        dimension: key,
        label,
        current,
        previous,
        change,
        trend: change > 2 ? 'up' : change < -2 ? 'down' : 'stable',
        data,
        color,
      });
    });

    return results;
  }, [assets, periods]);

  // Custom tooltip
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const renderTooltip = (label: string, color: string) => (props: any) => {
    const { active, payload } = props;
    if (active && payload && payload.length > 0) {
      const value = payload[0].value;
      return (
        <div className="trend-sparkline-tooltip">
          <div className="trend-sparkline-tooltip-label">{label}</div>
          <div className="trend-sparkline-tooltip-value" style={{ color }}>
            {value}
          </div>
        </div>
      );
    }
    return null;
  };

  const TrendIcon = ({ trend }: { trend: 'up' | 'down' | 'stable' }) => {
    switch (trend) {
      case 'up':
        return <TrendingUp size={14} className="trend-icon trend-up" />;
      case 'down':
        return <TrendingDown size={14} className="trend-icon trend-down" />;
      default:
        return <Minus size={14} className="trend-icon trend-stable" />;
    }
  };

  if (assets.length === 0) {
    return (
      <div className="trend-sparklines trend-sparklines-empty">
        <p>No asset data available</p>
      </div>
    );
  }

  return (
    <div className="trend-sparklines">
      <div className="trend-sparklines-header">
        <h3 className="trend-sparklines-title">Quality Trends</h3>
        <InfoTooltip
          content={
            <div className="trend-sparklines-info">
              <strong>Quality Dimension Trends</strong>
              <p>
                Mini-charts showing how each quality dimension has changed over time.
                Green arrows indicate improvement, red indicates decline.
              </p>
              <p className="trend-sparklines-info-note">
                Note: Historical data is simulated for demonstration purposes.
              </p>
            </div>
          }
          position="bottom"
        />
      </div>

      <div className="trend-sparklines-grid">
        {trends.map((trend) => (
          <div key={trend.dimension} className="trend-sparkline-card">
            <div className="trend-sparkline-header">
              <span className="trend-sparkline-label">{trend.label}</span>
              <TrendIcon trend={trend.trend} />
            </div>

            <div className="trend-sparkline-chart">
              <ResponsiveContainer width="100%" height={40}>
                <LineChart data={trend.data} margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke={trend.color}
                    strokeWidth={2}
                    dot={false}
                    animationDuration={300}
                  />
                  <Tooltip content={renderTooltip(trend.label, trend.color)} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div className="trend-sparkline-stats">
              <span className={`trend-sparkline-current ${getScoreBand(trend.current)}`}>
                {trend.current}
              </span>
              <ArrowRight size={12} className="trend-sparkline-arrow" />
              <span className={`trend-sparkline-change ${trend.trend}`}>
                {trend.change > 0 ? '+' : ''}
                {trend.change}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
});
