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
  const containerWidth = useContainerWidth(containerRef);
  // useContainerWidth returns an object { width, mounted, ... } in v2.x
  const width = typeof containerWidth === 'number' ? containerWidth : containerWidth?.width ?? 0;

  const {
    currentLayouts,
    isEditMode,
    updateLayout,
  } = useDashboardLayoutStore();

  // Handle layout change from react-grid-layout
  const handleLayoutChange = (_currentLayout: Layout[], allLayouts: { [key: string]: Layout[] }) => {
    if (!isEditMode) return;

    // Update store with new layouts
    Object.entries(allLayouts).forEach(([breakpoint, layout]) => {
      const updatedLayout: DashboardLayoutItem[] = layout.map(item => {
        const existing = currentLayouts[breakpoint as keyof typeof currentLayouts]?.find(l => l.i === item.i);
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
          className="dashboard-grid-layout"
          width={width}
          layouts={currentLayouts}
          breakpoints={BREAKPOINTS}
          cols={COLS}
          rowHeight={120}
          containerPadding={[24, 24]}
          margin={[16, 16]}
          isDraggable={isEditMode}
          isResizable={isEditMode}
          draggableHandle=".widget-drag-handle"
          onLayoutChange={handleLayoutChange}
          useCSSTransforms={true}
          compactType="vertical"
          preventCollision={false}
        >
          {renderWidgets}
        </Responsive>
      )}
    </div>
  );
}
