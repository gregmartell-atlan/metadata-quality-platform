/**
 * Quick Context Switcher
 * Hierarchical dropdown for fast context selection with inline quality scores
 */

import { useState, useEffect, useMemo, useRef } from 'react';
import {
  ChevronDown,
  ChevronRight,
  Globe,
  Database,
  Table,
  Loader2,
  Search,
  X,
  Snowflake,
  Link2
} from 'lucide-react';
import { useAssetContextStore } from '../../stores/assetContextStore';
import { useScoresStore } from '../../stores/scoresStore';
import { getConnectors, getDatabases, getSchemas, isConfigured } from '../../services/atlan/api';
import { loadAssetsForContext, generateContextLabel } from '../../utils/assetContextLoader';
import type { ConnectorInfo, HierarchyItem } from '../../services/atlan/api';
import './QuickContextSwitcher.css';

interface ExpandedState {
  [key: string]: boolean;
}

interface LoadedChildren {
  [key: string]: HierarchyItem[];
}

export function QuickContextSwitcher() {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [connectors, setConnectors] = useState<ConnectorInfo[]>([]);
  const [expanded, setExpanded] = useState<ExpandedState>({});
  const [loadedDatabases, setLoadedDatabases] = useState<LoadedChildren>({});
  const [loadedSchemas, setLoadedSchemas] = useState<LoadedChildren>({});
  const [loadingKey, setLoadingKey] = useState<string | null>(null);
  const [isLoadingConnectors, setIsLoadingConnectors] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const {
    context,
    setContext,
    clearContext,
    setLoading,
    getContextLabel
  } = useAssetContextStore();

  const { assetsWithScores } = useScoresStore();

  // Calculate scores by connection/database/schema
  const scoresByPath = useMemo(() => {
    const scores: Record<string, { score: number; count: number }> = {};

    assetsWithScores.forEach(({ asset, scores: assetScores }) => {
      const conn = asset.connectionName || 'Unknown';
      // Access optional database/schema properties from asset
      const assetWithDb = asset as { databaseName?: string; schemaName?: string };
      const db = assetWithDb.databaseName || '';
      const schema = assetWithDb.schemaName || '';

      // Connection level
      if (!scores[conn]) scores[conn] = { score: 0, count: 0 };
      scores[conn].score += assetScores.overall;
      scores[conn].count += 1;

      // Database level
      if (db) {
        const dbKey = `${conn}/${db}`;
        if (!scores[dbKey]) scores[dbKey] = { score: 0, count: 0 };
        scores[dbKey].score += assetScores.overall;
        scores[dbKey].count += 1;
      }

      // Schema level
      if (schema) {
        const schemaKey = `${conn}/${db}/${schema}`;
        if (!scores[schemaKey]) scores[schemaKey] = { score: 0, count: 0 };
        scores[schemaKey].score += assetScores.overall;
        scores[schemaKey].count += 1;
      }
    });

    // Calculate averages
    Object.keys(scores).forEach(key => {
      if (scores[key].count > 0) {
        scores[key].score = Math.round(scores[key].score / scores[key].count);
      }
    });

    return scores;
  }, [assetsWithScores]);

  // Load connectors when dropdown opens (only if API is configured)
  useEffect(() => {
    if (!isOpen || connectors.length > 0 || isLoadingConnectors || !isConfigured()) return;

    let cancelled = false;
    setIsLoadingConnectors(true); // eslint-disable-line react-hooks/set-state-in-effect
    getConnectors()
      .then(data => {
        if (!cancelled) setConnectors(data);
      })
      .catch(err => {
        if (!cancelled) console.error(err);
      })
      .finally(() => {
        if (!cancelled) setIsLoadingConnectors(false);
      });

    return () => { cancelled = true; };
  }, [isOpen, connectors.length, isLoadingConnectors]);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const getConnectionIcon = (name: string) => {
    const lower = name.toLowerCase();
    if (lower.includes('snowflake')) return <Snowflake size={14} />;
    return <Link2 size={14} />;
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'var(--score-excellent)';
    if (score >= 60) return 'var(--score-good)';
    if (score >= 40) return 'var(--score-fair)';
    return 'var(--score-poor)';
  };

  const toggleExpand = async (key: string, type: 'connection' | 'database', name: string, parentPath?: string) => {
    const newExpanded = { ...expanded, [key]: !expanded[key] };
    setExpanded(newExpanded);

    // Load children if expanding and not already loaded
    if (newExpanded[key]) {
      if (type === 'connection' && !loadedDatabases[key]) {
        setLoadingKey(key);
        try {
          const databases = await getDatabases(name);
          setLoadedDatabases(prev => ({ ...prev, [key]: databases }));
        } catch (err) {
          console.error('Failed to load databases:', err);
        }
        setLoadingKey(null);
      } else if (type === 'database' && parentPath && !loadedSchemas[key]) {
        setLoadingKey(key);
        try {
          const schemas = await getSchemas(parentPath);
          setLoadedSchemas(prev => ({ ...prev, [key]: schemas }));
        } catch (err) {
          console.error('Failed to load schemas:', err);
        }
        setLoadingKey(null);
      }
    }
  };

  const handleSelectContext = async (
    type: 'all' | 'connection' | 'database' | 'schema',
    filters: { connectionName?: string; databaseName?: string; schemaName?: string; qualifiedName?: string }
  ) => {
    setIsOpen(false);
    setLoading(true);

    try {
      const label = generateContextLabel(type, filters);
      const assets = await loadAssetsForContext(type, filters);
      setContext(type, filters, label, assets);
    } catch (err) {
      console.error('Failed to load context:', err);
    }

    setLoading(false);
  };

  const filteredConnectors = useMemo(() => {
    if (!search) return connectors;
    const lower = search.toLowerCase();
    return connectors.filter(c => c.name.toLowerCase().includes(lower));
  }, [connectors, search]);

  const currentLabel = getContextLabel();

  return (
    <div className="quick-context-switcher" ref={dropdownRef}>
      <button
        className="context-trigger"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className="context-label">{currentLabel || 'Select Context'}</span>
        <ChevronDown size={14} className={isOpen ? 'rotated' : ''} />
      </button>

      {isOpen && (
        <div className="context-dropdown-panel">
          {/* Search */}
          <div className="context-search">
            <Search size={14} />
            <input
              type="text"
              placeholder="Search connections..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              autoFocus
            />
            {search && (
              <button onClick={() => setSearch('')} className="clear-search">
                <X size={12} />
              </button>
            )}
          </div>

          {/* All Assets Option */}
          <button
            className={`context-item ${!context ? 'active' : ''}`}
            onClick={() => handleSelectContext('all', {})}
          >
            <Globe size={14} />
            <span className="item-label">All Assets</span>
          </button>

          <div className="context-divider" />

          {/* Connections List */}
          <div className="context-tree">
            {isLoadingConnectors ? (
              <div className="loading-state">
                <Loader2 size={16} className="spin" />
                <span>Loading connections...</span>
              </div>
            ) : filteredConnectors.length === 0 ? (
              <div className="empty-state">No connections found</div>
            ) : (
              filteredConnectors.map(connector => {
                const connKey = connector.name;
                const connScore = scoresByPath[connKey];
                const isExpanded = expanded[connKey];
                const databases = loadedDatabases[connKey] || [];

                return (
                  <div key={connector.id} className="tree-node">
                    <div className="tree-row connection">
                      <button
                        className="expand-btn"
                        onClick={() => toggleExpand(connKey, 'connection', connector.name)}
                      >
                        {loadingKey === connKey ? (
                          <Loader2 size={12} className="spin" />
                        ) : isExpanded ? (
                          <ChevronDown size={12} />
                        ) : (
                          <ChevronRight size={12} />
                        )}
                      </button>
                      <button
                        className="tree-item"
                        onClick={() => handleSelectContext('connection', { connectionName: connector.name })}
                      >
                        {getConnectionIcon(connector.name)}
                        <span className="item-label">{connector.name}</span>
                        <span className="item-count">{connector.assetCount.toLocaleString()}</span>
                        {connScore && (
                          <span
                            className="item-score"
                            style={{ color: getScoreColor(connScore.score) }}
                          >
                            {connScore.score}
                          </span>
                        )}
                      </button>
                    </div>

                    {/* Databases */}
                    {isExpanded && databases.length > 0 && (
                      <div className="tree-children">
                        {databases.map(db => {
                          const dbKey = `${connKey}/${db.name}`;
                          const dbScore = scoresByPath[dbKey];
                          const isDbExpanded = expanded[dbKey];
                          const schemas = loadedSchemas[dbKey] || [];

                          return (
                            <div key={db.guid} className="tree-node">
                              <div className="tree-row database">
                                <button
                                  className="expand-btn"
                                  onClick={() => toggleExpand(dbKey, 'database', db.name, db.qualifiedName)}
                                >
                                  {loadingKey === dbKey ? (
                                    <Loader2 size={12} className="spin" />
                                  ) : isDbExpanded ? (
                                    <ChevronDown size={12} />
                                  ) : (
                                    <ChevronRight size={12} />
                                  )}
                                </button>
                                <button
                                  className="tree-item"
                                  onClick={() => handleSelectContext('database', {
                                    connectionName: connector.name,
                                    databaseName: db.name
                                  })}
                                >
                                  <Database size={14} />
                                  <span className="item-label">{db.name}</span>
                                  {db.childCount && (
                                    <span className="item-count">{db.childCount}</span>
                                  )}
                                  {dbScore && (
                                    <span
                                      className="item-score"
                                      style={{ color: getScoreColor(dbScore.score) }}
                                    >
                                      {dbScore.score}
                                    </span>
                                  )}
                                </button>
                              </div>

                              {/* Schemas */}
                              {isDbExpanded && schemas.length > 0 && (
                                <div className="tree-children">
                                  {schemas.map(schema => {
                                    const schemaKey = `${dbKey}/${schema.name}`;
                                    const schemaScore = scoresByPath[schemaKey];

                                    return (
                                      <div key={schema.guid} className="tree-node">
                                        <div className="tree-row schema">
                                          <span className="expand-spacer" />
                                          <button
                                            className="tree-item"
                                            onClick={() => handleSelectContext('schema', {
                                              connectionName: connector.name,
                                              databaseName: db.name,
                                              schemaName: schema.name
                                            })}
                                          >
                                            <Table size={14} />
                                            <span className="item-label">{schema.name}</span>
                                            {schema.childCount && (
                                              <span className="item-count">{schema.childCount}</span>
                                            )}
                                            {schemaScore && (
                                              <span
                                                className="item-score"
                                                style={{ color: getScoreColor(schemaScore.score) }}
                                              >
                                                {schemaScore.score}
                                              </span>
                                            )}
                                          </button>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Clear Context */}
          {context && (
            <>
              <div className="context-divider" />
              <button
                className="context-item danger"
                onClick={() => { clearContext(); setIsOpen(false); }}
              >
                <X size={14} />
                <span className="item-label">Clear Context</span>
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
