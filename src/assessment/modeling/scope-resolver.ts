/**
 * Scope Resolver
 *
 * Resolves hierarchy scopes and builds qualified name patterns for
 * querying assets at different levels of the data hierarchy.
 *
 * Ported from atlan-metadata-evaluation/assessment/packages/domain
 */

import type {
  ExtendedAssessmentScope,
  HierarchyLevel,
  HierarchyPath,
  AssetRecord,
  ScopeFilter,
} from '../catalog/types';

// =============================================================================
// QUALIFIED NAME PATTERNS
// =============================================================================

/**
 * Parse a qualified name into hierarchy components
 */
export function parseQualifiedName(qualifiedName: string): HierarchyPath {
  // Atlan qualified names follow pattern:
  // connection/database/schema/table/column
  // or for some sources:
  // connection/database.schema.table.column

  const parts = qualifiedName.split('/');

  if (parts.length === 0) {
    return {};
  }

  const result: HierarchyPath = {};

  // First part is always connection
  if (parts[0]) {
    result.connectionQualifiedName = parts[0];
    result.connectionName = extractName(parts[0]);
  }

  // Handle different qualified name formats
  if (parts.length >= 2) {
    // Could be database or database.schema.table format
    const dbPart = parts[1];

    if (dbPart.includes('.')) {
      // Snowflake-style: connection/database.schema.table
      const subParts = dbPart.split('.');
      if (subParts[0]) {
        result.databaseQualifiedName = `${parts[0]}/${subParts[0]}`;
        result.databaseName = subParts[0];
      }
      if (subParts[1]) {
        result.schemaQualifiedName = `${parts[0]}/${subParts[0]}.${subParts[1]}`;
        result.schemaName = subParts[1];
      }
    } else {
      result.databaseQualifiedName = `${parts[0]}/${dbPart}`;
      result.databaseName = extractName(dbPart);
    }
  }

  if (parts.length >= 3 && !parts[1].includes('.')) {
    result.schemaQualifiedName = parts.slice(0, 3).join('/');
    result.schemaName = extractName(parts[2]);
  }

  return result;
}

/**
 * Extract display name from qualified name part
 */
function extractName(part: string): string {
  // Handle various formats
  // - "default/snowflake/db" -> "db"
  // - "my_database" -> "my_database"
  // - "PROD.PUBLIC" -> "PROD.PUBLIC"

  const lastSlash = part.lastIndexOf('/');
  if (lastSlash >= 0) {
    return part.substring(lastSlash + 1);
  }
  return part;
}

/**
 * Build qualified name prefix for a scope
 */
export function buildScopePrefix(scope: ExtendedAssessmentScope): string {
  const { level, scopeId } = scope;

  switch (level) {
    case 'tenant':
      return ''; // No prefix for tenant-wide
    case 'connection':
    case 'database':
    case 'schema':
    case 'table':
    case 'column':
      return scopeId;
    case 'domain':
    case 'glossary':
      // Domains and glossaries use GUIDs, not qualified names
      return '';
    default:
      return scopeId;
  }
}

/**
 * Build search filter for a scope
 */
export function buildScopeFilter(scope: ExtendedAssessmentScope): Record<string, unknown> {
  const filter: Record<string, unknown> = {};

  switch (scope.level) {
    case 'tenant':
      // No additional filter for tenant-wide
      break;

    case 'connection':
      filter['connectionQualifiedName'] = scope.scopeId;
      break;

    case 'database':
      filter['databaseQualifiedName'] = scope.scopeId;
      break;

    case 'schema':
      filter['schemaQualifiedName'] = scope.scopeId;
      break;

    case 'table':
      // For table scope, we filter by the table's qualified name
      filter['qualifiedName'] = scope.scopeId;
      break;

    case 'column':
      // For column scope, include the column and its parent table
      filter['qualifiedName'] = { $prefix: scope.scopeId };
      break;

    case 'domain':
      filter['domainGuid'] = scope.scopeId;
      break;

    case 'glossary':
      filter['glossaryGuid'] = scope.scopeId;
      break;
  }

  // Add asset type filters
  if (scope.assetTypes && scope.assetTypes.length > 0) {
    filter['typeName'] = { $in: scope.assetTypes };
  }

  // Add custom filters
  if (scope.filters) {
    for (const f of scope.filters) {
      filter[f.field] = convertFilterOperator(f);
    }
  }

  return filter;
}

