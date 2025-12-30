import React, { useState, useEffect, useMemo } from 'react';
import { Card, Button } from '../shared';
import { useAssetStore } from '../../stores/assetStore';
import { useScoresStore } from '../../stores/scoresStore';
import { transformAtlanAsset } from '../../services/atlan/transformer';
import { calculateAssetQuality, type QualityScores } from '../../services/qualityMetrics';
import { fetchAssetsForModel, getSchemas, getDatabases, getAtlanConfig } from '../../services/atlan/api';
import { initializeScoringService, scoreAssets } from '../../services/scoringService';
import { useScoringSettingsStore } from '../../stores/scoringSettingsStore';
import { ScoringSettings } from '../settings/ScoringSettings';
import type { AtlanAsset } from '../../services/atlan/types';
import type { AtlanAsset as ScoringAtlanAsset } from '../../scoring/contracts';
import { logger } from '../../utils/logger';

export function Scorecard() {
  const { selectedAssets, selectedCount, addAsset } = useAssetStore();
  const { setAssetsWithScores, assetsWithScores } = useScoresStore();
  const { scoringMode } = useScoringSettingsStore();
  const [trend, setTrend] = useState<number>(4.2); // Placeholder for trend logic
  const [error, setError] = useState<string | null>(null);
  const [isDraggingOver, setIsDraggingOver] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [configDrivenScores, setConfigDrivenScores] = useState<QualityScores | null>(null);
  
  const { setConfigVersion } = useScoringSettingsStore();

  // Initialize scoring service when Atlan config is available
  useEffect(() => {
    const initService = async () => {
      const config = getAtlanConfig();
      if (config && scoringMode === "config-driven") {
        // Set callbacks for config version and scoring mode
        const { setConfigVersionCallback, setScoringModeGetter } = await import("../../services/scoringService");
        setConfigVersionCallback(setConfigVersion);
        setScoringModeGetter(() => scoringMode);
        initializeScoringService(config.baseUrl, config.apiKey);
      }
    };
    initService();
  }, [scoringMode, setConfigVersion]);

  // Auto-calculate scores when selected assets change
  const scores = useMemo(() => {
    if (selectedAssets.length === 0) {
      return configDrivenScores;
    }
    
    if (scoringMode === "config-driven") {
      return configDrivenScores;
    }
    
    // Legacy scoring
    try {
      // Transform Atlan assets to AssetMetadata and calculate scores
      const agg = { completeness: 0, accuracy: 0, timeliness: 0, consistency: 0, usability: 0 };
      selectedAssets.forEach(asset => {
        const metadata = transformAtlanAsset(asset);
        const s = calculateAssetQuality(metadata);
        agg.completeness += s.completeness;
        agg.accuracy += s.accuracy;
        agg.timeliness += s.timeliness;
        agg.consistency += s.consistency;
        agg.usability += s.usability;
      });
      const n = selectedAssets.length;
      return {
        completeness: Math.round(agg.completeness / n),
        accuracy: Math.round(agg.accuracy / n),
        timeliness: Math.round(agg.timeliness / n),
        consistency: Math.round(agg.consistency / n),
        usability: Math.round(agg.usability / n),
      };
    } catch (e: any) {
      logger.error('Error calculating scores', e);
      return null;
    }
  }, [selectedAssets, scoringMode, configDrivenScores]);

  // Calculate config-driven scores when assets change and mode is config-driven
  useEffect(() => {
    if (scoringMode === "config-driven" && selectedAssets.length > 0) {
      const calculateConfigScores = async () => {
        try {
          setLoading(true);
          // Transform legacy assets to scoring format
          const scoringAssets: ScoringAtlanAsset[] = selectedAssets.map(asset => ({
            guid: asset.guid,
            typeName: asset.typeName as any,
            name: asset.name,
            qualifiedName: asset.qualifiedName,
            connectionName: asset.connectionName,
            description: asset.description,
            userDescription: asset.userDescription,
            ownerUsers: asset.ownerUsers,
            ownerGroups: asset.ownerGroups,
            certificateStatus: asset.certificateStatus,
            certificateUpdatedAt: asset.certificateUpdatedAt,
            classificationNames: asset.classificationNames,
            meanings: asset.meanings,
            domainGUIDs: asset.domainGUIDs,
            updateTime: asset.updateTime,
            sourceUpdatedAt: asset.sourceUpdatedAt,
            sourceLastReadAt: asset.sourceLastReadAt,
            lastRowChangedAt: asset.lastRowChangedAt,
            popularityScore: asset.popularityScore,
            viewScore: asset.viewScore,
            starredCount: asset.starredCount,
            __hasLineage: asset.__hasLineage,
            readme: asset.readme,
            isDiscoverable: asset.isDiscoverable,
          }));

          const results = await scoreAssets(scoringAssets);
          
          // Aggregate scores across all assets and profiles
          const agg = { completeness: 0, accuracy: 0, timeliness: 0, consistency: 0, usability: 0 };
          let count = 0;
          
          results.forEach((profileResults) => {
            profileResults.forEach(result => {
              if (result.dimensions) {
                result.dimensions.forEach(dim => {
                  const score100 = dim.score01 * 100;
                  if (dim.dimension === "completeness") agg.completeness += score100;
                  else if (dim.dimension === "accuracy") agg.accuracy += score100;
                  else if (dim.dimension === "timeliness") agg.timeliness += score100;
                  else if (dim.dimension === "consistency") agg.consistency += score100;
                  else if (dim.dimension === "usability") agg.usability += score100;
                });
                count++;
              }
            });
          });
          
          if (count > 0) {
            const n = count;
            setConfigDrivenScores({
              completeness: Math.round(agg.completeness / n),
              accuracy: Math.round(agg.accuracy / n),
              timeliness: Math.round(agg.timeliness / n),
              consistency: Math.round(agg.consistency / n),
              usability: Math.round(agg.usability / n),
            });
          }
        } catch (e: any) {
          logger.error('Error calculating config-driven scores', e);
          setError(e.message || 'Failed to calculate scores');
        } finally {
          setLoading(false);
        }
      };
      
      calculateConfigScores();
    } else {
      setConfigDrivenScores(null);
    }
  }, [selectedAssets, scoringMode]);
  
  // Update scores store when assets change
  useEffect(() => {
    if (selectedAssets.length > 0) {
      setAssetsWithScores(selectedAssets);
    }
  }, [selectedAssets, setAssetsWithScores]);

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

  // Scores are now auto-calculated via useMemo, but keep this for manual refresh if needed
  const refreshScores = () => {
    if (selectedAssets.length > 0) {
      setAssetsWithScores(selectedAssets);
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
        className={`scorecard-drop-zone ${isDraggingOver ? 'drag-over' : ''} ${selectedCount > 0 ? 'has-assets' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {selectedCount === 0 && !isDraggingOver && (
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
        {selectedCount > 0 && !isDraggingOver && (
          <div className="drop-zone-hint has-assets-hint">
            <div className="drop-icon">✓</div>
            <p><strong>{selectedCount} asset{selectedCount !== 1 ? 's' : ''} selected</strong></p>
            <p className="drop-hint">Drag more assets here to add them</p>
          </div>
        )}
      </div>
      <div className="scorecard-controls">
        {selectedCount > 0 ? (
          <div className="selection-status success">
            <span className="status-icon">✓</span>
            <span><strong>{selectedCount}</strong> asset{selectedCount !== 1 ? 's' : ''} ready for scoring</span>
          </div>
        ) : (
          <div className="selection-status warning">
            <span className="status-icon">⚠️</span>
            <span>No assets selected. Use the <strong>Asset Browser</strong> to select assets for scoring.</span>
          </div>
        )}
        {selectedCount > 0 && (
          <Button 
            onClick={refreshScores} 
            variant="secondary"
            style={{ marginTop: 12, width: '100%' }}
          >
            ↻ Refresh Scores
          </Button>
        )}
      </div>
      {error && <div style={{ color: 'red', padding: '8px', marginBottom: '12px' }}>Error: {error}</div>}
      {loading && <div style={{ padding: '8px', marginBottom: '12px' }}>Calculating scores...</div>}
      {scoringMode === "config-driven" && <div style={{ fontSize: '0.875rem', color: '#666', marginBottom: '12px' }}>Using config-driven scoring</div>}
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
      {!scores && selectedCount === 0 && (
        <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)' }}>
          Select assets to see quality scores
        </div>
      )}
    </Card>
  );
}

