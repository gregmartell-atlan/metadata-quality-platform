/**
 * AnalyticsPage - Data as a Product Analytics Dashboard
 *
 * Shows DaaP compliance scores and requirements coverage
 */

import { useState } from 'react';
import { Download, BarChart3, AlertTriangle, Lightbulb } from 'lucide-react';
import { AppHeader } from '../components/layout/AppHeader';
import { DaaPRadarChart, CoverageHeatmap } from '../components/analytics';
import { Card, Button } from '../components/shared';
import { useFieldCoverage, getOverallCompleteness, getTopGaps } from '../hooks/useFieldCoverage';
import { exportAnalyticsReport } from '../utils/analyticsExport';
import type { RequirementsMatrix } from '../types/requirements';
import './AnalyticsPage.css';

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

export function AnalyticsPage() {
  const [matrix] = useState<RequirementsMatrix>(sampleMatrix);
  const fieldCoverage = useFieldCoverage();
  const overallCompleteness = getOverallCompleteness(fieldCoverage);
  const topGaps = getTopGaps(fieldCoverage, 3);

  const handleExport = () => {
    exportAnalyticsReport(matrix, fieldCoverage);
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
            <div className="stat-card stat-card-primary">
              <div className="stat-card-header">
                <BarChart3 size={18} />
                <span>Overall Completeness</span>
              </div>
              <div className="stat-card-value">{overallCompleteness}%</div>
              <div className="stat-card-progress">
                <div
                  className="stat-card-progress-fill"
                  style={{ width: `${overallCompleteness}%` }}
                />
              </div>
            </div>

            {/* Top Gaps */}
            <div className="stat-card">
              <div className="stat-card-header">
                <AlertTriangle size={18} />
                <span>Top Gaps</span>
              </div>
              <ul className="gap-list">
                {topGaps.map((field) => (
                  <li key={field.field} className="gap-item">
                    <span className="gap-field">{field.field}</span>
                    <span className="gap-value">{Math.round(field.percentage)}%</span>
                  </li>
                ))}
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
                            {req.requirements.slice(0, 4).map((r) => (
                              <span
                                key={r.field}
                                className={`field-tag field-tag-${r.level}`}
                              >
                                {r.field}
                              </span>
                            ))}
                            {req.requirements.length > 4 && (
                              <span className="field-tag field-tag-more">
                                +{req.requirements.length - 4}
                              </span>
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
