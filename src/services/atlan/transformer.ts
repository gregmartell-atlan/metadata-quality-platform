/**
 * Atlan Asset Transformer
 *
 * Transforms Atlan assets to the internal AssetMetadata format
 * used by the quality metrics calculation system
 */

import type { AtlanAsset } from './types';
import type { AssetMetadata } from '../qualityMetrics';
import { fetchDomainNames } from './domainResolver';
import { resolveTagNames } from './tagResolver';

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
 * Extract tags from various Atlan tag fields (simple string array)
 * Uses tag name map to resolve internal type names to human-readable display names
 */
function extractTags(asset: AtlanAsset, tagNameMap?: Map<string, string>): string[] {
  const rawTags: string[] = [];

  if (asset.classificationNames && asset.classificationNames.length > 0) {
    rawTags.push(...asset.classificationNames);
  }

  if (asset.assetTags && asset.assetTags.length > 0) {
    rawTags.push(...asset.assetTags);
  }

  // Also include tag names from atlanTags (full tag objects)
  if (asset.atlanTags && asset.atlanTags.length > 0) {
    asset.atlanTags.forEach(tag => {
      if (tag.typeName && !rawTags.includes(tag.typeName)) {
        rawTags.push(tag.typeName);
      }
    });
  }

  // Remove duplicates
  const uniqueTags = [...new Set(rawTags)];

  // Resolve to display names if tag name map is provided
  if (tagNameMap) {
    return uniqueTags.map(tag => tagNameMap.get(tag) || tag);
  }

  return uniqueTags;
}

/**
 * Extract enriched tag information including propagation settings
 * Uses tag name map to resolve internal type names to human-readable display names
 */
function extractEnrichedTags(asset: AtlanAsset, tagNameMap?: Map<string, string>): Array<{
  name: string;
  guid?: string;
  isDirect: boolean;          // true if directly assigned, false if propagated
  propagates: boolean;        // whether this tag propagates to children
  propagatesToLineage: boolean;
  propagatesToHierarchy: boolean;
}> {
  if (!asset.atlanTags || asset.atlanTags.length === 0) {
    // Fall back to simple tag names
    return extractTags(asset, tagNameMap).map(name => ({
      name,
      isDirect: true,  // Assume direct if we don't have propagation info
      propagates: false,
      propagatesToLineage: false,
      propagatesToHierarchy: false,
    }));
  }

  return asset.atlanTags.map(tag => ({
    name: tagNameMap?.get(tag.typeName) || tag.typeName,
    guid: tag.guid,
    isDirect: tag.propagate !== undefined ? !tag.propagate : true, // If propagate is false, it's likely direct
    propagates: tag.propagate ?? false,
    propagatesToLineage: tag.propagate === true && !tag.restrictPropagationThroughLineage,
    propagatesToHierarchy: tag.propagate === true && !tag.restrictPropagationThroughHierarchy,
  }));
}

/**
 * Extract domain name from domainGUIDs using pre-fetched domain name map
 */
