/**
 * QualityImpactMatrix - Quality vs Usage 2x2 Matrix
 *
 * Visualizes assets in a quadrant based on quality score and usage/popularity.
 * Helps prioritize remediation by showing high-usage, low-quality assets.
 */

import { useMemo, memo, useState, useCallback } from 'react';
import { ScatterChart, Scatter, XAxis, YAxis, ZAxis, Tooltip, ResponsiveContainer, Cell, ReferenceLine } from 'recharts';
import { InfoTooltip } from '../shared';
import { AlertTriangle, CheckCircle, Clock, Archive, Filter, ChevronDown } from 'lucide-react';
import { calculatePopularityScore } from '../../utils/popularityScore';
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

type DimensionFilter = 'all' | 'assetType' | 'connection' | 'owner' | 'certification';

// Thresholds for quadrants
const QUALITY_THRESHOLD = 60;
const USAGE_THRESHOLD = 50; // Normalized 0-100

/**
 * Calculate normalized usage score (0-100) using proper popularity calculation
 * Uses the same logic as popularityScore.ts for consistency
 */
function calculateUsageScore(asset: AssetWithScores): number {
  // Use the existing calculatePopularityScore which returns 0-1 (normalized)
  const popularityNormalized = calculatePopularityScore(asset.asset);

  // Also factor in query counts if available (for tables/views)
  const queryCount = (asset.asset as any).queryCount || 0;
  const queryScore = Math.min(queryCount / 500, 1); // Cap at 500 queries = 100%

  // Combine: 70% popularity score, 30% query score
  const combined = (popularityNormalized * 0.7) + (queryScore * 0.3);

  // Return as 0-100 scale
  return Math.round(combined * 100);
}

/**
 * Get unique dimension values for filtering
 */
function getDimensionValues(assets: AssetWithScores[], dimension: DimensionFilter): string[] {
  const values = new Set<string>();

  assets.forEach(asset => {
    let value: string | undefined;
    switch (dimension) {
      case 'assetType':
        value = asset.asset.typeName;
        break;
      case 'connection':
        value = asset.asset.connectionName || asset.asset.connectionQualifiedName?.split('/').pop();
        break;
      case 'owner':
        value = asset.asset.ownerUsers?.[0] || asset.asset.ownerGroups?.[0] || 'Unowned';
        break;
      case 'certification':
        value = asset.asset.certificateStatus || 'None';
        break;
    }
    if (value) values.add(value);
  });

  return Array.from(values).sort();
}

