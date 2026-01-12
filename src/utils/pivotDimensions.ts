/**
 * Pivot Dimension Extractors
 * 
 * Functions to extract dimension values from assets for grouping
 */

import type { AtlanAsset } from '../services/atlan/types';

// Domain name cache (will be populated by domain resolver)
let domainNameCache: Map<string, string> = new Map();

/**
 * Set domain name cache (called from components that fetch domain names)
 */
export function setDomainNameCache(cache: Map<string, string>): void {
  domainNameCache = cache;
}

export function extractConnection(asset: AtlanAsset): string {
  // Try multiple sources for connection name
  if (asset.connectionName) {
    return asset.connectionName;
  }
  
  // Try connectorName
  if ((asset as any).connectorName) {
    return (asset as any).connectorName;
  }
  
  // Try to extract from connectionQualifiedName
  if (asset.connectionQualifiedName) {
    // Format: default/snowflake/1234567890/connection-name
    const parts = asset.connectionQualifiedName.split('/');
    if (parts.length > 0) {
      const lastPart = parts[parts.length - 1];
      if (lastPart && lastPart !== 'default') {
        return lastPart;
      }
      // Try second-to-last if last is a GUID
      if (parts.length > 1 && !parts[parts.length - 2].match(/^[0-9a-f]{32}$/i)) {
        return parts[parts.length - 2];
      }
    }
  }
  
  // Try to extract from qualifiedName (for assets that have connection in their qualified name)
  if (asset.qualifiedName) {
    const parts = asset.qualifiedName.split('/');
    // Look for connector name pattern (usually after 'default' or at specific position)
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      // Common connector names
      if (part && ['snowflake', 'bigquery', 'postgres', 'tableau', 'dbt', 'databricks', 'redshift', 'mysql', 'oracle', 'sqlserver'].includes(part.toLowerCase())) {
        return part.charAt(0).toUpperCase() + part.slice(1);
      }
    }
  }
  
  return 'Unknown Connection';
}

export function extractDatabase(asset: AtlanAsset): string | null {
  if (asset.typeName === 'Database') {
    return asset.name || null;
  }
  // Try direct databaseName attribute first
  const databaseName = (asset as any).databaseName || asset.attributes?.databaseName;
  if (databaseName) {
    return databaseName;
  }
  // Fallback to parsing qualified name
  if ('databaseQualifiedName' in asset && asset.databaseQualifiedName) {
    const parts = asset.databaseQualifiedName.split('/');
    return parts[parts.length - 1] || null;
  }
  // Try parsing from qualifiedName
  // Atlan format: default/{connector}/{connection_guid_or_name}/{database}/{schema}/{table}
  // Or for some connectors: default/{connector}/{timestamp}/{connection_name}/{database}/{schema}/{table}
  const qn = asset.qualifiedName || asset.attributes?.qualifiedName;
  if (qn) {
    const parts = qn.split('/');
    // For tables/views, database is typically 3rd-to-last (before schema and table)
    // Format variations:
    // - default/snowflake/12345/DBNAME/SCHEMA/TABLE (6 parts)
    // - default/snowflake/12345/conn-name/DBNAME/SCHEMA/TABLE (7 parts)
    if (parts.length >= 6) {
      // For Table/View assets, assume: .../database/schema/tablename
      const typeName = asset.typeName?.toLowerCase() || '';
      if (typeName.includes('table') || typeName.includes('view') || typeName.includes('column')) {
        // Database is 3rd from last for tables (before schema and table)
        return parts[parts.length - 3] || null;
      } else if (typeName.includes('schema')) {
        // For schema assets, database is 2nd from last
        return parts[parts.length - 2] || null;
      }
    }
    // Fallback: try parts[3] for older format
    if (parts.length >= 4) {
      return parts[3] || null;
    }
  }
  return null;
}

