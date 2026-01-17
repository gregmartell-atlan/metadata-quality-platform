import { useState, useCallback } from 'react';
import { useBackendModeStore } from '../stores/backendModeStore';
import './DebugPage.css';

interface CsvResult {
  summary?: {
    scopeCount: number;
    assetCount: number;
    source: string;
  };
  scopes?: Array<{
    scopeId: string;
    assetCount: number;
    rows?: Array<{
      useCaseId: string;
      useCaseName: string;
      best?: {
        readiness: number | string;
        gatePass: boolean;
      };
      evidence?: any;
    }>;
  }>;
}

function FieldDisplay({ label, value }: { label: string; value: any }) {
  const isUndefined = value === undefined;
  const isNull = value === null;
  const isEmpty = Array.isArray(value) && value.length === 0;
  const isEmptyObj = typeof value === 'object' && value !== null && Object.keys(value).length === 0;

  let displayValue: string;
  let colorClass = 'value-normal';

  if (isUndefined) {
    displayValue = 'undefined';
    colorClass = 'value-undefined';
  } else if (isNull) {
    displayValue = 'null';
    colorClass = 'value-null';
  } else if (isEmpty || isEmptyObj) {
    displayValue = JSON.stringify(value);
    colorClass = 'value-empty';
  } else if (typeof value === 'object') {
    displayValue = JSON.stringify(value, null, 2);
    colorClass = 'value-present';
  } else {
    displayValue = String(value);
    colorClass = 'value-present';
  }

  return (
    <div className="field-display">
      <span className="field-label">{label}</span>
      <pre className={`field-value ${colorClass}`}>
        {displayValue}
      </pre>
    </div>
  );
}

