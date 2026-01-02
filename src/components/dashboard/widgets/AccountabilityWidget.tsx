import { Accountability } from '../Accountability';
import { WidgetWrapper } from './WidgetWrapper';
import type { WidgetProps } from './registry';

export function AccountabilityWidget({ widgetId, widgetType, isEditMode }: WidgetProps) {
  return (
    <WidgetWrapper
      title="Accountability"
      widgetId={widgetId}
      widgetType={widgetType || 'accountability'}
      isEditMode={isEditMode || false}
      dragHandleClassName="widget-drag-handle"
    >
      <Accountability />
    </WidgetWrapper>
  );
}
