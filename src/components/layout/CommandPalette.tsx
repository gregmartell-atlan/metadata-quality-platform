/**
 * CommandPalette Component
 * Global search and navigation via Cmd+K keyboard shortcut
 *
 * Features:
 * - Search connections, databases, schemas
 * - Quick navigation to pages
 * - Recent context history
 */

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  Server,
  Database,
  Layers,
  LayoutDashboard,
  Table2,
  GitBranch,
  Radar,
  Settings,
  Home,
  Clock,
  ArrowRight,
  X
} from 'lucide-react';
import { getConnectors, getDatabases, getSchemas } from '../../services/atlan/api';
import { useAssetContextStore } from '../../stores/assetContextStore';
import { loadAssetsForContext, generateContextLabel } from '../../utils/assetContextLoader';
import './CommandPalette.css';

interface CommandItem {
  id: string;
  type: 'page' | 'connection' | 'database' | 'schema' | 'recent';
  label: string;
  description?: string;
  icon: React.ReactNode;
  action: () => void | Promise<void>;
}

// Page navigation items
const pageItems: Omit<CommandItem, 'action'>[] = [
  { id: 'page-home', type: 'page', label: 'Home', description: 'Go to home page', icon: <Home size={16} /> },
  { id: 'page-dashboard', type: 'page', label: 'Dashboard', description: 'Executive overview', icon: <LayoutDashboard size={16} /> },
  { id: 'page-pivot', type: 'page', label: 'Pivot Builder', description: 'Analyze by dimension', icon: <Table2 size={16} /> },
  { id: 'page-lineage', type: 'page', label: 'Lineage Explorer', description: 'Trace relationships', icon: <GitBranch size={16} /> },
  { id: 'page-analytics', type: 'page', label: 'DaaP Analytics', description: 'Compliance overview', icon: <Radar size={16} /> },
  { id: 'page-settings', type: 'page', label: 'Settings', description: 'Configure preferences', icon: <Settings size={16} /> },
];

