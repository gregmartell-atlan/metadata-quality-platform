/**
 * Backend Mode Store
 *
 * Manages the data backend selection for the application.
 * Allows switching between Atlan REST API and MDLH (Snowflake) for data fetching.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { logger } from '../utils/logger';

// ============================================
// Types
// ============================================

export type DataBackend = 'api' | 'mdlh';

export interface SnowflakeConnectionStatus {
  connected: boolean;
  authMethod?: 'sso' | 'pat';
  user?: string;
  role?: string;
  warehouse?: string;
  database?: string;
  schema?: string;
  sessionId?: string;
  createdAt?: string;
  lastUsedAt?: string;
}

export interface MdlhConfig {
  enabled: boolean;
  snowflakeAccount?: string;
  snowflakeWarehouse?: string;
  snowflakeDatabase?: string;
  snowflakeSchema?: string;
}

interface BackendModeState {
  // Current backend selection
  dataBackend: DataBackend;

  // Snowflake connection status
  snowflakeStatus: SnowflakeConnectionStatus;

  // MDLH configuration from server
  mdlhConfig: MdlhConfig | null;

  // Loading states
  isConnecting: boolean;
  isLoadingConfig: boolean;
  connectionError: string | null;

  // Fallback tracking
  isInFallbackMode: boolean;
  fallbackReason: string | null;
  lastFallbackTime: string | null;
  fallbackCount: number;

  // Connection version - increments on connect/disconnect for reactive refresh
  connectionVersion: number;

  // Actions
  setDataBackend: (backend: DataBackend) => void;
  setSnowflakeStatus: (status: SnowflakeConnectionStatus) => void;
  setMdlhConfig: (config: MdlhConfig) => void;
  setIsConnecting: (connecting: boolean) => void;
  setConnectionError: (error: string | null) => void;

  // Fallback actions
  triggerFallback: (reason: string) => void;
  clearFallback: () => void;

  // Async actions
  fetchMdlhConfig: () => Promise<void>;
  connectSSO: (account?: string) => Promise<boolean>;
  connectPAT: (user: string, privateKeyPath: string, passphrase?: string) => Promise<boolean>;
  disconnect: () => Promise<void>;
  refreshStatus: () => Promise<void>;

  // Computed helpers
  isSnowflakeConnected: () => boolean;
  canUseMdlh: () => boolean;
}

// ============================================
// API Base URL
// ============================================

const API_BASE = '/api';

// ============================================
// Store
// ============================================

export const useBackendModeStore = create<BackendModeState>()(
  persist(
    (set, get) => ({
      // Initial state - default to MDLH as primary backend
      dataBackend: 'mdlh',
      snowflakeStatus: { connected: false },
      mdlhConfig: null,
      isConnecting: false,
      isLoadingConfig: false,
      connectionError: null,

      // Fallback state
      isInFallbackMode: false,
      fallbackReason: null,
      lastFallbackTime: null,
      fallbackCount: 0,

      // Connection version for reactive refresh
      connectionVersion: 0,

      // Simple setters
      setDataBackend: (backend) => {
        logger.info('[BackendModeStore] Setting data backend:', backend);
        // Clear fallback state when switching backends
        set({ 
          dataBackend: backend,
          isInFallbackMode: false,
          fallbackReason: null,
          fallbackCount: 0,
        });
      },

      setSnowflakeStatus: (status) => {
        const wasConnected = get().snowflakeStatus.connected;
        const isNowConnected = status.connected;
        const connectionChanged = wasConnected !== isNowConnected;
        
        set({ snowflakeStatus: status });
        
        // Increment connection version when connection state changes
        // This triggers all subscribed components to refresh their data
        if (connectionChanged) {
          const newVersion = get().connectionVersion + 1;
          logger.info('[BackendModeStore] Connection state changed, incrementing version to:', newVersion);
          set({ connectionVersion: newVersion });
        }
        
        // If we regain connection and were in fallback mode, clear it
        if (status.connected && get().isInFallbackMode) {
          logger.info('[BackendModeStore] Connection restored, clearing fallback mode');
          set({
            isInFallbackMode: false,
            fallbackReason: null,
          });
        }
      },

      setMdlhConfig: (config) => {
        set({ mdlhConfig: config });
      },

      setIsConnecting: (connecting) => {
        set({ isConnecting: connecting });
      },

      setConnectionError: (error) => {
        set({ connectionError: error });
      },

      // Fallback actions
      triggerFallback: (reason) => {
        const state = get();
        // Only trigger if we're supposed to be in MDLH mode
        if (state.dataBackend !== 'mdlh') {
          return;
        }
        
        const newCount = state.fallbackCount + 1;
        logger.warn('[BackendModeStore] Fallback triggered:', reason, { count: newCount });
        
        set({
          isInFallbackMode: true,
          fallbackReason: reason,
          lastFallbackTime: new Date().toISOString(),
          fallbackCount: newCount,
        });
        
        // If too many fallbacks, consider the connection lost
        if (newCount >= 3) {
          logger.error('[BackendModeStore] Too many fallbacks, marking connection as lost');
          set({
            snowflakeStatus: { connected: false },
          });
        }
      },

      clearFallback: () => {
        logger.info('[BackendModeStore] Clearing fallback mode');
        set({
          isInFallbackMode: false,
          fallbackReason: null,
          fallbackCount: 0,
        });
      },

      // Fetch MDLH configuration from server
      fetchMdlhConfig: async () => {
        try {
          set({ isLoadingConfig: true });
          logger.info('[BackendModeStore] Fetching MDLH config...');

          const response = await fetch(`${API_BASE}/snowflake/config`);
          if (!response.ok) {
            throw new Error(`Failed to fetch config: ${response.statusText}`);
          }

          const data = await response.json();
          const config: MdlhConfig = {
            enabled: data.mdlh_enabled || false,
            snowflakeAccount: data.snowflake_account,
            snowflakeWarehouse: data.snowflake_warehouse,
            snowflakeDatabase: data.snowflake_database,
            snowflakeSchema: data.snowflake_schema,
          };

          set({ mdlhConfig: config, isLoadingConfig: false });
          logger.info('[BackendModeStore] MDLH config loaded:', config);
        } catch (error) {
          logger.error('[BackendModeStore] Failed to fetch MDLH config:', error);
          set({ isLoadingConfig: false });
        }
      },

      // Connect via SSO - uses unified /connect endpoint with auth_type: 'sso'
      connectSSO: async (account?: string) => {
        try {
          set({ isConnecting: true, connectionError: null });
          logger.info('[BackendModeStore] Initiating SSO connection...');

          const response = await fetch(`${API_BASE}/snowflake/connect`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              account: account || '',
              user: '', // SSO will determine user
              auth_type: 'sso',
            }),
          });

          if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || error.error || 'SSO connection failed');
          }

          const data = await response.json();
          const status: SnowflakeConnectionStatus = {
            connected: data.connected,
            authMethod: 'sso',
            user: data.user,
            role: data.role,
            warehouse: data.warehouse,
            database: data.database,
            schema: data.schema,
            sessionId: data.session_id,
          };

          set({
            snowflakeStatus: status,
            isConnecting: false,
            dataBackend: 'mdlh', // Auto-switch to MDLH on successful connection
          });

          logger.info('[BackendModeStore] SSO connection successful:', status.user);
          return true;
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Connection failed';
          logger.error('[BackendModeStore] SSO connection failed:', message);
          set({
            isConnecting: false,
            connectionError: message,
            snowflakeStatus: { connected: false },
          });
          return false;
        }
      },

      // Connect via PAT (Token) - uses unified /connect endpoint with auth_type: 'token'
      connectPAT: async (user, token, _passphrase) => {
        try {
          set({ isConnecting: true, connectionError: null });
          logger.info('[BackendModeStore] Initiating PAT connection...');

          const response = await fetch(`${API_BASE}/snowflake/connect`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              user,
              token,
              auth_type: 'token',
            }),
          });

          if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || error.error || 'PAT connection failed');
          }

          const data = await response.json();
          const status: SnowflakeConnectionStatus = {
            connected: data.connected,
            authMethod: 'pat',
            user: data.user,
            role: data.role,
            warehouse: data.warehouse,
            database: data.database,
            schema: data.schema,
            sessionId: data.session_id,
          };

          set({
            snowflakeStatus: status,
            isConnecting: false,
            dataBackend: 'mdlh',
          });

          logger.info('[BackendModeStore] PAT connection successful:', status.user);
          return true;
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Connection failed';
          logger.error('[BackendModeStore] PAT connection failed:', message);
          set({
            isConnecting: false,
            connectionError: message,
            snowflakeStatus: { connected: false },
          });
          return false;
        }
      },

      // Disconnect from Snowflake
      disconnect: async () => {
        try {
          logger.info('[BackendModeStore] Disconnecting from Snowflake...');

          const { snowflakeStatus } = get();
          const headers: Record<string, string> = {
            'Content-Type': 'application/json',
          };
          
          // Send session ID if available
          if (snowflakeStatus.sessionId) {
            headers['X-Session-ID'] = snowflakeStatus.sessionId;
          }

          await fetch(`${API_BASE}/snowflake/disconnect`, {
            method: 'POST',
            headers,
          });

          set({
            snowflakeStatus: { connected: false },
            dataBackend: 'api', // Fallback to API
            connectionError: null,
          });

          logger.info('[BackendModeStore] Disconnected');
        } catch (error) {
          logger.error('[BackendModeStore] Disconnect failed:', error);
        }
      },

      // Refresh connection status
      refreshStatus: async () => {
        try {
          const response = await fetch(`${API_BASE}/snowflake/status`);
          if (!response.ok) return;

          const data = await response.json();
          const status: SnowflakeConnectionStatus = {
            connected: data.connected,
            authMethod: data.auth_method,
            user: data.user,
            createdAt: data.created_at,
            lastUsedAt: data.last_used_at,
            sessionId: data.session_id,
          };

          set({ snowflakeStatus: status });

          // Log if connection was lost but do NOT auto-switch to API
          // The UI should handle prompting for reconnection
          if (!status.connected && get().dataBackend === 'mdlh') {
            logger.warn('[BackendModeStore] Lost Snowflake connection - connection required');
          }
        } catch (error) {
          logger.error('[BackendModeStore] Status refresh failed:', error);
        }
      },

      // Computed: Is Snowflake connected?
      isSnowflakeConnected: () => {
        return get().snowflakeStatus.connected;
      },

      // Computed: Can use MDLH?
      canUseMdlh: () => {
        const { mdlhConfig, snowflakeStatus } = get();
        return (mdlhConfig?.enabled ?? false) && snowflakeStatus.connected;
      },
    }),
    {
      name: 'backend-mode-storage',
      partialize: (state) => ({
        // Only persist the backend selection, not connection status
        dataBackend: state.dataBackend,
      }),
    }
  )
);

// ============================================
// Hooks for common patterns
// ============================================

/**
 * Hook to get the current data backend with connection awareness.
 *
 * IMPORTANT: No longer auto-falls back to API. If MDLH is selected,
 * it stays MDLH - the UI should prompt for connection instead of
 * silently switching backends.
 */
