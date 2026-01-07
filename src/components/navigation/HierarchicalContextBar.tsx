/**
 * Hierarchical Context Bar
 *
 * Mac-style horizontal breadcrumb navigation with inline dropdowns.
 * Consolidates asset browsing and context selection into one elegant interface.
 *
 * Connection > Database > Schema > [Table count badge]
 */

import { useState, useEffect, useRef, useMemo } from 'react';
import {
  ChevronRight,
  ChevronDown,
  Database,
  Folder,
  Table2,
  Snowflake,
  Link2,
  X,
  Check,
  Loader2,
  Info
} from 'lucide-react';
import { useAssetContextStore } from '../../stores/assetContextStore';
import { useAssetInspectorStore } from '../../stores/assetInspectorStore';
import { getConnectors, getDatabases, getSchemas, type ConnectorInfo } from '../../services/atlan/api';
import { loadAssetsForContext, generateContextLabel } from '../../utils/assetContextLoader';
import './HierarchicalContextBar.css';

interface HierarchyLevel {
  type: 'connection' | 'database' | 'schema';
  name: string;
  displayName: string;
  icon: React.ReactNode;
}

interface DropdownItem {
  id: string;
  name: string;
  displayName: string;
  qualifiedName?: string;
  count?: number;
  icon?: React.ReactNode;
}

