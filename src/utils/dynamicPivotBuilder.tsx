/**
 * Dynamic Pivot Builder
 * 
 * Builds pivot tables dynamically based on selected row dimensions and measures
 */

import React from 'react';
import type { AtlanAsset } from '../services/atlan/types';
import type { RowDimension, Measure, MeasureDisplayMode } from '../types/pivot';
import {
  extractDimensionValue,
  getDimensionLabel,
  getDimensionIcon,
} from './pivotDimensions';
import {
  calculateMeasure,
  getMeasureLabel,
  formatMeasure,
} from './pivotMeasures';
import { getScoreClass } from './scoreThresholds';
import type { LineageInfo } from '../services/atlan/lineageEnricher';
import { logger } from './logger';

export interface PivotRow {
  dimensionValues: Record<string, string>; // dimension -> value
  assetGuids: string[];
  assetCount: number;
  measures: Record<string, number>; // measure -> calculated value
}

export interface PivotTableData {
  headers: string[];
  rows: PivotRow[];
  dimensionOrder: RowDimension[];
  measureOrder: Measure[];
  measureDisplayModes?: Map<Measure, MeasureDisplayMode>;
}

export interface HierarchicalPivotRow extends PivotRow {
  level: number;
  parentKey?: string;
  children?: HierarchicalPivotRow[];
  isParent?: boolean;
  isExpanded?: boolean;
}

/**
 * Build a dynamic pivot table from assets
 * @param assets - Assets to build pivot from
 * @param rowDimensions - Dimensions to group by
 * @param measures - Measures to calculate
 * @param lineageMap - Optional map of lineage info by asset GUID (for lineage measures)
 * @param scoresMap - Optional map of scores by asset GUID (from scoresStore) to avoid recalculation
 */
export function buildDynamicPivot(
  assets: AtlanAsset[],
  rowDimensions: RowDimension[],
  measures: Measure[],
  lineageMap?: Map<string, LineageInfo>,
  scoresMap?: Map<string, { completeness: number; accuracy: number; timeliness: number; consistency: number; usability: number; overall: number }>
): PivotTableData {
  const startTime = performance.now();
  logger.info('buildDynamicPivot: Starting pivot build', { 
    assetCount: assets.length,
    rowDimensions: rowDimensions.length,
    measures: measures.length,
    hasLineageMap: !!lineageMap
  });
  
  if (rowDimensions.length === 0 || measures.length === 0 || assets.length === 0) {
    logger.warn('buildDynamicPivot: Empty input, returning empty pivot', {
      hasDimensions: rowDimensions.length > 0,
      hasMeasures: measures.length > 0,
      hasAssets: assets.length > 0
    });
    return {
      headers: [],
      rows: [],
      dimensionOrder: rowDimensions,
      measureOrder: measures,
    };
  }

  // Group assets by dimension values
  const groupStart = performance.now();
  const groups = new Map<string, AtlanAsset[]>();

  assets.forEach((asset) => {
    // Create a key from all dimension values
    const dimensionValues: string[] = [];
    const dimensionMap: Record<string, string> = {};

    rowDimensions.forEach((dimension) => {
      const value = extractDimensionValue(dimension, asset) || 'Unknown';
      dimensionValues.push(value);
      dimensionMap[dimension] = value;
    });

    const key = dimensionValues.join('::');

    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(asset);
  });
  const groupDuration = performance.now() - groupStart;
  logger.debug('buildDynamicPivot: Assets grouped', { 
    groupCount: groups.size,
    duration: `${groupDuration.toFixed(2)}ms` 
  });

  // Build rows
  const rowStart = performance.now();
  const rows: PivotRow[] = [];

  groups.forEach((groupAssets, key) => {
    const dimensionValues: Record<string, string> = {};
    const keyParts = key.split('::');

    rowDimensions.forEach((dimension, idx) => {
      dimensionValues[dimension] = keyParts[idx] || 'Unknown';
    });

    // Calculate measures for this group
    const measureStart = performance.now();
    const measureValues: Record<string, number> = {};
    measures.forEach((measure) => {
      measureValues[measure] = calculateMeasure(measure, groupAssets, lineageMap, scoresMap);
    });
    const measureDuration = performance.now() - measureStart;
    if (rows.length < 5 || rows.length % 10 === 0) {
      logger.debug(`buildDynamicPivot: Calculated measures for row ${rows.length + 1}`, {
        dimensionValues,
        measureValues,
        assetCount: groupAssets.length,
        duration: `${measureDuration.toFixed(2)}ms`
      });
    }

    rows.push({
      dimensionValues,
      assetGuids: groupAssets.map((a) => a.guid),
      assetCount: groupAssets.length,
      measures: measureValues,
    });
  });

  const rowDuration = performance.now() - rowStart;
  logger.debug('buildDynamicPivot: Rows built', { 
    rowCount: rows.length,
    duration: `${rowDuration.toFixed(2)}ms` 
  });

  // Sort rows by first dimension, then second, etc.
  const sortStart = performance.now();
  rows.sort((a, b) => {
    for (const dimension of rowDimensions) {
      const aVal = a.dimensionValues[dimension] || '';
      const bVal = b.dimensionValues[dimension] || '';
      if (aVal !== bVal) {
        return aVal.localeCompare(bVal);
      }
    }
    return 0;
  });

  // Build headers
  const headers: string[] = [];
  rowDimensions.forEach((dimension) => {
    headers.push(getDimensionLabel(dimension));
  });
  measures.forEach((measure) => {
    headers.push(getMeasureLabel(measure));
  });

  return {
    headers,
    rows,
    dimensionOrder: rowDimensions,
    measureOrder: measures,
  };
}

