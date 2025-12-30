import { createContext, useContext, useState, useCallback, useEffect } from "react";
import type { ReactNode } from "react";

export type ScoringMode = "legacy" | "config-driven";

interface ScoringSettingsState {
  scoringMode: ScoringMode;
  activeProfiles: string[];
  configVersion: string | null;
  setScoringMode: (mode: ScoringMode) => void;
  setActiveProfiles: (profiles: string[]) => void;
  setConfigVersion: (version: string) => void;
}

const ScoringSettingsContext = createContext<ScoringSettingsState | undefined>(undefined);

const STORAGE_KEY = "scoring-settings-storage";

export function ScoringSettingsProvider({ children }: { children: ReactNode }) {
  const [scoringMode, setScoringModeState] = useState<ScoringMode>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        return parsed.scoringMode || "legacy";
      }
    } catch {
      // Ignore parse errors
    }
    return "legacy";
  });

  const [activeProfiles, setActiveProfilesState] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        return parsed.activeProfiles || ["industry5d", "standardCompleteness"];
      }
    } catch {
      // Ignore parse errors
    }
    return ["industry5d", "standardCompleteness"];
  });

  const [configVersion, setConfigVersionState] = useState<string | null>(null);

  // Persist to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        scoringMode,
        activeProfiles,
        configVersion,
      }));
    } catch {
      // Ignore storage errors
    }
  }, [scoringMode, activeProfiles, configVersion]);

  const setScoringMode = useCallback((mode: ScoringMode) => {
    setScoringModeState(mode);
  }, []);

  const setActiveProfiles = useCallback((profiles: string[]) => {
    setActiveProfilesState(profiles);
  }, []);

  const setConfigVersion = useCallback((version: string) => {
    setConfigVersionState(version);
  }, []);

  return (
    <ScoringSettingsContext.Provider
      value={{
        scoringMode,
        activeProfiles,
        configVersion,
        setScoringMode,
        setActiveProfiles,
        setConfigVersion,
      }}
    >
      {children}
    </ScoringSettingsContext.Provider>
  );
}

export function useScoringSettingsStore(): ScoringSettingsState {
  const context = useContext(ScoringSettingsContext);
  if (context === undefined) {
    // Return default values if used outside provider
    return {
      scoringMode: "legacy",
      activeProfiles: ["industry5d", "standardCompleteness"],
      configVersion: null,
      setScoringMode: () => {},
      setActiveProfiles: () => {},
      setConfigVersion: () => {},
    };
  }
  return context;
}

