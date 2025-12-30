/**
 * Lineage Graph Utilities
 * 
 * Transform lineage API responses into graph data structures
 * Based on Atlan's lineage model with Assets and Processes
 */

import type { AtlanLineageResponse, AtlanAsset } from '../services/atlan/types';
import type {
  LineageNode,
  LineageEdge,
  LineageGraph,
  LineageCoverageMetrics,
  LineageQualityMetrics,
  LineageMetrics,
  QualityScores,
  GovernanceMetadata,
  FreshnessMetadata,
} from '../types/lineage';

/**
 * Check if an entity is a Process type
 */
function isProcessType(typeName: string): boolean {
  const processTypes = ['Process', 'ColumnProcess', 'BIProcess', 'SparkJob'];
  return processTypes.some(pt => typeName.includes(pt) || typeName === pt);
}

/**
 * Calculate freshness metadata for an asset
 */
function calculateFreshness(asset: AtlanAsset): FreshnessMetadata {
  const now = Date.now();
  const lastUpdated = asset.updateTime || asset.sourceUpdatedAt || asset.lastSyncRunAt;
  const stalenessDays = lastUpdated ? Math.floor((now - lastUpdated) / (1000 * 60 * 60 * 24)) : undefined;
  
  // Consider stale if not updated in 90 days
  const isStale = stalenessDays !== undefined && stalenessDays > 90;
  
  return {
    lastUpdated,
    lastSyncRunAt: asset.lastSyncRunAt,
    sourceLastReadAt: asset.sourceLastReadAt,
    updateTime: asset.updateTime,
    isStale,
    stalenessDays,
  };
}

/**
 * Extract governance metadata from asset
 */
function extractGovernance(asset: AtlanAsset): GovernanceMetadata {
  return {
    certificateStatus: asset.certificateStatus,
    ownerUsers: Array.isArray(asset.ownerUsers) ? asset.ownerUsers.map((u: any) => typeof u === 'string' ? u : u.name || u.guid) : [],
    ownerGroups: Array.isArray(asset.ownerGroups) ? asset.ownerGroups.map((g: any) => typeof g === 'string' ? g : g.name || g.guid) : [],
    tags: asset.assetTags || asset.classificationNames || [],
    terms: asset.meanings || asset.assignedTerms || [],
    domainGUIDs: asset.domainGUIDs || [],
  };
}

/**
 * Transform Atlan lineage response to graph nodes and edges
 */