export function extractSchema(asset: AtlanAsset): string | null {
  if (asset.typeName === 'Schema') {
    return asset.name || null;
  }
  // Try direct schemaName attribute first
  const schemaName = (asset as any).schemaName || asset.attributes?.schemaName;
  if (schemaName) {
    return schemaName;
  }
  // Fallback to parsing qualified name
  if ('schemaQualifiedName' in asset && asset.schemaQualifiedName) {
    const parts = asset.schemaQualifiedName.split('/');
    return parts[parts.length - 1] || null;
  }
  // Try parsing from qualifiedName
  // Atlan format: default/{connector}/{connection_guid_or_name}/{database}/{schema}/{table}
  const qn = asset.qualifiedName || asset.attributes?.qualifiedName;
  if (qn) {
    const parts = qn.split('/');
    // For tables/views, schema is 2nd-to-last (before table name)
    // Format variations:
    // - default/snowflake/12345/DBNAME/SCHEMA/TABLE (6 parts)
    // - default/snowflake/12345/conn-name/DBNAME/SCHEMA/TABLE (7 parts)
    if (parts.length >= 6) {
      const typeName = asset.typeName?.toLowerCase() || '';
      if (typeName.includes('table') || typeName.includes('view') || typeName.includes('column')) {
        // Schema is 2nd from last for tables (before table name)
        return parts[parts.length - 2] || null;
      }
    }
    // Fallback: try parts[4] for older format
    if (parts.length >= 5) {
      return parts[4] || null;
    }
  }
  return null;
}

export function extractType(asset: AtlanAsset): string {
  return asset.typeName || 'Unknown';
}

export function extractOwner(asset: AtlanAsset): string {
  if (Array.isArray(asset.ownerUsers) && asset.ownerUsers.length > 0) {
    const firstOwner = asset.ownerUsers[0];
    return typeof firstOwner === 'string' ? firstOwner : (firstOwner as any).name || 'Unknown';
  }
  if (Array.isArray(asset.ownerGroups) && asset.ownerGroups.length > 0) {
    const firstGroup = asset.ownerGroups[0];
    return typeof firstGroup === 'string' ? firstGroup : (firstGroup as any).name || 'Unknown';
  }
  return 'Unowned';
}

export function extractOwnerGroup(asset: AtlanAsset): string {
  // Prefer owner groups over individual users for accountability pivots
  if (Array.isArray(asset.ownerGroups) && asset.ownerGroups.length > 0) {
    const firstGroup = asset.ownerGroups[0];
    return typeof firstGroup === 'string' ? firstGroup : (firstGroup as any).name || 'Unknown';
  }
  if (Array.isArray(asset.ownerUsers) && asset.ownerUsers.length > 0) {
    // Try to extract group from user (if user object has group info)
    const firstOwner = asset.ownerUsers[0];
    if (typeof firstOwner === 'object' && (firstOwner as any).groupName) {
      return (firstOwner as any).groupName;
    }
    // Fallback: use user name but prefix to indicate it's a user, not a group
    return typeof firstOwner === 'string' ? firstOwner : (firstOwner as any).name || 'Unknown';
  }
  return 'Unowned';
}

export function extractDomain(asset: AtlanAsset): string {
  if (asset.domainGUIDs && asset.domainGUIDs.length > 0) {
    const firstGuid = asset.domainGUIDs[0];
    // Check cache first
    const cachedName = domainNameCache.get(firstGuid);
    if (cachedName) {
      return cachedName;
    }
    // Fallback: return truncated GUID
    return `Domain ${firstGuid.slice(0, 8)}`;
  }
  return 'No Domain';
}

export function extractCertificationStatus(asset: AtlanAsset): string {
  const status = asset.certificateStatus;
  if (status === 'VERIFIED') return 'Certified';
  if (status === 'DRAFT') return 'Draft';
  if (status === 'DEPRECATED') return 'Deprecated';
  return 'None';
}

function extractHasTerms(asset: AtlanAsset): string {
  const hasTerms = Array.isArray(asset.meanings) && asset.meanings.length > 0;
  return hasTerms ? 'Yes' : 'No';
}

