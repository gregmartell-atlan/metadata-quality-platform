/**
 * Right Edge Flyout
 *
 * Reusable right-edge slide-in panel component.
 * Used for settings, configuration, and other contextual panels.
 */

import { ReactNode } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import './RightEdgeFlyout.css';

interface RightEdgeFlyoutProps {
  isOpen: boolean;
  onToggle: () => void;
  title: string;
  icon?: ReactNode;
  collapsedLabel?: string;
  badge?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  width?: number; // Default 360px
}

export function RightEdgeFlyout({
  isOpen,
  onToggle,
  title,
  icon,
  collapsedLabel = 'Open',
  badge,
  children,
  footer,
  width = 360,
}: RightEdgeFlyoutProps) {
  return (
    <div className={`right-edge-flyout ${isOpen ? 'open' : 'collapsed'}`}>
      {/* Collapsed Tab (shows when closed) */}
      {!isOpen && (
        <button
          className="flyout-tab-collapsed"
          onClick={onToggle}
          title={title}
        >
          <ChevronLeft size={14} />
          {icon}
          <span className="tab-label-vertical">{collapsedLabel}</span>
          {badge}
        </button>
      )}

      {/* Flyout Panel (shows when open) */}
      {isOpen && (
        <div className="flyout-panel" style={{ width: `${width}px` }}>
          {/* Header */}
          <div className="flyout-panel-header">
            <button
              className="flyout-close-btn"
              onClick={onToggle}
              title={`Close ${title.toLowerCase()}`}
            >
              <ChevronRight size={16} />
            </button>
            <div className="flyout-panel-title">
              {icon}
              <span>{title}</span>
            </div>
            {badge && <div className="flyout-panel-badge">{badge}</div>}
          </div>

          {/* Body */}
          <div className="flyout-panel-body">
            {children}
          </div>

          {/* Footer (optional) */}
          {footer && (
            <div className="flyout-panel-footer">
              {footer}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
