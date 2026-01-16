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
import { useBackendModeStore } from '../../stores/backendModeStore';
import { type ConnectorInfo, type HierarchyItem } from '../../services/atlan/api';
import * as unifiedLoader from '../../utils/unifiedAssetLoader';
import {
  loadAssetsForContext,
  generateContextLabel,
  loadAllAssetsWithMetadata,
  loadAssetsForConnectionWithMetadata,
} from '../../utils/assetContextLoader';
import { LoadingProgress } from '../shared/LoadingProgress';
import { PopularityIndicator, getPopularityLevel } from '../shared/PopularityBadge';
import { logger } from '../../utils/logger';
import type { AtlanAsset } from '../../services/atlan/types';
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
  popularityLevel?: 'hot' | 'warm' | 'normal';
  guid?: string;
}

// Helper to extract popularity level from a full entity
function getEntityPopularityLevel(entity: any): 'hot' | 'warm' | 'normal' {
  if (!entity) return 'normal';
  const attrs = entity.attributes || entity;
  // Create minimal asset object for popularity calculation
  const assetLike: Partial<AtlanAsset> = {
    popularityScore: attrs.popularityScore,
    sourceReadCount: attrs.sourceReadCount,
    sourceReadUserCount: attrs.sourceReadUserCount,
    starredCount: attrs.starredCount,
  };
  return getPopularityLevel(assetLike as AtlanAsset);
}

// Helper to transform fullEntity to AtlanAsset format for inspector
function transformEntityForInspector(entity: any): any {
  if (!entity) return null;

  const e = entity;
  return {
    guid: e.guid,
    typeName: e.typeName,
    name: e.attributes?.name || e.name,
    qualifiedName: e.attributes?.qualifiedName || e.qualifiedName,
    connectionName: e.attributes?.connectionName || e.attributes?.connectorName,
    connectionQualifiedName: e.attributes?.connectionQualifiedName,
    // Governance
    description: e.attributes?.description,
    userDescription: e.attributes?.userDescription,
    ownerUsers: e.attributes?.ownerUsers,
    ownerGroups: e.attributes?.ownerGroups,
    certificateStatus: e.attributes?.certificateStatus,
    certificateStatusMessage: e.attributes?.certificateStatusMessage,
    certificateUpdatedAt: e.attributes?.certificateUpdatedAt,
    certificateUpdatedBy: e.attributes?.certificateUpdatedBy,
    classificationNames: e.attributes?.classificationNames,
    atlanTags: e.classifications?.map((tag: any) => ({
      typeName: tag.typeName,
      propagate: tag.propagate,
    })),
    meanings: e.attributes?.meanings,
    assignedTerms: e.attributes?.assignedTerms,
    domainGUIDs: e.attributes?.domainGUIDs,
    // Technical
    createTime: e.attributes?.createTime,
    updateTime: e.attributes?.updateTime,
    createdBy: e.attributes?.createdBy,
    updatedBy: e.attributes?.updatedBy,
  };
}

