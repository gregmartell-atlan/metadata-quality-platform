import React, { useState, useMemo, useEffect } from 'react';
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

const MEASURE_CATEGORIES = {
  'Counts & Coverage': [
    'assetCount',
    'descriptionCoverage',
    'ownerCoverage',
    'certificationCoverage',
    'lineageCoverage',
  ],
  'Quality Scores': [
    'completeness',
    'accuracy',
    'timeliness',
    'consistency',
    'usability',
    'overall',
    'avgCompleteness',
  ],
  'Lineage Metrics': [
    'hasUpstream',
    'hasDownstream',
    'fullLineage',
    'orphaned',
  ],
};

const AVAILABLE_MEASURES: Measure[] = Object.values(MEASURE_CATEGORIES).flat() as Measure[];

const PRESETS = [
  {
    name: 'Completeness View',
    description: 'Connection and type breakdown with coverage metrics',
    dimensions: ['connection', 'type'] as RowDimension[],
    measures: ['assetCount', 'descriptionCoverage', 'ownerCoverage', 'completeness'] as Measure[],
  },
  {
    name: 'Quality Scorecard',
    description: 'Quality scores by connection',
    dimensions: ['connection'] as RowDimension[],
    measures: ['completeness', 'accuracy', 'timeliness', 'consistency', 'usability', 'overall'] as Measure[],
  },
  {
    name: 'Owner Accountability',
    description: 'Owner groups and certification status',
    dimensions: ['ownerGroup'] as RowDimension[],
    measures: ['assetCount', 'certificationCoverage', 'descriptionCoverage'] as Measure[],
  },
  {
    name: 'Deep Hierarchy',
    description: 'Connection → Type → Domain breakdown',
    dimensions: ['connection', 'type', 'domain'] as RowDimension[],
    measures: ['assetCount', 'completeness', 'overall'] as Measure[],
  },
];

interface PivotConfiguratorProps {
  rowDimensions: RowDimension[];
  measures: Measure[];
  onRowDimensionsChange: (dimensions: RowDimension[]) => void;
  onMeasuresChange: (measures: Measure[]) => void;
  alwaysExpanded?: boolean;
}

