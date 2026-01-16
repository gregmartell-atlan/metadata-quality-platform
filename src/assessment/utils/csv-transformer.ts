/**
 * CSV to AssetEvidence Transformer
 *
 * Transforms CSV data (like Atlan export) into AssetEvidence format
 * for use with the assessment engines.
 */

import type { AssetEvidence, Tri } from '../engines/types';

/**
 * Parsed CSV row - maps CSV column headers to values
 */
export type CsvRow = Record<string, string>;

/**
 * Transform options
 */
export interface TransformOptions {
  /** Default asset type if not found in CSV */
  defaultAssetType?: string;
  /** Skip rows without qualifiedName */
  skipMissingQualifiedName?: boolean;
}

/**
 * Helper to determine Tri value from CSV field
 */
function toTri(value: string | undefined | null): Tri {
  if (value === undefined || value === null || value === '') {
    return 'UNKNOWN';
  }
  const lower = value.toLowerCase().trim();
  if (lower === 'true' || lower === 'yes' || lower === '1') {
    return true;
  }
  if (lower === 'false' || lower === 'no' || lower === '0') {
    return false;
  }
  // Non-empty value means present
  return true;
}

/**
 * Check if a field has content (for presence detection)
 */
function hasContent(value: string | undefined | null): Tri {
  if (value === undefined || value === null) {
    return 'UNKNOWN';
  }
  return value.trim().length > 0;
}

/**
 * Check if a field has numeric content
 */
function hasNumericContent(value: string | undefined | null): Tri {
  if (value === undefined || value === null || value.trim() === '') {
    return 'UNKNOWN';
  }
  const num = parseFloat(value);
  return !isNaN(num) && num > 0;
}

/**
 * Known CSV column mappings for Atlan exports
 */
const COLUMN_ALIASES: Record<string, string[]> = {
  qualifiedName: ['qualifiedName', 'qualified_name', 'QUALIFIED_NAME'],
  typeName: ['typeName', 'type_name', 'TYPENAME', 'assetType', 'asset_type'],
  name: ['name', 'NAME', 'displayName', 'display_name'],
  description: ['description', 'DESCRIPTION', 'userDescription', 'user_description'],
  ownerUsers: ['ownerUsers', 'owner_users', 'OWNER_USERS', 'owners'],
  ownerGroups: ['ownerGroups', 'owner_groups', 'OWNER_GROUPS'],
  certificateStatus: ['certificateStatus', 'certificate_status', 'CERTIFICATE_STATUS'],
  assignedTerms: ['assignedTerms', 'assigned_terms', 'terms', 'meanings'],
  atlanTags: ['atlanTags', 'atlan_tags', 'tags', 'classifications'],
  readme: ['readme', 'README', 'readmeContent'],
  links: ['links', 'LINKS'],

  // Ownership custom attributes
  technicalOwner: ['Ownership::Technical Owner', 'Technical Owner'],
  businessOwner: ['Ownership::Business Owner', 'Business Owner'],
  domainOwner: ['Ownership::Domain Owner', 'Domain Owner'],

  // AI/ML attributes
  aiCertificationStatus: ['AI Readiness::ai_certification_status', 'ai_certification_status'],
  restrictedForAi: ['AI Readiness::RESTRICTED_FOR_AI_USE', 'RESTRICTED_FOR_AI_USE'],
  piiRiskLevel: ['AI Readiness::pii_risk_level_for_ai', 'pii_risk_level_for_ai'],
  aiRiskScore: ['AI Model Risk Scores::Overall risk score', 'Overall risk score'],

  // Data Quality attributes
  dqResults: ['DQ Results::Most Recent Result', 'DQ Results', 'Most Recent Result'],
  completenessScore: ['Score::Score', 'Score', 'Metadata Completeness Score::Completeness Score'],
  completenessPercentage: ['Data Quality::Completeness percentage', 'Completeness percentage'],
  qualityIssues: ['Data Quality::Quality Issues', 'Quality Issues'],
  numRows: ['Data Quality::Number of Rows', 'Number of Rows'],
  numColumns: ['Data Quality::Number of Columns', 'Number of Columns'],
  certified: ['Data Quality::Certified', 'Certified'],

  // Data Governance attributes
  hasPii: ['Data Governance::Has PII', 'Has PII'],
  isEncrypted: ['Data Governance::Is Encrypted', 'Is Encrypted'],
  retentionDate: ['Data Governance::Retention Date', 'Retention Date'],
  governanceApproved: ['Data Governance::Approved By Governance', 'Approved By Governance'],
};