/**
 * Convert filter operator to query format
 */
function convertFilterOperator(filter: ScopeFilter): unknown {
  switch (filter.operator) {
    case 'equals':
      return filter.value;
    case 'contains':
      return { $contains: filter.value };
    case 'startsWith':
      return { $prefix: filter.value };
    case 'in':
      return { $in: filter.value };
    case 'notIn':
      return { $nin: filter.value };
    case 'exists':
      return { $exists: true };
    case 'notExists':
      return { $exists: false };
    default:
      return filter.value;
  }
}

// =============================================================================
// HIERARCHY UTILITIES
// =============================================================================

/**
 * Get parent level in hierarchy
 */
export function getParentLevel(level: HierarchyLevel): HierarchyLevel | null {
  const hierarchy: Record<HierarchyLevel, HierarchyLevel | null> = {
    tenant: null,
    connection: 'tenant',
    database: 'connection',
    schema: 'database',
    table: 'schema',
    column: 'table',
    domain: 'tenant',
    glossary: 'tenant',
  };
  return hierarchy[level];
}

/**
 * Get child level in hierarchy
 */
export function getChildLevel(level: HierarchyLevel): HierarchyLevel | null {
  const hierarchy: Record<HierarchyLevel, HierarchyLevel | null> = {
    tenant: 'connection',
    connection: 'database',
    database: 'schema',
    schema: 'table',
    table: 'column',
    column: null,
    domain: null,
    glossary: null,
  };
  return hierarchy[level];
}

/**
 * Get all ancestor levels
 */
export function getAncestorLevels(level: HierarchyLevel): HierarchyLevel[] {
  const ancestors: HierarchyLevel[] = [];
  let current = getParentLevel(level);

  while (current) {
    ancestors.push(current);
    current = getParentLevel(current);
  }

  return ancestors;
}

/**
 * Get all descendant levels
 */
export function getDescendantLevels(level: HierarchyLevel): HierarchyLevel[] {
  const descendants: HierarchyLevel[] = [];
  let current = getChildLevel(level);

  while (current) {
    descendants.push(current);
    current = getChildLevel(current);
  }

  return descendants;
}

/**
 * Get default asset types for a hierarchy level
 */
export function getDefaultAssetTypes(level: HierarchyLevel): string[] {
  switch (level) {
    case 'tenant':
    case 'connection':
    case 'database':
    case 'schema':
      return ['Table', 'View', 'MaterializedView'];
    case 'table':
      return ['Table', 'View', 'MaterializedView', 'Column'];
    case 'column':
      return ['Column'];
    case 'domain':
      return ['Table', 'View', 'Column', 'Dashboard', 'Report'];
    case 'glossary':
      return ['AtlasGlossaryTerm'];
    default:
      return ['Table'];
  }
}

// =============================================================================
// ASSET GROUPING
// =============================================================================

/**
 * Group assets by a dimension
 */
export function groupAssetsByDimension(
  assets: AssetRecord[],
  dimension: string
): Map<string, AssetRecord[]> {
  const groups = new Map<string, AssetRecord[]>();

  for (const asset of assets) {
    const key = getDimensionValue(asset, dimension);

    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(asset);
  }

  return groups;
}

/**
 * Get dimension value from asset
 */
