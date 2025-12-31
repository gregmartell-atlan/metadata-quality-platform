/**
 * Activity Section
 *
 * Shows popularity and usage metrics
 */

import { TrendingUp, Star, Users, Clock, Flame } from 'lucide-react';
import type { AtlanAsset } from '../../../services/atlan/types';
import {
  calculatePopularityScore,
  getPopularityDisplay,
  formatQueryCount,
  formatLastAccessed,
  isHotAsset,
  isWarmAsset,
} from '../../../utils/popularityScore';

interface ActivitySectionProps {
  asset: AtlanAsset;
}

export function ActivitySection({ asset }: ActivitySectionProps) {
  const score = getPopularityDisplay(asset);
  const compositeScore = calculatePopularityScore(asset);

  return (
    <div className="activity-section">
      {/* Popularity Score */}
      <div className="inspector-section">
        <div className="section-title">
          <TrendingUp size={14} />
          Popularity
        </div>
        <div className="section-content">
          <div className="popularity-display">
            <div className="popularity-score-large">
              {isHotAsset(asset) && <Flame size={32} className="hot-icon" />}
              {isWarmAsset(asset) && <Star size={32} className="warm-icon" />}
              <div className="score-number">{score}</div>
              <div className="score-max">/10</div>
            </div>
            <div className="popularity-status">
              {isHotAsset(asset) && <span className="status-badge hot">🔥 Hot Asset</span>}
              {isWarmAsset(asset) && <span className="status-badge warm">⭐ Popular</span>}
              {!isHotAsset(asset) && !isWarmAsset(asset) && (
                <span className="status-badge normal">Standard Usage</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Usage Metrics */}
      <div className="inspector-section">
        <div className="section-title">
          <Users size={14} />
          Usage Metrics
        </div>
        <div className="stats-grid">
          <div className="stat-item">
            <div className="stat-label">Total Queries</div>
            <div className="stat-value">{formatQueryCount(asset.sourceReadCount)}</div>
          </div>

          <div className="stat-item">
            <div className="stat-label">Unique Users</div>
            <div className="stat-value">{asset.sourceReadUserCount || 0}</div>
          </div>

          <div className="stat-item">
            <div className="stat-label">Stars</div>
            <div className="stat-value">{asset.starredCount || 0}</div>
          </div>

          <div className="stat-item">
            <div className="stat-label">Last Accessed</div>
            <div className="stat-value">{formatLastAccessed(asset.sourceLastReadAt)}</div>
          </div>

          {asset.viewScore !== undefined && asset.viewScore > 0 && (
            <div className="stat-item">
              <div className="stat-label">View Score</div>
              <div className="stat-value">{asset.viewScore.toFixed(2)}</div>
            </div>
          )}
        </div>
      </div>

      {/* Starred By (if available) */}
      {asset.starredBy && asset.starredBy.length > 0 && (
        <div className="inspector-section">
          <div className="section-title">
            <Star size={14} />
            Starred By
          </div>
          <div className="section-content">
            <div className="starred-list">
              {asset.starredBy.map((user, i) => (
                <span key={i} className="user-badge">
                  {user}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
