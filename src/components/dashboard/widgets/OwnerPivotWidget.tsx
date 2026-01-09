import { OwnerPivot } from '../OwnerPivot';
import { WidgetWrapper } from './WidgetWrapper';
import type { WidgetProps } from './registry';

export function OwnerPivotWidget({ widgetId, widgetType, isEditMode }: WidgetProps) {
  return (
    <WidgetWrapper
      title="Owner Pivot Analysis"
      widgetId={widgetId}
      widgetType={widgetType || 'owner-pivot'}
      isEditMode={isEditMode || false}
      dragHandleClassName="widget-drag-handle"
    >
      <OwnerPivot />
    </WidgetWrapper>
  );
}
