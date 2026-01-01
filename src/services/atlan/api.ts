// ============================================
// ATLAN REST API SERVICE
// Calls Atlan API through local proxy to avoid CORS
// Replicated from atlan-metadata-designer
// ============================================

import type { AtlanAsset, AtlanSearchResponse, AtlanLineageResponse, AtlanLineageRawResponse } from './types';
import { apiFetch } from '../../utils/apiClient';
import { logger } from '../../utils/logger';
import { deduplicateRequest } from '../../utils/requestDeduplication';

// ============================================
// CONFIGURATION
// ============================================

/**
 * Minimal “summary” shape used by the quality scoring helpers.
 * Kept here to avoid circular imports (qualityMetrics → atlan/api).
 */
export interface AtlanAssetSummary {
  guid: string;
  typeName: string;
  name: string;
  qualifiedName: string;

  // Identity/grouping
  connectionName?: string;
  connectionQualifiedName?: string;

  // Hierarchy
  databaseQualifiedName?: string;
  schemaQualifiedName?: string;

  // Completeness / stewardship fields
  description?: string;
  userDescription?: string;
  ownerUsers?: string[] | Array<{ guid: string; name: string }>;
  ownerGroups?: string[] | Array<{ guid: string; name: string }>;
  certificateStatus?: string;
  certificateUpdatedAt?: number;
  classificationNames?: string[];
  meanings?: Array<{ guid: string; displayText: string }> | string[];
  domainGUIDs?: string[];
  readme?: unknown;
  __hasLineage?: boolean;

  // Timeliness
  updateTime?: number;
  sourceUpdatedAt?: number;
  sourceLastReadAt?: number;
  lastRowChangedAt?: number;
  lastProfiledAt?: number;

  // Usability / engagement
  popularityScore?: number;
  viewScore?: number;
  starredCount?: number;
  sourceReadCount?: number;
  sourceReadUserCount?: number;
  queryCount?: number;
  queryUserCount?: number;
  isDiscoverable?: boolean;
  isAIGenerated?: boolean;
}

// Proxy server URL (runs alongside Vite dev server)
const PROXY_URL = import.meta.env.VITE_PROXY_URL || 'http://localhost:3002';
const SAVED_BASE_URL_KEY = 'atlan_base_url';

export interface AtlanApiConfig {
  baseUrl: string;
  apiKey: string;
}

let config: AtlanApiConfig | null = null;

/**
 * Configure the Atlan API client
 */
export function configureAtlanApi(newConfig: AtlanApiConfig) {
  const previousBaseUrl = config?.baseUrl;
  config = newConfig;
  // Store in sessionStorage for persistence (not localStorage for security)
  sessionStorage.setItem(SAVED_BASE_URL_KEY, newConfig.baseUrl);
  // Don't store API key in storage - keep in memory only

  // Reset caches when switching tenants / credentials
  if (!previousBaseUrl || previousBaseUrl !== newConfig.baseUrl) {
    clearCache();
    resetAtlanAssetCache();
  }
}

/**
 * Get current configuration
 */
export function getAtlanConfig(): AtlanApiConfig | null {
  return config;
}

/**
 * Get current configuration (alias for compatibility)
 */
export function getAtlanClient(): AtlanApiConfig | null {
  return config;
}

/**
 * Get the last-used Atlan base URL (API key is never stored).
 */
export function getSavedAtlanBaseUrl(): string | null {
  try {
    return sessionStorage.getItem(SAVED_BASE_URL_KEY);
  } catch {
    return null;
  }
}

/**
 * Clear configuration (logout)
 */
export function clearAtlanConfig() {
  config = null;
  sessionStorage.removeItem(SAVED_BASE_URL_KEY);
  clearCache();
  resetAtlanAssetCache();
}

/**
 * Check if configured
 */
export function isConfigured(): boolean {
  return config !== null && !!config.baseUrl && !!config.apiKey;
}

// ============================================
// RESPONSE CACHE
// ============================================

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const cache = new Map<string, CacheEntry<unknown>>();
const CACHE_TTL = 60_000; // 60 seconds

/**
 * Get cached response if still valid
 */
function getCached<T>(key: string): T | null {
  const entry = cache.get(key);
  if (entry && Date.now() - entry.timestamp < CACHE_TTL) {
    return entry.data as T;
  }
  cache.delete(key);
  return null;
}

/**
 * Store response in cache
 */
function setCache<T>(key: string, data: T): void {
  cache.set(key, { data, timestamp: Date.now() });
}

/**
 * Clear all cache entries
 */
export function clearCache(): void {
  cache.clear();
}

export function resetAtlanAssetCache(): void {
  /* placeholder for future asset cache */
}

// ============================================
// API HELPERS
// ============================================

interface AtlanApiResponse<T> {
  data?: T;
  error?: string;
  status: number;
}

/**
 * Make an authenticated request to Atlan API via proxy
 * The proxy handles CORS by making server-side requests
 * Now uses enhanced apiFetch with retry logic and timeouts
 */
