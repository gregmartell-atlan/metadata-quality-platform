import { useMemo, useState } from 'react';
import type { AtlanAsset } from '../../services/atlan/types';
import { extractConnection, extractDatabase, extractSchema } from '../../utils/pivotDimensions';
import './HierarchyFilter.css';

export type HierarchyLevel = 'connection' | 'database' | 'schema';

export interface HierarchyFilter {
  level: HierarchyLevel;
  connectionName?: string;
  databaseName?: string;
  schemaName?: string;
}

interface HierarchyFilterProps {
  assets: AtlanAsset[];
  filter: HierarchyFilter;
  onChange: (filter: HierarchyFilter) => void;
}

/**
 * Extract unique values from assets for each hierarchy level
 */
function extractHierarchyOptions(assets: AtlanAsset[]) {
  const connections = new Set<string>();
  const databasesByConn = new Map<string, Set<string>>();
  const schemasByConnDb = new Map<string, Set<string>>();

  assets.forEach((asset) => {
    // Use extractConnection for robust connection name extraction
    const connName = extractConnection(asset);
    connections.add(connName);

    if ('databaseQualifiedName' in asset && asset.databaseQualifiedName) {
      const dbName = asset.databaseName || extractNameFromQualified(asset.databaseQualifiedName);
      if (dbName) {
        if (!databasesByConn.has(connName)) {
          databasesByConn.set(connName, new Set());
        }
        databasesByConn.get(connName)!.add(dbName);

        if ('schemaQualifiedName' in asset && asset.schemaQualifiedName) {
          const schemaName = asset.schemaName || extractNameFromQualified(asset.schemaQualifiedName);
          if (schemaName) {
            const key = `${connName}::${dbName}`;
            if (!schemasByConnDb.has(key)) {
              schemasByConnDb.set(key, new Set());
            }
            schemasByConnDb.get(key)!.add(schemaName);
          }
        }
      }
    }
  });

  return { connections, databasesByConn, schemasByConnDb };
}

function extractNameFromQualified(qn: string): string {
  const parts = qn.split('/');
  return parts[parts.length - 1] || qn;
}

