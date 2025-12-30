/**
 * Unified App Header
 *
 * Combines Atlan connection, asset context, and page navigation into a cohesive header.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Link2, Link2Off, ChevronDown, BarChart3, X, Download, Loader2, AlertTriangle, Globe, FolderOpen } from 'lucide-react';
import { useAssetContextStore } from '../../stores/assetContextStore';
import { useScoresStore } from '../../stores/scoresStore';
import { getAtlanConfig, getConnectors, testAtlanConnection, configureAtlanApi, getSavedAtlanBaseUrl } from '../../services/atlan/api';
import { loadAssetsForContext, generateContextLabel } from '../../utils/assetContextLoader';
import { sanitizeError } from '../../utils/sanitize';
import { logger } from '../../utils/logger';
import { AssetBrowserPanel } from './AssetBrowserPanel';
import type { AtlanAsset } from '../../services/atlan/types';
import type { AssetContextType, AssetContextFilters } from '../../stores/assetContextStore';
import './AppHeader.css';

interface AppHeaderProps {
  title?: string;
  subtitle?: string;
  children?: React.ReactNode;
}

export function AppHeader({ title, subtitle, children }: AppHeaderProps) {
  // Atlan connection state
  const [isConnected, setIsConnected] = useState(false);
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [baseUrl, setBaseUrl] = useState('https://api.atlan.com');
  const [connectError, setConnectError] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);

  // Asset context state
  const {
    context,
    contextAssets,
    isLoading,
    error,
    setContext,
    setAllAssets,
    clearContext,
    setLoading,
    setError,
    getContextLabel,
    getAssetCount,
  } = useAssetContextStore();

  // Scores store for triggering score calculation
  const { setAssetsWithScores } = useScoresStore();

  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [showBrowserPanel, setShowBrowserPanel] = useState(false);
  const [availableConnectors, setAvailableConnectors] = useState<Array<{ name: string; id: string }>>([]);

  // Check connection status on mount
  useEffect(() => {
    const savedBaseUrl = getSavedAtlanBaseUrl();
    if (savedBaseUrl) {
      setBaseUrl(savedBaseUrl);
    }
    const config = getAtlanConfig();
    setIsConnected(!!config);
  }, []);

  // Load connectors when connected
  useEffect(() => {
    if (isConnected) {
      getConnectors()
        .then(connectors => {
          if (connectors?.length > 0) {
            setAvailableConnectors(connectors.map(c => ({ name: c.name, id: c.id })));
          }
        })
        .catch(err => logger.error('Failed to load connectors', err));
    }
  }, [isConnected]);

  // Trigger score calculation when context assets change
  const prevAssetsLengthRef = useRef(0);
  useEffect(() => {
    if (contextAssets.length > 0 && contextAssets.length !== prevAssetsLengthRef.current) {
      prevAssetsLengthRef.current = contextAssets.length;
      logger.info('AppHeader: Triggering score calculation', { assetCount: contextAssets.length });
      setAssetsWithScores(contextAssets);
    } else if (contextAssets.length === 0 && prevAssetsLengthRef.current > 0) {
      prevAssetsLengthRef.current = 0;
    }
  }, [contextAssets, setAssetsWithScores]);

  // Handle connect form submit
  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    setConnectError(null);
    setIsConnecting(true);

    try {
      await testAtlanConnection({ apiKey, baseUrl });
      configureAtlanApi({ apiKey, baseUrl });
      setIsConnected(true);
      setShowConnectModal(false);
      window.dispatchEvent(new CustomEvent('atlan-connected', { detail: { baseUrl } }));
    } catch (err: any) {
      let errorMessage = err.message || 'Failed to connect to Atlan.';
      if (errorMessage.includes('ERR_CONNECTION_REFUSED') || errorMessage.includes('Proxy server not running')) {
        errorMessage = 'Proxy server not running. Start with: npm run proxy';
      }
      setConnectError(sanitizeError(new Error(errorMessage)));
    } finally {
      setIsConnecting(false);
    }
  };

  // Handle drag events for context
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'copy';
    setIsDraggingOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const { clientX: x, clientY: y } = e;
    if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
      setIsDraggingOver(false);
    }
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
    setLoading(true);
    setError(null);

    try {
      const data = e.dataTransfer.getData('application/json');
      if (!data) return;

      const parsed = JSON.parse(data);

      if (parsed.type === 'atlan-assets' && parsed.assets?.length) {
        const assets = parsed.assets as AtlanAsset[];
        const label = parsed.nodeName || 'Selected Assets';
        setContext('manual', {}, label, assets);
      } else if (parsed.type === 'atlan-node') {
        const { nodeType, nodeName, connectorName, qualifiedName } = parsed;
        let contextType: AssetContextType;
        let filters: AssetContextFilters;
        let assets: AtlanAsset[];

        if (nodeType === 'connector' || nodeType === 'connection') {
          contextType = 'connection';
          filters = { connectionName: nodeName || connectorName };
          assets = await loadAssetsForContext(contextType, filters);
        } else if (nodeType === 'database') {
          contextType = 'database';
          filters = { connectionName: connectorName || parsed.connectionName, databaseName: nodeName };
          assets = await loadAssetsForContext(contextType, filters);
        } else if (nodeType === 'schema') {
          contextType = 'schema';
          let databaseName = parsed.databaseName;
          if (!databaseName && qualifiedName) {
            const parts = qualifiedName.split('/');
            if (parts.length >= 2) databaseName = parts[parts.length - 2];
          }
          filters = { connectionName: connectorName || parsed.connectionName, databaseName, schemaName: nodeName };
          assets = await loadAssetsForContext(contextType, filters);
        } else {
          throw new Error(`Unsupported node type: ${nodeType}`);
        }

        const label = generateContextLabel(contextType, filters);
        setContext(contextType, filters, label, assets);
      }
    } catch (err) {
      logger.error('Failed to handle context drop', err);
      setError(err instanceof Error ? err.message : 'Failed to set context');
    } finally {
      setLoading(false);
    }
  }, [setContext, setLoading, setError]);

  const handleSelectAllAssets = useCallback(async () => {
    setLoading(true);
    setError(null);
    setShowContextMenu(false);
    try {
      const assets = await loadAssetsForContext('all', {});
      if (assets.length === 0) {
        setError('No assets found. Connect to Atlan first.');
      } else {
        setAllAssets(assets);
      }
    } catch (err) {
      logger.error('Failed to load all assets', err);
      setError(err instanceof Error ? err.message : 'Failed to load assets');
    } finally {
      setLoading(false);
    }
  }, [setAllAssets, setLoading, setError]);

  const handleSelectConnection = useCallback(async (connectionName: string) => {
    setLoading(true);
    setError(null);
    setShowContextMenu(false);
    try {
      const assets = await loadAssetsForContext('connection', { connectionName });
      const label = generateContextLabel('connection', { connectionName });
      setContext('connection', { connectionName }, label, assets);
    } catch (err) {
      logger.error('Failed to load connection assets', err);
      setError(err instanceof Error ? err.message : 'Failed to load connection');
    } finally {
      setLoading(false);
    }
  }, [setContext, setLoading, setError]);

  const contextLabel = getContextLabel();
  const assetCount = getAssetCount();

  return (
    <>
      <header className="app-header">
        {/* Left: Connection & Context */}
        <div className="app-header-left">
          {/* Connection Status */}
          <button
            className={`connection-btn ${isConnected ? 'connected' : ''}`}
            onClick={() => setShowConnectModal(true)}
          >
            {isConnected ? <Link2 size={16} /> : <Link2Off size={16} />}
            <span>{isConnected ? 'Connected' : 'Connect'}</span>
          </button>

          {/* Browse Assets Button */}
          <button
            className={`browse-btn ${showBrowserPanel ? 'active' : ''}`}
            onClick={() => setShowBrowserPanel(!showBrowserPanel)}
            title="Browse assets"
          >
            <FolderOpen size={16} />
            <span>Browse</span>
          </button>

          {/* Context Bar */}
          <div
            className={`context-bar ${isDraggingOver ? 'drag-over' : ''} ${context ? 'has-context' : ''}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            {isLoading ? (
              <div className="context-loading">
                <Loader2 size={14} className="spinning" />
                <span>Loading...</span>
              </div>
            ) : context ? (
              <>
                <BarChart3 size={14} className="context-icon" />
                <span className="context-label">{contextLabel}</span>
                {assetCount > 0 && <span className="context-count">({assetCount.toLocaleString()})</span>}
                <button className="context-clear" onClick={clearContext} title="Clear context">
                  <X size={12} />
                </button>
              </>
            ) : (
              <>
                <Download size={14} className="context-icon" />
                <span className="context-placeholder">Drop assets here or select context</span>
              </>
            )}

            {/* Context Menu Trigger */}
            <button
              className="context-menu-btn"
              onClick={() => setShowContextMenu(!showContextMenu)}
              title="Select context"
            >
              <ChevronDown size={14} />
            </button>

            {/* Context Dropdown */}
            {showContextMenu && (
              <div className="context-dropdown">
                <button className="context-option" onClick={handleSelectAllAssets}>
                  <Globe size={14} />
                  <span>All Assets</span>
                </button>
                {availableConnectors.map(connector => (
                  <button
                    key={connector.id}
                    className="context-option"
                    onClick={() => handleSelectConnection(connector.name)}
                  >
                    <Link2 size={14} />
                    <span>{connector.name}</span>
                  </button>
                ))}
                {context && (
                  <>
                    <div className="context-divider" />
                    <button className="context-option danger" onClick={() => { clearContext(); setShowContextMenu(false); }}>
                      <X size={14} />
                      <span>Clear Context</span>
                    </button>
                  </>
                )}
              </div>
            )}
          </div>

          {error && (
            <div className="context-error" title={error}>
              <AlertTriangle size={14} />
            </div>
          )}
        </div>

        {/* Center: Title */}
        {title && (
          <div className="app-header-center">
            <h1>{title}</h1>
            {subtitle && <p>{subtitle}</p>}
          </div>
        )}

        {/* Right: Page Actions */}
        <div className="app-header-right">
          {children}
        </div>
      </header>

      {/* Asset Browser Panel */}
      <AssetBrowserPanel
        isOpen={showBrowserPanel}
        onClose={() => setShowBrowserPanel(false)}
      />

      {/* Connection Modal */}
      {showConnectModal && (
        <div className="modal-overlay" onClick={() => setShowConnectModal(false)}>
          <form className="connect-modal" onClick={e => e.stopPropagation()} onSubmit={handleConnect}>
            <h2>Connect to Atlan</h2>
            <input
              type="text"
              placeholder="API Key"
              value={apiKey}
              onChange={e => setApiKey(e.target.value)}
              autoFocus
            />
            <input
              type="text"
              placeholder="Base URL (e.g., https://your-tenant.atlan.com)"
              value={baseUrl}
              onChange={e => setBaseUrl(e.target.value)}
            />
            {connectError && <div className="connect-error">{connectError}</div>}
            <div className="modal-actions">
              <button type="button" className="btn-secondary" onClick={() => setShowConnectModal(false)}>
                Cancel
              </button>
              <button type="submit" className="btn-primary" disabled={isConnecting}>
                {isConnecting ? 'Connecting...' : 'Connect'}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
