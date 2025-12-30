/**
 * Pivot Configuration Types
 * 
 * Defines the structure for configurable pivot views
 */

export type RowDimension = 
  | 'connection' 
  | 'database' 
  | 'schema' 
  | 'type' 
  | 'owner'
  | 'ownerGroup'
  | 'domain'
  | 'certificationStatus';

export type Measure = 
  | 'assetCount'
  | 'completeness'
  | 'accuracy'
  | 'timeliness'
  | 'consistency'
  | 'usability'
  | 'overall'
  | 'descriptionCoverage'
  | 'ownerCoverage'
  | 'certificationCoverage'
  | 'lineageCoverage'
  | 'hasUpstream'
  | 'hasDownstream'
  | 'fullLineage'
  | 'orphaned'
  | 'avgCompleteness';

export interface PivotConfig {
  rowDimensions: RowDimension[];
  columnDimensions?: RowDimension[];
  measures: Measure[];
}

export interface MeasureDefinition {
  id: Measure;
  label: string;
  description: string;
  format: 'number' | 'percentage' | 'score';
  calculate: (assets: any[], metadata?: any) => number | string;
}

export interface RowDimensionDefinition {
  id: RowDimension;
  label: string;
  description: string;
  icon: string;
  extractValue: (asset: any) => string | null;
}

