import { OwnerPivot } from '../OwnerPivot';
import { WidgetWrapper } from './WidgetWrapper';
import type { WidgetProps } from './registry';

export function OwnerPivotWidget({ widgetId, isEditMode }: WidgetProps) {
  return (
    <WidgetWrapper
      title="Owner Pivot Analysis"
      widgetId={widgetId}
      isEditMode={isEditMode || false}
      dragHandleClassName="widget-drag-handle"
    >
      <OwnerPivot />
    </WidgetWrapper>
  );
}
