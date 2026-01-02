/**
 * WidgetWrapper Component
 * Provides drag handle, action buttons, and consistent container for all widgets
 */

import type { ReactNode } from 'react';
import { GripVertical, Settings, X } from 'lucide-react';
import { Card } from '../../shared/Card';

interface WidgetWrapperProps {
  title: string;
  widgetId: string;
  isEditMode: boolean;
  onRemove?: () => void;
  onSettings?: () => void;
  children: ReactNode;
  dragHandleClassName?: string;
}

export function WidgetWrapper({
  title,
  widgetId,
  isEditMode,
  onRemove,
  onSettings,
  children,
  dragHandleClassName = 'widget-drag-handle'
}: WidgetWrapperProps) {
  return (
    <Card
      className="dashboard-widget"
      title={
        <div className="widget-header" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {isEditMode && (
            <div className={dragHandleClassName} style={{ cursor: 'grab', display: 'flex' }}>
              <GripVertical size={16} />
            </div>
          )}
          <span>{title}</span>
        </div>
      }
      actions={
        isEditMode ? (
          <div className="widget-actions" style={{ display: 'flex', gap: '4px' }}>
            {onSettings && (
              <button
                onClick={onSettings}
                className="widget-action-btn"
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  padding: '4px',
                  borderRadius: '4px',
                  display: 'flex'
                }}
              >
                <Settings size={14} />
              </button>
            )}
            {onRemove && (
              <button
                onClick={onRemove}
                className="widget-action-btn"
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  padding: '4px',
                  borderRadius: '4px',
                  display: 'flex'
                }}
              >
                <X size={14} />
              </button>
            )}
          </div>
        ) : undefined
      }
    >
      {children}
    </Card>
  );
}