export function HierarchicalContextBar() {
  const {
    context,
    contextAssets,
    setContext,
    setContextWithMetadata,
    setLoading,
    loadingProgress,
    setLoadingProgress,
  } = useAssetContextStore();
  const { openInspector } = useAssetInspectorStore();
  
  // Get backend status - needed for connection-based reloading
  const { dataBackend, snowflakeStatus, isInFallbackMode, connectionVersion } = useBackendModeStore();
  const isSnowflakeConnected = snowflakeStatus.connected;

  // Dropdown state
  const [activeDropdown, setActiveDropdown] = useState<'connection' | 'database' | 'schema' | 'table' | null>(null);
  const [isLoadingLevel, setIsLoadingLevel] = useState<string | null>(null);

  // Data
  const [connections, setConnections] = useState<ConnectorInfo[]>([]);
  const [databases, setDatabases] = useState<DropdownItem[]>([]);
  const [schemas, setSchemas] = useState<DropdownItem[]>([]);
  const [tables, setTables] = useState<DropdownItem[]>([]);

  // Full entities for inspector
  const [connectionEntities, setConnectionEntities] = useState<Map<string, any>>(new Map());
  const [databaseEntities, setDatabaseEntities] = useState<Map<string, any>>(new Map());
  const [schemaEntities, setSchemaEntities] = useState<Map<string, any>>(new Map());
  const [tableEntities, setTableEntities] = useState<Map<string, any>>(new Map());

  // Selection state
  const [selectedConnection, setSelectedConnection] = useState<string | null>(null);
  const [selectedDatabase, setSelectedDatabase] = useState<string | null>(null);
  const [selectedSchema, setSelectedSchema] = useState<string | null>(null);
  const [selectedTable, setSelectedTable] = useState<string | null>(null);

  // Refs for click-outside handling
  const barRef = useRef<HTMLDivElement>(null);

  // Load connections on mount AND when connection version changes
  // connectionVersion increments whenever Snowflake connects/disconnects
  // This ensures the hierarchy reloads from MDLH when user connects to Snowflake
  useEffect(() => {
    logger.info('[HierarchicalContextBar] Loading connectors, connectionVersion:', connectionVersion, 'connected:', isSnowflakeConnected);
    unifiedLoader.loadConnectors()
      .then(result => {
        const conns = result.data;
        // Store full entities for inspector
        const entitiesMap = new Map();
        conns.forEach(conn => {
          if (conn.fullEntity) {
            entitiesMap.set(conn.name, conn.fullEntity);
          }
        });
        setConnectionEntities(entitiesMap);
        setConnections(conns);
        
        if (result.fallbackUsed) {
          logger.warn('HierarchicalContextBar: Used API fallback for connectors:', result.fallbackReason);
        }
        logger.info('[HierarchicalContextBar] Loaded connectors:', conns.length, 'source:', result.source);
      })
      .catch(logger.error);
  }, [connectionVersion]);

  // Sync with context store
  useEffect(() => {
    if (context) {
      setSelectedConnection(context.filters.connectionName || null);
      setSelectedDatabase(context.filters.databaseName || null);
      setSelectedSchema(context.filters.schemaName || null);
      setSelectedTable(context.filters.tableName || null);
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

  // Load databases when connection selected using unified loader
  useEffect(() => {
    if (selectedConnection) {
      setIsLoadingLevel('database');
      unifiedLoader.loadDatabases(selectedConnection)
        .then(result => {
          const dbs = result.data;
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
            icon: <Folder size={16} />,
            popularityLevel: getEntityPopularityLevel(db.fullEntity)
          })));
          
          if (result.fallbackUsed) {
            logger.warn('HierarchicalContextBar: Used API fallback for databases:', result.fallbackReason);
          }
        })
        .catch(logger.error)
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

  // Load schemas when database selected using unified loader
  useEffect(() => {
    if (selectedDatabase && selectedConnection) {
      setIsLoadingLevel('schema');
      const dbQualifiedName = databases.find(db => db.name === selectedDatabase)?.qualifiedName;
      if (dbQualifiedName) {
        unifiedLoader.loadSchemas(selectedConnection, dbQualifiedName, selectedDatabase)
          .then(result => {
            const schs = result.data;
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
              icon: <Table2 size={16} />,
              popularityLevel: getEntityPopularityLevel(sch.fullEntity)
            })));
            
            if (result.fallbackUsed) {
              logger.warn('HierarchicalContextBar: Used API fallback for schemas:', result.fallbackReason);
            }
          })
          .catch(logger.error)
          .finally(() => setIsLoadingLevel(null));
      }
    } else {
      setSchemas([]);
      setSchemaEntities(new Map());
      setSelectedSchema(null);
      setTables([]);
      setTableEntities(new Map());
      setSelectedTable(null);
    }
  }, [selectedDatabase, selectedConnection, databases]);

  // Load tables when schema selected using unified loader
  useEffect(() => {
    if (selectedSchema && selectedDatabase && selectedConnection) {
      setIsLoadingLevel('table');
      const schemaQualifiedName = schemas.find(s => s.name === selectedSchema)?.qualifiedName;
      if (schemaQualifiedName) {
        unifiedLoader.loadTables(selectedConnection, selectedDatabase, schemaQualifiedName, selectedSchema)
          .then(result => {
            const tbls = result.data;
            // Store full entities for inspector
            const entitiesMap = new Map();
            tbls.forEach(tbl => {
              if (tbl.fullEntity) {
                entitiesMap.set(tbl.qualifiedName, tbl.fullEntity);
              }
            });
            setTableEntities(entitiesMap);

            setTables(tbls.map(tbl => ({
              id: tbl.qualifiedName,
              guid: tbl.guid, // Store actual GUID for asset lookup
              name: tbl.name,
              displayName: tbl.name,
              qualifiedName: tbl.qualifiedName,
              count: tbl.childCount, // column count
              icon: <Table2 size={16} />,
              popularityLevel: getEntityPopularityLevel(tbl.fullEntity)
            })));
            
            if (result.fallbackUsed) {
              logger.warn('HierarchicalContextBar: Used API fallback for tables:', result.fallbackReason);
            }
          })
          .catch(logger.error)
          .finally(() => setIsLoadingLevel(null));
      }
    } else {
      setTables([]);
      setTableEntities(new Map());
      setSelectedTable(null);
    }
  }, [selectedSchema, selectedDatabase, selectedConnection, schemas]);

  // Handle selection
  const handleSelectConnection = async (connName: string) => {
    setSelectedConnection(connName);
    setSelectedDatabase(null);
    setSelectedSchema(null);
    setActiveDropdown(null);

    setLoading(true);
    setLoadingProgress(null);
    try {
      // Use WithMetadata variant for connection loading - supports large datasets with progress
      const result = await loadAssetsForConnectionWithMetadata(connName, {
        onProgress: (loaded, total) => {
          setLoadingProgress({ loaded, total });
        },
      });
      const label = generateContextLabel('connection', { connectionName: connName });
      setContextWithMetadata(
        'connection',
        { connectionName: connName },
        label,
        result.assets,
        {
          totalCount: result.totalCount,
          isSampled: result.isSampled,
          sampleRate: result.sampleRate,
        }
      );
    } catch (err) {
      logger.error('Failed to load connection context:', err);
    }
    setLoadingProgress(null);
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
      logger.error('Failed to load database context:', err);
    }
    setLoading(false);
  };

  const handleSelectSchema = async (schemaName: string) => {
    setSelectedSchema(schemaName);
    setSelectedTable(null); // Clear table when schema changes
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
      logger.error('Failed to load schema context:', err);
    }
    setLoading(false);
  };

  const handleSelectTable = async (tableName: string) => {
    setSelectedTable(tableName);
    setActiveDropdown(null);

    if (!selectedConnection || !selectedDatabase || !selectedSchema) return;

    const tableItem = tables.find(t => t.name === tableName);

    setLoading(true);
    try {
      const assets = await loadAssetsForContext('table', {
        connectionName: selectedConnection,
        databaseName: selectedDatabase,
        schemaName: selectedSchema,
        tableName,
        assetGuid: tableItem?.guid // Use actual GUID for asset lookup
      });
      const label = generateContextLabel('table', {
        connectionName: selectedConnection,
        databaseName: selectedDatabase,
        schemaName: selectedSchema,
        tableName
      });
      setContext('table', {
        connectionName: selectedConnection,
        databaseName: selectedDatabase,
        schemaName: selectedSchema,
        tableName,
        assetGuid: tableItem?.guid
      }, label, assets);
    } catch (err) {
      logger.error('Failed to load table context:', err);
    }
    setLoading(false);
  };

  const handleClearContext = async () => {
    // Clear local selection state
    setSelectedConnection(null);
    setSelectedDatabase(null);
    setSelectedSchema(null);
    setSelectedTable(null);
    setActiveDropdown(null);

    // Load all assets as the default context
    setLoading(true);
    setLoadingProgress(null);
    try {
      // Use WithMetadata variant for all assets - supports large datasets with progress
      const result = await loadAllAssetsWithMetadata({
        onProgress: (loaded, total) => {
          setLoadingProgress({ loaded, total });
        },
      });
      const label = generateContextLabel('all', {});
      setContextWithMetadata(
        'all',
        {},
        label,
        result.assets,
        {
          totalCount: result.totalCount,
          isSampled: result.isSampled,
          sampleRate: result.sampleRate,
        }
      );
    } catch (err) {
      logger.error('Failed to load all assets:', err);
      // Clear context on error - shows empty state
      useAssetContextStore.getState().clearContext();
    }
    setLoadingProgress(null);
    setLoading(false);
  };

  const getConnectionIcon = (name: string) => {
    const lower = name.toLowerCase();
    if (lower.includes('snowflake')) return <Snowflake size={16} />;
    if (lower.includes('bigquery')) return <Database size={16} />;
    return <Link2 size={16} />;
  };

  // Calculate total asset count
  const assetCount = contextAssets.length;

  // Check if we're in "All Assets" mode
  const isAllAssetsMode = context?.type === 'all';

  // Get backend status for indicator
  const isUsingMdlh = dataBackend === 'mdlh' && snowflakeStatus.connected && !isInFallbackMode;

  return (
    <div className="hierarchical-context-bar" ref={barRef}>
      <div className="context-breadcrumbs">
        {/* All Assets indicator - shown when context is 'all' */}
        {isAllAssetsMode && (
          <>
            <div className="breadcrumb-segment">
              <span className="breadcrumb-trigger selected all-assets-badge">
                <Database size={16} />
                <span className="breadcrumb-label">All Assets</span>
                {assetCount > 0 && (
                  <span className="breadcrumb-count-pill">{assetCount.toLocaleString()}</span>
                )}
              </span>
            </div>
            <span className="breadcrumb-separator">/</span>
          </>
        )}

        {/* Connection Level */}
        <div className="breadcrumb-segment">
          <button
            className={`breadcrumb-trigger ${activeDropdown === 'connection' ? 'active' : ''} ${selectedConnection ? 'selected' : ''}`}
            onClick={() => setActiveDropdown(activeDropdown === 'connection' ? null : 'connection')}
          >
            {selectedConnection ? (
              <>
                <span className="breadcrumb-icon">{getConnectionIcon(selectedConnection)}</span>
                <span className="breadcrumb-label">{selectedConnection}</span>
              </>
            ) : (
              <>
                <Database size={16} className="text-muted" />
                <span className="breadcrumb-label breadcrumb-placeholder">
                  {isAllAssetsMode ? 'Filter by Connection' : 'Connection'}
                </span>
              </>
            )}
            <ChevronDown size={12} className="breadcrumb-chevron" />
          </button>

          {activeDropdown === 'connection' && (
            <div className="breadcrumb-dropdown">
              <div className="dropdown-header">
                <span>Select Connection</span>
                <span className="dropdown-count">{connections.length} available</span>
              </div>
              <div className="dropdown-items">
                {/* All Assets option */}
                <div className="dropdown-item-wrapper">
                  <button
                    className={`dropdown-item dropdown-item-all ${isAllAssetsMode && !selectedConnection ? 'selected' : ''}`}
                    onClick={() => {
                      handleClearContext();
                    }}
                  >
                    <Database size={16} />
                    <span className="item-name">All Assets</span>
                    <span className="item-count">Browse all</span>
                    {isAllAssetsMode && !selectedConnection && (
                      <Check size={14} className="item-check" />
                    )}
                  </button>
                </div>
                <div className="dropdown-divider" />
                {connections.map(conn => (
                  <div key={conn.id} className="dropdown-item-wrapper">
                    <button
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
                    {connectionEntities.has(conn.name) && (
                      <button
                        className="item-info-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          const entity = connectionEntities.get(conn.name);
                          if (entity) {
                            const transformed = transformEntityForInspector(entity);
                            openInspector(transformed);
                          }
                        }}
                        title="View connection details"
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

        {/* Separator */}
        <span className="breadcrumb-separator">/</span>

        {/* Database Level */}
        <div className="breadcrumb-segment">
          <button
            className={`breadcrumb-trigger ${activeDropdown === 'database' ? 'active' : ''} ${selectedDatabase ? 'selected' : ''}`}
            onClick={() => {
              if (selectedConnection) setActiveDropdown(activeDropdown === 'database' ? null : 'database');
            }}
            disabled={!selectedConnection || isLoadingLevel === 'database'}
          >
            {selectedDatabase ? (
              <>
                <span className="breadcrumb-label">{selectedDatabase}</span>
              </>
            ) : (
              <span className="breadcrumb-label breadcrumb-placeholder">
                {isLoadingLevel === 'database' ? 'Loading...' : 'Database'}
              </span>
            )}
            {isLoadingLevel === 'database' ? (
              <Loader2 size={12} className="breadcrumb-spinner" />
            ) : (
              <ChevronDown size={12} className="breadcrumb-chevron" />
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
                      <span className="item-name">
                        {db.displayName}
                        {db.popularityLevel && db.popularityLevel !== 'normal' && (
                          <PopularityIndicator level={db.popularityLevel} size="sm" />
                        )}
                      </span>
                      {db.count !== undefined && (
                        <span className="item-count">{db.count.toLocaleString()}</span>
                      )}
                      {selectedDatabase === db.name && (
                        <Check size={14} className="item-check" />
                      )}
                    </button>
                    {databaseEntities.has(db.id) && (
                      <button
                        className="item-info-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          const entity = databaseEntities.get(db.id);
                          if (entity) {
                            const transformed = transformEntityForInspector(entity);
                            openInspector(transformed);
                          }
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

        {/* Separator */}
        <span className="breadcrumb-separator">/</span>

        {/* Schema Level */}
        <div className="breadcrumb-segment">
          <button
            className={`breadcrumb-trigger ${activeDropdown === 'schema' ? 'active' : ''} ${selectedSchema ? 'selected' : ''}`}
            onClick={() => {
              if (selectedDatabase) setActiveDropdown(activeDropdown === 'schema' ? null : 'schema');
            }}
            disabled={!selectedDatabase || isLoadingLevel === 'schema'}
          >
            {selectedSchema ? (
              <>
                <span className="breadcrumb-label">{selectedSchema}</span>
              </>
            ) : (
              <span className="breadcrumb-label breadcrumb-placeholder">
                {isLoadingLevel === 'schema' ? 'Loading...' : 'Schema'}
              </span>
            )}
            {/* Integrated Count for Schema - only show if no table selected */}
            {selectedSchema && !selectedTable && assetCount > 0 && (
              <span className="breadcrumb-count-pill">{assetCount}</span>
            )}

            {isLoadingLevel === 'schema' ? (
              <Loader2 size={12} className="breadcrumb-spinner" />
            ) : (
              <ChevronDown size={12} className="breadcrumb-chevron" />
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
                      <span className="item-name">
                        {sch.displayName}
                        {sch.popularityLevel && sch.popularityLevel !== 'normal' && (
                          <PopularityIndicator level={sch.popularityLevel} size="sm" />
                        )}
                      </span>
                      {sch.count !== undefined && (
                        <span className="item-count">{sch.count.toLocaleString()}</span>
                      )}
                      {selectedSchema === sch.name && (
                        <Check size={14} className="item-check" />
                      )}
                    </button>
                    {schemaEntities.has(sch.id) && (
                      <button
                        className="item-info-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          const entity = schemaEntities.get(sch.id);
                          if (entity) {
                            const transformed = transformEntityForInspector(entity);
                            openInspector(transformed);
                          }
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

        {/* Separator - only show if schema is selected */}
        {selectedSchema && (
          <span className="breadcrumb-separator">/</span>
        )}

        {/* Table Level - only show if schema is selected */}
        {selectedSchema && (
          <div className="breadcrumb-segment">
            <button
              className={`breadcrumb-trigger ${activeDropdown === 'table' ? 'active' : ''} ${selectedTable ? 'selected' : ''}`}
              onClick={() => {
                if (selectedSchema) setActiveDropdown(activeDropdown === 'table' ? null : 'table');
              }}
              disabled={!selectedSchema || isLoadingLevel === 'table'}
            >
              {selectedTable ? (
                <>
                  <span className="breadcrumb-label">{selectedTable}</span>
                </>
              ) : (
                <span className="breadcrumb-label breadcrumb-placeholder">
                  {isLoadingLevel === 'table' ? 'Loading...' : 'Table'}
                </span>
              )}
              {/* Integrated Count for Table */}
              {selectedTable && assetCount > 0 && (
                <span className="breadcrumb-count-pill">{assetCount}</span>
              )}

              {isLoadingLevel === 'table' ? (
                <Loader2 size={12} className="breadcrumb-spinner" />
              ) : (
                <ChevronDown size={12} className="breadcrumb-chevron" />
              )}
            </button>

            {activeDropdown === 'table' && tables.length > 0 && (
              <div className="breadcrumb-dropdown breadcrumb-dropdown-wide">
                <div className="dropdown-header">
                  <span>Select Table</span>
                  <span className="dropdown-count">{tables.length} available</span>
                </div>
                <div className="dropdown-items dropdown-items-scrollable">
                  {tables.map(tbl => (
                    <div key={tbl.id} className="dropdown-item-wrapper">
                      <button
                        className={`dropdown-item ${selectedTable === tbl.name ? 'selected' : ''}`}
                        onClick={() => handleSelectTable(tbl.name)}
                      >
                        <Table2 size={16} />
                        <span className="item-name">
                          {tbl.displayName}
                          {tbl.popularityLevel && tbl.popularityLevel !== 'normal' && (
                            <PopularityIndicator level={tbl.popularityLevel} size="sm" />
                          )}
                        </span>
                        {tbl.count !== undefined && tbl.count > 0 && (
                          <span className="item-count">{tbl.count} cols</span>
                        )}
                        {selectedTable === tbl.name && (
                          <Check size={14} className="item-check" />
                        )}
                      </button>
                      {tableEntities.has(tbl.id) && (
                        <button
                          className="item-info-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            const entity = tableEntities.get(tbl.id);
                            if (entity) {
                              const transformed = transformEntityForInspector(entity);
                              openInspector(transformed);
                            }
                          }}
                          title="View table details"
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

        {/* Clear Context Button - Show if a specific selection is made */}
        {selectedConnection && (
          <button
            className="context-clear-btn-icon"
            onClick={handleClearContext}
            title="Reset to All Assets"
          >
            <X size={14} />
          </button>
        )}

        {/* Progress indicator during bulk asset loading */}
        {loadingProgress && (
          <LoadingProgress
            loaded={loadingProgress.loaded}
            total={loadingProgress.total}
            label="Loading assets"
            variant="compact"
            size="sm"
          />
        )}

        {/* Backend status indicator */}
        <div className="backend-status-indicator" title={isUsingMdlh ? 'Using MDLH (Snowflake)' : isInFallbackMode ? 'API Fallback Mode' : 'Using Atlan API'}>
          {isUsingMdlh ? (
            <span className="backend-badge backend-mdlh">
              <Snowflake size={12} />
              <span>MDLH</span>
            </span>
          ) : isInFallbackMode ? (
            <span className="backend-badge backend-fallback">
              <Link2 size={12} />
              <span>API (fallback)</span>
            </span>
          ) : (
            <span className="backend-badge backend-api">
              <Link2 size={12} />
              <span>API</span>
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
