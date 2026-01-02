import { Tasks } from '../Tasks';
import { WidgetWrapper } from './WidgetWrapper';
import type { WidgetProps } from './registry';

export function TasksWidget({ widgetId, isEditMode }: WidgetProps) {
  return (
    <WidgetWrapper
      title="Open Tasks"
      widgetId={widgetId}
      isEditMode={isEditMode || false}
      dragHandleClassName="widget-drag-handle"
    >
      <Tasks />
    </WidgetWrapper>
  );
}
