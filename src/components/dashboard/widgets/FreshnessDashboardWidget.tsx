/**
 * Freshness Dashboard Widget
 * Stale data detection - assets by last sync/update time
 */

import { useMemo } from 'react';
import { Calendar, AlertTriangle } from 'lucide-react';
import { WidgetWrapper } from './WidgetWrapper';
import type { WidgetProps } from './registry';
import { useScoresStore } from '../../../stores/scoresStore';

export function FreshnessDashboardWidget({ widgetId, isEditMode }: WidgetProps) {
  const { assetsWithScores } = useScoresStore();

  const freshnessStats = useMemo(() => {
    const now = Date.now();
    const day = 24 * 60 * 60 * 1000;

    const buckets = {
      current: 0,    // < 24 hours
      recent: 0,     // 1-7 days
      aging: 0,      // 7-30 days
      stale: 0,      // 30-90 days
      veryStale: 0   // > 90 days
    };

    assetsWithScores.forEach(asset => {
      const lastUpdate = asset.updateTime || asset.sourceUpdatedAt || 0;
      const age = now - lastUpdate;

      if (age < day) buckets.current++;
      else if (age < 7 * day) buckets.recent++;
      else if (age < 30 * day) buckets.aging++;
      else if (age < 90 * day) buckets.stale++;
      else buckets.veryStale++;
    });

    return [
      { label: 'Current', sublabel: '< 24 hours', count: buckets.current, color: 'var(--score-excellent)', percent: 0 },
      { label: 'Recent', sublabel: '1-7 days', count: buckets.recent, color: 'var(--score-good)', percent: 0 },
      { label: 'Aging', sublabel: '7-30 days', count: buckets.aging, color: 'var(--score-fair)', percent: 0 },
      { label: 'Stale', sublabel: '30-90 days', count: buckets.stale, color: 'var(--score-poor)', percent: 0 },
      { label: 'Very Stale', sublabel: '> 90 days', count: buckets.veryStale, color: 'var(--score-critical)', percent: 0 }
    ].map(bucket => ({
      ...bucket,
      percent: assetsWithScores.length > 0 ? Math.round((bucket.count / assetsWithScores.length) * 100) : 0
    }));
  }, [assetsWithScores]);

  const staleCount = freshnessStats[3].count + freshnessStats[4].count;

  return (
    <WidgetWrapper
      title="Data Freshness"
      widgetId={widgetId}
      isEditMode={isEditMode || false}
    >
      {staleCount > 0 && (
        <div style={{
          padding: '8px 12px',
          background: 'rgba(239, 68, 68, 0.1)',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          borderRadius: '6px',
          marginBottom: '12px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          fontSize: '12px',
          color: '#ef4444'
        }}>
          <AlertTriangle size={14} />
          {staleCount} assets haven't been updated in 30+ days
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {freshnessStats.map((bucket) => (
          <div key={bucket.label} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Calendar size={14} color={bucket.color} style={{ flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span style={{ fontSize: '12px', fontWeight: 500 }}>{bucket.label}</span>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{bucket.sublabel}</span>
              </div>
              <div style={{ width: '100%', height: '6px', background: 'var(--bg-tertiary)', borderRadius: '3px', overflow: 'hidden' }}>
                <div style={{
                  width: `${bucket.percent}%`,
                  height: '100%',
                  background: bucket.color,
                  transition: 'width 0.3s'
                }} />
              </div>
            </div>
            <div style={{ textAlign: 'right', minWidth: '60px', fontSize: '12px', color: bucket.color, fontWeight: 'bold' }}>
              {bucket.count} ({bucket.percent}%)
            </div>
          </div>
        ))}
      </div>
    </WidgetWrapper>
  );
}
