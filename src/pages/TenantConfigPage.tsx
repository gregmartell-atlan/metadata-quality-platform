import { useState, useCallback, useEffect, useMemo } from 'react';
import { useBackendModeStore } from '../stores/backendModeStore';
import { fieldCatalog } from '../lib/field-catalog';
import {
  TenantConfig,
  TenantFieldMapping,
  SchemaSnapshot,
  ConfigCompleteness,
  loadTenantConfig,
  saveTenantConfig,
  loadSchemaSnapshot,
  saveSchemaSnapshot,
  calculateCompleteness,
  createDefaultConfig,
} from '../lib/tenant-config-types';
import {
  getMdlhSchema,
  reconcileMdlhSchema,
  MdlhSchemaColumn,
  MdlhFieldReconciliation,
  MdlhReconciliationSummary,
} from '../services/mdlhClient';
import './TenantConfigPage.css';

type TabId = 'overview' | 'mappings' | 'classifications' | 'mdlh-schema';

// Completeness ring component
function CompletenessRing({ score, size = 120 }: { score: number; size?: number }) {
  const percent = Math.round(score * 100);
  const strokeWidth = 10;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score * circumference);

  const getColor = () => {
    if (percent >= 90) return '#10b981';
    if (percent >= 70) return '#3b82f6';
    if (percent >= 50) return '#f59e0b';
    return '#ef4444';
  };

  return (
    <div className="completeness-ring" style={{ width: size, height: size }}>
      <svg className="ring-svg" width={size} height={size}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#e5e7eb"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={getColor()}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 0.5s ease' }}
        />
      </svg>
      <div className="ring-label">
        <span style={{ color: getColor() }}>{percent}%</span>
      </div>
    </div>
  );
}

// Stats card component
function StatsCard({ title, value, subtitle, color = 'blue' }: {
  title: string;
  value: string | number;
  subtitle?: string;
  color?: 'blue' | 'green' | 'yellow' | 'red' | 'gray';
}) {
  return (
    <div className={`stats-card stats-card-${color}`}>
      <div className="stats-title">{title}</div>
      <div className="stats-value">{value}</div>
      {subtitle && <div className="stats-subtitle">{subtitle}</div>}
    </div>
  );
}

