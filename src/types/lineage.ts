/**
 * Lineage Graph Types
 * 
 * Types for visualizing lineage relationships as a graph
 */

import type { AtlanAsset } from '../services/atlan/types';

export interface LineageNode {
  id: string;
  guid: string;
  label: string;
  type: string;
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
}

export interface LineageEdge {
  id: string;
  source: string;
  target: string;
  relationshipType: string;
  relationshipId: string;
  // Direction: true = upstream (target -> source), false = downstream (source -> target)
  isUpstream: boolean;
}

export interface LineageGraph {
  nodes: LineageNode[];
  edges: LineageEdge[];
  centerNodeId: string | null;
}

export interface LineageViewConfig {
  depth: number;
  direction: 'upstream' | 'downstream' | 'both';
  showCoverage: boolean;
  filterByType: string[];
  filterByConnection: string[];
  layout: 'hierarchical' | 'force' | 'radial';
  showMetrics: boolean;
}

export interface LineageCoverageMetrics {
  totalAssets: number;
  withUpstream: number;
  withDownstream: number;
  withFullLineage: number;
  orphaned: number;
  coveragePercentage: number;
  avgUpstreamCount: number;
  avgDownstreamCount: number;
}

