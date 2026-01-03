import React, { useState, useMemo } from 'react';
import { ChevronDown, ChevronRight, Snowflake, Database, Table, BarChart3, Workflow } from 'lucide-react';
import type { PivotTableData, HierarchicalPivotRow } from '../../utils/dynamicPivotBuilder';
import type { AtlanAsset } from '../../services/atlan/types';
import { calculateMeasure } from '../../utils/pivotMeasures';
import { getDimensionIcon, getDimensionLabel } from '../../utils/pivotDimensions';
import { formatMeasure, getMeasureLabel } from '../../utils/pivotMeasures';
import { getScoreClass } from '../../utils/scoreThresholds';
import './HierarchicalPivotTable.css';

interface HierarchicalPivotTableProps {
  data: PivotTableData;
  assets: AtlanAsset[];
  className?: string;
}

interface TreeNode extends HierarchicalPivotRow {
  rowKey: string;
  children: TreeNode[];
  childRows: PivotTableData['rows'];
  level: number;
  isParent: boolean;
}

function getConnectionIcon(connName: string): React.ReactNode {
  const lower = connName.toLowerCase();
  if (lower.includes('snowflake')) return <Snowflake size={16} />;
  if (lower.includes('bigquery') || lower.includes('big query')) return <Database size={16} />;
  if (lower.includes('postgres')) return <Database size={16} />;
  if (lower.includes('tableau')) return <BarChart3 size={16} />;
  if (lower.includes('dbt')) return <Workflow size={16} />;
  if (lower.includes('databricks')) return <Database size={16} />;
  return <Database size={16} />;
}

