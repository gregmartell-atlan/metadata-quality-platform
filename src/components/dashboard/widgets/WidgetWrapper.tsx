/**
 * WidgetWrapper Component
 * Provides drag handle, action buttons, widget type selector, and consistent container for all widgets
 */

import { useState, useMemo, memo, type ReactNode } from 'react';
import { GripVertical, Settings, X, RefreshCw } from 'lucide-react';
import { Card } from '../../shared/Card';
import { getWidgetsByCategory, type WidgetMetadata } from './registry';
import { useDashboardLayoutStore } from '../../../stores/dashboardLayoutStore';

interface WidgetWrapperProps {
  title: string;
  widgetId: string;
  widgetType?: string; // Optional - if not provided, type selector won't show specific type
  isEditMode: boolean;
  onRemove?: () => void;
  onSettings?: () => void;
  children: ReactNode;
  dragHandleClassName?: string;
}

export const WidgetWrapper = memo(function WidgetWrapper({
  title,
  widgetId,
  widgetType,
  isEditMode,
  onRemove,
  onSettings,
  children,
  dragHandleClassName = 'widget-drag-handle'
}: WidgetWrapperProps) {
  const [showTypeSelector, setShowTypeSelector] = useState(false);
  const { currentLayouts, updateLayout } = useDashboardLayoutStore();

  // Memoize widget grouping - only compute when type selector is shown
  const widgetsByCategory = useMemo(() => {
    if (!showTypeSelector) return {} as Record<string, WidgetMetadata[]>;

    const allWidgets = getWidgetsByCategory();
    return allWidgets.reduce((acc, widget) => {
      if (!acc[widget.category]) acc[widget.category] = [];
      acc[widget.category].push(widget);
      return acc;
    }, {} as Record<string, WidgetMetadata[]>);
  }, [showTypeSelector]);

  const handleChangeWidgetType = (newType: string) => {
    // Update the widget type in all breakpoints
    const newLayouts = {
      lg: currentLayouts.lg.map(item =>
        item.widgetId === widgetId ? { ...item, widgetType: newType } : item
      ),
      md: currentLayouts.md.map(item =>
        item.widgetId === widgetId ? { ...item, widgetType: newType } : item
      ),
      sm: currentLayouts.sm.map(item =>
        item.widgetId === widgetId ? { ...item, widgetType: newType } : item
      )
    };

    updateLayout('lg', newLayouts.lg);
    updateLayout('md', newLayouts.md);
    updateLayout('sm', newLayouts.sm);
    setShowTypeSelector(false);
  };

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
          <div className="widget-actions" style={{ display: 'flex', gap: '4px', position: 'relative' }}>
            {/* Change widget type button */}
            <button
              onClick={() => setShowTypeSelector(!showTypeSelector)}
              className="widget-action-btn"
              title="Change widget type"
              style={{
                background: showTypeSelector ? 'var(--bg-hover)' : 'transparent',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                padding: '4px',
                borderRadius: '4px',
                display: 'flex'
              }}
            >
              <RefreshCw size={14} />
            </button>

            {/* Widget type dropdown */}
            {showTypeSelector && (
              <div
                style={{
                  position: 'absolute',
                  top: '100%',
                  right: 0,
                  marginTop: '4px',
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '8px',
                  boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
                  zIndex: 1000,
                  minWidth: '220px',
                  maxHeight: '300px',
                  overflowY: 'auto'
                }}
              >
                {Object.entries(widgetsByCategory).map(([category, widgets]) => (
                  <div key={category}>
                    <div style={{
                      padding: '8px 12px',
                      fontSize: '10px',
                      fontWeight: 600,
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                      color: 'var(--text-muted)',
                      borderBottom: '1px solid var(--border-subtle)',
                      background: 'var(--bg-secondary)'
                    }}>
                      {category}
                    </div>
                    {widgets.map(widget => (
                      <button
                        key={widget.type}
                        onClick={() => handleChangeWidgetType(widget.type)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          width: '100%',
                          padding: '8px 12px',
                          background: widget.type === widgetType ? 'var(--bg-hover)' : 'transparent',
                          border: 'none',
                          color: widget.type === widgetType ? 'var(--accent-primary)' : 'var(--text-primary)',
                          fontSize: '12px',
                          textAlign: 'left',
                          cursor: 'pointer'
                        }}
                      >
                        <span style={{ flex: 1 }}>{widget.title}</span>
                        {widget.isNew && (
                          <span style={{
                            fontSize: '9px',
                            padding: '2px 4px',
                            background: 'var(--accent-primary)',
                            color: 'var(--bg-primary)',
                            borderRadius: '3px',
                            fontWeight: 600
                          }}>NEW</span>
                        )}
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            )}

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
});