function extractHasTags(asset: AtlanAsset): string {
  const hasTags = (Array.isArray(asset.classificationNames) && asset.classificationNames.length > 0) ||
    (Array.isArray(asset.atlanTags) && asset.atlanTags.length > 0) ||
    (Array.isArray(asset.assetTags) && asset.assetTags.length > 0);
  return hasTags ? 'Yes' : 'No';
}

function extractHasReadme(asset: AtlanAsset): string {
  return asset.readme ? 'Yes' : 'No';
}

function extractAnnouncementType(asset: AtlanAsset): string {
  return asset.announcementType || 'None';
}

function extractPopularityBucket(asset: AtlanAsset): string {
  if (asset.popularityScore === undefined && asset.sourceReadCount === undefined) {
    return 'No Data';
  }
  const score = asset.popularityScore ?? 0;
  if (score >= 0.8) return 'Hot';
  if (score >= 0.5) return 'Warm';
  return 'Normal';
}

function extractUpdateAgeBucket(asset: AtlanAsset): string {
  const ts = asset.updateTime;
  if (!ts) return 'Unknown';
  const days = Math.floor((Date.now() - ts) / (1000 * 60 * 60 * 24));
  if (days <= 30) return '0-30d';
  if (days <= 90) return '31-90d';
  if (days <= 180) return '91-180d';
  return '180d+';
}

function extractLineageStatus(asset: AtlanAsset): string {
  // TODO: Replace with upstream/downstream status once lineage map is available.
  return asset.__hasLineage ? 'Has Lineage' : 'No Lineage';
}

/**
 * Extract dimension value from asset
 */
export function extractDimensionValue(
  dimension: string,
  asset: AtlanAsset
): string | null {
  switch (dimension) {
    case 'connection':
      return extractConnection(asset);
    case 'database':
      return extractDatabase(asset);
    case 'schema':
      return extractSchema(asset);
    case 'type':
      return extractType(asset);
    case 'owner':
      return extractOwner(asset);
    case 'ownerGroup':
      return extractOwnerGroup(asset);
    case 'domain':
      return extractDomain(asset);
    case 'certificationStatus':
      return extractCertificationStatus(asset);
    case 'hasTerms':
      return extractHasTerms(asset);
    case 'hasTags':
      return extractHasTags(asset);
    case 'hasReadme':
      return extractHasReadme(asset);
    case 'announcementType':
      return extractAnnouncementType(asset);
    case 'popularityBucket':
      return extractPopularityBucket(asset);
    case 'updateAgeBucket':
      return extractUpdateAgeBucket(asset);
    case 'lineageStatus':
      return extractLineageStatus(asset);
    default:
      return null;
  }
}

/**
 * Get dimension label
 */
export function getDimensionLabel(dimension: string): string {
  const labels: Record<string, string> = {
    connection: 'Connection',
    database: 'Database',
    schema: 'Schema',
    type: 'Asset Type',
    owner: 'Owner',
    ownerGroup: 'Owner Group',
    domain: 'Domain',
    certificationStatus: 'Certification Status',
    hasTerms: 'Has Terms',
    hasTags: 'Has Tags',
    hasReadme: 'Has README',
    announcementType: 'Announcement Type',
    popularityBucket: 'Popularity Bucket',
    updateAgeBucket: 'Update Age',
    lineageStatus: 'Lineage Status',
  };
  return labels[dimension] || dimension;
}

/**
 * Get dimension icon
 */
export function getDimensionIcon(dimension: string): string {
  const icons: Record<string, string> = {
    connection: '🔗',
    database: '🗄️',
    schema: '📁',
    type: '📦',
    owner: '👤',
    ownerGroup: '👥',
    domain: '🏢',
    certificationStatus: '✓',
    hasTerms: '📘',
    hasTags: '🏷️',
    hasReadme: '📄',
    announcementType: '📣',
    popularityBucket: '🔥',
    updateAgeBucket: '⏱️',
    lineageStatus: '🔗',
  };
  return icons[dimension] || '📊';
}