async function atlanFetch<T>(
  endpoint: string,
  options: RequestInit = {},
  signal?: AbortSignal
): Promise<AtlanApiResponse<T>> {
  if (!config) {
    return { error: 'Not configured. Call configureAtlanApi first.', status: 0 };
  }

  // Route through proxy to avoid CORS
  // endpoint like "/api/me" becomes "http://localhost:3002/proxy/api/me"
  const proxyPath = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint;
  const url = `${PROXY_URL}/proxy/${proxyPath}`;

  // Create deduplication key from endpoint, method, and body (for POST requests)
  const method = options.method || 'GET';
  const bodyKey = options.body
    ? (typeof options.body === 'string' ? options.body : JSON.stringify(options.body)).slice(0, 200)
    : '';
  const dedupeKey = `${method}:${endpoint}:${bodyKey}`;

  // Use request deduplication to prevent duplicate calls
  return deduplicateRequest(dedupeKey, async () => {
    // Use enhanced apiFetch with retry logic
    const response = await apiFetch<T>(url, {
      ...options,
      signal,
      timeout: 30000, // 30 second timeout
      retries: 3, // Retry up to 3 times
      retryDelay: 1000, // Start with 1 second delay
      headers: {
        'Content-Type': 'application/json',
        // Pass Atlan URL and API key to proxy via headers
        'X-Atlan-URL': config.baseUrl,
        'X-Atlan-API-Key': config.apiKey,
        ...options.headers,
      },
    });

    // Enhanced error message handling
    if (response.error) {
      // Check if we got HTML instead of JSON (common error page)
      if (response.error.includes('<!DOCTYPE') || response.error.includes('<html')) {
        // Extract meaningful text from HTML error
        const preMatch = response.error.match(/<pre>(.*?)<\/pre>/s);
        if (preMatch) {
          response.error = preMatch[1].trim();
        } else if (response.error.includes('Cannot POST') || response.error.includes('Cannot GET')) {
          response.error = 'Proxy server route not found. Make sure the proxy server is running correctly.';
        } else {
          response.error = 'Server returned an HTML error page. Check your Atlan URL and API key.';
        }
      }

      // Handle proxy-specific error messages
      if (response.error.includes('connection refused') || response.error.includes('ERR_CONNECTION_REFUSED')) {
        response.error = 'Proxy server not running. Start it with: npm run proxy';
      }

      logger.error('Atlan API request failed', {
        endpoint,
        error: response.error,
        status: response.status,
      });
    }

    return response;
  });
}

// ============================================
// CONNECTION
// ============================================

export interface ConnectionStatus {
  connected: boolean;
  username?: string;
  email?: string;
  tenantId?: string;
  error?: string;
}

/**
 * Test connection by running a simple search query
 * Atlan doesn't have a /me endpoint, so we test with a minimal search
 */
export async function testConnection(): Promise<ConnectionStatus> {
  // Test connection with a minimal search query
  const response = await atlanFetch<{
    approximateCount?: number;
    entities?: Array<{ typeName: string }>;
  }>('/api/meta/search/indexsearch', {
    method: 'POST',
    body: JSON.stringify({
      dsl: {
        from: 0,
        size: 1,
        query: {
          match_all: {},
        },
      },
      attributes: ['name'],
    }),
  });

  if (response.error) {
    return { connected: false, error: response.error };
  }

  return {
    connected: true,
    username: 'API Token', // Atlan doesn't return user info from search
    tenantId: config?.baseUrl?.replace('https://', '').replace('.atlan.com', ''),
  };
}

/**
 * Test Atlan connection with provided credentials (alias for compatibility)
 */
export async function testAtlanConnection({
  apiKey,
  baseUrl,
}: {
  apiKey: string;
  baseUrl: string;
}): Promise<boolean> {
  // Temporarily configure with provided credentials
  const previousConfig = config;
  configureAtlanApi({ apiKey, baseUrl });

  try {
    const status = await testConnection();
    if (!status.connected) {
      // Restore previous config if test failed
      if (previousConfig) {
        configureAtlanApi(previousConfig);
      } else {
        clearAtlanConfig();
      }
      throw new Error(status.error || 'Connection failed');
    }
    return true;
  } catch (error) {
    // Restore previous config on error
    if (previousConfig) {
      configureAtlanApi(previousConfig);
    } else {
      clearAtlanConfig();
    }
    throw error;
  }
}

// ============================================
// SEARCH API
// ============================================

interface SearchRequest {
  dsl: {
    from?: number;
    size?: number;
    query: Record<string, unknown>;
    aggregations?: Record<string, unknown>;
    sort?: Array<Record<string, unknown>>;
  };
  attributes?: string[];
  relationAttributes?: string[];
}

interface SearchResponse {
  entities?: AtlanEntity[];
  approximateCount?: number;
  aggregations?: Record<string, { buckets: Array<{ key: string; doc_count: number }> }>;
}

interface AtlanEntity {
  guid: string;
  typeName: string;
  attributes: {
    name?: string;
    qualifiedName?: string;
    description?: string;
    userDescription?: string;
    ownerUsers?: string[] | Array<{ guid: string; name: string }>;
    ownerGroups?: string[] | Array<{ guid: string; name: string }>;
    certificateStatus?: string;
    certificateStatusMessage?: string;
    certificateUpdatedAt?: number;
    certificateUpdatedBy?: string;
    connectorName?: string;
    connectionName?: string;
    connectionQualifiedName?: string;
    __hasLineage?: boolean;
    meanings?: Array<{ guid: string; displayText: string }>;
    assignedTerms?: Array<{ guid: string; displayText: string }>;
    classificationNames?: string[];
    classifications?: string[];
    assetTags?: string[];
    atlanTags?: Array<{ typeName: string; guid?: string; displayName?: string; entityGuid?: string; propagate?: boolean }>;
    domainGUIDs?: string[];
    isDiscoverable?: boolean;
    isEditable?: boolean;
    isAIGenerated?: boolean;
    createTime?: number;
    updateTime?: number;
    createdBy?: string;
    updatedBy?: string;
    sourceCreatedAt?: number;
    sourceUpdatedAt?: number;
    sourceLastReadAt?: number;
    lastRowChangedAt?: number;
    lastSyncRunAt?: number;
    popularityScore?: number;
    viewScore?: number;
    starredCount?: number;
    starredBy?: string[];
    sourceReadCount?: number;
    sourceReadUserCount?: number;
    // Table-specific - hierarchy
    databaseName?: string;
    databaseQualifiedName?: string;
    schemaName?: string;
    schemaQualifiedName?: string;
    tableName?: string;
    tableQualifiedName?: string;
    viewName?: string;
    viewQualifiedName?: string;
    // Table-specific - operational
    queryCount?: number;
    queryUserCount?: number;
    queryCountUpdatedAt?: number;
    lastProfiledAt?: number;
    rowCount?: number;
    sizeBytes?: number;
    columnCount?: number;
    isPartitioned?: boolean;
    partitionCount?: number;
    partitionStrategy?: string;
    tableType?: string;
    tableRetentionTime?: number;
    // Schema/Database counts
    schemaCount?: number;
    tableCount?: number;
    viewCount?: number;
    // Column-specific
    dataType?: string;
    order?: number;
    isNullable?: boolean;
    isPrimary?: boolean;
    isUnique?: boolean;
    isForeign?: boolean;
    foreignKeyTo?: string;
    defaultValue?: string;
    // Relationships (from relationAttributes)
    readme?: Array<{ guid: string; content?: string; name?: string }>;
    links?: Array<{ guid: string; url?: string; name?: string }>;
    files?: Array<{ guid: string; name?: string }>;
    [key: string]: unknown;
  };
  relationships?: {
    readme?: Array<{ guid: string; attributes?: { content?: string; name?: string } }>;
    links?: Array<{ guid: string; attributes?: { url?: string; name?: string } }>;
    files?: Array<{ guid: string; attributes?: { name?: string } }>;
    columns?: Array<{ guid: string; attributes?: Record<string, unknown> }>;
    [key: string]: unknown;
  };
}

