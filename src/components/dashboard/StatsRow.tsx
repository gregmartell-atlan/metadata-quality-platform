import { useMemo } from 'react';
import { CheckCircle2, Users, AlertCircle, Shield } from 'lucide-react';
import { useScoresStore } from '../../stores/scoresStore';
import { useAssetContextStore } from '../../stores/assetContextStore';
import { Tooltip } from '../shared';
import './StatsRow.css';

// Stat descriptions for tooltips
const statDescriptions: Record<string, { title: string; description: string; impact: string }> = {
  'With Descriptions': {
    title: 'Assets with Descriptions',
    description: 'Assets that have a human-readable description explaining what the data contains and how it should be used.',
    impact: 'Descriptions are critical for discoverability. Without them, users cannot understand what data assets contain.',
  },
  'With Owners': {
    title: 'Assets with Owners',
    description: 'Assets that have an assigned owner (individual or team) who is accountable for the data quality and metadata.',
    impact: 'Ownership is essential for accountability. Unowned assets have no one responsible for their quality.',
  },
  'Stale Assets': {
    title: 'Stale Assets',
    description: 'Assets whose metadata has not been updated recently and may be outdated or no longer accurate.',
    impact: 'Stale metadata can mislead users and erode trust in the data catalog. Regular reviews are recommended.',
  },
  'Certified': {
    title: 'Certified Assets',
    description: 'Assets that have been reviewed and approved for use. Certified assets are trusted for business decisions.',
    impact: 'Certification signals quality and reliability. Aim to certify your most important data products.',
  },
};

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
        const statInfo = statDescriptions[stat.label];
        return (
          <Tooltip
            key={idx}
            content={
              <div className="stat-tooltip">
                <div className="stat-tooltip-header">
                  <div className={`stat-tooltip-icon ${stat.iconClass}`}>
                    <Icon size={16} />
                  </div>
                  <strong>{statInfo?.title || stat.label}</strong>
                </div>
                <p className="stat-tooltip-desc">{statInfo?.description}</p>
                <div className="stat-tooltip-stats">
                  <div className="stat-tooltip-stat">
                    <span className="stat-tooltip-value">{stat.value}</span>
                    <span className="stat-tooltip-label">Assets</span>
                  </div>
                  <div className="stat-tooltip-stat">
                    <span className="stat-tooltip-value">{stat.percent}%</span>
                    <span className="stat-tooltip-label">of Total</span>
                  </div>
                </div>
                <div className="stat-tooltip-impact">
                  <strong>Why it matters:</strong> {statInfo?.impact}
                </div>
              </div>
            }
            position="bottom"
            maxWidth={300}
          >
            <div className="stat-card">
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
          </Tooltip>
        );
      })}
    </div>
  );
}
