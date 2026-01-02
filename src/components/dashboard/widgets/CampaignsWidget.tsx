import { Campaigns } from '../Campaigns';
import { WidgetWrapper } from './WidgetWrapper';
import type { WidgetProps } from './registry';

export function CampaignsWidget({ widgetId, isEditMode }: WidgetProps) {
  return (
    <WidgetWrapper
      title="Active Campaigns"
      widgetId={widgetId}
      isEditMode={isEditMode || false}
      dragHandleClassName="widget-drag-handle"
    >
      <Campaigns />
    </WidgetWrapper>
  );
}
