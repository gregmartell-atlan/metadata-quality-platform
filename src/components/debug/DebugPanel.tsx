/**
 * Debug Panel Component
 *
 * A slide-out debug tools panel for developers showing:
 * - Current backend mode (API vs MDLH)
 * - Snowflake connection status and session info
 * - Current asset context information
 * - Recent API/MDLH request logs
 * - MDLH connectivity test button
 *
 * Toggle with Ctrl+Shift+D keyboard shortcut
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useBackendModeStore } from '../../stores/backendModeStore';
import { useAssetContextStore } from '../../stores/assetContextStore';
import { logger } from '../../utils/logger';
import './DebugPanel.css';

// Icons as inline SVG components for lightweight embedding
const CloseIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

const DatabaseIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <ellipse cx="12" cy="5" rx="9" ry="3" />
    <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
    <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
  </svg>
);

const ServerIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="2" width="20" height="8" rx="2" ry="2" />
    <rect x="2" y="14" width="20" height="8" rx="2" ry="2" />
    <line x1="6" y1="6" x2="6.01" y2="6" />
    <line x1="6" y1="18" x2="6.01" y2="18" />
  </svg>
);

const LayersIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="12 2 2 7 12 12 22 7 12 2" />
    <polyline points="2 17 12 22 22 17" />
    <polyline points="2 12 12 17 22 12" />
  </svg>
);

const ActivityIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
  </svg>
);

const RefreshIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 4 23 10 17 10" />
    <polyline points="1 20 1 14 7 14" />
    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
  </svg>
);

const CheckIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const AlertIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="8" x2="12" y2="12" />
    <line x1="12" y1="16" x2="12.01" y2="16" />
  </svg>
);

const TrashIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
  </svg>
);

// Request log entry interface
interface RequestLogEntry {
  id: string;
  timestamp: Date;
  type: 'api' | 'mdlh';
  method: string;
  endpoint: string;
  status: 'pending' | 'success' | 'error';
  duration?: number;
  error?: string;
}

// Global request log storage (persists across component remounts)
let globalRequestLog: RequestLogEntry[] = [];
let requestIdCounter = 0;

// Exported functions to log requests from other parts of the app
export function logApiRequest(method: string, endpoint: string): string {
  const id = `req-${++requestIdCounter}`;
  const entry: RequestLogEntry = {
    id,
    timestamp: new Date(),
    type: 'api',
    method,
    endpoint,
    status: 'pending',
  };
  globalRequestLog = [entry, ...globalRequestLog].slice(0, 50); // Keep last 50
  return id;
}

export function logMdlhRequest(method: string, endpoint: string): string {
  const id = `req-${++requestIdCounter}`;
  const entry: RequestLogEntry = {
    id,
    timestamp: new Date(),
    type: 'mdlh',
    method,
    endpoint,
    status: 'pending',
  };
  globalRequestLog = [entry, ...globalRequestLog].slice(0, 50);
  return id;
}

export function updateRequestStatus(
  id: string,
  status: 'success' | 'error',
  duration?: number,
  error?: string
): void {
  globalRequestLog = globalRequestLog.map(entry =>
    entry.id === id
      ? { ...entry, status, duration, error }
      : entry
  );
}

export function DebugPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [requestLog, setRequestLog] = useState<RequestLogEntry[]>([]);
  const refreshIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Backend mode store
  const {
    dataBackend,
    snowflakeStatus,
    mdlhConfig,
    isConnecting,
    connectionError,
    isInFallbackMode,
    fallbackReason,
    fallbackCount,
    connectionVersion,
    refreshStatus,
  } = useBackendModeStore();

  // Asset context store
  const {
    context: assetContext,
    contextAssets,
    isLoading: isContextLoading,
    loadingProgress,
    error: contextError,
  } = useAssetContextStore();

  // Keyboard shortcut handler
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Ctrl+Shift+D to toggle debug panel
      if (event.ctrlKey && event.shiftKey && event.key === 'D') {
        event.preventDefault();
        setIsOpen(prev => !prev);
      }
      // Escape to close
      if (event.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  // Refresh request log periodically when panel is open
  useEffect(() => {
    if (isOpen) {
      setRequestLog([...globalRequestLog]);
      refreshIntervalRef.current = setInterval(() => {
        setRequestLog([...globalRequestLog]);
      }, 1000);
    } else if (refreshIntervalRef.current) {
      clearInterval(refreshIntervalRef.current);
      refreshIntervalRef.current = null;
    }

    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
    };
  }, [isOpen]);

  // Test MDLH connectivity
  const handleTestMdlh = useCallback(async () => {
    setIsTesting(true);
    setTestResult(null);

    const requestId = logMdlhRequest('GET', '/api/snowflake/status');
    const startTime = Date.now();

    try {
      logger.info('[DebugPanel] Testing MDLH connectivity...');

      const response = await fetch('/api/snowflake/status');
      const duration = Date.now() - startTime;

      if (!response.ok) {
        updateRequestStatus(requestId, 'error', duration, `HTTP ${response.status}`);
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      updateRequestStatus(requestId, 'success', duration);

      if (data.connected) {
        setTestResult({
          success: true,
          message: `Connected as ${data.user || 'unknown'} (${duration}ms)`,
        });
      } else {
        setTestResult({
          success: false,
          message: `Not connected - session inactive (${duration}ms)`,
        });
      }

      // Also refresh the store status
      await refreshStatus();
    } catch (error) {
      const duration = Date.now() - startTime;
      const message = error instanceof Error ? error.message : 'Unknown error';
      updateRequestStatus(requestId, 'error', duration, message);
      setTestResult({
        success: false,
        message: `Connection test failed: ${message}`,
      });
      logger.error('[DebugPanel] MDLH connectivity test failed:', error);
    } finally {
      setIsTesting(false);
    }
  }, [refreshStatus]);

  // Clear request log
  const handleClearLog = useCallback(() => {
    globalRequestLog = [];
    setRequestLog([]);
  }, []);

  // Format timestamp
  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  // Format duration
  const formatDuration = (ms?: number) => {
    if (ms === undefined) return '-';
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  if (!isOpen) {
    return (
      <button
        className="debug-panel-trigger"
        onClick={() => setIsOpen(true)}
        title="Open Debug Panel (Ctrl+Shift+D)"
      >
        <span className="debug-trigger-icon">D</span>
      </button>
    );
  }

  return (
    <div className="debug-panel-overlay" onClick={() => setIsOpen(false)}>
      <div className="debug-panel" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="debug-panel-header">
          <div className="debug-panel-title">
            <span className="debug-title-icon">D</span>
            Debug Tools
          </div>
          <div className="debug-panel-subtitle">v{connectionVersion}</div>
          <button className="debug-panel-close" onClick={() => setIsOpen(false)}>
            <CloseIcon />
          </button>
        </div>

        {/* Content */}
        <div className="debug-panel-content">
          {/* Backend Mode Section */}
          <section className="debug-section">
            <div className="debug-section-header">
              <ServerIcon />
              <span>Backend Mode</span>
            </div>
            <div className="debug-section-body">
              <div className="debug-info-row">
                <span className="debug-label">Current Backend</span>
                <span className={`debug-badge debug-badge-${dataBackend}`}>
                  {dataBackend === 'mdlh' ? 'MDLH (Snowflake)' : 'REST API'}
                </span>
              </div>
              {isInFallbackMode && (
                <div className="debug-info-row debug-row-warning">
                  <span className="debug-label">Fallback Active</span>
                  <span className="debug-value debug-value-warning">
                    {fallbackReason} (x{fallbackCount})
                  </span>
                </div>
              )}
              {connectionError && (
                <div className="debug-info-row debug-row-error">
                  <span className="debug-label">Error</span>
                  <span className="debug-value debug-value-error">{connectionError}</span>
                </div>
              )}
            </div>
          </section>

          {/* Snowflake Connection Section */}
          <section className="debug-section">
            <div className="debug-section-header">
              <DatabaseIcon />
              <span>Snowflake Connection</span>
              <span className={`debug-status-dot ${snowflakeStatus.connected ? 'connected' : 'disconnected'}`} />
            </div>
            <div className="debug-section-body">
              <div className="debug-info-row">
                <span className="debug-label">Status</span>
                <span className={`debug-badge ${snowflakeStatus.connected ? 'debug-badge-success' : 'debug-badge-error'}`}>
                  {isConnecting ? 'Connecting...' : snowflakeStatus.connected ? 'Connected' : 'Disconnected'}
                </span>
              </div>
              {snowflakeStatus.connected && (
                <>
                  <div className="debug-info-row">
                    <span className="debug-label">User</span>
                    <span className="debug-value">{snowflakeStatus.user || '-'}</span>
                  </div>
                  <div className="debug-info-row">
                    <span className="debug-label">Auth Method</span>
                    <span className="debug-value">{snowflakeStatus.authMethod?.toUpperCase() || '-'}</span>
                  </div>
                  <div className="debug-info-row">
                    <span className="debug-label">Session ID</span>
                    <span className="debug-value debug-value-mono">
                      {snowflakeStatus.sessionId
                        ? `${snowflakeStatus.sessionId.slice(0, 8)}...`
                        : '-'}
                    </span>
                  </div>
                  {snowflakeStatus.role && (
                    <div className="debug-info-row">
                      <span className="debug-label">Role</span>
                      <span className="debug-value">{snowflakeStatus.role}</span>
                    </div>
                  )}
                  {snowflakeStatus.warehouse && (
                    <div className="debug-info-row">
                      <span className="debug-label">Warehouse</span>
                      <span className="debug-value">{snowflakeStatus.warehouse}</span>
                    </div>
                  )}
                  {snowflakeStatus.database && (
                    <div className="debug-info-row">
                      <span className="debug-label">Database</span>
                      <span className="debug-value">{snowflakeStatus.database}</span>
                    </div>
                  )}
                </>
              )}
              {mdlhConfig && (
                <div className="debug-info-row">
                  <span className="debug-label">MDLH Config</span>
                  <span className={`debug-badge ${mdlhConfig.enabled ? 'debug-badge-success' : 'debug-badge-muted'}`}>
                    {mdlhConfig.enabled ? 'Enabled' : 'Disabled'}
                  </span>
                </div>
              )}
            </div>
          </section>

          {/* Asset Context Section */}
          <section className="debug-section">
            <div className="debug-section-header">
              <LayersIcon />
              <span>Asset Context</span>
              {isContextLoading && <span className="debug-spinner" />}
            </div>
            <div className="debug-section-body">
              <div className="debug-info-row">
                <span className="debug-label">Context Type</span>
                <span className="debug-badge debug-badge-info">
                  {assetContext?.type || 'None'}
                </span>
              </div>
              <div className="debug-info-row">
                <span className="debug-label">Label</span>
                <span className="debug-value">{assetContext?.label || 'No context set'}</span>
              </div>
              <div className="debug-info-row">
                <span className="debug-label">Asset Count</span>
                <span className="debug-value">
                  {contextAssets.length.toLocaleString()}
                  {assetContext?.totalCount && assetContext.totalCount > contextAssets.length && (
                    <span className="debug-value-muted"> / {assetContext.totalCount.toLocaleString()}</span>
                  )}
                </span>
              </div>
              {assetContext?.isSampled && (
                <div className="debug-info-row">
                  <span className="debug-label">Sample Rate</span>
                  <span className="debug-value">
                    {assetContext.sampleRate
                      ? `${(assetContext.sampleRate * 100).toFixed(1)}%`
                      : 'Sampled'}
                  </span>
                </div>
              )}
              {loadingProgress && (
                <div className="debug-info-row">
                  <span className="debug-label">Loading Progress</span>
                  <span className="debug-value">
                    {loadingProgress.loaded} / {loadingProgress.total}
                  </span>
                </div>
              )}
              {assetContext?.filters && Object.keys(assetContext.filters).length > 0 && (
                <div className="debug-filters">
                  <span className="debug-label">Filters</span>
                  <div className="debug-filters-list">
                    {assetContext.filters.connectionName && (
                      <span className="debug-filter-tag">conn: {assetContext.filters.connectionName}</span>
                    )}
                    {assetContext.filters.databaseName && (
                      <span className="debug-filter-tag">db: {assetContext.filters.databaseName}</span>
                    )}
                    {assetContext.filters.schemaName && (
                      <span className="debug-filter-tag">schema: {assetContext.filters.schemaName}</span>
                    )}
                    {assetContext.filters.tableName && (
                      <span className="debug-filter-tag">table: {assetContext.filters.tableName}</span>
                    )}
                  </div>
                </div>
              )}
              {contextError && (
                <div className="debug-info-row debug-row-error">
                  <span className="debug-label">Error</span>
                  <span className="debug-value debug-value-error">{contextError}</span>
                </div>
              )}
            </div>
          </section>

          {/* Request Log Section */}
          <section className="debug-section debug-section-log">
            <div className="debug-section-header">
              <ActivityIcon />
              <span>Request Log</span>
              <span className="debug-log-count">{requestLog.length}</span>
              <button
                className="debug-btn-icon"
                onClick={handleClearLog}
                title="Clear log"
              >
                <TrashIcon />
              </button>
            </div>
            <div className="debug-section-body debug-log-body">
              {requestLog.length === 0 ? (
                <div className="debug-log-empty">No requests logged yet</div>
              ) : (
                <div className="debug-log-list">
                  {requestLog.map((entry) => (
                    <div
                      key={entry.id}
                      className={`debug-log-entry debug-log-${entry.status}`}
                    >
                      <div className="debug-log-header">
                        <span className={`debug-log-type debug-log-type-${entry.type}`}>
                          {entry.type.toUpperCase()}
                        </span>
                        <span className="debug-log-method">{entry.method}</span>
                        <span className="debug-log-time">{formatTime(entry.timestamp)}</span>
                      </div>
                      <div className="debug-log-endpoint">{entry.endpoint}</div>
                      <div className="debug-log-footer">
                        <span className={`debug-log-status debug-log-status-${entry.status}`}>
                          {entry.status === 'pending' && <span className="debug-spinner-small" />}
                          {entry.status === 'success' && <CheckIcon />}
                          {entry.status === 'error' && <AlertIcon />}
                          {entry.status}
                        </span>
                        <span className="debug-log-duration">{formatDuration(entry.duration)}</span>
                      </div>
                      {entry.error && (
                        <div className="debug-log-error">{entry.error}</div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        </div>

        {/* Footer Actions */}
        <div className="debug-panel-footer">
          <button
            className="debug-btn debug-btn-primary"
            onClick={handleTestMdlh}
            disabled={isTesting}
          >
            {isTesting ? (
              <>
                <span className="debug-spinner-small" />
                Testing...
              </>
            ) : (
              <>
                <RefreshIcon />
                Test MDLH Connection
              </>
            )}
          </button>
          {testResult && (
            <div className={`debug-test-result ${testResult.success ? 'success' : 'error'}`}>
              {testResult.success ? <CheckIcon /> : <AlertIcon />}
              {testResult.message}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default DebugPanel;
