/**
 * RemediationPrioritizer - Actionable Remediation List
 *
 * Shows a prioritized list of what to fix, with estimated impact.
 * Groups by gap type (missing descriptions, owners, etc.) and ranks by potential improvement.
 */

import { useMemo, memo, useState } from 'react';
import { ChevronDown, ChevronRight, FileText, Users, Tag, Link, GitBranch, Award, TrendingUp, Filter } from 'lucide-react';
import { InfoTooltip } from '../shared';
import { calculatePopularityScore } from '../../utils/popularityScore';
import type { AssetWithScores } from '../../stores/scoresStore';
import './RemediationPrioritizer.css';

interface RemediationPrioritizerProps {
  assets: AssetWithScores[];
  onAssetClick?: (asset: AssetWithScores) => void;
}

interface GapCategory {
  id: string;
  name: string;
  icon: React.ReactNode;
  description: string;
  assets: AssetWithScores[];
  impactPerAsset: number; // Estimated score improvement per asset fixed
  totalImpact: number; // Estimated overall score improvement if all fixed
  effortEstimate: string;
}

type DimensionFilter = 'all' | 'assetType' | 'connection' | 'owner';

// Estimate how much fixing each gap type improves overall score
const GAP_WEIGHTS = {
  description: 15, // High impact on completeness
  owner: 12,
  glossaryTerms: 8,
  tags: 6,
  certification: 10,
  lineage: 8,
};

/**
 * Get unique dimension values for filtering
 */
function getDimensionValues(assets: AssetWithScores[], dimension: DimensionFilter): string[] {
  const values = new Set<string>();

  assets.forEach(asset => {
    let value: string | undefined;
    switch (dimension) {
      case 'assetType':
        value = asset.asset.typeName;
        break;
      case 'connection':
        value = asset.asset.connectionName || asset.asset.connectionQualifiedName?.split('/').pop();
        break;
      case 'owner':
        value = asset.asset.ownerUsers?.[0] || asset.asset.ownerGroups?.[0] || 'Unowned';
        break;
    }
    if (value) values.add(value);
  });

  return Array.from(values).sort();
}

