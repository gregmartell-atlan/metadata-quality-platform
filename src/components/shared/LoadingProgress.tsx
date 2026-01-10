/**
 * Loading Progress Component
 *
 * Shows progress bar and counts during asset loading
 */

import { Loader2, X } from 'lucide-react';
import './LoadingProgress.css';

export interface LoadingProgressProps {
  loaded: number;
  total: number;
  label?: string;
  showPercentage?: boolean;
  showCancelButton?: boolean;
  onCancel?: () => void;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'inline' | 'bar' | 'compact';
}

export function LoadingProgress({
  loaded,
  total,
  label = 'Loading assets',
  showPercentage = true,
  showCancelButton = false,
  onCancel,
  size = 'md',
  variant = 'bar',
}: LoadingProgressProps) {
  const percentage = total > 0 ? Math.round((loaded / total) * 100) : 0;
  const isComplete = loaded >= total && total > 0;

  if (variant === 'compact') {
    return (
      <span className={`loading-progress-compact loading-progress--${size}`}>
        <Loader2 className="loading-progress-spinner" />
        <span className="loading-progress-text">
          {loaded.toLocaleString()} / {total.toLocaleString()}
          {showPercentage && <span className="loading-progress-percent">({percentage}%)</span>}
        </span>
      </span>
    );
  }

  if (variant === 'inline') {
    return (
      <span className={`loading-progress-inline loading-progress--${size}`}>
        {!isComplete && <Loader2 className="loading-progress-spinner" />}
        <span className="loading-progress-text">
          {label}: {loaded.toLocaleString()} / {total.toLocaleString()}
          {showPercentage && ` (${percentage}%)`}
        </span>
        {showCancelButton && onCancel && !isComplete && (
          <button className="loading-progress-cancel" onClick={onCancel} title="Cancel">
            <X size={14} />
          </button>
        )}
      </span>
    );
  }

  // Default: bar variant
  return (
    <div className={`loading-progress loading-progress--${size}`}>
      <div className="loading-progress-header">
        <span className="loading-progress-label">
          {!isComplete && <Loader2 className="loading-progress-spinner" />}
          {label}
        </span>
        <span className="loading-progress-counts">
          {loaded.toLocaleString()} / {total.toLocaleString()}
          {showPercentage && <span className="loading-progress-percent">({percentage}%)</span>}
        </span>
        {showCancelButton && onCancel && !isComplete && (
          <button className="loading-progress-cancel" onClick={onCancel} title="Cancel">
            <X size={14} />
          </button>
        )}
      </div>
      <div className="loading-progress-bar">
        <div
          className="loading-progress-fill"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

/**
 * Sample indicator - shows when data is sampled
 */
export interface SampleIndicatorProps {
  loaded: number;
  total: number;
  showLoadAllButton?: boolean;
  onLoadAll?: () => void;
  isLoading?: boolean;
}

export function SampleIndicator({
  loaded,
  total,
  showLoadAllButton = true,
  onLoadAll,
  isLoading = false,
}: SampleIndicatorProps) {
  const isSampled = loaded < total;
  const sampleRate = total > 0 ? (loaded / total) * 100 : 100;

  if (!isSampled) {
    return (
      <span className="sample-indicator sample-indicator--full">
        {loaded.toLocaleString()} assets (100%)
      </span>
    );
  }

  return (
    <span className="sample-indicator sample-indicator--sampled">
      <span className="sample-indicator-text">
        {loaded.toLocaleString()} of {total.toLocaleString()} assets
        <span className="sample-indicator-rate">({sampleRate.toFixed(1)}% sample)</span>
      </span>
      {showLoadAllButton && onLoadAll && (
        <button
          className="sample-indicator-load-all"
          onClick={onLoadAll}
          disabled={isLoading}
        >
          {isLoading ? (
            <>
              <Loader2 className="sample-indicator-spinner" />
              Loading...
            </>
          ) : (
            'Load All'
          )}
        </button>
      )}
    </span>
  );
}