export function buildLineageGraph(
  centerAsset: AtlanAsset,
  lineageResponse: AtlanLineageResponse,
  direction: 'upstream' | 'downstream' | 'both' = 'both',
  qualityScoresMap?: Map<string, QualityScores>
): LineageGraph {
  const nodes: LineageNode[] = [];
  const edges: LineageEdge[] = [];
  const guidEntityMap = lineageResponse.guidEntityMap || {};
  const relations = lineageResponse.relations || [];

  // Add center node
  const centerNode: LineageNode = {
    id: centerAsset.guid,
    guid: centerAsset.guid,
    label: centerAsset.name || centerAsset.qualifiedName || 'Unknown',
    type: centerAsset.typeName || 'Unknown',
    entityType: isProcessType(centerAsset.typeName || '') ? 'process' : 'asset',
    data: centerAsset,
    hasDescription: !!(centerAsset.description || centerAsset.userDescription),
    hasOwner: !!(centerAsset.ownerUsers?.length || centerAsset.ownerGroups?.length),
    hasTags: !!(centerAsset.assetTags?.length || centerAsset.classificationNames?.length),
    hasTerms: !!(centerAsset.meanings?.length || centerAsset.assignedTerms?.length),
    hasCertificate: !!centerAsset.certificateStatus,
    hasUpstream: false,
    hasDownstream: false,
    upstreamCount: 0,
    downstreamCount: 0,
    isExpandable: false,
    isExpanded: true,
    isCenterNode: true,
    qualityScores: qualityScoresMap?.get(centerAsset.guid),
    governance: extractGovernance(centerAsset),
    freshness: calculateFreshness(centerAsset),
  };
  nodes.push(centerNode);

  // Add all entities from guidEntityMap as nodes
  Object.values(guidEntityMap).forEach((asset) => {
    if (asset.guid === centerAsset.guid) return; // Skip center node

    const entityType = isProcessType(asset.typeName || '') ? 'process' : 'asset';
    
    const node: LineageNode = {
      id: asset.guid,
      guid: asset.guid,
      label: asset.name || asset.qualifiedName || 'Unknown',
      type: asset.typeName || 'Unknown',
      entityType,
      data: asset,
      hasDescription: !!(asset.description || asset.userDescription),
      hasOwner: !!(asset.ownerUsers?.length || asset.ownerGroups?.length),
      hasTags: !!(asset.assetTags?.length || asset.classificationNames?.length),
      hasTerms: !!(asset.meanings?.length || asset.assignedTerms?.length),
      hasCertificate: !!asset.certificateStatus,
      hasUpstream: false,
      hasDownstream: false,
      upstreamCount: 0,
      downstreamCount: 0,
      isExpandable: true, // Assume expandable until we know otherwise
      isExpanded: false,
      isCenterNode: false,
      qualityScores: qualityScoresMap?.get(asset.guid),
      governance: extractGovernance(asset),
      freshness: calculateFreshness(asset),
    };
    nodes.push(node);
  });

  // Process relations to build edges and update node lineage flags
  relations.forEach((relation) => {
    const fromNode = nodes.find((n) => n.guid === relation.fromEntityId);
    const toNode = nodes.find((n) => n.guid === relation.toEntityId);

    if (!fromNode || !toNode) return;

    // Determine if this is upstream (target -> center) or downstream (center -> target)
    const isUpstream = relation.toEntityId === centerAsset.guid;
    const isDownstream = relation.fromEntityId === centerAsset.guid;

    // Update node lineage flags
    if (isUpstream) {
      fromNode.hasUpstream = true;
      fromNode.upstreamCount++;
    }
    if (isDownstream) {
      toNode.hasDownstream = true;
      toNode.downstreamCount++;
    }

    // Create edge
    const edge: LineageEdge = {
      id: relation.relationshipId || `${relation.fromEntityId}-${relation.toEntityId}`,
      source: relation.fromEntityId,
      target: relation.toEntityId,
      relationshipType: relation.relationshipType || 'unknown',
      relationshipId: relation.relationshipId,
      isUpstream: isUpstream,
      sourceType: fromNode.type,
      targetType: toNode.type,
    };

    // Filter edges based on direction
    if (direction === 'both') {
      edges.push(edge);
    } else if (direction === 'upstream' && isUpstream) {
      edges.push(edge);
    } else if (direction === 'downstream' && isDownstream) {
      edges.push(edge);
    }
  });

  // Update center node lineage flags based on edges
  const centerUpstreamEdges = edges.filter((e) => e.target === centerAsset.guid);
  const centerDownstreamEdges = edges.filter((e) => e.source === centerAsset.guid);
  
  centerNode.hasUpstream = centerUpstreamEdges.length > 0;
  centerNode.hasDownstream = centerDownstreamEdges.length > 0;
  centerNode.upstreamCount = centerUpstreamEdges.length;
  centerNode.downstreamCount = centerDownstreamEdges.length;

  return {
    nodes,
    edges,
    centerNodeId: centerAsset.guid,
  };
}

/**
 * Calculate coverage metrics for a lineage graph
 */
export function calculateCoverageMetrics(graph: LineageGraph): LineageCoverageMetrics {
  const { nodes } = graph;
  const totalAssets = nodes.filter((n) => n.entityType === 'asset').length;
  const totalProcesses = nodes.filter((n) => n.entityType === 'process').length;
  const totalNodes = nodes.length;
  
  const withUpstream = nodes.filter((n) => n.hasUpstream).length;
  const withDownstream = nodes.filter((n) => n.hasDownstream).length;
  const withFullLineage = nodes.filter((n) => n.hasUpstream && n.hasDownstream).length;
  const orphaned = nodes.filter((n) => !n.hasUpstream && !n.hasDownstream).length;
  
  const coveragePercentage = totalNodes > 0 
    ? Math.round(((totalNodes - orphaned) / totalNodes) * 100)
    : 0;
  
  const avgUpstreamCount = totalNodes > 0
    ? Math.round(nodes.reduce((sum, n) => sum + n.upstreamCount, 0) / totalNodes * 10) / 10
    : 0;
  
  const avgDownstreamCount = totalNodes > 0
    ? Math.round(nodes.reduce((sum, n) => sum + n.downstreamCount, 0) / totalNodes * 10) / 10
    : 0;

  return {
    totalAssets,
    totalProcesses,
    withUpstream,
    withDownstream,
    withFullLineage,
    orphaned,
    coveragePercentage,
    avgUpstreamCount,
    avgDownstreamCount,
  };
}

/**
 * Calculate quality metrics for a lineage graph
 */
