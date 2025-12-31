/**
 * Popular Assets Section
 *
 * Displays the most popular (most-queried) assets for quick access.
 * Helps data quality analysts prioritize high-impact assets.
 */

import { useState } from 'react';
import { ChevronDown, ChevronRight, Flame, Star, TrendingUp } from 'lucide-react';
import type { AtlanAsset } from '../../services/atlan/types';
import {
  getTopPopularAssets,
  formatQueryCount,
  formatLastAccessed,
  getPopularityDisplay,
  isHotAsset,
  isWarmAsset,
  hasPopularityData,
} from '../../utils/popularityScore';
import './PopularAssetsSection.css';

interface PopularAssetsSectionProps {
  assets: AtlanAsset[];
  onAssetClick: (asset: AtlanAsset) => void;
  onAssetDragStart: (e: React.DragEvent, asset: AtlanAsset) => void;
  selectedConnector?: string | null;
}

export function PopularAssetsSection({
  assets,
  onAssetClick,
  onAssetDragStart,
  selectedConnector,
}: PopularAssetsSectionProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  // Filter assets by selected connector if specified
  const filteredAssets = selectedConnector
    ? assets.filter((a) => a.connectionName === selectedConnector)
    : assets;

  // Get top 10 popular assets with popularity data
  const popularAssets = getTopPopularAssets(
    filteredAssets.filter(hasPopularityData),
    10
  );

  // Don't render if no popular assets
  if (popularAssets.length === 0) {
    return null;
  }

  return (
    <div className="popular-assets-section">
      <button
        className="popular-assets-header"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <span className="popular-assets-icon">
          {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </span>
        <Flame size={16} className="flame-icon" />
        <span className="popular-assets-title">Popular Assets</span>
        <span className="popular-assets-count">{popularAssets.length}</span>
        <TrendingUp size={14} className="trending-icon" />
      </button>

      {isExpanded && (
        <div className="popular-assets-list">
          {popularAssets.map((asset) => {
            const score = getPopularityDisplay(asset);
            const isHot = isHotAsset(asset);
            const isWarm = isWarmAsset(asset);

            return (
              <div
                key={asset.guid}
                className={`popular-asset-item ${isHot ? 'hot' : isWarm ? 'warm' : ''}`}
                onClick={() => onAssetClick(asset)}
                draggable
                onDragStart={(e) => onAssetDragStart(e, asset)}
                title={asset.qualifiedName}
              >
                <div className="popular-asset-icon">
                  {isHot ? (
                    <Flame size={14} className="hot-icon" />
                  ) : isWarm ? (
                    <Star size={14} className="warm-icon" />
                  ) : (
                    <span>📊</span>
                  )}
                </div>
                <div className="popular-asset-info">
                  <div className="popular-asset-name">{asset.name}</div>
                  <div className="popular-asset-stats">
                    <span className="stat">
                      {formatQueryCount(asset.sourceReadCount)} queries
                    </span>
                    {asset.sourceReadUserCount && (
                      <span className="stat">
                        {asset.sourceReadUserCount} users
                      </span>
                    )}
                    {asset.sourceLastReadAt && (
                      <span className="stat">
                        {formatLastAccessed(asset.sourceLastReadAt)}
                      </span>
                    )}
                  </div>
                </div>
                <div className="popular-asset-score" title={`Popularity: ${score}/10`}>
                  <span className="score-value">{score}</span>
                  <span className="score-max">/10</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
