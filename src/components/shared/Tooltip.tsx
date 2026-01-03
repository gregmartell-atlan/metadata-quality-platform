/**
 * Tooltip - Reusable hover tooltip component
 *
 * Provides additional context on hover for UI elements
 */

import { useState, useRef, useEffect, ReactNode } from 'react';
import './Tooltip.css';

type TooltipPosition = 'top' | 'bottom' | 'left' | 'right';

interface TooltipProps {
  content: ReactNode;
  children: ReactNode;
  position?: TooltipPosition;
  delay?: number;
  maxWidth?: number;
}

export function Tooltip({
  content,
  children,
  position = 'top',
  delay = 200,
  maxWidth = 280,
}: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [coords, setCoords] = useState({ x: 0, y: 0 });
  const triggerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const showTooltip = () => {
    timeoutRef.current = setTimeout(() => {
      setIsVisible(true);
    }, delay);
  };

  const hideTooltip = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setIsVisible(false);
  };

  useEffect(() => {
    if (isVisible && triggerRef.current && tooltipRef.current) {
      const triggerRect = triggerRef.current.getBoundingClientRect();
      const tooltipRect = tooltipRef.current.getBoundingClientRect();

      let x = 0;
      let y = 0;

      switch (position) {
        case 'top':
          x = triggerRect.left + triggerRect.width / 2 - tooltipRect.width / 2;
          y = triggerRect.top - tooltipRect.height - 8;
          break;
        case 'bottom':
          x = triggerRect.left + triggerRect.width / 2 - tooltipRect.width / 2;
          y = triggerRect.bottom + 8;
          break;
        case 'left':
          x = triggerRect.left - tooltipRect.width - 8;
          y = triggerRect.top + triggerRect.height / 2 - tooltipRect.height / 2;
          break;
        case 'right':
          x = triggerRect.right + 8;
          y = triggerRect.top + triggerRect.height / 2 - tooltipRect.height / 2;
          break;
      }

      // Keep tooltip within viewport
      const padding = 8;
      x = Math.max(padding, Math.min(x, window.innerWidth - tooltipRect.width - padding));
      y = Math.max(padding, Math.min(y, window.innerHeight - tooltipRect.height - padding));

      setCoords({ x, y });
    }
  }, [isVisible, position]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return (
    <>
      <div
        ref={triggerRef}
        className="tooltip-trigger"
        onMouseEnter={showTooltip}
        onMouseLeave={hideTooltip}
        onFocus={showTooltip}
        onBlur={hideTooltip}
      >
        {children}
      </div>
      {isVisible && (
        <div
          ref={tooltipRef}
          className={`tooltip tooltip-${position}`}
          style={{
            left: coords.x,
            top: coords.y,
            maxWidth,
          }}
          role="tooltip"
        >
          <div className="tooltip-content">{content}</div>
          <div className="tooltip-arrow" />
        </div>
      )}
    </>
  );
}

/**
 * InfoTooltip - Small info icon with tooltip
 */
interface InfoTooltipProps {
  content: ReactNode;
  position?: TooltipPosition;
}

export function InfoTooltip({ content, position = 'top' }: InfoTooltipProps) {
  return (
    <Tooltip content={content} position={position}>
      <span className="info-tooltip-icon">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <path d="M12 16v-4M12 8h.01" />
        </svg>
      </span>
    </Tooltip>
  );
}

/**
 * MetadataTooltip - Rich tooltip for metadata field details
 */
interface MetadataTooltipProps {
  field: string;
  description: string;
  coverage?: number;
  importance?: 'required' | 'recommended' | 'optional';
  children: ReactNode;
}

export function MetadataTooltip({
  field,
  description,
  coverage,
  importance,
  children,
}: MetadataTooltipProps) {
  const content = (
    <div className="metadata-tooltip">
      <div className="metadata-tooltip-header">
        <span className="metadata-tooltip-field">{field}</span>
        {importance && (
          <span className={`metadata-tooltip-badge metadata-tooltip-badge-${importance}`}>
            {importance}
          </span>
        )}
      </div>
      <p className="metadata-tooltip-description">{description}</p>
      {coverage !== undefined && (
        <div className="metadata-tooltip-coverage">
          <span>Coverage:</span>
          <div className="metadata-tooltip-bar">
            <div
              className="metadata-tooltip-bar-fill"
              style={{ width: `${coverage}%` }}
            />
          </div>
          <span className="metadata-tooltip-percentage">{coverage}%</span>
        </div>
      )}
    </div>
  );

  return (
    <Tooltip content={content} position="top" maxWidth={320}>
      {children}
    </Tooltip>
  );
}
