/**
 * Certification Status Breakdown Widget
 * Asset counts by certificate status
 */

import { useMemo } from 'react';
import { Award, AlertTriangle, HelpCircle } from 'lucide-react';
import { WidgetWrapper } from './WidgetWrapper';
import type { WidgetProps } from './registry';
import { useScoresStore } from '../../../stores/scoresStore';

export function CertificationStatusWidget({ widgetId, widgetType, isEditMode }: WidgetProps) {
  const { byCertification } = useScoresStore();

  const certStats = useMemo(() => {
    const stats = Array.from(byCertification.entries()).map(([status, assets]) => ({
      status: status || 'None',
      count: assets.length,
      percentage: 0 // Will calculate below
    }));

    const total = stats.reduce((sum, s) => sum + s.count, 0);
    stats.forEach(s => {
      s.percentage = total > 0 ? Math.round((s.count / total) * 100) : 0;
    });

    return stats.sort((a, b) => b.count - a.count);
  }, [byCertification]);

  const getIcon = (status: string) => {
    if (status === 'VERIFIED') return Award;
    if (status === 'DRAFT') return HelpCircle;
    if (status === 'DEPRECATED') return AlertTriangle;
    return HelpCircle;
  };

  const getColor = (status: string) => {
    if (status === 'VERIFIED') return 'var(--score-excellent)';
    if (status === 'DRAFT') return 'var(--score-fair)';
    if (status === 'DEPRECATED') return 'var(--score-critical)';
    return 'var(--text-muted)';
  };

  return (
    <WidgetWrapper
      title="Certification Status"
      widgetId={widgetId}
      widgetType={widgetType || 'certification-status'}
      isEditMode={isEditMode || false}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '8px 0' }}>
        {certStats.map((stat) => {
          const Icon = getIcon(stat.status);
          const color = getColor(stat.status);

          return (
            <div key={stat.status} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                background: 'var(--bg-tertiary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}>
                <Icon size={18} color={color} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '13px', fontWeight: 500, marginBottom: '4px' }}>
                  {stat.status}
                </div>
                <div style={{ width: '100%', height: '6px', background: 'var(--bg-tertiary)', borderRadius: '3px', overflow: 'hidden' }}>
                  <div style={{
                    width: `${stat.percentage}%`,
                    height: '100%',
                    background: color,
                    transition: 'width 0.3s'
                  }} />
                </div>
              </div>
              <div style={{ textAlign: 'right', minWidth: '80px' }}>
                <div style={{ fontSize: '16px', fontWeight: 'bold', color }}>{stat.count}</div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{stat.percentage}%</div>
              </div>
            </div>
          );
        })}
      </div>
    </WidgetWrapper>
  );
}
