/**
 * CoverageHeatmap - Metadata coverage visualization
 *
 * Shows coverage percentages across fields and asset types
 */

import { useMemo } from 'react';
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

  if (coverage.length === 0) {
    return (
      <div className="heatmap-empty">
        <p>No coverage data available. Connect to Atlan to see insights.</p>
      </div>
    );
  }

  return (
    <div className="heatmap-container">
      <h3 className="heatmap-title">Metadata Coverage Heatmap</h3>

      <div className="heatmap-table-wrapper">
        {/* Header Row */}
        <div className="heatmap-header">
          <div className="heatmap-label-cell">Asset Type</div>
          {fields.map((field) => (
            <div key={field} className="heatmap-field-header">
              {field.replace(/([A-Z])/g, ' $1').trim()}
            </div>
          ))}
        </div>

        {/* Data Rows */}
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

              return (
                <div key={`${type}-${field}`} className="heatmap-cell-wrapper">
                  <div
                    className={`heatmap-cell ${hasData ? getColorClass(percentage) : 'heatmap-cell-empty'}`}
                    title={`${type} - ${field}: ${percentage}% (${typeData?.populated ?? 0}/${typeData?.total ?? 0})`}
                  >
                    {hasData ? `${percentage}%` : '-'}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      <div className="heatmap-legend">
        <div className="heatmap-legend-item">
          <div className="heatmap-legend-color heatmap-cell-0" />
          <span>0%</span>
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
