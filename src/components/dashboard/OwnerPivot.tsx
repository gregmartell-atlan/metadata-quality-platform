import { useState, useEffect } from 'react';
import { Eye } from 'lucide-react';
import { Card, Tooltip } from '../shared';
import { ScoreBadge } from '../shared';
import { useScoresStore } from '../../stores/scoresStore';
import { useUIPreferences } from '../../stores/uiPreferencesStore';
import { useAssetPreviewStore } from '../../stores/assetPreviewStore';
import {
  getScoreBandByName,
  getQualityDimensionInfo,
  getPivotDimensionInfo,
} from '../../constants/metadataDescriptions';
import './OwnerPivot.css';

type RowDimension = 'owner' | 'tag' | 'certification' | 'classification' | 'assetType' | 'schema' | 'connection';
type ColumnDimension = 'completeness' | 'accuracy' | 'timeliness' | 'consistency' | 'usability';

export function OwnerPivot() {
  const { byOwner, byTag, byCertification, byClassification, byAssetType, bySchema, byConnection } = useScoresStore();
  const { dashboardOwnerPivotDimension, dashboardOwnerPivotColumn, setDashboardOwnerPivotDimension, setDashboardOwnerPivotColumn } = useUIPreferences();
  const { openPreview } = useAssetPreviewStore();
  const [rowDimension, setRowDimension] = useState<RowDimension>(
    (dashboardOwnerPivotDimension === 'owner' ? 'owner' : dashboardOwnerPivotDimension) as RowDimension
  );
  const [columnDimension, setColumnDimension] = useState<ColumnDimension>(dashboardOwnerPivotColumn as ColumnDimension);

  // Sync with global preferences
  useEffect(() => {
    setRowDimension((dashboardOwnerPivotDimension === 'ownerGroup' ? 'owner' : dashboardOwnerPivotDimension) as RowDimension);
  }, [dashboardOwnerPivotDimension]);

  useEffect(() => {
    setColumnDimension(dashboardOwnerPivotColumn as ColumnDimension);
  }, [dashboardOwnerPivotColumn]);
  
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
      assets, // Keep reference for preview
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

  // Handle row click to preview first asset
  const handleRowClick = (assets: typeof assetsWithScores) => {
    if (assets.length > 0) {
      openPreview(assets[0].asset);
    }
  };
  
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
              onChange={(e) => {
                const newDimension = e.target.value as RowDimension;
                setRowDimension(newDimension);
                setDashboardOwnerPivotDimension(newDimension === 'owner' ? 'ownerGroup' : newDimension);
              }}
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
              onChange={(e) => {
                const newColumn = e.target.value as ColumnDimension;
                setColumnDimension(newColumn);
                setDashboardOwnerPivotColumn(newColumn);
              }}
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
            <Tooltip
              content="Count of assets in each score band for this group"
              position="top"
            >
              <span className="pivot-chip">
                Asset Count
              </span>
            </Tooltip>
            <Tooltip
              content="Average score across all assets in this group"
              position="top"
            >
              <span className="pivot-chip">
                Avg Score
              </span>
            </Tooltip>
          </div>
        </div>
      </div>
      <div className="card-body" style={{ padding: 0 }}>
        <div className="pivot-table-container">
          <table className="pivot-table">
            <thead>
              <tr>
                <th>
                  <Tooltip
                    content={
                      <div className="pivot-dimension-tooltip">
                        <strong>{getPivotDimensionInfo(rowDimension)?.name || getRowLabel()}</strong>
                        <p>{getPivotDimensionInfo(rowDimension)?.description || 'Group dimension for rows'}</p>
                      </div>
                    }
                    position="bottom"
                    maxWidth={250}
                  >
                    <span className="pivot-header-label">{getRowLabel()}</span>
                  </Tooltip>
                </th>
                <th className="measure">
                  <Tooltip
                    content={
                      <div className="score-band-tooltip">
                        <strong>{getScoreBandByName('critical')?.name} ({getScoreBandByName('critical')?.range})</strong>
                        <p>{getScoreBandByName('critical')?.description}</p>
                        <div className="score-band-action">{getScoreBandByName('critical')?.action}</div>
                      </div>
                    }
                    position="bottom"
                    maxWidth={280}
                  >
                    <span className="pivot-header-label score-critical">Critical (0-24)</span>
                  </Tooltip>
                </th>
                <th className="measure">
                  <Tooltip
                    content={
                      <div className="score-band-tooltip">
                        <strong>{getScoreBandByName('poor')?.name} ({getScoreBandByName('poor')?.range})</strong>
                        <p>{getScoreBandByName('poor')?.description}</p>
                        <div className="score-band-action">{getScoreBandByName('poor')?.action}</div>
                      </div>
                    }
                    position="bottom"
                    maxWidth={280}
                  >
                    <span className="pivot-header-label score-poor">Poor (25-49)</span>
                  </Tooltip>
                </th>
                <th className="measure">
                  <Tooltip
                    content={
                      <div className="score-band-tooltip">
                        <strong>{getScoreBandByName('fair')?.name} ({getScoreBandByName('fair')?.range})</strong>
                        <p>{getScoreBandByName('fair')?.description}</p>
                        <div className="score-band-action">{getScoreBandByName('fair')?.action}</div>
                      </div>
                    }
                    position="bottom"
                    maxWidth={280}
                  >
                    <span className="pivot-header-label score-fair">Fair (50-74)</span>
                  </Tooltip>
                </th>
                <th className="measure">
                  <Tooltip
                    content={
                      <div className="score-band-tooltip">
                        <strong>{getScoreBandByName('good')?.name} ({getScoreBandByName('good')?.range})</strong>
                        <p>{getScoreBandByName('good')?.description}</p>
                        <div className="score-band-action">{getScoreBandByName('good')?.action}</div>
                      </div>
                    }
                    position="bottom"
                    maxWidth={280}
                  >
                    <span className="pivot-header-label score-good">Good (75-100)</span>
                  </Tooltip>
                </th>
                <th className="measure">
                  <Tooltip content="Total number of assets in this group" position="bottom">
                    <span className="pivot-header-label">Total Assets</span>
                  </Tooltip>
                </th>
                <th className="measure">
                  <Tooltip
                    content={
                      <div className="quality-dimension-tooltip">
                        <strong>Average {getQualityDimensionInfo(columnDimension)?.name} Score</strong>
                        <p>{getQualityDimensionInfo(columnDimension)?.description}</p>
                      </div>
                    }
                    position="bottom"
                    maxWidth={280}
                  >
                    <span className="pivot-header-label">Avg Score</span>
                  </Tooltip>
                </th>
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
                <tr key={idx} className="pivot-row-clickable">
                  <td
                    className={`dimension-cell dimension-cell-clickable ${group.name === 'Unowned' || group.name.startsWith('No ') || group.name === 'Not Certified' ? 'unowned' : ''}`}
                    onClick={() => handleRowClick(group.assets)}
                    title={`Click to preview assets in ${group.name}`}
                  >
                    <span className="dimension-cell-name">
                      {group.name === 'Unowned' ? '⚠ Unowned' : group.name.startsWith('No ') ? `⚠ ${group.name}` : group.name === 'Not Certified' ? '⚠ Not Certified' : group.name}
                    </span>
                    <span className="dimension-cell-count">
                      <Eye size={12} />
                      {group.total}
                    </span>
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

