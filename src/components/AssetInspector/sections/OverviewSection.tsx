/**
 * Overview Section
 *
 * Default tab showing key asset information and stats
 */

import { Table2, Database, Folder, Copy, Check } from 'lucide-react';
import { useState } from 'react';
import type { AtlanAsset } from '../../../services/atlan/types';
import { useScoresStore } from '../../../stores/scoresStore';
import { ScoreBadge } from '../../shared/ScoreBadge';
import { getPopularityDisplay, formatQueryCount } from '../../../utils/popularityScore';

interface OverviewSectionProps {
  asset: AtlanAsset;
}

export function OverviewSection({ asset }: OverviewSectionProps) {
  const [copied, setCopied] = useState(false);
  const { assetsWithScores } = useScoresStore();

  // Find quality scores for this asset
  const assetWithScore = assetsWithScores.find(a => a.asset.guid === asset.guid);
  const qualityScore = assetWithScore?.scores;

  const handleCopyQualifiedName = async () => {
    await navigator.clipboard.writeText(asset.qualifiedName);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formatBytes = (bytes: number | undefined): string => {
    if (!bytes) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let size = bytes;
    let unitIndex = 0;
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }
    return `${size.toFixed(1)} ${units[unitIndex]}`;
  };

  const formatDate = (timestamp: number | undefined): string => {
    if (!timestamp) return 'Never';
    return new Date(timestamp).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <div className="overview-section">
      {/* Asset Identity */}
      <div className="inspector-section">
        <div className="asset-header">
          <div className="asset-type-badge">
            <Table2 size={20} />
            <span>{asset.typeName}</span>
          </div>
          {asset.certificateStatus && (
            <span className={`inspector-badge ${asset.certificateStatus.toLowerCase()}`}>
              {asset.certificateStatus}
            </span>
          )}
        </div>

        {/* Qualified Name with Copy */}
        <div className="qualified-name-row">
          <code className="qualified-name">{asset.qualifiedName}</code>
          <button
            className="copy-btn"
            onClick={handleCopyQualifiedName}
            title="Copy qualified name"
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
          </button>
        </div>

        {/* Breadcrumb */}
        <div className="breadcrumb">
          <Database size={14} />
          <span>{asset.databaseName || asset.connectionName}</span>
          {asset.schemaName && (
            <>
              <span className="breadcrumb-separator">›</span>
              <Folder size={14} />
              <span>{asset.schemaName}</span>
            </>
          )}
        </div>
      </div>

      {/* Quality Score (if available) */}
      {qualityScore && (
        <div className="inspector-section">
          <div className="section-title">Quality Score</div>
          <div className="quality-score-large">
            <ScoreBadge score={qualityScore.overall} showLabel size="large" />
            <div className="score-details">
              <p>Overall quality based on 5 dimensions</p>
              <p className="score-hint">See Quality tab for detailed breakdown</p>
            </div>
          </div>
        </div>
      )}

      {/* Key Stats */}
      <div className="inspector-section">
        <div className="section-title">Key Statistics</div>
        <div className="stats-grid">
          {asset.rowCount !== undefined && (
            <div className="stat-item">
              <div className="stat-label">Rows</div>
              <div className="stat-value">{asset.rowCount.toLocaleString()}</div>
            </div>
          )}

          {asset.sizeBytes !== undefined && (
            <div className="stat-item">
              <div className="stat-label">Size</div>
              <div className="stat-value">{formatBytes(asset.sizeBytes)}</div>
            </div>
          )}

          {asset.columnCount !== undefined && (
            <div className="stat-item">
              <div className="stat-label">Columns</div>
              <div className="stat-value">{asset.columnCount}</div>
            </div>
          )}

          {asset.sourceReadCount !== undefined && (
            <div className="stat-item">
              <div className="stat-label">Queries</div>
              <div className="stat-value">{formatQueryCount(asset.sourceReadCount)}</div>
            </div>
          )}

          {asset.sourceReadUserCount !== undefined && asset.sourceReadUserCount > 0 && (
            <div className="stat-item">
              <div className="stat-label">Users</div>
              <div className="stat-value">{asset.sourceReadUserCount}</div>
            </div>
          )}

          {asset.popularityScore !== undefined && asset.popularityScore > 0 && (
            <div className="stat-item">
              <div className="stat-label">Popularity</div>
              <div className="stat-value">{getPopularityDisplay(asset)}/10</div>
            </div>
          )}

          {asset.updateTime && (
            <div className="stat-item">
              <div className="stat-label">Last Updated</div>
              <div className="stat-value">{formatDate(asset.updateTime)}</div>
            </div>
          )}

          {asset.lastProfiledAt && (
            <div className="stat-item">
              <div className="stat-label">Last Profiled</div>
              <div className="stat-value">{formatDate(asset.lastProfiledAt)}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
