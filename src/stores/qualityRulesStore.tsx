/**
 * Quality Rules Store
 *
 * Manages configurable quality scoring rules:
 * - Score thresholds (excellent/good/fair/poor/critical boundaries)
 * - Field requirements (required/recommended/optional)
 * - Dimension weights for overall score calculation
 */

import { createContext, useContext, useState, useCallback, useEffect, useMemo } from 'react';
import type { ReactNode } from 'react';

// Score band thresholds
export interface ScoreThresholds {
  excellent: number; // Score >= this is "excellent"
  good: number;      // Score >= this is "good"
  fair: number;      // Score >= this is "fair"
  poor: number;      // Score >= this is "poor"
  // Below poor is "critical"
}

// Field requirement levels
export type RequirementLevel = 'required' | 'recommended' | 'optional' | 'hidden';

// Field requirements configuration
export interface FieldRequirements {
  description: RequirementLevel;
  owner: RequirementLevel;
  tags: RequirementLevel;
  terms: RequirementLevel;
  lineage: RequirementLevel;
  certificate: RequirementLevel;
  classifications: RequirementLevel;
  readme: RequirementLevel;
  domain: RequirementLevel;
}

// Dimension weights for overall score calculation
export interface DimensionWeights {
  completeness: number;
  accuracy: number;
  timeliness: number;
  consistency: number;
  usability: number;
}

// Complete quality rules configuration
export interface QualityRules {
  thresholds: ScoreThresholds;
  fieldRequirements: FieldRequirements;
  dimensionWeights: DimensionWeights;
  // Optional asset-type specific overrides
  assetTypeOverrides?: Record<string, Partial<FieldRequirements>>;
}

// Default configuration
export const DEFAULT_THRESHOLDS: ScoreThresholds = {
  excellent: 80,
  good: 60,
  fair: 40,
  poor: 20,
};

export const DEFAULT_FIELD_REQUIREMENTS: FieldRequirements = {
  description: 'required',
  owner: 'required',
  tags: 'recommended',
  terms: 'recommended',
  lineage: 'required',
  certificate: 'recommended',
  classifications: 'optional',
  readme: 'optional',
  domain: 'optional',
};

export const DEFAULT_DIMENSION_WEIGHTS: DimensionWeights = {
  completeness: 25,
  accuracy: 20,
  timeliness: 20,
  consistency: 15,
  usability: 20,
};

export const DEFAULT_QUALITY_RULES: QualityRules = {
  thresholds: DEFAULT_THRESHOLDS,
  fieldRequirements: DEFAULT_FIELD_REQUIREMENTS,
  dimensionWeights: DEFAULT_DIMENSION_WEIGHTS,
};

// Context type
interface QualityRulesContextType {
  rules: QualityRules;
  setThresholds: (thresholds: ScoreThresholds) => void;
  setFieldRequirements: (requirements: FieldRequirements) => void;
  setDimensionWeights: (weights: DimensionWeights) => void;
  setAssetTypeOverride: (assetType: string, overrides: Partial<FieldRequirements>) => void;
  removeAssetTypeOverride: (assetType: string) => void;
  resetToDefaults: () => void;
  exportRules: () => string;
  importRules: (json: string) => boolean;
  // Utility functions
  getScoreBand: (score: number) => 'excellent' | 'good' | 'fair' | 'poor' | 'critical';
  getScoreColor: (score: number) => string;
  getScoreLabel: (score: number) => string;
  getFieldRequirement: (field: keyof FieldRequirements, assetType?: string) => RequirementLevel;
  calculateWeightedScore: (scores: Record<string, number>) => number;
}

const QualityRulesContext = createContext<QualityRulesContextType | undefined>(undefined);

const STORAGE_KEY = 'mqp.qualityRules';

