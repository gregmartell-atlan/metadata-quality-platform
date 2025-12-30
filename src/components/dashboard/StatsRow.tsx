import { useMemo } from 'react';
import { CheckCircle2, Users, AlertCircle, Shield } from 'lucide-react';
import { useScoresStore } from '../../stores/scoresStore';
import { useAssetStore } from '../../stores/assetStore';
import { useAssetContextStore } from '../../stores/assetContextStore';
import { logger } from '../../utils/logger';
import './StatsRow.css';

export function StatsRow() {
  const { stats: scoresStats, assetsWithScores } = useScoresStore();
  const { selectedCount } = useAssetStore();
  // Subscribe directly to store state to get reactive updates
  const contextAssets = useAssetContextStore((state) => state.contextAssets);
  const getAssetCount = useAssetContextStore((state) => state.getAssetCount);
  
  // Use context assets if available, fallback to assetsWithScores
  const effectiveAssets = contextAssets.length > 0 ? contextAssets : assetsWithScores.map(item => item.asset);
  const effectiveCount = contextAssets.length > 0 ? getAssetCount() : (assetsWithScores.length || selectedCount || 0);
  
  // Calculate stats from effective assets
  const calculatedStats = useMemo(() => {
    const startTime = performance.now();
    logger.info('StatsRow: Calculating stats', {
      contextAssetsCount: contextAssets.length,
      assetsWithScoresCount: assetsWithScores.length,
      effectiveAssetsCount: effectiveAssets.length,
      effectiveCount
    });
    
    if (effectiveAssets.length === 0) {
      logger.warn('StatsRow: No assets available for stats calculation');
      return {
        assetsWithDescriptions: 0,
        assetsWithOwners: 0,
        staleAssets: 0,
        certifiedAssets: 0,
      };
    }
    
    const now = Date.now();
    const ninetyDaysAgo = now - 90 * 24 * 60 * 60 * 1000;
    
    let assetsWithDescriptions = 0;
    let assetsWithOwners = 0;
    let staleAssets = 0;
    let certifiedAssets = 0;
    
    effectiveAssets.forEach((asset) => {
      // Check description
      if (asset.description || asset.userDescription) {
        assetsWithDescriptions++;
      }
      
      // Check owner
      if (
        (Array.isArray(asset.ownerUsers) && asset.ownerUsers.length > 0) ||
        (Array.isArray(asset.ownerGroups) && asset.ownerGroups.length > 0)
      ) {
        assetsWithOwners++;
      }
      
      // Check stale (older than 90 days)
      if (asset.updateTime) {
        const updateTime = typeof asset.updateTime === 'number' 
          ? asset.updateTime 
          : new Date(asset.updateTime).getTime();
        if (updateTime < ninetyDaysAgo) {
          staleAssets++;
        }
      }
      
      // Check certified
      if (asset.certificateStatus === 'VERIFIED') {
        certifiedAssets++;
      }
    });
    
    const duration = performance.now() - startTime;
    logger.info('StatsRow: Stats calculated', {
      assetsWithDescriptions,
      assetsWithOwners,
      staleAssets,
      certifiedAssets,
      totalAssets: effectiveAssets.length,
      duration: `${duration.toFixed(2)}ms`
    });
    
    return {
      assetsWithDescriptions,
      assetsWithOwners,
      staleAssets,
      certifiedAssets,
    };
  }, [effectiveAssets, contextAssets.length, assetsWithScores.length]);
  
  // Use calculated stats if we have context assets, otherwise use scoresStore stats
  const finalStats = contextAssets.length > 0 ? calculatedStats : scoresStats;
  
  // Calculate percentages and trends (trends are placeholders for now)
  const totalAssets = effectiveCount || 1;
  const assetsWithOwnersPercent = totalAssets > 0 
    ? Math.round((finalStats.assetsWithOwners / totalAssets) * 100)
    : 0;
  
  // Use calculated stats
  const stats = [
    {
      icon: CheckCircle2,
      iconClass: 'green',
      value: finalStats.assetsWithDescriptions.toLocaleString(),
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
      value: finalStats.staleAssets.toLocaleString(),
      label: 'Stale Assets (>90 days)',
      trend: 0, // TODO: Calculate trend
    },
    {
      icon: Shield,
      iconClass: 'blue',
      value: finalStats.certifiedAssets.toLocaleString(),
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

