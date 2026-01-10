/**
 * Popularity Score Utilities
 *
 * Calculate and categorize asset popularity based on multiple signals:
 * - popularityScore (Atlan's calculated score)
 * - sourceReadCount (query execution count)
 * - sourceReadUserCount (number of unique users)
 * - starredCount (user favorites)
 */

import type { AtlanAsset } from '../services/atlan/types';

// Thresholds for categorizing assets
export const HOT_THRESHOLD = 0.7;
export const WARM_THRESHOLD = 0.5;

/**
 * Calculate composite popularity score from multiple signals
 * Returns a normalized score between 0 and 1
 *
 * Weighting:
 * - 40% Atlan's popularity score (already normalized 0-1)
 * - 30% Query frequency (normalized by dividing by 1000)
 * - 20% User diversity (normalized by dividing by 10)
 * - 10% User favorites (normalized by dividing by 5)
 */
export function calculatePopularityScore(asset: AtlanAsset): number {
  const atlanScore = (asset.popularityScore ?? 0) * 0.4;
  const queryScore = Math.min(((asset.sourceReadCount ?? 0) / 1000), 1) * 0.3;
  const userScore = Math.min(((asset.sourceReadUserCount ?? 0) / 10), 1) * 0.2;
  const starredScore = Math.min(((asset.starredCount ?? 0) / 5), 1) * 0.1;

  return Math.min(atlanScore + queryScore + userScore + starredScore, 1);
}

/**
 * Check if asset is "hot" (highly popular)
 */
export function isHotAsset(asset: AtlanAsset): boolean {
  return calculatePopularityScore(asset) > HOT_THRESHOLD;
}

/**
 * Check if asset is "warm" (moderately popular)
 */
export function isWarmAsset(asset: AtlanAsset): boolean {
  const score = calculatePopularityScore(asset);
  return score > WARM_THRESHOLD && score <= HOT_THRESHOLD;
}

/**
 * Get human-readable popularity label
 */
export function getPopularityLabel(asset: AtlanAsset): 'Hot' | 'Warm' | 'Normal' {
  const score = calculatePopularityScore(asset);
  if (score > HOT_THRESHOLD) return 'Hot';
  if (score > WARM_THRESHOLD) return 'Warm';
  return 'Normal';
}

/**
 * Get popularity score as a 0-10 scale for display
 */
export function getPopularityDisplay(asset: AtlanAsset): number {
  return Math.round(calculatePopularityScore(asset) * 10 * 10) / 10; // Round to 1 decimal
}

/**
 * Format query count for display
 */
export function formatQueryCount(count: number | undefined): string {
  if (!count) return '0';
  if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
  if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
  return count.toString();
}

/**
 * Format time since last read for display
 */
export function formatLastAccessed(timestamp: number | undefined): string {
  if (!timestamp) return 'Never';

  const now = Date.now();
  const diff = now - timestamp;

  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 30) return `${Math.floor(days / 30)} month${Math.floor(days / 30) !== 1 ? 's' : ''} ago`;
  if (days > 0) return `${days} day${days !== 1 ? 's' : ''} ago`;
  if (hours > 0) return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
  if (minutes > 0) return `${minutes} minute${minutes !== 1 ? 's' : ''} ago`;
  return 'Just now';
}

/**
 * Sort assets by popularity (descending)
 */
export function sortByPopularity(assets: AtlanAsset[]): AtlanAsset[] {
  return [...assets].sort((a, b) =>
    calculatePopularityScore(b) - calculatePopularityScore(a)
  );
}

/**
 * Get top N most popular assets
 */
export function getTopPopularAssets(assets: AtlanAsset[], limit: number = 10): AtlanAsset[] {
  return sortByPopularity(assets).slice(0, limit);
}

/**
 * Check if asset has any popularity data
 */
export function hasPopularityData(asset: AtlanAsset): boolean {
  return !!(
    asset.popularityScore ||
    asset.sourceReadCount ||
    asset.sourceReadUserCount ||
    asset.starredCount
  );
}

/**
 * Popularity info computed in a single pass
 * Use this when you need multiple popularity attributes to avoid redundant calculations
 */
export interface PopularityInfo {
  score: number;
  isHot: boolean;
  isWarm: boolean;
  label: 'Hot' | 'Warm' | 'Normal';
  display: number;
}

/**
 * Get all popularity info in a single calculation
 * More efficient than calling individual functions separately
 */
export function getPopularityInfo(asset: AtlanAsset): PopularityInfo {
  const score = calculatePopularityScore(asset);
  const isHot = score > HOT_THRESHOLD;
  const isWarm = score > WARM_THRESHOLD && !isHot;

  return {
    score,
    isHot,
    isWarm,
    label: isHot ? 'Hot' : isWarm ? 'Warm' : 'Normal',
    display: Math.round(score * 10 * 10) / 10,
  };
}

/**
 * Get popularity emoji for display
 * Returns 🔥 for hot, ⚡ for warm, empty string for normal
 */
export function getPopularityEmoji(asset: AtlanAsset): string {
  const score = calculatePopularityScore(asset);
  if (score > HOT_THRESHOLD) return '🔥';
  if (score > WARM_THRESHOLD) return '⚡';
  return '';
}

/**
 * Check if any popularity indicator should be shown
 */
export function shouldShowPopularityIndicator(asset: AtlanAsset): boolean {
  return calculatePopularityScore(asset) > WARM_THRESHOLD;
}