// Field mapping row component
function FieldMappingRow({
  mapping,
  onStatusChange
}: {
  mapping: TenantFieldMapping;
  onStatusChange: (fieldId: string, status: TenantFieldMapping['status']) => void;
}) {
  const statusColors: Record<string, string> = {
    confirmed: 'status-confirmed',
    auto: 'status-auto',
    pending: 'status-pending',
    rejected: 'status-rejected',
  };

  const reconciliationLabels: Record<string, string> = {
    MATCHED: 'Native match',
    ALIAS_MATCHED: 'Alias match',
    CM_MATCHED: 'Custom metadata',
    CM_SUGGESTED: 'CM suggested',
    CLASSIFICATION: 'Classification',
    NOT_FOUND: 'Not found',
    AMBIGUOUS: 'Ambiguous',
  };

  return (
    <tr className="mapping-row">
      <td className="mapping-field">
        <span className="field-name">{mapping.canonicalFieldId}</span>
        <span className="field-desc">{mapping.canonicalFieldName}</span>
      </td>
      <td>
        {mapping.tenantSource ? (
          <span className="source-badge">
            {mapping.tenantSource.type}
          </span>
        ) : (
          <span className="no-source">-</span>
        )}
      </td>
      <td>
        <span className={`reconciliation-badge ${mapping.reconciliationStatus?.toLowerCase() || 'not_found'}`}>
          {mapping.reconciliationStatus ? reconciliationLabels[mapping.reconciliationStatus] || mapping.reconciliationStatus : 'Unknown'}
        </span>
      </td>
      <td>
        <span className={`status-badge ${statusColors[mapping.status]}`}>
          {mapping.status}
        </span>
      </td>
      <td>
        <div className="action-buttons">
          {mapping.status !== 'confirmed' && (
            <button
              onClick={() => onStatusChange(mapping.canonicalFieldId, 'confirmed')}
              className="action-btn confirm"
              title="Confirm mapping"
            >
              Confirm
            </button>
          )}
          {mapping.status !== 'rejected' && (
            <button
              onClick={() => onStatusChange(mapping.canonicalFieldId, 'rejected')}
              className="action-btn reject"
              title="Reject mapping"
            >
              Reject
            </button>
          )}
          {mapping.status === 'rejected' && (
            <button
              onClick={() => onStatusChange(mapping.canonicalFieldId, 'pending')}
              className="action-btn reset"
              title="Reset to pending"
            >
              Reset
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}

export function TenantConfigPage() {
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [config, setConfig] = useState<TenantConfig | null>(null);
  const [schemaSnapshot, setSchemaSnapshot] = useState<SchemaSnapshot | null>(null);
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [discoveryMessage, setDiscoveryMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // MDLH Schema state
  const [mdlhColumns, setMdlhColumns] = useState<MdlhSchemaColumn[]>([]);
  const [mdlhReconciliation, setMdlhReconciliation] = useState<MdlhFieldReconciliation[]>([]);
  const [mdlhSummary, setMdlhSummary] = useState<MdlhReconciliationSummary | null>(null);
  const [mdlhDiscoveredAt, setMdlhDiscoveredAt] = useState<string | null>(null);
  const [isFetchingMdlhSchema, setIsFetchingMdlhSchema] = useState(false);
  const [mdlhSchemaError, setMdlhSchemaError] = useState<string | null>(null);
  const [mdlhTableFilter, setMdlhTableFilter] = useState<string>('all');
  const [mdlhCategoryFilter, setMdlhCategoryFilter] = useState<string>('all');

  const snowflakeConnected = useBackendModeStore((state) => state.snowflakeStatus.connected);
  const mdlhConfig = useBackendModeStore((state) => state.mdlhConfig);

  // Load saved config and snapshot on mount
  useEffect(() => {
    const savedConfig = loadTenantConfig();
    if (savedConfig) {
      setConfig(savedConfig);
    }
    const savedSnapshot = loadSchemaSnapshot();
    if (savedSnapshot) {
      setSchemaSnapshot(savedSnapshot);
    }
  }, []);

  // Calculate completeness
  const completeness: ConfigCompleteness = useMemo(() => {
    if (!config) {
      return { score: 0, confirmed: 0, auto: 0, pending: 0, rejected: 0, excluded: 0 };
    }
    return calculateCompleteness(config);
  }, [config]);

  // Filter mappings based on status
  const filteredMappings = useMemo(() => {
    if (!config) return [];
    if (statusFilter === 'all') return config.fieldMappings;
    return config.fieldMappings.filter(m => m.status === statusFilter);
  }, [config, statusFilter]);

  // Handle status change for a field mapping
  const handleStatusChange = useCallback((fieldId: string, newStatus: TenantFieldMapping['status']) => {
    if (!config) return;

    const updatedMappings = config.fieldMappings.map(m => {
      if (m.canonicalFieldId === fieldId) {
        return {
          ...m,
          status: newStatus,
          confirmedAt: newStatus === 'confirmed' ? new Date().toISOString() : undefined,
        };
      }
      return m;
    });

    const updatedConfig: TenantConfig = {
      ...config,
      fieldMappings: updatedMappings,
      updatedAt: new Date().toISOString(),
    };

    setConfig(updatedConfig);
    saveTenantConfig(updatedConfig);
  }, [config]);

  // Initialize default config with field mappings from catalog
  const initializeConfig = useCallback(() => {
    const tenantId = mdlhConfig?.database || 'default';
    const baseUrl = 'mdlh://local';

    // Get fields from catalog
    const fieldLibrary = (fieldCatalog as any).fieldLibrary || {};
    const mappings: TenantFieldMapping[] = Object.keys(fieldLibrary).map(fieldId => ({
      canonicalFieldId: fieldId,
      canonicalFieldName: fieldLibrary[fieldId]?.description || fieldId,
      status: 'pending' as const,
      reconciliationStatus: 'NOT_FOUND' as const,
      confidence: 0,
    }));

    const newConfig = createDefaultConfig(tenantId, baseUrl);
    newConfig.fieldMappings = mappings;

    setConfig(newConfig);
    saveTenantConfig(newConfig);
    setDiscoveryMessage('Configuration initialized with catalog fields.');
  }, [mdlhConfig]);

  // Simulate schema discovery (in real implementation, this would call the API)
  const handleDiscovery = useCallback(async () => {
    setIsDiscovering(true);
    setError(null);
    setDiscoveryMessage('Discovering schema...');

    try {
      // Simulate discovery delay
      await new Promise(resolve => setTimeout(resolve, 1500));

      // Create a simulated schema snapshot
      const snapshot: SchemaSnapshot = {
        tenantId: mdlhConfig?.database || 'default',
        discoveredAt: new Date().toISOString(),
        entityTypes: [],
        nativeAttributes: ['ownerUsers', 'ownerGroups', 'description', 'readme', 'certificateStatus', 'hasLineage'],
        customMetadata: [
          { name: 'DataGovernance', displayName: 'Data Governance', attributes: [
            { name: 'dataOwner', displayName: 'Data Owner', type: 'string' },
            { name: 'dataSteward', displayName: 'Data Steward', type: 'string' },
          ]},
        ],
        classifications: [
          { name: 'PII', displayName: 'PII' },
          { name: 'Confidential', displayName: 'Confidential' },
          { name: 'Public', displayName: 'Public' },
        ],
        domains: [
          { guid: '1', name: 'Finance' },
          { guid: '2', name: 'Sales' },
          { guid: '3', name: 'Marketing' },
        ],
      };

      setSchemaSnapshot(snapshot);
      saveSchemaSnapshot(snapshot);

      // Update config with reconciled mappings
      if (config) {
        const updatedMappings = config.fieldMappings.map(mapping => {
          // Check if field matches a native attribute
          const nativeMatch = snapshot.nativeAttributes.some(
            attr => attr.toLowerCase() === mapping.canonicalFieldId.toLowerCase() ||
                   attr.toLowerCase().includes(mapping.canonicalFieldId.toLowerCase().replace(/_/g, ''))
          );

          if (nativeMatch) {
            return {
              ...mapping,
              status: 'auto' as const,
              reconciliationStatus: 'MATCHED' as const,
              confidence: 0.95,
            };
          }

          // Check for classification match
          const classMatch = snapshot.classifications.some(
            cls => mapping.canonicalFieldId.toLowerCase().includes(cls.name.toLowerCase())
          );

          if (classMatch) {
            return {
              ...mapping,
              status: 'auto' as const,
              reconciliationStatus: 'CLASSIFICATION' as const,
              confidence: 0.8,
            };
          }

          return mapping;
        });

        const updatedConfig: TenantConfig = {
          ...config,
          fieldMappings: updatedMappings,
          updatedAt: new Date().toISOString(),
          lastSnapshotAt: snapshot.discoveredAt,
        };

        setConfig(updatedConfig);
        saveTenantConfig(updatedConfig);
      } else {
        initializeConfig();
      }

      setDiscoveryMessage('Schema discovery complete!');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Discovery failed');
    } finally {
      setIsDiscovering(false);
    }
  }, [config, mdlhConfig, initializeConfig]);

  // Export configuration
  const handleExport = useCallback(() => {
    if (!config) return;

    const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `tenant-config-${config.tenantId}-v${config.version}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [config]);

  // Fetch MDLH schema and reconciliation data
  const handleFetchMdlhSchema = useCallback(async () => {
    if (!snowflakeConnected) {
      setMdlhSchemaError('MDLH connection required. Connect to Snowflake first.');
      return;
    }

    setIsFetchingMdlhSchema(true);
    setMdlhSchemaError(null);

    try {
      // Fetch both schema and reconciliation in parallel
      const [schemaResult, reconcileResult] = await Promise.all([
        getMdlhSchema(),
        reconcileMdlhSchema(),
      ]);

      setMdlhColumns(schemaResult.columns);
      setMdlhReconciliation(reconcileResult.reconciliation);
      setMdlhSummary(reconcileResult.summary);
      setMdlhDiscoveredAt(reconcileResult.discovered_at);
    } catch (e) {
      setMdlhSchemaError(e instanceof Error ? e.message : 'Failed to fetch MDLH schema');
    } finally {
      setIsFetchingMdlhSchema(false);
    }
  }, [snowflakeConnected]);

  // Get unique tables for filter
  const mdlhTables = useMemo(() => {
    const tables = new Set(mdlhColumns.map(c => c.table_name));
    return Array.from(tables).sort();
  }, [mdlhColumns]);

  // Get unique categories for filter
  const mdlhCategories = useMemo(() => {
    const categories = new Set(mdlhReconciliation.map(r => r.category));
    return Array.from(categories).sort();
  }, [mdlhReconciliation]);

  // Filter reconciliation based on filters
  const filteredReconciliation = useMemo(() => {
    return mdlhReconciliation.filter(r => {
      if (mdlhTableFilter !== 'all' && r.expected_mdlh_table !== mdlhTableFilter) return false;
      if (mdlhCategoryFilter !== 'all' && r.category !== mdlhCategoryFilter) return false;
      return true;
    });
  }, [mdlhReconciliation, mdlhTableFilter, mdlhCategoryFilter]);

  const tabs = [
    { id: 'overview' as TabId, label: 'Overview' },
    { id: 'mappings' as TabId, label: 'Field Mappings', count: config?.fieldMappings.length },
    { id: 'classifications' as TabId, label: 'Classifications', count: schemaSnapshot?.classifications.length },
    { id: 'mdlh-schema' as TabId, label: 'MDLH Schema', count: mdlhSummary?.total_expected },
  ];

  return (
    <div className="tenant-config-page">
      <div className="tenant-config-container">
        {/* Header */}
        <div className="tenant-header">
          <div>
            <h1 className="tenant-title">Tenant Field Configuration</h1>
            <p className="tenant-subtitle">
              Configure how canonical fields map to your data catalog
            </p>
          </div>
          <div className="header-actions">
            <button onClick={handleExport} disabled={!config} className="export-btn">
              Export Config
            </button>
          </div>
        </div>

        {/* Connection Status */}
        {!snowflakeConnected && (
          <div className="warning-banner">
            <strong>MDLH connection required.</strong>{' '}
            Connect to Snowflake from the Settings page to run schema discovery.
          </div>
        )}

        {/* Tabs */}
        <div className="tenant-tabs">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`tab-btn ${activeTab === tab.id ? 'active' : ''}`}
            >
              {tab.label}
              {tab.count !== undefined && (
                <span className="tab-count">{tab.count}</span>
              )}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="tenant-content">
          {activeTab === 'overview' && (
            <div className="overview-panel">
              {/* Discovery Status */}
              <div className={`discovery-status ${schemaSnapshot ? 'discovered' : 'not-discovered'}`}>
                {!schemaSnapshot ? (
                  <>
                    <h4>No Schema Discovered</h4>
                    <p>Run tenant schema discovery to detect custom metadata, classifications, and domains.</p>
                    <button
                      onClick={config ? handleDiscovery : initializeConfig}
                      disabled={isDiscovering}
                      className="discovery-btn"
                    >
                      {isDiscovering ? 'Discovering...' : config ? 'Start Discovery' : 'Initialize Config'}
                    </button>
                  </>
                ) : (
                  <>
                    <div className="discovery-header">
                      <h4>Schema Discovered</h4>
                      <button onClick={handleDiscovery} disabled={isDiscovering} className="rediscover-link">
                        Re-discover
                      </button>
                    </div>
                    <div className="discovery-stats">
                      <span><strong>{schemaSnapshot.customMetadata.length}</strong> Custom Metadata</span>
                      <span><strong>{schemaSnapshot.classifications.length}</strong> Classifications</span>
                      <span><strong>{schemaSnapshot.domains.length}</strong> Domains</span>
                      <span><strong>{schemaSnapshot.nativeAttributes.length}</strong> Native Attrs</span>
                    </div>
                    <p className="discovery-time">
                      Discovered at {new Date(schemaSnapshot.discoveredAt).toLocaleString()}
                    </p>
                  </>
                )}
              </div>

              {discoveryMessage && (
                <div className="info-message">{discoveryMessage}</div>
              )}

              {error && (
                <div className="error-message">{error}</div>
              )}

              {/* Completeness Metrics */}
              {config && (
                <div className="completeness-section">
                  <CompletenessRing score={completeness.score} />

                  <div className="stats-grid">
                    <StatsCard
                      title="Confirmed"
                      value={completeness.confirmed}
                      subtitle="Manually verified"
                      color="green"
                    />
                    <StatsCard
                      title="Auto-Mapped"
                      value={completeness.auto}
                      subtitle="High confidence"
                      color="blue"
                    />
                    <StatsCard
                      title="Pending Review"
                      value={completeness.pending}
                      subtitle="Needs attention"
                      color="yellow"
                    />
                    <StatsCard
                      title="Rejected"
                      value={completeness.rejected}
                      subtitle="Explicitly rejected"
                      color="red"
                    />
                  </div>
                </div>
              )}

              {/* Config Info */}
              {config && (
                <div className="config-info">
                  <h4>Configuration Info</h4>
                  <div className="config-grid">
                    <div>
                      <span className="label">Tenant ID:</span>
                      <span className="value">{config.tenantId}</span>
                    </div>
                    <div>
                      <span className="label">Version:</span>
                      <span className="value">{config.version}</span>
                    </div>
                    <div>
                      <span className="label">Total Fields:</span>
                      <span className="value">{config.fieldMappings.length}</span>
                    </div>
                    <div>
                      <span className="label">Updated:</span>
                      <span className="value">{new Date(config.updatedAt).toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'mappings' && (
            <div className="mappings-panel">
              {/* Filter Controls */}
              <div className="filter-bar">
                <label>Filter by status:</label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="filter-select"
                >
                  <option value="all">All</option>
                  <option value="confirmed">Confirmed</option>
                  <option value="auto">Auto-mapped</option>
                  <option value="pending">Pending</option>
                  <option value="rejected">Rejected</option>
                </select>
                <span className="filter-count">
                  Showing {filteredMappings.length} of {config?.fieldMappings.length || 0} fields
                </span>
              </div>

              {/* Mappings Table */}
              {config && filteredMappings.length > 0 ? (
                <div className="mappings-table-container">
                  <table className="mappings-table">
                    <thead>
                      <tr>
                        <th>Field</th>
                        <th>Source Type</th>
                        <th>Reconciliation</th>
                        <th>Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredMappings.map((mapping) => (
                        <FieldMappingRow
                          key={mapping.canonicalFieldId}
                          mapping={mapping}
                          onStatusChange={handleStatusChange}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="empty-state">
                  {!config ?
                    'Initialize configuration to see field mappings.' :
                    'No mappings match the current filter.'
                  }
                </div>
              )}
            </div>
          )}

          {activeTab === 'classifications' && (
            <div className="classifications-panel">
              {schemaSnapshot?.classifications.length ? (
                <div className="classifications-grid">
                  {schemaSnapshot.classifications.map((cls) => (
                    <div key={cls.name} className="classification-card">
                      <div className="classification-name">{cls.displayName}</div>
                      <div className="classification-id">{cls.name}</div>
                      {cls.description && (
                        <div className="classification-desc">{cls.description}</div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-state">
                  Run schema discovery to see available classifications.
                </div>
              )}
            </div>
          )}

          {activeTab === 'mdlh-schema' && (
            <div className="mdlh-schema-panel">
              {/* Schema Discovery Controls */}
              <div className="schema-discovery-controls">
                <button
                  onClick={handleFetchMdlhSchema}
                  disabled={isFetchingMdlhSchema || !snowflakeConnected}
                  className="discovery-btn"
                >
                  {isFetchingMdlhSchema ? 'Fetching...' : 'Fetch MDLH Schema'}
                </button>
                {mdlhDiscoveredAt && (
                  <span className="discovery-time">
                    Last fetched: {new Date(mdlhDiscoveredAt).toLocaleString()}
                  </span>
                )}
              </div>

              {mdlhSchemaError && (
                <div className="error-message">{mdlhSchemaError}</div>
              )}

              {/* Summary Stats */}
              {mdlhSummary && (
                <div className="mdlh-summary-section">
                  <h4>Reconciliation Summary</h4>
                  <div className="stats-grid">
                    <StatsCard
                      title="Expected"
                      value={mdlhSummary.total_expected}
                      subtitle="Fields with MDLH mapping"
                      color="blue"
                    />
                    <StatsCard
                      title="Available"
                      value={mdlhSummary.available}
                      subtitle="Found in MDLH schema"
                      color="green"
                    />
                    <StatsCard
                      title="Missing"
                      value={mdlhSummary.missing}
                      subtitle="Not found in MDLH"
                      color="red"
                    />
                    <StatsCard
                      title="No Mapping"
                      value={mdlhSummary.no_mapping}
                      subtitle="No MDLH mapping defined"
                      color="gray"
                    />
                  </div>

                  {/* By Category Breakdown */}
                  <div className="mdlh-breakdown">
                    <h5>By Category</h5>
                    <div className="breakdown-grid">
                      {Object.entries(mdlhSummary.by_category).map(([category, stats]) => (
                        <div key={category} className="breakdown-item">
                          <span className="breakdown-label">{category}</span>
                          <span className="breakdown-stats">
                            <span className="stat-available">{stats.available}</span>
                            <span className="stat-separator">/</span>
                            <span className="stat-expected">{stats.expected}</span>
                            {stats.missing > 0 && (
                              <span className="stat-missing">({stats.missing} missing)</span>
                            )}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* By Table Breakdown */}
                  <div className="mdlh-breakdown">
                    <h5>By Table</h5>
                    <div className="breakdown-grid">
                      {Object.entries(mdlhSummary.by_table).map(([table, stats]) => (
                        <div key={table} className="breakdown-item">
                          <span className="breakdown-label">{table}</span>
                          <span className="breakdown-stats">
                            <span className="stat-available">{stats.available}</span>
                            <span className="stat-separator">/</span>
                            <span className="stat-expected">{stats.expected}</span>
                            {stats.missing > 0 && (
                              <span className="stat-missing">({stats.missing} missing)</span>
                            )}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Filter Controls */}
              {mdlhReconciliation.length > 0 && (
                <div className="filter-bar">
                  <label>Table:</label>
                  <select
                    value={mdlhTableFilter}
                    onChange={(e) => setMdlhTableFilter(e.target.value)}
                    className="filter-select"
                  >
                    <option value="all">All Tables</option>
                    {mdlhTables.map(t => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                  <label>Category:</label>
                  <select
                    value={mdlhCategoryFilter}
                    onChange={(e) => setMdlhCategoryFilter(e.target.value)}
                    className="filter-select"
                  >
                    <option value="all">All Categories</option>
                    {mdlhCategories.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                  <span className="filter-count">
                    Showing {filteredReconciliation.length} of {mdlhReconciliation.length} fields
                  </span>
                </div>
              )}

              {/* Reconciliation Table */}
              {filteredReconciliation.length > 0 ? (
                <div className="mappings-table-container">
                  <table className="mappings-table mdlh-reconciliation-table">
                    <thead>
                      <tr>
                        <th>Field</th>
                        <th>Category</th>
                        <th>Expected Column</th>
                        <th>Table</th>
                        <th>Status</th>
                        <th>Data Type</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredReconciliation.map((rec) => (
                        <tr key={rec.field_id} className={`reconciliation-row status-${rec.status}`}>
                          <td className="mapping-field">
                            <span className="field-name">{rec.field_id}</span>
                            <span className="field-desc">{rec.field_name}</span>
                          </td>
                          <td>
                            <span className="category-badge">{rec.category}</span>
                          </td>
                          <td>
                            <code className="column-name">{rec.expected_mdlh_column || '-'}</code>
                          </td>
                          <td>
                            <span className="table-name">{rec.expected_mdlh_table || '-'}</span>
                          </td>
                          <td>
                            <span className={`status-badge mdlh-status-${rec.status}`}>
                              {rec.status === 'available' && '✅ Available'}
                              {rec.status === 'missing' && '❌ Missing'}
                              {rec.status === 'type_mismatch' && '⚠️ Type Mismatch'}
                              {rec.status === 'no_mapping' && '➖ No Mapping'}
                            </span>
                          </td>
                          <td>
                            {rec.actual_column ? (
                              <code className="data-type">{rec.actual_column.data_type}</code>
                            ) : (
                              <span className="no-source">-</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : mdlhReconciliation.length === 0 ? (
                <div className="empty-state">
                  {snowflakeConnected
                    ? 'Click "Fetch MDLH Schema" to discover and reconcile field mappings.'
                    : 'Connect to MDLH first to fetch schema information.'
                  }
                </div>
              ) : (
                <div className="empty-state">
                  No fields match the current filters.
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
