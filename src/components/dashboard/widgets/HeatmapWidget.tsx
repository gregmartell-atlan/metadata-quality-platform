import { Heatmap } from '../Heatmap';
import { WidgetWrapper } from './WidgetWrapper';
import type { WidgetProps } from './registry';

export function HeatmapWidget({ widgetId, isEditMode }: WidgetProps) {
  return (
    <WidgetWrapper
      title="Quality Heatmap"
      widgetId={widgetId}
      isEditMode={isEditMode || false}
      dragHandleClassName="widget-drag-handle"
    >
      <Heatmap />
    </WidgetWrapper>
  );
}
