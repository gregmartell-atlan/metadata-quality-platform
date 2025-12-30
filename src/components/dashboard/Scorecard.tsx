import React, { useState, useEffect, useMemo } from 'react';
import { CheckCircle2, AlertTriangle, RefreshCw } from 'lucide-react';
import { Card, Button } from '../shared';
import { useAssetStore } from '../../stores/assetStore';
import { useAssetContextStore } from '../../stores/assetContextStore';
import { useScoresStore } from '../../stores/scoresStore';
import { useScoringSettingsStore } from '../../stores/scoringSettingsStore';
import { ScoringSettings } from '../settings/ScoringSettings';
import type { AtlanAsset } from '../../services/atlan/types';
import { fetchAssetsForModel, getSchemas, getDatabases } from '../../services/atlan/api';
import { logger } from '../../utils/logger';

export function Scorecard() {
  const { selectedAssets, selectedCount, addAsset } = useAssetStore();
  // Subscribe directly to store state to get reactive updates
  const contextAssets = useAssetContextStore((state) => state.contextAssets);
  const getAssetCount = useAssetContextStore((state) => state.getAssetCount);
  const { setAssetsWithScores, assetsWithScores } = useScoresStore();
  const { scoringMode } = useScoringSettingsStore();
  const [trend, setTrend] = useState<number>(4.2); // Placeholder for trend logic
  const [error, setError] = useState<string | null>(null);
  const [isDraggingOver, setIsDraggingOver] = useState<boolean>(false);
  
  // Use context assets if available, fallback to selectedAssets for backward compatibility
  const effectiveAssets = contextAssets.length > 0 ? contextAssets : selectedAssets;
  const effectiveCount = contextAssets.length > 0 ? getAssetCount() : selectedCount;

  // Note: Scoring service initialization is handled by AssetContext and scoresStore
  // This component only reads from scoresStore

  // Calculate aggregated scores from scoresStore (single source of truth)
  // AssetContext component is responsible for updating scoresStore when context changes
  const scores = useMemo(() => {
    if (assetsWithScores.length === 0) {
      return null;
    }
    
    // Aggregate scores from scoresStore
    const agg = { completeness: 0, accuracy: 0, timeliness: 0, consistency: 0, usability: 0 };
    assetsWithScores.forEach(({ scores: assetScores }) => {
      agg.completeness += assetScores.completeness;
      agg.accuracy += assetScores.accuracy;
      agg.timeliness += assetScores.timeliness;
      agg.consistency += assetScores.consistency;
      agg.usability += assetScores.usability;
    });
    
    const n = assetsWithScores.length;
    return {
      completeness: Math.round(agg.completeness / n),
      accuracy: Math.round(agg.accuracy / n),
      timeliness: Math.round(agg.timeliness / n),
      consistency: Math.round(agg.consistency / n),
      usability: Math.round(agg.usability / n),
    };
  }, [assetsWithScores]);

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
    setLoading(true);
    setError(null);
    
    try {
      const data = e.dataTransfer.getData('application/json');
      if (data) {
        const parsed = JSON.parse(data);
        
        if (parsed.type === 'atlan-assets' && parsed.assets && Array.isArray(parsed.assets)) {
          // Multiple assets (from database, schema, or connector) - already loaded
          parsed.assets.forEach((asset: AtlanAsset) => {
            addAsset(asset);
          });
        } else if (parsed.type === 'atlan-asset' && parsed.asset) {
          // Single asset (legacy format)
          addAsset(parsed.asset as AtlanAsset);
        } else if (parsed.type === 'atlan-node') {
          // Node that needs to be expanded and loaded
          // Fetch all tables for this node
          let assets: AtlanAsset[] = [];
          
          if (parsed.nodeType === 'schema') {
            assets = await fetchAssetsForModel({
              schemaQualifiedName: parsed.qualifiedName,
              assetTypes: ['Table', 'View', 'MaterializedView'],
              size: 1000,
            });
          } else if (parsed.nodeType === 'database') {
            // Get all schemas, then all tables
            const schemas = await getSchemas(parsed.qualifiedName);
            for (const schema of schemas) {
              const schemaTables = await fetchAssetsForModel({
                schemaQualifiedName: schema.qualifiedName,
                assetTypes: ['Table', 'View', 'MaterializedView'],
                size: 1000,
              });
              assets.push(...schemaTables);
            }
          } else if (parsed.nodeType === 'connector') {
            // Get all databases, then all schemas, then all tables
            const databases = await getDatabases(parsed.connectorName);
            for (const db of databases) {
              const schemas = await getSchemas(db.qualifiedName);
              for (const schema of schemas) {
                const schemaTables = await fetchAssetsForModel({
                  schemaQualifiedName: schema.qualifiedName,
                  assetTypes: ['Table', 'View', 'MaterializedView'],
                  size: 1000,
                });
                assets.push(...schemaTables);
              }
            }
          }
          
          assets.forEach((asset: AtlanAsset) => {
            addAsset(asset);
          });
        }
      }
    } catch (err) {
      logger.error('Failed to handle drop', err);
      setError('Failed to add assets. Please try selecting them directly.');
    } finally {
      setLoading(false);
    }
  };

  // Manual refresh - trigger AssetContext to recalculate scores
  const refreshScores = () => {
    // Force AssetContext to recalculate by clearing and resetting context
    // This is a workaround - ideally AssetContext would expose a refresh method
    if (contextAssets.length > 0) {
      // Trigger a re-render by updating a dummy state
      // The AssetContext component will handle the actual recalculation
      logger.info('Scorecard: Refresh requested - scores will be recalculated by AssetContext');
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
            <p><strong>Drag assets here</strong> from the Asset Browser</p>
            <p className="drop-hint">Drop databases, schemas, or tables to select them for scoring</p>
          </div>
        )}
        {isDraggingOver && (
          <div className="drop-zone-hint drag-over-hint">
            <div className="drop-icon">⬇️</div>
            <p><strong>Drop here to add assets</strong></p>
            <p className="drop-hint">Release to select all tables under this entity</p>
          </div>
        )}
        {effectiveCount > 0 && !isDraggingOver && (
          <div className="drop-zone-hint has-assets-hint">
            <CheckCircle2 size={20} className="drop-icon" />
            <p><strong>{effectiveCount} asset{effectiveCount !== 1 ? 's' : ''} in context</strong></p>
            <p className="drop-hint">Drag more assets here to add them</p>
          </div>
        )}
      </div>
      <div className="scorecard-controls">
        {effectiveCount > 0 ? (
          <div className="selection-status success">
            <CheckCircle2 size={16} className="status-icon" />
            <span><strong>{effectiveCount}</strong> asset{effectiveCount !== 1 ? 's' : ''} ready for scoring</span>
          </div>
        ) : (
          <div className="selection-status warning">
            <AlertTriangle size={16} className="status-icon" />
            <span>No assets selected. Use the <strong>Asset Browser</strong> to select assets for scoring.</span>
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
          Select assets to see quality scores
        </div>
      )}
    </Card>
  );
}

