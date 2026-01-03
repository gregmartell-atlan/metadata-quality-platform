/**
 * AnalyticsPage - Data as a Product Analytics Dashboard
 *
 * Shows DaaP compliance scores and requirements coverage
 */

import { useState, useMemo } from 'react';
import { Download, BarChart3, AlertTriangle, Lightbulb, Info } from 'lucide-react';
import { AppHeader } from '../components/layout/AppHeader';
import { DaaPRadarChart, CoverageHeatmap, QualityImpactMatrix, RemediationPrioritizer } from '../components/analytics';
import { Card, Button, Tooltip, InfoTooltip } from '../components/shared';
import { useFieldCoverage, getOverallCompleteness, getTopGaps } from '../hooks/useFieldCoverage';
import { getFieldInfo } from '../constants/metadataDescriptions';
import { exportAnalyticsReport } from '../utils/analyticsExport';
import { useScoresStore } from '../stores/scoresStore';
import { useAssetInspectorStore } from '../stores/assetInspectorStore';
import type { RequirementsMatrix } from '../types/requirements';
import type { AtlanAsset } from '../services/atlan/types';
import type { AssetMetadata, QualityScores } from '../services/qualityMetrics';
import './AnalyticsPage.css';

// Sample assets for demo mode when no real assets are loaded
interface SampleAssetWithScores {
  asset: AtlanAsset;
  metadata: AssetMetadata;
  scores: QualityScores & { overall: number };
}

function generateSampleAssets(): SampleAssetWithScores[] {
  const connections = ['Snowflake Production', 'BigQuery Analytics', 'Redshift DW', 'PostgreSQL'];
  const owners = ['data-team@company.com', 'analytics@company.com', 'engineering@company.com', null];
  const schemas = ['analytics', 'staging', 'raw', 'marts'];

  const sampleAssets: SampleAssetWithScores[] = [];

  // Generate 50 sample assets with varied quality and usage
  for (let i = 0; i < 50; i++) {
    const hasDescription = Math.random() > 0.3;
    const hasOwner = Math.random() > 0.4;
    const hasTags = Math.random() > 0.5;
    const hasTerms = Math.random() > 0.7;
    const hasLineage = Math.random() > 0.4;
    const isCertified = Math.random() > 0.7;

    const completeness = Math.round(
      (Number(hasDescription) * 30 + Number(hasOwner) * 25 + Number(hasTags) * 15 + Number(hasTerms) * 15 + Number(hasLineage) * 15)
    );
    const accuracy = Math.round(50 + Math.random() * 50);
    const timeliness = Math.round(40 + Math.random() * 60);
    const consistency = Math.round(60 + Math.random() * 40);
    const usability = Math.round(
      (Number(hasDescription) * 40 + Number(hasOwner) * 30 + Number(isCertified) * 30)
    );
    const overall = Math.round((completeness + accuracy + timeliness + consistency + usability) / 5);

    const connectionIdx = i % connections.length;
    const ownerIdx = i % owners.length;
    const schemaIdx = i % schemas.length;
    const owner = owners[ownerIdx];

    const assetName = `${schemas[schemaIdx]}_table_${i + 1}`;
    const typeName = i % 5 === 0 ? 'View' : 'Table';

    const asset: AtlanAsset = {
      guid: `sample-${i}`,
      typeName,
      name: assetName,
      qualifiedName: `${connections[connectionIdx]}/${schemas[schemaIdx]}/${assetName}`,
      connectionName: connections[connectionIdx],
      connectionQualifiedName: `default/${connections[connectionIdx].toLowerCase().replace(/\s+/g, '-')}`,
      description: hasDescription ? `Sample description for ${assetName}` : undefined,
      ownerUsers: hasOwner && owner ? [owner] : undefined,
      certificateStatus: isCertified ? 'VERIFIED' : undefined,
      classificationNames: hasTags ? ['PII', 'Confidential'].slice(0, Math.floor(Math.random() * 3)) : undefined,
      meanings: hasTerms ? [{ displayText: 'Revenue', termGuid: 'term-1' }] : undefined,
      __hasLineage: hasLineage,
      // Simulated usage metrics
      popularityScore: Math.round(Math.random() * 500),
      viewScore: Math.round(Math.random() * 200),
      starredCount: Math.floor(Math.random() * 10),
    };

    const metadata: AssetMetadata = {
      id: asset.guid,
      name: asset.name,
      assetType: typeName,
      connection: connections[connectionIdx],
      domain: undefined,
      description: asset.description,
      owner: owner || undefined,
      tags: asset.classificationNames,
      certificationStatus: isCertified ? 'certified' : 'none',
      lastUpdated: new Date(Date.now() - Math.random() * 90 * 24 * 60 * 60 * 1000).toISOString(),
    };

    sampleAssets.push({
      asset,
      metadata,
      scores: { completeness, accuracy, timeliness, consistency, usability, overall },
    });
  }

  return sampleAssets;
}

