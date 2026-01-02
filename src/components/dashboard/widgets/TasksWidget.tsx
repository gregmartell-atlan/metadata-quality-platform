import { Tasks } from '../Tasks';
import { WidgetWrapper } from './WidgetWrapper';
import type { WidgetProps } from './registry';

export function TasksWidget({ widgetId, widgetType, isEditMode }: WidgetProps) {
  return (
    <WidgetWrapper
      title="Open Tasks"
      widgetId={widgetId}
      widgetType={widgetType || 'tasks'}
      isEditMode={isEditMode || false}
      dragHandleClassName="widget-drag-handle"
    >
      <Tasks />
    </WidgetWrapper>
  );
}
