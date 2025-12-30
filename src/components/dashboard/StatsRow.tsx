import { CheckCircle2, Users, AlertCircle, Shield } from 'lucide-react';
import { useScoresStore } from '../../stores/scoresStore';
import { useAssetStore } from '../../stores/assetStore';
import './StatsRow.css';

export function StatsRow() {
  const { stats: scoresStats, assetsWithScores } = useScoresStore();
  const { selectedCount } = useAssetStore();
  
  // Calculate percentages and trends (trends are placeholders for now)
  const totalAssets = assetsWithScores.length || selectedCount || 1;
  const assetsWithOwnersPercent = totalAssets > 0 
    ? Math.round((scoresStats.assetsWithOwners / totalAssets) * 100)
    : 0;
  
  // Use real stats if available, otherwise show 0
  const stats = [
    {
      icon: CheckCircle2,
      iconClass: 'green',
      value: scoresStats.assetsWithDescriptions.toLocaleString(),
      label: 'Assets with Descriptions',
      trend: 0, // TODO: Calculate trend from previous period
    },
    {
      icon: Users,
      iconClass: 'yellow',
      value: `${assetsWithOwnersPercent}%`,
      label: 'Assets with Owners',
      trend: 0, // TODO: Calculate trend
    },
    {
      icon: AlertCircle,
      iconClass: 'red',
      value: scoresStats.staleAssets.toLocaleString(),
      label: 'Stale Assets (>90 days)',
      trend: 0, // TODO: Calculate trend
    },
    {
      icon: Shield,
      iconClass: 'blue',
      value: scoresStats.certifiedAssets.toLocaleString(),
      label: 'Certified Assets',
      trend: 0, // TODO: Calculate trend
    },
  ];

  return (
    <div className="stats-row">
      {stats.map((stat, idx) => {
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
          </div>
        );
      })}
    </div>
  );
}

