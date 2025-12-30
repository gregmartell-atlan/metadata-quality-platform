/**
 * Asset Browser Component
 * 
 * Browse and select assets from Atlan for scoring
 * Shows hierarchy: Connections → Databases → Schemas → Tables
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Card } from './shared';
import {
  getConnectors,
  getDatabases,
  getSchemas,
  fetchAssetsForModel,
  isConfigured,
  testConnection,
  type ConnectorInfo,
  type HierarchyItem,
} from '../services/atlan/api';
import { useAssetStore } from '../stores/assetStore';
import type { AtlanAsset } from '../services/atlan/types';
import { logger } from '../utils/logger';
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
  const { selectedAssets, toggleAsset, isSelected, selectedCount, clearAssets } = useAssetStore();
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

  const loadDatabases = useCallback(async (connector: string) => {
    const nodeId = `connector-${connector}`;
    setLoadingNodes((prev) => new Set(prev).add(nodeId));
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

      setTreeData(dbNodes);
    } catch (err) {
      logger.error('Failed to load databases', err, { connector });
      setError(err instanceof Error ? err.message : 'Failed to load databases');
    } finally {
      setLoadingNodes((prev) => {
        const next = new Set(prev);
        next.delete(nodeId);
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

  // Load databases when connector changes (but only once per connector)
  const lastLoadedConnector = React.useRef<string | null>(null);
  const isLoadingDatabases = React.useRef(false);
  
  useEffect(() => {
    if (connectionStatus === 'connected' && selectedConnector && selectedConnector !== lastLoadedConnector.current && !isLoadingDatabases.current) {
      lastLoadedConnector.current = selectedConnector;
      isLoadingDatabases.current = true;
      loadDatabases(selectedConnector).finally(() => {
        isLoadingDatabases.current = false;
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connectionStatus, selectedConnector]); // loadDatabases is stable, no need to include

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
            if (node.type === 'database' && !node.isLoaded) {
              loadSchemas(node);
            } else if (node.type === 'schema' && !node.isLoaded && parent) {
              loadTables(parent, node);
            }
          }
          return next;
        });
      }
    },
    [expandedNodes, toggleAsset, loadSchemas, loadTables]
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
      for (const dbNode of treeData) {
        if (dbNode.connectorName === node.name || dbNode.connectorName === selectedConnector) {
          assets.push(...collectAllTables(dbNode));
        }
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
              {isExpanded ? '▼' : '▶'}
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
            {node.type === 'database' && '🗄️'}
            {node.type === 'schema' && '📁'}
            {node.type === 'table' && '📊'}
            {node.type === 'connector' && '🔌'}
          </span>
          <span className="tree-name" title={node.qualifiedName}>{node.name}</span>
          {node.childCount !== undefined && node.childCount > 0 && (
            <span className="tree-count">{node.childCount}</span>
          )}
          {isLoading && <span className="tree-loading">⏳</span>}
          {isDraggable && node.type !== 'table' && (
            <span className="drag-hint" title={`Drag to select all tables under ${node.name}`}>📤</span>
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
              <label htmlFor="connector-select" className="control-label">Connection:</label>
              <select
                id="connector-select"
                value={selectedConnector || ''}
                onChange={(e) => setSelectedConnector(e.target.value)}
                className="connector-select"
              >
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
            <p>No databases found for this connector</p>
            <p className="empty-hint">Try selecting a different connector or check your Atlan permissions.</p>
          </div>
        )}
        {treeData.length > 0 && (
          <div className="tree-list">
            {treeData.map((node) => renderTreeNode(node))}
          </div>
        )}
      </div>
    </Card>
  );
}

