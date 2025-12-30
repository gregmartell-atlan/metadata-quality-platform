import { useState } from 'react';
import type { RowDimension, Measure } from '../../types/pivot';
import { getDimensionLabel, getDimensionIcon } from '../../utils/pivotDimensions';
import { getMeasureLabel } from '../../utils/pivotMeasures';
import './PivotConfigurator.css';

interface PivotConfiguratorProps {
  rowDimensions: RowDimension[];
  measures: Measure[];
  onRowDimensionsChange: (dimensions: RowDimension[]) => void;
  onMeasuresChange: (measures: Measure[]) => void;
}

const AVAILABLE_ROW_DIMENSIONS: RowDimension[] = [
  'connection',
  'database',
  'schema',
  'type',
  'owner',
  'ownerGroup',
  'domain',
  'certificationStatus',
];

const AVAILABLE_MEASURES: Measure[] = [
  'assetCount',
  'descriptionCoverage',
  'ownerCoverage',
  'completeness',
  'accuracy',
  'timeliness',
  'consistency',
  'usability',
  'overall',
  'certificationCoverage',
  'lineageCoverage',
  'hasUpstream',
  'hasDownstream',
  'fullLineage',
  'orphaned',
  'avgCompleteness',
];

export function PivotConfigurator({
  rowDimensions,
  measures,
  onRowDimensionsChange,
  onMeasuresChange,
}: PivotConfiguratorProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const toggleRowDimension = (dimension: RowDimension) => {
    if (rowDimensions.includes(dimension)) {
      onRowDimensionsChange(rowDimensions.filter((d) => d !== dimension));
    } else {
      onRowDimensionsChange([...rowDimensions, dimension]);
    }
  };

  const toggleMeasure = (measure: Measure) => {
    if (measures.includes(measure)) {
      onMeasuresChange(measures.filter((m) => m !== measure));
    } else {
      onMeasuresChange([...measures, measure]);
    }
  };

  return (
    <div className="pivot-configurator">
      <div className="configurator-header" onClick={() => setIsExpanded(!isExpanded)}>
        <div className="configurator-title">
          <span className="configurator-icon">⚙️</span>
          <span>Configure Pivot</span>
        </div>
        <span className="configurator-toggle">{isExpanded ? '▼' : '▶'}</span>
      </div>

      {isExpanded && (
        <div className="configurator-content">
          {/* Row Dimensions */}
          <div className="configurator-section">
            <div className="configurator-section-label">Row Dimensions</div>
            <div className="configurator-options">
              {AVAILABLE_ROW_DIMENSIONS.map((dimension) => {
                const isSelected = rowDimensions.includes(dimension);
                return (
                  <button
                    key={dimension}
                    className={`configurator-option ${isSelected ? 'selected' : ''}`}
                    onClick={() => toggleRowDimension(dimension)}
                    title={getDimensionLabel(dimension)}
                  >
                    <span className="option-icon">{getDimensionIcon(dimension)}</span>
                    <span className="option-label">{getDimensionLabel(dimension)}</span>
                    {isSelected && <span className="option-check">✓</span>}
                  </button>
                );
              })}
            </div>
            {rowDimensions.length === 0 && (
              <div className="configurator-warning">Select at least one row dimension</div>
            )}
          </div>

          {/* Measures */}
          <div className="configurator-section">
            <div className="configurator-section-label">Measures</div>
            <div className="configurator-options">
              {AVAILABLE_MEASURES.map((measure) => {
                const isSelected = measures.includes(measure);
                return (
                  <button
                    key={measure}
                    className={`configurator-option ${isSelected ? 'selected' : ''}`}
                    onClick={() => toggleMeasure(measure)}
                    title={getMeasureLabel(measure)}
                  >
                    <span className="option-label">{getMeasureLabel(measure)}</span>
                    {isSelected && <span className="option-check">✓</span>}
                  </button>
                );
              })}
            </div>
            {measures.length === 0 && (
              <div className="configurator-warning">Select at least one measure</div>
            )}
          </div>

          {/* Quick Presets */}
          <div className="configurator-section">
            <div className="configurator-section-label">Quick Presets</div>
            <div className="configurator-presets">
              <button
                className="configurator-preset"
                onClick={() => {
                  onRowDimensionsChange(['connection', 'type']);
                  onMeasuresChange(['assetCount', 'descriptionCoverage', 'ownerCoverage', 'completeness']);
                }}
              >
                Completeness View
              </button>
              <button
                className="configurator-preset"
                onClick={() => {
                  onRowDimensionsChange(['connection']);
                  onMeasuresChange(['completeness', 'accuracy', 'timeliness', 'consistency', 'usability', 'overall']);
                }}
              >
                Quality Scorecard
              </button>
              <button
                className="configurator-preset"
                onClick={() => {
                  onRowDimensionsChange(['owner']);
                  onMeasuresChange(['assetCount', 'certificationCoverage', 'descriptionCoverage']);
                }}
              >
                Owner Accountability
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

