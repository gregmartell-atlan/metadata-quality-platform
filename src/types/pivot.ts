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

export type MeasureDisplayMode = 'numeric' | 'percentage' | 'visual' | 'auto';

export interface MeasureDisplayConfig {
  measure: Measure;
  mode: MeasureDisplayMode;
}

export interface PivotConfig {
  rowDimensions: RowDimension[];
  columnDimensions?: RowDimension[];
  measures: Measure[];
  measureDisplayModes?: MeasureDisplayConfig[];
}

export interface MeasureDefinition {
  id: Measure;
  label: string;
  description?: string;
}
