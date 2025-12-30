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
  if ('databaseQualifiedName' in asset && asset.databaseQualifiedName) {
    const parts = asset.databaseQualifiedName.split('/');
    return parts[parts.length - 1] || null;
  }
  return null;
}

export function extractSchema(asset: AtlanAsset): string | null {
  if (asset.typeName === 'Schema') {
    return asset.name || null;
  }
  if ('schemaQualifiedName' in asset && asset.schemaQualifiedName) {
    const parts = asset.schemaQualifiedName.split('/');
    return parts[parts.length - 1] || null;
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
  };
  return icons[dimension] || '📊';
}

