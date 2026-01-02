import { StatsRow } from '../StatsRow';
import { WidgetWrapper } from './WidgetWrapper';
import type { WidgetProps } from './registry';

export function StatsRowWidget({ widgetId, widgetType, isEditMode }: WidgetProps) {
  return (
    <WidgetWrapper
      title="Key Metrics"
      widgetId={widgetId}
      widgetType={widgetType || 'stats-row'}
      isEditMode={isEditMode || false}
      dragHandleClassName="widget-drag-handle"
    >
      <StatsRow />
    </WidgetWrapper>
  );
}
