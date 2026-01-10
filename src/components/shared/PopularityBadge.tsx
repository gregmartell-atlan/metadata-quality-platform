/**
 * PopularityBadge - Stylized popularity indicator
 *
 * Displays a flame or lightning icon for hot/warm assets.
 * Can show count and different visual styles.
 */

import { Flame, Zap } from 'lucide-react';
import type { AtlanAsset } from '../../services/atlan/types';
import { calculatePopularityScore, HOT_THRESHOLD, WARM_THRESHOLD } from '../../utils/popularityScore';
import './PopularityBadge.css';

export type PopularityLevel = 'hot' | 'warm' | 'normal';

interface PopularityBadgeProps {
  /** The asset to check popularity for */
  asset?: AtlanAsset;
  /** Or provide level directly */
  level?: PopularityLevel;
  /** Optional count to display */
  count?: number;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Show label text */
  showLabel?: boolean;
  /** Custom class name */
  className?: string;
}

/**
 * Get popularity level from an asset
 */
export function getPopularityLevel(asset: AtlanAsset): PopularityLevel {
  const score = calculatePopularityScore(asset);
  if (score > HOT_THRESHOLD) return 'hot';
  if (score > WARM_THRESHOLD) return 'warm';
  return 'normal';
}

/**
 * Check if an asset should show popularity indicator
 */
export function shouldShowPopularity(asset: AtlanAsset): boolean {
  return getPopularityLevel(asset) !== 'normal';
}

export function PopularityBadge({
  asset,
  level: providedLevel,
  count,
  size = 'md',
  showLabel = false,
  className = '',
}: PopularityBadgeProps) {
  const level = providedLevel ?? (asset ? getPopularityLevel(asset) : 'normal');

  if (level === 'normal') return null;

  const iconSize = size === 'sm' ? 12 : size === 'lg' ? 18 : 14;
  const isHot = level === 'hot';

  return (
    <span
      className={`popularity-badge popularity-badge--${level} popularity-badge--${size} ${className}`}
      title={isHot ? 'Hot - Highly popular asset' : 'Popular asset'}
    >
      <span className="popularity-badge__icon">
        {isHot ? (
          <Flame size={iconSize} strokeWidth={2.5} />
        ) : (
          <Zap size={iconSize} strokeWidth={2.5} />
        )}
      </span>
      {count !== undefined && count > 1 && (
        <span className="popularity-badge__count">{count}</span>
      )}
      {showLabel && (
        <span className="popularity-badge__label">
          {isHot ? 'Hot' : 'Popular'}
        </span>
      )}
    </span>
  );
}

/**
 * Inline popularity indicator for use in text/lists
 */
export function PopularityIndicator({
  asset,
  level: providedLevel,
  size = 'sm',
}: Pick<PopularityBadgeProps, 'asset' | 'level' | 'size'>) {
  const level = providedLevel ?? (asset ? getPopularityLevel(asset) : 'normal');

  if (level === 'normal') return null;

  const iconSize = size === 'sm' ? 12 : size === 'md' ? 14 : 16;
  const isHot = level === 'hot';

  return (
    <span className={`popularity-indicator popularity-indicator--${level}`}>
      {isHot ? (
        <Flame size={iconSize} strokeWidth={2.5} />
      ) : (
        <Zap size={iconSize} strokeWidth={2.5} />
      )}
    </span>
  );
}
