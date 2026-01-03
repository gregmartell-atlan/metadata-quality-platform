/**
 * Metadata Field Descriptions
 *
 * Provides detailed descriptions for metadata fields used in tooltips
 */

export interface MetadataFieldInfo {
  name: string;
  description: string;
  importance: 'required' | 'recommended' | 'optional';
  daapDimension: string;
  examples?: string[];
}

export const metadataFields: Record<string, MetadataFieldInfo> = {
  description: {
    name: 'Description',
    description: 'A human-readable summary of what this asset contains, its purpose, and how it should be used. Good descriptions help users understand data without examining it directly.',
    importance: 'required',
    daapDimension: 'Discoverable',
    examples: ['Customer transaction records from the e-commerce platform', 'Daily aggregated sales metrics by region'],
  },
  ownerUsers: {
    name: 'Owner Users',
    description: 'Individual users responsible for this asset. Owners are accountable for data quality, access requests, and keeping metadata up to date.',
    importance: 'required',
    daapDimension: 'Discoverable',
  },
  ownerGroups: {
    name: 'Owner Groups',
    description: 'Teams or groups responsible for this asset. Group ownership ensures continuity when individuals change roles.',
    importance: 'required',
    daapDimension: 'Discoverable',
  },
  tags: {
    name: 'Tags',
    description: 'Keywords and labels that categorize this asset. Tags improve searchability and help users discover related assets.',
    importance: 'recommended',
    daapDimension: 'Discoverable',
    examples: ['finance', 'pii', 'daily-refresh', 'tier-1'],
  },
  assignedTerms: {
    name: 'Glossary Terms',
    description: 'Business glossary terms linked to this asset. Terms provide standardized definitions and connect data to business concepts.',
    importance: 'recommended',
    daapDimension: 'Discoverable',
    examples: ['Customer ID', 'Revenue', 'Active User'],
  },
  lineage: {
    name: 'Lineage',
    description: 'The data flow showing where this asset\'s data comes from (upstream) and where it goes (downstream). Lineage is critical for impact analysis and debugging.',
    importance: 'required',
    daapDimension: 'Trustworthy',
  },
  certificateStatus: {
    name: 'Certificate',
    description: 'Official certification status indicating the asset has been reviewed and approved for use. Certified assets are trusted for business decisions.',
    importance: 'required',
    daapDimension: 'Trustworthy',
    examples: ['Verified', 'Draft', 'Deprecated'],
  },
  readme: {
    name: 'README',
    description: 'Detailed documentation including usage guidelines, data dictionary, known issues, and contact information. READMEs help users self-serve.',
    importance: 'optional',
    daapDimension: 'Self-describing',
  },
  columns: {
    name: 'Columns',
    description: 'The individual fields/columns within this table or view. Column-level metadata includes data types, descriptions, and classifications.',
    importance: 'required',
    daapDimension: 'Self-describing',
  },
  classifications: {
    name: 'Classifications',
    description: 'Data sensitivity labels that indicate how the data should be handled. Classifications drive access policies and compliance requirements.',
    importance: 'required',
    daapDimension: 'Secure',
    examples: ['PII', 'Confidential', 'Public', 'PHI'],
  },
  qualifiedName: {
    name: 'Qualified Name',
    description: 'The unique, fully-qualified path to this asset including connection, database, schema, and object name.',
    importance: 'required',
    daapDimension: 'Addressable',
  },
  connection: {
    name: 'Connection',
    description: 'The data source connection (e.g., Snowflake, BigQuery, Postgres) where this asset resides.',
    importance: 'required',
    daapDimension: 'Addressable',
  },
  database: {
    name: 'Database',
    description: 'The database containing this asset within the connection.',
    importance: 'required',
    daapDimension: 'Addressable',
  },
  schema: {
    name: 'Schema',
    description: 'The schema/namespace containing this asset within the database.',
    importance: 'required',
    daapDimension: 'Addressable',
  },
};

export const daapDimensions: Record<string, { name: string; description: string; color: string }> = {
  Discoverable: {
    name: 'Discoverable',
    description: 'Assets can be easily found through search, browse, tags, and glossary terms. Users should be able to discover relevant data without knowing exact names.',
    color: 'var(--color-blue-500)',
  },
  Addressable: {
    name: 'Addressable',
    description: 'Assets have clear, unique identifiers and can be precisely located. Users know exactly where data lives and how to access it.',
    color: 'var(--color-success-500)',
  },
  Trustworthy: {
    name: 'Trustworthy',
    description: 'Assets have lineage, certification, and quality indicators. Users can trust the data for business decisions and understand its reliability.',
    color: 'var(--color-warning-500)',
  },
  'Self-describing': {
    name: 'Self-describing',
    description: 'Assets have rich metadata and documentation. Users can understand the data structure, meaning, and usage without external help.',
    color: '#8b5cf6',
  },
  Interoperable: {
    name: 'Interoperable',
    description: 'Assets follow standards and can integrate with other systems. Data can be combined and used across different tools and platforms.',
    color: '#ec4899',
  },
  Secure: {
    name: 'Secure',
    description: 'Assets have proper classification and access controls. Sensitive data is protected and compliance requirements are met.',
    color: '#f97316',
  },
  Reusable: {
    name: 'Reusable',
    description: 'Assets are documented for reuse across teams. Data can be leveraged by multiple consumers without duplication.',
    color: '#06b6d4',
  },
};

export function getFieldInfo(field: string): MetadataFieldInfo | undefined {
  return metadataFields[field];
}

export function getDimensionInfo(dimension: string) {
  return daapDimensions[dimension];
}

/**
 * Quality Dimension Descriptions
 *
 * Describes the data quality dimensions used in scoring and heatmaps
 */