/**
 * Execute a search query
 */
async function search(request: SearchRequest): Promise<SearchResponse | null> {
  const response = await atlanFetch<SearchResponse>('/api/meta/search/indexsearch', {
    method: 'POST',
    body: JSON.stringify(request),
  });

  if (response.error) {
    logger.error('Search error', { error: response.error, status: response.status });
    return null;
  }

  const result = response.data || null;
  if (result && result.entities) {
    logger.debug('Search completed', { entityCount: result.entities.length });
  }
  return result;
}

/**
 * Count assets matching a query
 */
async function countAssets(query: Record<string, unknown>): Promise<number> {
  const response = await search({
    dsl: {
      size: 0,
      query,
    },
  });

  return response?.approximateCount || 0;
}

// ============================================
// QUERY BUILDERS
// ============================================

/**
 * Build a bool query with filters
 */
function buildBoolQuery(filters: {
  must?: Array<Record<string, unknown>>;
  mustNot?: Array<Record<string, unknown>>;
  filter?: Array<Record<string, unknown>>;
}): Record<string, unknown> {
  return {
    bool: {
      must: filters.must || [],
      must_not: filters.mustNot || [
        { term: { '__state': 'DELETED' } },
        {
          terms: {
            '__typeName.keyword': [
              'AtlasGlossary',
              'AtlasGlossaryTerm',
              'AtlasGlossaryCategory',
              'Persona',
              'Purpose',
              'AuthPolicy',
            ],
          },
        },
      ],
      filter: filters.filter || [],
    },
  };
}

/**
 * Build connector filter
 */
function connectorFilter(connector: string): Record<string, unknown> {
  // Use connectorName without .keyword suffix - matches getDatabases behavior
  return { term: { 'connectorName': connector } };
}

/**
 * Build asset type filter
 */
function assetTypeFilter(types: string[]): Record<string, unknown> {
  // Expand common type names to include all connector-specific variants
  const expandedTypes: string[] = [];
  
  types.forEach(type => {
    if (type === 'Table') {
      // Include all table variants across connectors
      expandedTypes.push(
        'Table',
        'SnowflakeTable',
        'DatabricksTable',
        'BigQueryTable',
        'RedshiftTable',
        'PostgresTable',
        'MySQLTable',
        'SQLServerTable',
        'OracleTable',
        'HiveTable',
        'S3Bucket',
        'ADLSTable'
      );
    } else if (type === 'View') {
      // Include all view variants
      expandedTypes.push(
        'View',
        'SnowflakeView',
        'DatabricksView',
        'BigQueryView',
        'RedshiftView',
        'PostgresView',
        'MySQLView',
        'SQLServerView',
        'OracleView'
      );
    } else if (type === 'MaterializedView') {
      expandedTypes.push(
        'MaterializedView',
        'SnowflakeMaterializedView',
        'DatabricksMaterializedView',
        'BigQueryMaterializedView'
      );
    } else if (type === 'Schema') {
      expandedTypes.push(
        'Schema',
        'SnowflakeSchema',
        'DatabricksSchema',
        'BigQueryDataset',
        'RedshiftSchema',
        'PostgresSchema',
        'MySQLSchema',
        'SQLServerSchema',
        'OracleSchema'
      );
    } else if (type === 'Database') {
      expandedTypes.push(
        'Database',
        'SnowflakeDatabase',
        'DatabricksDatabase',
        'BigQueryDataset',
        'RedshiftDatabase',
        'PostgresDatabase',
        'MySQLDatabase',
        'SQLServerDatabase',
        'OracleDatabase'
      );
    } else {
      // Pass through other types as-is
      expandedTypes.push(type);
    }
  });
  
  // Remove duplicates
  const uniqueTypes = [...new Set(expandedTypes)];
  
  return { terms: { '__typeName.keyword': uniqueTypes } };
}

/**
 * Build "field exists" filter
 */
function fieldExistsFilter(field: string): Record<string, unknown> {
  // Handle array fields differently
  const arrayFields = ['ownerUsers', 'ownerGroups', 'meanings', 'atlanTags', 'starredBy', 'links'];

  if (arrayFields.includes(field)) {
    return {
      bool: {
        must: [
          { exists: { field } },
          { script: { script: `doc['${field}'].size() > 0` } },
        ],
      },
    };
  }

  if (field === '__hasLineage') {
    return { term: { '__hasLineage': true } };
  }

  return { exists: { field } };
}

// ============================================
// ASSET FETCHING
// ============================================

/**
 * Search for assets using Atlan Search API
 */