export function calculateQualityMetrics(graph: LineageGraph): LineageQualityMetrics {
  const { nodes } = graph;
  const assetsWithScores = nodes.filter((n) => n.qualityScores && n.entityType === 'asset');
  
  if (assetsWithScores.length === 0) {
    return {
      avgCompleteness: 0,
      avgAccuracy: 0,
      avgTimeliness: 0,
      avgConsistency: 0,
      avgUsability: 0,
      avgOverall: 0,
      assetsWithIssues: 0,
      assetsWithIssuesPercentage: 0,
    };
  }
  
  const totals = assetsWithScores.reduce(
    (acc, node) => {
      const scores = node.qualityScores!;
      acc.completeness += scores.completeness || 0;
      acc.accuracy += scores.accuracy || 0;
      acc.timeliness += scores.timeliness || 0;
      acc.consistency += scores.consistency || 0;
      acc.usability += scores.usability || 0;
      acc.overall += scores.overall || 0;
      return acc;
    },
    { completeness: 0, accuracy: 0, timeliness: 0, consistency: 0, usability: 0, overall: 0 }
  );
  
  const count = assetsWithScores.length;
  const assetsWithIssues = assetsWithScores.filter((n) => (n.qualityScores?.overall || 0) < 50).length;
  
  return {
    avgCompleteness: Math.round(totals.completeness / count),
    avgAccuracy: Math.round(totals.accuracy / count),
    avgTimeliness: Math.round(totals.timeliness / count),
    avgConsistency: Math.round(totals.consistency / count),
    avgUsability: Math.round(totals.usability / count),
    avgOverall: Math.round(totals.overall / count),
    assetsWithIssues,
    assetsWithIssuesPercentage: Math.round((assetsWithIssues / count) * 100),
  };
}

/**
 * Calculate combined metrics
 */
export function calculateMetrics(graph: LineageGraph): LineageMetrics {
  const coverage = calculateCoverageMetrics(graph);
  const quality = calculateQualityMetrics(graph);
  
  const staleAssets = graph.nodes.filter((n) => n.freshness?.isStale && n.entityType === 'asset').length;
  const stalePercentage = coverage.totalAssets > 0
    ? Math.round((staleAssets / coverage.totalAssets) * 100)
    : 0;
  
  return {
    coverage,
    quality,
    freshness: {
      staleAssets,
      stalePercentage,
    },
  };
}

/**
 * Find all downstream assets from a given node (for impact analysis)
 */
export function findImpactPath(graph: LineageGraph, nodeId: string): string[] {
  const affected: string[] = [];
  const visited = new Set<string>();
  
  function traverseDownstream(currentId: string) {
    if (visited.has(currentId)) return;
    visited.add(currentId);
    
    const outgoingEdges = graph.edges.filter((e) => e.source === currentId && !e.isUpstream);
    outgoingEdges.forEach((edge) => {
      if (!affected.includes(edge.target)) {
        affected.push(edge.target);
      }
      traverseDownstream(edge.target);
    });
  }
  
  traverseDownstream(nodeId);
  return affected;
}

/**
 * Find upstream path from a node (for root cause analysis)
 */
export function findRootCausePath(graph: LineageGraph, nodeId: string): string[] {
  const path: string[] = [];
  const visited = new Set<string>();
  
  function traverseUpstream(currentId: string) {
    if (visited.has(currentId)) return;
    visited.add(currentId);
    
    const incomingEdges = graph.edges.filter((e) => e.target === currentId && e.isUpstream);
    incomingEdges.forEach((edge) => {
      if (!path.includes(edge.source)) {
        path.push(edge.source);
      }
      traverseUpstream(edge.source);
    });
  }
  
  traverseUpstream(nodeId);
  return path;
}

/**
 * Apply hierarchical layout to nodes
 */
