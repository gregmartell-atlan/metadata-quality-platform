/**
 * GlobalSearch - Command palette style search component
 *
 * Features:
 * - Keyboard shortcut (Cmd/Ctrl + K)
 * - Search across assets, pages, and actions
 * - Recent searches stored in localStorage
 */

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Search, X, Clock, Database, ArrowRight, Server, Layers, Home, LayoutDashboard, Table2, GitBranch, Radar, Settings } from 'lucide-react';
import { useScoresStore } from '../../stores/scoresStore';
import { useAssetContextStore } from '../../stores/assetContextStore';
import { getConnectors, getDatabases, getSchemas } from '../../services/atlan/api';
import { loadAssetsForContext, generateContextLabel } from '../../utils/assetContextLoader';
import { useNavigate } from 'react-router-dom';
import './GlobalSearch.css';

const STORAGE_KEY = 'mqp.search.recent';
const MAX_RECENT_SEARCHES = 5;

interface SearchResult {
  id: string;
  type: 'asset' | 'page' | 'action' | 'connection' | 'database' | 'schema' | 'recent';
  title: string;
  subtitle?: string;
  icon: React.ReactNode;
  action: () => void | Promise<void>;
}

interface GlobalSearchProps {
  /** Whether the search modal is open */
  isOpen: boolean;
  /** Callback to close the search modal */
  onClose: () => void;
}

