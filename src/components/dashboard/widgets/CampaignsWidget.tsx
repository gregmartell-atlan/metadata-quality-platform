import { Campaigns } from '../Campaigns';
import { WidgetWrapper } from './WidgetWrapper';
import type { WidgetProps } from './registry';

export function CampaignsWidget({ widgetId, widgetType, isEditMode }: WidgetProps) {
  return (
    <WidgetWrapper
      title="Active Campaigns"
      widgetId={widgetId}
      widgetType={widgetType || 'campaigns'}
      isEditMode={isEditMode || false}
      dragHandleClassName="widget-drag-handle"
    >
      <Campaigns />
    </WidgetWrapper>
  );
}