/**
 * Build hierarchical pivot structure from flat pivot data
 * Groups by first dimension as parents, nests subsequent dimensions as children
 */
export function buildHierarchicalPivot(
  data: PivotTableData
): HierarchicalPivotRow[] {
  if (data.dimensionOrder.length < 2) {
    // No hierarchy if only one dimension
    return data.rows.map((row) => ({
      ...row,
      level: 0,
      isParent: false,
    }));
  }

  const parentDimension = data.dimensionOrder[0];
  const childDimension = data.dimensionOrder[1];
  const parentGroups = new Map<string, HierarchicalPivotRow>();

  // Group rows by parent dimension
  data.rows.forEach((row) => {
    const parentValue = row.dimensionValues[parentDimension] || 'Unknown';
    const childValue = row.dimensionValues[childDimension] || 'Unknown';
    const parentKey = parentValue;

    if (!parentGroups.has(parentKey)) {
      // Create parent row (aggregate all children)
      const parentAssets = data.rows
        .filter((r) => r.dimensionValues[parentDimension] === parentValue)
        .flatMap((r) => r.assetGuids);

      const parentMeasures: Record<string, number> = {};
      data.measureOrder.forEach((measure) => {
        const childRows = data.rows.filter(
          (r) => r.dimensionValues[parentDimension] === parentValue
        );
        const allChildAssets = childRows.flatMap((r) => r.assetGuids);
        // Recalculate from all child assets
        parentMeasures[measure] = calculateMeasure(measure, 
          childRows.flatMap((r) => {
            // Get actual assets for this measure calculation
            return r.assetGuids.map((guid) => {
              // We need the actual assets, but we only have GUIDs
              // For now, use weighted average of children
              return null as any;
            }).filter(Boolean);
          }) as any[]
        );
      });

      // Use weighted average for parent measures
      const childRows = data.rows.filter(
        (r) => r.dimensionValues[parentDimension] === parentValue
      );
      const totalChildAssets = childRows.reduce((sum, r) => sum + r.assetCount, 0);
      
      data.measureOrder.forEach((measure) => {
        if (measure === 'assetCount') {
          parentMeasures[measure] = totalChildAssets;
        } else {
          // Weighted average
          const weightedSum = childRows.reduce((sum, r) => {
            return sum + (r.measures[measure] * r.assetCount);
          }, 0);
          parentMeasures[measure] = totalChildAssets > 0 
            ? Math.round(weightedSum / totalChildAssets) 
            : 0;
        }
      });

      parentGroups.set(parentKey, {
        dimensionValues: {
          [parentDimension]: parentValue,
        },
        assetGuids: parentAssets,
        assetCount: totalChildAssets,
        measures: parentMeasures,
        level: 0,
        isParent: true,
        isExpanded: true,
        children: [],
      });
    }

    // Add as child
    const parent = parentGroups.get(parentKey)!;
    parent.children!.push({
      ...row,
      level: 1,
      parentKey,
      isParent: false,
    });
  });

  // Flatten hierarchy for display
  const flattened: HierarchicalPivotRow[] = [];
  parentGroups.forEach((parent) => {
    flattened.push(parent);
    if (parent.isExpanded && parent.children) {
      flattened.push(...parent.children);
    }
  });

  return flattened;
}

/**
 * Determine if a measure should show as visual bar
 */
