/**
 * Dynamic Pivot Builder
 * 
 * Builds pivot tables dynamically based on selected row dimensions and measures
 */

import React from 'react';
import type { AtlanAsset } from '../services/atlan/types';
import type { RowDimension, Measure } from '../types/pivot';
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
import type { LineageInfo } from '../services/atlan/lineageEnricher';

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
}

/**
 * Build a dynamic pivot table from assets
 * @param assets - Assets to build pivot from
 * @param rowDimensions - Dimensions to group by
 * @param measures - Measures to calculate
 * @param lineageMap - Optional map of lineage info by asset GUID (for lineage measures)
 */
export function buildDynamicPivot(
  assets: AtlanAsset[],
  rowDimensions: RowDimension[],
  measures: Measure[],
  lineageMap?: Map<string, LineageInfo>
): PivotTableData {
  if (rowDimensions.length === 0 || measures.length === 0 || assets.length === 0) {
    return {
      headers: [],
      rows: [],
      dimensionOrder: rowDimensions,
      measureOrder: measures,
    };
  }

  // Group assets by dimension values
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

  // Build rows
  const rows: PivotRow[] = [];

  groups.forEach((groupAssets, key) => {
    const dimensionValues: Record<string, string> = {};
    const keyParts = key.split('::');

    rowDimensions.forEach((dimension, idx) => {
      dimensionValues[dimension] = keyParts[idx] || 'Unknown';
    });

    // Calculate measures for this group
    const measureValues: Record<string, number> = {};
    measures.forEach((measure) => {
      measureValues[measure] = calculateMeasure(measure, groupAssets, lineageMap);
    });

    rows.push({
      dimensionValues,
      assetGuids: groupAssets.map((a) => a.guid),
      assetCount: groupAssets.length,
      measures: measureValues,
    });
  });

  // Sort rows by first dimension, then second, etc.
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
 * Convert pivot table data to React table rows
 */
export function pivotDataToTableRows(
  data: PivotTableData,
  showHierarchy: boolean = true
): (string | React.ReactNode)[][] {
  const rows: (string | React.ReactNode)[][] = [];

  data.rows.forEach((row, rowIdx) => {
    const cells: (string | React.ReactNode)[] = [];

    // Dimension cells
    data.dimensionOrder.forEach((dimension, dimIdx) => {
      const value = row.dimensionValues[dimension] || 'Unknown';
      const icon = getDimensionIcon(dimension);
      const isFirstDimension = dimIdx === 0;
      const indent = showHierarchy && dimIdx > 0 ? `indent-${dimIdx}` : '';

      cells.push(
        <span key={`dim-${rowIdx}-${dimension}`} className={indent ? `dim-cell ${indent}` : ''}>
          {isFirstDimension ? (
            <>
              <span className="dim-icon connection">{icon}</span>
              {value}
            </>
          ) : (
            <>
              ├─ {value}
            </>
          )}
        </span>
      );
    });

    // Measure cells
    data.measureOrder.forEach((measure) => {
      const value = row.measures[measure];
      const formatted = formatMeasure(measure, value);

      if (measure === 'overall' || measure === 'completeness' || measure === 'accuracy') {
        // Show as bar for score measures
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
      } else {
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
    const allAssetGuids = data.rows.flatMap((row) => row.assetGuids);
    
    // For percentage measures, we need to recalculate from all assets
    // For now, use weighted average
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

function getScoreClass(score: number): string {
  if (score >= 80) return 'excellent';
  if (score >= 60) return 'good';
  if (score >= 40) return 'fair';
  if (score >= 20) return 'poor';
  return 'critical';
}

