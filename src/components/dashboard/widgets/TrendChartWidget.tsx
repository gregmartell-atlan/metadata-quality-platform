import { TrendChart } from '../TrendChart';
import { WidgetWrapper } from './WidgetWrapper';
import type { WidgetProps } from './registry';

export function TrendChartWidget({ widgetId, widgetType, isEditMode }: WidgetProps) {
  return (
    <WidgetWrapper
      title="Quality Trend (90 Days)"
      widgetId={widgetId}
      widgetType={widgetType || 'trend-chart'}
      isEditMode={isEditMode || false}
      dragHandleClassName="widget-drag-handle"
    >
      <TrendChart />
    </WidgetWrapper>
  );
}
