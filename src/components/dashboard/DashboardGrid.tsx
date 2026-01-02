/**
 * DashboardGrid Component
 * Responsive grid layout using react-grid-layout
 */

import { useMemo } from 'react';
import { Responsive, WidthProvider } from 'react-grid-layout';
import type { Layout } from 'react-grid-layout';
import { useDashboardLayoutStore } from '../../stores/dashboardLayoutStore';
import { getWidgetMetadata } from './widgets/registry';
import type { DashboardLayoutItem } from '../../stores/dashboardLayoutStore';
import './DashboardGrid.css';

const ResponsiveGridLayout = WidthProvider(Responsive);

// Breakpoint definitions
const BREAKPOINTS = { lg: 1200, md: 768, sm: 0 };
const COLS = { lg: 12, md: 12, sm: 12 };

export function DashboardGrid() {
  const {
    currentLayouts,
    isEditMode,
    updateLayout,
    removeWidget
  } = useDashboardLayoutStore();

  // Handle layout change from react-grid-layout
  const handleLayoutChange = (currentLayout: Layout[], allLayouts: { [key: string]: Layout[] }) => {
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
        console.warn(`Widget type ${layoutItem.widgetType} not found in registry`);
        return null;
      }

      const WidgetComponent = metadata.component;

      return (
        <div key={layoutItem.i} className="dashboard-widget-container">
          <WidgetComponent
            widgetId={layoutItem.widgetId}
            isEditMode={isEditMode}
            config={layoutItem.config}
          />
        </div>
      );
    });
  }, [currentLayouts.lg, isEditMode]);

  return (
    <ResponsiveGridLayout
      className="dashboard-grid-layout"
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
    </ResponsiveGridLayout>
  );
}
