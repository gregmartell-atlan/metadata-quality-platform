/**
 * Card Component
 *
 * A versatile, beautifully styled card component with:
 * - Multiple variants (default, elevated, glass, outlined)
 * - Status indicators
 * - Interactive states with micro-interactions
 * - Flexible header with actions
 */

import { memo, forwardRef, type ReactNode, type HTMLAttributes } from 'react';
import './Card.css';

type CardVariant = 'default' | 'elevated' | 'glass' | 'outlined' | 'subtle';
type CardStatus = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  className?: string;
  title?: ReactNode;
  subtitle?: string;
  icon?: ReactNode;
  actions?: ReactNode;
  footer?: ReactNode;
  variant?: CardVariant;
  status?: CardStatus;
  interactive?: boolean;
  compact?: boolean;
  noPadding?: boolean;
  loading?: boolean;
}

export const Card = memo(forwardRef<HTMLDivElement, CardProps>(function Card(
  {
    children,
    className = '',
    title,
    subtitle,
    icon,
    actions,
    footer,
    variant = 'default',
    status,
    interactive = false,
    compact = false,
    noPadding = false,
    loading = false,
    ...props
  },
  ref
) {
  const cardClasses = [
    'card',
    `card-${variant}`,
    status && `card-status-${status}`,
    interactive && 'card-interactive',
    compact && 'card-compact',
    loading && 'card-loading',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div ref={ref} className={cardClasses} {...props}>
      {/* Loading overlay */}
      {loading && (
        <div className="card-loading-overlay">
          <div className="card-loading-spinner" />
        </div>
      )}

      {/* Header */}
      {(title || actions) && (
        <div className="card-header">
          <div className="card-header-content">
            {icon && <span className="card-icon">{icon}</span>}
            <div className="card-header-text">
              {title && <h3 className="card-title">{title}</h3>}
              {subtitle && <p className="card-subtitle">{subtitle}</p>}
            </div>
          </div>
          {actions && <div className="card-actions">{actions}</div>}
        </div>
      )}

      {/* Body */}
      <div className={`card-body ${noPadding ? 'card-body-no-padding' : ''}`}>
        {children}
      </div>

      {/* Footer */}
      {footer && <div className="card-footer">{footer}</div>}
    </div>
  );
}));

/**
 * Card Section - For dividing card content
 */
interface CardSectionProps {
  children: ReactNode;
  title?: string;
  className?: string;
}

export function CardSection({ children, title, className = '' }: CardSectionProps) {
  return (
    <div className={`card-section ${className}`}>
      {title && <h4 className="card-section-title">{title}</h4>}
      {children}
    </div>
  );
}

/**
 * Card Stat - For displaying key metrics
 */
interface CardStatProps {
  label: string;
  value: string | number;
  change?: {
    value: number;
    trend: 'up' | 'down' | 'neutral';
  };
  icon?: ReactNode;
  className?: string;
}

export function CardStat({ label, value, change, icon, className = '' }: CardStatProps) {
  return (
    <div className={`card-stat ${className}`}>
      {icon && <span className="card-stat-icon">{icon}</span>}
      <div className="card-stat-content">
        <span className="card-stat-value">{value}</span>
        <span className="card-stat-label">{label}</span>
      </div>
      {change && (
        <span className={`card-stat-change card-stat-change-${change.trend}`}>
          {change.trend === 'up' && '↑'}
          {change.trend === 'down' && '↓'}
          {Math.abs(change.value)}%
        </span>
      )}
    </div>
  );
}
