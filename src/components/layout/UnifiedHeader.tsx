/**
 * UnifiedHeader - Integrated top bar spanning full width
 *
 * Combines brand/logo with navigation context, page actions, and global actions
 * into a single cohesive header. Page-specific actions are rendered contextually
 * via the pageActionsStore.
 */

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { Link2, Link2Off, ChevronLeft, ChevronRight, Search, RotateCcw } from 'lucide-react';
import { useAssetContextStore } from '../../stores/assetContextStore';
import { useScoresStore } from '../../stores/scoresStore';
import { usePageActionsStore, type PageAction } from '../../stores/pageActionsStore';
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

// Action button component
function HeaderActionButton({ action }: { action: PageAction }) {
  return (
    <button
      className={`header-action-btn ${action.active ? 'active' : ''} ${action.disabled ? 'disabled' : ''}`}
      onClick={action.onClick}
      disabled={action.disabled}
      title={action.title}
    >
      {action.icon}
      {action.label && <span className="header-action-label">{action.label}</span>}
      {action.badge === true && <span className="header-action-badge-dot" />}
      {typeof action.badge === 'number' && action.badge > 0 && (
        <span className="header-action-badge-count">{action.badge}</span>
      )}
    </button>
  );
}

// Group actions by their group property
function groupActions(actions: PageAction[]): Map<string, PageAction[]> {
  const groups = new Map<string, PageAction[]>();
  const order = ['view', 'capture', 'export', 'settings'];

  // Initialize groups in order
  order.forEach(g => groups.set(g, []));
  groups.set('default', []);

  // Sort actions into groups
  actions.forEach(action => {
    const group = action.group || 'default';
    const existing = groups.get(group) || [];
    groups.set(group, [...existing, action]);
  });

  return groups;
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

  // Page actions from store
  const { actions: pageActions, lastUpdated, pageSubtitle } = usePageActionsStore();
  const groupedActions = useMemo(() => groupActions(pageActions), [pageActions]);

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
  const prevScoreKeyRef = useRef<string | null>(null);
  useEffect(() => {
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

  // Format time ago
  const getTimeAgo = useCallback((date: Date) => {
    const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  }, []);

  // Check if we have any actions to show
  const hasActions = pageActions.length > 0;

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
          <div className="header-title-area">
            <div className="header-page-title">{pageTitle}</div>
            {pageSubtitle && (
              <span className="header-page-subtitle">{pageSubtitle}</span>
            )}
            {lastUpdated && (
              <span className="header-last-updated">
                Updated {getTimeAgo(lastUpdated)}
              </span>
            )}
          </div>

          <div className="header-context">
            {isConnected ? (
              <HierarchicalContextBar />
            ) : (
              <span className="context-placeholder">Connect to Atlan to explore assets</span>
            )}
          </div>
        </div>

        {/* Page Actions - Contextual based on current page */}
        {hasActions && (
          <div className="unified-header-page-actions">
            {Array.from(groupedActions.entries()).map(([group, actions]) => {
              if (actions.length === 0) return null;
              return (
                <div key={group} className="header-action-group">
                  {actions.map(action => (
                    <HeaderActionButton key={action.id} action={action} />
                  ))}
                </div>
              );
            })}
          </div>
        )}

        {/* Search Trigger */}
        {isConnected && (
          <button
            className="header-search-trigger"
            onClick={() => setShowGlobalSearch(true)}
            title="Search assets, pages, actions (Cmd+K)"
          >
            <Search size={15} />
            <span className="header-search-placeholder">Search...</span>
            <kbd className="header-search-kbd">K</kbd>
          </button>
        )}

        {/* Global Actions */}
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
