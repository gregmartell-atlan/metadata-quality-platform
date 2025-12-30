import React, { useState, useEffect, useMemo } from 'react';
import { CheckCircle2, AlertTriangle, RefreshCw } from 'lucide-react';
import { Card, Button } from '../shared';
import { useAssetContextStore } from '../../stores/assetContextStore';
import { useScoresStore } from '../../stores/scoresStore';
import { useScoringSettingsStore } from '../../stores/scoringSettingsStore';
import { ScoringSettings } from '../settings/ScoringSettings';
import type { AtlanAsset } from '../../services/atlan/types';
import { fetchAssetsForModel, getSchemas, getDatabases } from '../../services/atlan/api';
import { logger } from '../../utils/logger';

export function Scorecard() {
  const { setAssetsWithScores, assetsWithScores } = useScoresStore();
  const { scoringMode } = useScoringSettingsStore();
  const { contextAssets, getAssetCount } = useAssetContextStore();
  const [trend, setTrend] = useState<number>(4.2); // Placeholder for trend logic
  const [error, setError] = useState<string | null>(null);
  const [isDraggingOver, setIsDraggingOver] = useState<boolean>(false);
  
  // Use context assets if available
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

  // Note: Scoring service initialization is handled by AssetContext and scoresStore
  // This component only reads from scoresStore

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'copy';
    setIsDraggingOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Only set dragging over to false if we're actually leaving the drop zone
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const x = e.clientX;
    const y = e.clientY;
    if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
      setIsDraggingOver(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(false);
    // Note: Dropping into Scorecard should set context via AssetContext component
    // This handler is kept for backward compatibility but should redirect to context
    logger.info('Scorecard: Drop event - assets should be set via AssetContext component');
    setError('Please drop assets into the Asset Context header at the top of the page to set context.');
  };

  // Manual refresh - trigger AssetContext to recalculate scores
  const refreshScores = () => {
    if (contextAssets.length > 0) {
      setAssetsWithScores(contextAssets);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'var(--score-excellent)';
    if (score >= 60) return 'var(--score-good)';
    if (score >= 40) return 'var(--score-fair)';
    if (score >= 20) return 'var(--score-poor)';
    return 'var(--score-critical)';
  };

  return (
    <Card className="scorecard" title="Overall Health">
      <ScoringSettings />
      <div 
        className={`scorecard-drop-zone ${isDraggingOver ? 'drag-over' : ''} ${effectiveCount > 0 ? 'has-assets' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {effectiveCount === 0 && !isDraggingOver && (
          <div className="drop-zone-hint">
            <div className="drop-icon">📥</div>
            <p><strong>Set asset context</strong> to view scores</p>
            <p className="drop-hint">Drag assets to the Asset Context header at the top, or select from Asset Browser</p>
          </div>
        )}
        {isDraggingOver && (
          <div className="drop-zone-hint drag-over-hint">
            <div className="drop-icon">⬇️</div>
            <p><strong>Drop in Asset Context header</strong></p>
            <p className="drop-hint">Use the context header at the top of the page to set context</p>
          </div>
        )}
        {effectiveCount > 0 && !isDraggingOver && (
          <div className="drop-zone-hint has-assets-hint">
          </div>
        )}
      </div>
      <div className="scorecard-controls">
        {effectiveCount > 0 ? (
          <div className="selection-status success">
            <span><strong>{effectiveCount}</strong> asset{effectiveCount !== 1 ? 's' : ''} ready for scoring</span>
          </div>
        ) : (
          <div className="selection-status warning">
          </div>
        )}
        {effectiveCount > 0 && (
          <Button 
            onClick={refreshScores} 
            variant="secondary"
            style={{ marginTop: 12, width: '100%' }}
          >
            <RefreshCw size={16} style={{ marginRight: '6px', display: 'inline', verticalAlign: 'middle' }} />
            Refresh Scores
          </Button>
        )}
      </div>
      {error && <div style={{ color: 'red', padding: '8px', marginBottom: '12px' }}>Error: {error}</div>}
      {scores && (
        <>
          <div className="score-display">
            <div className="score-value">{Math.round((scores.completeness + scores.accuracy + scores.timeliness + scores.consistency + scores.usability) / 5)}</div>
            <div className="score-label">Metadata Health Score</div>
            <span className={`score-trend ${trend >= 0 ? 'up' : 'down'}`}> 
              {trend >= 0 ? '↑' : '↓'} {Math.abs(trend)}% vs last month
            </span>
          </div>
          <div className="score-breakdown">
            <div className="score-dimension">
              <div className="score-dimension-value" style={{ color: getScoreColor(scores.completeness) }}>
                {scores.completeness}
              </div>
              <div className="score-dimension-label">Complete</div>
            </div>
            <div className="score-dimension">
              <div className="score-dimension-value" style={{ color: getScoreColor(scores.accuracy) }}>
                {scores.accuracy}
              </div>
              <div className="score-dimension-label">Accurate</div>
            </div>
            <div className="score-dimension">
              <div className="score-dimension-value" style={{ color: getScoreColor(scores.timeliness) }}>
                {scores.timeliness}
              </div>
              <div className="score-dimension-label">Timely</div>
            </div>
            <div className="score-dimension">
              <div className="score-dimension-value" style={{ color: getScoreColor(scores.consistency) }}>
                {scores.consistency}
              </div>
              <div className="score-dimension-label">Consistent</div>
            </div>
            <div className="score-dimension">
              <div className="score-dimension-value" style={{ color: getScoreColor(scores.usability) }}>
                {scores.usability}
              </div>
              <div className="score-dimension-label">Usable</div>
            </div>
          </div>
        </>
      )}
      {!scores && effectiveCount === 0 && (
        <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)' }}>
          Set asset context to see quality scores
        </div>
      )}
    </Card>
  );
}