export async function searchAssets(
  query: Record<string, any> | string,
  attributes: string[] = [],
  limit: number = 100,
  offset: number = 0
): Promise<AtlanSearchResponse> {
  const defaultAttributes = [
    // Identity + grouping
    'typeName',
    'name',
    'qualifiedName',
    'connectorName',
    'connectionName',
    'connectionQualifiedName',
    // Completeness fields - descriptions
    'description',
    'userDescription',
    // Completeness fields - ownership
    'ownerUsers',
    'ownerGroups',
    // Completeness fields - certification & verification
    'certificateStatus',
    'certificateStatusMessage',
    'certificateUpdatedAt',
    'certificateUpdatedBy',
    // Completeness fields - tags & classifications
    'classificationNames',
    'classifications',
    'assetTags',
    'atlanTags',
    // Completeness fields - glossary & domains
    'meanings',
    'assignedTerms',
    'domainGUIDs',
    // Completeness fields - documentation
    '__hasLineage',
    // Timeliness fields
    'createTime',
    'updateTime',
    'createdBy',
    'updatedBy',
    'sourceCreatedAt',
    'sourceUpdatedAt',
    'sourceLastReadAt',
    'lastRowChangedAt',
    'lastSyncRunAt',
    // Usability fields - engagement
    'popularityScore',
    'viewScore',
    'starredCount',
    'starredBy',
    'sourceReadCount',
    'sourceReadUserCount',
    // Usability fields - discoverability
    'isDiscoverable',
    'isEditable',
    'isAIGenerated',
    // Table-specific - hierarchy
    'databaseName',
    'databaseQualifiedName',
    'schemaName',
    'schemaQualifiedName',
    'tableName',
    'tableQualifiedName',
    'viewName',
    'viewQualifiedName',
    // Table-specific - operational
    'queryCount',
    'queryUserCount',
    'queryCountUpdatedAt',
    'lastProfiledAt',
    'rowCount',
    'sizeBytes',
    'columnCount',
    'isPartitioned',
    'partitionCount',
    'partitionStrategy',
    'tableType',
    'tableRetentionTime',
    // Schema/Database counts
    'schemaCount',
    'tableCount',
    'viewCount',
    // Column-specific (for column assets)
    'dataType',
    'order',
    'isNullable',
    'isPrimary',
    'isUnique',
    'isForeign',
    'foreignKeyTo',
    'defaultValue',
  ];

  const requestedAttributes = attributes.length > 0 ? attributes : defaultAttributes;

  const searchQuery = typeof query === 'string' ? { match_all: {} } : query;

  // Relationship attributes to fetch (readme, links, files, etc.)
  const relationAttributes = [
    'readme', // Documentation
    'links', // External links
    'files', // Attached files
    'columns', // For tables - column relationships
    'tables', // For schemas - table relationships
    'views', // For schemas - view relationships
    'schemas', // For databases - schema relationships
    'database', // For schemas - parent database
    'schema', // For tables - parent schema
    'inputToProcesses', // Lineage - upstream processes
    'outputFromProcesses', // Lineage - downstream processes
  ];

  const requestBody: SearchRequest = {
    dsl: {
      from: offset,
      size: limit,
      query: searchQuery,
    },
    attributes: requestedAttributes,
    relationAttributes: relationAttributes,
  };

  const response = await search(requestBody);

  if (!response) {
    logger.warn('Search returned no response', { query, limit, offset });
    return {
      entities: [],
      approximateCount: 0,
      hasMore: false,
    };
  }

  // Transform entities to AtlanAsset format with all metadata
  const entities: AtlanAsset[] = (response.entities || []).map((entity) => {
    // Extract readme from relationships if available
    const readmeRelationship = entity.relationships?.readme?.[0];
    const readmeContent = readmeRelationship?.attributes?.content;
    const readmeGuid = readmeRelationship?.guid;
    
    const baseAsset: any = {
      guid: entity.guid,
      typeName: entity.typeName,
      name: entity.attributes.name || '',
      qualifiedName: entity.attributes.qualifiedName || '',
      connectionName: entity.attributes.connectionName || entity.attributes.connectorName,
      connectionQualifiedName: entity.attributes.connectionQualifiedName,
      connectorName: entity.attributes.connectorName,
      // Descriptions
      description: entity.attributes.description,
      userDescription: entity.attributes.userDescription,
      // Ownership
      ownerUsers: entity.attributes.ownerUsers,
      ownerGroups: entity.attributes.ownerGroups,
      // Certification & Verification
      certificateStatus: entity.attributes.certificateStatus as any,
      certificateStatusMessage: entity.attributes.certificateStatusMessage,
      certificateUpdatedAt: entity.attributes.certificateUpdatedAt,
      certificateUpdatedBy: entity.attributes.certificateUpdatedBy,
      // Tags & Classifications
      classificationNames: entity.attributes.classificationNames,
      classifications: entity.attributes.classifications,
      assetTags: entity.attributes.assetTags,
      atlanTags: entity.classifications?.map((tag: any) => ({
        typeName: tag.typeName,
        guid: tag.guid,
        entityGuid: tag.entityGuid,
        entityStatus: tag.entityStatus,
        propagate: tag.propagate,
        removePropagationsOnEntityDelete: tag.removePropagationsOnEntityDelete,
        restrictPropagationThroughLineage: tag.restrictPropagationThroughLineage,
        restrictPropagationThroughHierarchy: tag.restrictPropagationThroughHierarchy,
        tagAttachments: tag.tagAttachments,
        attributes: tag.attributes,
      })),
      // Glossary & Domains
      meanings: entity.attributes.meanings,
      assignedTerms: entity.attributes.assignedTerms,
      domainGUIDs: entity.attributes.domainGUIDs,
      // Discoverability
      isDiscoverable: entity.attributes.isDiscoverable,
      isEditable: entity.attributes.isEditable,
      isAIGenerated: entity.attributes.isAIGenerated,
      // Timestamps
      createTime: entity.attributes.createTime,
      updateTime: entity.attributes.updateTime,
      createdBy: entity.attributes.createdBy,
      updatedBy: entity.attributes.updatedBy,
      sourceCreatedAt: entity.attributes.sourceCreatedAt,
      sourceUpdatedAt: entity.attributes.sourceUpdatedAt,
      sourceLastReadAt: entity.attributes.sourceLastReadAt,
      lastRowChangedAt: entity.attributes.lastRowChangedAt,
      lastSyncRunAt: entity.attributes.lastSyncRunAt,
      // Engagement metrics
      popularityScore: entity.attributes.popularityScore,
      viewScore: entity.attributes.viewScore,
      starredCount: entity.attributes.starredCount,
      starredBy: entity.attributes.starredBy,
      sourceReadCount: entity.attributes.sourceReadCount,
      sourceReadUserCount: entity.attributes.sourceReadUserCount,
      // Lineage
      __hasLineage: entity.attributes.__hasLineage,
      // Documentation (from relationships)
      readme: readmeGuid ? { guid: readmeGuid, content: readmeContent } : undefined,
      // Links and files (from relationships)
      links: entity.relationships?.links?.map((link: any) => ({
        guid: link.guid,
        url: link.attributes?.url,
      })),
      files: entity.relationships?.files?.map((file: any) => ({
        guid: file.guid,
        name: file.attributes?.name,
      })),
    };

    // Add table-specific fields
    if (entity.typeName === 'Table' || entity.typeName === 'View' || entity.typeName === 'MaterializedView') {
      baseAsset.databaseName = entity.attributes.databaseName;
      baseAsset.databaseQualifiedName = entity.attributes.databaseQualifiedName;
      baseAsset.schemaName = entity.attributes.schemaName;
      baseAsset.schemaQualifiedName = entity.attributes.schemaQualifiedName;
      baseAsset.tableName = entity.attributes.tableName;
      baseAsset.tableQualifiedName = entity.attributes.tableQualifiedName;
      baseAsset.queryCount = entity.attributes.queryCount;
      baseAsset.queryUserCount = entity.attributes.queryUserCount;
      baseAsset.queryCountUpdatedAt = entity.attributes.queryCountUpdatedAt;
      baseAsset.lastProfiledAt = entity.attributes.lastProfiledAt;
      baseAsset.rowCount = entity.attributes.rowCount;
      baseAsset.sizeBytes = entity.attributes.sizeBytes;
      baseAsset.columnCount = entity.attributes.columnCount;
      baseAsset.isPartitioned = entity.attributes.isPartitioned;
      baseAsset.partitionCount = entity.attributes.partitionCount;
      baseAsset.partitionStrategy = entity.attributes.partitionStrategy;
      baseAsset.tableType = entity.attributes.tableType;
      baseAsset.tableRetentionTime = entity.attributes.tableRetentionTime;
    }

    // Add schema-specific fields
    if (entity.typeName === 'Schema' || entity.typeName?.includes('Schema')) {
      baseAsset.tableCount = entity.attributes.tableCount;
      baseAsset.viewCount = entity.attributes.viewCount;
    }

    // Add database-specific fields
    if (entity.typeName === 'Database' || entity.typeName?.includes('Database')) {
      baseAsset.schemaCount = entity.attributes.schemaCount;
    }

    return baseAsset as AtlanAsset;
  });

  return {
    entities,
    approximateCount: response.approximateCount,
    hasMore: (response.approximateCount || 0) > offset + limit,
  };
}

