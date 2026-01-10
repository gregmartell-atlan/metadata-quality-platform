/**
 * UnifiedHeader - Integrated top bar spanning full width
 *
 * Combines brand/logo with navigation context and actions into
 * a single cohesive header that connects sidebar and content.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Link2, Link2Off, ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { useAssetContextStore } from '../../stores/assetContextStore';
import { useScoresStore } from '../../stores/scoresStore';
import { getAtlanConfig, testAtlanConnection, configureAtlanApi, getSavedAtlanBaseUrl } from '../../services/atlan/api';
import { loadAssetsForContext, generateContextLabel } from '../../utils/assetContextLoader';
import { sanitizeError } from '../../utils/sanitize';
import { logger } from '../../utils/logger';
import { HierarchicalContextBar } from '../navigation/HierarchicalContextBar';
import { GlobalSearch } from '../shared/GlobalSearch';
import type { AtlanAsset } from '../../services/atlan/types';
import type { AssetContextType, AssetContextFilters } from '../../stores/assetContextStore';
import './UnifiedHeader.css';

// Page title mapping
const pageTitles: Record<string, string> = {
  '/': 'Home',
  '/dashboard': 'Executive Overview',
  '/pivot': 'Pivot Builder',
  '/lineage': 'Lineage Explorer',
  '/analytics': 'DaaP Analytics',
  '/trends': 'Quality Trends',
  '/settings': 'Settings',
};

interface UnifiedHeaderProps {
  isSidebarCollapsed: boolean;
  onToggleSidebar: () => void;
}

export function UnifiedHeader({ isSidebarCollapsed, onToggleSidebar }: UnifiedHeaderProps) {
  const location = useLocation();
  const pageTitle = pageTitles[location.pathname] || 'Metadata Quality';

  // Atlan connection state
  const [isConnected, setIsConnected] = useState(false);
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [connectError, setConnectError] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);

  // Asset context state
  const {
    context,
    contextAssets,
    setContext,
    setLoading,
    setError,
  } = useAssetContextStore();

  // Scores store for triggering score calculation
  const { setAssetsWithScores } = useScoresStore();

  // Global search state
  const [showGlobalSearch, setShowGlobalSearch] = useState(false);

  // Keyboard shortcut for global search (Cmd/Ctrl + K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setShowGlobalSearch(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

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

      if (context.assetCount > 0 && contextAssets.length === 0) {
        hasTriedReload.current = true;
        logger.info('UnifiedHeader: Reloading assets from persisted context', {
          contextType: context.type,
          contextLabel: context.label,
          expectedCount: context.assetCount
        });

        setLoading(true);
        try {
          const assets = await loadAssetsForContext(context.type, context.filters);
          logger.info('UnifiedHeader: Assets reloaded', { count: assets.length });
          useAssetContextStore.getState().setContextAssets(assets);
        } catch (err) {
          logger.error('UnifiedHeader: Failed to reload assets', err);
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
  // Use a combination of context label and asset count to detect changes
  const prevScoreKeyRef = useRef<string | null>(null);
  useEffect(() => {
    // Create a key that changes when either context or asset count changes
    const scoreKey = `${context?.label || 'none'}:${contextAssets.length}`;

    if (contextAssets.length > 0 && scoreKey !== prevScoreKeyRef.current) {
      prevScoreKeyRef.current = scoreKey;
      logger.info('UnifiedHeader: Triggering score calculation', {
        assetCount: contextAssets.length,
        context: context?.label,
        scoreKey
      });
      setAssetsWithScores(contextAssets);
    } else if (contextAssets.length === 0) {
      prevScoreKeyRef.current = null;
    }
  }, [contextAssets, context?.label, setAssetsWithScores]);

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

  return (
    <>
      <header className={`unified-header ${isSidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
        {/* Brand Section - Aligned with sidebar */}
        <div className="unified-header-brand">
          <div className="brand-logo">
            <div className="logo-icon">MQ</div>
            <span className="logo-text">Metadata Quality</span>
          </div>
          <button
            className="sidebar-toggle"
            onClick={onToggleSidebar}
            title={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {isSidebarCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
          </button>
        </div>

        {/* Page Title + Context */}
        <div className="unified-header-content">
          <div className="header-page-title">{pageTitle}</div>
          <div className="header-context">
            {isConnected ? (
              <HierarchicalContextBar />
            ) : (
              <span className="context-placeholder">Connect to Atlan to explore assets</span>
            )}
          </div>
          {/* Global Search Bar - Always Visible */}
          {isConnected && (
            <button
              className="header-search-trigger"
              onClick={() => setShowGlobalSearch(true)}
              title="Search assets, pages, actions (Cmd+K)"
            >
              <Search size={16} />
              <span className="header-search-placeholder">Search assets...</span>
              <kbd className="header-search-kbd">K</kbd>
            </button>
          )}
        </div>

        {/* Actions */}
        <div className="unified-header-actions">
          <button
            className={`connection-btn ${isConnected ? 'connected' : ''}`}
            onClick={() => setShowConnectModal(true)}
          >
            {isConnected ? <Link2 size={16} /> : <Link2Off size={16} />}
            <span>{isConnected ? 'Connected' : 'Connect'}</span>
          </button>
        </div>
      </header>

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

      {/* Global Search Modal */}
      <GlobalSearch
        isOpen={showGlobalSearch}
        onClose={() => setShowGlobalSearch(false)}
      />
    </>
  );
}
