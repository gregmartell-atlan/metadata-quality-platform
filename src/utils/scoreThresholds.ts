/**
 * Score Threshold Constants
 *
 * Centralized thresholds for quality score classification.
 * Used for consistent color coding and labels across the application.
 */

export const SCORE_THRESHOLDS = {
  EXCELLENT: 80,
  GOOD: 60,
  FAIR: 40,
  POOR: 20,
} as const;

export type ScoreBand = 'excellent' | 'good' | 'fair' | 'poor' | 'critical';

/**
 * Get the band classification for a score
 */
export function getScoreBand(score: number): ScoreBand {
  if (score >= SCORE_THRESHOLDS.EXCELLENT) return 'excellent';
  if (score >= SCORE_THRESHOLDS.GOOD) return 'good';
  if (score >= SCORE_THRESHOLDS.FAIR) return 'fair';
  if (score >= SCORE_THRESHOLDS.POOR) return 'poor';
  return 'critical';
}

/**
 * Get human-readable label for a score
 */
export function getScoreLabel(score: number): string {
  const band = getScoreBand(score);
  return band.charAt(0).toUpperCase() + band.slice(1);
}

/**
 * Get CSS class name for a score
 */
export function getScoreClass(score: number): string {
  return getScoreBand(score);
}

/**
 * Get heatmap CSS class for a score (10-point granularity)
 */
export function getHeatClass(score: number): string {
  if (score >= 90) return 'h-90';
  if (score >= 80) return 'h-80';
  if (score >= 70) return 'h-70';
  if (score >= 60) return 'h-60';
  if (score >= 50) return 'h-50';
  if (score >= 40) return 'h-40';
  if (score >= 30) return 'h-30';
  return 'h-20';
}