/**
 * Search for assets by type
 */
export async function searchByType(
  typeName: 'Connection' | 'Database' | 'Schema' | 'Table',
  filters: Record<string, any> = {},
  limit: number = 100,
  offset: number = 0
): Promise<AtlanAsset[]> {
  const mustFilters = [
    { term: { '__typeName.keyword': typeName } },
    ...Object.entries(filters).map(([key, value]) => ({
      term: { [key]: { value } },
    })),
  ];

  const query = buildBoolQuery({ must: mustFilters });

  const response = await searchAssets(query, [], limit, offset);
  return response.entities;
}

/**
 * Get assets by connection
 */
export async function getAssetsByConnection(
  connectionQualifiedName: string,
  assetTypes: string[] = ['Database', 'Schema', 'Table'],
  limit: number = 1000
): Promise<AtlanAsset[]> {
  const mustFilters = [
    { terms: { '__typeName.keyword': assetTypes } },
    { term: { 'connectionQualifiedName': connectionQualifiedName } },
  ];

  const query = buildBoolQuery({ must: mustFilters });

  const response = await searchAssets(query, [], limit, 0);
  return response.entities;
}

/**
 * Fetch assets for a given model/type from Atlan
 * Compatible with existing interface
 */
export async function fetchAssetsForModel(options?: {
  assetTypes?: string[];
  size?: number;
  from?: number;
  connector?: string;
  connectionQualifiedName?: string;
  databaseQualifiedName?: string;
  schemaQualifiedName?: string;
}): Promise<AtlanAsset[]> {
  if (!isConfigured()) {
    throw new Error('You must connect to Atlan before fetching assets.');
  }

  const size = options?.size ?? 200;
  const from = options?.from ?? 0;
  const mustFilters: Array<Record<string, unknown>> = [];
  const mustNotFilters: Array<Record<string, unknown>> = [
    { term: { '__state': 'DELETED' } },
    // Exclude metadata/system types
    {
      terms: {
        '__typeName.keyword': [
          'AtlasGlossary',
          'AtlasGlossaryTerm',
          'AtlasGlossaryCategory',
          'Persona',
          'Purpose',
          'AuthPolicy',
          'Connection',
          'Process',
          'ColumnProcess',
          'Task',
        ],
      },
    },
  ];

  // Filter by connector name
  if (options?.connector) {
    mustFilters.push(connectorFilter(options.connector));
  }

  // Also try connectionQualifiedName if provided
  if (options?.connectionQualifiedName) {
    mustFilters.push({ term: { 'connectionQualifiedName': options.connectionQualifiedName } });
  }

  // Filter by database qualified name (for database-level queries)
  if (options?.databaseQualifiedName) {
    mustFilters.push({ term: { 'databaseQualifiedName': options.databaseQualifiedName } });
  }

  // Filter by schema qualified name (for scoped imports)
  if (options?.schemaQualifiedName) {
    mustFilters.push({ term: { 'schemaQualifiedName': options.schemaQualifiedName } });
  }

  // Filter by asset types if specified
  if (options?.assetTypes?.length) {
    mustFilters.push(assetTypeFilter(options.assetTypes));
  }

  const query = buildBoolQuery({
    must: mustFilters.length > 0 ? mustFilters : [{ match_all: {} }],
    mustNot: mustNotFilters,
  });

  const response = await searchAssets(query, [], size, from);
  return response.entities;
}