export interface QualityDimensionInfo {
  name: string;
  description: string;
  factors: string[];
  color: string;
}

export const qualityDimensions: Record<string, QualityDimensionInfo> = {
  completeness: {
    name: 'Completeness',
    description: 'Measures how fully populated the metadata is for an asset. High completeness means all important fields have values.',
    factors: ['Description present', 'Owner assigned', 'Tags applied', 'Glossary terms linked'],
    color: 'var(--color-blue-500)',
  },
  accuracy: {
    name: 'Accuracy',
    description: 'Measures the correctness and precision of metadata values. High accuracy means metadata reflects the true state of the data.',
    factors: ['Owner is active user', 'Classifications match content', 'Description is up-to-date'],
    color: 'var(--color-success-500)',
  },
  timeliness: {
    name: 'Timeliness',
    description: 'Measures how current and up-to-date the metadata is. High timeliness means metadata is regularly reviewed and updated.',
    factors: ['Last modified recently', 'Description reviewed', 'Freshness of lineage'],
    color: 'var(--color-warning-500)',
  },
  consistency: {
    name: 'Consistency',
    description: 'Measures uniformity of metadata across similar assets. High consistency means naming conventions and standards are followed.',
    factors: ['Follows naming standards', 'Uses approved tags', 'Matches schema patterns'],
    color: '#8b5cf6',
  },
  usability: {
    name: 'Usability',
    description: 'Measures how easy it is for users to understand and use the asset. High usability means users can self-serve without assistance.',
    factors: ['README present', 'Column descriptions', 'Examples provided', 'Query samples'],
    color: '#ec4899',
  },
  overall: {
    name: 'Overall',
    description: 'A weighted average of all quality dimensions, providing a single score for the asset\'s metadata health.',
    factors: ['Completeness', 'Accuracy', 'Timeliness', 'Consistency', 'Usability'],
    color: 'var(--text-default)',
  },
};

export function getQualityDimensionInfo(dimension: string): QualityDimensionInfo | undefined {
  return qualityDimensions[dimension.toLowerCase()];
}

/**
 * Score Band Descriptions
 *
 * Describes what each score range means for data quality
 */
export interface ScoreBandInfo {
  name: string;
  range: string;
  description: string;
  action: string;
  color: string;
}

export const scoreBands: Record<string, ScoreBandInfo> = {
  critical: {
    name: 'Critical',
    range: '0-24',
    description: 'Assets with severely deficient metadata. These require immediate attention as they pose risks to data governance.',
    action: 'Prioritize adding basic metadata: description, owner, and classification.',
    color: 'var(--score-critical)',
  },
  poor: {
    name: 'Poor',
    range: '25-49',
    description: 'Assets with inadequate metadata coverage. Users will struggle to understand and trust these assets.',
    action: 'Focus on completing core fields and adding documentation.',
    color: 'var(--score-poor)',
  },
  fair: {
    name: 'Fair',
    range: '50-74',
    description: 'Assets with basic metadata in place but room for improvement. Usable but not ideal for self-service.',
    action: 'Add glossary terms, improve descriptions, and verify accuracy.',
    color: 'var(--score-fair)',
  },
  good: {
    name: 'Good',
    range: '75-100',
    description: 'Assets with comprehensive, well-maintained metadata. Ready for self-service discovery and trusted use.',
    action: 'Maintain quality and consider for certification.',
    color: 'var(--score-good)',
  },
  excellent: {
    name: 'Excellent',
    range: '80-100',
    description: 'Assets with exceptional metadata quality. These are model examples of well-documented data products.',
    action: 'Certify and use as templates for other assets.',
    color: 'var(--score-excellent)',
  },
};

export function getScoreBandInfo(score: number): ScoreBandInfo {
  if (score >= 80) return scoreBands.excellent;
  if (score >= 75) return scoreBands.good;
  if (score >= 50) return scoreBands.fair;
  if (score >= 25) return scoreBands.poor;
  return scoreBands.critical;
}

export function getScoreBandByName(name: string): ScoreBandInfo | undefined {
  return scoreBands[name.toLowerCase()];
}

/**
 * Pivot Dimension Descriptions
 *
 * Describes pivot row/column dimensions
 */
export const pivotDimensions: Record<string, { name: string; description: string }> = {
  owner: {
    name: 'Owner',
    description: 'Groups assets by their assigned owner (user or team). Helps identify accountability and ownership gaps.',
  },
  ownerGroup: {
    name: 'Owner Group',
    description: 'Groups assets by team/group ownership. Shows which teams have the most assets and their quality.',
  },
  tag: {
    name: 'Tag',
    description: 'Groups assets by applied tags. Useful for seeing quality by business domain or use case.',
  },
  certification: {
    name: 'Certification Status',
    description: 'Groups assets by their certification state (Certified, Draft, Deprecated). Shows trust level distribution.',
  },
  classification: {
    name: 'Classification',
    description: 'Groups assets by data sensitivity (PII, Confidential, etc.). Critical for compliance monitoring.',
  },
  assetType: {
    name: 'Asset Type',
    description: 'Groups assets by type (Table, View, Dashboard, etc.). Helps compare quality across different asset categories.',
  },
  schema: {
    name: 'Schema',
    description: 'Groups assets by database schema. Useful for identifying schemas that need metadata attention.',
  },
  connection: {
    name: 'Connection',
    description: 'Groups assets by data source connection. Shows quality distribution across different platforms.',
  },
  domain: {
    name: 'Domain',
    description: 'Groups assets by business domain. Helps track quality by organizational area.',
  },
};

export function getPivotDimensionInfo(dimension: string) {
  return pivotDimensions[dimension];
}
