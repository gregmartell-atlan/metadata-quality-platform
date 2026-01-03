/**
 * PinnedWidgets Component
 * Renders user-pinned widgets on the home page
 */

import { useMemo } from 'react';
import { Pin, X } from 'lucide-react';
import { usePinnedWidgetsStore } from '../../stores/pinnedWidgetsStore';
import { getWidgetMetadata } from '../dashboard/widgets/registry';
import { Card } from '../shared';
import './PinnedWidgets.css';

export function PinnedWidgets() {
  const { pinnedWidgets, unpinWidget } = usePinnedWidgetsStore();

  const renderedWidgets = useMemo(() => {
    return pinnedWidgets.map((pinned) => {
      const metadata = getWidgetMetadata(pinned.widgetType);
      if (!metadata) {
        console.warn(`Pinned widget type ${pinned.widgetType} not found in registry`);
        return null;
      }

      const WidgetComponent = metadata.component;

      return (
        <div key={pinned.widgetType} className="pinned-widget-container">
          <div className="pinned-widget-header">
            <span className="pinned-widget-title">{metadata.title}</span>
            <button
              className="pinned-widget-unpin"
              onClick={() => unpinWidget(pinned.widgetType)}
              title="Unpin from Home"
            >
              <X size={14} />
            </button>
          </div>
          <div className="pinned-widget-content">
            <WidgetComponent
              widgetId={`home-pinned-${pinned.widgetType}`}
              widgetType={pinned.widgetType}
              isEditMode={false}
              config={pinned.config}
            />
          </div>
        </div>
      );
    });
  }, [pinnedWidgets, unpinWidget]);

  if (pinnedWidgets.length === 0) {
    return null;
  }

  return (
    <section className="home-section pinned-widgets-section">
      <h2 className="section-title">
        <Pin size={16} />
        Pinned Widgets
      </h2>
      <div className="pinned-widgets-grid">
        {renderedWidgets}
      </div>
    </section>
  );
}