/**
 * Get a single asset by GUID
 * Note: Atlan's Atlas API returns { entity: {...} } not { entities: [...] }
 */
export async function getAsset(guid: string, attributes: string[] = []): Promise<AtlanAsset | null> {
  // Build attributes query param if specified
  const attrParam = attributes.length > 0 ? `?attr=${attributes.join(',')}` : '';

  const response = await atlanFetch<{
    entity?: AtlanEntity;
    entities?: AtlanEntity[]; // Some endpoints might still use plural
  }>(`/api/meta/entity/guid/${guid}${attrParam}`, {
    method: 'GET',
  });

  if (response.error) {
    console.warn(`getAsset error for ${guid}:`, response.error);
    return null;
  }

  // Handle both singular (entity) and plural (entities) response formats
  const entity = response.data?.entity || response.data?.entities?.[0];

  if (!entity) {
    console.warn(`getAsset: No entity found for ${guid}`);
    return null;
  }

  // Transform to AtlanAsset format (similar to searchAssets)
  return {
    guid: entity.guid,
    typeName: entity.typeName,
    name: entity.attributes?.name || entity.attributes?.displayName || '',
    qualifiedName: entity.attributes?.qualifiedName || '',
    description: entity.attributes?.description,
    // ... map other attributes as needed
  } as AtlanAsset;
}

// ============================================
// CLASSIFICATION TYPE DEFINITIONS
// ============================================

/**
 * Classification type definition from Atlan typedefs API
 */
export interface ClassificationTypeDef {
  name: string;
  displayName?: string;
  guid?: string;
  description?: string;
}

/**
 * Fetch all classification type definitions from Atlan
 * Returns a map of type name -> display name for name resolution
 */
export async function getClassificationTypeDefs(): Promise<Map<string, string>> {
  const response = await atlanFetch<{
    classificationDefs?: ClassificationTypeDef[];
  }>('/api/meta/types/typedefs?type=classification', {
    method: 'GET',
  });

  console.log('[getClassificationTypeDefs] API response status:', response.status, 'error:', response.error || 'none');

  if (response.error || !response.data) {
    console.warn('Failed to fetch classification type definitions:', response.error || 'No data');
    return new Map();
  }

  const result = new Map<string, string>();
  const classificationDefs = response.data.classificationDefs || [];

  console.log(`[getClassificationTypeDefs] Fetched ${classificationDefs.length} classification definitions`);
  if (classificationDefs.length > 0) {
    console.log('[getClassificationTypeDefs] Sample definitions:',
      classificationDefs.slice(0, 5).map(d => ({ name: d.name, displayName: d.displayName }))
    );
  }

  for (const def of classificationDefs) {
    const typeName = def.name;
    const displayName = def.displayName || def.name;
    result.set(typeName, displayName);
  }

  return result;
}

// ============================================
// HIERARCHY FETCHING (for asset browser)
// ============================================

export interface HierarchyItem {
  guid: string;
  name: string;
  qualifiedName: string;
  typeName: string;
  childCount?: number;
  fullEntity?: any; // Full Atlan entity with all metadata
}

export interface ConnectorInfo {
  id: string;
  name: string;
  icon?: string;
  assetCount: number;
  isActive: boolean;
}

/**
 * Get list of connectors (connections with assets)
 */
export async function getConnectors(): Promise<ConnectorInfo[]> {
  if (!isConfigured()) {
    throw new Error('Atlan API not configured');
  }

  const cacheKey = `connectors:${config?.baseUrl || 'unknown'}`;
  const cached = getCached<ConnectorInfo[]>(cacheKey);
  if (cached) {
    return cached;
  }

  // Use aggregation to get connectors
  const response = await search({
    dsl: {
      size: 0,
      query: {
        bool: {
          must_not: [
            { term: { '__state': 'DELETED' } },
            {
              terms: {
                '__typeName.keyword': [
                  'AtlasGlossary',
                  'AtlasGlossaryTerm',
                  'AtlasGlossaryCategory',
                  'Persona',
                  'Purpose',
                  'AuthPolicy',
                  'Connection',
                  'Process',
                  'ColumnProcess',
                ],
              },
            },
          ],
        },
      },
      aggregations: {
        connectors: {
          terms: {
            field: 'connectorName',
            size: 50,
          },
        },
      },
    },
  });

  const buckets = response?.aggregations?.connectors?.buckets;
  if (buckets && buckets.length > 0) {
    const result = buckets
      .filter((bucket: { key: string; doc_count: number }) => bucket.doc_count > 0)
      .map((bucket: { key: string; doc_count: number }) => ({
        id: bucket.key,
        name: bucket.key,
        assetCount: bucket.doc_count,
        isActive: true,
      }));
    setCache(cacheKey, result);
    return result;
  }

  // Fallback: fetch sample assets and extract unique connector names
  logger.debug('Aggregation returned no results, trying fallback');
  const sampleResponse = await search({
    dsl: {
      size: 500,
      query: {
        bool: {
          must_not: [
            { term: { '__state': 'DELETED' } },
            {
              terms: {
                '__typeName.keyword': [
                  'AtlasGlossary',
                  'AtlasGlossaryTerm',
                  'AtlasGlossaryCategory',
                  'Persona',
                  'Purpose',
                  'AuthPolicy',
                  'Connection',
                  'Process',
                  'ColumnProcess',
                ],
              },
            },
          ],
        },
      },
    },
    attributes: ['name', 'connectorName', 'connectionName', '__typeName'],
  });

  if (sampleResponse?.entities && sampleResponse.entities.length > 0) {
    const connectorMap = new Map<string, number>();

    sampleResponse.entities.forEach((entity) => {
      const connector = entity.attributes.connectorName as string;
      if (connector) {
        connectorMap.set(connector, (connectorMap.get(connector) || 0) + 1);
      }
    });

    const result = Array.from(connectorMap.entries()).map(([name, count]) => ({
      id: name,
      name,
      assetCount: count,
      isActive: true,
    }));
    
    if (result.length > 0) {
      setCache(cacheKey, result);
      return result;
    }
  }

  logger.warn('No connectors found');
  return [];
}

