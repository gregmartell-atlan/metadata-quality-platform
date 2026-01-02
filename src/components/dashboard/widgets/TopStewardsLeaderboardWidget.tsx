/**
 * Top Stewards Leaderboard Widget
 * Ranks data stewards by quality score and activity
 */

import { useMemo } from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { WidgetWrapper } from './WidgetWrapper';
import type { WidgetProps } from './registry';
import { useScoresStore } from '../../../stores/scoresStore';

export function TopStewardsLeaderboardWidget({ widgetId, isEditMode }: WidgetProps) {
  const { byOwner } = useScoresStore();

  // Calculate top stewards from real data
  const topStewards = useMemo(() => {
    const stewardData = Array.from(byOwner.entries()).map(([owner, assets]) => {
      const scores = assets.map(a => a.score || 0);
      const avgScore = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;

      return {
        name: owner || 'Unassigned',
        initials: (owner || 'U').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2),
        assetCount: assets.length,
        avgScore: Math.round(avgScore),
        tasksDone: Math.floor(assets.length * 0.7), // Mock
        tasksTotal: assets.length,
        trend: Math.floor(Math.random() * 20) - 10 // Mock trend
      };
    });

    return stewardData
      .filter(s => s.name !== 'Unassigned')
      .sort((a, b) => b.avgScore - a.avgScore)
      .slice(0, 5);
  }, [byOwner]);

  return (
    <WidgetWrapper
      title="Top Stewards Leaderboard"
      widgetId={widgetId}
      isEditMode={isEditMode || false}
    >
      <div className="stewards-leaderboard" style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
              <th style={{ padding: '8px', textAlign: 'left', fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>Rank</th>
              <th style={{ padding: '8px', textAlign: 'left', fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>Steward</th>
              <th style={{ padding: '8px', textAlign: 'center', fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>Assets</th>
              <th style={{ padding: '8px', textAlign: 'center', fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>Score</th>
              <th style={{ padding: '8px', textAlign: 'center', fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>Tasks</th>
              <th style={{ padding: '8px', textAlign: 'center', fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>Trend</th>
            </tr>
          </thead>
          <tbody>
            {topStewards.length > 0 ? topStewards.map((steward, index) => (
              <tr key={steward.name} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                <td style={{ padding: '12px 8px', fontWeight: 'bold', color: 'var(--accent-primary)' }}>
                  #{index + 1}
                </td>
                <td style={{ padding: '12px 8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '50%',
                      background: 'var(--accent-primary)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '12px',
                      fontWeight: 'bold',
                      color: 'var(--bg-primary)'
                    }}>
                      {steward.initials}
                    </div>
                    <span style={{ fontSize: '13px' }}>{steward.name}</span>
                  </div>
                </td>
                <td style={{ padding: '12px 8px', textAlign: 'center', fontSize: '13px' }}>{steward.assetCount}</td>
                <td style={{ padding: '12px 8px', textAlign: 'center' }}>
                  <span style={{
                    padding: '4px 8px',
                    borderRadius: '4px',
                    background: steward.avgScore >= 70 ? 'rgba(34, 197, 94, 0.1)' : 'rgba(234, 179, 8, 0.1)',
                    color: steward.avgScore >= 70 ? 'var(--score-excellent)' : 'var(--score-fair)',
                    fontSize: '12px',
                    fontWeight: 'bold'
                  }}>
                    {steward.avgScore}
                  </span>
                </td>
                <td style={{ padding: '12px 8px', textAlign: 'center', fontSize: '12px' }}>
                  {steward.tasksDone}/{steward.tasksTotal}
                </td>
                <td style={{ padding: '12px 8px', textAlign: 'center' }}>
                  <span style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '2px',
                    color: steward.trend >= 0 ? 'var(--score-excellent)' : 'var(--score-critical)',
                    fontSize: '12px'
                  }}>
                    {steward.trend >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                    {Math.abs(steward.trend)}%
                  </span>
                </td>
              </tr>
            )) : (
              <tr>
                <td colSpan={6} style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                  No steward data available
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </WidgetWrapper>
  );
}
