/**
 * AutoSizeGrid - CSS Grid masonry-style layout for view mode
 * Cards auto-size to fit their content, no fixed heights
 */

import { useMemo } from 'react';
import { useDashboardLayoutStore } from '../../stores/dashboardLayoutStore';
import { getWidgetMetadata } from './widgets/registry';
import './AutoSizeGrid.css';

export function AutoSizeGrid() {
  const { currentLayouts } = useDashboardLayoutStore();

  // Sort widgets by their grid position (y then x) to maintain visual order
  const sortedWidgets = useMemo(() => {
    return [...currentLayouts.lg].sort((a, b) => {
      if (a.y !== b.y) return a.y - b.y;
      return a.x - b.x;
    });
  }, [currentLayouts.lg]);

  // Render widgets
  const widgets = useMemo(() => {
    return sortedWidgets.map((layoutItem) => {
      const metadata = getWidgetMetadata(layoutItem.widgetType);
      if (!metadata) return null;

      const WidgetComponent = metadata.component;

      // Determine span class based on original width
      const spanClass = layoutItem.w >= 12 ? 'span-full'
        : layoutItem.w >= 8 ? 'span-wide'
        : layoutItem.w >= 6 ? 'span-half'
        : layoutItem.w >= 4 ? 'span-third'
        : 'span-quarter';

      return (
        <div
          key={layoutItem.i}
          className={`auto-grid-item ${spanClass}`}
          data-widget-type={layoutItem.widgetType}
        >
          <WidgetComponent
            widgetId={layoutItem.widgetId}
            widgetType={layoutItem.widgetType}
            isEditMode={false}
            config={layoutItem.config}
          />
        </div>
      );
    });
  }, [sortedWidgets]);

  return (
    <div className="auto-size-grid">
      {widgets}
    </div>
  );
}
