/**
 * Lineage View Component
 * 
 * Main visualization component for displaying lineage relationships as an interactive graph
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Panel,
  type Node,
  type Edge,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { getLineage } from '../../services/atlan/api';
import { useAssetStore } from '../../stores/assetStore';
import { scoreAssets } from '../../services/scoringService';
import type { AtlanAsset } from '../../services/atlan/types';
import type {
  LineageViewConfig,
  LineageGraph,
  LineageMetrics,
  QualityScores,
  LineageNode as LineageNodeData,
  LineageEdge as LineageEdgeData,
} from '../../types/lineage';
import {
  buildLineageGraph,
  calculateMetrics,
  applyHierarchicalLayout,
  applyRadialLayout,
  findImpactPath,
  findRootCausePath,
} from '../../utils/lineageGraph';
import { LineageConfigPanel } from './LineageConfigPanel';
import { LineageMetricsPanel } from './LineageMetricsPanel';
import LineageNode from './LineageNode';
import LineageEdge from './LineageEdge';
import './LineageView.css';

const nodeTypes = {
  lineageNode: LineageNode,
};

const edgeTypes = {
  lineageEdge: LineageEdge,
};

const DEFAULT_CONFIG: LineageViewConfig = {
  depth: 3,
  direction: 'both',
  viewMode: 'table',
  layout: 'hierarchical',
  filterByType: [],
  filterByConnection: [],
  filterByQuality: {
    enabled: false,
    threshold: 50,
  },
  filterByGovernance: {
    enabled: false,
    showOnlyUncertified: false,
    showOnlyOrphaned: false,
  },
  showCoverage: true,
  showQualityScores: true,
  showFreshness: true,
  showGovernance: true,
  showMetrics: true,
  showEdgeLabels: false,
  impactAnalysisMode: false,
  rootCauseMode: false,
};

export function LineageView() {
  const { selectedAssets } = useAssetStore();
  const [config, setConfig] = useState<LineageViewConfig>(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [graph, setGraph] = useState<LineageGraph | null>(null);
  const [metrics, setMetrics] = useState<LineageMetrics | null>(null);
  const [centerAsset, setCenterAsset] = useState<AtlanAsset | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [reactFlowInstance, setReactFlowInstance] = useState<any>(null);

  // Get center asset (first selected or prompt user)
  useEffect(() => {
    if (selectedAssets.length > 0 && !centerAsset) {
      setCenterAsset(selectedAssets[0]);
    }
  }, [selectedAssets, centerAsset]);

  // Fetch lineage data
  const fetchLineage = useCallback(async () => {
    if (!centerAsset) {
      setError('Please select an asset to view lineage');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Fetch lineage
      const response = await getLineage(
        centerAsset.guid,
        config.direction,
        config.depth
      );

      // Fetch quality scores for all assets in lineage
      const allAssets = Object.values(response.guidEntityMap || {});
      let qualityScoresMap = new Map<string, QualityScores>();
      
      try {
        // Filter to only Table/View assets for scoring (scoring service expects specific types)
        const scorableAssets = allAssets.filter(
          (a) => a.typeName === 'Table' || a.typeName === 'View' || a.typeName === 'MaterializedView'
        );
        const scores = await scoreAssets(scorableAssets as any);
        scores.forEach((profileScores, guid) => {
          // Find standard profile or use first profile
          const standardProfile = profileScores.find(s => s.profileId === 'standard') || profileScores[0];
          if (!standardProfile) return;
          
          // Extract scores from dimensions
          const dimensions = standardProfile.dimensions || [];
          const getDimensionScore = (dim: string) => {
            const dimResult = dimensions.find(d => d.dimension === dim);
            return dimResult ? Math.round(dimResult.score01 * 100) : 0;
          };
          
          qualityScoresMap.set(guid, {
            overall: Math.round(standardProfile.score * 100),
            completeness: getDimensionScore('completeness'),
            accuracy: getDimensionScore('accuracy'),
            timeliness: getDimensionScore('timeliness'),
            consistency: getDimensionScore('consistency'),
            usability: getDimensionScore('usability'),
          });
        });
      } catch (scoreError) {
        console.warn('Failed to fetch quality scores:', scoreError);
        // Continue without quality scores
      }

      // Build graph
      const lineageGraph = buildLineageGraph(
        centerAsset,
        response,
        config.direction,
        qualityScoresMap
      );

      // Apply layout
      let layoutedNodes;
      if (config.layout === 'radial') {
        layoutedNodes = applyRadialLayout(lineageGraph);
      } else {
        layoutedNodes = applyHierarchicalLayout(lineageGraph, config.direction);
      }

      const updatedGraph: LineageGraph = {
        ...lineageGraph,
        nodes: layoutedNodes,
      };

      setGraph(updatedGraph);
      setMetrics(calculateMetrics(updatedGraph));
    } catch (err) {
      console.error('Failed to fetch lineage:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch lineage');
    } finally {
      setLoading(false);
    }
  }, [centerAsset, config.depth, config.direction, config.layout]);

  // Fetch lineage when config or center asset changes
  useEffect(() => {
    if (centerAsset) {
      fetchLineage();
    }
  }, [centerAsset, config.depth, config.direction, config.layout, fetchLineage]);

  // Handle impact analysis
  useEffect(() => {
    if (config.impactAnalysisMode && selectedNodeId && graph) {
      const affectedIds = findImpactPath(graph, selectedNodeId);
      
      // Update node highlight states
      setGraph((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          nodes: prev.nodes.map((node) => ({
            ...node,
            isHighlighted: affectedIds.includes(node.id),
            highlightReason: affectedIds.includes(node.id) ? 'impact' : undefined,
          })),
        };
      });
    } else if (config.rootCauseMode && selectedNodeId && graph) {
      const pathIds = findRootCausePath(graph, selectedNodeId);
      
      setGraph((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          nodes: prev.nodes.map((node) => ({
            ...node,
            isHighlighted: pathIds.includes(node.id),
            highlightReason: pathIds.includes(node.id) ? 'root-cause' : undefined,
          })),
        };
      });
    } else {
      setGraph((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          nodes: prev.nodes.map((node) => ({
            ...node,
            isHighlighted: false,
            highlightReason: undefined,
          })),
        };
      });
    }
  }, [config.impactAnalysisMode, config.rootCauseMode, selectedNodeId, graph]);

  // Convert graph to React Flow nodes and edges with filters applied
  const { nodes, edges } = useMemo(() => {
    if (!graph) return { nodes: [], edges: [] };

    // Apply filters
    let filteredNodes = graph.nodes;
    let filteredEdges = graph.edges;

    // Type filter
    if (config.filterByType.length > 0) {
      filteredNodes = filteredNodes.filter((n) => config.filterByType.includes(n.type));
      const filteredGuids = new Set(filteredNodes.map((n) => n.guid));
      filteredEdges = filteredEdges.filter(
        (e) => filteredGuids.has(e.source) && filteredGuids.has(e.target)
      );
    }

    // Connection filter
    if (config.filterByConnection.length > 0) {
      filteredNodes = filteredNodes.filter((n) => {
        const connectionName = n.data.connectionName || n.data.connectionQualifiedName;
        return connectionName && config.filterByConnection.includes(connectionName);
      });
      const filteredGuids = new Set(filteredNodes.map((n) => n.guid));
      filteredEdges = filteredEdges.filter(
        (e) => filteredGuids.has(e.source) && filteredGuids.has(e.target)
      );
    }

    // Quality filter
    if (config.filterByQuality.enabled) {
      filteredNodes = filteredNodes.filter((n) => {
        const overall = n.qualityScores?.overall || 0;
        return overall < config.filterByQuality.threshold;
      });
      const filteredGuids = new Set(filteredNodes.map((n) => n.guid));
      filteredEdges = filteredEdges.filter(
        (e) => filteredGuids.has(e.source) && filteredGuids.has(e.target)
      );
    }

    // Governance filter
    if (config.filterByGovernance.enabled) {
      filteredNodes = filteredNodes.filter((n) => {
        if (config.filterByGovernance.showOnlyUncertified) {
          return !n.governance?.certificateStatus || n.governance.certificateStatus !== 'VERIFIED';
        }
        if (config.filterByGovernance.showOnlyOrphaned) {
          return !n.hasUpstream && !n.hasDownstream;
        }
        return true;
      });
      const filteredGuids = new Set(filteredNodes.map((n) => n.guid));
      filteredEdges = filteredEdges.filter(
        (e) => filteredGuids.has(e.source) && filteredGuids.has(e.target)
      );
    }

    // Convert to React Flow format
    const rfNodes: Node[] = filteredNodes.map((node) => ({
      id: node.id,
      type: 'lineageNode',
      position: node.position || { x: 0, y: 0 },
      data: node as LineageNodeData & Record<string, unknown>,
      selected: node.id === selectedNodeId,
    }));

    const rfEdges: Edge[] = filteredEdges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      type: 'lineageEdge',
      data: edge as LineageEdgeData & Record<string, unknown>,
      animated: config.showEdgeLabels && !edge.isUpstream,
      selected: false,
    }));

    return { nodes: rfNodes, edges: rfEdges };
  }, [graph, config, selectedNodeId]);

  // Fit view when graph loads
  useEffect(() => {
    if (nodes.length > 0 && reactFlowInstance) {
      setTimeout(() => {
        reactFlowInstance.fitView({ padding: 0.2, duration: 400 });
      }, 100);
    }
  }, [nodes.length, reactFlowInstance]);

  const handleConfigChange = useCallback((newConfig: Partial<LineageViewConfig>) => {
    setConfig((prev) => ({ ...prev, ...newConfig }));
  }, []);

  const handleCenterAssetChange = useCallback((asset: AtlanAsset) => {
    setCenterAsset(asset);
    setSelectedNodeId(null);
  }, []);

  const handleNodeClick = useCallback((_event: React.MouseEvent, node: Node) => {
    setSelectedNodeId(node.id);
  }, []);

  const handlePaneClick = useCallback(() => {
    setSelectedNodeId(null);
  }, []);

  if (!centerAsset) {
    return (
      <div className="lineage-view">
        <div className="lineage-view-empty">
          <h2>Select an Asset</h2>
          <p>Please select an asset from the asset browser to view its lineage.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="lineage-view">
      <LineageConfigPanel
        config={config}
        centerAsset={centerAsset}
        availableAssets={selectedAssets}
        onConfigChange={handleConfigChange}
        onCenterAssetChange={handleCenterAssetChange}
        onRefresh={fetchLineage}
        loading={loading}
      />
      
      <div className="lineage-view-graph">
        {error && (
          <div className="lineage-view-error">
            <p>Error: {error}</p>
            <button onClick={fetchLineage}>Retry</button>
          </div>
        )}
        
        {loading && (
          <div className="lineage-view-loading">
            <div className="spinner" />
            <p>Loading lineage...</p>
          </div>
        )}

        {!loading && !error && graph && (
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            onNodeClick={handleNodeClick}
            onPaneClick={handlePaneClick}
            onInit={setReactFlowInstance}
            fitView
            minZoom={0.1}
            maxZoom={2}
            defaultViewport={{ x: 0, y: 0, zoom: 1 }}
          >
            <Background color="#e5e7eb" gap={20} />
            <Controls position="bottom-right" />
            <MiniMap
              nodeColor={(node) => {
                const data = node.data as any;
                if (data?.guid === centerAsset?.guid) return '#3b82f6';
                if (data?.qualityScores?.overall) {
                  const score = data.qualityScores.overall;
                  if (score < 50) return '#ef4444';
                  if (score < 80) return '#f59e0b';
                  return '#10b981';
                }
                if (data?.hasUpstream && data?.hasDownstream) return '#10b981';
                if (data?.hasUpstream || data?.hasDownstream) return '#f59e0b';
                return '#9ca3af';
              }}
              maskColor="rgba(0, 0, 0, 0.1)"
              position="bottom-left"
            />
            {config.showMetrics && metrics && (
              <Panel position="top-right">
                <LineageMetricsPanel metrics={metrics} />
              </Panel>
            )}
          </ReactFlow>
        )}
      </div>
    </div>
  );
}

