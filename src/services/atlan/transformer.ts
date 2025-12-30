/**
 * Atlan Asset Transformer
 * 
 * Transforms Atlan assets to the internal AssetMetadata format
 * used by the quality metrics calculation system
 */

import type { AtlanAsset } from './types';
import type { AssetMetadata } from '../qualityMetrics';

/**
 * Extract owner string from ownerUsers/ownerGroups arrays
 */
function extractOwner(asset: AtlanAsset): string | undefined {
  if (asset.ownerUsers && asset.ownerUsers.length > 0) {
    const firstOwner = asset.ownerUsers[0];
    return typeof firstOwner === 'string' ? firstOwner : firstOwner.name;
  }
  if (asset.ownerGroups && asset.ownerGroups.length > 0) {
    const firstGroup = asset.ownerGroups[0];
    return typeof firstGroup === 'string' ? firstGroup : firstGroup.name;
  }
  return undefined;
}

/**
 * Extract owner group string
 */
function extractOwnerGroup(asset: AtlanAsset): string | undefined {
  if (asset.ownerGroups && asset.ownerGroups.length > 0) {
    const firstGroup = asset.ownerGroups[0];
    return typeof firstGroup === 'string' ? firstGroup : firstGroup.name;
  }
  return undefined;
}

/**
 * Extract tags from various Atlan tag fields
 */
function extractTags(asset: AtlanAsset): string[] {
  const tags: string[] = [];
  
  if (asset.classificationNames && asset.classificationNames.length > 0) {
    tags.push(...asset.classificationNames);
  }
  
  if (asset.assetTags && asset.assetTags.length > 0) {
    tags.push(...asset.assetTags);
  }
  
  return [...new Set(tags)]; // Remove duplicates
}

/**
 * Extract domain name from domainGUIDs (simplified - in production, would fetch domain names)
 */
function extractDomain(asset: AtlanAsset): string | undefined {
  // In production, you'd fetch domain names from domainGUIDs
  // For now, return undefined or use a mapping
  return undefined;
}

/**
 * Convert Atlan certificate status to internal format
 */
function convertCertificateStatus(
  status: AtlanAsset['certificateStatus']
): AssetMetadata['certificationStatus'] {
  switch (status) {
    case 'VERIFIED':
      return 'certified';
    case 'DRAFT':
      return 'draft';
    case 'DEPRECATED':
      return 'deprecated';
    default:
      return 'none';
  }
}

/**
 * Convert Unix timestamp to Date
 */
function timestampToDate(ts?: number): Date | undefined {
  return ts ? new Date(ts) : undefined;
}

/**
 * Calculate days since timestamp
 */
function daysSince(timestamp?: number): number | undefined {
  if (!timestamp) return undefined;
  return Math.floor((Date.now() - timestamp) / (1000 * 60 * 60 * 24));
}

/**
 * Transform Atlan asset to AssetMetadata
 */
