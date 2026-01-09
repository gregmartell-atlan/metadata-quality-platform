/**
 * Tag Cloud Widget
 * Most commonly used tags with frequency weighting
 */

import { useMemo } from 'react';
import { Tag } from 'lucide-react';
import { WidgetWrapper } from './WidgetWrapper';
import type { WidgetProps } from './registry';
import { useScoresStore } from '../../../stores/scoresStore';

export function TagCloudWidget({ widgetId, widgetType, isEditMode }: WidgetProps) {
  const { byTag } = useScoresStore();

  const tagData = useMemo(() => {
    const tags = Array.from(byTag.entries())
      .map(([tag, assets]) => ({
        tag: tag || 'Untagged',
        count: assets.length
      }))
      .filter(t => t.tag !== 'Untagged')
      .sort((a, b) => b.count - a.count)
      .slice(0, 20);

    const maxCount = tags.length > 0 ? tags[0].count : 1;

    return tags.map(t => ({
      ...t,
      size: 12 + Math.round((t.count / maxCount) * 12) // 12-24px font size
    }));
  }, [byTag]);

  return (
    <WidgetWrapper
      title="Tag Cloud"
      widgetId={widgetId}
      widgetType={widgetType || 'tag-cloud'}
      isEditMode={isEditMode || false}
    >
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '12px',
        padding: '8px',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '200px'
      }}>
        {tagData.length > 0 ? tagData.map((tag) => (
          <div
            key={tag.tag}
            style={{
              padding: '6px 12px',
              background: 'var(--bg-tertiary)',
              borderRadius: '6px',
              fontSize: `${tag.size}px`,
              fontWeight: 500,
              color: 'var(--text-primary)',
              cursor: 'pointer',
              transition: 'all 0.2s',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--accent-primary)';
              e.currentTarget.style.color = 'var(--bg-primary)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'var(--bg-tertiary)';
              e.currentTarget.style.color = 'var(--text-primary)';
            }}
          >
            <Tag size={tag.size * 0.7} />
            {tag.tag}
            <span style={{ fontSize: '10px', opacity: 0.7 }}>({tag.count})</span>
          </div>
        )) : (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
            No tags found
          </div>
        )}
      </div>
    </WidgetWrapper>
  );
}
