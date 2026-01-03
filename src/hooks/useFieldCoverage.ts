/**
 * useFieldCoverage Hook
 *
 * Calculates field coverage statistics across asset types
 * Computes dynamically from scoresStore when real assets are loaded,
 * falls back to sample data for demo mode.
 */

import { useMemo } from 'react';
import { useScoresStore } from '../stores/scoresStore';

export interface AssetTypeCoverage {
  total: number;
  populated: number;
}

export interface FieldCoverageResult {
  field: string;
  label: string;
  total: number;
  populated: number;
  percentage: number;
  byAssetType: Record<string, AssetTypeCoverage>;
}

// Field definitions with how to check if populated
interface FieldDefinition {
  field: string;
  label: string;
  assetTypes: string[]; // Which asset types this field applies to ('*' for all)
  check: (metadata: any, asset: any) => boolean;
}

const FIELD_DEFINITIONS: FieldDefinition[] = [
  {
    field: 'description',
    label: 'Description',
    assetTypes: ['*'],
    check: (m) => Boolean(m.description && m.description.trim().length > 0),
  },
  {
    field: 'owners',
    label: 'Owners',
    assetTypes: ['Table', 'View', 'MaterializedView', 'Database', 'Schema'],
    check: (m) => Boolean(m.owner || m.ownerGroup),
  },
  {
    field: 'tags',
    label: 'Tags',
    assetTypes: ['*'],
    check: (m) => Boolean(m.tags && m.tags.length > 0),
  },
  {
    field: 'terms',
    label: 'Glossary Terms',
    assetTypes: ['*'],
    check: (_, a) => Boolean(a.meanings && a.meanings.length > 0),
  },
  {
    field: 'lineage',
    label: 'Lineage',
    assetTypes: ['Table', 'View', 'MaterializedView', 'Process'],
    check: (m) => Boolean(m.hasLineage),
  },
  {
    field: 'certificate',
    label: 'Certificate',
    assetTypes: ['Table', 'View', 'MaterializedView'],
    check: (m) => Boolean(m.certificationStatus && m.certificationStatus !== 'none'),
  },
  {
    field: 'classifications',
    label: 'Classifications',
    assetTypes: ['*'],
    check: (_, a) => Boolean(a.classificationNames && a.classificationNames.length > 0),
  },
  {
    field: 'readme',
    label: 'README',
    assetTypes: ['Table', 'View', 'MaterializedView', 'Database'],
    check: (_, a) => Boolean(a.readme),
  },
  {
    field: 'domain',
    label: 'Domain',
    assetTypes: ['Table', 'View', 'MaterializedView'],
    check: (m) => Boolean(m.domain && m.domain !== 'No Domain'),
  },
];

// Sample data for demo purposes (fallback when no real assets loaded)
const SAMPLE_COVERAGE_DATA: FieldCoverageResult[] = [
  {
    field: 'description',
    label: 'Description',
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
    label: 'Owners',
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
    label: 'Tags',
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
    label: 'Glossary Terms',
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
    label: 'Lineage',
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
    label: 'Certificate',
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
    label: 'Classifications',
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
    label: 'README',
    total: 800,
    populated: 120,
    percentage: 15,
    byAssetType: {
      Table: { total: 500, populated: 85 },
      View: { total: 300, populated: 35 },
    },
  },
  {
    field: 'domain',
    label: 'Domain',
    total: 800,
    populated: 320,
    percentage: 40,
    byAssetType: {
      Table: { total: 500, populated: 200 },
      View: { total: 300, populated: 120 },
    },
  },
];

/**
 * Compute field coverage from actual asset data
 */
