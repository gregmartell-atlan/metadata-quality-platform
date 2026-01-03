/**
 * QualityDistribution - Asset Quality Score Distribution
 *
 * Visualizes the distribution of assets across quality score bands.
 * Shows how many assets fall into each category: Excellent, Good, Fair, Poor, Critical.
 */

import { useMemo, memo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { InfoTooltip } from '../shared';
import { useQualityRules } from '../../stores/qualityRulesStore';
import type { AssetWithScores } from '../../stores/scoresStore';
import './QualityDistribution.css';

interface QualityDistributionProps {
  assets: AssetWithScores[];
  dimension?: 'overall' | 'completeness' | 'accuracy' | 'timeliness' | 'consistency' | 'coverage';
}

interface BandData {
  name: string;
  count: number;
  percentage: number;
  color: string;
  range: string;
}

const BAND_COLORS: Record<string, string> = {
  excellent: 'var(--color-green-500)',
  good: 'var(--color-blue-500)',
  fair: 'var(--color-yellow-500)',
  poor: 'var(--color-orange-500)',
  critical: 'var(--color-red-500)',
};

export const QualityDistribution = memo(function QualityDistribution({
  assets,
  dimension = 'overall',
}: QualityDistributionProps) {
  const { rules, getScoreBand, getScoreLabel } = useQualityRules();
  const { thresholds } = rules;

  // Compute band ranges dynamically based on configured thresholds
  const bandRanges: Record<string, string> = useMemo(() => ({
    excellent: `${thresholds.excellent}-100`,
    good: `${thresholds.good}-${thresholds.excellent - 1}`,
    fair: `${thresholds.fair}-${thresholds.good - 1}`,
    poor: `${thresholds.poor}-${thresholds.fair - 1}`,
    critical: `0-${thresholds.poor - 1}`,
  }), [thresholds]);

  const distributionData = useMemo(() => {
    const bands: Record<string, number> = {
      excellent: 0,
      good: 0,
      fair: 0,
      poor: 0,
      critical: 0,
    };

    assets.forEach((asset) => {
      const score = asset.scores[dimension];
      const band = getScoreBand(score);
      bands[band]++;
    });

    const total = assets.length || 1;

    return ['excellent', 'good', 'fair', 'poor', 'critical'].map((band) => ({
      name: getScoreLabel(band === 'excellent' ? 100 : band === 'good' ? 70 : band === 'fair' ? 50 : band === 'poor' ? 30 : 10),
      count: bands[band],
      percentage: Math.round((bands[band] / total) * 100),
      color: BAND_COLORS[band],
      range: bandRanges[band],
    }));
  }, [assets, dimension, getScoreBand, getScoreLabel, bandRanges]);

  const totalAssets = assets.length;
  const healthScore = useMemo(() => {
    if (totalAssets === 0) return 0;
    const excellentGood = distributionData[0].count + distributionData[1].count;
    return Math.round((excellentGood / totalAssets) * 100);
  }, [distributionData, totalAssets]);

  // Custom tooltip
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const renderTooltip = (props: any) => {
    const { active, payload } = props;
    if (active && payload && payload.length > 0) {
      const data = payload[0].payload as BandData;
      return (
        <div className="quality-dist-tooltip">
          <div className="quality-dist-tooltip-header" style={{ color: data.color }}>
            {data.name}
          </div>
          <div className="quality-dist-tooltip-stats">
            <span className="quality-dist-tooltip-count">{data.count} assets</span>
            <span className="quality-dist-tooltip-pct">{data.percentage}%</span>
          </div>
          <div className="quality-dist-tooltip-range">Score range: {data.range}</div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="quality-distribution">
      <div className="quality-dist-header">
        <h3 className="quality-dist-title">Quality Distribution</h3>
        <InfoTooltip
          content={
            <div className="quality-dist-info">
              <strong>Asset Quality Distribution</strong>
              <p>
                Shows how your assets are distributed across quality score bands.
                A healthy catalog should have most assets in the Excellent and Good categories.
              </p>
              <ul>
                <li><span className="band excellent">Excellent</span> {bandRanges.excellent}: Production ready</li>
                <li><span className="band good">Good</span> {bandRanges.good}: Minor improvements needed</li>
                <li><span className="band fair">Fair</span> {bandRanges.fair}: Moderate work required</li>
                <li><span className="band poor">Poor</span> {bandRanges.poor}: Significant gaps</li>
                <li><span className="band critical">Critical</span> {bandRanges.critical}: Urgent attention needed</li>
              </ul>
            </div>
          }
          position="bottom"
        />
      </div>

      <div className="quality-dist-summary">
        <div className="quality-dist-health">
          <span className="quality-dist-health-label">Catalog Health</span>
          <span className={`quality-dist-health-value ${getScoreBand(healthScore)}`}>
            {healthScore}%
          </span>
        </div>
        <div className="quality-dist-total">
          <span className="quality-dist-total-label">Total Assets</span>
          <span className="quality-dist-total-value">{totalAssets.toLocaleString()}</span>
        </div>
      </div>

      <div className="quality-dist-chart">
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={distributionData} layout="vertical" margin={{ left: 80, right: 20 }}>
            <XAxis type="number" domain={[0, 'dataMax']} tick={{ fill: 'var(--text-muted)', fontSize: 11 }} />
            <YAxis
              type="category"
              dataKey="name"
              tick={{ fill: 'var(--text-secondary)', fontSize: 12 }}
              width={70}
            />
            <RechartsTooltip content={renderTooltip} />
            <Bar dataKey="count" radius={[0, 4, 4, 0]}>
              {distributionData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="quality-dist-legend">
        {distributionData.map((band) => (
          <div key={band.name} className="quality-dist-legend-item">
            <span className="quality-dist-legend-dot" style={{ background: band.color }} />
            <span className="quality-dist-legend-label">{band.name}</span>
            <span className="quality-dist-legend-count">{band.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
});
