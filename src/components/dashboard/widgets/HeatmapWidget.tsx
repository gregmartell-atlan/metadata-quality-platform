import { Heatmap } from '../Heatmap';
import { WidgetWrapper } from './WidgetWrapper';
import type { WidgetProps } from './registry';

export function HeatmapWidget({ widgetId, widgetType, isEditMode }: WidgetProps) {
  return (
    <WidgetWrapper
      title="Quality Heatmap"
      widgetId={widgetId}
      widgetType={widgetType || 'heatmap'}
      isEditMode={isEditMode || false}
      dragHandleClassName="widget-drag-handle"
    >
      <Heatmap />
    </WidgetWrapper>
  );
}
