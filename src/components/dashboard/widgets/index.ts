/**
 * Widget Registration
 * Registers all dashboard widgets with the registry
 */

import { registerWidget } from './registry';
import { ScorecardWidget } from './ScorecardWidget';
import { StatsRowWidget } from './StatsRowWidget';
import { HeatmapWidget } from './HeatmapWidget';
import { OwnerPivotWidget } from './OwnerPivotWidget';
import { CampaignsWidget } from './CampaignsWidget';
import { TrendChartWidget } from './TrendChartWidget';
import { TasksWidget } from './TasksWidget';
import { AccountabilityWidget} from './AccountabilityWidget';
import { DataQualityTrendsWidget } from './DataQualityTrendsWidget';
import { AssetTypeDistributionWidget } from './AssetTypeDistributionWidget';
import { TopStewardsLeaderboardWidget } from './TopStewardsLeaderboardWidget';
import { RecentActivityWidget } from './RecentActivityWidget';
import { DomainCoverageWidget } from './DomainCoverageWidget';
import { CertificationStatusWidget } from './CertificationStatusWidget';
import { FreshnessDashboardWidget } from './FreshnessDashboardWidget';
import { DescriptionCoverageWidget } from './DescriptionCoverageWidget';
import { ClassificationHeatmapWidget } from './ClassificationHeatmapWidget';
import { GlossaryTermCoverageWidget } from './GlossaryTermCoverageWidget';
import { LineageCoverageWidget } from './LineageCoverageWidget';
import { TagCloudWidget } from './TagCloudWidget';
import { ConnectorHealthWidget } from './ConnectorHealthWidget';
import { SchemaQualityWidget } from './SchemaQualityWidget';

// Register existing widgets
registerWidget({
  id: 'scorecard',
  type: 'scorecard',
  title: 'Health Score',
  description: 'Overall quality score with dimension breakdown',
  category: 'core',
  defaultSize: { w: 3, h: 2 },
  minSize: { w: 3, h: 2 },
  maxSize: { w: 4, h: 3 },
  component: ScorecardWidget,
  icon: 'Activity'
});

registerWidget({
  id: 'stats-row',
  type: 'stats-row',
  title: 'Key Metrics',
  description: 'High-level statistics at a glance',
  category: 'core',
  defaultSize: { w: 9, h: 1 },
  minSize: { w: 6, h: 1 },
  maxSize: { w: 12, h: 2 },
  component: StatsRowWidget,
  icon: 'BarChart3'
});

registerWidget({
  id: 'heatmap',
  type: 'heatmap',
  title: 'Quality Heatmap',
  description: 'Quality dimensions across pivots',
  category: 'analytics',
  defaultSize: { w: 9, h: 2 },
  minSize: { w: 6, h: 2 },
  maxSize: { w: 12, h: 4 },
  component: HeatmapWidget,
  icon: 'Grid3x3'
});

registerWidget({
  id: 'owner-pivot',
  type: 'owner-pivot',
  title: 'Owner Pivot Analysis',
  description: 'Cross-dimensional pivot table',
  category: 'analytics',
  defaultSize: { w: 12, h: 2 },
  minSize: { w: 8, h: 2 },
  component: OwnerPivotWidget,
  icon: 'Table'
});

registerWidget({
  id: 'campaigns',
  type: 'campaigns',
  title: 'Active Campaigns',
  description: 'Campaign tracking and progress',
  category: 'management',
  defaultSize: { w: 4, h: 2 },
  minSize: { w: 3, h: 2 },
  maxSize: { w: 6, h: 3 },
  component: CampaignsWidget,
  icon: 'Target'
});

registerWidget({
  id: 'trend-chart',
  type: 'trend-chart',
  title: 'Quality Trend',
  description: '90-day quality score trend',
  category: 'analytics',
  defaultSize: { w: 4, h: 2 },
  minSize: { w: 4, h: 2 },
  maxSize: { w: 8, h: 3 },
  component: TrendChartWidget,
  icon: 'TrendingUp'
});

registerWidget({
  id: 'tasks',
  type: 'tasks',
  title: 'Open Tasks',
  description: 'Pending stewardship tasks',
  category: 'management',
  defaultSize: { w: 4, h: 2 },
  minSize: { w: 3, h: 2 },
  maxSize: { w: 6, h: 4 },
  component: TasksWidget,
  icon: 'CheckSquare'
});

registerWidget({
  id: 'accountability',
  type: 'accountability',
  title: 'Accountability',
  description: 'Steward performance metrics',
  category: 'management',
  defaultSize: { w: 4, h: 2 },
  minSize: { w: 4, h: 2 },
  maxSize: { w: 8, h: 3 },
  component: AccountabilityWidget,
  icon: 'Users'
});

// Register new widgets
registerWidget({
  id: 'data-quality-trends',
  type: 'data-quality-trends',
  title: 'Data Quality Trends',
  description: 'Historical quality scores across 5 dimensions',
  category: 'analytics',
  defaultSize: { w: 8, h: 2 },
  minSize: { w: 6, h: 2 },
  maxSize: { w: 12, h: 3 },
  component: DataQualityTrendsWidget,
  icon: 'TrendingUp',
  isNew: true
});

registerWidget({
  id: 'asset-type-distribution',
  type: 'asset-type-distribution',
  title: 'Asset Type Distribution',
  description: 'Breakdown of assets by type with pie chart',
  category: 'analytics',
  defaultSize: { w: 4, h: 2 },
  minSize: { w: 4, h: 2 },
  maxSize: { w: 6, h: 3 },
  component: AssetTypeDistributionWidget,
  icon: 'PieChart',
  isNew: true
});