export function HierarchyFilter({ assets, filter, onChange }: HierarchyFilterProps) {
  const options = useMemo(() => extractHierarchyOptions(assets), [assets]);

  const availableDatabases = filter.connectionName
    ? Array.from(options.databasesByConn.get(filter.connectionName) || []).sort()
    : [];

  const availableSchemas =
    filter.connectionName && filter.databaseName
      ? Array.from(
          options.schemasByConnDb.get(`${filter.connectionName}::${filter.databaseName}`) || []
        ).sort()
      : [];

  const handleLevelChange = (level: HierarchyLevel) => {
    const newFilter: HierarchyFilter = { level };
    if (level === 'connection') {
      // Keep connection if it exists
      if (filter.connectionName) {
        newFilter.connectionName = filter.connectionName;
      }
    } else if (level === 'database') {
      // Keep connection and database if they exist
      if (filter.connectionName) {
        newFilter.connectionName = filter.connectionName;
      }
      if (filter.databaseName) {
        newFilter.databaseName = filter.databaseName;
      }
    } else if (level === 'schema') {
      // Keep all if they exist
      newFilter.connectionName = filter.connectionName;
      newFilter.databaseName = filter.databaseName;
      newFilter.schemaName = filter.schemaName;
    }
    onChange(newFilter);
  };

  const handleConnectionChange = (connectionName: string) => {
    onChange({
      level: filter.level,
      connectionName: connectionName || undefined,
      databaseName: undefined, // Reset when connection changes
      schemaName: undefined, // Reset when connection changes
    });
  };

  const handleDatabaseChange = (databaseName: string) => {
    onChange({
      level: filter.level,
      connectionName: filter.connectionName,
      databaseName: databaseName || undefined,
      schemaName: undefined, // Reset when database changes
    });
  };

  const handleSchemaChange = (schemaName: string) => {
    onChange({
      level: filter.level,
      connectionName: filter.connectionName,
      databaseName: filter.databaseName,
      schemaName: schemaName || undefined,
    });
  };

  const clearFilter = () => {
    onChange({ level: 'connection' });
  };

  const hasActiveFilter = filter.connectionName || filter.databaseName || filter.schemaName;

  return (
    <div className="hierarchy-filter">
      <div className="filter-header">
        <label className="filter-label">
          <span className="filter-icon">🔍</span>
          Hierarchy Filter
        </label>
        {hasActiveFilter && (
          <button className="clear-filter-btn" onClick={clearFilter} title="Clear all filters">
            Clear
          </button>
        )}
      </div>

      <div className="filter-controls">
        {/* Level Selector */}
        <div className="filter-group">
          <label className="filter-group-label">Start Level</label>
          <div className="level-buttons">
            <button
              className={`level-btn ${filter.level === 'connection' ? 'active' : ''}`}
              onClick={() => handleLevelChange('connection')}
              title="Show all connections and everything below"
            >
              Connection
            </button>
            <button
              className={`level-btn ${filter.level === 'database' ? 'active' : ''}`}
              onClick={() => handleLevelChange('database')}
              disabled={!filter.connectionName}
              title="Show selected database and everything below (requires connection)"
            >
              Database
            </button>
            <button
              className={`level-btn ${filter.level === 'schema' ? 'active' : ''}`}
              onClick={() => handleLevelChange('schema')}
              disabled={!filter.connectionName || !filter.databaseName}
              title="Show selected schema and everything below (requires connection + database)"
            >
              Schema
            </button>
          </div>
        </div>

        {/* Connection Selector */}
        <div className="filter-group">
          <label className="filter-group-label">Connection</label>
          <select
            value={filter.connectionName || ''}
            onChange={(e) => handleConnectionChange(e.target.value)}
            className="filter-select"
          >
            <option value="">All Connections</option>
            {Array.from(options.connections).sort().map((conn) => (
              <option key={conn} value={conn}>
                {conn}
              </option>
            ))}
          </select>
        </div>

        {/* Database Selector - only show if connection selected and level allows */}
        {(filter.level === 'database' || filter.level === 'schema') && filter.connectionName && (
          <div className="filter-group">
            <label className="filter-group-label">Database</label>
            <select
              value={filter.databaseName || ''}
              onChange={(e) => handleDatabaseChange(e.target.value)}
              className="filter-select"
              disabled={!filter.connectionName}
            >
              <option value="">All Databases</option>
              {availableDatabases.map((db) => (
                <option key={db} value={db}>
                  {db}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Schema Selector - only show if database selected and level allows */}
        {filter.level === 'schema' && filter.connectionName && filter.databaseName && (
          <div className="filter-group">
            <label className="filter-group-label">Schema</label>
            <select
              value={filter.schemaName || ''}
              onChange={(e) => handleSchemaChange(e.target.value)}
              className="filter-select"
              disabled={!filter.connectionName || !filter.databaseName}
            >
              <option value="">All Schemas</option>
              {availableSchemas.map((schema) => (
                <option key={schema} value={schema}>
                  {schema}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Active Filter Summary */}
      {hasActiveFilter && (
        <div className="filter-summary">
          <span className="filter-summary-label">Filtering by:</span>
          <span className="filter-summary-value">
            {filter.connectionName && (
              <span className="filter-tag">
                Connection: <strong>{filter.connectionName}</strong>
              </span>
            )}
            {filter.databaseName && (
              <span className="filter-tag">
                Database: <strong>{filter.databaseName}</strong>
              </span>
            )}
            {filter.schemaName && (
              <span className="filter-tag">
                Schema: <strong>{filter.schemaName}</strong>
              </span>
            )}
          </span>
        </div>
      )}
    </div>
  );
}

