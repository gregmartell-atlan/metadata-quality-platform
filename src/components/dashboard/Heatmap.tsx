import { useState } from 'react';
import { Card } from '../shared';
import { useScoresStore } from '../../stores/scoresStore';
import './Heatmap.css';

type PivotDimension = 'domain' | 'owner' | 'schema' | 'connection' | 'tag' | 'certification' | 'classification' | 'assetType';

export function Heatmap() {
  const { byDomain, byOwner, bySchema, byConnection, byTag, byCertification, byClassification, byAssetType, groupBy, assetsWithScores } = useScoresStore();
  const [pivotDimension, setPivotDimension] = useState<PivotDimension>('domain');
  
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
    scores: calculateGroupScores(assets),
  })).sort((a, b) => b.scores.overall - a.scores.overall);
  const getScoreClass = (score: number): string => {
    if (score >= 80) return 'excellent';
    if (score >= 60) return 'good';
    if (score >= 40) return 'fair';
    if (score >= 20) return 'poor';
    return 'critical';
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
          onChange={(e) => setPivotDimension(e.target.value as PivotDimension)}
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
              <th>{getDimensionLabel()}</th>
              <th>Completeness</th>
              <th>Accuracy</th>
              <th>Timeliness</th>
              <th>Consistency</th>
              <th>Usability</th>
              <th>Overall</th>
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
                <tr key={item.key}>
                  <td>{item.key}</td>
                  <td>
                    <span className={`heatmap-cell ${getScoreClass(item.scores.completeness)}`}>
                      {item.scores.completeness}
                    </span>
                  </td>
                  <td>
                    <span className={`heatmap-cell ${getScoreClass(item.scores.accuracy)}`}>
                      {item.scores.accuracy}
                    </span>
                  </td>
                  <td>
                    <span className={`heatmap-cell ${getScoreClass(item.scores.timeliness)}`}>
                      {item.scores.timeliness}
                    </span>
                  </td>
                  <td>
                    <span className={`heatmap-cell ${getScoreClass(item.scores.consistency)}`}>
                      {item.scores.consistency}
                    </span>
                  </td>
                  <td>
                    <span className={`heatmap-cell ${getScoreClass(item.scores.usability)}`}>
                      {item.scores.usability}
                    </span>
                  </td>
                  <td className="heatmap-row-avg">{item.scores.overall}</td>
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

