/**
 * Lineage Graph Utilities
 * 
 * Transform lineage API responses into graph data structures
 */

import type { AtlanLineageResponse, AtlanAsset } from '../services/atlan/types';
import type { LineageNode, LineageEdge, LineageGraph, LineageCoverageMetrics } from '../types/lineage';

/**
 * Transform Atlan lineage response to graph nodes and edges
 */
export function buildLineageGraph(
  centerAsset: AtlanAsset,
  lineageResponse: AtlanLineageResponse,
  direction: 'upstream' | 'downstream' | 'both' = 'both'
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
    data: centerAsset,
    hasDescription: !!(centerAsset.description || centerAsset.userDescription),
    hasOwner: !!(centerAsset.ownerUsers?.length || centerAsset.ownerGroups?.length),
    hasTags: !!(centerAsset.atlanTags?.length),
    hasTerms: !!(centerAsset.meanings?.length),
    hasCertificate: !!centerAsset.certificateStatus,
    hasUpstream: false,
    hasDownstream: false,
    upstreamCount: 0,
    downstreamCount: 0,
  };
  nodes.push(centerNode);

  // Add all entities from guidEntityMap as nodes
  Object.values(guidEntityMap).forEach((asset) => {
    if (asset.guid === centerAsset.guid) return; // Skip center node

    const node: LineageNode = {
      id: asset.guid,
      guid: asset.guid,
      label: asset.name || asset.qualifiedName || 'Unknown',
      type: asset.typeName || 'Unknown',
      data: asset,
      hasDescription: !!(asset.description || asset.userDescription),
      hasOwner: !!(asset.ownerUsers?.length || asset.ownerGroups?.length),
      hasTags: !!(asset.atlanTags?.length),
      hasTerms: !!(asset.meanings?.length),
      hasCertificate: !!asset.certificateStatus,
      hasUpstream: false,
      hasDownstream: false,
      upstreamCount: 0,
      downstreamCount: 0,
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
  const totalAssets = nodes.length;
  
  const withUpstream = nodes.filter((n) => n.hasUpstream).length;
  const withDownstream = nodes.filter((n) => n.hasDownstream).length;
  const withFullLineage = nodes.filter((n) => n.hasUpstream && n.hasDownstream).length;
  const orphaned = nodes.filter((n) => !n.hasUpstream && !n.hasDownstream).length;
  
  const coveragePercentage = totalAssets > 0 
    ? Math.round(((totalAssets - orphaned) / totalAssets) * 100)
    : 0;
  
  const avgUpstreamCount = totalAssets > 0
    ? Math.round(nodes.reduce((sum, n) => sum + n.upstreamCount, 0) / totalAssets * 10) / 10
    : 0;
  
  const avgDownstreamCount = totalAssets > 0
    ? Math.round(nodes.reduce((sum, n) => sum + n.downstreamCount, 0) / totalAssets * 10) / 10
    : 0;

  return {
    totalAssets,
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
  const nodeMap = new Map(layoutNodes.map((n) => [n.id, n]));

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

