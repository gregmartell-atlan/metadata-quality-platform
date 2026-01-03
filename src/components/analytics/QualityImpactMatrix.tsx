/**
 * QualityImpactMatrix - Quality vs Usage 2x2 Matrix
 *
 * Visualizes assets in a quadrant based on quality score and usage/popularity.
 * Helps prioritize remediation by showing high-usage, low-quality assets.
 */

import { useMemo, memo, useState } from 'react';
import { ScatterChart, Scatter, XAxis, YAxis, ZAxis, Tooltip, ResponsiveContainer, Cell, ReferenceLine } from 'recharts';
import { InfoTooltip } from '../shared';
import { AlertTriangle, CheckCircle, Clock, Archive } from 'lucide-react';
import type { AssetWithScores } from '../../stores/scoresStore';
import './QualityImpactMatrix.css';

interface QualityImpactMatrixProps {
  assets: AssetWithScores[];
  onAssetClick?: (asset: AssetWithScores) => void;
}

interface QuadrantData {
  name: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  count: number;
  assets: AssetWithScores[];
}

// Thresholds for quadrants
const QUALITY_THRESHOLD = 60;
const USAGE_THRESHOLD = 50; // Normalized 0-100

function normalizeUsage(asset: AssetWithScores): number {
  const { queryCount = 0, sourceReadCount = 0, viewScore = 0, popularityScore = 0 } = asset.asset;

  // Combine multiple usage signals
  const signals = [
    Math.min(queryCount / 100, 1) * 100,
    Math.min(sourceReadCount / 1000, 1) * 100,
    viewScore || 0,
    (popularityScore || 0) * 100,
  ].filter(s => s > 0);

  if (signals.length === 0) return 0;
  return signals.reduce((a, b) => a + b, 0) / signals.length;
}