export function CommandPalette() {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [connections, setConnections] = useState<CommandItem[]>([]);
  const [databases, setDatabases] = useState<CommandItem[]>([]);
  const [schemas, setSchemas] = useState<CommandItem[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const { setContext, setLoading, contextHistory } = useAssetContextStore();

  // Load data when palette opens
  useEffect(() => {
    if (isOpen) {
      setIsLoadingData(true);
      loadConnectionsData();
    }
  }, [isOpen]);

  const loadConnectionsData = async () => {
    try {
      const connectors = await getConnectors();
      const connItems: CommandItem[] = connectors.map(conn => ({
        id: `conn-${conn.id}`,
        type: 'connection',
        label: conn.name,
        description: `${conn.assetCount.toLocaleString()} assets`,
        icon: <Server size={16} />,
        action: async () => {
          setLoading(true);
          try {
            const label = generateContextLabel('connection', { connectionName: conn.name });
            const assets = await loadAssetsForContext('connection', { connectionName: conn.name });
            setContext('connection', { connectionName: conn.name }, label, assets);
            navigate('/dashboard');
          } catch (err) {
            console.error('Failed to load connection context:', err);
          }
          setLoading(false);
        }
      }));
      setConnections(connItems);

      // Load databases for all connections
      const allDatabases: CommandItem[] = [];
      for (const conn of connectors.slice(0, 3)) { // Limit to first 3 for performance
        const dbs = await getDatabases(conn.qualifiedName);
        dbs.forEach(db => {
          allDatabases.push({
            id: `db-${db.guid}`,
            type: 'database',
            label: db.name,
            description: `${conn.name}`,
            icon: <Database size={16} />,
            action: async () => {
              setLoading(true);
              try {
                const params = { connectionName: conn.name, databaseName: db.name };
                const label = generateContextLabel('database', params);
                const assets = await loadAssetsForContext('database', params);
                setContext('database', params, label, assets);
                navigate('/dashboard');
              } catch (err) {
                console.error('Failed to load database context:', err);
              }
              setLoading(false);
            }
          });
        });

        // Load schemas for each database
        for (const db of dbs.slice(0, 3)) { // Limit for performance
          const schemaList = await getSchemas(db.qualifiedName);
          schemaList.forEach(schema => {
            allDatabases.push({
              id: `schema-${schema.guid}`,
              type: 'schema',
              label: schema.name,
              description: `${conn.name} / ${db.name}`,
              icon: <Layers size={16} />,
              action: async () => {
                setLoading(true);
                try {
                  const params = { connectionName: conn.name, databaseName: db.name, schemaName: schema.name };
                  const label = generateContextLabel('schema', params);
                  const assets = await loadAssetsForContext('schema', params);
                  setContext('schema', params, label, assets);
                  navigate('/dashboard');
                } catch (err) {
                  console.error('Failed to load schema context:', err);
                }
                setLoading(false);
              }
            });
          });
        }
      }
      setDatabases(allDatabases.filter(d => d.type === 'database'));
      setSchemas(allDatabases.filter(d => d.type === 'schema'));
    } catch (err) {
      console.error('Failed to load command palette data:', err);
    }
    setIsLoadingData(false);
  };

  // Keyboard shortcut handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd/Ctrl + K to open
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen(prev => !prev);
      }
      // Escape to close
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
      setQuery('');
      setSelectedIndex(0);
    }
  }, [isOpen]);

  // Build recent items from history
  const recentItems = useMemo((): CommandItem[] => {
    return (contextHistory || []).slice(0, 5).map((hist, idx) => ({
      id: `recent-${idx}`,
      type: 'recent' as const,
      label: hist.label,
      description: hist.type,
      icon: <Clock size={16} />,
      action: async () => {
        setLoading(true);
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
  }, [contextHistory, setContext, setLoading, navigate]);

  // Build page items with navigation
  const navItems = useMemo((): CommandItem[] => {
    return pageItems.map(item => ({
      ...item,
      action: () => {
        const routes: Record<string, string> = {
          'page-home': '/',
          'page-dashboard': '/dashboard',
          'page-pivot': '/pivot',
          'page-lineage': '/lineage',
          'page-analytics': '/analytics',
          'page-settings': '/settings',
        };
        navigate(routes[item.id] || '/');
      }
    }));
  }, [navigate]);

  // Filter and group items based on query
  const filteredItems = useMemo(() => {
    const lowerQuery = query.toLowerCase().trim();

    const filterFn = (item: CommandItem) =>
      item.label.toLowerCase().includes(lowerQuery) ||
      (item.description?.toLowerCase().includes(lowerQuery) || false);

    const results: { section: string; items: CommandItem[] }[] = [];

    // If empty query, show recent first
    if (!lowerQuery) {
      if (recentItems.length > 0) {
        results.push({ section: 'Recent', items: recentItems });
      }
      results.push({ section: 'Navigate', items: navItems });
      if (connections.length > 0) {
        results.push({ section: 'Connections', items: connections.slice(0, 5) });
      }
    } else {
      // Search everything
      const matchedPages = navItems.filter(filterFn);
      const matchedRecent = recentItems.filter(filterFn);
      const matchedConnections = connections.filter(filterFn);
      const matchedDatabases = databases.filter(filterFn);
      const matchedSchemas = schemas.filter(filterFn);

      if (matchedRecent.length > 0) {
        results.push({ section: 'Recent', items: matchedRecent });
      }
      if (matchedPages.length > 0) {
        results.push({ section: 'Navigate', items: matchedPages });
      }
      if (matchedConnections.length > 0) {
        results.push({ section: 'Connections', items: matchedConnections.slice(0, 5) });
      }
      if (matchedDatabases.length > 0) {
        results.push({ section: 'Databases', items: matchedDatabases.slice(0, 5) });
      }
      if (matchedSchemas.length > 0) {
        results.push({ section: 'Schemas', items: matchedSchemas.slice(0, 5) });
      }
    }

    return results;
  }, [query, recentItems, navItems, connections, databases, schemas]);

  // Flatten for keyboard navigation
  const flatItems = useMemo(() => {
    return filteredItems.flatMap(section => section.items);
  }, [filteredItems]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => Math.min(prev + 1, flatItems.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => Math.max(prev - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (flatItems[selectedIndex]) {
          flatItems[selectedIndex].action();
          setIsOpen(false);
        }
        break;
    }
  }, [flatItems, selectedIndex]);

  // Scroll selected item into view
  useEffect(() => {
    const selectedEl = listRef.current?.querySelector(`[data-index="${selectedIndex}"]`);
    selectedEl?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  if (!isOpen) return null;

  return (
    <div className="command-palette-overlay" onClick={() => setIsOpen(false)}>
      <div className="command-palette" onClick={e => e.stopPropagation()}>
        <div className="command-palette-header">
          <Search size={18} className="command-search-icon" />
          <input
            ref={inputRef}
            type="text"
            className="command-input"
            placeholder="Search connections, pages, or type a command..."
            value={query}
            onChange={e => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDown}
          />
          <button className="command-close" onClick={() => setIsOpen(false)}>
            <X size={16} />
          </button>
        </div>

        <div className="command-palette-body" ref={listRef}>
          {isLoadingData && filteredItems.length === 0 ? (
            <div className="command-loading">Loading...</div>
          ) : filteredItems.length === 0 ? (
            <div className="command-empty">No results found</div>
          ) : (
            filteredItems.map((section, sectionIdx) => {
              const sectionStartIdx = filteredItems
                .slice(0, sectionIdx)
                .reduce((acc, s) => acc + s.items.length, 0);

              return (
                <div key={section.section} className="command-section">
                  <div className="command-section-title">{section.section}</div>
                  {section.items.map((item, itemIdx) => {
                    const globalIdx = sectionStartIdx + itemIdx;
                    return (
                      <button
                        key={item.id}
                        data-index={globalIdx}
                        className={`command-item ${globalIdx === selectedIndex ? 'selected' : ''}`}
                        onClick={() => {
                          item.action();
                          setIsOpen(false);
                        }}
                        onMouseEnter={() => setSelectedIndex(globalIdx)}
                      >
                        <span className="command-item-icon">{item.icon}</span>
                        <div className="command-item-content">
                          <span className="command-item-label">{item.label}</span>
                          {item.description && (
                            <span className="command-item-description">{item.description}</span>
                          )}
                        </div>
                        <ArrowRight size={14} className="command-item-arrow" />
                      </button>
                    );
                  })}
                </div>
              );
            })
          )}
        </div>

        <div className="command-palette-footer">
          <div className="command-hint">
            <kbd>↑↓</kbd> navigate
          </div>
          <div className="command-hint">
            <kbd>↵</kbd> select
          </div>
          <div className="command-hint">
            <kbd>esc</kbd> close
          </div>
        </div>
      </div>
    </div>
  );
}
