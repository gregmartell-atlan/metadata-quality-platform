import { useState } from 'react';
import { Card } from '../shared';
import { ScoreBadge } from '../shared';
import { useScoresStore } from '../../stores/scoresStore';
import './OwnerPivot.css';

type RowDimension = 'owner' | 'tag' | 'certification' | 'classification' | 'assetType' | 'schema' | 'connection';
type ColumnDimension = 'completeness' | 'accuracy' | 'timeliness' | 'consistency' | 'usability';

export function OwnerPivot() {
  const { byOwner, byTag, byCertification, byClassification, byAssetType, bySchema, byConnection, groupBy } = useScoresStore();
  const [rowDimension, setRowDimension] = useState<RowDimension>('owner');
  const [columnDimension, setColumnDimension] = useState<ColumnDimension>('completeness');
  
  // Get the appropriate map based on row dimension
  const getRowMap = () => {
    switch (rowDimension) {
      case 'tag':
        return byTag;
      case 'certification':
        return byCertification;
      case 'classification':
        return byClassification;
      case 'assetType':
        return byAssetType;
      case 'schema':
        return bySchema;
      case 'connection':
        return byConnection;
      case 'owner':
      default:
        return byOwner;
    }
  };
  
  // Group assets and calculate score bands
  const groups = Array.from(getRowMap().entries()).map(([name, assets]) => {
    let critical = 0;
    let poor = 0;
    let fair = 0;
    let good = 0;
    let totalScore = 0;
    
    assets.forEach(({ scores }) => {
      const score = scores[columnDimension];
      if (score < 25) critical++;
      else if (score < 50) poor++;
      else if (score < 75) fair++;
      else good++;
      totalScore += score;
    });
    
    const avgScore = assets.length > 0 ? Math.round(totalScore / assets.length) : 0;
    
    return {
      name,
      critical,
      poor,
      fair,
      good,
      total: assets.length,
      avgScore,
    };
  }).sort((a, b) => {
    // Sort "No X" / "Unowned" to bottom
    if (a.name.startsWith('No ') || a.name === 'Unowned' || a.name === 'Not Certified') return 1;
    if (b.name.startsWith('No ') || b.name === 'Unowned' || b.name === 'Not Certified') return -1;
    return b.total - a.total;
  });
  
  const getRowLabel = () => {
    switch (rowDimension) {
      case 'tag': return 'Tag';
      case 'certification': return 'Certification';
      case 'classification': return 'Classification';
      case 'assetType': return 'Asset Type';
      case 'schema': return 'Schema';
      case 'connection': return 'Connection';
      case 'owner':
      default: return 'Owner Group';
    }
  };
  
  const getColumnLabel = () => {
    switch (columnDimension) {
      case 'accuracy': return 'Accuracy';
      case 'timeliness': return 'Timeliness';
      case 'consistency': return 'Consistency';
      case 'usability': return 'Usability';
      case 'completeness':
      default: return 'Completeness';
    }
  };
  return (
    <Card className="pivot-card" title={`Assets by ${getRowLabel()} × ${getColumnLabel()} Score`}>
      <div className="pivot-controls">
        <div className="pivot-shelf">
          <div className="pivot-shelf-label">Rows</div>
          <div className="pivot-shelf-items">
            <select
              value={rowDimension}
              onChange={(e) => setRowDimension(e.target.value as RowDimension)}
              className="pivot-select"
              style={{
                padding: '4px 8px',
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border-color)',
                borderRadius: '4px',
                color: 'var(--text-primary)',
                fontSize: '12px',
              }}
            >
              <option value="owner">Owner Group</option>
              <option value="tag">Tag</option>
              <option value="certification">Certification Status</option>
              <option value="classification">Classification</option>
              <option value="assetType">Asset Type</option>
              <option value="schema">Schema</option>
              <option value="connection">Connection</option>
            </select>
          </div>
        </div>
        <div className="pivot-shelf">
          <div className="pivot-shelf-label">Columns</div>
          <div className="pivot-shelf-items">
            <select
              value={columnDimension}
              onChange={(e) => setColumnDimension(e.target.value as ColumnDimension)}
              className="pivot-select"
              style={{
                padding: '4px 8px',
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border-color)',
                borderRadius: '4px',
                color: 'var(--text-primary)',
                fontSize: '12px',
              }}
            >
              <option value="completeness">Completeness Band</option>
              <option value="accuracy">Accuracy Band</option>
              <option value="timeliness">Timeliness Band</option>
              <option value="consistency">Consistency Band</option>
              <option value="usability">Usability Band</option>
            </select>
          </div>
        </div>
        <div className="pivot-shelf">
          <div className="pivot-shelf-label">Measures</div>
          <div className="pivot-shelf-items">
            <span className="pivot-chip">
              Asset Count
            </span>
            <span className="pivot-chip">
              Avg Score
            </span>
          </div>
        </div>
      </div>
      <div className="card-body" style={{ padding: 0 }}>
        <div className="pivot-table-container">
          <table className="pivot-table">
            <thead>
              <tr>
                <th>{getRowLabel()}</th>
                <th className="measure">Critical (0-24)</th>
                <th className="measure">Poor (25-49)</th>
                <th className="measure">Fair (50-74)</th>
                <th className="measure">Good (75-100)</th>
                <th className="measure">Total Assets</th>
                <th className="measure">Avg Score</th>
              </tr>
            </thead>
            <tbody>
              {groups.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)' }}>
                    No assets selected. Select assets and calculate scores to see owner accountability.
                  </td>
                </tr>
              ) : (
                groups.map((group, idx) => (
                <tr key={idx}>
                  <td className={`dimension-cell ${group.name === 'Unowned' || group.name.startsWith('No ') || group.name === 'Not Certified' ? 'unowned' : ''}`}>
                    {group.name === 'Unowned' ? '⚠ Unowned' : group.name.startsWith('No ') ? `⚠ ${group.name}` : group.name === 'Not Certified' ? '⚠ Not Certified' : group.name}
                  </td>
                  <td className={`measure ${group.name === 'Unowned' || group.name.startsWith('No ') || group.name === 'Not Certified' ? 'unowned' : ''}`}>
                    {group.critical}
                  </td>
                  <td className="measure">{group.poor}</td>
                  <td className="measure">{group.fair}</td>
                  <td className="measure">{group.good}</td>
                  <td className={`measure ${group.name === 'Unowned' || group.name.startsWith('No ') || group.name === 'Not Certified' ? 'unowned' : ''}`}>
                    <strong>{group.total}</strong>
                  </td>
                  <td className="measure">
                    <ScoreBadge score={group.avgScore} />
                  </td>
                </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </Card>
  );
}

