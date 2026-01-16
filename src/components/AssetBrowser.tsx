/**
 * Asset Browser Component
 * 
 * Browse and select assets from Atlan for scoring
 * Shows hierarchy: Connections → Databases → Schemas → Tables
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from './shared';
import {
  fetchAssetsForModel,
  searchAssets,
  getAsset,
  isConfigured,
  testConnection,
  type ConnectorInfo,
} from '../services/atlan/api';
// Use unified asset loader for backend-aware data fetching (MDLH or API)
import {
  loadConnectors as unifiedLoadConnectors,
  loadDatabases as unifiedLoadDatabases,
  loadSchemas as unifiedLoadSchemas,
  loadTables as unifiedLoadTables,
} from '../utils/unifiedAssetLoader';
import { useBackendModeStore } from '../stores/backendModeStore';
import { useAssetStore } from '../stores/assetStore';
import { useAssetContextStore } from '../stores/assetContextStore';
import type { AtlanAsset } from '../services/atlan/types';
import { logger } from '../utils/logger';
import { sanitizeError } from '../utils/sanitize';
import { GitBranch, ChevronRight, ChevronDown, Link2, Database, Folder, Table2, GripVertical, Upload, Loader2, Flame, Star, Info, BarChart3 } from 'lucide-react';
import { PopularAssetsSection } from './AssetBrowser/PopularAssetsSection';
import { AssetBrowserControls, type SortOption } from './AssetBrowser/AssetBrowserControls';
import { useAssetInspectorStore } from '../stores/assetInspectorStore';
import {
  calculatePopularityScore,
  isHotAsset,
  isWarmAsset,
  formatQueryCount,
  formatLastAccessed,
  getPopularityDisplay,
} from '../utils/popularityScore';
import './AssetBrowser.css';

interface TreeNode {
  id: string;
  name: string;
  qualifiedName: string;
  type: 'all' | 'connector' | 'database' | 'schema' | 'table';
  connectorName?: string;
  children?: TreeNode[];
  isExpanded?: boolean;
  isLoading?: boolean;
  isLoaded?: boolean;
  asset?: AtlanAsset;
  childCount?: number;
  fullEntity?: any; // Full Atlan entity for schemas/databases
  // Popularity metrics for non-table nodes (databases, schemas)
  popularityScore?: number;
  sourceReadCount?: number;
  sourceReadUserCount?: number;
}

interface AssetBrowserProps {
  searchFilter?: string;
  onAssetsLoaded?: (assets: AtlanAsset[]) => void;
}

export function AssetBrowser({ searchFilter = '', onAssetsLoaded }: AssetBrowserProps) {
  const navigate = useNavigate();
  const { toggleAsset, isSelected, selectedCount, clearAssets, addAsset, selectedAssets } = useAssetStore();
  const { setContext } = useAssetContextStore();
  const { openInspector } = useAssetInspectorStore();
  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connecting' | 'connected' | 'error'>('disconnected');
  const [connectors, setConnectors] = useState<ConnectorInfo[]>([]);
  const [selectedConnector, setSelectedConnector] = useState<string | null>(null);
  const [treeData, setTreeData] = useState<TreeNode[]>([]);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [loadingNodes, setLoadingNodes] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  // Popularity and search features
  const [sortBy, setSortBy] = useState<SortOption>('popularity'); // Default to popularity for large datasets
  const [showPopularOnly, setShowPopularOnly] = useState(false);
  const [hierarchySearchQuery, setHierarchySearchQuery] = useState('');
  const [totalAssetCount, setTotalAssetCount] = useState<number | undefined>();

  const isCheckingConnection = React.useRef(false);
  const hasLoadedConnectors = React.useRef(false);
  const connectionStatusRef = React.useRef(connectionStatus);

  // Get backend mode for reactive updates when Snowflake connects/disconnects
  const { snowflakeStatus, dataBackend, connectionVersion } = useBackendModeStore();

  // Collect all table assets from tree for PopularAssetsSection
  const allTableAssets = useMemo(() => {
    const tables: AtlanAsset[] = [];
    const collectTables = (nodes: TreeNode[]) => {
      for (const node of nodes) {
        if (node.type === 'table' && node.asset) {
          tables.push(node.asset);
        }
        if (node.children) {
          collectTables(node.children);
        }
      }
    };
    collectTables(treeData);
    return tables;
  }, [treeData]);

  // Notify parent when assets are loaded
  useEffect(() => {
    if (onAssetsLoaded && allTableAssets.length > 0) {
      onAssetsLoaded(allTableAssets);
    }
  }, [allTableAssets, onAssetsLoaded]);

  const checkConnection = useCallback(async () => {
    if (!isConfigured()) {
      setConnectionStatus('disconnected');
      setError('Not configured. Connect to Atlan first.');
      return;
    }

    // Don't re-check if already checking or if we've already loaded connectors
    if (isCheckingConnection.current || hasLoadedConnectors.current) {
      return;
    }

    isCheckingConnection.current = true;
    setConnectionStatus('connecting');
    setError(null);

    try {
      const result = await testConnection();
      if (result.connected) {
        setConnectionStatus('connected');
        // Use unified loader to get connectors (auto-routes to MDLH if connected)
        const loaderResult = await unifiedLoadConnectors();
        const connectorList = loaderResult.data;
        logger.debug('Loaded connectors via unified loader', { 
          count: connectorList.length, 
          source: loaderResult.source 
        });
        setConnectors(connectorList);
        hasLoadedConnectors.current = true;
        if (connectorList.length > 0) {
          setSelectedConnector((prev) => prev || connectorList[0].name);
        }
      } else {
        setConnectionStatus('error');
        const sanitizedError = sanitizeError(new Error(result.error || 'Connection failed'));
      setError(sanitizedError);
      }
    } catch (err) {
      logger.error('Connection error', err);
      setConnectionStatus('error');
      const sanitizedError = sanitizeError(err instanceof Error ? err : new Error('Connection failed'));
      setError(sanitizedError);
    } finally {
      isCheckingConnection.current = false;
    }
  }, []);

  // Load connections under an "All Assets" root node
  // Uses unified loader to automatically route to MDLH or Atlan API
  const loadConnections = useCallback(async () => {
    setError(null);
    try {
      logger.debug('Loading connections via unified loader');
      const result = await unifiedLoadConnectors();
      const connectorList = result.data;
      logger.debug('Loaded connectors', { 
        count: connectorList.length, 
        source: result.source,
        fallbackUsed: result.fallbackUsed 
      });

      // Calculate total asset count across all connectors
      const totalCount = connectorList.reduce((sum, c) => sum + c.assetCount, 0);
      setTotalAssetCount(totalCount);

      // Smart default: auto-enable popular filter for large datasets (>10k assets)
      if (totalCount > 10000 && !showPopularOnly) {
        logger.info('Large dataset detected, enabling popular filter by default', { totalCount });
        // Note: We don't auto-enable to avoid confusion, but we sort by popularity
      }

      const connectionNodes: TreeNode[] = connectorList.map((connector) => ({
        id: `connector-${connector.name}`,
        name: connector.name,
        qualifiedName: connector.name,
        type: 'connector',
        connectorName: connector.name,
        children: [],
        isLoaded: false,
        childCount: connector.assetCount,
        fullEntity: connector.fullEntity,
      }));

      // Create the "All Assets" root node with connections as children
      const allAssetsNode: TreeNode = {
        id: 'all-assets',
        name: 'All Assets',
        qualifiedName: 'all',
        type: 'all',
        children: connectionNodes,
        isLoaded: true,
        childCount: totalCount,
      };

      setTreeData([allAssetsNode]);
      // Auto-expand the "All Assets" node
      setExpandedNodes((prev) => new Set(prev).add('all-assets'));
    } catch (err) {
      logger.error('Failed to load connections', err);
      const sanitizedError = sanitizeError(err instanceof Error ? err : new Error('Failed to load connections'));
      setError(sanitizedError);
    }
  }, [showPopularOnly]);

  const loadDatabasesForConnector = useCallback(async (connector: string, parentNodeId: string) => {
    setLoadingNodes((prev) => new Set(prev).add(parentNodeId));
    setError(null);

    try {
      logger.debug('Loading databases for connector via unified loader', { connector, popularOnly: showPopularOnly });
      // Use unified loader for backend-aware database fetching
      const result = await unifiedLoadDatabases(connector);
      const databases = result.data;
      logger.debug('Loaded databases', { 
        connector, 
        count: databases.length,
        source: result.source,
        fallbackUsed: result.fallbackUsed
      });
      const dbNodes: TreeNode[] = databases.map((db) => ({
        id: `db-${db.qualifiedName}`,
        name: db.name,
        qualifiedName: db.qualifiedName,
        type: 'database',
        connectorName: connector,
        children: [],
        isLoaded: false,
        childCount: db.childCount,
        fullEntity: db.fullEntity, // Store full entity with metadata
        // Extract popularity metrics from fullEntity if available
        popularityScore: db.fullEntity?.attributes?.popularityScore,
        sourceReadCount: db.fullEntity?.attributes?.sourceReadCount,
        sourceReadUserCount: db.fullEntity?.attributes?.sourceReadUserCount,
      }));

      // Update tree - navigate through All Assets node if present
      setTreeData((prev) =>
        prev.map((allNode) => {
          if (allNode.type === 'all' && allNode.children) {
            return {
              ...allNode,
              children: allNode.children.map((connectorNode) =>
                connectorNode.id === parentNodeId
                  ? { ...connectorNode, children: dbNodes, isLoaded: true }
                  : connectorNode
              ),
            };
          }
          // Fallback for direct connector nodes (if not using All Assets wrapper)
          if (allNode.id === parentNodeId) {
            return { ...allNode, children: dbNodes, isLoaded: true };
          }
          return allNode;
        })
      );
    } catch (err) {
      logger.error('Failed to load databases', err, { connector });
      const sanitizedError = sanitizeError(err instanceof Error ? err : new Error('Failed to load databases'));
      setError(sanitizedError);
    } finally {
      setLoadingNodes((prev) => {
        const next = new Set(prev);
        next.delete(parentNodeId);
        return next;
      });
    }
  }, [showPopularOnly, sortBy]);

  // Check connection on mount and automatically when configuration becomes available
  useEffect(() => {
    const check = () => {
      if (isConfigured()) {
        checkConnection();
      } else {
        setConnectionStatus('disconnected');
      }
    };
    
    // Check immediately
    check();
    
    // Update ref to avoid stale closure
    connectionStatusRef.current = connectionStatus;
    
    // Listen for custom event when AtlanHeader establishes connection
    const handleAtlanConnected = () => {
      logger.debug('Atlan connection established, checking...');
      check();
    };
    
    window.addEventListener('atlan-connected', handleAtlanConnected);
    
    // Also check periodically in case connection is established (fallback)
    // But only if we're not already connected or connecting
    const interval = setInterval(() => {
      if (isConfigured() && connectionStatusRef.current === 'disconnected') {
        logger.debug('Detected configuration, checking connection...');
        check();
      }
    }, 3000); // Check every 3 seconds (less frequent to reduce load)
    
    return () => {
      window.removeEventListener('atlan-connected', handleAtlanConnected);
      clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connectionStatus]); // Include connectionStatus to stop checking once connected

  // Update ref whenever connectionStatus changes
  useEffect(() => {
    connectionStatusRef.current = connectionStatus;
  }, [connectionStatus]);

  // Load connections when connected
  useEffect(() => {
    if (connectionStatus === 'connected' && connectors.length > 0 && treeData.length === 0) {
      loadConnections();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connectionStatus, connectors.length]);

  // Reload tree when Snowflake connection status changes (backend switch)
  // This ensures the asset browser uses MDLH data when connected to Snowflake
  useEffect(() => {
    if (connectionStatus === 'connected') {
      logger.info('[AssetBrowser] Backend connection changed, reloading tree', {
        dataBackend,
        snowflakeConnected: snowflakeStatus.connected,
        connectionVersion,
      });
      // Clear tree and reload from the appropriate backend
      setTreeData([]);
      setExpandedNodes(new Set());
      hasLoadedConnectors.current = false;
      loadConnections();
    }
    // Only react to connectionVersion changes (not every snowflakeStatus change)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connectionVersion]);

  const loadSchemasForDatabase = useCallback(async (dbNode: TreeNode) => {
    if (dbNode.isLoaded || !dbNode.qualifiedName) return;

    setLoadingNodes((prev) => new Set(prev).add(dbNode.id));
    setError(null);

    try {
      // Use unified loader for backend-aware schema fetching
      // Extract database name from qualified name (format: connector/database or just database)
      const dbName = dbNode.name;
      const connectorName = dbNode.connectorName || '';
      
      logger.debug('Loading schemas via unified loader', { connectorName, dbName, qualifiedName: dbNode.qualifiedName });
      const result = await unifiedLoadSchemas(connectorName, dbNode.qualifiedName, dbName);
      const schemas = result.data;
      
      logger.debug('Loaded schemas', { 
        database: dbName, 
        count: schemas.length,
        source: result.source,
        fallbackUsed: result.fallbackUsed
      });
      
      const schemaNodes: TreeNode[] = schemas.map((schema) => ({
        id: `schema-${schema.qualifiedName}`,
        name: schema.name,
        qualifiedName: schema.qualifiedName,
        type: 'schema',
        connectorName: dbNode.connectorName,
        children: [],
        isLoaded: false,
        childCount: schema.childCount,
        fullEntity: schema.fullEntity, // Store full entity with metadata
        // Extract popularity metrics from fullEntity if available
        popularityScore: schema.fullEntity?.attributes?.popularityScore,
        sourceReadCount: schema.fullEntity?.attributes?.sourceReadCount,
        sourceReadUserCount: schema.fullEntity?.attributes?.sourceReadUserCount,
      }));

      // Recursively update the database node within the tree (All Assets → Connector → Database)
      setTreeData((prev) =>
        prev.map((allNode) => {
          if (allNode.type === 'all' && allNode.children) {
            return {
              ...allNode,
              children: allNode.children.map((connector) => {
                if (connector.children) {
                  return {
                    ...connector,
                    children: connector.children.map((db) =>
                      db.id === dbNode.id ? { ...db, children: schemaNodes, isLoaded: true } : db
                    ),
                  };
                }
                return connector;
              }),
            };
          }
          // Fallback for non-wrapped structure
          if (allNode.children) {
            return {
              ...allNode,
              children: allNode.children.map((db) =>
                db.id === dbNode.id ? { ...db, children: schemaNodes, isLoaded: true } : db
              ),
            };
          }
          return allNode;
        })
      );
    } catch (err) {
      const sanitizedError = sanitizeError(err instanceof Error ? err : new Error('Failed to load schemas'));
      setError(sanitizedError);
    } finally {
      setLoadingNodes((prev) => {
        const next = new Set(prev);
        next.delete(dbNode.id);
        return next;
      });
    }
  }, [showPopularOnly, sortBy]);

  const loadTablesForSchema = useCallback(async (dbNode: TreeNode, schemaNode: TreeNode) => {
    if (schemaNode.isLoaded) return;

    setLoadingNodes((prev) => new Set(prev).add(schemaNode.id));
    setError(null);

    // Use larger limit for schemas with many tables
    // For very large schemas (1000+), we still limit to keep UI responsive
    const TABLE_LOAD_LIMIT = 1000;

    try {
      // Use unified loader for backend-aware table fetching
      const connectorName = schemaNode.connectorName || '';
      const dbName = dbNode.name;
      const schemaName = schemaNode.name;
      
      logger.debug('Loading tables via unified loader', { connectorName, dbName, schemaName, qualifiedName: schemaNode.qualifiedName });
      const result = await unifiedLoadTables(connectorName, dbName, schemaNode.qualifiedName, schemaName);
      const tablesFromLoader = result.data;
      
      logger.debug('Loaded tables', { 
        schema: schemaName, 
        count: tablesFromLoader.length,
        source: result.source,
        fallbackUsed: result.fallbackUsed
      });
      
      // Transform hierarchy items to tree nodes with full entity if available
      const tableNodes: TreeNode[] = tablesFromLoader.map((table) => ({
        id: `table-${table.qualifiedName}`,
        name: table.name,
        qualifiedName: table.qualifiedName,
        type: 'table' as const,
        connectorName: schemaNode.connectorName,
        children: [],
        isLoaded: true,
        // Convert HierarchyItem to AtlanAsset format if fullEntity is available
        asset: table.fullEntity ? {
          guid: table.guid,
          typeName: table.typeName,
          name: table.name,
          qualifiedName: table.qualifiedName,
          connectionName: table.fullEntity?.attributes?.connectionName || connectorName,
          description: table.fullEntity?.attributes?.description,
          ownerUsers: table.fullEntity?.attributes?.ownerUsers,
          certificateStatus: table.fullEntity?.attributes?.certificateStatus,
          classificationNames: table.fullEntity?.attributes?.classificationNames,
          popularityScore: table.popularityScore,
          updateTime: table.fullEntity?.attributes?.updateTime,
          __hasLineage: table.fullEntity?.attributes?.__hasLineage,
        } as AtlanAsset : {
          guid: table.guid,
          typeName: table.typeName,
          name: table.name,
          qualifiedName: table.qualifiedName,
          connectionName: connectorName,
          popularityScore: table.popularityScore,
        } as AtlanAsset,
      }));

      // Track if there are more tables than we loaded
      const hasMoreTables = schemaNode.childCount
        ? tableNodes.length < schemaNode.childCount
        : tablesFromLoader.length >= TABLE_LOAD_LIMIT;

      if (hasMoreTables) {
        logger.info('Schema has more tables than loaded', {
          schema: schemaNode.name,
          loaded: tableNodes.length,
          total: schemaNode.childCount || 'unknown',
        });
      }

      // Helper to update schema within a database
      const updateDbSchemas = (db: TreeNode) =>
        db.id === dbNode.id
          ? {
              ...db,
              children: db.children?.map((schema) =>
                schema.id === schemaNode.id
                  ? {
                      ...schema,
                      children: tableNodes,
                      isLoaded: true,
                      // Update childCount to reflect actual loaded count if we hit limit
                      childCount: hasMoreTables ? schemaNode.childCount : tableNodes.length,
                    }
                  : schema
              ),
            }
          : db;

      // Recursively update: All Assets → Connector → Database → Schema
      setTreeData((prev) =>
        prev.map((allNode) => {
          if (allNode.type === 'all' && allNode.children) {
            return {
              ...allNode,
              children: allNode.children.map((connector) => {
                if (connector.children) {
                  return {
                    ...connector,
                    children: connector.children.map(updateDbSchemas),
                  };
                }
                return connector;
              }),
            };
          }
          // Fallback for non-wrapped structure
          if (allNode.children) {
            return {
              ...allNode,
              children: allNode.children.map(updateDbSchemas),
            };
          }
          return allNode;
        })
      );
    } catch (err) {
      const sanitizedError = sanitizeError(err instanceof Error ? err : new Error('Failed to load tables'));
      setError(sanitizedError);
    } finally {
      setLoadingNodes((prev) => {
        const next = new Set(prev);
        next.delete(schemaNode.id);
        return next;
      });
    }
  }, []);

  const toggleNode = useCallback(
    (node: TreeNode, parent?: TreeNode) => {
      if (node.type === 'table' && node.asset) {
        // Toggle selection for tables
        toggleAsset(node.asset);
      } else {
        // Expand/collapse for other nodes
        const isExpanded = expandedNodes.has(node.id);
        setExpandedNodes((prev) => {
          const next = new Set(prev);
          if (isExpanded) {
            next.delete(node.id);
          } else {
            next.add(node.id);
            // Load children when expanding
            if (node.type === 'connector' && !node.isLoaded) {
              loadDatabasesForConnector(node.connectorName || node.name, node.id);
            } else if (node.type === 'database' && !node.isLoaded) {
              loadSchemasForDatabase(node);
            } else if (node.type === 'schema' && !node.isLoaded && parent) {
              loadTablesForSchema(parent, node);
            }
          }
          return next;
        });
      }
    },
    [expandedNodes, toggleAsset, loadDatabasesForConnector, loadSchemasForDatabase, loadTablesForSchema]
  );

  // Handler for "Analyze Selected" button
  const handleAnalyzeSelected = useCallback(() => {
    if (selectedCount === 0) return;

    setContext(
      'manual',
      {},
      `${selectedCount} selected asset${selectedCount !== 1 ? 's' : ''}`,
      selectedAssets
    );

    navigate('/pivot');
  }, [selectedCount, selectedAssets, setContext, navigate]);

  // Collect all tables recursively from a node (synchronous - only from loaded tree)
  const collectAllTables = useCallback((node: TreeNode): AtlanAsset[] => {
    const tables: AtlanAsset[] = [];
    
    // If this is a table node with an asset, add it
    if (node.type === 'table' && node.asset) {
      tables.push(node.asset);
    }
    
    // Recursively collect from children (only if they're loaded)
    if (node.children) {
      for (const child of node.children) {
        tables.push(...collectAllTables(child));
      }
    }
    
    return tables;
  }, []);

  const handleDragStart = (e: React.DragEvent, node: TreeNode) => {
    e.stopPropagation();
    e.dataTransfer.effectAllowed = 'copy';

    let assets: AtlanAsset[] = [];

    // Helper to find a node by ID in the tree
    const findNode = (nodes: TreeNode[], id: string): TreeNode | null => {
      for (const n of nodes) {
        if (n.id === id) return n;
        if (n.children) {
          const found = findNode(n.children, id);
          if (found) return found;
        }
      }
      return null;
    };

    if (node.type === 'table' && node.asset) {
      // Single table
      assets = [node.asset];
    } else if (node.type === 'schema') {
      // All tables in this schema (from loaded children)
      assets = collectAllTables(node);
    } else if (node.type === 'database') {
      // All tables in all schemas (from loaded children)
      assets = collectAllTables(node);
    } else if (node.type === 'connector') {
      // All tables in all databases for this connector (from loaded tree)
      const connectorNode = findNode(treeData, node.id);
      if (connectorNode) {
        assets.push(...collectAllTables(connectorNode));
      }
    } else if (node.type === 'all') {
      // All tables from all connectors (entire data estate)
      const allNode = findNode(treeData, node.id);
      if (allNode) {
        assets.push(...collectAllTables(allNode));
      }
    }
    
    if (assets.length > 0) {
      e.dataTransfer.setData('application/json', JSON.stringify({ 
        type: 'atlan-assets', 
        assets,
        nodeType: node.type,
        nodeName: node.name
      }));
      e.dataTransfer.setData('text/plain', `${node.name} (${assets.length} table${assets.length !== 1 ? 's' : ''})`);
    } else {
      // If no assets found, it might be because children aren't loaded yet
      // We'll still allow the drag, but show a message
      e.dataTransfer.setData('application/json', JSON.stringify({ 
        type: 'atlan-node',
        nodeType: node.type,
        nodeName: node.name,
        nodeId: node.id,
        qualifiedName: node.qualifiedName,
        connectorName: node.connectorName || selectedConnector
      }));
      e.dataTransfer.setData('text/plain', `${node.name} (expand to load tables)`);
    }
    
    const target = e.currentTarget as HTMLElement;
    target.classList.add('dragging');
  };

  const handleDragEnd = (e: React.DragEvent) => {
    const target = e.currentTarget as HTMLElement;
    target.classList.remove('dragging');
  };

  // Helper to calculate popularity score for a node (database, schema, or table)
  const getNodePopularityScore = useCallback((node: TreeNode): number => {
    if (node.type === 'table' && node.asset) {
      return calculatePopularityScore(node.asset);
    }
    // For databases and schemas, use their own popularity metrics
    if (node.popularityScore !== undefined || node.sourceReadCount !== undefined) {
      const atlanScore = (node.popularityScore ?? 0) * 0.4;
      const queryScore = Math.min(((node.sourceReadCount ?? 0) / 1000), 1) * 0.3;
      const userScore = Math.min(((node.sourceReadUserCount ?? 0) / 10), 1) * 0.2;
      return Math.min(atlanScore + queryScore + userScore, 1);
    }
    return 0;
  }, []);

  // Helper to check if a node is "hot" (highly popular)
  const isNodeHot = useCallback((node: TreeNode): boolean => {
    if (node.type === 'table' && node.asset) {
      return isHotAsset(node.asset);
    }
    return getNodePopularityScore(node) > 0.7;
  }, [getNodePopularityScore]);

  // Helper to check if a node is "warm" (moderately popular)
  const isNodeWarm = useCallback((node: TreeNode): boolean => {
    if (node.type === 'table' && node.asset) {
      return isWarmAsset(node.asset);
    }
    const score = getNodePopularityScore(node);
    return score > 0.5 && score <= 0.7;
  }, [getNodePopularityScore]);

  // Helper to sort tree nodes
  const sortNodes = useCallback((nodes: TreeNode[]): TreeNode[] => {
    return [...nodes].sort((a, b) => {
      if (sortBy === 'name') {
        return a.name.localeCompare(b.name);
      } else if (sortBy === 'popularity') {
        // Sort by popularity score for all node types
        return getNodePopularityScore(b) - getNodePopularityScore(a);
      } else if (sortBy === 'recent') {
        // For tables, use asset's last read time; for others, use 0
        const aTime = a.asset?.sourceLastReadAt ?? 0;
        const bTime = b.asset?.sourceLastReadAt ?? 0;
        return bTime - aTime;
      }
      return 0;
    });
  }, [sortBy, getNodePopularityScore]);

  // Helper to filter nodes by popularity
  const filterNodesByPopularity = useCallback((nodes: TreeNode[]): TreeNode[] => {
    if (!showPopularOnly) return nodes;
    return nodes.filter((node) => {
      // Always show 'all' node
      if (node.type === 'all') return true;

      // Check if this node itself is popular (databases, schemas, tables)
      if (isNodeHot(node) || isNodeWarm(node)) {
        return true;
      }

      // For non-table nodes, also check if they have popular children (recursive)
      if (node.children && node.children.length > 0) {
        const hasPopularDescendants = (children: TreeNode[]): boolean => {
          return children.some((child) => {
            if (isNodeHot(child) || isNodeWarm(child)) return true;
            if (child.children) return hasPopularDescendants(child.children);
            return false;
          });
        };
        return hasPopularDescendants(node.children);
      }

      // Keep connectors by default (they contain assets)
      if (node.type === 'connector') return true;

      return false;
    });
  }, [showPopularOnly, isNodeHot, isNodeWarm]);

  const renderTreeNode = (node: TreeNode, level: number = 0, parent?: TreeNode) => {
    const isExpanded = expandedNodes.has(node.id);
    const isLoading = loadingNodes.has(node.id);
    const selected = node.asset ? isSelected(node.asset.guid) : false;
    // All node types are draggable (connector, database, schema, table)
    const isDraggable = true;

    return (
      <div key={node.id} className="tree-node">
        <div
          className={`tree-node-content ${selected ? 'selected' : ''} ${node.type === 'table' ? 'table-node' : ''} ${isDraggable ? 'draggable' : ''}`}
          style={{ paddingLeft: `${level * 16 + 8}px` }}
          draggable={isDraggable}
          onDragStart={(e) => handleDragStart(e, node)}
          onDragEnd={handleDragEnd}
          onClick={(e) => {
            // Don't toggle selection on click for tables - use checkbox instead
            // This allows drag to work properly
            if (node.type === 'table') {
              e.stopPropagation();
            } else {
              // For other nodes, clicking toggles expansion
              toggleNode(node, parent);
            }
          }}
        >
          {node.type !== 'table' && (
            <span className="tree-toggle" onClick={(e) => { e.stopPropagation(); toggleNode(node, parent); }}>
              {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </span>
          )}
          {node.type === 'table' && (
            <>
              <input
                type="checkbox"
                checked={selected}
                onChange={(e) => {
                  e.stopPropagation();
                  if (node.asset) toggleAsset(node.asset);
                }}
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
                className="tree-checkbox"
              />
              <span 
                className="drag-handle" 
                title="Drag to Scorecard to add for scoring"
                onMouseDown={(e) => e.stopPropagation()} // Prevent selection when starting drag from handle
              >⋮⋮</span>
            </>
          )}
          <span className="tree-icon">
            {node.type === 'all' && '🌐'}
            {node.type === 'connector' && '🔗'}
            {node.type === 'database' && '🗄️'}
            {node.type === 'schema' && '📁'}
            {node.type === 'table' && '📊'}
          </span>
          <span
            className={`tree-name ${
              isNodeHot(node) ? 'popular-hot' : isNodeWarm(node) ? 'popular-warm' : ''
            } clickable`}
            onClick={async (e) => {
              e.stopPropagation();

              // Open inspector for any node type that has metadata
              if (node.type === 'table' && node.asset) {
                openInspector(node.asset);
              } else if (node.type === 'connector' || node.type === 'database' || node.type === 'schema') {
                // Use fullEntity if available (from tree loading)
                if (node.fullEntity) {
                  const e = node.fullEntity;
                  const fullAsset: AtlanAsset = {
                    guid: e.guid,
                    typeName: e.typeName,
                    name: e.attributes?.name || node.name,
                    qualifiedName: e.attributes?.qualifiedName || node.qualifiedName,
                    connectionName: e.attributes?.connectionName || node.connectorName,
                    // Governance
                    description: e.attributes?.description,
                    userDescription: e.attributes?.userDescription,
                    ownerUsers: e.attributes?.ownerUsers,
                    ownerGroups: e.attributes?.ownerGroups,
                    certificateStatus: e.attributes?.certificateStatus,
                    certificateStatusMessage: e.attributes?.certificateStatusMessage,
                    certificateUpdatedAt: e.attributes?.certificateUpdatedAt,
                    certificateUpdatedBy: e.attributes?.certificateUpdatedBy,
                    classificationNames: e.attributes?.classificationNames,
                    atlanTags: e.classifications?.map((tag: any) => ({
                      typeName: tag.typeName,
                      propagate: tag.propagate,
                      restrictPropagationThroughLineage: tag.restrictPropagationThroughLineage,
                      restrictPropagationThroughHierarchy: tag.restrictPropagationThroughHierarchy,
                    })),
                    meanings: e.attributes?.meanings,
                    assignedTerms: e.attributes?.assignedTerms,
                    domainGUIDs: e.attributes?.domainGUIDs,
                    // Technical
                    schemaCount: e.attributes?.schemaCount,
                    tableCount: e.attributes?.tableCount,
                    createTime: e.attributes?.createTime,
                    updateTime: e.attributes?.updateTime,
                    createdBy: e.attributes?.createdBy,
                    updatedBy: e.attributes?.updatedBy,
                    isDiscoverable: e.attributes?.isDiscoverable,
                    isEditable: e.attributes?.isEditable,
                    isAIGenerated: e.attributes?.isAIGenerated,
                  };
                  openInspector(fullAsset);
                } else {
                  // Fallback to minimal data - node doesn't have full entity metadata
                  const typeName = node.type === 'connector' ? 'Connection' : node.type === 'database' ? 'Database' : 'Schema';
                  const partialAsset: any = {
                    guid: node.id,
                    name: node.name,
                    qualifiedName: node.qualifiedName,
                    typeName,
                    connectionName: node.connectorName,
                  };
                  openInspector(partialAsset as AtlanAsset);
                }
              }
            }}
            title={
              node.type === 'table' && node.asset
                ? `Click to view details\n\n${node.qualifiedName}\n📊 Popularity: ${getPopularityDisplay(node.asset)}/10\n${formatQueryCount(node.asset.sourceReadCount)} queries${node.asset.sourceReadUserCount ? ` by ${node.asset.sourceReadUserCount} users` : ''}\nLast accessed: ${formatLastAccessed(node.asset.sourceLastReadAt)}`
                : (node.type === 'database' || node.type === 'schema') && (node.sourceReadCount || node.popularityScore)
                ? `Click to view details\n\n${node.qualifiedName}\n📊 Popularity: ${Math.round(getNodePopularityScore(node) * 10)}/10\n${formatQueryCount(node.sourceReadCount)} queries${node.sourceReadUserCount ? ` by ${node.sourceReadUserCount} users` : ''}`
                : `Click to view details\n\n${node.qualifiedName}`
            }
          >
            {node.name}
          </span>
          {/* Show popularity badges for databases, schemas, and tables */}
          {node.type !== 'all' && node.type !== 'connector' && isNodeHot(node) && (
            <span className="popularity-badge hot" title={`Highly popular ${node.type}`}>
              <Flame size={12} /> Hot
            </span>
          )}
          {node.type !== 'all' && node.type !== 'connector' && isNodeWarm(node) && (
            <span className="popularity-badge warm" title={`Popular ${node.type}`}>
              <Star size={12} />
            </span>
          )}
          {node.childCount !== undefined && node.childCount > 0 && (
            <span className="tree-count">{node.childCount}</span>
          )}
          {node.type === 'table' && node.asset && (
            <button
              className="tree-lineage-btn"
              onClick={(e) => {
                e.stopPropagation();
                if (node.asset) {
                  addAsset(node.asset);
                  navigate(`/lineage?guid=${node.asset.guid}`);
                }
              }}
              title="View Lineage"
            >
              <GitBranch size={12} />
            </button>
          )}
          {isLoading && <Loader2 size={14} className="tree-loading spinning" />}
          {isDraggable && node.type !== 'table' && (
            <span className="drag-hint" title={`Drag to select all tables under ${node.name}`}>
              <Upload size={14} />
            </span>
          )}
        </div>
        {isExpanded && node.children && node.children.length > 0 && (
          <div className="tree-children">
            {sortNodes(filterNodesByPopularity(node.children)).map((child) =>
              renderTreeNode(child, level + 1, node)
            )}
          </div>
        )}
      </div>
    );
  };

  // Show connection prompt if not configured
  if (!isConfigured()) {
    return (
      <Card className="asset-browser" title="Asset Browser">
        <div className="browser-empty-state">
          <div className="empty-icon">🔌</div>
          <h3>Connect to Atlan</h3>
          <p>Click the <strong>"Connect to Atlan"</strong> button in the top right corner to get started.</p>
          <p className="empty-hint">Once connected, you can browse your data assets and select them for quality scoring.</p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="asset-browser" title="Asset Browser">
      <div className="asset-browser-header">
        {connectionStatus === 'connected' && connectors.length > 0 ? (
          <>
            <div className="browser-controls">
              <label htmlFor="connector-select" className="control-label">Filter by Connection:</label>
              <select
                id="connector-select"
                value={selectedConnector || ''}
                onChange={(e) => setSelectedConnector(e.target.value || null)}
                className="connector-select"
                draggable={false}
              >
                <option value="">All Connections</option>
                {connectors.map((connector) => (
                  <option key={connector.id} value={connector.name}>
                    {connector.name} ({connector.assetCount.toLocaleString()} assets)
                  </option>
                ))}
              </select>
            </div>
            <div className="selected-info">
              <span className="selected-count">
                <strong>{selectedCount}</strong> asset{selectedCount !== 1 ? 's' : ''} selected
              </span>
              {selectedCount > 0 && (
                <>
                  <button onClick={handleAnalyzeSelected} className="analyze-btn" title="Analyze selected assets in Pivot Builder">
                    <BarChart3 size={14} />
                    Analyze Selected
                  </button>
                  <button onClick={clearAssets} className="clear-btn" title="Clear all selections">
                    Clear All
                  </button>
                </>
              )}
            </div>
          </>
        ) : null}
      </div>

      {error && (
        <div className="browser-error">
          <span className="error-icon">⚠️</span>
          <span>{error}</span>
        </div>
      )}

      {connectionStatus === 'connected' && treeData.length > 0 && (
        <AssetBrowserControls
          sortBy={sortBy}
          onSortChange={setSortBy}
          showPopularOnly={showPopularOnly}
          onShowPopularOnlyChange={setShowPopularOnly}
          searchQuery={hierarchySearchQuery}
          onSearchChange={setHierarchySearchQuery}
          totalCount={totalAssetCount}
          displayedCount={allTableAssets.length}
        />
      )}

      <div className="tree-container">
        {connectionStatus === 'disconnected' && (
          <div className="tree-empty">
            <div className="empty-icon">🔌</div>
            <p>
              {isConfigured() 
                ? 'Click "Check Connection" above to verify your Atlan connection'
                : 'Connect to Atlan using the button in the top right corner, then click "Check Connection" here'}
            </p>
          </div>
        )}
        {connectionStatus === 'connecting' && (
          <div className="tree-empty">
            <div className="tree-loading-spinner">⏳</div>
            <p>Connecting to Atlan...</p>
          </div>
        )}
        {connectionStatus === 'connected' && treeData.length === 0 && !loadingNodes.size && (
          <div className="tree-empty">
            <div className="empty-icon">📂</div>
            <p>No connections found</p>
            <p className="empty-hint">Check your Atlan permissions or try refreshing.</p>
          </div>
        )}
        {treeData.length > 0 && (
          <div className="tree-list">
            <PopularAssetsSection
              assets={allTableAssets}
              onAssetClick={(asset) => toggleAsset(asset)}
              onAssetDragStart={(e, asset) => {
                e.dataTransfer.effectAllowed = 'copy';
                e.dataTransfer.setData('application/json', JSON.stringify({
                  type: 'atlan-assets',
                  assets: [asset],
                  nodeType: 'table',
                  nodeName: asset.name
                }));
              }}
              selectedConnector={selectedConnector}
            />
            {sortNodes(filterNodesByPopularity(
              treeData.map((node) => {
                // Combine external searchFilter prop with internal hierarchySearchQuery
                const activeSearch = hierarchySearchQuery || searchFilter || '';
                const hasSearch = activeSearch.length > 0;

                // Helper to check if a node matches search
                const matchesSearch = (n: TreeNode): boolean => {
                  if (!hasSearch) return true;
                  const term = activeSearch.toLowerCase();
                  if (n.name.toLowerCase().includes(term)) return true;
                  if (n.children?.some(matchesSearch)) return true;
                  return false;
                };

                // For "All Assets" node, filter its children by selected connector and search
                if (node.type === 'all' && node.children) {
                  const filteredChildren = node.children
                    .filter((child) => !selectedConnector || child.connectorName === selectedConnector || child.name === selectedConnector)
                    .filter((child) => matchesSearch(child));
                  return { ...node, children: filteredChildren };
                }
                // Fallback for non-wrapped structures
                if (!selectedConnector || node.connectorName === selectedConnector || node.name === selectedConnector) {
                  if (matchesSearch(node)) return node;
                }
                return null;
              }).filter((node): node is TreeNode => node !== null)
            )).map((node) => renderTreeNode(node))}
          </div>
        )}
      </div>
    </Card>
  );
}

