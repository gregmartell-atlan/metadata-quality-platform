import { useMemo } from 'react';
import { RefreshCw } from 'lucide-react';
import { Card, Button, Tooltip } from '../shared';
import { useAssetContextStore } from '../../stores/assetContextStore';
import { useScoresStore } from '../../stores/scoresStore';
import { useAssetPreviewStore } from '../../stores/assetPreviewStore';
import { useQualityRules } from '../../stores/qualityRulesStore';
import { useQualitySnapshotStore } from '../../stores/qualitySnapshotStore';
import { getQualityDimensionInfo, getScoreBandInfo } from '../../constants/metadataDescriptions';
import type { AssetWithScores } from '../../stores/scoresStore';
import './Scorecard.css';

// Circular gauge component
function CircularGauge({ value, size = 160 }: { value: number; size?: number }) {
  const { getScoreColor, getScoreLabel } = useQualityRules();
  const strokeWidth = 12;
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (value / 100) * circumference;

  return (
    <div className="circular-gauge" style={{ width: size, height: size }}>
      <svg width={size} height={size}>
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--bg-tertiary, #1a1a1d)"
          strokeWidth={strokeWidth}
        />
        {/* Progress circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={getScoreColor(value)}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: 'stroke-dashoffset 0.5s ease-out, stroke 0.3s' }}
        />
      </svg>
      <div className="gauge-content">
        <div className="gauge-value" style={{ color: getScoreColor(value) }}>{value}</div>
        <div className="gauge-label">{getScoreLabel(value)}</div>
      </div>
    </div>
  );
}

// Progress bar for dimension scores
function DimensionBar({
  label,
  value,
  icon,
  dimensionKey,
  onClick,
}: {
  label: string;
  value: number;
  icon: string;
  dimensionKey: string;
  onClick?: () => void;
}) {
  const { getScoreColor } = useQualityRules();
  const dimInfo = getQualityDimensionInfo(dimensionKey);
  const bandInfo = getScoreBandInfo(value);

  return (
    <Tooltip
      content={
        <div className="dimension-tooltip">
          <div className="dimension-tooltip-header">
            <span className="dimension-tooltip-icon">{icon}</span>
            <strong>{dimInfo?.name || label}</strong>
          </div>
          <p className="dimension-tooltip-desc">{dimInfo?.description}</p>
          <div className="dimension-tooltip-score">
            <span className="dimension-tooltip-value">{value}</span>
            <span className={`dimension-tooltip-band dimension-band-${bandInfo.name.toLowerCase()}`}>
              {bandInfo.name}
            </span>
          </div>
          {dimInfo?.factors && (
            <div className="dimension-tooltip-factors">
              <span>Key factors:</span>
              <ul>
                {dimInfo.factors.map((f, i) => (
                  <li key={i}>{f}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      }
      position="right"
      maxWidth={280}
    >
      <div
        className={`dimension-bar ${onClick ? 'dimension-bar-clickable' : ''}`}
        onClick={onClick}
        title={onClick ? `Click to see lowest-scoring asset for ${label}` : undefined}
      >
        <div className="dimension-header">
          <span className="dimension-icon">{icon}</span>
          <span className="dimension-name">{label}</span>
          <span className="dimension-value" style={{ color: getScoreColor(value) }}>{value}</span>
        </div>
        <div className="dimension-track">
          <div
            className="dimension-fill"
            style={{
              width: `${value}%`,
              backgroundColor: getScoreColor(value)
            }}
          />
        </div>
      </div>
    </Tooltip>
  );
}

export function Scorecard() {
  const { setAssetsWithScores, assetsWithScores } = useScoresStore();
  const { contextAssets, getAssetCount } = useAssetContextStore();
  const { openPreview } = useAssetPreviewStore();
  const { calculateWeightedScore } = useQualityRules();
  const { snapshots } = useQualitySnapshotStore();

  const effectiveCount = contextAssets.length > 0 ? getAssetCount() : assetsWithScores.length;

  // Get the lowest-scoring asset for a given dimension
  const getLowestScoringAsset = (dimension: keyof AssetWithScores['scores']) => {
    if (assetsWithScores.length === 0) return null;
    return assetsWithScores.reduce((lowest, current) =>
      current.scores[dimension] < lowest.scores[dimension] ? current : lowest
    );
  };

  // Handle dimension click - show lowest-scoring asset
  const handleDimensionClick = (dimension: keyof AssetWithScores['scores']) => {
    const lowestAsset = getLowestScoringAsset(dimension);
    if (lowestAsset) {
      openPreview(lowestAsset.asset);
    }
  };

  // Calculate average scores from assetsWithScores
  const scores = useMemo(() => {
    if (assetsWithScores.length === 0) return null;

    let completeness = 0;
    let accuracy = 0;
    let timeliness = 0;
    let consistency = 0;
    let usability = 0;

    assetsWithScores.forEach(({ scores: assetScores }) => {
      completeness += assetScores.completeness;
      accuracy += assetScores.accuracy;
      timeliness += assetScores.timeliness;
      consistency += assetScores.consistency;
      usability += assetScores.usability;
    });

    const count = assetsWithScores.length;
    return {
      completeness: Math.round(completeness / count),
      accuracy: Math.round(accuracy / count),
      timeliness: Math.round(timeliness / count),
      consistency: Math.round(consistency / count),
      usability: Math.round(usability / count),
    };
  }, [assetsWithScores]);

  const overallScore = scores ? calculateWeightedScore(scores) : 0;

  // Calculate trend from snapshots (compare to most recent snapshot)
  const trend = useMemo(() => {
    if (snapshots.length === 0 || overallScore === 0) return null;

    // Get the most recent snapshot
    const recentSnapshot = snapshots[0];
    if (!recentSnapshot?.overallScores?.overall) return null;

    // Calculate percent change
    const previousScore = recentSnapshot.overallScores.overall;
    if (previousScore === 0) return null;

    const change = ((overallScore - previousScore) / previousScore) * 100;
    return Math.round(change * 10) / 10; // Round to 1 decimal
  }, [snapshots, overallScore]);

  const refreshScores = () => {
    if (contextAssets.length > 0) {
      setAssetsWithScores(contextAssets);
    }
  };

  return (
    <Card className="scorecard-v2" title="Health Score">
      {/* Main content */}
      {scores ? (
        <div className="scorecard-content">
          {/* Circular gauge */}
          <div className="scorecard-gauge-section">
            <Tooltip
              content={
                <div className="gauge-tooltip">
                  <strong>Overall Health Score</strong>
                  <p>A weighted average of all quality dimensions. This score indicates the overall metadata health of your selected assets.</p>
                  <div className="gauge-tooltip-band">
                    Status: <span className={`gauge-band gauge-band-${getScoreBandInfo(overallScore).name.toLowerCase()}`}>
                      {getScoreBandInfo(overallScore).name}
                    </span>
                  </div>
                  <div className="gauge-tooltip-action">{getScoreBandInfo(overallScore).action}</div>
                </div>
              }
              position="right"
              maxWidth={280}
            >
              <div className="gauge-wrapper">
                <CircularGauge value={overallScore} />
              </div>
            </Tooltip>
            <div className="gauge-meta">
              {trend !== null ? (
                <>
                  <Tooltip content="Percent change compared to the most recent snapshot">
                    <span className={`score-trend ${trend >= 0 ? 'up' : 'down'}`}>
                      {trend >= 0 ? '↑' : '↓'} {Math.abs(trend)}%
                    </span>
                  </Tooltip>
                  <span className="trend-label">vs last snapshot</span>
                </>
              ) : (
                <span className="trend-label">No previous snapshot</span>
              )}
            </div>
          </div>

          {/* Dimension bars */}
          <div className="scorecard-dimensions">
            <DimensionBar label="Completeness" value={scores.completeness} icon="📝" dimensionKey="completeness" onClick={() => handleDimensionClick('completeness')} />
            <DimensionBar label="Accuracy" value={scores.accuracy} icon="🎯" dimensionKey="accuracy" onClick={() => handleDimensionClick('accuracy')} />
            <DimensionBar label="Timeliness" value={scores.timeliness} icon="⏱️" dimensionKey="timeliness" onClick={() => handleDimensionClick('timeliness')} />
            <DimensionBar label="Consistency" value={scores.consistency} icon="🔗" dimensionKey="consistency" onClick={() => handleDimensionClick('consistency')} />
            <DimensionBar label="Usability" value={scores.usability} icon="✨" dimensionKey="usability" onClick={() => handleDimensionClick('usability')} />
          </div>

          {/* Asset count and refresh */}
          <div className="scorecard-footer">
            <span className="asset-count">
              <strong>{effectiveCount}</strong> assets scored
            </span>
            <Button
              onClick={refreshScores}
              variant="ghost"
              className="refresh-btn"
            >
              <RefreshCw size={14} />
              Refresh
            </Button>
          </div>
        </div>
      ) : (
        <div className="scorecard-empty">
          <div className="empty-gauge">
            <CircularGauge value={0} size={120} />
          </div>
          <p className="empty-message">
            Set asset context to view health scores
          </p>
          <p className="empty-hint">
            Use the Browse button or drop assets into the context bar
          </p>
        </div>
      )}
    </Card>
  );
}
