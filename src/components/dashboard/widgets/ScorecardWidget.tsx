import { Scorecard } from '../Scorecard';
import { WidgetWrapper } from './WidgetWrapper';
import type { WidgetProps } from './registry';

export function ScorecardWidget({ widgetId, isEditMode }: WidgetProps) {
  return (
    <WidgetWrapper
      title="Health Score"
      widgetId={widgetId}
      isEditMode={isEditMode || false}
      dragHandleClassName="widget-drag-handle"
    >
      <Scorecard />
    </WidgetWrapper>
  );
}