export function PivotConfigurator({
  rowDimensions,
  measures,
  onRowDimensionsChange,
  onMeasuresChange,
  alwaysExpanded = false,
}: PivotConfiguratorProps) {
  const [isExpanded, setIsExpanded] = useState(alwaysExpanded);
  const [searchQuery, setSearchQuery] = useState('');
  const [draggedDimension, setDraggedDimension] = useState<RowDimension | null>(null);
  const [draggedMeasure, setDraggedMeasure] = useState<Measure | null>(null);

  const filteredDimensions = useMemo(() => {
    if (!searchQuery) return AVAILABLE_ROW_DIMENSIONS;
    const query = searchQuery.toLowerCase();
    return AVAILABLE_ROW_DIMENSIONS.filter((dim) =>
      getDimensionLabel(dim).toLowerCase().includes(query)
    );
  }, [searchQuery]);

  const filteredMeasures = useMemo(() => {
    if (!searchQuery) return MEASURE_CATEGORIES;
    const query = searchQuery.toLowerCase();
    const filtered: typeof MEASURE_CATEGORIES = {};
    Object.entries(MEASURE_CATEGORIES).forEach(([category, measureList]) => {
      const filteredList = measureList.filter((measure) =>
        getMeasureLabel(measure).toLowerCase().includes(query)
      );
      if (filteredList.length > 0) {
        filtered[category] = filteredList;
      }
    });
    return filtered;
  }, [searchQuery]);

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

  const moveDimension = (fromIndex: number, toIndex: number) => {
    const newDimensions = [...rowDimensions];
    const [removed] = newDimensions.splice(fromIndex, 1);
    newDimensions.splice(toIndex, 0, removed);
    onRowDimensionsChange(newDimensions);
  };

  const applyPreset = (preset: typeof PRESETS[0]) => {
    onRowDimensionsChange(preset.dimensions);
    onMeasuresChange(preset.measures);
  };

  const handleDimensionDragStart = (dimension: RowDimension, e: React.DragEvent) => {
    setDraggedDimension(dimension);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDimensionDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDimensionDrop = (targetIndex: number, e: React.DragEvent) => {
    e.preventDefault();
    if (draggedDimension === null) return;

    const currentIndex = rowDimensions.indexOf(draggedDimension);
    if (currentIndex !== -1 && currentIndex !== targetIndex) {
      moveDimension(currentIndex, targetIndex);
    }
    setDraggedDimension(null);
  };

  // Auto-expand if alwaysExpanded is true
  React.useEffect(() => {
    if (alwaysExpanded && !isExpanded) {
      setIsExpanded(true);
    }
  }, [alwaysExpanded, isExpanded]);

  return (
    <div className={`pivot-configurator modern ${alwaysExpanded ? 'always-expanded' : ''}`}>
      {!alwaysExpanded && (
      <div className="configurator-header" onClick={() => setIsExpanded(!isExpanded)}>
        <div className="configurator-title">
          <Settings size={18} className="configurator-icon" />
          <span>Configure Pivot</span>
          {rowDimensions.length > 0 && (
            <span className="configurator-badge">{rowDimensions.length} dimensions</span>
          )}
          {measures.length > 0 && (
            <span className="configurator-badge">{measures.length} measures</span>
          )}
        </div>
        <span className="configurator-toggle">
          {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </span>
      </div>
      )}

      {(isExpanded || alwaysExpanded) && (
        <div className="configurator-content">
          {/* Search */}
          <div className="configurator-search">
            <input
              type="text"
              placeholder="Search dimensions and measures..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="search-input"
            />
            {searchQuery && (
              <button
                className="search-clear"
                onClick={() => setSearchQuery('')}
                aria-label="Clear search"
              >
                ✕
              </button>
            )}
          </div>

          {/* Quick Presets */}
          <div className="configurator-section">
            <div className="configurator-section-header">
              <div className="configurator-section-label">Quick Presets</div>
              <div className="configurator-section-hint">Click to apply</div>
            </div>
            <div className="configurator-presets">
              {PRESETS.map((preset, idx) => (
                <button
                  key={idx}
                  className="configurator-preset"
                  onClick={() => applyPreset(preset)}
                  title={preset.description}
                >
                  <span className="preset-name">{preset.name}</span>
                  <span className="preset-description">{preset.description}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Row Dimensions */}
          <div className="configurator-section">
            <div className="configurator-section-header">
              <div className="configurator-section-label">
                Row Dimensions
                <span className="section-count">({rowDimensions.length} selected)</span>
              </div>
              <div className="configurator-section-hint">
                Drag to reorder • Order determines hierarchy
              </div>
            </div>

            {/* Selected dimensions (draggable) */}
            {rowDimensions.length > 0 && (
              <div className="selected-dimensions">
                <div className="selected-label">Selected (drag to reorder):</div>
                <div className="dimension-list">
                  {rowDimensions.map((dimension, idx) => (
                    <div
                      key={`selected-${dimension}`}
                      className="dimension-item selected"
                      draggable
                      onDragStart={(e) => handleDimensionDragStart(dimension, e)}
                      onDragOver={handleDimensionDragOver}
                      onDrop={(e) => handleDimensionDrop(idx, e)}
                    >
                      <span className="drag-handle">☰</span>
                      <span className="dimension-icon">{getDimensionIcon(dimension)}</span>
                      <span className="dimension-label">{getDimensionLabel(dimension)}</span>
                      <button
                        className="dimension-remove"
                        onClick={() => toggleRowDimension(dimension)}
                        aria-label="Remove"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Available dimensions */}
            <div className="available-dimensions">
              <div className="available-label">Available:</div>
              <div className="dimension-list">
                {filteredDimensions
                  .filter((dim) => !rowDimensions.includes(dim))
                  .map((dimension) => (
                    <button
                      key={dimension}
                      className="dimension-item"
                      onClick={() => toggleRowDimension(dimension)}
                    >
                      <span className="dimension-icon">{getDimensionIcon(dimension)}</span>
                      <span className="dimension-label">{getDimensionLabel(dimension)}</span>
                      <span className="dimension-add">+</span>
                    </button>
                  ))}
              </div>
              {filteredDimensions.filter((dim) => !rowDimensions.includes(dim)).length === 0 && (
                <div className="configurator-empty">No available dimensions</div>
              )}
            </div>

            {rowDimensions.length === 0 && (
              <div className="configurator-warning">
                ⚠️ Select at least one row dimension to build a pivot
              </div>
            )}
          </div>

          {/* Measures */}
          <div className="configurator-section">
            <div className="configurator-section-header">
              <div className="configurator-section-label">
                Measures
                <span className="section-count">({measures.length} selected)</span>
              </div>
            </div>

            {Object.entries(filteredMeasures).map(([category, measureList]) => (
              <div key={category} className="measure-category">
                <div className="measure-category-label">{category}</div>
                <div className="measure-list">
                  {measureList.map((measure) => {
                    const isSelected = measures.includes(measure);
                    return (
                      <button
                        key={measure}
                        className={`measure-item ${isSelected ? 'selected' : ''}`}
                        onClick={() => toggleMeasure(measure)}
                      >
                        <span className="measure-label">{getMeasureLabel(measure)}</span>
                        {isSelected && <span className="measure-check">✓</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}

            {measures.length === 0 && (
              <div className="configurator-warning">
                ⚠️ Select at least one measure to calculate
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