function shouldShowAsBar(measure: Measure, value: number, mode?: MeasureDisplayMode): boolean {
  if (mode === 'visual') return true;
  if (mode === 'numeric') return false;
  if (mode === 'percentage') return false;
  
  // Auto mode: show bars for score/percentage measures
  const scoreMeasures: Measure[] = ['completeness', 'accuracy', 'timeliness', 'consistency', 'usability', 'overall', 'avgCompleteness'];
  const percentageMeasures: Measure[] = ['descriptionCoverage', 'ownerCoverage', 'certificationCoverage', 'lineageCoverage', 'hasUpstream', 'hasDownstream', 'fullLineage'];
  
  return scoreMeasures.includes(measure) || percentageMeasures.includes(measure);
}

/**
 * Convert pivot table data to React table rows
 */
export function pivotDataToTableRows(
  data: PivotTableData,
  showHierarchy: boolean = true
): (string | React.ReactNode)[][] {
  const rows: (string | React.ReactNode)[][] = [];

  // Build hierarchical structure if we have multiple dimensions
  const hierarchicalRows = showHierarchy && data.dimensionOrder.length >= 2
    ? buildHierarchicalPivot(data)
    : data.rows.map((row) => ({
        ...row,
        level: 0,
        isParent: false,
      }));

  hierarchicalRows.forEach((row, rowIdx) => {
    const cells: (string | React.ReactNode)[] = [];
    const hierarchicalRow = row as HierarchicalPivotRow;
    const level = hierarchicalRow.level || 0;
    const isParent = hierarchicalRow.isParent || false;

    // Dimension cells
    data.dimensionOrder.forEach((dimension, dimIdx) => {
      const value = row.dimensionValues[dimension] || 'Unknown';
      const icon = getDimensionIcon(dimension);
      const isFirstDimension = dimIdx === 0;
      const isSecondDimension = dimIdx === 1;
      const indentClass = level > 0 ? `hierarchy-level-${level}` : '';

      if (isFirstDimension) {
        // First dimension cell
        cells.push(
          <span 
            key={`dim-${rowIdx}-${dimension}`} 
            className={`dim-cell ${indentClass}`}
            style={{ paddingLeft: level > 0 ? `${20 + (level - 1) * 20}px` : '0' }}
          >
            {level === 0 && (
              <span className="dim-icon connection">{icon}</span>
            )}
            {level > 0 && (
              <span className="hierarchy-indent">
                <span className="hierarchy-line">├─</span>
              </span>
            )}
            {value}
          </span>
        );
      } else if (isSecondDimension && level === 1) {
        // Second dimension for child rows
        cells.push(
          <span 
            key={`dim-${rowIdx}-${dimension}`} 
            className={`dim-cell ${indentClass}`}
          >
            {value}
          </span>
        );
      } else if (level === 0) {
        // Parent row - empty cells for nested dimensions
        cells.push(<span key={`dim-${rowIdx}-${dimension}`}></span>);
      }
    });

    // Measure cells
    data.measureOrder.forEach((measure) => {
      const value = row.measures[measure];
      const formatted = formatMeasure(measure, value);
      const displayMode = data.measureDisplayModes?.get(measure) || 'auto';

      if (shouldShowAsBar(measure, value, displayMode)) {
        // Show as visual bar
        cells.push(
          <div key={`measure-${rowIdx}-${measure}`} className="bar-cell">
            <div className="bar-container">
              <div
                className={`bar-fill ${getScoreClass(value)}`}
                style={{ width: `${value}%` }}
              ></div>
            </div>
            <span className="bar-value">{formatted}</span>
          </div>
        );
      } else if (displayMode === 'percentage' && measure !== 'assetCount') {
        // Show as percentage
        cells.push(`${value}%`);
      } else {
        // Show as numeric
        cells.push(formatted);
      }
    });

    rows.push(cells);
  });

  // Add total row
  if (data.rows.length > 0) {
    const totalCells: (string | React.ReactNode)[] = [];
    
    // Dimension cells (empty or "Total")
    data.dimensionOrder.forEach((dimension, dimIdx) => {
      if (dimIdx === 0) {
        totalCells.push(<strong key="total-label">Total</strong>);
      } else {
        totalCells.push('—');
      }
    });

    // Calculate totals for measures
    const totalAssets = data.rows.reduce((sum, row) => sum + row.assetCount, 0);
    
    // For percentage measures, use weighted average
    data.measureOrder.forEach((measure) => {
      if (measure === 'assetCount') {
        totalCells.push(<strong key={`total-${measure}`}>{totalAssets}</strong>);
      } else {
        // Calculate weighted average
        const total = data.rows.reduce((sum, row) => {
          return sum + (row.measures[measure] * row.assetCount);
        }, 0);
        const avg = Math.round(total / totalAssets);
        totalCells.push(<strong key={`total-${measure}`}>{formatMeasure(measure, avg)}</strong>);
      }
    });

    rows.push(totalCells);
  }

  return rows;
}

