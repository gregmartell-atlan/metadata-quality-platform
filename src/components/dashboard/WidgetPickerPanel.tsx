/**
 * Widget Picker Panel
 * Dropdown panel to add new widgets to the dashboard
 */

import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { getWidgetsByCategory } from './widgets/registry';
import { useDashboardLayoutStore } from '../../stores/dashboardLayoutStore';

export function WidgetPickerPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const { addWidget } = useDashboardLayoutStore();

  const categories = [
    { id: 'core', label: 'Core' },
    { id: 'analytics', label: 'Analytics' },
    { id: 'activity', label: 'Activity' },
    { id: 'management', label: 'Management' }
  ];

  const handleAddWidget = (widgetType: string) => {
    addWidget(widgetType);
    setIsOpen(false);
  };

  return (
    <div className="widget-picker-panel" style={{ position: 'relative' }}>
      <button
        className="add-widget-btn"
        onClick={() => setIsOpen(!isOpen)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '8px 16px',
          background: isOpen ? 'var(--bg-tertiary)' : 'var(--accent-primary)',
          color: isOpen ? 'var(--text-primary)' : 'var(--bg-primary)',
          border: isOpen ? '1px solid var(--border-color)' : 'none',
          borderRadius: '6px',
          cursor: 'pointer',
          fontSize: '14px',
          fontWeight: '500',
          transition: 'all 0.2s'
        }}
      >
        {isOpen ? <X size={16} /> : <Plus size={16} />}
        {isOpen ? 'Close' : 'Add Widget'}
      </button>

      {isOpen && (
        <div
          className="widget-picker-dropdown"
          style={{
            position: 'absolute',
            top: '100%',
            right: 0,
            marginTop: '8px',
            width: '320px',
            maxHeight: '400px',
            overflowY: 'auto',
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-color)',
            borderRadius: '8px',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
            zIndex: 1000
          }}
        >
          {categories.map((category) => {
            const widgets = getWidgetsByCategory(category.id);
            if (widgets.length === 0) return null;

            return (
              <div key={category.id} style={{ padding: '8px' }}>
                <div
                  style={{
                    fontSize: '11px',
                    fontWeight: '600',
                    color: 'var(--text-muted)',
                    textTransform: 'uppercase',
                    padding: '8px',
                    letterSpacing: '0.5px'
                  }}
                >
                  {category.label}
                </div>
                {widgets.map((widget) => (
                  <button
                    key={widget.id}
                    onClick={() => handleAddWidget(widget.type)}
                    style={{
                      width: '100%',
                      padding: '12px',
                      textAlign: 'left',
                      background: 'transparent',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      color: 'var(--text-primary)',
                      transition: 'background 0.2s'
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-tertiary)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    <div style={{ fontWeight: '500', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {widget.title}
                      {widget.isNew && (
                        <span
                          style={{
                            fontSize: '10px',
                            padding: '2px 6px',
                            background: 'var(--accent-primary)',
                            color: 'var(--bg-primary)',
                            borderRadius: '4px'
                          }}
                        >
                          New
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      {widget.description}
                    </div>
                  </button>
                ))}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
