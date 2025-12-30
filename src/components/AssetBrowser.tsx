/**
 * Asset Browser Component
 * 
 * Browse and select assets from Atlan for scoring
 * Shows hierarchy: Connections → Databases → Schemas → Tables
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from './shared';
import {
  getConnectors,
  getDatabases,
  getSchemas,
  fetchAssetsForModel,
  isConfigured,
  testConnection,
  type ConnectorInfo,
} from '../services/atlan/api';
import { useAssetStore } from '../stores/assetStore';
import type { AtlanAsset } from '../services/atlan/types';
import { logger } from '../utils/logger';
import { GitBranch, ChevronRight, ChevronDown, Link2, Database, Folder, Table2, GripVertical, Upload, Loader2 } from 'lucide-react';
import './AssetBrowser.css';

interface TreeNode {
  id: string;
  name: string;
  qualifiedName: string;
  type: 'connector' | 'database' | 'schema' | 'table';
  connectorName?: string;
  children?: TreeNode[];
  isExpanded?: boolean;
  isLoading?: boolean;
  isLoaded?: boolean;
  asset?: AtlanAsset;
  childCount?: number;
}

export function AssetBrowser() {
  const navigate = useNavigate();
  const { selectedAssets, toggleAsset, isSelected, selectedCount, clearAssets, addAsset } = useAssetStore();
  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connecting' | 'connected' | 'error'>('disconnected');
  const [connectors, setConnectors] = useState<ConnectorInfo[]>([]);
  const [selectedConnector, setSelectedConnector] = useState<string | null>(null);
  const [treeData, setTreeData] = useState<TreeNode[]>([]);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [loadingNodes, setLoadingNodes] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const isCheckingConnection = React.useRef(false);
  const hasLoadedConnectors = React.useRef(false);
  
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
        const connectorList = await getConnectors();
        logger.debug('Loaded connectors', { count: connectorList.length });
        setConnectors(connectorList);
        hasLoadedConnectors.current = true;
        if (connectorList.length > 0) {
          setSelectedConnector((prev) => prev || connectorList[0].name);
        }
      } else {
        setConnectionStatus('error');
        setError(result.error || 'Connection failed');
      }
    } catch (err) {
      logger.error('Connection error', err);
      setConnectionStatus('error');
      setError(err instanceof Error ? err.message : 'Connection failed');
    } finally {
      isCheckingConnection.current = false;
    }
  }, []);

  // Load connections as top-level nodes
  const loadConnections = useCallback(async () => {
    setError(null);
    try {
      logger.debug('Loading connections');
      const connectorList = await getConnectors();
      logger.debug('Loaded connectors', { count: connectorList.length });
      
      const connectionNodes: TreeNode[] = connectorList.map((connector) => ({
        id: `connector-${connector.name}`,
        name: connector.name,
        qualifiedName: connector.name,
        type: 'connector',
        connectorName: connector.name,
        children: [],
        isLoaded: false,
        childCount: connector.assetCount,
      }));

      setTreeData(connectionNodes);
    } catch (err) {
      logger.error('Failed to load connections', err);
      setError(err instanceof Error ? err.message : 'Failed to load connections');
    }
  }, []);

  const loadDatabases = useCallback(async (connector: string, parentNodeId: string) => {
    setLoadingNodes((prev) => new Set(prev).add(parentNodeId));
    setError(null);

    try {
      logger.debug('Loading databases for connector', { connector });
      const databases = await getDatabases(connector);
      logger.debug('Loaded databases', { connector, count: databases.length });
      const dbNodes: TreeNode[] = databases.map((db) => ({
        id: `db-${db.qualifiedName}`,
        name: db.name,
        qualifiedName: db.qualifiedName,
        type: 'database',
        connectorName: connector,
        children: [],
        isLoaded: false,
        childCount: db.childCount,
      }));

      setTreeData((prev) =>
        prev.map((node) =>
          node.id === parentNodeId ? { ...node, children: dbNodes, isLoaded: true } : node
        )
      );
    } catch (err) {
      logger.error('Failed to load databases', err, { connector });
      setError(err instanceof Error ? err.message : 'Failed to load databases');
    } finally {
      setLoadingNodes((prev) => {
        const next = new Set(prev);
        next.delete(parentNodeId);
        return next;
      });
    }
  }, []);

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
    
    // Listen for custom event when AtlanHeader establishes connection
    const handleAtlanConnected = () => {
      logger.debug('Atlan connection established, checking...');
      check();
    };
    
    window.addEventListener('atlan-connected', handleAtlanConnected);
    
    // Also check periodically in case connection is established (fallback)
    // But only if we're not already connected or connecting
    const interval = setInterval(() => {
      if (isConfigured() && connectionStatus === 'disconnected') {
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

  // Load connections when connected
  useEffect(() => {
    if (connectionStatus === 'connected' && connectors.length > 0 && treeData.length === 0) {
      loadConnections();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connectionStatus, connectors.length]);

  const loadSchemas = useCallback(async (dbNode: TreeNode) => {
    if (dbNode.isLoaded || !dbNode.qualifiedName) return;

    setLoadingNodes((prev) => new Set(prev).add(dbNode.id));
    setError(null);

    try {
      const schemas = await getSchemas(dbNode.qualifiedName);
      const schemaNodes: TreeNode[] = schemas.map((schema) => ({
        id: `schema-${schema.qualifiedName}`,
        name: schema.name,
        qualifiedName: schema.qualifiedName,
        type: 'schema',
        connectorName: dbNode.connectorName,
        children: [],
        isLoaded: false,
        childCount: schema.childCount,
      }));

      setTreeData((prev) =>
        prev.map((db) =>
          db.id === dbNode.id ? { ...db, children: schemaNodes, isLoaded: true } : db
        )
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load schemas');
    } finally {
      setLoadingNodes((prev) => {
        const next = new Set(prev);
        next.delete(dbNode.id);
        return next;
      });
    }
  }, []);

  const loadTables = useCallback(async (dbNode: TreeNode, schemaNode: TreeNode) => {
    if (schemaNode.isLoaded) return;

    setLoadingNodes((prev) => new Set(prev).add(schemaNode.id));
    setError(null);

    try {
      const assets = await fetchAssetsForModel({
        connector: schemaNode.connectorName || '',
        schemaQualifiedName: schemaNode.qualifiedName,
        assetTypes: ['Table', 'View', 'MaterializedView'],
        size: 200,
      });

      const tableNodes: TreeNode[] = assets
        .filter((a) => ['Table', 'View', 'MaterializedView'].includes(a.typeName))
        .map((asset) => ({
          id: `table-${asset.qualifiedName}`,
          name: asset.name,
          qualifiedName: asset.qualifiedName,
          type: 'table',
          connectorName: schemaNode.connectorName,
          children: [],
          isLoaded: true,
          asset,
        }));

      setTreeData((prev) =>
        prev.map((db) =>
          db.id === dbNode.id
            ? {
                ...db,
                children: db.children?.map((schema) =>
                  schema.id === schemaNode.id
                    ? { ...schema, children: tableNodes, isLoaded: true }
                    : schema
                ),
              }
            : db
        )
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load tables');
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
              loadDatabases(node.connectorName || node.name, node.id);
            } else if (node.type === 'database' && !node.isLoaded) {
              loadSchemas(node);
            } else if (node.type === 'schema' && !node.isLoaded && parent) {
              loadTables(parent, node);
            }
          }
          return next;
        });
      }
    },
    [expandedNodes, toggleAsset, loadDatabases, loadSchemas, loadTables]
  );

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
      // Find this connector node and collect all its children
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
      const connectorNode = findNode(treeData, node.id);
      if (connectorNode) {
        assets.push(...collectAllTables(connectorNode));
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
            {node.type === 'connector' && '🔗'}
            {node.type === 'database' && '🗄️'}
            {node.type === 'schema' && '📁'}
            {node.type === 'table' && '📊'}
          </span>
          <span className="tree-name" title={node.qualifiedName}>{node.name}</span>
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
            {node.children.map((child) => renderTreeNode(child, level + 1, node))}
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
                <button onClick={clearAssets} className="clear-btn" title="Clear all selections">
                  Clear All
                </button>
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
            {treeData
              .filter((node) => !selectedConnector || node.connectorName === selectedConnector || node.name === selectedConnector)
              .map((node) => renderTreeNode(node))}
          </div>
        )}
      </div>
    </Card>
  );
}