registerWidget({
  id: 'top-stewards-leaderboard',
  type: 'top-stewards-leaderboard',
  title: 'Top Stewards',
  description: 'Ranked list of most active data stewards',
  category: 'activity',
  defaultSize: { w: 4, h: 3 },
  minSize: { w: 4, h: 3 },
  maxSize: { w: 6, h: 4 },
  component: TopStewardsLeaderboardWidget,
  icon: 'Award',
  isNew: true
});

registerWidget({
  id: 'recent-activity',
  type: 'recent-activity',
  title: 'Recent Activity',
  description: 'Timeline of recent metadata changes',
  category: 'activity',
  defaultSize: { w: 4, h: 2 },
  minSize: { w: 4, h: 2 },
  maxSize: { w: 6, h: 4 },
  component: RecentActivityWidget,
  icon: 'Clock',
  isNew: true
});

// Register additional quality widgets
registerWidget({
  id: 'domain-coverage',
  type: 'domain-coverage',
  title: 'Domain Coverage Matrix',
  description: 'Quality metrics by data domain',
  category: 'analytics',
  defaultSize: { w: 6, h: 2 },
  minSize: { w: 4, h: 2 },
  maxSize: { w: 12, h: 3 },
  component: DomainCoverageWidget,
  icon: 'Layers',
  isNew: true
});

registerWidget({
  id: 'certification-status',
  type: 'certification-status',
  title: 'Certification Status',
  description: 'Asset breakdown by certificate status',
  category: 'core',
  defaultSize: { w: 4, h: 2 },
  minSize: { w: 3, h: 2 },
  maxSize: { w: 6, h: 3 },
  component: CertificationStatusWidget,
  icon: 'Shield',
  isNew: true
});

registerWidget({
  id: 'freshness-dashboard',
  type: 'freshness-dashboard',
  title: 'Data Freshness',
  description: 'Stale data detection by age buckets',
  category: 'analytics',
  defaultSize: { w: 4, h: 2 },
  minSize: { w: 4, h: 2 },
  maxSize: { w: 6, h: 3 },
  component: FreshnessDashboardWidget,
  icon: 'Clock',
  isNew: true
});

registerWidget({
  id: 'description-coverage',
  type: 'description-coverage',
  title: 'Description Coverage',
  description: 'User vs system vs no descriptions',
  category: 'analytics',
  defaultSize: { w: 4, h: 2 },
  minSize: { w: 4, h: 2 },
  maxSize: { w: 6, h: 3 },
  component: DescriptionCoverageWidget,
  icon: 'FileText',
  isNew: true
});

registerWidget({
  id: 'classification-heatmap',
  type: 'classification-heatmap',
  title: 'Classification Heatmap',
  description: 'Classifications across connections',
  category: 'analytics',
  defaultSize: { w: 6, h: 2 },
  minSize: { w: 6, h: 2 },
  maxSize: { w: 12, h: 3 },
  component: ClassificationHeatmapWidget,
  icon: 'Grid',
  isNew: true
});

registerWidget({
  id: 'glossary-term-coverage',
  type: 'glossary-term-coverage',
  title: 'Glossary Term Coverage',
  description: 'Assets with glossary terms assigned',
  category: 'analytics',
  defaultSize: { w: 4, h: 2 },
  minSize: { w: 4, h: 2 },
  maxSize: { w: 6, h: 3 },
  component: GlossaryTermCoverageWidget,
  icon: 'BookOpen',
  isNew: true
});

registerWidget({
  id: 'lineage-coverage',
  type: 'lineage-coverage',
  title: 'Lineage Coverage',
  description: 'Assets with upstream/downstream lineage',
  category: 'analytics',
  defaultSize: { w: 4, h: 2 },
  minSize: { w: 4, h: 2 },
  maxSize: { w: 6, h: 3 },
  component: LineageCoverageWidget,
  icon: 'GitBranch',
  isNew: true
});

registerWidget({
  id: 'tag-cloud',
  type: 'tag-cloud',
  title: 'Tag Cloud',
  description: 'Most commonly used tags',
  category: 'activity',
  defaultSize: { w: 6, h: 2 },
  minSize: { w: 4, h: 2 },
  maxSize: { w: 12, h: 3 },
  component: TagCloudWidget,
  icon: 'Tags',
  isNew: true
});

registerWidget({
  id: 'connector-health',
  type: 'connector-health',
  title: 'Connector Health',
  description: 'Quality scores by connector',
  category: 'analytics',
  defaultSize: { w: 6, h: 2 },
  minSize: { w: 6, h: 2 },
  maxSize: { w: 12, h: 3 },
  component: ConnectorHealthWidget,
  icon: 'Database',
  isNew: true
});

registerWidget({
  id: 'schema-quality',
  type: 'schema-quality',
  title: 'Schema Quality',
  description: 'Top and bottom schemas by score',
  category: 'analytics',
  defaultSize: { w: 4, h: 3 },
  minSize: { w: 4, h: 3 },
  maxSize: { w: 8, h: 4 },
  component: SchemaQualityWidget,
  icon: 'Layers',
  isNew: true
});

// Export all widget components
export {
  ScorecardWidget,
  StatsRowWidget,
  HeatmapWidget,
  OwnerPivotWidget,
  CampaignsWidget,
  TrendChartWidget,
  TasksWidget,
  AccountabilityWidget,
  DataQualityTrendsWidget,
  AssetTypeDistributionWidget,
  TopStewardsLeaderboardWidget,
  RecentActivityWidget,
  DomainCoverageWidget,
  CertificationStatusWidget,
  FreshnessDashboardWidget,
  DescriptionCoverageWidget,
  ClassificationHeatmapWidget,
  GlossaryTermCoverageWidget,
  LineageCoverageWidget,
  TagCloudWidget,
  ConnectorHealthWidget,
  SchemaQualityWidget
};
