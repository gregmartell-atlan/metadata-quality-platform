/**
 * LoadingState - Skeleton loaders and loading indicators
 *
 * Provides consistent loading states across the application
 */

import './LoadingState.css';

interface LoadingStateProps {
  /** Type of loading skeleton to display */
  variant?: 'card' | 'table' | 'chart' | 'text' | 'inline';
  /** Number of skeleton items to show (for lists/tables) */
  count?: number;
  /** Custom height for the skeleton */
  height?: string | number;
  /** Custom width for the skeleton */
  width?: string | number;
  /** Show a label above the skeleton */
  label?: string;
  /** Additional CSS class */
  className?: string;
}

export function LoadingState({
  variant = 'card',
  count = 1,
  height,
  width,
  label,
  className = '',
}: LoadingStateProps) {
  const style: React.CSSProperties = {};
  if (height) style.height = typeof height === 'number' ? `${height}px` : height;
  if (width) style.width = typeof width === 'number' ? `${width}px` : width;

  const renderSkeleton = () => {
    switch (variant) {
      case 'card':
        return (
          <div className="skeleton-card" style={style}>
            <div className="skeleton-header">
              <div className="skeleton-line skeleton-title" />
              <div className="skeleton-line skeleton-subtitle" />
            </div>
            <div className="skeleton-body">
              <div className="skeleton-line" />
              <div className="skeleton-line" />
              <div className="skeleton-line skeleton-short" />
            </div>
          </div>
        );

      case 'table':
        return (
          <div className="skeleton-table" style={style}>
            <div className="skeleton-table-header">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="skeleton-table-cell skeleton-line" />
              ))}
            </div>
            {Array.from({ length: count }).map((_, rowIdx) => (
              <div key={rowIdx} className="skeleton-table-row">
                {Array.from({ length: 4 }).map((_, cellIdx) => (
                  <div key={cellIdx} className="skeleton-table-cell skeleton-line" />
                ))}
              </div>
            ))}
          </div>
        );

      case 'chart':
        return (
          <div className="skeleton-chart" style={style}>
            <div className="skeleton-chart-bars">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="skeleton-chart-bar skeleton-pulse"
                  style={{ height: `${30 + Math.random() * 50}%` }}
                />
              ))}
            </div>
            <div className="skeleton-chart-axis" />
          </div>
        );

      case 'text':
        return (
          <div className="skeleton-text" style={style}>
            {Array.from({ length: count }).map((_, i) => (
              <div
                key={i}
                className={`skeleton-line ${i === count - 1 ? 'skeleton-short' : ''}`}
              />
            ))}
          </div>
        );

      case 'inline':
        return <span className="skeleton-inline skeleton-pulse" style={style} />;

      default:
        return <div className="skeleton-line skeleton-pulse" style={style} />;
    }
  };

  return (
    <div className={`loading-state loading-state-${variant} ${className}`}>
      {label && <div className="loading-state-label">{label}</div>}
      {renderSkeleton()}
    </div>
  );
}

/**
 * Spinner - Simple spinning indicator
 */
interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function Spinner({ size = 'md', className = '' }: SpinnerProps) {
  return (
    <div className={`spinner spinner-${size} ${className}`}>
      <div className="spinner-ring" />
    </div>
  );
}

/**
 * LoadingOverlay - Full-screen or container loading overlay
 */
interface LoadingOverlayProps {
  /** Whether the overlay is visible */
  isLoading: boolean;
  /** Optional message to display */
  message?: string;
  /** Whether to cover the entire screen or just the parent container */
  fullScreen?: boolean;
  /** Children to render behind the overlay */
  children?: React.ReactNode;
}

export function LoadingOverlay({
  isLoading,
  message,
  fullScreen = false,
  children,
}: LoadingOverlayProps) {
  return (
    <div className={`loading-overlay-container ${fullScreen ? 'full-screen' : ''}`}>
      {children}
      {isLoading && (
        <div className="loading-overlay">
          <div className="loading-overlay-content">
            <Spinner size="lg" />
            {message && <p className="loading-overlay-message">{message}</p>}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * SkeletonCard - Preset card skeleton
 */
export function SkeletonCard({ className = '' }: { className?: string }) {
  return <LoadingState variant="card" className={className} />;
}

/**
 * SkeletonTable - Preset table skeleton
 */
export function SkeletonTable({
  rows = 5,
  className = '',
}: {
  rows?: number;
  className?: string;
}) {
  return <LoadingState variant="table" count={rows} className={className} />;
}

/**
 * SkeletonChart - Preset chart skeleton
 */
export function SkeletonChart({
  height = 300,
  className = '',
}: {
  height?: number;
  className?: string;
}) {
  return <LoadingState variant="chart" height={height} className={className} />;
}
