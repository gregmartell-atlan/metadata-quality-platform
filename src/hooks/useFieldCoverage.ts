/**
 * useFieldCoverage Hook
 *
 * Calculates field coverage statistics across asset types
 */

import { useMemo } from 'react';

export interface AssetTypeCoverage {
  total: number;
  populated: number;
}

export interface FieldCoverageResult {
  field: string;
  total: number;
  populated: number;
  percentage: number;
  byAssetType: Record<string, AssetTypeCoverage>;
}

// Sample data for demo purposes
const sampleCoverageData: FieldCoverageResult[] = [
  {
    field: 'description',
    total: 1250,
    populated: 875,
    percentage: 70,
    byAssetType: {
      Table: { total: 500, populated: 400 },
      View: { total: 300, populated: 225 },
      Column: { total: 450, populated: 250 },
    },
  },
  {
    field: 'owners',
    total: 800,
    populated: 480,
    percentage: 60,
    byAssetType: {
      Table: { total: 500, populated: 350 },
      View: { total: 300, populated: 130 },
    },
  },
  {
    field: 'tags',
    total: 1250,
    populated: 375,
    percentage: 30,
    byAssetType: {
      Table: { total: 500, populated: 200 },
      View: { total: 300, populated: 90 },
      Column: { total: 450, populated: 85 },
    },
  },
  {
    field: 'terms',
    total: 1250,
    populated: 250,
    percentage: 20,
    byAssetType: {
      Table: { total: 500, populated: 125 },
      View: { total: 300, populated: 60 },
      Column: { total: 450, populated: 65 },
    },
  },
  {
    field: 'lineage',
    total: 800,
    populated: 640,
    percentage: 80,
    byAssetType: {
      Table: { total: 500, populated: 425 },
      View: { total: 300, populated: 215 },
    },
  },
  {
    field: 'certificate',
    total: 800,
    populated: 200,
    percentage: 25,
    byAssetType: {
      Table: { total: 500, populated: 150 },
      View: { total: 300, populated: 50 },
    },
  },
  {
    field: 'classifications',
    total: 1250,
    populated: 500,
    percentage: 40,
    byAssetType: {
      Table: { total: 500, populated: 225 },
      View: { total: 300, populated: 120 },
      Column: { total: 450, populated: 155 },
    },
  },
  {
    field: 'readme',
    total: 800,
    populated: 120,
    percentage: 15,
    byAssetType: {
      Table: { total: 500, populated: 85 },
      View: { total: 300, populated: 35 },
    },
  },
];

export function useFieldCoverage(): FieldCoverageResult[] {
  // In a real app, this would fetch data from API or store
  const coverage = useMemo(() => {
    return sampleCoverageData;
  }, []);

  return coverage;
}

export function getOverallCompleteness(coverage: FieldCoverageResult[]): number {
  if (coverage.length === 0) return 0;
  const sum = coverage.reduce((acc, curr) => acc + curr.percentage, 0);
  return Math.round(sum / coverage.length);
}

export function getTopGaps(coverage: FieldCoverageResult[], count = 3): FieldCoverageResult[] {
  return [...coverage].sort((a, b) => a.percentage - b.percentage).slice(0, count);
}
