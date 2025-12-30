import { useMemo } from 'react';
import { CheckCircle2, Users, AlertCircle, Shield } from 'lucide-react';
import { useScoresStore } from '../../stores/scoresStore';
import { useAssetContextStore } from '../../stores/assetContextStore';
import './StatsRow.css';

export function StatsRow() {
  const { stats, assetsWithScores } = useScoresStore();
  const { getAssetCount } = useAssetContextStore();

  const totalAssets = assetsWithScores.length || getAssetCount();

  const statsData = useMemo(() => {
    const assetsWithDescriptionsPercent = totalAssets > 0
      ? Math.round((stats.assetsWithDescriptions / totalAssets) * 100)
      : 0;

    const assetsWithOwnersPercent = totalAssets > 0
      ? Math.round((stats.assetsWithOwners / totalAssets) * 100)
      : 0;

    const staleAssetsPercent = totalAssets > 0
      ? Math.round((stats.staleAssets / totalAssets) * 100)
      : 0;

    const certifiedAssetsPercent = totalAssets > 0
      ? Math.round((stats.certifiedAssets / totalAssets) * 100)
      : 0;

    return [
      {
        icon: CheckCircle2,
        iconClass: 'green',
        value: stats.assetsWithDescriptions,
        label: 'With Descriptions',
        percent: assetsWithDescriptionsPercent,
        trend: assetsWithDescriptionsPercent,
        color: 'var(--accent-primary, #00d4aa)',
      },
      {
        icon: Users,
        iconClass: 'blue',
        value: stats.assetsWithOwners,
        label: 'With Owners',
        percent: assetsWithOwnersPercent,
        trend: assetsWithOwnersPercent,
        color: 'var(--accent-info, #3b82f6)',
      },
      {
        icon: AlertCircle,
        iconClass: 'yellow',
        value: stats.staleAssets,
        label: 'Stale Assets',
        percent: staleAssetsPercent,
        trend: -staleAssetsPercent, // Negative because stale is bad
        color: 'var(--accent-warning, #f59e0b)',
        inverted: true, // Lower is better
      },
      {
        icon: Shield,
        iconClass: 'green',
        value: stats.certifiedAssets,
        label: 'Certified',
        percent: certifiedAssetsPercent,
        trend: certifiedAssetsPercent,
        color: 'var(--score-excellent, #22c55e)',
      },
    ];
  }, [stats, totalAssets]);

  return (
    <div className="stats-row">
      {statsData.map((stat, idx) => {
        const Icon = stat.icon;
        return (
          <div key={idx} className="stat-card">
            <div className="stat-header">
              <div className={`stat-icon ${stat.iconClass}`}>
                <Icon size={18} />
              </div>
              <span className={`stat-trend ${stat.trend >= 0 ? 'up' : 'down'}`}>
                {stat.trend >= 0 ? '↑' : '↓'} {Math.abs(stat.trend)}%
              </span>
            </div>
            <div className="stat-value">{stat.value}</div>
            <div className="stat-label">{stat.label}</div>
            {/* Progress bar */}
            <div className="stat-progress">
              <div className="stat-progress-track">
                <div
                  className="stat-progress-fill"
                  style={{
                    width: `${stat.percent}%`,
                    backgroundColor: stat.color
                  }}
                />
              </div>
              <span className="stat-progress-label">{stat.percent}% of total</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