/**
 * Find column value using aliases
 */
function getColumnValue(row: CsvRow, field: string): string | undefined {
  const aliases = COLUMN_ALIASES[field] || [field];
  for (const alias of aliases) {
    if (row[alias] !== undefined) {
      return row[alias];
    }
  }
  return undefined;
}

/**
 * Transform a single CSV row to AssetEvidence
 */
export function transformRowToEvidence(
  row: CsvRow,
  options: TransformOptions = {}
): AssetEvidence | null {
  const qualifiedName = getColumnValue(row, 'qualifiedName');

  if (!qualifiedName && options.skipMissingQualifiedName !== false) {
    return null;
  }

  const typeName = getColumnValue(row, 'typeName') || options.defaultAssetType || 'Unknown';
  const name = getColumnValue(row, 'name') || qualifiedName?.split('/').pop() || 'Unknown';

  // Extract values
  const description = getColumnValue(row, 'description');
  const ownerUsers = getColumnValue(row, 'ownerUsers');
  const ownerGroups = getColumnValue(row, 'ownerGroups');
  const technicalOwner = getColumnValue(row, 'technicalOwner');
  const businessOwner = getColumnValue(row, 'businessOwner');
  const certificateStatus = getColumnValue(row, 'certificateStatus');
  const assignedTerms = getColumnValue(row, 'assignedTerms');
  const atlanTags = getColumnValue(row, 'atlanTags');
  const readme = getColumnValue(row, 'readme');
  const links = getColumnValue(row, 'links');

  // AI/ML attributes
  const aiCertificationStatus = getColumnValue(row, 'aiCertificationStatus');
  const restrictedForAi = getColumnValue(row, 'restrictedForAi');
  const piiRiskLevel = getColumnValue(row, 'piiRiskLevel');

  // DQ attributes
  const dqResults = getColumnValue(row, 'dqResults');
  const completenessScore = getColumnValue(row, 'completenessScore');
  const completenessPercentage = getColumnValue(row, 'completenessPercentage');
  const qualityIssues = getColumnValue(row, 'qualityIssues');

  // Governance attributes
  const hasPii = getColumnValue(row, 'hasPii');
  const isEncrypted = getColumnValue(row, 'isEncrypted');
  const governanceApproved = getColumnValue(row, 'governanceApproved');

  return {
    assetId: qualifiedName || `unknown-${Date.now()}`,
    name,
    type: typeName,
    qualifiedName,

    // Ownership signal - present if any owner field has content
    ownerPresent: hasContent(ownerUsers) === true ||
                  hasContent(ownerGroups) === true ||
                  hasContent(technicalOwner) === true ||
                  hasContent(businessOwner) === true
                    ? true
                    : hasContent(ownerUsers) === 'UNKNOWN' &&
                      hasContent(ownerGroups) === 'UNKNOWN'
                        ? 'UNKNOWN'
                        : false,

    // Semantics signal
    descriptionPresent: hasContent(description),
    runbookPresent: hasContent(readme),
    glossaryTermsPresent: hasContent(assignedTerms),

    // Lineage signal - CSV typically doesn't have lineage
    relationshipsPresent: 'UNKNOWN',
    hasUpstream: 'UNKNOWN',
    hasDownstream: 'UNKNOWN',

    // Sensitivity signal
    hasClassifiedFields: toTri(hasPii),
    sensitivityTagsPresent: hasContent(atlanTags),

    // Access signal
    accessPoliciesPresent: toTri(isEncrypted) === true ? true : 'UNKNOWN',

    // Quality signal
    dqSignalsPresent: hasContent(dqResults),
    dqMonitoringConfigured: hasNumericContent(completenessPercentage) === true ||
                            hasContent(qualityIssues) === true
                              ? true
                              : 'UNKNOWN',

    // Freshness signal - would need timestamp fields
    freshnessSlaPass: 'UNKNOWN',
    freshnessMonitoringConfigured: 'UNKNOWN',

    // Usage signal - CSV typically doesn't have usage telemetry
    usageTelemetryPresent: 'UNKNOWN',
    popularityAvailable: 'UNKNOWN',

    // AI_READY signal
    aiApproved: toTri(aiCertificationStatus) === true ||
                (toTri(restrictedForAi) === true ? false : 'UNKNOWN'),
    aiGovernanceConfigured: hasContent(piiRiskLevel) === true ||
                            toTri(governanceApproved) === true
                              ? true
                              : 'UNKNOWN',

    // Trust signal
    certificationPresent: certificateStatus?.toLowerCase() === 'verified' ||
                          certificateStatus?.toLowerCase() === 'approved'
                            ? true
                            : hasContent(certificateStatus),
    verifiedStatus: certificateStatus?.toLowerCase() === 'verified'
                      ? true
                      : hasContent(certificateStatus) === true
                        ? false
                        : 'UNKNOWN',
  };
}

