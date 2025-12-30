/**
 * Lineage View Component
 * 
 * Main visualization component for displaying lineage relationships as an interactive graph
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
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
import { useAssetContextStore } from '../../stores/assetContextStore';
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
  const { contextAssets } = useAssetContextStore();
  const [searchParams] = useSearchParams();
  const [config, setConfig] = useState<LineageViewConfig>(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [graph, setGraph] = useState<LineageGraph | null>(null);
  const [metrics, setMetrics] = useState<LineageMetrics | null>(null);
  const [centerAsset, setCenterAsset] = useState<AtlanAsset | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [reactFlowInstance, setReactFlowInstance] = useState<any>(null);
  const [abortController, setAbortController] = useState<AbortController | null>(null);

  // Initialize center asset from URL params or first available asset (only on mount or context change)
  // Use functional update to avoid dependency on centerAsset which causes reset loops
  useEffect(() => {
    const guid = searchParams.get('guid');

    setCenterAsset((current) => {
      // If we have a URL guid, try to find and set that asset
      if (guid && contextAssets.length > 0) {
        const asset = contextAssets.find((a) => a.guid === guid);
        if (asset && asset.guid !== current?.guid) {
          return asset;
        }
      }

      // Only set first asset if we don't have a current selection AND we have assets
      if (!current && contextAssets.length > 0) {
        return contextAssets[0];
      }

      // Keep current selection
      return current;
    });
  }, [searchParams, contextAssets]);

  // Fetch lineage data
  const fetchLineage = useCallback(async () => {
    if (!centerAsset) {
      setError('Please select an asset to view lineage');
      return;
    }

    // Cancel previous request if still pending
    if (abortController) {
      abortController.abort();
    }
    const newAbortController = new AbortController();
    setAbortController(newAbortController);

    setLoading(true);
    setError(null);

    try {
      // Fetch lineage
      const response = await getLineage(
        centerAsset.guid,
        config.direction,
        config.depth
      );

      // Validate response
      if (!response) {
        setError('Invalid response from lineage API');
        return;
      }
      
      // Note: guidEntityMap might be empty if asset has no lineage, but center asset should still be shown
      // We'll create the center node manually if needed

      // Fetch quality scores for all assets in lineage (including center asset)
      const allAssets = Object.values(response.guidEntityMap || {});
      // Ensure center asset is included for scoring
      const assetsToScore = [...allAssets];
      if (!allAssets.find(a => a.guid === centerAsset.guid)) {
        assetsToScore.push(centerAsset);
      }
      
      let qualityScoresMap = new Map<string, QualityScores>();
      
      try {
        // Filter to only Table/View assets for scoring (scoring service expects specific types)
        const scorableAssets = assetsToScore.filter(
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

      // Check if request was aborted
      if (newAbortController.signal.aborted) {
        return;
      }

      setGraph(updatedGraph);
      setMetrics(calculateMetrics(updatedGraph));
    } catch (err) {
      // Don't show error if request was aborted
      if (newAbortController.signal.aborted) {
        return;
      }
      console.error('Failed to fetch lineage:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch lineage');
    } finally {
      if (!newAbortController.signal.aborted) {
        setLoading(false);
      }
    }
    // Note: abortController intentionally excluded from deps to avoid recreating callback
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [centerAsset, config.depth, config.direction, config.layout]);

  // Fetch lineage when config or center asset changes
  useEffect(() => {
    if (centerAsset) {
      fetchLineage();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [centerAsset, config.depth, config.direction, config.layout]);

  // Handle impact analysis - use separate state for highlights to avoid mutating graph
  const [highlightedNodeIds, setHighlightedNodeIds] = useState<Set<string>>(new Set());
  
  useEffect(() => {
    if (config.impactAnalysisMode && selectedNodeId && graph) {
      const affectedIds = findImpactPath(graph, selectedNodeId);
      setHighlightedNodeIds(new Set(affectedIds));
    } else if (config.rootCauseMode && selectedNodeId && graph) {
      const pathIds = findRootCausePath(graph, selectedNodeId);
      setHighlightedNodeIds(new Set(pathIds));
    } else {
      setHighlightedNodeIds(new Set());
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
      data: {
        ...node,
        isHighlighted: highlightedNodeIds.has(node.id),
        highlightReason: highlightedNodeIds.has(node.id) 
          ? (config.impactAnalysisMode ? 'impact' : config.rootCauseMode ? 'root-cause' : undefined)
          : undefined,
      } as LineageNodeData & Record<string, unknown>,
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

    console.log('[LineageView] ReactFlow nodes:', rfNodes.length);
    console.log('[LineageView] ReactFlow edges:', rfEdges.length, rfEdges.map(e => ({ id: e.id, source: e.source, target: e.target })));

    return { nodes: rfNodes, edges: rfEdges };
  }, [graph, config, selectedNodeId, highlightedNodeIds]);

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
        availableAssets={contextAssets}
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
            <defs>
              <linearGradient id="lineage-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="currentColor" stopOpacity="0" />
                <stop offset="50%" stopColor="currentColor" stopOpacity="0.5" />
                <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
              </linearGradient>
            </defs>
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

