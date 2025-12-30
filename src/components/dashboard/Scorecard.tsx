import { useState, useMemo } from 'react';
import { Settings, RefreshCw } from 'lucide-react';
import { Card, Button } from '../shared';
import { useAssetContextStore } from '../../stores/assetContextStore';
import { useScoresStore } from '../../stores/scoresStore';
import { ScoringSettings } from '../settings/ScoringSettings';
import './Scorecard.css';

// Circular gauge component
function CircularGauge({ value, size = 160 }: { value: number; size?: number }) {
  const strokeWidth = 12;
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (value / 100) * circumference;

  const getColor = (score: number) => {
    if (score >= 80) return 'var(--score-excellent, #22c55e)';
    if (score >= 60) return 'var(--score-good, #84cc16)';
    if (score >= 40) return 'var(--score-fair, #eab308)';
    if (score >= 20) return 'var(--score-poor, #f97316)';
    return 'var(--score-critical, #ef4444)';
  };

  const getLabel = (score: number) => {
    if (score >= 80) return 'Excellent';
    if (score >= 60) return 'Good';
    if (score >= 40) return 'Fair';
    if (score >= 20) return 'Poor';
    return 'Critical';
  };

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
          stroke={getColor(value)}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: 'stroke-dashoffset 0.5s ease-out, stroke 0.3s' }}
        />
      </svg>
      <div className="gauge-content">
        <div className="gauge-value" style={{ color: getColor(value) }}>{value}</div>
        <div className="gauge-label">{getLabel(value)}</div>
      </div>
    </div>
  );
}

// Progress bar for dimension scores
function DimensionBar({ label, value, icon }: { label: string; value: number; icon: string }) {
  const getColor = (score: number) => {
    if (score >= 80) return 'var(--score-excellent, #22c55e)';
    if (score >= 60) return 'var(--score-good, #84cc16)';
    if (score >= 40) return 'var(--score-fair, #eab308)';
    if (score >= 20) return 'var(--score-poor, #f97316)';
    return 'var(--score-critical, #ef4444)';
  };

  return (
    <div className="dimension-bar">
      <div className="dimension-header">
        <span className="dimension-icon">{icon}</span>
        <span className="dimension-name">{label}</span>
        <span className="dimension-value" style={{ color: getColor(value) }}>{value}</span>
      </div>
      <div className="dimension-track">
        <div
          className="dimension-fill"
          style={{
            width: `${value}%`,
            backgroundColor: getColor(value)
          }}
        />
      </div>
    </div>
  );
}

export function Scorecard() {
  const { setAssetsWithScores, assetsWithScores } = useScoresStore();
  const { contextAssets, getAssetCount } = useAssetContextStore();
  const [showSettings, setShowSettings] = useState(false);
  const trend = 4.2; // Placeholder for trend logic

  const effectiveCount = contextAssets.length > 0 ? getAssetCount() : assetsWithScores.length;

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

  const overallScore = scores
    ? Math.round((scores.completeness + scores.accuracy + scores.timeliness + scores.consistency + scores.usability) / 5)
    : 0;

  const refreshScores = () => {
    if (contextAssets.length > 0) {
      setAssetsWithScores(contextAssets);
    }
  };

  return (
    <Card className="scorecard-v2" title="Health Score">
      {/* Settings toggle */}
      <button
        className="scorecard-settings-btn"
        onClick={() => setShowSettings(!showSettings)}
        title="Scoring Settings"
      >
        <Settings size={16} />
      </button>

      {/* Settings panel (collapsible) */}
      {showSettings && (
        <div className="scorecard-settings-panel">
          <ScoringSettings />
        </div>
      )}

      {/* Main content */}
      {scores ? (
        <div className="scorecard-content">
          {/* Circular gauge */}
          <div className="scorecard-gauge-section">
            <CircularGauge value={overallScore} />
            <div className="gauge-meta">
              <span className={`score-trend ${trend >= 0 ? 'up' : 'down'}`}>
                {trend >= 0 ? '↑' : '↓'} {Math.abs(trend)}%
              </span>
              <span className="trend-label">vs last month</span>
            </div>
          </div>

          {/* Dimension bars */}
          <div className="scorecard-dimensions">
            <DimensionBar label="Completeness" value={scores.completeness} icon="📝" />
            <DimensionBar label="Accuracy" value={scores.accuracy} icon="🎯" />
            <DimensionBar label="Timeliness" value={scores.timeliness} icon="⏱️" />
            <DimensionBar label="Consistency" value={scores.consistency} icon="🔗" />
            <DimensionBar label="Usability" value={scores.usability} icon="✨" />
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
