/**
 * Snowflake Connection Modal
 *
 * Allows users to connect to Snowflake for MDLH queries.
 * Supports both SSO (browser-based) and PAT (token-based) authentication.
 *
 * Ported from Atlan_MDLH_Explorer project with TypeScript adaptations.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useBackendModeStore } from '../../stores/backendModeStore';

// ============================================
// Types
// ============================================

interface SnowflakeConfig {
  account: string;
  user: string;
  token: string;
  warehouse: string;
  database: string;
  schema: string;
  role: string;
}

type AuthMethod = 'token' | 'sso';

interface ConnectionResult {
  connected: boolean;
  session_id?: string;
  user?: string;
  warehouse?: string;
  database?: string;
  role?: string;
  error?: string;
}

interface SnowflakeConnectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConnect?: (session: ConnectionResult) => void;
}

// ============================================
// Constants
// ============================================

const API_BASE_URL = '/api';
const STORAGE_KEY = 'snowflake_config';

// ============================================
// Icons (inline SVGs to avoid dependencies)
// ============================================

const XIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

const DatabaseIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <ellipse cx="12" cy="5" rx="9" ry="3" />
    <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
    <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
  </svg>
);

const KeyIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
  </svg>
);

const EyeIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const EyeOffIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
    <line x1="1" y1="1" x2="23" y2="23" />
  </svg>
);

const LoaderIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="animate-spin">
    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
  </svg>
);

const CheckCircleIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
    <polyline points="22 4 12 14.01 9 11.01" />
  </svg>
);

const AlertCircleIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="8" x2="12" y2="12" />
    <line x1="12" y1="16" x2="12.01" y2="16" />
  </svg>
);

const InfoIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="16" x2="12" y2="12" />
    <line x1="12" y1="8" x2="12.01" y2="8" />
  </svg>
);

// ============================================
// Component
// ============================================

export function SnowflakeConnectionModal({
  isOpen,
  onClose,
  onConnect,
}: SnowflakeConnectionModalProps) {
  const { setSnowflakeStatus, setDataBackend, mdlhConfig } = useBackendModeStore();

  const [authMethod, setAuthMethod] = useState<AuthMethod>('sso');
  const [formData, setFormData] = useState<SnowflakeConfig>({
    account: '',
    user: '',
    token: '',
    warehouse: 'COMPUTE_WH',
    database: 'ATLAN_GOLD',
    schema: 'PUBLIC',
    role: '',
  });
  const [showSecret, setShowSecret] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<ConnectionResult | null>(null);
  const [saveToStorage, setSaveToStorage] = useState(true);

  const abortControllerRef = useRef<AbortController | null>(null);
  const timeoutIdRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cancel any ongoing connection attempt
  const cancelConnection = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    if (timeoutIdRef.current) {
      clearTimeout(timeoutIdRef.current);
      timeoutIdRef.current = null;
    }
    setTesting(false);
  }, []);

  // Handle modal close
  const handleClose = useCallback(() => {
    cancelConnection();
    onClose();
  }, [cancelConnection, onClose]);

  // Load saved config on open
  useEffect(() => {
    if (isOpen) {
      setTestResult(null);

      // Load from localStorage
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          setFormData((prev) => ({ ...prev, ...parsed, token: '' }));
          if (parsed.authMethod) setAuthMethod(parsed.authMethod);
        } catch {
          // Ignore parse errors
        }
      }

      // Override with server config if available
      if (mdlhConfig?.snowflakeAccount) {
        setFormData((prev) => ({
          ...prev,
          account: mdlhConfig.snowflakeAccount || prev.account,
          warehouse: mdlhConfig.snowflakeWarehouse || prev.warehouse,
          database: mdlhConfig.snowflakeDatabase || prev.database,
          schema: mdlhConfig.snowflakeSchema || prev.schema,
        }));
      }
    } else {
      cancelConnection();
    }
  }, [isOpen, cancelConnection, mdlhConfig]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      if (timeoutIdRef.current) {
        clearTimeout(timeoutIdRef.current);
      }
    };
  }, []);

  const handleAuthMethodChange = (method: AuthMethod) => {
    setAuthMethod(method);
    setTestResult(null);
  };

  const handleChange = (field: keyof SnowflakeConfig, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setTestResult(null);
  };

  const handleTestConnection = async () => {
    cancelConnection();

    setTesting(true);
    setTestResult(null);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    const timeoutMs = authMethod === 'sso' ? 120000 : 30000;
    timeoutIdRef.current = setTimeout(() => controller.abort(), timeoutMs);

    try {
      // Unified connect endpoint - auth_type determines token vs SSO
      const endpoint = `${API_BASE_URL}/snowflake/connect`;

      const requestBody: Record<string, unknown> = {
        account: formData.account,
        user: formData.user,
        warehouse: formData.warehouse || 'COMPUTE_WH',
        database: formData.database || 'ATLAN_GOLD',
        schema_name: formData.schema || 'PUBLIC',
        role: formData.role || undefined,
        auth_type: authMethod,
      };

      if (authMethod === 'token') {
        requestBody.token = formData.token;
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });

      if (timeoutIdRef.current) {
        clearTimeout(timeoutIdRef.current);
        timeoutIdRef.current = null;
      }

      const result: ConnectionResult = await response.json();

      if (result.connected && result.session_id) {
        const sessionInfo: ConnectionResult = {
          connected: true,
          session_id: result.session_id,
          user: result.user,
          warehouse: result.warehouse,
          database: result.database,
          role: result.role,
        };

        setTestResult(sessionInfo);

        // Update store
        setSnowflakeStatus({
          connected: true,
          authMethod: authMethod,
          user: result.user,
          role: result.role,
          warehouse: result.warehouse,
          database: result.database,
          schema: formData.schema,
          sessionId: result.session_id,
        });

        // Auto-switch to MDLH mode
        setDataBackend('mdlh');

        // Save config (without token)
        if (saveToStorage) {
          const { token, ...configToSave } = formData;
          localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify({ ...configToSave, authMethod })
          );
        }

        // Store session in sessionStorage
        sessionStorage.setItem(
          'snowflake_session',
          JSON.stringify({
            sessionId: result.session_id,
            user: result.user,
            warehouse: result.warehouse,
            database: result.database,
            schema: formData.schema,
            role: result.role,
            timestamp: Date.now(),
          })
        );

        onConnect?.(sessionInfo);
      } else if (result.connected) {
        // Legacy response without session_id
        setTestResult({
          connected: true,
          user: result.user,
          warehouse: result.warehouse,
          database: result.database,
          role: result.role,
        });

        if (saveToStorage) {
          const { token, ...configToSave } = formData;
          localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify({ ...configToSave, authMethod })
          );
        }

        onConnect?.(result);
      } else {
        setTestResult({
          connected: false,
          error: result.error || 'Connection failed',
        });
      }
    } catch (err) {
      if (timeoutIdRef.current) {
        clearTimeout(timeoutIdRef.current);
        timeoutIdRef.current = null;
      }

      if (err instanceof Error && err.name === 'AbortError') {
        if (!abortControllerRef.current) {
          setTestResult(null);
        } else {
          setTestResult({
            connected: false,
            error:
              authMethod === 'sso'
                ? 'SSO login timed out or was cancelled. Complete the login in the browser window.'
                : 'Connection timed out. Is the backend server running?',
          });
        }
      } else {
        setTestResult({
          connected: false,
          error: err instanceof Error ? err.message : 'Connection failed',
        });
      }
    } finally {
      setTesting(false);
      abortControllerRef.current = null;
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleTestConnection();
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        backdropFilter: 'blur(4px)',
        zIndex: 50,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
      }}
    >
      <div
        style={{
          backgroundColor: 'white',
          borderRadius: '16px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          width: '100%',
          maxWidth: '32rem',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            background: 'linear-gradient(135deg, #3366FF 0%, #5B8DEF 100%)',
            padding: '1.25rem',
            color: 'white',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div
                style={{
                  padding: '0.5rem',
                  backgroundColor: 'rgba(255, 255, 255, 0.2)',
                  borderRadius: '8px',
                }}
              >
                <DatabaseIcon />
              </div>
              <div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 600, margin: 0 }}>
                  Connect to Snowflake
                </h2>
                <p style={{ color: 'rgba(255, 255, 255, 0.8)', fontSize: '0.875rem', margin: 0 }}>
                  Query MDLH Gold Layer directly
                </p>
              </div>
            </div>
            <button
              onClick={handleClose}
              style={{
                padding: '0.5rem',
                background: 'transparent',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                color: 'white',
              }}
            >
              <XIcon />
            </button>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ padding: '1.5rem' }}>
          {/* Auth Method Toggle */}
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: '#374151', marginBottom: '0.5rem' }}>
              Authentication Method
            </label>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                type="button"
                onClick={() => handleAuthMethodChange('sso')}
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                  padding: '0.625rem 1rem',
                  borderRadius: '8px',
                  border: `2px solid ${authMethod === 'sso' ? '#3366FF' : '#e5e7eb'}`,
                  backgroundColor: authMethod === 'sso' ? '#eff6ff' : 'white',
                  color: authMethod === 'sso' ? '#3366FF' : '#6b7280',
                  fontWeight: 500,
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
              >
                <DatabaseIcon />
                <span>SSO / Browser</span>
              </button>
              <button
                type="button"
                onClick={() => handleAuthMethodChange('token')}
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                  padding: '0.625rem 1rem',
                  borderRadius: '8px',
                  border: `2px solid ${authMethod === 'token' ? '#3366FF' : '#e5e7eb'}`,
                  backgroundColor: authMethod === 'token' ? '#eff6ff' : 'white',
                  color: authMethod === 'token' ? '#3366FF' : '#6b7280',
                  fontWeight: 500,
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
              >
                <KeyIcon />
                <span>Access Token</span>
              </button>
            </div>
          </div>

          {/* Account */}
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: '#374151', marginBottom: '0.25rem' }}>
              Account Identifier *
            </label>
            <input
              type="text"
              value={formData.account}
              onChange={(e) => handleChange('account', e.target.value)}
              placeholder="abc12345.us-east-1"
              style={{
                width: '100%',
                padding: '0.625rem 1rem',
                border: '1px solid #d1d5db',
                borderRadius: '8px',
                fontSize: '0.875rem',
                outline: 'none',
                boxSizing: 'border-box',
              }}
              required
            />
            <p style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              <InfoIcon />
              Found in your Snowflake URL or Admin → Accounts
            </p>
          </div>

          {/* Username (required for both auth methods) */}
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: '#374151', marginBottom: '0.25rem' }}>
              Username *
            </label>
            <input
              type="text"
              value={formData.user}
              onChange={(e) => handleChange('user', e.target.value)}
              placeholder="your_username@company.com"
              style={{
                width: '100%',
                padding: '0.625rem 1rem',
                border: '1px solid #d1d5db',
                borderRadius: '8px',
                fontSize: '0.875rem',
                outline: 'none',
                boxSizing: 'border-box',
              }}
              required
            />
            {authMethod === 'sso' && (
              <p style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <InfoIcon />
                Use your SSO email address
              </p>
            )}
          </div>

          {/* Token (only for token auth) */}
          {authMethod === 'token' && (
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ fontSize: '0.875rem', fontWeight: 500, color: '#374151', marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <KeyIcon />
                Personal Access Token *
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showSecret ? 'text' : 'password'}
                  value={formData.token}
                  onChange={(e) => handleChange('token', e.target.value)}
                  placeholder="Paste your PAT here..."
                  style={{
                    width: '100%',
                    padding: '0.625rem 1rem',
                    paddingRight: '2.5rem',
                    border: '1px solid #d1d5db',
                    borderRadius: '8px',
                    fontSize: '0.875rem',
                    fontFamily: 'monospace',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowSecret(!showSecret)}
                  style={{
                    position: 'absolute',
                    right: '0.75rem',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: '#9ca3af',
                    padding: 0,
                  }}
                >
                  {showSecret ? <EyeOffIcon /> : <EyeIcon />}
                </button>
              </div>
            </div>
          )}

          {/* SSO Info */}
          {authMethod === 'sso' && (
            <div
              style={{
                padding: '0.75rem',
                backgroundColor: '#fef3c7',
                border: '1px solid #fcd34d',
                borderRadius: '8px',
                marginBottom: '1rem',
              }}
            >
              <p style={{ fontSize: '0.875rem', color: '#92400e', display: 'flex', alignItems: 'flex-start', gap: '0.5rem', margin: 0 }}>
                <span style={{ marginTop: '2px' }}><InfoIcon /></span>
                <span>A browser window will open for SSO login. The backend must be running locally.</span>
              </p>
            </div>
          )}

          {/* Warehouse & Database */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: '#374151', marginBottom: '0.25rem' }}>
                Warehouse
              </label>
              <input
                type="text"
                value={formData.warehouse}
                onChange={(e) => handleChange('warehouse', e.target.value)}
                placeholder="COMPUTE_WH"
                style={{
                  width: '100%',
                  padding: '0.625rem 1rem',
                  border: '1px solid #d1d5db',
                  borderRadius: '8px',
                  fontSize: '0.875rem',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: '#374151', marginBottom: '0.25rem' }}>
                Database
              </label>
              <input
                type="text"
                value={formData.database}
                onChange={(e) => handleChange('database', e.target.value)}
                placeholder="ATLAN_GOLD"
                style={{
                  width: '100%',
                  padding: '0.625rem 1rem',
                  border: '1px solid #d1d5db',
                  borderRadius: '8px',
                  fontSize: '0.875rem',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>
          </div>

          {/* Schema & Role */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: '#374151', marginBottom: '0.25rem' }}>
                Schema
              </label>
              <input
                type="text"
                value={formData.schema}
                onChange={(e) => handleChange('schema', e.target.value)}
                placeholder="PUBLIC"
                style={{
                  width: '100%',
                  padding: '0.625rem 1rem',
                  border: '1px solid #d1d5db',
                  borderRadius: '8px',
                  fontSize: '0.875rem',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: '#374151', marginBottom: '0.25rem' }}>
                Role
              </label>
              <input
                type="text"
                value={formData.role}
                onChange={(e) => handleChange('role', e.target.value)}
                placeholder="ACCOUNTADMIN"
                style={{
                  width: '100%',
                  padding: '0.625rem 1rem',
                  border: '1px solid #d1d5db',
                  borderRadius: '8px',
                  fontSize: '0.875rem',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>
          </div>

          {/* Remember settings */}
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', marginBottom: '1rem' }}>
            <input
              type="checkbox"
              checked={saveToStorage}
              onChange={(e) => setSaveToStorage(e.target.checked)}
              style={{ width: '1rem', height: '1rem' }}
            />
            <span style={{ fontSize: '0.875rem', color: '#6b7280' }}>Remember connection settings</span>
          </label>

          {/* Test Result */}
          {testResult && (
            <div
              style={{
                padding: '1rem',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.75rem',
                marginBottom: '1rem',
                backgroundColor: testResult.connected ? '#ecfdf5' : '#fef2f2',
                border: `1px solid ${testResult.connected ? '#6ee7b7' : '#fca5a5'}`,
              }}
            >
              {testResult.connected ? (
                <span style={{ color: '#10b981' }}><CheckCircleIcon /></span>
              ) : (
                <span style={{ color: '#ef4444' }}><AlertCircleIcon /></span>
              )}
              <div>
                <p style={{ fontWeight: 500, margin: 0, color: testResult.connected ? '#065f46' : '#991b1b' }}>
                  {testResult.connected ? 'Connected successfully!' : 'Connection failed'}
                </p>
                {testResult.connected ? (
                  <p style={{ fontSize: '0.875rem', color: '#047857', margin: '0.25rem 0 0' }}>
                    {testResult.user}@{testResult.warehouse} • {testResult.session_id ? 'Session active' : testResult.database}
                  </p>
                ) : (
                  <p style={{ fontSize: '0.875rem', color: '#dc2626', margin: '0.25rem 0 0' }}>
                    {testResult.error}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Actions */}
          <div style={{ display: 'flex', gap: '0.75rem', paddingTop: '0.5rem' }}>
            <button
              type="button"
              onClick={handleClose}
              style={{
                flex: 1,
                padding: '0.625rem 1rem',
                border: '1px solid #d1d5db',
                backgroundColor: 'white',
                color: '#374151',
                borderRadius: '8px',
                fontWeight: 500,
                cursor: 'pointer',
                transition: 'background-color 0.15s',
              }}
            >
              {testing ? 'Cancel' : 'Close'}
            </button>
            <button
              type="submit"
              disabled={testing || !formData.account || !formData.user || (authMethod === 'token' && !formData.token)}
              style={{
                flex: 1,
                padding: '0.625rem 1rem',
                border: 'none',
                backgroundColor: testing ? '#9ca3af' : '#3366FF',
                color: 'white',
                borderRadius: '8px',
                fontWeight: 500,
                cursor: testing ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                opacity: (testing || (authMethod === 'sso' && !formData.account)) ? 0.5 : 1,
                transition: 'background-color 0.15s',
              }}
            >
              {testing ? (
                <>
                  <LoaderIcon />
                  {authMethod === 'sso' ? 'Waiting for SSO...' : 'Connecting...'}
                </>
              ) : (
                'Connect'
              )}
            </button>
          </div>
        </form>

        {/* Footer Note */}
        <div style={{ padding: '0 1.5rem 1.25rem' }}>
          <p style={{ fontSize: '0.75rem', color: '#9ca3af', textAlign: 'center', margin: 0 }}>
            Credentials are sent to the backend server at {window.location.origin}
          </p>
        </div>
      </div>

      {/* Spinner animation */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .animate-spin {
          animation: spin 1s linear infinite;
        }
      `}</style>
    </div>
  );
}

export default SnowflakeConnectionModal;