export function HierarchicalPivotTable({ data, assets, className = '' }: HierarchicalPivotTableProps) {
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());

  // Build recursive tree structure
  const buildTree = (
    rows: typeof data.rows,
    dimensionIndex: number,
    parentPath: string[] = []
  ): TreeNode[] => {
    if (dimensionIndex >= data.dimensionOrder.length) {
      return [];
    }

    const currentDimension = data.dimensionOrder[dimensionIndex];
    const groups = new Map<string, typeof data.rows>();

    // Group rows by current dimension value
    rows.forEach((row) => {
      const value = row.dimensionValues[currentDimension] || 'Unknown';
      const key = value;

      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(row);
    });

    const treeNodes: TreeNode[] = [];

    groups.forEach((groupRows, value) => {
      const path = [...parentPath, `${currentDimension}::${value}`];
      const rowKey = path.join('::');

      // Get all assets for this group
      const groupAssetGuids = groupRows.flatMap((r) => r.assetGuids);
      const groupAssets = assets.filter((a) => groupAssetGuids.includes(a.guid));

      // Calculate measures from actual assets
      const measures: Record<string, number> = {};
      data.measureOrder.forEach((measure) => {
        if (measure === 'assetCount') {
          measures[measure] = groupAssets.length;
        } else {
          measures[measure] = calculateMeasure(measure, groupAssets);
        }
      });

      // Build dimension values object - include all parent dimensions
      const dimensionValues: Record<string, string> = {};
      // Copy all dimension values from the first row (they should all be the same for parent dims)
      if (groupRows.length > 0) {
        Object.assign(dimensionValues, groupRows[0].dimensionValues);
      }
      // Set the current dimension value
      dimensionValues[currentDimension] = value;

      // Check if there are more dimensions to nest
      const hasChildren = dimensionIndex < data.dimensionOrder.length - 1;
      const childRows = hasChildren ? groupRows : [];

      const node: TreeNode = {
        dimensionValues,
        assetGuids: groupAssetGuids,
        assetCount: groupAssets.length,
        measures,
        level: dimensionIndex,
        isParent: hasChildren,
        rowKey,
        children: [],
        childRows,
      };

      // Recursively build children if there are more dimensions
      if (hasChildren) {
        node.children = buildTree(groupRows, dimensionIndex + 1, path);
      }

      treeNodes.push(node);
    });

    return treeNodes;
  };

  // Flatten tree for rendering
  const flattenTree = (nodes: TreeNode[]): TreeNode[] => {
    const result: TreeNode[] = [];

    nodes.forEach((node) => {
      result.push(node);

      if (node.isParent && expandedNodes.has(node.rowKey)) {
        result.push(...flattenTree(node.children));
      }
    });

    return result;
  };

  const tree = useMemo(() => {
    return buildTree(data.rows, 0);
  }, [data, assets]);

  const flattenedRows = useMemo(() => {
    return flattenTree(tree);
  }, [tree, expandedNodes]);

  // Initialize all nodes as expanded by default
  React.useEffect(() => {
    const allKeys = new Set<string>();
    const collectKeys = (nodes: TreeNode[]) => {
      nodes.forEach((node) => {
        if (node.isParent) {
          allKeys.add(node.rowKey);
          collectKeys(node.children);
        }
      });
    };
    collectKeys(tree);
    setExpandedNodes(allKeys);
  }, [tree]);

  const toggleNode = (rowKey: string) => {
    const newExpanded = new Set(expandedNodes);
    if (newExpanded.has(rowKey)) {
      newExpanded.delete(rowKey);
    } else {
      newExpanded.add(rowKey);
    }
    setExpandedNodes(newExpanded);
  };

  // Build headers
  const headers: (string | React.ReactNode)[] = [];
  if (data.dimensionOrder.length > 0) {
    headers.push(data.dimensionOrder.map(getDimensionLabel).join(' / '));
  }
  data.measureOrder.forEach((measure) => {
    headers.push(getMeasureLabel(measure));
  });

  const getTreeIndent = (level: number) => {
    if (level === 0) return null;
    return (
      <span className="hierarchy-indent-line">
        {'│  '.repeat(level - 1)}├─{' '}
      </span>
    );
  };

  return (
    <table className={`data-table hierarchical-table ${className}`}>
      <thead>
        <tr>
          {headers.map((header, idx) => (
            <th
              key={idx}
              className={
                typeof header === 'string' && (header.includes('%') || header.toLowerCase().includes('numeric'))
                  ? 'numeric'
                  : ''
              }
            >
              {header}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {flattenedRows.map((row) => {
          const isParent = row.isParent;
          const level = row.level;
          const hasChildren = isParent && row.children.length > 0;
          const isExpanded = expandedNodes.has(row.rowKey);
          const currentDimension = data.dimensionOrder[level];
          const currentValue = row.dimensionValues[currentDimension] || 'Unknown';

          return (
            <tr 
              key={row.rowKey} 
              className={`hierarchy-row level-${level} ${isParent ? 'parent-row' : 'child-row'}`}
            >
              {/* Dimension cell */}
              <td className="dim-cell hierarchy-cell">
                <div 
                  className="hierarchy-content"
                  style={{ paddingLeft: `${level * 24}px` }}
                >
                  {isParent && hasChildren && (
                    <button
                      className="expand-toggle"
                      onClick={() => toggleNode(row.rowKey)}
                      aria-label={isExpanded ? 'Collapse' : 'Expand'}
                    >
                      {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </button>
                  )}
                  {!isParent && level > 0 && getTreeIndent(level)}
                  {level === 0 && (
                    <span className="dim-icon connection">
                      {currentDimension === 'connection'
                        ? getConnectionIcon(currentValue)
                        : getDimensionIcon(currentDimension)}
                    </span>
                  )}
                  <span className="dim-value">{currentValue}</span>
                </div>
              </td>

              {/* Measure cells */}
              {data.measureOrder.map((measure) => {
                const value = row.measures[measure];
                const formatted = formatMeasure(measure, value);
                const displayMode = data.measureDisplayModes?.get(measure) || 'auto';
                
                // Determine if should show as bar
                const shouldShowBar = displayMode === 'visual' || 
                  (displayMode === 'auto' && (
                    ['completeness', 'accuracy', 'timeliness', 'consistency', 'usability', 'overall', 'avgCompleteness', 
                     'descriptionCoverage', 'ownerCoverage', 'certificationCoverage', 'lineageCoverage', 
                     'hasUpstream', 'hasDownstream', 'fullLineage'].includes(measure)
                  ));

                if (shouldShowBar) {
                  return (
                    <td key={`measure-${row.rowKey}-${measure}`} className="numeric">
                      <div className="bar-cell">
                        <div className="bar-container">
                          <div
                            className={`bar-fill ${getScoreClass(value)}`}
                            style={{ width: `${value}%` }}
                          ></div>
                        </div>
                        <span className="bar-value">{formatted}</span>
                      </div>
                    </td>
                  );
                } else if (displayMode === 'percentage' && measure !== 'assetCount') {
                  return (
                    <td key={`measure-${row.rowKey}-${measure}`} className="numeric">
                      {value}%
                    </td>
                  );
                } else {
                  return (
                    <td key={`measure-${row.rowKey}-${measure}`} className="numeric">
                      {formatted}
                    </td>
                  );
                }
              })}
            </tr>
          );
        })}

        {/* Total row */}
        {data.rows.length > 0 && (
          <tr className="total-row">
            <td className="dim-cell">
              <strong>Total</strong>
            </td>
            {data.measureOrder.map((measure) => {
              const totalAssets = data.rows.reduce((sum, row) => sum + row.assetCount, 0);
              if (measure === 'assetCount') {
                return (
                  <td key={`total-${measure}`} className="numeric">
                    <strong>{totalAssets}</strong>
                  </td>
                );
              } else {
                const total = data.rows.reduce((sum, row) => {
                  return sum + (row.measures[measure] * row.assetCount);
                }, 0);
                const avg = totalAssets > 0 ? Math.round(total / totalAssets) : 0;
                return (
                  <td key={`total-${measure}`} className="numeric">
                    <strong>{formatMeasure(measure, avg)}</strong>
                  </td>
                );
              }
            })}
          </tr>
        )}
      </tbody>
    </table>
  );
}