export const QualityImpactMatrix = memo(function QualityImpactMatrix({
  assets,
  onAssetClick,
}: QualityImpactMatrixProps) {
  const [selectedQuadrant, setSelectedQuadrant] = useState<string | null>(null);

  const { scatterData, quadrants, summary } = useMemo(() => {
    const critical: AssetWithScores[] = [];
    const healthy: AssetWithScores[] = [];
    const techDebt: AssetWithScores[] = [];
    const quickWins: AssetWithScores[] = [];

    const scatter = assets.map(asset => {
      const quality = asset.scores.overall;
      const usage = normalizeUsage(asset);

      // Categorize into quadrants
      if (quality < QUALITY_THRESHOLD && usage >= USAGE_THRESHOLD) {
        critical.push(asset);
      } else if (quality >= QUALITY_THRESHOLD && usage >= USAGE_THRESHOLD) {
        healthy.push(asset);
      } else if (quality < QUALITY_THRESHOLD && usage < USAGE_THRESHOLD) {
        techDebt.push(asset);
      } else {
        quickWins.push(asset);
      }

      return {
        x: quality,
        y: usage,
        z: 50, // bubble size
        name: asset.asset.name,
        guid: asset.asset.guid,
        asset,
        quadrant: quality < QUALITY_THRESHOLD
          ? (usage >= USAGE_THRESHOLD ? 'critical' : 'techDebt')
          : (usage >= USAGE_THRESHOLD ? 'healthy' : 'quickWins'),
      };
    });

    const quads: Record<string, QuadrantData> = {
      critical: {
        name: 'Critical',
        description: 'High usage, low quality - fix immediately',
        icon: <AlertTriangle size={16} />,
        color: 'var(--color-red-500)',
        count: critical.length,
        assets: critical,
      },
      healthy: {
        name: 'Healthy',
        description: 'High usage, good quality - maintain',
        icon: <CheckCircle size={16} />,
        color: 'var(--color-green-500)',
        count: healthy.length,
        assets: healthy,
      },
      techDebt: {
        name: 'Tech Debt',
        description: 'Low usage, low quality - backlog',
        icon: <Archive size={16} />,
        color: 'var(--color-gray-500)',
        count: techDebt.length,
        assets: techDebt,
      },
      quickWins: {
        name: 'Quick Wins',
        description: 'Low usage, good quality - low priority',
        icon: <Clock size={16} />,
        color: 'var(--color-blue-500)',
        count: quickWins.length,
        assets: quickWins,
      },
    };

    return {
      scatterData: scatter,
      quadrants: quads,
      summary: {
        criticalRisk: critical.length,
        avgCriticalQuality: critical.length > 0
          ? Math.round(critical.reduce((sum, a) => sum + a.scores.overall, 0) / critical.length)
          : 0,
        healthyPercent: Math.round((healthy.length / (assets.length || 1)) * 100),
      },
    };
  }, [assets]);

  const getPointColor = (quadrant: string) => {
    const colors: Record<string, string> = {
      critical: 'var(--color-red-500)',
      healthy: 'var(--color-green-500)',
      techDebt: 'var(--color-gray-400)',
      quickWins: 'var(--color-blue-400)',
    };
    return colors[quadrant] || 'var(--color-gray-400)';
  };

  const filteredData = selectedQuadrant
    ? scatterData.filter(d => d.quadrant === selectedQuadrant)
    : scatterData;

  const renderTooltip = (props: any) => {
    const { active, payload } = props;
    if (!active || !payload?.[0]) return null;

    const data = payload[0].payload;
    return (
      <div className="matrix-tooltip">
        <div className="matrix-tooltip-name">{data.name}</div>
        <div className="matrix-tooltip-row">
          <span>Quality:</span>
          <span className="matrix-tooltip-value">{Math.round(data.x)}%</span>
        </div>
        <div className="matrix-tooltip-row">
          <span>Usage:</span>
          <span className="matrix-tooltip-value">{Math.round(data.y)}%</span>
        </div>
        <div className="matrix-tooltip-quadrant" style={{ color: getPointColor(data.quadrant) }}>
          {quadrants[data.quadrant].name}
        </div>
      </div>
    );
  };

  return (
    <div className="quality-impact-matrix">
      <div className="matrix-header">
        <div className="matrix-title">
          <h3>Quality Impact Matrix</h3>
          <InfoTooltip content="Shows assets plotted by quality score (x-axis) vs usage/popularity (y-axis). Critical quadrant shows high-usage assets with poor quality that need immediate attention." />
        </div>
        {summary.criticalRisk > 0 && (
          <div className="matrix-alert">
            <AlertTriangle size={14} />
            <span>{summary.criticalRisk} critical assets at {summary.avgCriticalQuality}% avg quality</span>
          </div>
        )}
      </div>

      <div className="matrix-content">
        <div className="matrix-chart">
          <ResponsiveContainer width="100%" height={300}>
            <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
              <XAxis
                type="number"
                dataKey="x"
                name="Quality"
                domain={[0, 100]}
                tickFormatter={(v) => `${v}%`}
                label={{ value: 'Quality Score', position: 'bottom', offset: 0 }}
              />
              <YAxis
                type="number"
                dataKey="y"
                name="Usage"
                domain={[0, 100]}
                tickFormatter={(v) => `${v}%`}
                label={{ value: 'Usage', angle: -90, position: 'left', offset: 10 }}
              />
              <ZAxis type="number" dataKey="z" range={[20, 80]} />
              <Tooltip content={renderTooltip} />
              <ReferenceLine x={QUALITY_THRESHOLD} stroke="var(--border-default)" strokeDasharray="3 3" />
              <ReferenceLine y={USAGE_THRESHOLD} stroke="var(--border-default)" strokeDasharray="3 3" />
              <Scatter
                data={filteredData}
                onClick={(data) => onAssetClick?.(data.asset)}
                cursor="pointer"
              >
                {filteredData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={getPointColor(entry.quadrant)}
                    fillOpacity={0.7}
                  />
                ))}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>

          {/* Quadrant labels */}
          <div className="matrix-quadrant-labels">
            <div className="quadrant-label top-left">Critical</div>
            <div className="quadrant-label top-right">Healthy</div>
            <div className="quadrant-label bottom-left">Tech Debt</div>
            <div className="quadrant-label bottom-right">Quick Wins</div>
          </div>
        </div>

        <div className="matrix-legend">
          {Object.entries(quadrants).map(([key, quad]) => (
            <button
              key={key}
              className={`matrix-legend-item ${selectedQuadrant === key ? 'selected' : ''}`}
              onClick={() => setSelectedQuadrant(selectedQuadrant === key ? null : key)}
              style={{ '--quad-color': quad.color } as React.CSSProperties}
            >
              <div className="legend-icon" style={{ color: quad.color }}>
                {quad.icon}
              </div>
              <div className="legend-content">
                <div className="legend-name">{quad.name}</div>
                <div className="legend-count">{quad.count} assets</div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
});