export function QualityRulesProvider({ children }: { children: ReactNode }) {
  const [rules, setRules] = useState<QualityRules>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        // Merge with defaults to ensure all fields exist
        return {
          thresholds: { ...DEFAULT_THRESHOLDS, ...parsed.thresholds },
          fieldRequirements: { ...DEFAULT_FIELD_REQUIREMENTS, ...parsed.fieldRequirements },
          dimensionWeights: { ...DEFAULT_DIMENSION_WEIGHTS, ...parsed.dimensionWeights },
          assetTypeOverrides: parsed.assetTypeOverrides || {},
        };
      }
    } catch {
      // Ignore parse errors
    }
    return DEFAULT_QUALITY_RULES;
  });

  // Persist to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(rules));
    } catch {
      // Ignore storage errors
    }
  }, [rules]);

  const setThresholds = useCallback((thresholds: ScoreThresholds) => {
    // Validate thresholds are in descending order
    if (
      thresholds.excellent > thresholds.good &&
      thresholds.good > thresholds.fair &&
      thresholds.fair > thresholds.poor &&
      thresholds.poor >= 0 &&
      thresholds.excellent <= 100
    ) {
      setRules((prev) => ({ ...prev, thresholds }));
    }
  }, []);

  const setFieldRequirements = useCallback((fieldRequirements: FieldRequirements) => {
    setRules((prev) => ({ ...prev, fieldRequirements }));
  }, []);

  const setDimensionWeights = useCallback((dimensionWeights: DimensionWeights) => {
    setRules((prev) => ({ ...prev, dimensionWeights }));
  }, []);

  const setAssetTypeOverride = useCallback(
    (assetType: string, overrides: Partial<FieldRequirements>) => {
      setRules((prev) => ({
        ...prev,
        assetTypeOverrides: {
          ...prev.assetTypeOverrides,
          [assetType]: overrides,
        },
      }));
    },
    []
  );

  const removeAssetTypeOverride = useCallback((assetType: string) => {
    setRules((prev) => {
      const newOverrides = { ...prev.assetTypeOverrides };
      delete newOverrides[assetType];
      return { ...prev, assetTypeOverrides: newOverrides };
    });
  }, []);

  const resetToDefaults = useCallback(() => {
    setRules(DEFAULT_QUALITY_RULES);
  }, []);

  const exportRules = useCallback(() => {
    return JSON.stringify(rules, null, 2);
  }, [rules]);

  const importRules = useCallback((json: string): boolean => {
    try {
      const parsed = JSON.parse(json);
      // Validate structure
      if (
        parsed.thresholds &&
        parsed.fieldRequirements &&
        parsed.dimensionWeights
      ) {
        setRules({
          thresholds: { ...DEFAULT_THRESHOLDS, ...parsed.thresholds },
          fieldRequirements: { ...DEFAULT_FIELD_REQUIREMENTS, ...parsed.fieldRequirements },
          dimensionWeights: { ...DEFAULT_DIMENSION_WEIGHTS, ...parsed.dimensionWeights },
          assetTypeOverrides: parsed.assetTypeOverrides || {},
        });
        return true;
      }
    } catch {
      // Parse error
    }
    return false;
  }, []);

  // Utility functions
  const getScoreBand = useCallback(
    (score: number): 'excellent' | 'good' | 'fair' | 'poor' | 'critical' => {
      const { thresholds } = rules;
      if (score >= thresholds.excellent) return 'excellent';
      if (score >= thresholds.good) return 'good';
      if (score >= thresholds.fair) return 'fair';
      if (score >= thresholds.poor) return 'poor';
      return 'critical';
    },
    [rules]
  );

  const getScoreColor = useCallback(
    (score: number): string => {
      const band = getScoreBand(score);
      switch (band) {
        case 'excellent':
          return 'var(--score-excellent, #22c55e)';
        case 'good':
          return 'var(--score-good, #84cc16)';
        case 'fair':
          return 'var(--score-fair, #eab308)';
        case 'poor':
          return 'var(--score-poor, #f97316)';
        case 'critical':
          return 'var(--score-critical, #ef4444)';
      }
    },
    [getScoreBand]
  );

  const getScoreLabel = useCallback(
    (score: number): string => {
      const band = getScoreBand(score);
      return band.charAt(0).toUpperCase() + band.slice(1);
    },
    [getScoreBand]
  );

  const getFieldRequirement = useCallback(
    (field: keyof FieldRequirements, assetType?: string): RequirementLevel => {
      // Check asset-type specific override first
      if (assetType && rules.assetTypeOverrides?.[assetType]?.[field]) {
        return rules.assetTypeOverrides[assetType][field]!;
      }
      return rules.fieldRequirements[field];
    },
    [rules]
  );

  const calculateWeightedScore = useCallback(
    (scores: Record<string, number>): number => {
      const { dimensionWeights } = rules;
      const totalWeight =
        dimensionWeights.completeness +
        dimensionWeights.accuracy +
        dimensionWeights.timeliness +
        dimensionWeights.consistency +
        dimensionWeights.usability;

      if (totalWeight === 0) return 0;

      const weightedSum =
        (scores.completeness || 0) * dimensionWeights.completeness +
        (scores.accuracy || 0) * dimensionWeights.accuracy +
        (scores.timeliness || 0) * dimensionWeights.timeliness +
        (scores.consistency || 0) * dimensionWeights.consistency +
        (scores.usability || 0) * dimensionWeights.usability;

      return Math.round(weightedSum / totalWeight);
    },
    [rules]
  );

  const value = useMemo(
    () => ({
      rules,
      setThresholds,
      setFieldRequirements,
      setDimensionWeights,
      setAssetTypeOverride,
      removeAssetTypeOverride,
      resetToDefaults,
      exportRules,
      importRules,
      getScoreBand,
      getScoreColor,
      getScoreLabel,
      getFieldRequirement,
      calculateWeightedScore,
    }),
    [
      rules,
      setThresholds,
      setFieldRequirements,
      setDimensionWeights,
      setAssetTypeOverride,
      removeAssetTypeOverride,
      resetToDefaults,
      exportRules,
      importRules,
      getScoreBand,
      getScoreColor,
      getScoreLabel,
      getFieldRequirement,
      calculateWeightedScore,
    ]
  );

  return (
    <QualityRulesContext.Provider value={value}>
      {children}
    </QualityRulesContext.Provider>
  );
}

export function useQualityRules(): QualityRulesContextType {
  const context = useContext(QualityRulesContext);
  if (context === undefined) {
    throw new Error('useQualityRules must be used within a QualityRulesProvider');
  }
  return context;
}

// Standalone utility functions that use defaults (for use outside provider)
export function getDefaultScoreBand(score: number): 'excellent' | 'good' | 'fair' | 'poor' | 'critical' {
  if (score >= DEFAULT_THRESHOLDS.excellent) return 'excellent';
  if (score >= DEFAULT_THRESHOLDS.good) return 'good';
  if (score >= DEFAULT_THRESHOLDS.fair) return 'fair';
  if (score >= DEFAULT_THRESHOLDS.poor) return 'poor';
  return 'critical';
}

export function getDefaultScoreColor(score: number): string {
  const band = getDefaultScoreBand(score);
  switch (band) {
    case 'excellent':
      return 'var(--score-excellent, #22c55e)';
    case 'good':
      return 'var(--score-good, #84cc16)';
    case 'fair':
      return 'var(--score-fair, #eab308)';
    case 'poor':
      return 'var(--score-poor, #f97316)';
    case 'critical':
      return 'var(--score-critical, #ef4444)';
  }
}
