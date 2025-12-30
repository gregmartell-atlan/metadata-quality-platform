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
        trend: assetsWithDescriptionsPercent,
      },
      {
        icon: Users,
        iconClass: 'blue',
        value: stats.assetsWithOwners,
        label: 'With Owners',
        trend: assetsWithOwnersPercent,
      },
      {
        icon: AlertCircle,
        iconClass: 'yellow',
        value: stats.staleAssets,
        label: 'Stale Assets',
        trend: -staleAssetsPercent, // Negative because stale is bad
      },
      {
        icon: Shield,
        iconClass: 'green',
        value: stats.certifiedAssets,
        label: 'Certified',
        trend: certifiedAssetsPercent,
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
          </div>
        );
      })}
    </div>
  );
}