export function transformAtlanAsset(asset: AtlanAsset): AssetMetadata {
  // Prefer userDescription over description (user-provided wins in UI)
  const description = asset.userDescription || asset.description;
  const descriptionLength = description?.length || 0;

  // Extract owner information
  const owner = extractOwner(asset);
  const ownerGroup = extractOwnerGroup(asset);

  // Extract tags
  const tags = extractTags(asset);

  // Extract domain
  const domain = extractDomain(asset);

  // Timeliness calculations
  const lastUpdated = timestampToDate(asset.updateTime);
  const lastProfiled = timestampToDate(
    asset.typeName === 'Table' ? (asset as any).lastProfiledAt : undefined
  );
  const metadataLastRefreshed = timestampToDate(asset.lastSyncRunAt);
  const schemaLastChanged = timestampToDate(asset.sourceUpdatedAt);

  // Calculate staleness threshold (default 90 days)
  const stalenessThreshold = 90;

  // Accuracy factors
  const certificateStatus = convertCertificateStatus(asset.certificateStatus);
  const certified = certificateStatus === 'certified';
  const lastValidated = timestampToDate(asset.certificateUpdatedAt);

  // Lineage information
  const hasLineage = asset.__hasLineage === true;

  // Usability factors
  const hasDocumentation = !!asset.readme;
  const searchable = asset.isDiscoverable !== false; // Default to true unless explicitly false
  const hasBusinessContext = !!(owner && description && (asset.meanings?.length || asset.assignedTerms?.length));

  // Consistency factors
  // Extract naming convention from qualifiedName pattern
  const namingConvention = asset.qualifiedName?.split('/').pop() || asset.name;
  
  // For tables, extract hierarchy information
  let databaseName: string | undefined;
  let schemaName: string | undefined;
  
  if (asset.typeName === 'Table' || asset.typeName === 'Schema' || asset.typeName === 'Database') {
    const tableAsset = asset as any;
    databaseName = tableAsset.databaseName || tableAsset.databaseQualifiedName?.split('.').pop();
    schemaName = tableAsset.schemaName || tableAsset.schemaQualifiedName?.split('.').pop();
  }

  // Build the AssetMetadata object
  const metadata: AssetMetadata = {
    // Core identification
    id: asset.guid,
    name: asset.name,
    assetType: asset.typeName,
    connection: asset.connectionName || asset.connectionQualifiedName || 'unknown',
    domain,
    owner,
    ownerGroup,

    // Completeness factors
    description,
    descriptionLength,
    tags,
    customProperties: {
      qualifiedName: asset.qualifiedName,
      connectionQualifiedName: asset.connectionQualifiedName,
      ...(databaseName && { databaseName }),
      ...(schemaName && { schemaName }),
      // Include all metadata for reference
      certificateStatus: asset.certificateStatus,
      certificateStatusMessage: asset.certificateStatusMessage,
      certificateUpdatedAt: asset.certificateUpdatedAt,
      certificateUpdatedBy: asset.certificateUpdatedBy,
      classificationNames: asset.classificationNames,
      classifications: asset.classifications,
      assetTags: asset.assetTags,
      meanings: asset.meanings,
      assignedTerms: asset.assignedTerms,
      domainGUIDs: asset.domainGUIDs,
      readme: asset.readme,
      links: asset.links,
      files: asset.files,
      // Engagement metrics
      popularityScore: asset.popularityScore,
      viewScore: asset.viewScore,
      starredCount: asset.starredCount,
      sourceReadCount: asset.sourceReadCount,
      sourceReadUserCount: asset.sourceReadUserCount,
      // Table-specific metadata
      ...(asset.typeName === 'Table' || asset.typeName === 'View' || asset.typeName === 'MaterializedView' ? {
        queryCount: (asset as any).queryCount,
        queryUserCount: (asset as any).queryUserCount,
        rowCount: (asset as any).rowCount,
        sizeBytes: (asset as any).sizeBytes,
        columnCount: (asset as any).columnCount,
        lastProfiledAt: (asset as any).lastProfiledAt,
      } : {}),
    },

    // Accuracy factors
    lastValidated,
    validationErrors: 0, // Would need additional API calls to determine
    schemaMatchesSource: undefined, // Would need schema comparison
    dataTypeAccuracy: undefined, // Would need column-level analysis
    businessGlossaryMatch: !!(asset.meanings?.length || asset.assignedTerms?.length),

    // Timeliness factors
    lastUpdated,
    lastProfiled,
    schemaLastChanged,
    metadataLastRefreshed,
    stalenessThreshold,

    // Consistency factors
    namingConvention,
    expectedNamingPattern: undefined, // Would come from domain/connection rules
    fieldNameConsistency: undefined, // Would need column-level analysis
    dataTypeConsistency: undefined, // Would need column-level analysis
    formatConsistency: undefined, // Would need column-level analysis
    domainConsistency: asset.domainGUIDs && asset.domainGUIDs.length > 0 ? 100 : 0,

    // Usability factors
    certified,
    certificationStatus: certificateStatus,
    hasLineage,
    upstreamCount: undefined, // Would need lineage API call
    downstreamCount: undefined, // Would need lineage API call
    hasDocumentation,
    documentationQuality: hasDocumentation ? 100 : 0, // Simplified
    searchable,
    hasBusinessContext,
  };

  return metadata;
}

/**
 * Transform multiple Atlan assets
 */
export function transformAtlanAssets(assets: AtlanAsset[]): AssetMetadata[] {
  return assets.map(transformAtlanAsset);
}

/**
 * Extract hierarchy information from Atlan assets
 */
export function extractHierarchy(assets: AtlanAsset[]): {
  connections: AtlanAsset[];
  databases: AtlanAsset[];
  schemas: AtlanAsset[];
  tables: AtlanAsset[];
} {
  const connections: AtlanAsset[] = [];
  const databases: AtlanAsset[] = [];
  const schemas: AtlanAsset[] = [];
  const tables: AtlanAsset[] = [];

  for (const asset of assets) {
    switch (asset.typeName) {
      case 'Connection':
        connections.push(asset);
        break;
      case 'Database':
        databases.push(asset);
        break;
      case 'Schema':
        schemas.push(asset);
        break;
      case 'Table':
      case 'View':
      case 'MaterializedView':
        tables.push(asset);
        break;
    }
  }

  return { connections, databases, schemas, tables };
}