export function GlobalSearch({ isOpen, onClose }: GlobalSearchProps) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [connections, setConnections] = useState<SearchResult[]>([]);
  const [databases, setDatabases] = useState<SearchResult[]>([]);
  const [schemas, setSchemas] = useState<SearchResult[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const { assetsWithScores } = useScoresStore();
  const { setContext, setLoading, contextHistory } = useAssetContextStore();
  const navigate = useNavigate();

  // Load recent searches from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        setRecentSearches(JSON.parse(stored)); // eslint-disable-line react-hooks/set-state-in-effect
      }
    } catch {
      // Ignore localStorage errors
    }
  }, []);

  // Focus input when modal opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
      setQuery(''); // eslint-disable-line react-hooks/set-state-in-effect
      setSelectedIndex(0);
    }
  }, [isOpen]);

  // Load context data (connections, databases, schemas)
  const loadContextData = useCallback(async () => {
    try {
      const connectors = await getConnectors();
      const connItems: SearchResult[] = connectors.map(conn => ({
        id: `conn-${conn.id}`,
        type: 'connection',
        title: conn.name,
        subtitle: `${conn.assetCount.toLocaleString()} assets`,
        icon: <Server size={16} />,
        action: async () => {
          setLoading(true);
          onClose();
          try {
            const label = generateContextLabel('connection', { connectionName: conn.name });
            const assets = await loadAssetsForContext('connection', { connectionName: conn.name });
            setContext('connection', { connectionName: conn.name }, label, assets);
            navigate('/dashboard');
          } catch (err) {
            console.error('Failed to load connection:', err);
          }
          setLoading(false);
        }
      }));
      setConnections(connItems);

      // Load databases and schemas for top connections
      const allDatabases: SearchResult[] = [];
      const allSchemas: SearchResult[] = [];

      for (const conn of connectors.slice(0, 3)) {
        try {
          const dbs = await getDatabases(conn.qualifiedName);
          dbs.forEach(db => {
            allDatabases.push({
              id: `db-${db.guid}`,
              type: 'database',
              title: db.name,
              subtitle: conn.name,
              icon: <Database size={16} />,
              action: async () => {
                setLoading(true);
                onClose();
                try {
                  const params = { connectionName: conn.name, databaseName: db.name };
                  const label = generateContextLabel('database', params);
                  const assets = await loadAssetsForContext('database', params);
                  setContext('database', params, label, assets);
                  navigate('/dashboard');
                } catch (err) {
                  console.error('Failed to load database:', err);
                }
                setLoading(false);
              }
            });
          });

          // Load schemas for top databases
          for (const db of dbs.slice(0, 2)) {
            try {
              const schemaList = await getSchemas(db.qualifiedName);
              schemaList.forEach(schema => {
                allSchemas.push({
                  id: `schema-${schema.guid}`,
                  type: 'schema',
                  title: schema.name,
                  subtitle: `${conn.name} / ${db.name}`,
                  icon: <Layers size={16} />,
                  action: async () => {
                    setLoading(true);
                    onClose();
                    try {
                      const params = { connectionName: conn.name, databaseName: db.name, schemaName: schema.name };
                      const label = generateContextLabel('schema', params);
                      const assets = await loadAssetsForContext('schema', params);
                      setContext('schema', params, label, assets);
                      navigate('/dashboard');
                    } catch (err) {
                      console.error('Failed to load schema:', err);
                    }
                    setLoading(false);
                  }
                });
              });
            } catch {
              // Skip schema loading errors
            }
          }
        } catch {
          // Skip connection loading errors
        }
      }

      setDatabases(allDatabases);
      setSchemas(allSchemas);
    } catch (err) {
      console.error('Failed to load context data:', err);
    }
  }, [setContext, setLoading, onClose, navigate]);

  // Load connections/databases/schemas when modal opens
  useEffect(() => {
    if (isOpen && connections.length === 0) {
      loadContextData(); // eslint-disable-line react-hooks/set-state-in-effect
    }
  }, [isOpen, connections.length, loadContextData]);

  // Save search to recent
  const saveRecentSearch = useCallback((search: string) => {
    if (!search.trim()) return;

    setRecentSearches((prev) => {
      const filtered = prev.filter((s) => s !== search);
      const updated = [search, ...filtered].slice(0, MAX_RECENT_SEARCHES);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      } catch {
        // Ignore localStorage errors
      }
      return updated;
    });
  }, []);

  // Navigation pages
  const pages: SearchResult[] = useMemo(() => [
    {
      id: 'page-home',
      type: 'page',
      title: 'Home',
      subtitle: 'Dashboard overview',
      icon: <Home size={16} />,
      action: () => { onClose(); navigate('/'); },
    },
    {
      id: 'page-dashboard',
      type: 'page',
      title: 'Executive Dashboard',
      subtitle: 'Quality metrics and KPIs',
      icon: <LayoutDashboard size={16} />,
      action: () => { onClose(); navigate('/dashboard'); },
    },
    {
      id: 'page-analytics',
      type: 'page',
      title: 'DaaP Analytics',
      subtitle: 'Data as a Product insights',
      icon: <Radar size={16} />,
      action: () => { onClose(); navigate('/analytics'); },
    },
    {
      id: 'page-pivot',
      type: 'page',
      title: 'Pivot Builder',
      subtitle: 'Custom pivot tables',
      icon: <Table2 size={16} />,
      action: () => { onClose(); navigate('/pivot'); },
    },
    {
      id: 'page-lineage',
      type: 'page',
      title: 'Lineage Explorer',
      subtitle: 'Data lineage visualization',
      icon: <GitBranch size={16} />,
      action: () => { onClose(); navigate('/lineage'); },
    },
    {
      id: 'page-settings',
      type: 'page',
      title: 'Settings',
      subtitle: 'Application preferences',
      icon: <Settings size={16} />,
      action: () => { onClose(); navigate('/settings'); },
    },
  ], [navigate, onClose]);

  // Recent context history
  const recentContextItems: SearchResult[] = useMemo(() => {
    return (contextHistory || []).slice(0, 5).map((hist, idx) => ({
      id: `recent-ctx-${idx}`,
      type: 'recent' as const,
      title: hist.label,
      subtitle: `Recent ${hist.type}`,
      icon: <Clock size={16} />,
      action: async () => {
        setLoading(true);
        onClose();
        try {
          const assets = await loadAssetsForContext(hist.type, hist.params);
          setContext(hist.type, hist.params, hist.label, assets);
          navigate('/dashboard');
        } catch (err) {
          console.error('Failed to load recent context:', err);
        }
        setLoading(false);
      }
    }));
  }, [contextHistory, setContext, setLoading, navigate, onClose]);

  // Search results - combines pages, connections, databases, schemas, assets
  const results = useMemo(() => {
    const lowerQuery = query.toLowerCase().trim();

    // Helper to filter items
    const filterFn = (item: SearchResult) =>
      item.title.toLowerCase().includes(lowerQuery) ||
      (item.subtitle?.toLowerCase().includes(lowerQuery) || false);

    if (!lowerQuery) {
      // No query: show recent context, pages, then connections
      const combined: SearchResult[] = [];

      // Add recent context items first
      if (recentContextItems.length > 0) {
        combined.push(...recentContextItems.slice(0, 3));
      }

      // Add pages
      combined.push(...pages.slice(0, 4));

      // Add connections
      if (connections.length > 0) {
        combined.push(...connections.slice(0, 3));
      }

      return combined;
    }

    // With query: search across all categories
    const searchResults: SearchResult[] = [];

    // Search recent context
    recentContextItems.filter(filterFn).forEach(item => searchResults.push(item));

    // Search pages
    pages.filter(filterFn).forEach(item => {
      searchResults.push({
        ...item,
        action: () => {
          saveRecentSearch(query);
          item.action();
        },
      });
    });

    // Search connections
    connections.filter(filterFn).slice(0, 5).forEach(item => searchResults.push(item));

    // Search databases
    databases.filter(filterFn).slice(0, 5).forEach(item => searchResults.push(item));

    // Search schemas
    schemas.filter(filterFn).slice(0, 5).forEach(item => searchResults.push(item));

    // Search assets
    assetsWithScores.forEach((item) => {
      const name = item.asset.name.toLowerCase();
      const connection = (item.metadata.connection || '').toLowerCase();
      const owner = (item.metadata.owner || '').toLowerCase();

      if (
        name.includes(lowerQuery) ||
        connection.includes(lowerQuery) ||
        owner.includes(lowerQuery)
      ) {
        searchResults.push({
          id: `asset-${item.asset.guid}`,
          type: 'asset',
          title: item.asset.name,
          subtitle: `${item.metadata.assetType} • ${item.metadata.connection}`,
          icon: <Database size={16} />,
          action: () => {
            saveRecentSearch(query);
            onClose();
          },
        });
      }
    });

    return searchResults.slice(0, 15);
  }, [query, assetsWithScores, pages, connections, databases, schemas, recentContextItems, saveRecentSearch, onClose]);

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex((prev) => Math.min(prev + 1, results.length - 1));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex((prev) => Math.max(prev - 1, 0));
          break;
        case 'Enter':
          e.preventDefault();
          if (results[selectedIndex]) {
            results[selectedIndex].action();
          }
          break;
        case 'Escape':
          e.preventDefault();
          onClose();
          break;
      }
    },
    [results, selectedIndex, onClose]
  );

  // Scroll selected item into view
  useEffect(() => {
    if (resultsRef.current) {
      const selectedEl = resultsRef.current.children[selectedIndex] as HTMLElement;
      if (selectedEl) {
        selectedEl.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [selectedIndex]);

  // Reset selection when query changes
  useEffect(() => {
    setSelectedIndex(0); // eslint-disable-line react-hooks/set-state-in-effect
  }, [query]);

  if (!isOpen) return null;

  return (
    <div className="global-search-overlay" onClick={onClose}>
      <div className="global-search-modal" onClick={(e) => e.stopPropagation()}>
        <div className="global-search-input-wrapper">
          <Search size={20} className="global-search-icon" />
          <input
            ref={inputRef}
            type="text"
            className="global-search-input"
            placeholder="Search assets, pages, or actions..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          {query && (
            <button className="global-search-clear" onClick={() => setQuery('')}>
              <X size={16} />
            </button>
          )}
          <kbd className="global-search-kbd">ESC</kbd>
        </div>

        {/* Recent searches */}
        {!query && recentSearches.length > 0 && (
          <div className="global-search-section">
            <div className="global-search-section-title">
              <Clock size={14} />
              Recent Searches
            </div>
            <div className="global-search-recent">
              {recentSearches.map((search) => (
                <button
                  key={search}
                  className="global-search-recent-item"
                  onClick={() => setQuery(search)}
                >
                  {search}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Results */}
        <div className="global-search-results" ref={resultsRef}>
          {results.length === 0 && query && (
            <div className="global-search-empty">
              No results found for "{query}"
            </div>
          )}
          {results.map((result, index) => (
            <button
              key={result.id}
              className={`global-search-result ${index === selectedIndex ? 'selected' : ''}`}
              onClick={() => result.action()}
              onMouseEnter={() => setSelectedIndex(index)}
            >
              <span className="global-search-result-icon">{result.icon}</span>
              <div className="global-search-result-content">
                <span className="global-search-result-title">{result.title}</span>
                {result.subtitle && (
                  <span className="global-search-result-subtitle">{result.subtitle}</span>
                )}
              </div>
              <span className="global-search-result-type">{result.type}</span>
              <ArrowRight size={14} className="global-search-result-arrow" />
            </button>
          ))}
        </div>

        <div className="global-search-footer">
          <span><kbd>↑</kbd><kbd>↓</kbd> to navigate</span>
          <span><kbd>↵</kbd> to select</span>
          <span><kbd>esc</kbd> to close</span>
        </div>
      </div>
    </div>
  );
}