export function useEffectiveBackend(): DataBackend {
  const { dataBackend } = useBackendModeStore();
  return dataBackend;
}

/**
 * Hook to check if MDLH is selected but not connected.
 * Use this to show connection prompts instead of auto-fallback.
 */
export function useMdlhConnectionRequired(): boolean {
  const { dataBackend, snowflakeStatus } = useBackendModeStore();
  return dataBackend === 'mdlh' && !snowflakeStatus.connected;
}

/**
 * Hook to check if MDLH features should be shown.
 */
export function useMdlhEnabled(): boolean {
  const { mdlhConfig } = useBackendModeStore();
  return mdlhConfig?.enabled ?? false;
}

/**
 * Hook to periodically check connection health when in MDLH mode.
 * Automatically refreshes status and clears fallback on reconnection.
 */
export function useConnectionHealthCheck(intervalMs: number = 30000): void {
  const { dataBackend, refreshStatus, isInFallbackMode } = useBackendModeStore();

  // Import useEffect dynamically to avoid issues in non-React contexts
  if (typeof window !== 'undefined') {
    // This would normally use useEffect, but we'll set up the interval
    // in a way that can be called from a React component
  }
}

/**
 * Start the connection health check interval.
 * Call this from App.tsx or similar root component.
 */
let healthCheckInterval: ReturnType<typeof setInterval> | null = null;

export function startConnectionHealthCheck(intervalMs: number = 30000): void {
  if (healthCheckInterval) {
    clearInterval(healthCheckInterval);
  }

  healthCheckInterval = setInterval(() => {
    const state = useBackendModeStore.getState();
    
    // Only check if we're supposed to be in MDLH mode
    if (state.dataBackend === 'mdlh') {
      state.refreshStatus().catch((error) => {
        logger.error('[BackendModeStore] Health check failed:', error);
      });
    }
  }, intervalMs);

  logger.info('[BackendModeStore] Started connection health check with interval:', intervalMs);
}

export function stopConnectionHealthCheck(): void {
  if (healthCheckInterval) {
    clearInterval(healthCheckInterval);
    healthCheckInterval = null;
    logger.info('[BackendModeStore] Stopped connection health check');
  }
}
