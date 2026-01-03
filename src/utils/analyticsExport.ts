/**
 * Analytics Export Utilities
 *
 * Functions for exporting analytics data to various formats
 */

import type { RequirementsMatrix } from '../types/requirements';
import type { FieldCoverageResult } from '../hooks/useFieldCoverage';

interface AnalyticsReport {
  generatedAt: string;
  matrix: {
    name: string;
    assetTypes: number;
    totalRequirements: number;
    requiredFields: number;
    recommendedFields: number;
    optionalFields: number;
  };
  coverage: {
    overallCompleteness: number;
    fieldDetails: Array<{
      field: string;
      percentage: number;
      populated: number;
      total: number;
    }>;
    topGaps: Array<{
      field: string;
      percentage: number;
    }>;
  };
}

export function generateAnalyticsReport(
  matrix: RequirementsMatrix,
  fieldCoverage: FieldCoverageResult[]
): AnalyticsReport {
  const requiredCount = matrix.assetTypeRequirements.reduce(
    (acc, req) => acc + req.requirements.filter((r) => r.level === 'required').length,
    0
  );

  const recommendedCount = matrix.assetTypeRequirements.reduce(
    (acc, req) => acc + req.requirements.filter((r) => r.level === 'recommended').length,
    0
  );

  const optionalCount = matrix.assetTypeRequirements.reduce(
    (acc, req) => acc + req.requirements.filter((r) => r.level === 'optional').length,
    0
  );

  const overallCompleteness =
    fieldCoverage.length > 0
      ? Math.round(fieldCoverage.reduce((acc, curr) => acc + curr.percentage, 0) / fieldCoverage.length)
      : 0;

  const topGaps = [...fieldCoverage]
    .sort((a, b) => a.percentage - b.percentage)
    .slice(0, 5)
    .map((f) => ({ field: f.field, percentage: f.percentage }));

  return {
    generatedAt: new Date().toISOString(),
    matrix: {
      name: matrix.name,
      assetTypes: matrix.assetTypeRequirements.length,
      totalRequirements: requiredCount + recommendedCount + optionalCount,
      requiredFields: requiredCount,
      recommendedFields: recommendedCount,
      optionalFields: optionalCount,
    },
    coverage: {
      overallCompleteness,
      fieldDetails: fieldCoverage.map((f) => ({
        field: f.field,
        percentage: f.percentage,
        populated: f.populated,
        total: f.total,
      })),
      topGaps,
    },
  };
}

export function exportAnalyticsReport(
  matrix: RequirementsMatrix,
  fieldCoverage: FieldCoverageResult[]
): void {
  const report = generateAnalyticsReport(matrix, fieldCoverage);

  // Convert to JSON
  const jsonContent = JSON.stringify(report, null, 2);

  // Create blob and download
  const blob = new Blob([jsonContent], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = `analytics-report-${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
}

export function exportAnalyticsCSV(
  matrix: RequirementsMatrix,
  fieldCoverage: FieldCoverageResult[]
): void {
  const report = generateAnalyticsReport(matrix, fieldCoverage);

  // Build CSV content
  const lines: string[] = [
    'DaaP Analytics Report',
    `Generated: ${report.generatedAt}`,
    '',
    'Requirements Matrix',
    `Name,${report.matrix.name}`,
    `Asset Types,${report.matrix.assetTypes}`,
    `Required Fields,${report.matrix.requiredFields}`,
    `Recommended Fields,${report.matrix.recommendedFields}`,
    `Optional Fields,${report.matrix.optionalFields}`,
    '',
    'Field Coverage',
    'Field,Percentage,Populated,Total',
    ...report.coverage.fieldDetails.map(
      (f) => `${f.field},${f.percentage}%,${f.populated},${f.total}`
    ),
    '',
    `Overall Completeness,${report.coverage.overallCompleteness}%`,
    '',
    'Top Gaps',
    'Field,Percentage',
    ...report.coverage.topGaps.map((g) => `${g.field},${g.percentage}%`),
  ];

  const csvContent = lines.join('\n');

  // Create blob and download
  const blob = new Blob([csvContent], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = `analytics-report-${new Date().toISOString().split('T')[0]}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
}
