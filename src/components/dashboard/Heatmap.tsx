import { useState, useEffect } from 'react';
import { Eye } from 'lucide-react';
import { Card, Tooltip } from '../shared';
import { useScoresStore } from '../../stores/scoresStore';
import { useUIPreferences } from '../../stores/uiPreferencesStore';
import { useAssetPreviewStore } from '../../stores/assetPreviewStore';
import {
  getQualityDimensionInfo,
  getScoreBandInfo,
  getPivotDimensionInfo,
} from '../../constants/metadataDescriptions';
import { getScoreClass } from '../../utils/scoreThresholds';
import './Heatmap.css';

type PivotDimension = 'domain' | 'owner' | 'schema' | 'connection' | 'tag' | 'certification' | 'classification' | 'assetType';

export function Heatmap() {
  const { byDomain, byOwner, bySchema, byConnection, byTag, byCertification, byClassification, byAssetType } = useScoresStore();
  const { dashboardHeatmapDimension, setDashboardHeatmapDimension } = useUIPreferences();
  const { openPreview } = useAssetPreviewStore();
  const [pivotDimension, setPivotDimension] = useState<PivotDimension>(dashboardHeatmapDimension as PivotDimension);

  // Sync with global preference
  useEffect(() => {
    setPivotDimension(dashboardHeatmapDimension as PivotDimension);
  }, [dashboardHeatmapDimension]);
  
  // Get the appropriate map based on pivot dimension
  const getPivotMap = () => {
    switch (pivotDimension) {
      case 'owner':
        return byOwner;
      case 'schema':
        return bySchema;
      case 'connection':
        return byConnection;
      case 'tag':
        return byTag;
      case 'certification':
        return byCertification;
      case 'classification':
        return byClassification;
      case 'assetType':
        return byAssetType;
      case 'domain':
      default:
        return byDomain;
    }
  };
  
  // Calculate quality scores for each pivot group
  const calculateGroupScores = (assets: typeof assetsWithScores) => {
    if (assets.length === 0) {
      return {
        completeness: 0,
        accuracy: 0,
        timeliness: 0,
        consistency: 0,
        usability: 0,
        overall: 0,
      };
    }
    
    const totals = assets.reduce(
      (acc, { scores }) => ({
        completeness: acc.completeness + scores.completeness,
        accuracy: acc.accuracy + scores.accuracy,
        timeliness: acc.timeliness + scores.timeliness,
        consistency: acc.consistency + scores.consistency,
        usability: acc.usability + scores.usability,
      }),
      { completeness: 0, accuracy: 0, timeliness: 0, consistency: 0, usability: 0 }
    );
    
    const count = assets.length;
    return {
      completeness: Math.round(totals.completeness / count),
      accuracy: Math.round(totals.accuracy / count),
      timeliness: Math.round(totals.timeliness / count),
      consistency: Math.round(totals.consistency / count),
      usability: Math.round(totals.usability / count),
      overall: Math.round(
        (totals.completeness + totals.accuracy + totals.timeliness + totals.consistency + totals.usability) /
        (count * 5)
      ),
    };
  };
  
  const pivotMap = getPivotMap();
  const pivotData = Array.from(pivotMap.entries()).map(([key, assets]) => ({
    key,
    assets, // Keep reference to assets for preview
    scores: calculateGroupScores(assets),
  })).sort((a, b) => b.scores.overall - a.scores.overall);

  // Handle row click to preview first asset
  const handleRowClick = (assets: typeof assetsWithScores) => {
    if (assets.length > 0) {
      openPreview(assets[0].asset);
    }
  };

  const getDimensionLabel = () => {
    switch (pivotDimension) {
      case 'owner':
        return 'Owner';
      case 'schema':
        return 'Schema';
      case 'connection':
        return 'Connection';
      case 'tag':
        return 'Tag';
      case 'certification':
        return 'Certification Status';
      case 'classification':
        return 'Classification';
      case 'assetType':
        return 'Asset Type';
      case 'domain':
      default:
        return 'Domain';
    }
  };
  
  return (
    <Card className="heatmap-card" title={`Quality by ${getDimensionLabel()} × Dimension`}>
      <div className="heatmap-controls" style={{ marginBottom: '12px', display: 'flex', gap: '8px', alignItems: 'center' }}>
        <label style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Pivot by:</label>
        <select
          value={pivotDimension}
          onChange={(e) => {
            const newDimension = e.target.value as PivotDimension;
            setPivotDimension(newDimension);
            setDashboardHeatmapDimension(newDimension);
          }}
          style={{
            padding: '4px 8px',
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-color)',
            borderRadius: '4px',
            color: 'var(--text-primary)',
            fontSize: '12px',
          }}
        >
          <option value="domain">Domain</option>
          <option value="owner">Owner</option>
          <option value="schema">Schema</option>
          <option value="connection">Connection</option>
          <option value="tag">Tag</option>
          <option value="certification">Certification Status</option>
          <option value="classification">Classification</option>
          <option value="assetType">Asset Type</option>
        </select>
      </div>
      <div className="heatmap-container">
        <table className="heatmap">
          <thead>
            <tr>
              <th>
                <Tooltip
                  content={
                    <div className="heatmap-dimension-tooltip">
                      <strong>{getPivotDimensionInfo(pivotDimension)?.name || getDimensionLabel()}</strong>
                      <p>{getPivotDimensionInfo(pivotDimension)?.description || 'Pivot dimension'}</p>
                    </div>
                  }
                  position="bottom"
                  maxWidth={250}
                >
                  <span className="heatmap-header-label">{getDimensionLabel()}</span>
                </Tooltip>
              </th>
              {(['completeness', 'accuracy', 'timeliness', 'consistency', 'usability', 'overall'] as const).map((dim) => {
                const dimInfo = getQualityDimensionInfo(dim);
                return (
                  <th key={dim}>
                    <Tooltip
                      content={
                        <div className="heatmap-quality-tooltip">
                          <strong>{dimInfo?.name}</strong>
                          <p>{dimInfo?.description}</p>
                          {dimInfo?.factors && dim !== 'overall' && (
                            <div className="heatmap-quality-factors">
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
                      position="bottom"
                      maxWidth={280}
                    >
                      <span className="heatmap-header-label">{dimInfo?.name}</span>
                    </Tooltip>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {pivotData.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)' }}>
                  No assets selected. Select assets and calculate scores to see quality breakdown.
                </td>
              </tr>
            ) : (
              pivotData.map((item) => (
                <tr key={item.key} className="heatmap-row-clickable">
                  <td
                    className="heatmap-row-label"
                    onClick={() => handleRowClick(item.assets)}
                    title={`Click to preview assets in ${item.key}`}
                  >
                    <span className="heatmap-row-name">{item.key}</span>
                    <span className="heatmap-row-count">
                      <Eye size={12} />
                      {item.assets.length}
                    </span>
                  </td>
                  {(['completeness', 'accuracy', 'timeliness', 'consistency', 'usability'] as const).map((dim) => {
                    const score = item.scores[dim];
                    const bandInfo = getScoreBandInfo(score);
                    const dimInfo = getQualityDimensionInfo(dim);
                    return (
                      <td key={dim}>
                        <Tooltip
                          content={
                            <div className="heatmap-cell-tooltip">
                              <div className="heatmap-cell-tooltip-header">
                                <span>{item.key}</span>
                                <span>×</span>
                                <span>{dimInfo?.name}</span>
                              </div>
                              <div className="heatmap-cell-tooltip-score">
                                <span className="score-value">{score}</span>
                                <span className={`score-band score-band-${getScoreClass(score)}`}>
                                  {bandInfo.name}
                                </span>
                              </div>
                              <p className="heatmap-cell-tooltip-desc">{bandInfo.description}</p>
                              <div className="heatmap-cell-tooltip-action">{bandInfo.action}</div>
                            </div>
                          }
                          position="top"
                          maxWidth={280}
                        >
                          <span className={`heatmap-cell ${getScoreClass(score)}`}>
                            {score}
                          </span>
                        </Tooltip>
                      </td>
                    );
                  })}
                  <td className="heatmap-row-avg">
                    <Tooltip
                      content={
                        <div className="heatmap-overall-tooltip">
                          <strong>{item.key} - Overall Score</strong>
                          <p>Weighted average of all quality dimensions for assets in this group.</p>
                          <div className="heatmap-overall-breakdown">
                            <div>Completeness: {item.scores.completeness}</div>
                            <div>Accuracy: {item.scores.accuracy}</div>
                            <div>Timeliness: {item.scores.timeliness}</div>
                            <div>Consistency: {item.scores.consistency}</div>
                            <div>Usability: {item.scores.usability}</div>
                          </div>
                        </div>
                      }
                      position="left"
                      maxWidth={250}
                    >
                      <span className="heatmap-overall-score">{item.scores.overall}</span>
                    </Tooltip>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <div className="heatmap-legend">
        <div className="legend-item">
          <div className="legend-color" style={{ background: 'var(--score-excellent)' }}></div>
          Excellent (80+)
        </div>
        <div className="legend-item">
          <div className="legend-color" style={{ background: 'var(--score-good)' }}></div>
          Good (60-79)
        </div>
        <div className="legend-item">
          <div className="legend-color" style={{ background: 'var(--score-fair)' }}></div>
          Fair (40-59)
        </div>
        <div className="legend-item">
          <div className="legend-color" style={{ background: 'var(--score-poor)' }}></div>
          Poor (20-39)
        </div>
        <div className="legend-item">
          <div className="legend-color" style={{ background: 'var(--score-critical)' }}></div>
          Critical (&lt;20)
        </div>
      </div>
    </Card>
  );
}