export function DebugPage() {
  const [identifier, setIdentifier] = useState('4e10f6ec-066d-4d38-b3ae-3e4a135e0fcc');
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvGroupBy, setCsvGroupBy] = useState('asset');
  const [freshnessHours, setFreshnessHours] = useState('24');
  const [retentionAttributeId, setRetentionAttributeId] = useState('');
  const [requirePolicyPayload, setRequirePolicyPayload] = useState('true');
  const [csvResult, setCsvResult] = useState<CsvResult | null>(null);
  const [csvError, setCsvError] = useState<string | null>(null);
  const [csvLoading, setCsvLoading] = useState(false);
  const [selectedScopeId, setSelectedScopeId] = useState<string | null>(null);
  const [selectedUseCaseId, setSelectedUseCaseId] = useState<string | null>(null);

  const snowflakeConnected = useBackendModeStore((state) => state.snowflakeStatus.connected);
  const mdlhConfig = useBackendModeStore((state) => state.mdlhConfig);
  const isConnected = snowflakeConnected;

  // Detect if input looks like a GUID
  const isGuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(identifier);

  const fetchDebugData = useCallback(async () => {
    if (!isConnected) {
      setError('MDLH not connected. Please connect to Snowflake first from the Settings page.');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch('/api/mdlh/debug', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fqn: identifier,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || `HTTP ${response.status}`);
      } else {
        setResult(data);
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [identifier, isConnected]);

  const runCsvScoring = useCallback(async () => {
    if (!csvFile) {
      setCsvError('Select a CSV file to score.');
      return;
    }

    setCsvLoading(true);
    setCsvError(null);
    setCsvResult(null);
    setSelectedScopeId(null);
    setSelectedUseCaseId(null);

    try {
      const formData = new FormData();
      formData.append('file', csvFile);
      formData.append('groupBy', csvGroupBy);
      formData.append('freshnessHours', freshnessHours);
      formData.append('retentionAttributeId', retentionAttributeId);
      formData.append('requirePolicyPayload', requirePolicyPayload);

      const response = await fetch('/api/mdlh/debug-csv', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();
      if (!response.ok) {
        const details = data.details ? ` ${data.details}` : '';
        setCsvError(data.error ? `${data.error}${details}` : `HTTP ${response.status}`);
      } else {
        setCsvResult(data);
      }
    } catch (e) {
      setCsvError(String(e));
    } finally {
      setCsvLoading(false);
    }
  }, [csvFile, csvGroupBy, freshnessHours, retentionAttributeId, requirePolicyPayload]);

  return (
    <div className="debug-page">
      <div className="debug-container">
        <h1 className="debug-title">Asset Debug Tools</h1>

        {/* Asset Debug Section */}
        <div className="debug-card">
          <div className="connection-indicator">
            <span className={`indicator-dot ${isConnected ? 'connected' : 'disconnected'}`} />
            <span className="indicator-text">
              {isConnected
                ? `Connected to ${mdlhConfig?.database || 'MDLH'}`
                : 'Not connected to MDLH'}
            </span>
          </div>

          <div className="input-section">
            <label className="input-label">
              Enter Asset FQN or Domain GUID
            </label>
            <p className="input-hint">
              {isGuid
                ? 'Detected as GUID - will fetch domain details and linked assets'
                : 'Detected as FQN - will search for asset and children'}
            </p>
          </div>

          <div className="input-row">
            <input
              type="text"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="Enter asset FQN or domain GUID..."
              className="identifier-input"
            />
            <button
              onClick={fetchDebugData}
              disabled={loading || !isConnected}
              className="fetch-button"
            >
              {loading ? 'Fetching...' : isGuid ? 'Fetch Domain' : 'Fetch Asset'}
            </button>
          </div>

          {/* Quick Examples */}
          <div className="quick-examples">
            <span className="examples-label">Quick examples:</span>
            <button
              onClick={() => setIdentifier('4e10f6ec-066d-4d38-b3ae-3e4a135e0fcc')}
              className="example-link"
            >
              Domain GUID
            </button>
            <button
              onClick={() => setIdentifier('default/snowflake/1698696666/WIDE_WORLD_IMPORTERS/BRONZE_APPLICATION/PEOPLE')}
              className="example-link"
            >
              PEOPLE Table
            </button>
            <button
              onClick={() => setIdentifier('default/snowflake/1698696666/WIDE_WORLD_IMPORTERS/PROCESSED_GOLD')}
              className="example-link"
            >
              PROCESSED_GOLD Schema
            </button>
          </div>

          {error && (
            <div className="error-banner">{error}</div>
          )}
        </div>

        {/* Results Section */}
        {result && (
          <div className="results-section">
            <div className="debug-card">
              <h2 className="section-title">
                Summary
                <span className="mode-badge">
                  Mode: {result.summary?.mode || 'FQN'}
                </span>
              </h2>

              {result.summary?.mode === 'GUID' ? (
                <div className="guid-results">
                  <div className="summary-grid">
                    <div>
                      <h3 className="subsection-title">Domain</h3>
                      <p className="domain-name">
                        {result.summary?.domain?.name || 'Not found'}
                      </p>
                      <p className="domain-type">{result.summary?.domain?.typeName}</p>
                    </div>
                    <div>
                      <h3 className="subsection-title">Linked Assets</h3>
                      <p className="asset-count">
                        Found {result.summary?.linkedAssets?.totalFound || 0} assets
                      </p>
                      <pre className="entity-types">
                        {JSON.stringify(result.summary?.linkedAssets?.entityTypes, null, 2)}
                      </pre>
                    </div>
                  </div>

                  {result.summary?.domain && (
                    <div className="domain-details">
                      <h3 className="subsection-title">Domain Details</h3>
                      <div className="details-grid">
                        <FieldDisplay label="Name" value={result.summary.domain.name} />
                        <FieldDisplay label="QualifiedName" value={result.summary.domain.qualifiedName} />
                        <FieldDisplay label="Description" value={result.summary.domain.description} />
                        <FieldDisplay label="Owner Users" value={result.summary.domain.ownerUsers} />
                        <FieldDisplay label="Owner Groups" value={result.summary.domain.ownerGroups} />
                        <FieldDisplay label="Certificate" value={result.summary.domain.certificateStatus} />
                      </div>
                    </div>
                  )}

                  {result.summary?.linkedAssets?.assets?.length > 0 && (
                    <div className="linked-assets">
                      <h3 className="subsection-title">
                        Linked Assets ({result.summary.linkedAssets.assets.length})
                      </h3>
                      <div className="assets-table-container">
                        <table className="assets-table">
                          <thead>
                            <tr>
                              <th>Type</th>
                              <th>Name</th>
                              <th>Owner</th>
                              <th>Lineage</th>
                              <th>Classifications</th>
                              <th>Policies</th>
                              <th>Certified</th>
                            </tr>
                          </thead>
                          <tbody>
                            {result.summary.linkedAssets.assets.map((a: any, i: number) => (
                              <tr key={i}>
                                <td className="type-cell">{a.typeName}</td>
                                <td>{a.name}</td>
                                <td>{a.owner || '-'}</td>
                                <td className="check-cell">{a.hasLineage ? '✓' : '✗'}</td>
                                <td className="check-cell">{a.hasClassifications ? '✓' : '✗'}</td>
                                <td className="check-cell">{a.hasPolicies ? '✓' : '✗'}</td>
                                <td className="check-cell">{a.certified ? '✓' : '✗'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="fqn-results">
                  <div className="summary-grid">
                    <div>
                      <h3 className="subsection-title">Search Results</h3>
                      <p className="asset-count">
                        Found {result.summary?.searchResults?.totalFound || 0} entities
                      </p>
                      <pre className="entity-types">
                        {JSON.stringify(result.summary?.searchResults?.entityTypes, null, 2)}
                      </pre>
                    </div>
                    <div>
                      <h3 className="subsection-title">Primary Asset</h3>
                      <p className="asset-info">
                        {result.summary?.primaryAsset?.typeName} - {result.summary?.primaryAsset?.name}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {result.summary?.primaryAsset && (
              <div className="debug-card">
                <h2 className="section-title">Primary Asset - Key Fields</h2>
                <div className="details-grid">
                  <FieldDisplay label="GUID" value={result.summary.primaryAsset.guid} />
                  <FieldDisplay label="Type" value={result.summary.primaryAsset.typeName} />
                  <FieldDisplay label="Owner Users" value={result.summary.primaryAsset.ownerUsers} />
                  <FieldDisplay label="Owner Groups" value={result.summary.primaryAsset.ownerGroups} />
                  <FieldDisplay label="Description" value={result.summary.primaryAsset.description} />
                  <FieldDisplay label="User Description" value={result.summary.primaryAsset.userDescription} />
                  <FieldDisplay label="Certificate Status" value={result.summary.primaryAsset.certificateStatus} />
                  <FieldDisplay label="Has Lineage" value={result.summary.primaryAsset.hasLineage} />
                  <FieldDisplay label="Asset Policies Count" value={result.summary.primaryAsset.assetPoliciesCount} />
                </div>

                <h3 className="subsection-title">Classification Fields</h3>
                <div className="details-grid">
                  <FieldDisplay label="classificationNames" value={result.summary.primaryAsset.classificationNames} />
                  <FieldDisplay label="classifications" value={result.summary.primaryAsset.classifications} />
                  <FieldDisplay label="atlanTags" value={result.summary.primaryAsset.atlanTags} />
                </div>

                <h3 className="subsection-title">Business Attributes (Custom Metadata)</h3>
                <FieldDisplay label="businessAttributes" value={result.summary.primaryAsset.businessAttributes} />

                <h3 className="subsection-title">Relationship Attributes</h3>
                <FieldDisplay label="relationshipAttributes" value={result.summary.primaryAsset.relationshipAttributes} />
              </div>
            )}

            {result.rawDomainEntity && (
              <div className="debug-card">
                <h2 className="section-title">Raw Domain Entity (Full Detail)</h2>
                <pre className="raw-output">
                  {JSON.stringify(result.rawDomainEntity, null, 2)}
                </pre>
              </div>
            )}

            {result.rawLinkedAssets && (
              <div className="debug-card">
                <h2 className="section-title">Raw Linked Assets (first 20)</h2>
                <pre className="raw-output">
                  {JSON.stringify(result.rawLinkedAssets, null, 2)}
                </pre>
              </div>
            )}

            {result.rawSearchResult && (
              <div className="debug-card">
                <h2 className="section-title">Raw Search Result (first 10 entities)</h2>
                <pre className="raw-output">
                  {JSON.stringify(result.rawSearchResult, null, 2)}
                </pre>
              </div>
            )}
          </div>
        )}

        {/* CSV Scoring Section */}
        <div className="debug-card">
          <h2 className="section-title">CSV Scoring & Evidence</h2>

          <div className="csv-inputs">
            <div className="csv-input-row">
              <div className="csv-input-group">
                <label className="input-label">CSV File</label>
                <input
                  type="file"
                  accept=".csv"
                  onChange={(e) => setCsvFile(e.target.files?.[0] || null)}
                  className="file-input"
                />
                <p className="input-hint">
                  Supports Atlan exports or a minimal CSV with qualifiedName/typeName.
                </p>
              </div>
              <div className="csv-input-group">
                <label className="input-label">Group By</label>
                <select
                  value={csvGroupBy}
                  onChange={(e) => setCsvGroupBy(e.target.value)}
                  className="select-input"
                >
                  <option value="asset">Asset (FQN)</option>
                  <option value="domain">Domain</option>
                  <option value="connection">Connection</option>
                  <option value="database">Database</option>
                  <option value="schema">Schema</option>
                </select>
              </div>
            </div>

            <div className="csv-input-row three-col">
              <div className="csv-input-group">
                <label className="input-label">Freshness SLA (hours)</label>
                <input
                  type="number"
                  value={freshnessHours}
                  onChange={(e) => setFreshnessHours(e.target.value)}
                  className="text-input"
                />
              </div>
              <div className="csv-input-group">
                <label className="input-label">Retention Attribute ID</label>
                <input
                  type="text"
                  value={retentionAttributeId}
                  onChange={(e) => setRetentionAttributeId(e.target.value)}
                  className="text-input mono"
                  placeholder="RetentionPeriod"
                />
              </div>
              <div className="csv-input-group">
                <label className="input-label">Require Policy Payload</label>
                <select
                  value={requirePolicyPayload}
                  onChange={(e) => setRequirePolicyPayload(e.target.value)}
                  className="select-input"
                >
                  <option value="true">true</option>
                  <option value="false">false</option>
                </select>
              </div>
            </div>

            <div className="csv-actions">
              <button
                onClick={runCsvScoring}
                disabled={csvLoading}
                className="action-button primary"
              >
                {csvLoading ? 'Scoring...' : 'Run Scoring'}
              </button>
            </div>

            {csvError && (
              <div className="error-banner small">{csvError}</div>
            )}

            {csvResult && (
              <div className="csv-results">
                <div className="csv-summary">
                  Scopes: {csvResult.summary?.scopeCount} | Assets: {csvResult.summary?.assetCount} | Source: {csvResult.summary?.source}
                </div>

                <div className="scopes-table-container">
                  <table className="scopes-table">
                    <thead>
                      <tr>
                        <th>Scope</th>
                        <th>Assets</th>
                        <th>Use Cases</th>
                      </tr>
                    </thead>
                    <tbody>
                      {csvResult.scopes?.map((scope) => (
                        <tr key={scope.scopeId}>
                          <td className="scope-id">{scope.scopeId}</td>
                          <td>{scope.assetCount}</td>
                          <td className="use-cases-cell">
                            {scope.rows?.map((row) => (
                              <div key={row.useCaseId} className="use-case-row">
                                <span className="use-case-name">{row.useCaseName}</span>
                                <span className="readiness-value">
                                  {row.best?.readiness === 'UNKNOWN'
                                    ? 'UNKNOWN'
                                    : Number(row.best?.readiness || 0).toFixed(3)}
                                </span>
                                <span className={`gate-status ${row.best?.gatePass ? 'pass' : 'fail'}`}>
                                  {row.best?.gatePass ? 'gate ok' : 'gate fail'}
                                </span>
                                <button
                                  onClick={() => {
                                    setSelectedScopeId(scope.scopeId);
                                    setSelectedUseCaseId(row.useCaseId);
                                  }}
                                  className="evidence-link"
                                >
                                  Evidence
                                </button>
                              </div>
                            ))}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>

        {csvResult && selectedScopeId && selectedUseCaseId && (
          <div className="debug-card">
            <h3 className="section-title">Evidence Payload</h3>
            <p className="evidence-info">
              Scope: <span className="mono">{selectedScopeId}</span> | Use case: <span className="mono">{selectedUseCaseId}</span>
            </p>
            <pre className="raw-output">
              {JSON.stringify(
                csvResult.scopes
                  ?.find((scope) => scope.scopeId === selectedScopeId)
                  ?.rows?.find((row) => row.useCaseId === selectedUseCaseId)?.evidence,
                null,
                2
              )}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