// Sample requirements matrix for demo
const sampleMatrix: RequirementsMatrix = {
  name: 'Default DaaP Requirements',
  description: 'Standard Data as a Product requirements for enterprise assets',
  assetTypeRequirements: [
    {
      assetType: 'Table',
      requirements: [
        { field: 'description', level: 'required' },
        { field: 'ownerUsers', level: 'required' },
        { field: 'tags', level: 'recommended' },
        { field: 'assignedTerms', level: 'recommended' },
        { field: 'lineage', level: 'required' },
        { field: 'certificateStatus', level: 'required' },
        { field: 'readme', level: 'optional' },
        { field: 'columns', level: 'required' },
        { field: 'classifications', level: 'required' },
      ],
    },
    {
      assetType: 'View',
      requirements: [
        { field: 'description', level: 'required' },
        { field: 'ownerUsers', level: 'required' },
        { field: 'tags', level: 'recommended' },
        { field: 'lineage', level: 'required' },
        { field: 'columns', level: 'required' },
      ],
    },
    {
      assetType: 'Column',
      requirements: [
        { field: 'description', level: 'recommended' },
        { field: 'classifications', level: 'required' },
        { field: 'assignedTerms', level: 'recommended' },
      ],
    },
  ],
};

// Memoized sample assets (stable reference)
const sampleAssetsData = generateSampleAssets();