export const RemediationPrioritizer = memo(function RemediationPrioritizer({
  assets,
  onAssetClick,
}: RemediationPrioritizerProps) {
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'impact' | 'count'>('impact');
  const [filterDimension, setFilterDimension] = useState<DimensionFilter>('all');
  const [filterValue, setFilterValue] = useState<string>('');
  const [showFilters, setShowFilters] = useState(false);

  // Get available filter values based on selected dimension
  const filterOptions = useMemo(() => {
    if (filterDimension === 'all') return [];
    return getDimensionValues(assets, filterDimension);
  }, [assets, filterDimension]);

  // Filter assets based on dimension selection
  const filteredAssets = useMemo(() => {
    if (filterDimension === 'all' || !filterValue) return assets;

    return assets.filter(asset => {
      switch (filterDimension) {
        case 'assetType':
          return asset.asset.typeName === filterValue;
        case 'connection':
          return (asset.asset.connectionName || asset.asset.connectionQualifiedName?.split('/').pop()) === filterValue;
        case 'owner':
          const owner = asset.asset.ownerUsers?.[0] || asset.asset.ownerGroups?.[0] || 'Unowned';
          return owner === filterValue;
        default:
          return true;
      }
    });
  }, [assets, filterDimension, filterValue]);

  const { categories, summary } = useMemo(() => {
    // Analyze gaps
    const missingDescription: AssetWithScores[] = [];
    const missingOwner: AssetWithScores[] = [];
    const missingTerms: AssetWithScores[] = [];
    const missingTags: AssetWithScores[] = [];
    const missingCertification: AssetWithScores[] = [];
    const missingLineage: AssetWithScores[] = [];

    filteredAssets.forEach(asset => {
      const a = asset.asset;
      const hasDescription = !!(a.description || a.userDescription);
      const hasOwner = (a.ownerUsers && a.ownerUsers.length > 0) || (a.ownerGroups && a.ownerGroups.length > 0);
      const hasTerms = a.meanings && a.meanings.length > 0;
      const hasTags = (a.classificationNames && a.classificationNames.length > 0) || (a.atlanTags && a.atlanTags.length > 0);
      const hasCertification = a.certificateStatus === 'VERIFIED';
      const hasLineage = a.__hasLineage;

      if (!hasDescription) missingDescription.push(asset);
      if (!hasOwner) missingOwner.push(asset);
      if (!hasTerms) missingTerms.push(asset);
      if (!hasTags) missingTags.push(asset);
      if (!hasCertification) missingCertification.push(asset);
      if (!hasLineage) missingLineage.push(asset);
    });

    const totalAssets = filteredAssets.length || 1;

    const cats: GapCategory[] = [
      {
        id: 'owner',
        name: 'Missing Owners',
        icon: <Users size={16} />,
        description: 'Unowned assets lack accountability and can become stale',
        assets: missingOwner,
        impactPerAsset: GAP_WEIGHTS.owner / 100,
        totalImpact: (missingOwner.length / totalAssets) * GAP_WEIGHTS.owner,
        effortEstimate: '~2 min each',
      },
      {
        id: 'description',
        name: 'Missing Descriptions',
        icon: <FileText size={16} />,
        description: 'Assets without descriptions are hard to discover and understand',
        assets: missingDescription,
        impactPerAsset: GAP_WEIGHTS.description / 100,
        totalImpact: (missingDescription.length / totalAssets) * GAP_WEIGHTS.description,
        effortEstimate: '~5 min each',
      },
      {
        id: 'terms',
        name: 'No Glossary Terms',
        icon: <Link size={16} />,
        description: 'Assets not linked to business glossary terms',
        assets: missingTerms,
        impactPerAsset: GAP_WEIGHTS.glossaryTerms / 100,
        totalImpact: (missingTerms.length / totalAssets) * GAP_WEIGHTS.glossaryTerms,
        effortEstimate: '~3 min each',
      },
      {
        id: 'certification',
        name: 'Not Certified',
        icon: <Award size={16} />,
        description: 'Uncertified assets reduce trust in data quality',
        assets: missingCertification,
        impactPerAsset: GAP_WEIGHTS.certification / 100,
        totalImpact: (missingCertification.length / totalAssets) * GAP_WEIGHTS.certification,
        effortEstimate: '~10 min each',
      },
      {
        id: 'lineage',
        name: 'No Lineage',
        icon: <GitBranch size={16} />,
        description: 'Assets without documented lineage relationships',
        assets: missingLineage,
        impactPerAsset: GAP_WEIGHTS.lineage / 100,
        totalImpact: (missingLineage.length / totalAssets) * GAP_WEIGHTS.lineage,
        effortEstimate: 'Varies',
      },
      {
        id: 'tags',
        name: 'No Tags/Classifications',
        icon: <Tag size={16} />,
        description: 'Assets without classification tags for governance',
        assets: missingTags,
        impactPerAsset: GAP_WEIGHTS.tags / 100,
        totalImpact: (missingTags.length / totalAssets) * GAP_WEIGHTS.tags,
        effortEstimate: '~2 min each',
      },
    ];

    // Sort categories
    const sorted = [...cats].sort((a, b) => {
      if (sortBy === 'impact') {
        return b.totalImpact - a.totalImpact;
      }
      return b.assets.length - a.assets.length;
    });

    // Calculate summary
    const currentAvgScore = filteredAssets.length > 0
      ? Math.round(filteredAssets.reduce((sum, a) => sum + a.scores.overall, 0) / filteredAssets.length)
      : 0;

    const potentialImprovement = sorted.reduce((sum, cat) => sum + cat.totalImpact, 0);
    const topCategory = sorted[0];

    return {
      categories: sorted,
      summary: {
        currentScore: currentAvgScore,
        potentialScore: Math.min(100, currentAvgScore + Math.round(potentialImprovement)),
        topGap: topCategory?.name || 'None',
        topGapCount: topCategory?.assets.length || 0,
        totalGaps: sorted.reduce((sum, cat) => sum + cat.assets.length, 0),
      },
    };
  }, [filteredAssets, sortBy]);

  const toggleCategory = (id: string) => {
    setExpandedCategory(expandedCategory === id ? null : id);
  };

  const handleDimensionChange = (dim: DimensionFilter) => {
    setFilterDimension(dim);
    setFilterValue('');
  };

  // Get top 10 assets to fix (highest usage + lowest quality)
  // Uses normalized popularity score for proper ranking
  const topAssetsToFix = useMemo(() => {
    const withImpact = filteredAssets
      .filter(a => a.scores.overall < 70)
      .map(a => {
        // Use normalized popularity score (0-1) for usage
        const usage = calculatePopularityScore(a.asset);
        const qualityGap = (100 - a.scores.overall) / 100; // Normalize to 0-1
        // Impact = usage × quality gap (both normalized 0-1)
        return { ...a, impactScore: usage * qualityGap };
      })
      .sort((a, b) => b.impactScore - a.impactScore);

    return withImpact.slice(0, 10);
  }, [filteredAssets]);

  return (
    <div className="remediation-prioritizer">
      <div className="remediation-header">
        <div className="remediation-title">
          <h3>Remediation Prioritizer</h3>
          <InfoTooltip content="Prioritized list of metadata gaps to fix, ranked by potential impact on overall quality score." />
        </div>
        <div className="remediation-controls">
          <button
            className={`filter-toggle ${showFilters ? 'active' : ''}`}
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter size={14} />
          </button>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'impact' | 'count')}
            className="sort-select"
          >
            <option value="impact">Sort by Impact</option>
            <option value="count">Sort by Count</option>
          </select>
        </div>
      </div>

      {/* Dimension filters */}
      {showFilters && (
        <div className="remediation-filters">
          <div className="filter-group">
            <label>Filter by:</label>
            <select
              value={filterDimension}
              onChange={(e) => handleDimensionChange(e.target.value as DimensionFilter)}
              className="filter-select"
            >
              <option value="all">All Assets</option>
              <option value="assetType">Asset Type</option>
              <option value="connection">Connection</option>
              <option value="owner">Owner</option>
            </select>
          </div>
          {filterDimension !== 'all' && filterOptions.length > 0 && (
            <div className="filter-group">
              <select
                value={filterValue}
                onChange={(e) => setFilterValue(e.target.value)}
                className="filter-select"
              >
                <option value="">All</option>
                {filterOptions.map(opt => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            </div>
          )}
          {filterValue && (
            <button
              className="filter-clear"
              onClick={() => { setFilterDimension('all'); setFilterValue(''); }}
            >
              Clear
            </button>
          )}
        </div>
      )}

      {/* Summary banner */}
      <div className="remediation-summary">
        <div className="summary-stat">
          <div className="summary-label">CURRENT SCORE</div>
          <div className="summary-value">{summary.currentScore}%</div>
        </div>
        <div className="summary-arrow">
          <TrendingUp size={20} />
        </div>
        <div className="summary-stat highlight">
          <div className="summary-label">POTENTIAL</div>
          <div className="summary-value">{summary.potentialScore}%</div>
        </div>
        <div className="summary-detail">
          <span className="summary-gap-count">{summary.totalGaps}</span> gaps across{' '}
          <span className="summary-asset-count">{filteredAssets.length}</span> assets
        </div>
      </div>

      {/* Gap categories */}
      <div className="gap-categories">
        {categories.map(category => (
          <div key={category.id} className="gap-category">
            <button
              className={`gap-category-header ${expandedCategory === category.id ? 'expanded' : ''}`}
              onClick={() => toggleCategory(category.id)}
            >
              <div className="gap-icon">{category.icon}</div>
              <div className="gap-info">
                <div className="gap-name">{category.name}</div>
                <div className="gap-meta">
                  <span className="gap-count">{category.assets.length} assets</span>
                  <span className="gap-impact">+{category.totalImpact.toFixed(1)}% potential</span>
                </div>
              </div>
              <div className="gap-effort">{category.effortEstimate}</div>
              <div className="gap-chevron">
                {expandedCategory === category.id ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              </div>
            </button>

            {expandedCategory === category.id && (
              <div className="gap-assets">
                <div className="gap-description">{category.description}</div>
                <div className="gap-asset-list">
                  {category.assets.slice(0, 20).map(asset => (
                    <button
                      key={asset.asset.guid}
                      className="gap-asset-item"
                      onClick={() => onAssetClick?.(asset)}
                    >
                      <span className="asset-name">{asset.asset.name}</span>
                      <span className="asset-type">{asset.asset.typeName}</span>
                      <span className="asset-score">{Math.round(asset.scores.overall)}%</span>
                    </button>
                  ))}
                  {category.assets.length > 20 && (
                    <div className="gap-more">+{category.assets.length - 20} more</div>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Top assets to fix */}
      {topAssetsToFix.length > 0 && (
        <div className="top-fixes">
          <div className="top-fixes-header">
            <h4>Top 10 Assets to Fix</h4>
            <span className="top-fixes-subtitle">Ranked by usage × quality gap</span>
          </div>
          <div className="top-fixes-list">
            {topAssetsToFix.map((asset, idx) => (
              <button
                key={asset.asset.guid}
                className="top-fix-item"
                onClick={() => onAssetClick?.(asset)}
              >
                <span className="fix-rank">{idx + 1}</span>
                <span className="fix-name">{asset.asset.name}</span>
                <span className="fix-score">{Math.round(asset.scores.overall)}%</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
});