function extractDomain(asset: AtlanAsset, domainNameMap?: Map<string, string>): string | undefined {
  if (!asset.domainGUIDs || asset.domainGUIDs.length === 0) {
    return undefined;
  }

  // If we have a pre-fetched domain name map, use it
  if (domainNameMap) {
    const firstGuid = asset.domainGUIDs[0];
    const domainName = domainNameMap.get(firstGuid);
    if (domainName) {
      return domainName;
    }
  }

  // Fallback: return truncated GUID for visibility
  return `Domain ${asset.domainGUIDs[0].slice(0, 8)}`;
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
 * Name resolution maps for human-readable display
 */
interface NameResolutionMaps {
  domainNameMap?: Map<string, string>;
  tagNameMap?: Map<string, string>;
}

/**
 * Transform Atlan asset to AssetMetadata
 * @param asset - The Atlan asset to transform
 * @param nameMaps - Optional pre-fetched maps for domain and tag name resolution
 */
export function transformAtlanAsset(asset: AtlanAsset, nameMaps?: NameResolutionMaps | Map<string, string>): AssetMetadata {
  // Handle both old signature (just domainNameMap) and new signature (nameMaps object)
  let domainNameMap: Map<string, string> | undefined;
  let tagNameMap: Map<string, string> | undefined;

  if (nameMaps instanceof Map) {
    // Old signature: just domain name map
    domainNameMap = nameMaps;
  } else if (nameMaps) {
    // New signature: name resolution maps object
    domainNameMap = nameMaps.domainNameMap;
    tagNameMap = nameMaps.tagNameMap;
  }

  // Prefer userDescription over description (user-provided wins in UI)
  const description = asset.userDescription || asset.description;
  const descriptionLength = description?.length || 0;

  // Extract owner information
  const owner = extractOwner(asset);
  const ownerGroup = extractOwnerGroup(asset);

  // Extract tags (simple array and enriched with propagation info)
  const tags = extractTags(asset, tagNameMap);
  const enrichedTags = extractEnrichedTags(asset, tagNameMap);

  // Extract domain (using pre-fetched domain names if available)
  const domain = extractDomain(asset, domainNameMap);

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
    enrichedTags,
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
      atlanTags: asset.atlanTags,  // Full tag objects with propagation settings
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
 * Transform multiple Atlan assets (synchronous - uses fallback for unresolved names)
 */
export function transformAtlanAssets(assets: AtlanAsset[], nameMaps?: NameResolutionMaps | Map<string, string>): AssetMetadata[] {
  return assets.map(asset => transformAtlanAsset(asset, nameMaps));
}

/**
 * Collect all unique domain GUIDs from assets
 */
function collectDomainGUIDs(assets: AtlanAsset[]): string[] {
  const guids = new Set<string>();
  for (const asset of assets) {
    if (asset.domainGUIDs) {
      for (const guid of asset.domainGUIDs) {
        guids.add(guid);
      }
    }
  }
  return [...guids];
}

/**
 * Collect all unique tag type names from assets
 */
function collectTagTypeNames(assets: AtlanAsset[]): string[] {
  const typeNames = new Set<string>();
  for (const asset of assets) {
    if (asset.classificationNames) {
      for (const name of asset.classificationNames) {
        typeNames.add(name);
      }
    }
    if (asset.atlanTags) {
      for (const tag of asset.atlanTags) {
        if (tag.typeName) {
          typeNames.add(tag.typeName);
        }
      }
    }
  }
  return [...typeNames];
}

/**
 * Transform multiple Atlan assets with resolved names (async)
 * This fetches human-readable domain and tag names from the Atlan API
 */
export async function transformAtlanAssetsWithNames(assets: AtlanAsset[]): Promise<AssetMetadata[]> {
  // Collect all unique domain GUIDs and tag type names
  const domainGUIDs = collectDomainGUIDs(assets);
  const tagTypeNames = collectTagTypeNames(assets);

  // Fetch names in batch
  let domainNameMap: Map<string, string> | undefined;
  let tagNameMap: Map<string, string> | undefined;

  const [domainResult, tagResult] = await Promise.allSettled([
    domainGUIDs.length > 0 ? fetchDomainNames(domainGUIDs) : Promise.resolve(new Map<string, string>()),
    tagTypeNames.length > 0 ? resolveTagNames(tagTypeNames) : Promise.resolve(new Map<string, string>()),
  ]);

  if (domainResult.status === 'fulfilled') {
    domainNameMap = domainResult.value;
  } else {
    console.warn('Failed to fetch domain names, using fallback:', domainResult.reason);
  }

  if (tagResult.status === 'fulfilled') {
    tagNameMap = tagResult.value;
  } else {
    console.warn('Failed to fetch tag names, using fallback:', tagResult.reason);
  }

  // Transform assets with the resolved names
  return assets.map(asset => transformAtlanAsset(asset, { domainNameMap, tagNameMap }));
}

/**
 * Transform multiple Atlan assets with resolved domain names (async)
 * @deprecated Use transformAtlanAssetsWithNames instead
 */
export async function transformAtlanAssetsWithDomains(assets: AtlanAsset[]): Promise<AssetMetadata[]> {
  // Collect all unique domain GUIDs
  const domainGUIDs = collectDomainGUIDs(assets);

  // Fetch domain names in batch
  let domainNameMap: Map<string, string> | undefined;
  if (domainGUIDs.length > 0) {
    try {
      domainNameMap = await fetchDomainNames(domainGUIDs);
    } catch (error) {
      console.warn('Failed to fetch domain names, using fallback:', error);
    }
  }

  // Transform assets with the resolved domain names
  return assets.map(asset => transformAtlanAsset(asset, domainNameMap));
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