export function AnalyticsPage() {
  const [matrix] = useState<RequirementsMatrix>(sampleMatrix);
  const fieldCoverage = useFieldCoverage();
  const overallCompleteness = getOverallCompleteness(fieldCoverage);
  const topGaps = getTopGaps(fieldCoverage, 3);
  const { assetsWithScores: storeAssets } = useScoresStore();
  const { openInspector } = useAssetInspectorStore();

  // Use real assets if available, otherwise use sample data for demo
  const isUsingDemoData = storeAssets.length === 0;
  const assetsWithScores = useMemo(() => {
    return isUsingDemoData ? sampleAssetsData : storeAssets;
  }, [isUsingDemoData, storeAssets]);

  const handleExport = () => {
    exportAnalyticsReport(matrix, fieldCoverage);
  };

  const handleAssetClick = (asset: typeof assetsWithScores[0]) => {
    // Only open inspector for real assets, not sample data
    if (!isUsingDemoData) {
      openInspector(asset.asset);
    }
  };

  return (
    <div className="analytics-page">
      <AppHeader title="DaaP Analytics" subtitle="Data as a Product compliance overview">
        <Button variant="secondary" onClick={handleExport}>
          <Download size={16} />
          Export Report
        </Button>
      </AppHeader>

      <div className="analytics-content">
        {/* Top Row: Radar Chart & Summary Stats */}
        <div className="analytics-top-grid">
          {/* Radar Chart */}
          <div className="analytics-radar-section">
            <DaaPRadarChart matrix={matrix} />
          </div>

          {/* Summary Stats */}
          <div className="analytics-stats-section">
            {/* Overall Completeness */}
            <Tooltip
              content={
                <div className="stat-card-tooltip">
                  <strong>Overall Completeness</strong>
                  <p>The average metadata coverage across all fields and asset types.</p>
                  <div className="stat-card-tooltip-calc">
                    <span className="tooltip-calc-label">Calculation:</span>
                    <div className="tooltip-calc-formula">
                      Sum of all field coverages ÷ Number of tracked fields
                    </div>
                    <div className="tooltip-calc-result">
                      <span className="tooltip-calc-value">{overallCompleteness}%</span>
                      <span className="tooltip-calc-breakdown">
                        ({fieldCoverage.length} fields tracked)
                      </span>
                    </div>
                  </div>
                </div>
              }
              position="bottom"
              maxWidth={320}
            >
              <div className="stat-card stat-card-primary">
                <div className="stat-card-header">
                  <BarChart3 size={18} />
                  <span>Overall Completeness</span>
                  <InfoTooltip
                    content={
                      <div>
                        <strong>What is Overall Completeness?</strong>
                        <p style={{ margin: '8px 0 0 0' }}>
                          The average metadata coverage across all fields and asset types.
                          Higher percentages indicate better documentation of your data assets.
                        </p>
                      </div>
                    }
                  />
                </div>
                <div className="stat-card-value">{overallCompleteness}%</div>
                <div className="stat-card-progress">
                  <div
                    className="stat-card-progress-fill"
                    style={{ width: `${overallCompleteness}%` }}
                  />
                </div>
              </div>
            </Tooltip>

            {/* Top Gaps */}
            <div className="stat-card">
              <div className="stat-card-header">
                <AlertTriangle size={18} />
                <span>Top Gaps</span>
                <InfoTooltip
                  content={
                    <div>
                      <strong>Top Metadata Gaps</strong>
                      <p style={{ margin: '8px 0 0 0' }}>
                        Fields with the lowest coverage percentages. These are opportunities
                        to improve your data documentation and discoverability.
                      </p>
                    </div>
                  }
                />
              </div>
              <ul className="gap-list">
                {topGaps.map((field) => {
                  const fieldInfo = getFieldInfo(field.field);
                  return (
                    <Tooltip
                      key={field.field}
                      content={
                        fieldInfo ? (
                          <div className="gap-tooltip">
                            <div className="gap-tooltip-header">
                              <span>{fieldInfo.name}</span>
                              <span className={`gap-tooltip-badge gap-tooltip-badge-${fieldInfo.importance}`}>
                                {fieldInfo.importance}
                              </span>
                            </div>
                            <p>{fieldInfo.description}</p>
                            <div className="gap-tooltip-dimension">
                              DaaP Dimension: <strong>{fieldInfo.daapDimension}</strong>
                            </div>
                          </div>
                        ) : (
                          field.field
                        )
                      }
                      position="left"
                      maxWidth={280}
                    >
                      <li className="gap-item">
                        <span className="gap-field">{fieldInfo?.name || field.field}</span>
                        <span className="gap-value">{Math.round(field.percentage)}%</span>
                      </li>
                    </Tooltip>
                  );
                })}
                {topGaps.length === 0 && (
                  <li className="gap-item gap-empty">No data available</li>
                )}
              </ul>
            </div>

            {/* AI Recommendation */}
            <div className="stat-card stat-card-recommendation">
              <div className="stat-card-header">
                <Lightbulb size={18} />
                <span>AI Recommendation</span>
              </div>
              <p className="recommendation-text">
                Based on your current coverage, focusing on{' '}
                <strong>Descriptions</strong> and <strong>Owners</strong> for your Tables
                would yield the highest impact on your Data Trust score.
              </p>
            </div>
          </div>
        </div>

        {/* Coverage Heatmap */}
        <div className="analytics-heatmap-section">
          <CoverageHeatmap coverage={fieldCoverage} />
        </div>

        {/* Quality Impact & Remediation */}
        {assetsWithScores.length > 0 && (
          <>
            {isUsingDemoData && (
              <div className="demo-data-banner">
                <Info size={16} />
                <span>
                  Showing sample data for demonstration. Drag assets from the Asset Browser to see real metrics.
                </span>
              </div>
            )}
            <div className="analytics-impact-section">
              <QualityImpactMatrix assets={assetsWithScores} onAssetClick={handleAssetClick} />
              <RemediationPrioritizer assets={assetsWithScores} onAssetClick={handleAssetClick} />
            </div>
          </>
        )}

        {/* Requirements Matrix Table */}
        <div className="analytics-requirements">
          <Card>
            <div className="card-header">
              <h3 className="card-title">Requirements Matrix</h3>
            </div>
            <div className="card-body">
              <div className="requirements-summary">
                <div className="requirement-stat">
                  <div className="requirement-stat-value">
                    {matrix.assetTypeRequirements.length}
                  </div>
                  <div className="requirement-stat-label">Asset Types</div>
                </div>
                <div className="requirement-stat">
                  <div className="requirement-stat-value">
                    {matrix.assetTypeRequirements.reduce(
                      (acc, req) =>
                        acc + req.requirements.filter((r) => r.level === 'required').length,
                      0
                    )}
                  </div>
                  <div className="requirement-stat-label">Required Fields</div>
                </div>
                <div className="requirement-stat">
                  <div className="requirement-stat-value">
                    {matrix.assetTypeRequirements.reduce(
                      (acc, req) =>
                        acc + req.requirements.filter((r) => r.level === 'recommended').length,
                      0
                    )}
                  </div>
                  <div className="requirement-stat-label">Recommended</div>
                </div>
                <div className="requirement-stat">
                  <div className="requirement-stat-value">
                    {matrix.assetTypeRequirements.reduce(
                      (acc, req) =>
                        acc + req.requirements.filter((r) => r.level === 'optional').length,
                      0
                    )}
                  </div>
                  <div className="requirement-stat-label">Optional</div>
                </div>
              </div>

              <div className="requirements-table-wrapper">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Asset Type</th>
                      <th className="center">Required</th>
                      <th className="center">Recommended</th>
                      <th className="center">Optional</th>
                      <th>Fields</th>
                    </tr>
                  </thead>
                  <tbody>
                    {matrix.assetTypeRequirements.map((req) => (
                      <tr key={req.assetType}>
                        <td className="asset-type-cell">
                          <span className="asset-type-badge">{req.assetType}</span>
                        </td>
                        <td className="center">
                          {req.requirements.filter((r) => r.level === 'required').length}
                        </td>
                        <td className="center">
                          {req.requirements.filter((r) => r.level === 'recommended').length}
                        </td>
                        <td className="center">
                          {req.requirements.filter((r) => r.level === 'optional').length}
                        </td>
                        <td>
                          <div className="field-tags">
                            {req.requirements.slice(0, 4).map((r) => {
                              const fieldInfo = getFieldInfo(r.field);
                              return (
                                <Tooltip
                                  key={r.field}
                                  content={
                                    fieldInfo ? (
                                      <div className="field-tag-tooltip">
                                        <div className="field-tag-tooltip-header">
                                          <span>{fieldInfo.name}</span>
                                          <span className={`field-tag-tooltip-badge field-tag-tooltip-badge-${fieldInfo.importance}`}>
                                            {fieldInfo.importance}
                                          </span>
                                        </div>
                                        <p>{fieldInfo.description}</p>
                                        <div className="field-tag-tooltip-dimension">
                                          DaaP Dimension: <strong>{fieldInfo.daapDimension}</strong>
                                        </div>
                                      </div>
                                    ) : (
                                      r.field
                                    )
                                  }
                                  position="top"
                                  maxWidth={280}
                                >
                                  <span className={`field-tag field-tag-${r.level}`}>
                                    {fieldInfo?.name || r.field}
                                  </span>
                                </Tooltip>
                              );
                            })}
                            {req.requirements.length > 4 && (
                              <Tooltip
                                content={
                                  <div className="field-tag-more-tooltip">
                                    <strong>Additional fields:</strong>
                                    <ul>
                                      {req.requirements.slice(4).map((r) => {
                                        const fieldInfo = getFieldInfo(r.field);
                                        return (
                                          <li key={r.field}>
                                            <span>{fieldInfo?.name || r.field}</span>
                                            <span className={`field-tag-more-badge field-tag-more-badge-${r.level}`}>
                                              {r.level}
                                            </span>
                                          </li>
                                        );
                                      })}
                                    </ul>
                                  </div>
                                }
                                position="top"
                                maxWidth={280}
                              >
                                <span className="field-tag field-tag-more">
                                  +{req.requirements.length - 4}
                                </span>
                              </Tooltip>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