/**
 * Get databases for a connector
 */
export async function getDatabases(connector: string): Promise<HierarchyItem[]> {
  if (!isConfigured()) {
    throw new Error('Atlan API not configured');
  }

  // First, try the standard database types
  const query = {
    dsl: {
      size: 100,
      query: {
        bool: {
          must: [
            { term: { 'connectorName': connector } },
            {
              terms: {
                '__typeName.keyword': [
                  'Database',
                  'SnowflakeDatabase',
                  'DatabricksDatabase',
                  'BigQueryDataset',
                  'RedshiftDatabase',
                ],
              },
            },
          ],
          must_not: [{ term: { '__state': 'DELETED' } }],
        },
      },
    },
    attributes: [
      'name', 'qualifiedName', 'schemaCount', 'connectorName', '__typeName',
      // Governance metadata
      'description', 'userDescription',
      'ownerUsers', 'ownerGroups',
      'certificateStatus', 'certificateStatusMessage', 'certificateUpdatedAt', 'certificateUpdatedBy',
      'classificationNames',
      'atlanTags',
      'meanings', 'assignedTerms', 'domainGUIDs',
      // Technical
      'createTime', 'updateTime', 'createdBy', 'updatedBy',
      'isDiscoverable', 'isEditable', 'isAIGenerated',
    ],
    relationAttributes: ['classifications'],
  };

  const response = await search(query);

  // If we found databases, return them
  if (response?.entities && response.entities.length > 0) {
    return response.entities.map((e) => ({
      guid: e.guid,
      name: (e.attributes.name as string) || e.typeName || e.guid,
      qualifiedName: (e.attributes.qualifiedName as string) || e.guid,
      typeName: e.typeName,
      childCount: e.attributes.schemaCount as number | undefined,
      fullEntity: e, // Store full entity for inspector
    }));
  }
  
  // If no databases found, try a broader search to see what asset types exist for this connector
  logger.debug('No databases found with standard types, checking available asset types');
  const sampleQuery = {
    dsl: {
      size: 50,
      query: {
        bool: {
          must: [
            { term: { 'connectorName': connector } },
          ],
          must_not: [
            { term: { '__state': 'DELETED' } },
            { terms: { '__typeName.keyword': ['AtlasGlossary', 'AtlasGlossaryTerm', 'AtlasGlossaryCategory', 'Persona', 'Purpose', 'AuthPolicy', 'Connection', 'Process', 'ColumnProcess'] } },
          ],
        },
      },
      aggregations: {
        asset_types: {
          terms: {
            field: '__typeName.keyword',
            size: 20,
          },
        },
      },
    },
    attributes: ['name', 'qualifiedName', '__typeName', 'connectorName'],
  };
  
  const sampleResponse = await search(sampleQuery);
  if (sampleResponse?.aggregations?.asset_types?.buckets) {
    const types = sampleResponse.aggregations.asset_types.buckets.map((b: { key: string; doc_count: number }) => `${b.key} (${b.doc_count})`);
    logger.debug('Available asset types for connector', { connector, types });
    
    // For connectors without databases (like SAP-ECC), we might need to show tables/views directly
    // But for now, return empty - the user should select a connector that has databases
    // TODO: Support flat hierarchies for connectors without databases
  }
  
  return [];
}

/**
 * Get schemas for a database
 */
export async function getSchemas(databaseQualifiedName: string): Promise<HierarchyItem[]> {
  if (!isConfigured()) {
    throw new Error('Atlan API not configured');
  }

  const response = await search({
    dsl: {
      size: 200,
      query: {
        bool: {
          must: [
            { term: { 'databaseQualifiedName': databaseQualifiedName } },
            {
              terms: {
                '__typeName.keyword': [
                  'Schema',
                  'SnowflakeSchema',
                  'DatabricksSchema',
                  'BigQueryDataset',
                  'RedshiftSchema',
                ],
              },
            },
          ],
          must_not: [{ term: { '__state': 'DELETED' } }],
        },
      },
    },
    attributes: [
      'name', 'qualifiedName', 'tableCount', 'viewCount',
      // Governance metadata
      'description', 'userDescription',
      'ownerUsers', 'ownerGroups',
      'certificateStatus', 'certificateStatusMessage', 'certificateUpdatedAt', 'certificateUpdatedBy',
      'classificationNames',
      'atlanTags',
      'meanings', 'assignedTerms', 'domainGUIDs',
      // Technical
      'createTime', 'updateTime', 'createdBy', 'updatedBy',
      'isDiscoverable', 'isEditable', 'isAIGenerated',
    ],
    relationAttributes: ['classifications'],
  });

  if (!response?.entities) {
    return [];
  }

  return response.entities.map((e) => {
    const tableCount = (e.attributes.tableCount as number) || 0;
    const viewCount = (e.attributes.viewCount as number) || 0;
    return {
      guid: e.guid,
      fullEntity: e, // Store full entity for inspector
      name: (e.attributes.name as string) || e.typeName || e.guid,
      qualifiedName: (e.attributes.qualifiedName as string) || e.guid,
      typeName: e.typeName,
      childCount: tableCount + viewCount,
    };
  });
}

/**
 * Get lineage for a specific asset
 */