export const QualityImpactMatrix = memo(function QualityImpactMatrix({
  assets,
  onAssetClick,
}: QualityImpactMatrixProps) {
  const [selectedQuadrant, setSelectedQuadrant] = useState<string | null>(null);
  const [filterDimension, setFilterDimension] = useState<DimensionFilter>('all');
  const [filterValue, setFilterValue] = useState<string>('');
  const [showFilters, setShowFilters] = useState(false);

  // Get available filter values based on selected dimension
  const filterOptions = useMemo(() => {
    if (filterDimension === 'all') return [];
    return getDimensionValues(assets, filterDimension);
  }, [assets, filterDimension]);

  // Filter assets based on dimension selection
  const filteredAssets = useMemo(() => {
    if (filterDimension === 'all' || !filterValue) return assets;

    return assets.filter(asset => {
      switch (filterDimension) {
        case 'assetType':
          return asset.asset.typeName === filterValue;
        case 'connection':
          return (asset.asset.connectionName || asset.asset.connectionQualifiedName?.split('/').pop()) === filterValue;
        case 'owner':
          const owner = asset.asset.ownerUsers?.[0] || asset.asset.ownerGroups?.[0] || 'Unowned';
          return owner === filterValue;
        case 'certification':
          return (asset.asset.certificateStatus || 'None') === filterValue;
        default:
          return true;
      }
    });
  }, [assets, filterDimension, filterValue]);

  const { scatterData, quadrants, summary } = useMemo(() => {
    const critical: AssetWithScores[] = [];
    const healthy: AssetWithScores[] = [];
    const techDebt: AssetWithScores[] = [];
    const quickWins: AssetWithScores[] = [];

    const scatter = filteredAssets.map(asset => {
      const quality = asset.scores.overall;
      const usage = calculateUsageScore(asset);

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
        healthyPercent: Math.round((healthy.length / (filteredAssets.length || 1)) * 100),
      },
    };
  }, [filteredAssets]);

  const getPointColor = useCallback((quadrant: string) => {
    const colors: Record<string, string> = {
      critical: 'var(--color-red-500)',
      healthy: 'var(--color-green-500)',
      techDebt: 'var(--color-gray-400)',
      quickWins: 'var(--color-blue-400)',
    };
    return colors[quadrant] || 'var(--color-gray-400)';
  }, []);

  const visibleData = selectedQuadrant
    ? scatterData.filter(d => d.quadrant === selectedQuadrant)
    : scatterData;

  const handleDimensionChange = (dim: DimensionFilter) => {
    setFilterDimension(dim);
    setFilterValue('');
  };

  const renderTooltip = (props: any) => {
    const { active, payload } = props;
    if (!active || !payload?.[0]) return null;

    const data = payload[0].payload;
    const asset = data.asset as AssetWithScores;

    return (
      <div className="matrix-tooltip">
        <div className="matrix-tooltip-name">{data.name}</div>
        <div className="matrix-tooltip-type">{asset.asset.typeName}</div>
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
        <div className="matrix-header-right">
          {summary.criticalRisk > 0 && (
            <div className="matrix-alert">
              <AlertTriangle size={14} />
              <span>{summary.criticalRisk} critical assets at {summary.avgCriticalQuality}% avg quality</span>
            </div>
          )}
          <button
            className={`matrix-filter-toggle ${showFilters ? 'active' : ''}`}
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter size={14} />
            <span>Filter</span>
            <ChevronDown size={12} className={showFilters ? 'rotated' : ''} />
          </button>
        </div>
      </div>

      {/* Dimension filters */}
      {showFilters && (
        <div className="matrix-filters">
          <div className="filter-group">
            <label>Dimension:</label>
            <select
              value={filterDimension}
              onChange={(e) => handleDimensionChange(e.target.value as DimensionFilter)}
              className="filter-select"
            >
              <option value="all">All Assets</option>
              <option value="assetType">Asset Type</option>
              <option value="connection">Connection</option>
              <option value="owner">Owner</option>
              <option value="certification">Certification</option>
            </select>
          </div>
          {filterDimension !== 'all' && filterOptions.length > 0 && (
            <div className="filter-group">
              <label>Value:</label>
              <select
                value={filterValue}
                onChange={(e) => setFilterValue(e.target.value)}
                className="filter-select"
              >
                <option value="">All {filterDimension}</option>
                {filterOptions.map(opt => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            </div>
          )}
          {filterValue && (
            <div className="filter-active">
              <span>Showing: {filterValue}</span>
              <button onClick={() => { setFilterDimension('all'); setFilterValue(''); }}>
                Clear
              </button>
            </div>
          )}
        </div>
      )}

      <div className="matrix-content">
        <div className="matrix-chart">
          <ResponsiveContainer width="100%" height={320}>
            <ScatterChart margin={{ top: 20, right: 20, bottom: 30, left: 40 }}>
              <XAxis
                type="number"
                dataKey="x"
                name="Quality"
                domain={[0, 100]}
                tickFormatter={(v) => `${v}%`}
                tick={{ fontSize: 11 }}
                label={{ value: 'Quality Score', position: 'bottom', offset: 10, fontSize: 12 }}
              />
              <YAxis
                type="number"
                dataKey="y"
                name="Usage"
                domain={[0, 100]}
                tickFormatter={(v) => `${v}%`}
                tick={{ fontSize: 11 }}
                label={{ value: 'Usage', angle: -90, position: 'left', offset: -5, fontSize: 12 }}
              />
              <ZAxis type="number" dataKey="z" range={[30, 100]} />
              <Tooltip content={renderTooltip} />
              <ReferenceLine x={QUALITY_THRESHOLD} stroke="var(--border-default)" strokeDasharray="3 3" />
              <ReferenceLine y={USAGE_THRESHOLD} stroke="var(--border-default)" strokeDasharray="3 3" />
              <Scatter
                data={visibleData}
                onClick={(data) => onAssetClick?.(data.asset)}
                cursor="pointer"
              >
                {visibleData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={getPointColor(entry.quadrant)}
                    fillOpacity={0.7}
                    stroke={getPointColor(entry.quadrant)}
                    strokeWidth={1}
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

      {/* Summary stats row */}
      <div className="matrix-summary">
        <div className="summary-item">
          <span className="summary-label">Total</span>
          <span className="summary-value">{filteredAssets.length}</span>
        </div>
        <div className="summary-item critical">
          <span className="summary-label">Critical</span>
          <span className="summary-value">{quadrants.critical.count}</span>
        </div>
        <div className="summary-item healthy">
          <span className="summary-label">Healthy</span>
          <span className="summary-value">{quadrants.healthy.count}</span>
        </div>
        <div className="summary-item">
          <span className="summary-label">Health Rate</span>
          <span className="summary-value">{summary.healthyPercent}%</span>
        </div>
      </div>
    </div>
  );
});