export function HierarchicalContextBar() {
  const { context, contextAssets, setContext, setLoading } = useAssetContextStore();
  const { openInspector } = useAssetInspectorStore();

  // Dropdown state
  const [activeDropdown, setActiveDropdown] = useState<'connection' | 'database' | 'schema' | null>(null);
  const [isLoadingLevel, setIsLoadingLevel] = useState<string | null>(null);

  // Data
  const [connections, setConnections] = useState<ConnectorInfo[]>([]);
  const [databases, setDatabases] = useState<DropdownItem[]>([]);
  const [schemas, setSchemas] = useState<DropdownItem[]>([]);

  // Full entities for inspector
  const [databaseEntities, setDatabaseEntities] = useState<Map<string, any>>(new Map());
  const [schemaEntities, setSchemaEntities] = useState<Map<string, any>>(new Map());

  // Selection state
  const [selectedConnection, setSelectedConnection] = useState<string | null>(null);
  const [selectedDatabase, setSelectedDatabase] = useState<string | null>(null);
  const [selectedSchema, setSelectedSchema] = useState<string | null>(null);

  // Refs for click-outside handling
  const barRef = useRef<HTMLDivElement>(null);

  // Load connections on mount
  useEffect(() => {
    getConnectors()
      .then(setConnections)
      .catch(console.error);
  }, []);

  // Sync with context store
  useEffect(() => {
    if (context) {
      setSelectedConnection(context.filters.connectionName || null);
      setSelectedDatabase(context.filters.databaseName || null);
      setSelectedSchema(context.filters.schemaName || null);
    }
  }, [context]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (barRef.current && !barRef.current.contains(e.target as Node)) {
        setActiveDropdown(null);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Load databases when connection selected
  useEffect(() => {
    if (selectedConnection) {
      setIsLoadingLevel('database');
      getDatabases(selectedConnection)
        .then(dbs => {
          // Store full entities for inspector
          const entitiesMap = new Map();
          dbs.forEach(db => {
            if (db.fullEntity) {
              entitiesMap.set(db.qualifiedName, db.fullEntity);
            }
          });
          setDatabaseEntities(entitiesMap);

          setDatabases(dbs.map(db => ({
            id: db.qualifiedName,
            name: db.name,
            displayName: db.name,
            qualifiedName: db.qualifiedName,
            count: db.childCount,
            icon: <Folder size={16} />
          })));
        })
        .catch(console.error)
        .finally(() => setIsLoadingLevel(null));
    } else {
      setDatabases([]);
      setSchemas([]);
      setDatabaseEntities(new Map());
      setSchemaEntities(new Map());
      setSelectedDatabase(null);
      setSelectedSchema(null);
    }
  }, [selectedConnection]);

  // Load schemas when database selected
  useEffect(() => {
    if (selectedDatabase && selectedConnection) {
      setIsLoadingLevel('schema');
      const dbQualifiedName = databases.find(db => db.name === selectedDatabase)?.qualifiedName;
      if (dbQualifiedName) {
        getSchemas(dbQualifiedName)
          .then(schs => {
            // Store full entities for inspector
            const entitiesMap = new Map();
            schs.forEach(sch => {
              if (sch.fullEntity) {
                entitiesMap.set(sch.qualifiedName, sch.fullEntity);
              }
            });
            setSchemaEntities(entitiesMap);

            setSchemas(schs.map(sch => ({
              id: sch.qualifiedName,
              name: sch.name,
              displayName: sch.name,
              qualifiedName: sch.qualifiedName,
              count: sch.childCount,
              icon: <Table2 size={16} />
            })));
          })
          .catch(console.error)
          .finally(() => setIsLoadingLevel(null));
      }
    } else {
      setSchemas([]);
      setSchemaEntities(new Map());
      setSelectedSchema(null);
    }
  }, [selectedDatabase, selectedConnection, databases]);

  // Handle selection
  const handleSelectConnection = async (connName: string) => {
    setSelectedConnection(connName);
    setSelectedDatabase(null);
    setSelectedSchema(null);
    setActiveDropdown(null);

    setLoading(true);
    try {
      const assets = await loadAssetsForContext('connection', { connectionName: connName });
      const label = generateContextLabel('connection', { connectionName: connName });
      setContext('connection', { connectionName: connName }, label, assets);
    } catch (err) {
      console.error('Failed to load connection context:', err);
    }
    setLoading(false);
  };

  const handleSelectDatabase = async (dbName: string) => {
    setSelectedDatabase(dbName);
    setSelectedSchema(null);
    setActiveDropdown(null);

    if (!selectedConnection) return;

    setLoading(true);
    try {
      const assets = await loadAssetsForContext('database', {
        connectionName: selectedConnection,
        databaseName: dbName
      });
      const label = generateContextLabel('database', {
        connectionName: selectedConnection,
        databaseName: dbName
      });
      setContext('database', { connectionName: selectedConnection, databaseName: dbName }, label, assets);
    } catch (err) {
      console.error('Failed to load database context:', err);
    }
    setLoading(false);
  };

  const handleSelectSchema = async (schemaName: string) => {
    setSelectedSchema(schemaName);
    setActiveDropdown(null);

    if (!selectedConnection || !selectedDatabase) return;

    setLoading(true);
    try {
      const assets = await loadAssetsForContext('schema', {
        connectionName: selectedConnection,
        databaseName: selectedDatabase,
        schemaName
      });
      const label = generateContextLabel('schema', {
        connectionName: selectedConnection,
        databaseName: selectedDatabase,
        schemaName
      });
      setContext('schema', {
        connectionName: selectedConnection,
        databaseName: selectedDatabase,
        schemaName
      }, label, assets);
    } catch (err) {
      console.error('Failed to load schema context:', err);
    }
    setLoading(false);
  };

  const handleClearContext = () => {
    setSelectedConnection(null);
    setSelectedDatabase(null);
    setSelectedSchema(null);
    setActiveDropdown(null);
  };

  const getConnectionIcon = (name: string) => {
    const lower = name.toLowerCase();
    if (lower.includes('snowflake')) return <Snowflake size={16} />;
    if (lower.includes('bigquery')) return <Database size={16} />;
    return <Link2 size={16} />;
  };

  // Calculate total asset count
  const assetCount = contextAssets.length;

  return (
    <div className="hierarchical-context-bar" ref={barRef}>
      <div className="context-breadcrumbs">
        {/* Connection Level */}
        <div className="breadcrumb-segment">
          <button
            className={`breadcrumb-trigger ${activeDropdown === 'connection' ? 'active' : ''} ${selectedConnection ? 'selected' : ''}`}
            onClick={() => setActiveDropdown(activeDropdown === 'connection' ? null : 'connection')}
          >
            {selectedConnection ? (
              <>
                {getConnectionIcon(selectedConnection)}
                <span className="breadcrumb-label">{selectedConnection}</span>
              </>
            ) : (
              <>
                <Database size={16} />
                <span className="breadcrumb-label breadcrumb-placeholder">Connection</span>
              </>
            )}
            <ChevronDown size={14} className="breadcrumb-chevron" />
          </button>

          {activeDropdown === 'connection' && (
            <div className="breadcrumb-dropdown">
              <div className="dropdown-header">
                <span>Select Connection</span>
                <span className="dropdown-count">{connections.length} available</span>
              </div>
              <div className="dropdown-items">
                {connections.map(conn => (
                  <button
                    key={conn.id}
                    className={`dropdown-item ${selectedConnection === conn.name ? 'selected' : ''}`}
                    onClick={() => handleSelectConnection(conn.name)}
                  >
                    {getConnectionIcon(conn.name)}
                    <span className="item-name">{conn.name}</span>
                    {conn.assetCount !== undefined && (
                      <span className="item-count">{conn.assetCount.toLocaleString()}</span>
                    )}
                    {selectedConnection === conn.name && (
                      <Check size={14} className="item-check" />
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Separator */}
        {selectedConnection && (
          <ChevronRight size={14} className="breadcrumb-separator" />
        )}

        {/* Database Level */}
        {selectedConnection && (
          <div className="breadcrumb-segment">
            <button
              className={`breadcrumb-trigger ${activeDropdown === 'database' ? 'active' : ''} ${selectedDatabase ? 'selected' : ''}`}
              onClick={() => setActiveDropdown(activeDropdown === 'database' ? null : 'database')}
              disabled={isLoadingLevel === 'database'}
            >
              {selectedDatabase ? (
                <>
                  <Folder size={16} />
                  <span className="breadcrumb-label">{selectedDatabase}</span>
                </>
              ) : (
                <>
                  <Folder size={16} />
                  <span className="breadcrumb-label breadcrumb-placeholder">
                    {isLoadingLevel === 'database' ? 'Loading...' : 'Database'}
                  </span>
                </>
              )}
              {isLoadingLevel === 'database' ? (
                <Loader2 size={14} className="breadcrumb-spinner" />
              ) : (
                <ChevronDown size={14} className="breadcrumb-chevron" />
              )}
            </button>

            {activeDropdown === 'database' && databases.length > 0 && (
              <div className="breadcrumb-dropdown">
                <div className="dropdown-header">
                  <span>Select Database</span>
                  <span className="dropdown-count">{databases.length} available</span>
                </div>
                <div className="dropdown-items">
                  {databases.map(db => (
                    <div key={db.id} className="dropdown-item-wrapper">
                      <button
                        className={`dropdown-item ${selectedDatabase === db.name ? 'selected' : ''}`}
                        onClick={() => handleSelectDatabase(db.name)}
                      >
                        <Folder size={16} />
                        <span className="item-name">{db.displayName}</span>
                        {db.count !== undefined && (
                          <span className="item-count">{db.count.toLocaleString()}</span>
                        )}
                        {selectedDatabase === db.name && (
                          <Check size={14} className="item-check" />
                        )}
                      </button>
                      {/* Info button to open inspector */}
                      {databaseEntities.has(db.id) && (
                        <button
                          className="item-info-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            const entity = databaseEntities.get(db.id);
                            if (entity) openInspector(entity);
                          }}
                          title="View database details"
                        >
                          <Info size={14} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Separator */}
        {selectedDatabase && (
          <ChevronRight size={14} className="breadcrumb-separator" />
        )}

        {/* Schema Level */}
        {selectedDatabase && (
          <div className="breadcrumb-segment">
            <button
              className={`breadcrumb-trigger ${activeDropdown === 'schema' ? 'active' : ''} ${selectedSchema ? 'selected' : ''}`}
              onClick={() => setActiveDropdown(activeDropdown === 'schema' ? null : 'schema')}
              disabled={isLoadingLevel === 'schema'}
            >
              {selectedSchema ? (
                <>
                  <Table2 size={16} />
                  <span className="breadcrumb-label">{selectedSchema}</span>
                </>
              ) : (
                <>
                  <Table2 size={16} />
                  <span className="breadcrumb-label breadcrumb-placeholder">
                    {isLoadingLevel === 'schema' ? 'Loading...' : 'Schema'}
                  </span>
                </>
              )}
              {isLoadingLevel === 'schema' ? (
                <Loader2 size={14} className="breadcrumb-spinner" />
              ) : (
                <ChevronDown size={14} className="breadcrumb-chevron" />
              )}
            </button>

            {activeDropdown === 'schema' && schemas.length > 0 && (
              <div className="breadcrumb-dropdown">
                <div className="dropdown-header">
                  <span>Select Schema</span>
                  <span className="dropdown-count">{schemas.length} available</span>
                </div>
                <div className="dropdown-items">
                  {schemas.map(sch => (
                    <div key={sch.id} className="dropdown-item-wrapper">
                      <button
                        className={`dropdown-item ${selectedSchema === sch.name ? 'selected' : ''}`}
                        onClick={() => handleSelectSchema(sch.name)}
                      >
                        <Table2 size={16} />
                        <span className="item-name">{sch.displayName}</span>
                        {sch.count !== undefined && (
                          <span className="item-count">{sch.count.toLocaleString()}</span>
                        )}
                        {selectedSchema === sch.name && (
                          <Check size={14} className="item-check" />
                        )}
                      </button>
                      {/* Info button to open inspector */}
                      {schemaEntities.has(sch.id) && (
                        <button
                          className="item-info-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            const entity = schemaEntities.get(sch.id);
                            if (entity) openInspector(entity);
                          }}
                          title="View schema details"
                        >
                          <Info size={14} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Asset Count Badge */}
        {assetCount > 0 && (
          <>
            <div className="breadcrumb-divider" />
            <div className="asset-count-badge">
              <Table2 size={14} />
              <span className="count-number">{assetCount.toLocaleString()}</span>
              <span className="count-label">assets</span>
            </div>
          </>
        )}
      </div>

      {/* Clear Context Button */}
      {selectedConnection && (
        <button
          className="context-clear-btn"
          onClick={handleClearContext}
          title="Clear context and show all"
        >
          <X size={14} />
          <span>Clear</span>
        </button>
      )}
    </div>
  );
}