export async function getLineage(
  guid: string,
  direction: 'upstream' | 'downstream' | 'both' = 'both',
  depth: number = 3
): Promise<AtlanLineageResponse> {
  // Atlan API only accepts "INPUT" (upstream) or "OUTPUT" (downstream), not "BOTH"
  // For "both", we need to make two separate calls and merge the results
  if (direction === 'both') {
    const [upstreamResponse, downstreamResponse] = await Promise.all([
      getLineage(guid, 'upstream', depth),
      getLineage(guid, 'downstream', depth),
    ]);

    // Merge the results
    const mergedGuidEntityMap = {
      ...upstreamResponse.guidEntityMap,
      ...downstreamResponse.guidEntityMap,
    };

    // Merge relations, avoiding duplicates (handle undefined/null relations)
    const upstreamRelations = upstreamResponse.relations || [];
    const downstreamRelations = downstreamResponse.relations || [];
    const relationMap = new Map<string, (typeof upstreamRelations)[0]>();
    [...upstreamRelations, ...downstreamRelations].forEach((rel) => {
      const key = `${rel.fromEntityId}-${rel.toEntityId}-${rel.relationshipType}`;
      if (!relationMap.has(key)) {
        relationMap.set(key, rel);
      }
    });

    return {
      guidEntityMap: mergedGuidEntityMap,
      relations: Array.from(relationMap.values()),
    };
  }

  // For single direction, map to Atlan API values
  // "upstream" -> "INPUT" (assets that feed into this asset)
  // "downstream" -> "OUTPUT" (assets that this asset feeds into)
  const apiDirection = direction === 'upstream' ? 'INPUT' : 'OUTPUT';

  const body = {
    guid,
    depth,
    direction: apiDirection,
    from: 0,
    size: 50,
    attributes: [
      'name',
      'qualifiedName',
      'description',
      'userDescription',
      'ownerUsers',
      'ownerGroups',
      'certificateStatus',
      'atlanTags',
      'meanings',
      '__hasLineage',
    ],
    immediateNeighbours: true,
  };

  const response = await atlanFetch<AtlanLineageRawResponse>('/api/meta/lineage/list', {
    method: 'POST',
    body: JSON.stringify(body),
  });

  if (response.error || !response.data) {
    throw new Error(response.error || 'Failed to fetch lineage');
  }

  // Transform raw API response to internal format
  const rawData = response.data;
  const guidEntityMap: Record<string, AtlanAsset> = {};
  const relations: AtlanLineageResponse['relations'] = [];

  // Helper to infer typeName from qualifiedName
  function inferTypeFromQualifiedName(qualifiedName: string): string {
    const qn = qualifiedName.toLowerCase();
    if (qn.includes('/powerbi/')) return 'PowerBITable';
    if (qn.includes('/thoughtspot/')) return 'ThoughtspotTable';
    if (qn.includes('/tableau/')) return 'TableauDatasource';
    if (qn.includes('/looker/')) return 'LookerView';
    if (qn.includes('/metabase/')) return 'MetabaseTable';
    if (qn.includes('/snowflake/')) return 'Table';
    if (qn.includes('/databricks/')) return 'Table';
    if (qn.includes('/redshift/')) return 'Table';
    if (qn.includes('/bigquery/')) return 'Table';
    if (qn.includes('/postgres/')) return 'Table';
    if (qn.includes('/mysql/')) return 'Table';
    if (qn.includes('/sqlserver/')) return 'Table';
    return 'Asset';
  }

  // Helper to normalize entity by flattening attributes to top level
  function normalizeEntity(entity: any): AtlanAsset {
    const attributes = entity.attributes || {};
    // Compute name with fallbacks
    const computedName = attributes.name || entity.displayText || 'Unknown';

    // Debug logging - show raw entity structure
    console.log('[normalizeEntity] RAW entity:', JSON.stringify({
      guid: entity.guid,
      typeName: entity.typeName,
      displayText: entity.displayText,
      hasAttributes: !!entity.attributes,
      attributeKeys: entity.attributes ? Object.keys(entity.attributes) : [],
      'attributes.name': attributes.name,
    }, null, 2));
    console.log('[normalizeEntity] Computed name:', computedName);

    // Spread attributes FIRST, then override with explicit values
    // This ensures our fallback logic takes precedence over undefined values
    const normalized = {
      // Spread raw attributes first (may contain undefined values that would overwrite)
      ...attributes,
      // Then override with explicit values and fallbacks (these take precedence)
      guid: entity.guid,
      typeName: entity.typeName,
      // Use displayText as reliable fallback for name (always present in Atlan responses)
      name: computedName,
      qualifiedName: attributes.qualifiedName || entity.qualifiedName || entity.guid,
      description: attributes.description || attributes.userDescription,
      userDescription: attributes.userDescription,
      certificateStatus: attributes.certificateStatus,
      assetTags: attributes.atlanTags,
      // Timestamps from top level of entity
      createTime: entity.createTime,
      updateTime: entity.updateTime,
      createdBy: entity.createdBy,
      updatedBy: entity.updatedBy,
    };

    // Log the final normalized result
    console.log('[normalizeEntity] RESULT:', { guid: normalized.guid, name: normalized.name, typeName: normalized.typeName });

    return normalized;
  }

  // Build guidEntityMap from entities array
  for (const entity of rawData.entities || []) {
    guidEntityMap[entity.guid] = normalizeEntity(entity);

    // Extract relations from immediateUpstream
    if (entity.immediateUpstream) {
      for (const upstream of entity.immediateUpstream) {
        // Create placeholder entry for referenced asset if not already in map
        if (!guidEntityMap[upstream.guid]) {
          guidEntityMap[upstream.guid] = {
            guid: upstream.guid,
            name: upstream.name || 'Unknown',
            qualifiedName: upstream.qualifiedName || upstream.guid,
            typeName: inferTypeFromQualifiedName(upstream.qualifiedName || ''),
          };
        }
        relations.push({
          fromEntityId: upstream.guid,
          toEntityId: entity.guid,
          relationshipId: `${upstream.guid}-${entity.guid}`,
          relationshipType: 'lineage',
        });
      }
    }

    // Extract relations from immediateDownstream
    if (entity.immediateDownstream) {
      for (const downstream of entity.immediateDownstream) {
        // Create placeholder entry for referenced asset if not already in map
        if (!guidEntityMap[downstream.guid]) {
          guidEntityMap[downstream.guid] = {
            guid: downstream.guid,
            name: downstream.name || 'Unknown',
            qualifiedName: downstream.qualifiedName || downstream.guid,
            typeName: inferTypeFromQualifiedName(downstream.qualifiedName || ''),
          };
        }
        relations.push({
          fromEntityId: entity.guid,
          toEntityId: downstream.guid,
          relationshipId: `${entity.guid}-${downstream.guid}`,
          relationshipType: 'lineage',
        });
      }
    }
  }

  return { guidEntityMap, relations };
}