export function getDimensionValue(asset: AssetRecord, dimension: string): string {
  switch (dimension) {
    case 'connection':
      return asset.hierarchy?.connectionName ||
             asset.hierarchy?.connectionQualifiedName ||
             'Unknown Connection';

    case 'database':
      return asset.hierarchy?.databaseName ||
             asset.hierarchy?.databaseQualifiedName ||
             'Unknown Database';

    case 'schema':
      return asset.hierarchy?.schemaName ||
             asset.hierarchy?.schemaQualifiedName ||
             'Unknown Schema';

    case 'domain':
      return asset.hierarchy?.domainName ||
             asset.hierarchy?.domainGuid ||
             'No Domain';

    case 'owner':
      const owners = asset.attributes['ownerUsers'] as string[] | undefined;
      return owners && owners.length > 0 ? owners[0] : 'Unowned';

    case 'certification':
      const cert = asset.attributes['certificateStatus'] as string | undefined;
      return cert || 'Not Certified';

    case 'asset_type':
      return asset.typeName;

    case 'classification':
      return asset.classifications && asset.classifications.length > 0
        ? asset.classifications[0]
        : 'Unclassified';

    default:
      return 'Unknown';
  }
}

/**
 * Build hierarchy path from asset
 */
export function buildHierarchyPath(asset: AssetRecord): HierarchyPath {
  // If asset already has hierarchy, use it
  if (asset.hierarchy) {
    return asset.hierarchy;
  }

  // Otherwise, parse from qualified name
  return parseQualifiedName(asset.qualifiedName);
}

/**
 * Enrich asset with hierarchy path
 */
export function enrichAssetHierarchy(asset: AssetRecord): AssetRecord {
  if (asset.hierarchy) {
    return asset;
  }

  return {
    ...asset,
    hierarchy: buildHierarchyPath(asset),
  };
}

// =============================================================================
// SCOPE VALIDATION
// =============================================================================

/**
 * Validate assessment scope
 */
export function validateScope(scope: ExtendedAssessmentScope): {
  valid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check level
  const validLevels: HierarchyLevel[] = [
    'tenant', 'connection', 'database', 'schema', 'table', 'column', 'domain', 'glossary'
  ];
  if (!validLevels.includes(scope.level)) {
    errors.push(`Invalid hierarchy level: ${scope.level}`);
  }

  // Check scopeId for non-tenant levels
  if (scope.level !== 'tenant' && !scope.scopeId) {
    errors.push(`scopeId is required for level: ${scope.level}`);
  }

  // Check sample size
  if (scope.sampleSize !== undefined && scope.sampleSize < 1) {
    errors.push('sampleSize must be at least 1');
  }

  // Warn about large sample sizes
  if (scope.sampleSize && scope.sampleSize > 10000) {
    warnings.push('Large sample size may impact performance');
  }

  // Check asset types
  if (scope.assetTypes && scope.assetTypes.length === 0) {
    warnings.push('Empty assetTypes array will return no assets');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Create a scope for assessing a specific connection
 */
export function createConnectionScope(
  connectionQualifiedName: string,
  options?: Partial<ExtendedAssessmentScope>
): ExtendedAssessmentScope {
  return {
    level: 'connection',
    scopeId: connectionQualifiedName,
    displayName: extractName(connectionQualifiedName),
    assetTypes: ['Table', 'View'],
    ...options,
  };
}

/**
 * Create a scope for assessing a specific schema
 */
export function createSchemaScope(
  schemaQualifiedName: string,
  options?: Partial<ExtendedAssessmentScope>
): ExtendedAssessmentScope {
  return {
    level: 'schema',
    scopeId: schemaQualifiedName,
    displayName: extractName(schemaQualifiedName),
    assetTypes: ['Table', 'View', 'Column'],
    ...options,
  };
}

/**
 * Create a scope for assessing a data domain
 */
export function createDomainScope(
  domainGuid: string,
  domainName?: string,
  options?: Partial<ExtendedAssessmentScope>
): ExtendedAssessmentScope {
  return {
    level: 'domain',
    scopeId: domainGuid,
    displayName: domainName || domainGuid,
    assetTypes: ['Table', 'View', 'Column'],
    ...options,
  };
}

/**
 * Create a tenant-wide scope
 */
export function createTenantScope(
  options?: Partial<ExtendedAssessmentScope>
): ExtendedAssessmentScope {
  return {
    level: 'tenant',
    scopeId: '',
    displayName: 'All Assets',
    assetTypes: ['Table', 'View'],
    sampleSize: 1000, // Default sample for tenant-wide
    ...options,
  };
}
