import { StatsRow } from '../StatsRow';
import { WidgetWrapper } from './WidgetWrapper';
import type { WidgetProps } from './registry';

export function StatsRowWidget({ widgetId, isEditMode }: WidgetProps) {
  return (
    <WidgetWrapper
      title="Key Metrics"
      widgetId={widgetId}
      isEditMode={isEditMode || false}
      dragHandleClassName="widget-drag-handle"
    >
      <StatsRow />
    </WidgetWrapper>
  );
}
