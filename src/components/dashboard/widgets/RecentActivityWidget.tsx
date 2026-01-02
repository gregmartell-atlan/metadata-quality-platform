/**
 * Recent Activity Widget
 * Timeline of recent metadata changes
 */

import { useMemo } from 'react';
import { FileEdit, UserPlus, Award, Tag } from 'lucide-react';
import { WidgetWrapper } from './WidgetWrapper';
import type { WidgetProps } from './registry';

interface ActivityItem {
  id: string;
  type: 'description' | 'owner' | 'certification' | 'classification';
  asset: string;
  user: string;
  timestamp: Date;
  details: string;
}

const activityIcons = {
  description: FileEdit,
  owner: UserPlus,
  certification: Award,
  classification: Tag
};

export function RecentActivityWidget({ widgetId, widgetType, isEditMode }: WidgetProps) {
  // Mock activity data - replace with real activity log API
  const activities = useMemo<ActivityItem[]>(() => {
    const now = Date.now();
    return [
      {
        id: '1',
        type: 'description',
        asset: 'snowflake/prod/customer_transactions',
        user: 'Jane Doe',
        timestamp: new Date(now - 5 * 60 * 1000),
        details: 'Added description'
      },
      {
        id: '2',
        type: 'owner',
        asset: 'bigquery/analytics/marketing_campaigns',
        user: 'Alex Smith',
        timestamp: new Date(now - 15 * 60 * 1000),
        details: 'Assigned owner to Analytics team'
      },
      {
        id: '3',
        type: 'certification',
        asset: 'redshift/warehouse/dim_products',
        user: 'Maria Kim',
        timestamp: new Date(now - 45 * 60 * 1000),
        details: 'Certified asset'
      },
      {
        id: '4',
        type: 'classification',
        asset: 'postgres/legacy/user_profiles',
        user: 'Raj Patel',
        timestamp: new Date(now - 2 * 60 * 60 * 1000),
        details: 'Added PII classification'
      },
      {
        id: '5',
        type: 'description',
        asset: 'snowflake/analytics/fact_sales',
        user: 'Jane Doe',
        timestamp: new Date(now - 3 * 60 * 60 * 1000),
        details: 'Updated description'
      }
    ];
  }, []);

  const formatTimestamp = (timestamp: Date) => {
    const now = Date.now();
    const diff = now - timestamp.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  return (
    <WidgetWrapper
      title="Recent Activity"
      widgetId={widgetId}
      widgetType={widgetType || 'recent-activity'}
      isEditMode={isEditMode || false}
    >
      <div className="activity-feed" style={{ maxHeight: '300px', overflowY: 'auto' }}>
        {activities.map((activity) => {
          const Icon = activityIcons[activity.type];
          return (
            <div
              key={activity.id}
              className="activity-item"
              style={{
                display: 'flex',
                gap: '12px',
                padding: '12px 0',
                borderBottom: '1px solid var(--border-subtle)'
              }}
            >
              <div style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                background: 'var(--bg-tertiary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}>
                <Icon size={16} color="var(--accent-primary)" />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '13px', color: 'var(--text-primary)', marginBottom: '4px' }}>
                  <span style={{ fontWeight: '500' }}>{activity.user}</span> {activity.details}
                </div>
                <div style={{
                  fontSize: '11px',
                  color: 'var(--text-muted)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}>
                  {activity.asset}
                </div>
              </div>
              <div style={{
                fontSize: '11px',
                color: 'var(--text-muted)',
                flexShrink: 0
              }}>
                {formatTimestamp(activity.timestamp)}
              </div>
            </div>
          );
        })}
      </div>
    </WidgetWrapper>
  );
}
