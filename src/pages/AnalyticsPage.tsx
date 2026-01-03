/**
 * AnalyticsPage - Data as a Product Analytics Dashboard
 *
 * Shows DaaP compliance scores and requirements coverage
 */

import { useState } from 'react';
import { AppHeader } from '../components/layout/AppHeader';
import { DaaPRadarChart } from '../components/analytics';
import { Card } from '../components/shared';
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

// DaaP dimension descriptions
const daapDimensions = [
  {
    name: 'Discoverable',
    description: 'Assets can be easily found via search, tags, and glossary terms',
    fields: ['description', 'owners', 'tags', 'terms'],
    color: 'var(--color-blue-500)',
  },
  {
    name: 'Addressable',
    description: 'Assets have clear, unique identifiers and location paths',
    fields: ['qualifiedName', 'connection', 'database', 'schema'],
    color: 'var(--color-success-500)',
  },
  {
    name: 'Trustworthy',
    description: 'Assets have lineage, certification, and quality indicators',
    fields: ['lineage', 'certificate', 'quality'],
    color: 'var(--color-warning-500)',
  },
  {
    name: 'Self-describing',
    description: 'Assets have rich metadata and documentation',
    fields: ['readme', 'columns', 'dataTypes'],
    color: '#8b5cf6',
  },
  {
    name: 'Interoperable',
    description: 'Assets follow standards and can integrate with other systems',
    fields: ['standards', 'formats'],
    color: '#ec4899',
  },
  {
    name: 'Secure',
    description: 'Assets have proper classification and access controls',
    fields: ['classifications', 'access'],
    color: '#f97316',
  },
  {
    name: 'Reusable',
    description: 'Assets are documented for reuse across teams',
    fields: ['usage', 'popularity', 'consumers'],
    color: '#06b6d4',
  },
];

export function AnalyticsPage() {
  const [matrix] = useState<RequirementsMatrix>(sampleMatrix);

  return (
    <div className="analytics-page">
      <AppHeader title="DaaP Analytics" subtitle="Data as a Product compliance overview" />

      <div className="analytics-content">
        <div className="analytics-grid">
          {/* Main radar chart */}
          <div className="analytics-chart-section">
            <DaaPRadarChart matrix={matrix} />
          </div>

          {/* Dimension breakdown */}
          <div className="analytics-dimensions-section">
            <Card>
              <div className="card-header">
                <h3 className="card-title">DaaP Dimensions</h3>
              </div>
              <div className="card-body">
                <div className="dimension-list">
                  {daapDimensions.map((dim) => (
                    <div key={dim.name} className="dimension-item">
                      <div
                        className="dimension-indicator"
                        style={{ background: dim.color }}
                      />
                      <div className="dimension-info">
                        <div className="dimension-name">{dim.name}</div>
                        <div className="dimension-description">{dim.description}</div>
                        <div className="dimension-fields">
                          {dim.fields.map((field) => (
                            <span key={field} className="dimension-field">
                              {field}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          </div>
        </div>

        {/* Requirements summary */}
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
