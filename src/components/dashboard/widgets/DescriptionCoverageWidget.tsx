/**
 * Description Coverage Funnel Widget
 * Conversion funnel showing description completeness
 */

import { useMemo } from 'react';
import { FileText, Edit3, AlertCircle } from 'lucide-react';
import { WidgetWrapper } from './WidgetWrapper';
import type { WidgetProps } from './registry';
import { useScoresStore } from '../../../stores/scoresStore';

export function DescriptionCoverageWidget({ widgetId, widgetType, isEditMode }: WidgetProps) {
  const { assetsWithScores } = useScoresStore();

  const descriptionStats = useMemo(() => {
    const total = assetsWithScores.length;
    const withUserDesc = assetsWithScores.filter(a => a.userDescription).length;
    const withSystemDesc = assetsWithScores.filter(a => a.description && !a.userDescription).length;
    const noDesc = total - withUserDesc - withSystemDesc;

    return [
      {
        label: 'User Description',
        sublabel: 'Manually added',
        count: withUserDesc,
        percent: total > 0 ? Math.round((withUserDesc / total) * 100) : 0,
        icon: Edit3,
        color: 'var(--score-excellent)'
      },
      {
        label: 'System Description',
        sublabel: 'Auto-generated',
        count: withSystemDesc,
        percent: total > 0 ? Math.round((withSystemDesc / total) * 100) : 0,
        icon: FileText,
        color: 'var(--score-good)'
      },
      {
        label: 'No Description',
        sublabel: 'Missing',
        count: noDesc,
        percent: total > 0 ? Math.round((noDesc / total) * 100) : 0,
        icon: AlertCircle,
        color: 'var(--score-critical)'
      }
    ];
  }, [assetsWithScores]);

  return (
    <WidgetWrapper
      title="Description Coverage Funnel"
      widgetId={widgetId}
      widgetType={widgetType || 'description-coverage'}
      isEditMode={isEditMode || false}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '8px 0' }}>
        {descriptionStats.map((stat, index) => {
          const Icon = stat.icon;
          const width = 100 - (index * 15); // Funnel effect

          return (
            <div key={stat.label} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Icon size={14} color={stat.color} />
                <span style={{ fontSize: '13px', fontWeight: 500 }}>{stat.label}</span>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: 'auto' }}>
                  {stat.sublabel}
                </span>
              </div>
              <div style={{
                width: `${width}%`,
                height: '40px',
                background: `linear-gradient(90deg, ${stat.color}, ${stat.color}aa)`,
                borderRadius: '6px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0 16px',
                color: 'white',
                fontWeight: 'bold',
                marginLeft: `${(100 - width) / 2}%`,
                transition: 'all 0.3s'
              }}>
                <span>{stat.count} assets</span>
                <span>{stat.percent}%</span>
              </div>
            </div>
          );
        })}
      </div>
    </WidgetWrapper>
  );
}
