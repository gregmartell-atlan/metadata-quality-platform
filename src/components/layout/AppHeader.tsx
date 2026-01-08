/**
 * Unified App Header
 *
 * Combines Atlan connection, asset context, and page navigation into a cohesive header.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Link2, Link2Off, Download, AlertTriangle, FolderOpen, Settings } from 'lucide-react';
import { useAssetContextStore } from '../../stores/assetContextStore';
import { useScoresStore } from '../../stores/scoresStore';
import { getAtlanConfig, testAtlanConnection, configureAtlanApi, getSavedAtlanBaseUrl } from '../../services/atlan/api';
import { loadAssetsForContext, generateContextLabel } from '../../utils/assetContextLoader';
import { sanitizeError } from '../../utils/sanitize';
import { logger } from '../../utils/logger';
import { AssetBrowserPanel } from './AssetBrowserPanel';
import { GlobalSettingsDrawer } from './GlobalSettingsDrawer';
import { QuickContextSwitcher } from './QuickContextSwitcher';
import { HierarchicalContextBar } from '../navigation/HierarchicalContextBar';
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
  const [apiKey, setApiKey] = useState(import.meta.env.VITE_ATLAN_API_KEY || '');
  const [baseUrl, setBaseUrl] = useState(import.meta.env.VITE_ATLAN_BASE_URL || 'https://your-tenant.atlan.com');
  const [connectError, setConnectError] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);

  // Asset context state
  const {
    context,
    contextAssets,
    error,
    setContext,
    setLoading,
    setError,
  } = useAssetContextStore();

  // Scores store for triggering score calculation
  const { setAssetsWithScores } = useScoresStore();

  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [showBrowserPanel, setShowBrowserPanel] = useState(false);

  // Check connection status on mount
  useEffect(() => {
    const savedBaseUrl = getSavedAtlanBaseUrl();
    if (savedBaseUrl) {
      setBaseUrl(savedBaseUrl);
    }
    const config = getAtlanConfig();
    setIsConnected(!!config);
  }, []);

  // Auto-reload assets when context is restored but assets are empty
  const hasTriedReload = useRef(false);
  useEffect(() => {
    const reloadAssets = async () => {
      if (!context || !isConnected || hasTriedReload.current) return;

      // Context exists but no assets - reload them
      if (context.assetCount > 0 && contextAssets.length === 0) {
        hasTriedReload.current = true;
        logger.info('AppHeader: Reloading assets from persisted context', {
          contextType: context.type,
          contextLabel: context.label,
          expectedCount: context.assetCount
        });

        setLoading(true);
        try {
          const assets = await loadAssetsForContext(context.type, context.filters);
          logger.info('AppHeader: Assets reloaded', { count: assets.length });
          useAssetContextStore.getState().setContextAssets(assets);
        } catch (err) {
          logger.error('AppHeader: Failed to reload assets', err);
          setError('Failed to reload assets. Please reselect your context.');
        } finally {
          setLoading(false);
        }
      }
    };

    reloadAssets();
  }, [context, contextAssets.length, isConnected, setLoading, setError]);

  // Reset reload flag when context changes
  useEffect(() => {
    hasTriedReload.current = false;
  }, [context?.label]);

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
    } catch (err: unknown) {
      let errorMessage = err instanceof Error ? err.message : 'Failed to connect to Atlan.';
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

  return (
    <>
      <header className="app-header">
        {/* Left: Context Navigation */}
        <div className="app-header-left">
          {/* Hierarchical Context Bar - replaces Browse + QuickContextSwitcher */}
          {isConnected && <HierarchicalContextBar />}

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

        {/* Right: Connection Status + Page Actions */}
        <div className="app-header-right">
          {children}

          {/* Connection Status */}
          <button
            className={`connection-btn ${isConnected ? 'connected' : ''}`}
            onClick={() => setShowConnectModal(true)}
          >
            {isConnected ? <Link2 size={16} /> : <Link2Off size={16} />}
            <span>{isConnected ? 'Connected' : 'Connect'}</span>
          </button>
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
