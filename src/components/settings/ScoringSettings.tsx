import React from "react";
import { useScoringSettingsStore, type ScoringMode } from "../../stores/scoringSettingsStore";
import { loadQualityConfig } from "../../config/quality";

export function ScoringSettings() {
  const { scoringMode, activeProfiles, configVersion, setScoringMode, setActiveProfiles } = useScoringSettingsStore();
  const config = loadQualityConfig();

  const handleModeChange = (mode: ScoringMode) => {
    setScoringMode(mode);
  };

  const handleProfileToggle = (profileId: string) => {
    const newProfiles = activeProfiles.includes(profileId)
      ? activeProfiles.filter(p => p !== profileId)
      : [...activeProfiles, profileId];
    setActiveProfiles(newProfiles);
  };

  return (
    <div className="scoring-settings" style={{ padding: "1rem", border: "1px solid #e0e0e0", borderRadius: "8px", marginBottom: "1rem" }}>
      <h3 style={{ marginTop: 0, marginBottom: "1rem" }}>Scoring Settings</h3>
      
      <div style={{ marginBottom: "1rem" }}>
        <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "500" }}>
          Scoring Mode
        </label>
        <div style={{ display: "flex", gap: "1rem" }}>
          <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer" }}>
            <input
              type="radio"
              name="scoringMode"
              value="legacy"
              checked={scoringMode === "legacy"}
              onChange={() => handleModeChange("legacy")}
            />
            <span>Legacy</span>
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer" }}>
            <input
              type="radio"
              name="scoringMode"
              value="config-driven"
              checked={scoringMode === "config-driven"}
              onChange={() => handleModeChange("config-driven")}
            />
            <span>Config-Driven</span>
          </label>
        </div>
        {scoringMode === "config-driven" && (
          <p style={{ marginTop: "0.5rem", fontSize: "0.875rem", color: "#666" }}>
            Using config-driven scoring with profiles: {activeProfiles.join(", ")}
          </p>
        )}
      </div>

      {scoringMode === "config-driven" && (
        <div style={{ marginBottom: "1rem" }}>
          <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "500" }}>
            Active Profiles
          </label>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={activeProfiles.includes("industry5d")}
                onChange={() => handleProfileToggle("industry5d")}
              />
              <span>Industry 5D</span>
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={activeProfiles.includes("standardCompleteness")}
                onChange={() => handleProfileToggle("standardCompleteness")}
              />
              <span>Standard Completeness</span>
            </label>
          </div>
        </div>
      )}

      {configVersion && (
        <div style={{ fontSize: "0.875rem", color: "#666" }}>
          Config Version: {configVersion}
        </div>
      )}
    </div>
  );
}