export function applyHierarchicalLayout(
  graph: LineageGraph,
  direction: 'upstream' | 'downstream' | 'both' = 'both'
): LineageNode[] {
  const { nodes, edges, centerNodeId } = graph;
  const centerNode = nodes.find((n) => n.id === centerNodeId);
  if (!centerNode) return nodes;

  const layoutNodes = [...nodes];

  // Build adjacency lists
  const upstreamMap = new Map<string, string[]>();
  const downstreamMap = new Map<string, string[]>();

  edges.forEach((edge) => {
    if (edge.isUpstream) {
      // Upstream: target -> source (target is upstream of source)
      if (!upstreamMap.has(edge.target)) {
        upstreamMap.set(edge.target, []);
      }
      upstreamMap.get(edge.target)!.push(edge.source);
    } else {
      // Downstream: source -> target
      if (!downstreamMap.has(edge.source)) {
        downstreamMap.set(edge.source, []);
      }
      downstreamMap.get(edge.source)!.push(edge.target);
    }
  });

  // Calculate levels using BFS
  const levels = new Map<string, number>();
  const visited = new Set<string>();

  // Center node is at level 0
  levels.set(centerNodeId!, 0);
  visited.add(centerNodeId!);

  const queue: Array<{ id: string; level: number }> = [{ id: centerNodeId!, level: 0 }];

  while (queue.length > 0) {
    const { id, level } = queue.shift()!;

    // Process upstream (parents)
    if (direction === 'upstream' || direction === 'both') {
      const upstream = upstreamMap.get(id) || [];
      upstream.forEach((childId) => {
        if (!visited.has(childId)) {
          visited.add(childId);
          levels.set(childId, level - 1);
          queue.push({ id: childId, level: level - 1 });
        }
      });
    }

    // Process downstream (children)
    if (direction === 'downstream' || direction === 'both') {
      const downstream = downstreamMap.get(id) || [];
      downstream.forEach((childId) => {
        if (!visited.has(childId)) {
          visited.add(childId);
          levels.set(childId, level + 1);
          queue.push({ id: childId, level: level + 1 });
        }
      });
    }
  }

  // Assign positions based on levels
  const levelGroups = new Map<number, LineageNode[]>();
  layoutNodes.forEach((node) => {
    const level = levels.get(node.id) ?? 0;
    if (!levelGroups.has(level)) {
      levelGroups.set(level, []);
    }
    levelGroups.get(level)!.push(node);
  });

  const maxLevel = Math.max(...Array.from(levelGroups.keys()));
  const minLevel = Math.min(...Array.from(levelGroups.keys()));
  const levelRange = maxLevel - minLevel || 1;

  const HORIZONTAL_SPACING = 300;
  const VERTICAL_SPACING = 150;

  levelGroups.forEach((group, level) => {
    const normalizedLevel = (level - minLevel) / levelRange;
    const x = normalizedLevel * HORIZONTAL_SPACING * levelRange;
    
    group.forEach((node, index) => {
      const y = (index - group.length / 2) * VERTICAL_SPACING;
      node.position = { x, y };
    });
  });

  return layoutNodes;
}

/**
 * Apply radial layout to nodes
 */
export function applyRadialLayout(graph: LineageGraph): LineageNode[] {
  const { nodes, edges, centerNodeId } = graph;
  const centerNode = nodes.find((n) => n.id === centerNodeId);
  if (!centerNode) return nodes;

  const layoutNodes = [...nodes];
  const nodeMap = new Map(layoutNodes.map((n) => [n.id, n]));

  // Center node at origin
  centerNode.position = { x: 0, y: 0 };

  // Calculate distances from center using BFS
  const distances = new Map<string, number>();
  distances.set(centerNodeId!, 0);

  const queue: Array<{ id: string; distance: number }> = [{ id: centerNodeId!, distance: 0 }];
  const visited = new Set<string>([centerNodeId!]);

  while (queue.length > 0) {
    const { id, distance } = queue.shift()!;
    const node = nodeMap.get(id);
    if (!node) continue;

    // Find neighbors
    const neighbors = edges
      .filter((e) => e.source === id || e.target === id)
      .map((e) => (e.source === id ? e.target : e.source));

    neighbors.forEach((neighborId) => {
      if (!visited.has(neighborId)) {
        visited.add(neighborId);
        distances.set(neighborId, distance + 1);
        queue.push({ id: neighborId, distance: distance + 1 });
      }
    });
  }

  // Group by distance
  const distanceGroups = new Map<number, LineageNode[]>();
  layoutNodes.forEach((node) => {
    const distance = distances.get(node.id) ?? 0;
    if (!distanceGroups.has(distance)) {
      distanceGroups.set(distance, []);
    }
    distanceGroups.get(distance)!.push(node);
  });

  // Position nodes in concentric circles
  const RADIUS_BASE = 200;
  distanceGroups.forEach((group, distance) => {
    if (distance === 0) return; // Center node already positioned

    const radius = distance * RADIUS_BASE;
    const angleStep = (2 * Math.PI) / group.length;

    group.forEach((node, index) => {
      const angle = index * angleStep;
      node.position = {
        x: radius * Math.cos(angle),
        y: radius * Math.sin(angle),
      };
    });
  });

  return layoutNodes;
}

