import { useEffect, useState } from "react";
import {
  useBackendModeStore,
  useEffectiveBackend,
  type DataBackend,
} from "../../stores/backendModeStore";
import { SnowflakeConnectionModal } from "./SnowflakeConnectionModal";

/**
 * DataBackendSettings Component
 *
 * Allows users to toggle between Atlan REST API and MDLH (Snowflake) as the
 * data backend for analytics, pivots, and quality metrics.
 */
export function DataBackendSettings() {
  const {
    dataBackend,
    snowflakeStatus,
    isConnecting,
    connectionError,
    setDataBackend,
    fetchMdlhConfig,
    disconnect,
    refreshStatus,
  } = useBackendModeStore();

  const effectiveBackend = useEffectiveBackend();

  // Local state for modal
  const [showConnectionModal, setShowConnectionModal] = useState(false);

  // Fetch config and status on mount
  useEffect(() => {
    fetchMdlhConfig();
    refreshStatus();
  }, [fetchMdlhConfig, refreshStatus]);

  const handleBackendChange = (backend: DataBackend) => {
    if (backend === "mdlh" && !snowflakeStatus.connected) {
      // Don't allow switching to MDLH without connection
      return;
    }
    setDataBackend(backend);
  };

  const handleDisconnect = async () => {
    await disconnect();
  };

  // Note: We no longer hide the connection UI when MDLH isn't enabled in backend config.
  // Users should always be able to connect to Snowflake from the settings page.

  return (
    <div
      className="data-backend-settings"
      style={{
        padding: "1rem",
        border: "1px solid #e0e0e0",
        borderRadius: "8px",
        marginBottom: "1rem",
      }}
    >
      <h3 style={{ marginTop: 0, marginBottom: "1rem" }}>Data Backend</h3>

      {/* Backend Selection */}
      <div style={{ marginBottom: "1rem" }}>
        <label
          style={{ display: "block", marginBottom: "0.5rem", fontWeight: "500" }}
        >
          Data Source
        </label>
        <div style={{ display: "flex", gap: "1rem" }}>
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              cursor: "pointer",
            }}
          >
            <input
              type="radio"
              name="dataBackend"
              value="api"
              checked={dataBackend === "api"}
              onChange={() => handleBackendChange("api")}
            />
            <span>Atlan API</span>
          </label>
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              cursor: snowflakeStatus.connected ? "pointer" : "not-allowed",
              opacity: snowflakeStatus.connected ? 1 : 0.5,
            }}
          >
            <input
              type="radio"
              name="dataBackend"
              value="mdlh"
              checked={dataBackend === "mdlh"}
              disabled={!snowflakeStatus.connected}
              onChange={() => handleBackendChange("mdlh")}
            />
            <span>MDLH (Snowflake)</span>
          </label>
        </div>

        {/* Effective backend notice */}
        {dataBackend === "mdlh" && !snowflakeStatus.connected && (
          <p
            style={{
              marginTop: "0.5rem",
              fontSize: "0.875rem",
              color: "#d97706",
            }}
          >
            MDLH selected but not connected. Using API as fallback.
          </p>
        )}
      </div>

      {/* Connection Status */}
      <div
        style={{
          marginBottom: "1rem",
          padding: "0.75rem",
          backgroundColor: snowflakeStatus.connected ? "#ecfdf5" : "#fef3c7",
          borderRadius: "6px",
          border: `1px solid ${snowflakeStatus.connected ? "#10b981" : "#fbbf24"}`,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <span
              style={{
                width: "10px",
                height: "10px",
                borderRadius: "50%",
                backgroundColor: snowflakeStatus.connected ? "#10b981" : "#fbbf24",
              }}
            />
            <span style={{ fontWeight: "500" }}>
              {snowflakeStatus.connected
                ? "Connected to Snowflake"
                : "Not Connected"}
            </span>
          </div>
          {snowflakeStatus.connected && (
            <button
              onClick={handleDisconnect}
              style={{
                padding: "0.25rem 0.75rem",
                fontSize: "0.75rem",
                backgroundColor: "#fee2e2",
                color: "#dc2626",
                border: "1px solid #fca5a5",
                borderRadius: "4px",
                cursor: "pointer",
              }}
            >
              Disconnect
            </button>
          )}
        </div>

        {snowflakeStatus.connected && (
          <div
            style={{
              marginTop: "0.5rem",
              fontSize: "0.875rem",
              color: "#065f46",
            }}
          >
            <div>User: {snowflakeStatus.user}</div>
            <div>Method: {snowflakeStatus.authMethod?.toUpperCase()}</div>
            {snowflakeStatus.warehouse && (
              <div>Warehouse: {snowflakeStatus.warehouse}</div>
            )}
            {snowflakeStatus.database && (
              <div>Database: {snowflakeStatus.database}</div>
            )}
          </div>
        )}
      </div>

      {/* Connection Error */}
      {connectionError && (
        <div
          style={{
            marginBottom: "1rem",
            padding: "0.75rem",
            backgroundColor: "#fef2f2",
            borderRadius: "6px",
            border: "1px solid #fca5a5",
            color: "#dc2626",
            fontSize: "0.875rem",
          }}
        >
          {connectionError}
        </div>
      )}

      {/* Connect Button */}
      {!snowflakeStatus.connected && (
        <div style={{ marginBottom: "1rem" }}>
          <button
            onClick={() => setShowConnectionModal(true)}
            disabled={isConnecting}
            style={{
              padding: "0.5rem 1rem",
              backgroundColor: isConnecting ? "#9ca3af" : "#3b82f6",
              color: "white",
              border: "none",
              borderRadius: "6px",
              cursor: isConnecting ? "not-allowed" : "pointer",
              fontWeight: "500",
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
            }}
          >
            {isConnecting ? (
              <>
                <span
                  style={{
                    width: "14px",
                    height: "14px",
                    border: "2px solid white",
                    borderTopColor: "transparent",
                    borderRadius: "50%",
                    animation: "spin 1s linear infinite",
                  }}
                />
                Connecting...
              </>
            ) : (
              "Connect to Snowflake"
            )}
          </button>

          <p style={{ marginTop: "0.5rem", fontSize: "0.75rem", color: "#666" }}>
            Configure your Snowflake connection settings.
          </p>
        </div>
      )}

      {/* Snowflake Connection Modal */}
      <SnowflakeConnectionModal
        isOpen={showConnectionModal}
        onClose={() => setShowConnectionModal(false)}
        onConnect={() => {
          setShowConnectionModal(false);
          refreshStatus();
        }}
      />

      {/* Current Mode Info */}
      <div
        style={{
          fontSize: "0.875rem",
          color: "#666",
          borderTop: "1px solid #e0e0e0",
          paddingTop: "0.75rem",
        }}
      >
        <strong>Current Mode:</strong>{" "}
        {effectiveBackend === "api"
          ? "All data is fetched via Atlan REST API"
          : "Analytics and pivots use MDLH (Snowflake) queries"}
      </div>

      {/* CSS for spinner animation */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
