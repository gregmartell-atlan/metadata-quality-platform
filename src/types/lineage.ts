/**
 * Lineage Graph Types
 * 
 * Types for visualizing lineage relationships as a graph
 * Based on Atlan's lineage model with Assets and Processes
 */

import type { AtlanAsset } from '../services/atlan/types';

/**
 * Quality scores for an asset (5 dimensions)
 */
export interface QualityScores {
  completeness?: number;
  accuracy?: number;
  timeliness?: number;
  consistency?: number;
  usability?: number;
  overall?: number;
}

/**
 * Governance metadata for an asset
 */
export interface GovernanceMetadata {
  certificateStatus?: 'VERIFIED' | 'DRAFT' | 'DEPRECATED' | null;
  ownerUsers?: string[];
  ownerGroups?: string[];
  tags?: string[];
  terms?: Array<{ guid: string; displayText: string }>;
  domainGUIDs?: string[];
}

/**
 * Freshness/timeliness metadata
 */
export interface FreshnessMetadata {
  lastUpdated?: number; // Unix timestamp
  lastSyncRunAt?: number;
  sourceLastReadAt?: number;
  updateTime?: number;
  isStale?: boolean; // Calculated based on thresholds
  stalenessDays?: number;
}

/**
 * Lineage node in the graph
 */
export interface LineageNode {
  id: string;
  guid: string;
  label: string;
  type: string; // Asset typeName or Process typeName
  entityType: 'asset' | 'process'; // Distinguishes Assets from Processes
  data: AtlanAsset;
  position?: { x: number; y: number };
  
  // Coverage indicators
  hasDescription: boolean;
  hasOwner: boolean;
  hasTags: boolean;
  hasTerms: boolean;
  hasCertificate: boolean;
  
  // Lineage indicators
  hasUpstream: boolean;
  hasDownstream: boolean;
  upstreamCount: number;
  downstreamCount: number;
  
  // Quality scores
  qualityScores?: QualityScores;
  
  // Governance
  governance?: GovernanceMetadata;
  
  // Freshness
  freshness?: FreshnessMetadata;
  
  // Expandable state
  isExpandable: boolean;
  isExpanded: boolean;
  expansionDepth?: number;
  
  // Visual state
  isCenterNode: boolean;
  isHighlighted?: boolean; // For impact analysis or root cause tracing
  highlightReason?: 'impact' | 'root-cause' | 'quality-issue';
}

/**
 * Lineage edge in the graph
 */
export interface LineageEdge {
  id: string;
  source: string; // Node ID
  target: string; // Node ID
  relationshipType: string; // inputToProcesses, outputFromProcesses, inputs, outputs, etc.
  relationshipId: string;
  
  // Direction: true = upstream (target -> source), false = downstream (source -> target)
  isUpstream: boolean;
  
  // Additional metadata
  sourceType?: string; // Type of source entity
  targetType?: string; // Type of target entity
}

/**
 * Complete lineage graph structure
 */
export interface LineageGraph {
  nodes: LineageNode[];
  edges: LineageEdge[];
  centerNodeId: string | null;
}

/**
 * Configuration for lineage view
 */
export interface LineageViewConfig {
  depth: number; // 1-5
  direction: 'upstream' | 'downstream' | 'both';
  viewMode: 'table' | 'column'; // Table-level or column-level lineage
  layout: 'hierarchical' | 'radial' | 'force';
  
  // Filters
  filterByType: string[]; // Asset/Process type names
  filterByConnection: string[]; // Connection names
  filterByQuality: {
    enabled: boolean;
    threshold: number; // Show only assets with overall quality below this
  };
  filterByGovernance: {
    enabled: boolean;
    showOnlyUncertified: boolean;
    showOnlyOrphaned: boolean;
  };
  
  // Display options
  showCoverage: boolean;
  showQualityScores: boolean;
  showFreshness: boolean;
  showGovernance: boolean;
  showMetrics: boolean;
  showEdgeLabels: boolean;
  
  // Analysis modes
  impactAnalysisMode: boolean;
  rootCauseMode: boolean;
}

/**
 * Coverage metrics for the lineage graph
 */
export interface LineageCoverageMetrics {
  totalAssets: number;
  totalProcesses: number;
  withUpstream: number;
  withDownstream: number;
  withFullLineage: number;
  orphaned: number;
  coveragePercentage: number;
  avgUpstreamCount: number;
  avgDownstreamCount: number;
}

/**
 * Quality metrics for the lineage graph
 */
export interface LineageQualityMetrics {
  avgCompleteness: number;
  avgAccuracy: number;
  avgTimeliness: number;
  avgConsistency: number;
  avgUsability: number;
  avgOverall: number;
  assetsWithIssues: number; // Count of assets with overall < 50
  assetsWithIssuesPercentage: number;
}

/**
 * Combined metrics for display
 */
export interface LineageMetrics {
  coverage: LineageCoverageMetrics;
  quality: LineageQualityMetrics;
  freshness?: {
    staleAssets: number;
    stalePercentage: number;
  };
}













