/**
 * DashboardGrid Component
 * Responsive grid layout using react-grid-layout
 */

import { useMemo, useRef } from 'react';
import { Responsive, useContainerWidth } from 'react-grid-layout';
import type { Layout } from 'react-grid-layout';
import { useDashboardLayoutStore } from '../../stores/dashboardLayoutStore';
import { getWidgetMetadata } from './widgets/registry';
import type { DashboardLayoutItem } from '../../stores/dashboardLayoutStore';
import { logger } from '../../utils/logger';

// Import react-grid-layout CSS for resize handles to work
import 'react-grid-layout/css/styles.css';
import './DashboardGrid.css';

// Breakpoint definitions
const BREAKPOINTS = { lg: 1200, md: 768, sm: 0 };
const COLS = { lg: 12, md: 12, sm: 12 };

export function DashboardGrid() {
  const containerRef = useRef<HTMLDivElement>(null);
  const containerWidth = useContainerWidth(containerRef as any);
  // useContainerWidth returns an object { width, mounted, ... } in v2.x
  const width = typeof containerWidth === 'number' ? containerWidth : (containerWidth as any)?.width ?? 0;

  const {
    currentLayouts,
    isEditMode,
    updateLayout,
  } = useDashboardLayoutStore();

  // Handle layout change from react-grid-layout
  const handleLayoutChange = (layout: Layout, layouts: Partial<Record<string, Layout>>) => {
    if (!isEditMode) return;

    // Update store with new layouts
    Object.entries(layouts).forEach(([breakpoint, bpLayout]) => {
      if (!bpLayout) return;

      const updatedLayout: DashboardLayoutItem[] = bpLayout.map(item => {
        const existing = (currentLayouts as any)[breakpoint]?.find((l: any) => l.i === item.i);
        return {
          ...item,
          widgetType: existing?.widgetType || '',
          widgetId: existing?.widgetId || item.i,
          config: existing?.config
        } as DashboardLayoutItem;
      });

      updateLayout(breakpoint, updatedLayout);
    });
  };

  // Render widget instances
  const renderWidgets = useMemo(() => {
    return currentLayouts.lg.map((layoutItem) => {
      const metadata = getWidgetMetadata(layoutItem.widgetType);
      if (!metadata) {
        logger.warn(`[DashboardGrid] Widget type ${layoutItem.widgetType} NOT FOUND in registry`);
        return null;
      }

      const WidgetComponent = metadata.component;

      return (
        <div key={layoutItem.i} className="dashboard-widget-container">
          <WidgetComponent
            widgetId={layoutItem.widgetId}
            widgetType={layoutItem.widgetType}
            isEditMode={isEditMode}
            config={layoutItem.config}
          />
        </div>
      );
    });
  }, [currentLayouts.lg, isEditMode]);

  return (
    <div ref={containerRef} className="dashboard-grid-wrapper">
      {width > 0 && (
        <Responsive
          {...{
            className: "dashboard-grid-layout",
            width: width,
            layouts: currentLayouts,
            breakpoints: BREAKPOINTS,
            cols: COLS,
            rowHeight: 140,
            containerPadding: [20, 20],
            margin: [20, 20],
            isDraggable: isEditMode,
            isResizable: isEditMode,
            draggableHandle: ".widget-drag-handle",
            onLayoutChange: handleLayoutChange,
            useCSSTransforms: true,
            compactType: "vertical",
            preventCollision: false,
          } as any}
        >
          {renderWidgets}
        </Responsive>
      )}
    </div>
  );
}