/**
 * Parse CSV string into rows
 */
export function parseCsv(csvContent: string): CsvRow[] {
  const lines = csvContent.split('\n');
  if (lines.length < 2) {
    return [];
  }

  // Parse header - handle quoted values
  const parseRow = (line: string): string[] => {
    const values: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          // Escaped quote
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        values.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    values.push(current.trim());

    return values;
  };

  const headers = parseRow(lines[0]);
  const rows: CsvRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const values = parseRow(line);
    const row: CsvRow = {};

    headers.forEach((header, idx) => {
      row[header] = values[idx] || '';
    });

    rows.push(row);
  }

  return rows;
}

/**
 * Transform entire CSV content to AssetEvidence array
 */
export function transformCsvToEvidence(
  csvContent: string,
  options: TransformOptions = {}
): AssetEvidence[] {
  const rows = parseCsv(csvContent);
  const evidence: AssetEvidence[] = [];

  for (const row of rows) {
    const ev = transformRowToEvidence(row, options);
    if (ev) {
      evidence.push(ev);
    }
  }

  return evidence;
}

/**
 * Get summary statistics from transformed evidence
 */
export function getEvidenceSummary(evidence: AssetEvidence[]): {
  total: number;
  byType: Record<string, number>;
  signalCounts: Record<string, { present: number; absent: number; unknown: number }>;
} {
  const byType: Record<string, number> = {};
  const signalCounts: Record<string, { present: number; absent: number; unknown: number }> = {
    ownership: { present: 0, absent: 0, unknown: 0 },
    semantics: { present: 0, absent: 0, unknown: 0 },
    lineage: { present: 0, absent: 0, unknown: 0 },
    sensitivity: { present: 0, absent: 0, unknown: 0 },
    access: { present: 0, absent: 0, unknown: 0 },
    quality: { present: 0, absent: 0, unknown: 0 },
    freshness: { present: 0, absent: 0, unknown: 0 },
    usage: { present: 0, absent: 0, unknown: 0 },
    aiReady: { present: 0, absent: 0, unknown: 0 },
    trust: { present: 0, absent: 0, unknown: 0 },
  };

  for (const ev of evidence) {
    byType[ev.type] = (byType[ev.type] || 0) + 1;

    // Count signal presence
    const countSignal = (key: string, value: Tri | undefined) => {
      if (value === true) signalCounts[key].present++;
      else if (value === false) signalCounts[key].absent++;
      else signalCounts[key].unknown++;
    };

    countSignal('ownership', ev.ownerPresent);
    countSignal('semantics', ev.descriptionPresent === true || ev.glossaryTermsPresent === true ? true : ev.descriptionPresent);
    countSignal('lineage', ev.relationshipsPresent);
    countSignal('sensitivity', ev.hasClassifiedFields === true || ev.sensitivityTagsPresent === true ? true : ev.hasClassifiedFields);
    countSignal('access', ev.accessPoliciesPresent);
    countSignal('quality', ev.dqSignalsPresent === true || ev.dqMonitoringConfigured === true ? true : ev.dqSignalsPresent);
    countSignal('freshness', ev.freshnessSlaPass === true || ev.freshnessMonitoringConfigured === true ? true : ev.freshnessSlaPass);
    countSignal('usage', ev.usageTelemetryPresent === true || ev.popularityAvailable === true ? true : ev.usageTelemetryPresent);
    countSignal('aiReady', ev.aiApproved === true || ev.aiGovernanceConfigured === true ? true : ev.aiApproved);
    countSignal('trust', ev.certificationPresent === true || ev.verifiedStatus === true ? true : ev.certificationPresent);
  }

  return {
    total: evidence.length,
    byType,
    signalCounts,
  };
}
