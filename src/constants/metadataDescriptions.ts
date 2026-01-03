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
