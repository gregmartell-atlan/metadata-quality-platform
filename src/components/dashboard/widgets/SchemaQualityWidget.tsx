/**
 * Schema Quality Leaderboard Widget
 * Top/bottom schemas by quality score with database grouping
 */

import { useMemo } from 'react';
import { Layers } from 'lucide-react';
import { WidgetWrapper } from './WidgetWrapper';
import type { WidgetProps } from './registry';
import { useScoresStore } from '../../../stores/scoresStore';
import { ScoreBadge } from '../../shared/ScoreBadge';

export function SchemaQualityWidget({ widgetId, isEditMode }: WidgetProps) {
  const { bySchema } = useScoresStore();

  const schemaStats = useMemo(() => {
    return Array.from(bySchema.entries()).map(([schema, assets]) => {
      const scores = assets.map(a => a.score || 0);
      const avgScore = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;

      // Extract database from schema qualified name
      const parts = schema.split('/');
      const database = parts.length > 2 ? parts[1] : 'Unknown';
      const schemaName = parts[parts.length - 1] || schema;

      return {
        schema: schemaName,
        database,
        fullName: schema,
        assetCount: assets.length,
        avgScore: Math.round(avgScore)
      };
    }).sort((a, b) => b.avgScore - a.avgScore);
  }, [bySchema]);

  const topSchemas = schemaStats.slice(0, 5);
  const bottomSchemas = schemaStats.slice(-5).reverse();

  return (
    <WidgetWrapper
      title="Schema Quality Leaderboard"
      widgetId={widgetId}
      isEditMode={isEditMode || false}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {/* Top schemas */}
        <div>
          <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--score-excellent)', marginBottom: '8px' }}>
            ✨ Top Schemas
          </div>
          {topSchemas.map((schema, index) => (
            <div key={schema.fullName} style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px',
              marginBottom: '4px',
              background: 'var(--bg-tertiary)',
              borderRadius: '6px'
            }}>
              <span style={{ fontSize: '14px', fontWeight: 'bold', color: 'var(--accent-primary)', minWidth: '24px' }}>
                #{index + 1}
              </span>
              <Layers size={14} color="var(--text-muted)" />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '12px', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {schema.schema}
                </div>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                  {schema.database} • {schema.assetCount} assets
                </div>
              </div>
              <ScoreBadge score={schema.avgScore} showLabel={false} />
            </div>
          ))}
        </div>

        {/* Bottom schemas */}
        {bottomSchemas.length > 0 && (
          <div>
            <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--score-critical)', marginBottom: '8px' }}>
              ⚠️ Needs Attention
            </div>
            {bottomSchemas.map((schema) => (
              <div key={schema.fullName} style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px',
                marginBottom: '4px',
                background: 'rgba(239, 68, 68, 0.05)',
                borderRadius: '6px'
              }}>
                <Layers size={14} color="var(--score-critical)" />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '12px', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {schema.schema}
                  </div>
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                    {schema.database} • {schema.assetCount} assets
                  </div>
                </div>
                <ScoreBadge score={schema.avgScore} showLabel={false} />
              </div>
            ))}
          </div>
        )}
      </div>
    </WidgetWrapper>
  );
}
