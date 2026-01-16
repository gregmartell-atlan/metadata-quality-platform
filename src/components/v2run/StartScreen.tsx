/**
 * StartScreen Component
 *
 * Initial screen for creating a new V2 assessment run.
 * Supports scoping by database, schema, or query.
 */

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Database, FolderTree, Search, Play, Loader2 } from 'lucide-react';
import { createRun, ingestRun, type RunScope } from '../../services/v2Api';
import { useBackendModeStore } from '../../stores/backendModeStore';
import capabilities from '../../data/v2/capabilities.json';

interface SchemaOption {
  name: string;
  qualifiedName: string;
  database: string;
}

export function StartScreen() {
  const navigate = useNavigate();
  const [selectedCaps, setSelectedCaps] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [scopeMode, setScopeMode] = useState<'database' | 'schema' | 'query'>('schema');

  // Scope selections
  const [selectedDatabase, setSelectedDatabase] = useState<string>('');
  const [selectedSchema, setSelectedSchema] = useState<string>('');
  const [queryScope, setQueryScope] = useState<string>('');

  // Available options from MDLH
  const [databases, setDatabases] = useState<string[]>([]);
  const [schemas, setSchemas] = useState<SchemaOption[]>([]);
  const [loadingSchemas, setLoadingSchemas] = useState(false);

  // Backend connection status
  const snowflakeConnected = useBackendModeStore((state) => state.snowflakeStatus.connected);
  const sessionId = useBackendModeStore((state) => state.snowflakeStatus.sessionId);

  // Fetch available schemas from MDLH
  const fetchSchemas = useCallback(async () => {
    if (!snowflakeConnected || !sessionId) return;

    setLoadingSchemas(true);
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
        'X-Session-ID': sessionId
      };

      const response = await fetch('/api/mdlh/schemas', { headers });
      if (response.ok) {
        const data = await response.json();
        const schemaList: SchemaOption[] = (data.schemas || []).map((s: any) => ({
          name: s.schema_name || s.name,
          qualifiedName: s.qualified_name || `${s.database_name}/${s.schema_name}`,
          database: s.database_name || 'Unknown'
        }));
        setSchemas(schemaList);

        // Extract unique databases
        const uniqueDbs = [...new Set(schemaList.map(s => s.database))];
        setDatabases(uniqueDbs);
      }
    } catch (err) {
      console.error('Failed to fetch schemas:', err);
    } finally {
      setLoadingSchemas(false);
    }
  }, [snowflakeConnected, sessionId]);

  useEffect(() => {
    fetchSchemas();
  }, [fetchSchemas]);

  const handleToggleCap = (id: string) => {
    setSelectedCaps((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    );
  };

  const handleStart = async () => {
    if (selectedCaps.length === 0) {
      alert('Please select at least one capability to assess');
      return;
    }

    setLoading(true);
    try {
      // Build scope based on mode
      let scope: RunScope | undefined;

      if (scopeMode === 'schema' && selectedSchema) {
        scope = { schemaQualifiedName: selectedSchema };
      } else if (scopeMode === 'database' && selectedDatabase) {
        scope = { databaseQualifiedName: selectedDatabase };
      } else if (scopeMode === 'query' && queryScope) {
        scope = { query: queryScope };
      }

      // Create the run
      const run = await createRun(scope, selectedCaps);

      // Start ingestion if connected
      if (snowflakeConnected) {
        try {
          await ingestRun(run.id);
        } catch (err) {
          console.error('Failed to start ingestion:', err);
        }
      }

      // Navigate to the run dashboard
      navigate(`/assessment/run/${run.id}`);
    } catch (e) {
      console.error('Failed to start run:', e);
      alert('Failed to create assessment run');
    } finally {
      setLoading(false);
    }
  };

  // Filter schemas by selected database
  const filteredSchemas = selectedDatabase
    ? schemas.filter((s) => s.database === selectedDatabase)
    : schemas;

  return (
    <div className="max-w-3xl mx-auto py-8 px-4">
      <h1 className="text-2xl font-bold mb-2">New Assessment Run</h1>
      <p className="text-gray-600 mb-8">
        Select capabilities to assess and optionally scope to specific schemas or databases.
      </p>

      {/* Connection Status */}
      {!snowflakeConnected && (
        <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p className="text-yellow-800 text-sm">
            <strong>Snowflake not connected.</strong> Connect via Settings to load assets from MDLH.
            You can still create a run, but no data will be ingested.
          </p>
        </div>
      )}

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 space-y-6">
        {/* Scope Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-3">
            Scope (Optional)
          </label>

          {/* Scope Mode Tabs */}
          <div className="flex gap-2 mb-4">
            <button
              onClick={() => setScopeMode('schema')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition ${
                scopeMode === 'schema'
                  ? 'bg-blue-100 text-blue-700 border border-blue-300'
                  : 'bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100'
              }`}
            >
              <FolderTree size={16} />
              Schema
            </button>
            <button
              onClick={() => setScopeMode('database')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition ${
                scopeMode === 'database'
                  ? 'bg-blue-100 text-blue-700 border border-blue-300'
                  : 'bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100'
              }`}
            >
              <Database size={16} />
              Database
            </button>
            <button
              onClick={() => setScopeMode('query')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition ${
                scopeMode === 'query'
                  ? 'bg-blue-100 text-blue-700 border border-blue-300'
                  : 'bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100'
              }`}
            >
              <Search size={16} />
              Query
            </button>
          </div>

          {/* Scope Inputs */}
          {scopeMode === 'schema' && (
            <div className="space-y-3">
              <select
                value={selectedDatabase}
                onChange={(e) => {
                  setSelectedDatabase(e.target.value);
                  setSelectedSchema('');
                }}
                className="w-full border border-gray-300 rounded-md p-2"
                disabled={!snowflakeConnected || loadingSchemas}
              >
                <option value="">All Databases</option>
                {databases.map((db) => (
                  <option key={db} value={db}>
                    {db}
                  </option>
                ))}
              </select>

              <select
                value={selectedSchema}
                onChange={(e) => setSelectedSchema(e.target.value)}
                className="w-full border border-gray-300 rounded-md p-2"
                disabled={!snowflakeConnected || loadingSchemas}
              >
                <option value="">All Schemas</option>
                {filteredSchemas.map((schema) => (
                  <option key={schema.qualifiedName} value={schema.qualifiedName}>
                    {schema.database}.{schema.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {scopeMode === 'database' && (
            <select
              value={selectedDatabase}
              onChange={(e) => setSelectedDatabase(e.target.value)}
              className="w-full border border-gray-300 rounded-md p-2"
              disabled={!snowflakeConnected || loadingSchemas}
            >
              <option value="">All Databases</option>
              {databases.map((db) => (
                <option key={db} value={db}>
                  {db}
                </option>
              ))}
            </select>
          )}

          {scopeMode === 'query' && (
            <input
              type="text"
              value={queryScope}
              onChange={(e) => setQueryScope(e.target.value)}
              placeholder="e.g., asset_name LIKE '%customer%'"
              className="w-full border border-gray-300 rounded-md p-2"
            />
          )}

          <p className="text-xs text-gray-500 mt-2">
            Leave empty to assess all available assets
          </p>
        </div>

        {/* Capability Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-3">
            Select Capabilities to Assess
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {capabilities.map((cap) => (
              <button
                key={cap.id}
                type="button"
                onClick={() => handleToggleCap(cap.id)}
                className={`p-4 border rounded-lg text-left transition ${
                  selectedCaps.includes(cap.id)
                    ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200'
                    : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'
                }`}
                aria-pressed={selectedCaps.includes(cap.id)}
              >
                <div className="font-medium text-gray-900">{cap.name}</div>
                <div className="text-xs text-gray-500 mt-1">{cap.group}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Selected Summary */}
        {selectedCaps.length > 0 && (
          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-sm text-gray-700">
              <strong>{selectedCaps.length}</strong> capabilities selected:
              <span className="text-gray-500 ml-2">
                {selectedCaps.map((c) => capabilities.find((cap) => cap.id === c)?.name).join(', ')}
              </span>
            </p>
          </div>
        )}

        {/* Start Button */}
        <button
          onClick={handleStart}
          disabled={loading || selectedCaps.length === 0}
          className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white py-3 px-6 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
        >
          {loading ? (
            <>
              <Loader2 className="animate-spin" size={20} />
              Creating Run...
            </>
          ) : (
            <>
              <Play size={20} />
              Start Assessment
            </>
          )}
        </button>
      </div>
    </div>
  );
}
