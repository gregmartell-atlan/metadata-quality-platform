/**
 * Glossary Term Coverage Widget
 * Percentage of assets with glossary terms assigned
 */

import { useMemo } from 'react';
import { BookOpen, Tag } from 'lucide-react';
import { WidgetWrapper } from './WidgetWrapper';
import type { WidgetProps } from './registry';
import { useScoresStore } from '../../../stores/scoresStore';

export function GlossaryTermCoverageWidget({ widgetId, widgetType, isEditMode }: WidgetProps) {
  const { assetsWithScores } = useScoresStore();

  const glossaryStats = useMemo(() => {
    const withTerms = assetsWithScores.filter(a => a.meanings && a.meanings.length > 0).length;
    const total = assetsWithScores.length;
    const coverage = total > 0 ? Math.round((withTerms / total) * 100) : 0;

    // Extract term frequencies
    const termCounts = new Map<string, number>();
    assetsWithScores.forEach(asset => {
      if (asset.meanings && Array.isArray(asset.meanings)) {
        asset.meanings.forEach((term: any) => {
          const termName = typeof term === 'string' ? term : term.displayText || 'Unknown';
          termCounts.set(termName, (termCounts.get(termName) || 0) + 1);
        });
      }
    });

    const topTerms = Array.from(termCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([term, count]) => ({ term, count }));

    return {
      withTerms,
      withoutTerms: total - withTerms,
      total,
      coverage,
      topTerms
    };
  }, [assetsWithScores]);

  return (
    <WidgetWrapper
      title="Glossary Term Coverage"
      widgetId={widgetId}
      widgetType={widgetType || 'glossary-term-coverage'}
      isEditMode={isEditMode || false}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {/* Coverage gauge */}
        <div style={{ textAlign: 'center', padding: '16px' }}>
          <div style={{
            width: '120px',
            height: '120px',
            borderRadius: '50%',
            border: `8px solid var(--bg-tertiary)`,
            borderTopColor: glossaryStats.coverage >= 70 ? 'var(--score-excellent)' : glossaryStats.coverage >= 50 ? 'var(--score-fair)' : 'var(--score-critical)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto',
            transition: 'all 0.3s',
            transform: 'rotate(-90deg)'
          }}>
            <div style={{ transform: 'rotate(90deg)' }}>
              <div style={{ fontSize: '32px', fontWeight: 'bold', color: 'var(--text-primary)' }}>
                {glossaryStats.coverage}%
              </div>
            </div>
          </div>
          <div style={{ marginTop: '12px', fontSize: '13px', color: 'var(--text-muted)' }}>
            {glossaryStats.withTerms} of {glossaryStats.total} assets
          </div>
        </div>

        {/* Top terms */}
        <div>
          <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <BookOpen size={12} />
            Most Used Terms
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {glossaryStats.topTerms.map((term, index) => (
              <div key={term.term} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '14px', fontWeight: 'bold', color: 'var(--accent-primary)', minWidth: '20px' }}>
                  #{index + 1}
                </span>
                <span style={{ flex: 1, fontSize: '12px' }}>{term.term}</span>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{term.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </WidgetWrapper>
  );
}