function computeCoverageFromAssets(
  assets: Array<{ asset: any; metadata: any }>
): FieldCoverageResult[] {
  if (assets.length === 0) return [];

  // Group assets by type
  const assetsByType = new Map<string, Array<{ asset: any; metadata: any }>>();
  assets.forEach((item) => {
    const type = item.metadata.assetType || 'Unknown';
    if (!assetsByType.has(type)) {
      assetsByType.set(type, []);
    }
    assetsByType.get(type)!.push(item);
  });

  const assetTypes = Array.from(assetsByType.keys());

  return FIELD_DEFINITIONS.map((fieldDef) => {
    const byAssetType: Record<string, AssetTypeCoverage> = {};
    let totalCount = 0;
    let populatedCount = 0;

    // Determine which asset types this field applies to
    const applicableTypes =
      fieldDef.assetTypes.includes('*')
        ? assetTypes
        : assetTypes.filter((t) => fieldDef.assetTypes.includes(t));

    applicableTypes.forEach((assetType) => {
      const typeAssets = assetsByType.get(assetType) || [];
      const typeTotal = typeAssets.length;
      const typePopulated = typeAssets.filter((item) =>
        fieldDef.check(item.metadata, item.asset)
      ).length;

      byAssetType[assetType] = {
        total: typeTotal,
        populated: typePopulated,
      };

      totalCount += typeTotal;
      populatedCount += typePopulated;
    });

    return {
      field: fieldDef.field,
      label: fieldDef.label,
      total: totalCount,
      populated: populatedCount,
      percentage: totalCount > 0 ? Math.round((populatedCount / totalCount) * 100) : 0,
      byAssetType,
    };
  });
}

export interface UseFieldCoverageOptions {
  /** Force demo mode even if assets are loaded */
  forceDemo?: boolean;
}

export interface UseFieldCoverageResult {
  coverage: FieldCoverageResult[];
  isDemo: boolean;
  assetCount: number;
}

/**
 * Hook to get field coverage data
 * Automatically uses real data when assets are loaded, demo data otherwise
 */
export function useFieldCoverage(options?: UseFieldCoverageOptions): UseFieldCoverageResult {
  const { assetsWithScores } = useScoresStore();
  const forceDemo = options?.forceDemo ?? false;

  const result = useMemo(() => {
    const hasRealAssets = assetsWithScores.length > 0 && !forceDemo;

    if (hasRealAssets) {
      const coverage = computeCoverageFromAssets(assetsWithScores);
      return {
        coverage,
        isDemo: false,
        assetCount: assetsWithScores.length,
      };
    }

    return {
      coverage: SAMPLE_COVERAGE_DATA,
      isDemo: true,
      assetCount: 0,
    };
  }, [assetsWithScores, forceDemo]);

  return result;
}

/**
 * Calculate overall completeness percentage across all fields
 */
export function getOverallCompleteness(coverage: FieldCoverageResult[]): number {
  if (coverage.length === 0) return 0;
  const sum = coverage.reduce((acc, curr) => acc + curr.percentage, 0);
  return Math.round(sum / coverage.length);
}

/**
 * Get fields with lowest coverage (biggest gaps)
 */
export function getTopGaps(coverage: FieldCoverageResult[], count = 3): FieldCoverageResult[] {
  return [...coverage].sort((a, b) => a.percentage - b.percentage).slice(0, count);
}

/**
 * Get fields with highest coverage (strongest areas)
 */
export function getTopStrengths(coverage: FieldCoverageResult[], count = 3): FieldCoverageResult[] {
  return [...coverage].sort((a, b) => b.percentage - a.percentage).slice(0, count);
}

/**
 * Get coverage for a specific asset type
 */
export function getCoverageByAssetType(
  coverage: FieldCoverageResult[],
  assetType: string
): FieldCoverageResult[] {
  return coverage
    .filter((c) => c.byAssetType[assetType])
    .map((c) => {
      const typeData = c.byAssetType[assetType];
      return {
        ...c,
        total: typeData.total,
        populated: typeData.populated,
        percentage: typeData.total > 0 ? Math.round((typeData.populated / typeData.total) * 100) : 0,
      };
    });
}
