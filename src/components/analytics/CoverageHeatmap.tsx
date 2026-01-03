/**
 * CoverageHeatmap - Metadata coverage visualization
 *
 * Shows coverage percentages across fields and asset types
 * with detailed hover tooltips
 */

import { useMemo } from 'react';
import { Tooltip, InfoTooltip } from '../shared';
import { getFieldInfo } from '../../constants/metadataDescriptions';
import type { FieldCoverageResult } from '../../hooks/useFieldCoverage';
import './CoverageHeatmap.css';

interface CoverageHeatmapProps {
  coverage: FieldCoverageResult[];
}

export function CoverageHeatmap({ coverage }: CoverageHeatmapProps) {
  // Extract all unique asset types from the coverage data
  const assetTypes = useMemo(() => {
    const types = new Set<string>();
    coverage.forEach((item) => {
      Object.keys(item.byAssetType).forEach((type) => types.add(type));
    });
    return Array.from(types).sort();
  }, [coverage]);

  // Fields are the coverage items themselves
  const fields = coverage.map((c) => c.field);

  const getColorClass = (percentage: number) => {
    if (percentage === 0) return 'heatmap-cell-0';
    if (percentage < 25) return 'heatmap-cell-25';
    if (percentage < 50) return 'heatmap-cell-50';
    if (percentage < 75) return 'heatmap-cell-75';
    if (percentage < 100) return 'heatmap-cell-90';
    return 'heatmap-cell-100';
  };

  const getStatusLabel = (percentage: number) => {
    if (percentage === 0) return 'Not started';
    if (percentage < 25) return 'Critical gap';
    if (percentage < 50) return 'Needs attention';
    if (percentage < 75) return 'Good progress';
    if (percentage < 100) return 'Almost complete';
    return 'Complete';
  };

  if (coverage.length === 0) {
    return (
      <div className="heatmap-empty">
        <p>No coverage data available. Connect to Atlan to see insights.</p>
      </div>
    );
  }

  return (
    <div className="heatmap-container">
      <div className="heatmap-header-row">
        <h3 className="heatmap-title">Metadata Coverage Heatmap</h3>
        <InfoTooltip
          content={
            <div>
              <strong>How to read this heatmap:</strong>
              <p style={{ margin: '8px 0 0 0' }}>
                Each cell shows the percentage of assets that have this metadata field populated.
                Darker green = better coverage. Red = gaps to address.
              </p>
            </div>
          }
        />
      </div>

      <div className="heatmap-table-wrapper">
        {/* Header Row with Field Tooltips */}
        <div className="heatmap-header">
          <div className="heatmap-label-cell">Asset Type</div>
          {fields.map((field) => {
            const fieldInfo = getFieldInfo(field);
            const fieldLabel = field.replace(/([A-Z])/g, ' $1').trim();

            return (
              <Tooltip
                key={field}
                content={
                  fieldInfo ? (
                    <div className="heatmap-field-tooltip">
                      <div className="heatmap-field-tooltip-header">
                        <span>{fieldInfo.name}</span>
                        <span className={`heatmap-field-tooltip-badge heatmap-field-tooltip-badge-${fieldInfo.importance}`}>
                          {fieldInfo.importance}
                        </span>
                      </div>
                      <p>{fieldInfo.description}</p>
                      <div className="heatmap-field-tooltip-dimension">
                        DaaP Dimension: <strong>{fieldInfo.daapDimension}</strong>
                      </div>
                    </div>
                  ) : (
                    fieldLabel
                  )
                }
                position="top"
                maxWidth={320}
              >
                <div className="heatmap-field-header">
                  {fieldLabel}
                </div>
              </Tooltip>
            );
          })}
        </div>

        {/* Data Rows with Cell Tooltips */}
        {assetTypes.map((type) => (
          <div key={type} className="heatmap-row">
            <div className="heatmap-type-cell">{type}</div>
            {fields.map((field) => {
              const fieldData = coverage.find((c) => c.field === field);
              const typeData = fieldData?.byAssetType[type];
              const percentage =
                typeData && typeData.total > 0
                  ? Math.round((typeData.populated / typeData.total) * 100)
                  : 0;
              const hasData = typeData && typeData.total > 0;
              const fieldInfo = getFieldInfo(field);

              return (
                <Tooltip
                  key={`${type}-${field}`}
                  content={
                    <div className="heatmap-cell-tooltip">
                      <div className="heatmap-cell-tooltip-header">
                        <span>{type}</span>
                        <span>→</span>
                        <span>{fieldInfo?.name || field}</span>
                      </div>
                      {hasData ? (
                        <>
                          <div className="heatmap-cell-tooltip-stats">
                            <div className="heatmap-cell-tooltip-stat">
                              <span className="heatmap-cell-tooltip-value">{percentage}%</span>
                              <span className="heatmap-cell-tooltip-label">Coverage</span>
                            </div>
                            <div className="heatmap-cell-tooltip-stat">
                              <span className="heatmap-cell-tooltip-value">{typeData?.populated}</span>
                              <span className="heatmap-cell-tooltip-label">Populated</span>
                            </div>
                            <div className="heatmap-cell-tooltip-stat">
                              <span className="heatmap-cell-tooltip-value">{typeData?.total}</span>
                              <span className="heatmap-cell-tooltip-label">Total</span>
                            </div>
                          </div>
                          <div className="heatmap-cell-tooltip-status">
                            Status: <strong>{getStatusLabel(percentage)}</strong>
                          </div>
                          {percentage < 50 && fieldInfo && (
                            <div className="heatmap-cell-tooltip-action">
                              💡 Tip: {fieldInfo.importance === 'required' ? 'This is a required field. Prioritize filling this gap.' : 'Consider enriching this metadata to improve discoverability.'}
                            </div>
                          )}
                        </>
                      ) : (
                        <div className="heatmap-cell-tooltip-empty">
                          No {type} assets found for this field
                        </div>
                      )}
                    </div>
                  }
                  position="top"
                  maxWidth={280}
                >
                  <div className="heatmap-cell-wrapper">
                    <div
                      className={`heatmap-cell ${hasData ? getColorClass(percentage) : 'heatmap-cell-empty'}`}
                    >
                      {hasData ? `${percentage}%` : '-'}
                    </div>
                  </div>
                </Tooltip>
              );
            })}
          </div>
        ))}
      </div>

      <div className="heatmap-legend">
        <span className="heatmap-legend-label">Coverage:</span>
        <div className="heatmap-legend-item">
          <div className="heatmap-legend-color heatmap-cell-0" />
          <span>0%</span>
        </div>
        <div className="heatmap-legend-item">
          <div className="heatmap-legend-color heatmap-cell-25" />
          <span>&lt;25%</span>
        </div>
        <div className="heatmap-legend-item">
          <div className="heatmap-legend-color heatmap-cell-50" />
          <span>&lt;50%</span>
        </div>
        <div className="heatmap-legend-item">
          <div className="heatmap-legend-color heatmap-cell-75" />
          <span>&lt;75%</span>
        </div>
        <div className="heatmap-legend-item">
          <div className="heatmap-legend-color heatmap-cell-100" />
          <span>100%</span>
        </div>
      </div>
    </div>
  );
}
