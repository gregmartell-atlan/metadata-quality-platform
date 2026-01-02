import { Accountability } from '../Accountability';
import { WidgetWrapper } from './WidgetWrapper';
import type { WidgetProps } from './registry';

export function AccountabilityWidget({ widgetId, isEditMode }: WidgetProps) {
  return (
    <WidgetWrapper
      title="Accountability"
      widgetId={widgetId}
      isEditMode={isEditMode || false}
      dragHandleClassName="widget-drag-handle"
    >
      <Accountability />
    </WidgetWrapper>
  );
}
