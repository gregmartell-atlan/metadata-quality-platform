/**
 * MDLH Client Service
 *
 * Client for fetching data from the MDLH (Metadata Lakehouse) Gold Layer
 * via the FastAPI backend's Snowflake integration.
 *
 * This service provides the same interface as the Atlan REST API client
 * but fetches data from Snowflake MDLH instead.
 *
 * MDLH Schema Reference:
 * - All queries target ATLAN_GOLD.PUBLIC schema
 * - See src/services/mdlh/queries.ts for consolidated SQL queries
 * - Backend SQL files: backend/app/sql/*.sql
 */

import { logger } from '../utils/logger';
import type { AtlanAsset, AtlanAssetBase } from './atlan/types';
import type { AtlanAssetSummary, ConnectorInfo, HierarchyItem } from './atlan/api';

// Re-export schema constants for reference
export { MDLH_SCHEMA, ASSETS_TABLE, RELATIONAL_DETAILS_TABLE, LINEAGE_TABLE } from './mdlh/queries';

// ============================================
// Configuration
// ============================================

const API_BASE = '/api/mdlh';

// ============================================
// Types for MDLH Responses
// ============================================

export interface MdlhAsset {
  GUID: string;
  ASSET_NAME: string;
  ASSET_TYPE: string;
  ASSET_QUALIFIED_NAME: string;
  DESCRIPTION: string | null;
  CONNECTOR_NAME: string | null;
  CERTIFICATE_STATUS: string | null;
  HAS_LINEAGE: boolean;
  POPULARITY_SCORE: number | null;
  OWNER_USERS: string[] | null;
  TAGS: string[] | null;
  TERM_GUIDS: string[] | null;
  README_GUID: string | null;
  UPDATED_AT: number | null;
  SOURCE_UPDATED_AT: number | null;
}

export interface MdlhQualityScore {
  GUID: string;
  ASSET_NAME: string;
  ASSET_TYPE: string;
  CONNECTOR_NAME: string | null;
  ASSET_QUALIFIED_NAME: string;
  COMPLETENESS_SCORE: number;
  ACCURACY_SCORE: number;
  TIMELINESS_SCORE: number;
  CONSISTENCY_SCORE: number;
  USABILITY_SCORE: number;
  OVERALL_SCORE?: number;
}

export interface MdlhQualityRollup {
  DIMENSION_VALUE: string;
  TOTAL_ASSETS: number;
  PCT_WITH_DESCRIPTION: number;
  PCT_WITH_OWNER: number;
  PCT_WITH_TAGS: number;
  PCT_CERTIFIED: number;
  PCT_WITH_LINEAGE: number;
  AVG_COMPLETENESS: number;
  AVG_ACCURACY: number;
  AVG_TIMELINESS: number;
  AVG_CONSISTENCY: number;
  AVG_USABILITY: number;
  AVG_OVERALL?: number;
}

export interface MdlhLineageNode {
  guid: string;
  name: string;
  asset_type: string;
  direction: 'UPSTREAM' | 'DOWNSTREAM';
  level: number;
}

export interface MdlhLineageResult {
  start_guid: string;
  upstream: MdlhLineageNode[];
  downstream: MdlhLineageNode[];
}

export interface MdlhPivotData {
  row_dimension: string;
  column_dimension: string;
  metric: string;
  columns: string[];
  data: Record<string, Record<string, number>>;
}

export interface MdlhConnector {
  CONNECTOR_NAME: string;
  ASSET_COUNT: number;
}

// ============================================
// Hierarchy Types (from MDLH endpoints)
// ============================================

export interface MdlhHierarchyItem {
  name: string;
  asset_count: number;
  sample_guid?: string | null;
}

export interface MdlhTableItem {
  guid: string;
  name: string;
  asset_type: string;
  qualified_name: string;
  description?: string | null;
  certificate_status?: string | null;
  has_lineage?: boolean;
  popularity_score?: number | null;
  owner_users?: string[] | null;
  tags?: string[] | null;
  updated_at?: number | null;
}

export interface MdlhAssetDetail {
  guid: string;
  name: string;
  asset_type: string;
  qualified_name: string;
  connector_name?: string | null;
  connector_qualified_name?: string | null;
  description?: string | null;
  certificate_status?: string | null;
  has_lineage?: boolean;
  popularity_score?: number | null;
  owner_users?: string[] | null;
  owner_groups?: string[] | null;
  tags?: string[] | null;
  term_guids?: string[] | null;
  readme_guid?: string | null;
  updated_at?: number | null;
  source_updated_at?: number | null;
  created_at?: number | null;
  created_by?: string | null;
  updated_by?: string | null;
  status?: string | null;
  column_count?: number | null;
  row_count?: number | null;
  size_bytes?: number | null;
  read_count?: number | null;
  query_count?: number | null;
  database_name?: string | null;
  schema_name?: string | null;
}

// ============================================
// API Helpers
// ============================================

interface MdlhApiResponse<T> {
  data?: T;
  error?: string;
  status: number;
}

async function mdlhFetch<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<MdlhApiResponse<T>> {
  const url = `${API_BASE}${endpoint}`;

  // Get session ID from backend mode store for proper session tracking
  let sessionId: string | undefined;
  try {
    // Dynamic import to avoid circular dependency
    const { useBackendModeStore } = await import('../stores/backendModeStore');
    sessionId = useBackendModeStore.getState().snowflakeStatus.sessionId;
  } catch {
    // Store not available, proceed without session ID
  }

  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };
    
    // Add session ID header if available
    if (sessionId) {
      headers['X-Session-ID'] = sessionId;
    }

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return {
        // Check both 'detail' (FastAPI standard) and 'error' (custom MDLH format)
        error: errorData.detail || errorData.error || `Request failed: ${response.statusText}`,
        status: response.status,
      };
    }

    const data = await response.json();
    return { data, status: response.status };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Network error';
    logger.error('[MdlhClient] Request failed:', message);
    return { error: message, status: 0 };
  }
}

// ============================================
// Transformation Helpers
// ============================================

/**
 * Transform MDLH asset to AtlanAssetSummary format
 * 
 * This transformation ensures compatibility with the scoring pipeline
 * by providing all required fields and sensible defaults for optional ones.
 */
export function transformToAssetSummary(asset: MdlhAsset): AtlanAssetSummary {
  // Parse database and schema from qualified name for hierarchy support
  const qualifiedParts = asset.ASSET_QUALIFIED_NAME?.split('/') || [];
  const databaseName = qualifiedParts[0] || undefined;
  const schemaName = qualifiedParts[1] || undefined;
  
  return {
    guid: asset.GUID,
    typeName: asset.ASSET_TYPE,
    name: asset.ASSET_NAME,
    qualifiedName: asset.ASSET_QUALIFIED_NAME,
    connectionName: asset.CONNECTOR_NAME || undefined,
    connectionQualifiedName: asset.CONNECTOR_NAME || undefined, // Use connector name as fallback
    description: asset.DESCRIPTION || undefined,
    userDescription: asset.DESCRIPTION || undefined, // Fallback to description
    ownerUsers: asset.OWNER_USERS || undefined,
    ownerGroups: undefined, // Not available in this response format
    certificateStatus: asset.CERTIFICATE_STATUS || undefined,
    classificationNames: asset.TAGS || undefined,
    meanings: asset.TERM_GUIDS?.map((guid) => ({ guid, displayText: '' })) || undefined,
    domainGUIDs: undefined, // Not available in MDLH Gold Layer
    __hasLineage: asset.HAS_LINEAGE,
    updateTime: asset.UPDATED_AT || undefined,
    sourceUpdatedAt: asset.SOURCE_UPDATED_AT || undefined,
    popularityScore: asset.POPULARITY_SCORE || undefined,
    readme: asset.README_GUID ? { guid: asset.README_GUID } : undefined,
    isDiscoverable: true, // Default to discoverable
    // Additional fields for hierarchy/pivot support
    databaseQualifiedName: databaseName ? `${asset.CONNECTOR_NAME}/${databaseName}` : undefined,
    schemaQualifiedName: schemaName ? `${asset.CONNECTOR_NAME}/${databaseName}/${schemaName}` : undefined,
  };
}

/**
 * Transform MDLH quality score to frontend format
 */
export function transformQualityScore(score: MdlhQualityScore): {
  guid: string;
  name: string;
  typeName: string;
  connector: string | null;
  qualifiedName: string;
  completeness: number;
  accuracy: number;
  timeliness: number;
  consistency: number;
  usability: number;
  overall: number;
} {
  return {
    guid: score.GUID,
    name: score.ASSET_NAME,
    typeName: score.ASSET_TYPE,
    connector: score.CONNECTOR_NAME,
    qualifiedName: score.ASSET_QUALIFIED_NAME,
    completeness: score.COMPLETENESS_SCORE,
    accuracy: score.ACCURACY_SCORE,
    timeliness: score.TIMELINESS_SCORE,
    consistency: score.CONSISTENCY_SCORE,
    usability: score.USABILITY_SCORE,
    overall:
      score.OVERALL_SCORE ??
      score.COMPLETENESS_SCORE * 0.25 +
        score.ACCURACY_SCORE * 0.2 +
        score.TIMELINESS_SCORE * 0.2 +
        score.CONSISTENCY_SCORE * 0.15 +
        score.USABILITY_SCORE * 0.2,
  };
}

// ============================================
// Public API
// ============================================

/**
 * Search assets in MDLH Gold Layer
 */
export async function searchAssets(options: {
  query?: string;
  assetType?: string;
  connector?: string;
  limit?: number;
  offset?: number;
}): Promise<{
  assets: AtlanAssetSummary[];
  totalCount: number;
  hasMore: boolean;
}> {
  const params = new URLSearchParams();
  if (options.query) params.set('query', options.query);
  if (options.assetType && options.assetType !== 'all') {
    params.set('asset_type', options.assetType);
  }
  if (options.connector) params.set('connector', options.connector);
  params.set('limit', String(options.limit || 100));
  params.set('offset', String(options.offset || 0));

  const response = await mdlhFetch<{
    assets: MdlhAsset[];
    total_count: number;
    limit: number;
    offset: number;
  }>(`/assets?${params.toString()}`);

  if (response.error || !response.data) {
    logger.error('[MdlhClient] Search failed:', response.error);
    return { assets: [], totalCount: 0, hasMore: false };
  }

  const assets = response.data.assets.map(transformToAssetSummary);
  const totalCount = response.data.total_count;
  const hasMore = totalCount > (options.offset || 0) + assets.length;

  return { assets, totalCount, hasMore };
}

/**
 * Get quality scores for assets
 */
export async function getQualityScores(options: {
  assetType?: string;
  connector?: string;
  limit?: number;
  offset?: number;
}): Promise<{
  scores: ReturnType<typeof transformQualityScore>[];
  limit: number;
  offset: number;
}> {
  const params = new URLSearchParams();
  if (options.assetType && options.assetType !== 'all') {
    params.set('asset_type', options.assetType);
  }
  if (options.connector) params.set('connector', options.connector);
  params.set('limit', String(options.limit || 100));
  params.set('offset', String(options.offset || 0));

  const response = await mdlhFetch<{
    scores: MdlhQualityScore[];
    limit: number;
    offset: number;
  }>(`/quality-scores?${params.toString()}`);

  if (response.error || !response.data) {
    logger.error('[MdlhClient] Quality scores fetch failed:', response.error);
    return { scores: [], limit: 100, offset: 0 };
  }

  return {
    scores: response.data.scores.map(transformQualityScore),
    limit: response.data.limit,
    offset: response.data.offset,
  };
}

/**
 * Get quality scores for specific asset GUIDs (batch request)
 * Used by ScoresStore to fetch pre-computed scores from MDLH
 */
export async function getQualityScoresByGuids(guids: string[]): Promise<{
  scores: Map<string, ReturnType<typeof transformQualityScore>>;
  count: number;
}> {
  if (guids.length === 0) {
    return { scores: new Map(), count: 0 };
  }

  const response = await mdlhFetch<{
    scores: MdlhQualityScore[];
    count: number;
    requested: number;
  }>('/quality-scores/batch', {
    method: 'POST',
    body: JSON.stringify({ guids }),
  });

  if (response.error || !response.data) {
    logger.error('[MdlhClient] Batch quality scores fetch failed:', response.error);
    return { scores: new Map(), count: 0 };
  }

  // Create a map of guid -> scores for efficient lookup
  const scoresMap = new Map<string, ReturnType<typeof transformQualityScore>>();
  for (const score of response.data.scores) {
    scoresMap.set(score.GUID, transformQualityScore(score));
  }

  logger.debug('[MdlhClient] Fetched batch quality scores:', {
    requested: response.data.requested,
    returned: response.data.count,
  });

  return {
    scores: scoresMap,
    count: response.data.count,
  };
}

/**
 * Get quality rollup by dimension
 *
 * Uses the unified /quality endpoint which supports all dimensions including 'owner'.
 */
export async function getQualityRollup(options: {
  dimension?: 'connector' | 'database' | 'schema' | 'asset_type' | 'certificate_status' | 'owner';
  assetType?: string;
  connector?: string;
  limit?: number;
}): Promise<{
  dimension: string;
  rollups: MdlhQualityRollup[];
}> {
  const params = new URLSearchParams();
  if (options.dimension) params.set('dimension', options.dimension);
  if (options.assetType && options.assetType !== 'all') {
    params.set('asset_type', options.assetType);
  }
  if (options.connector) params.set('connector', options.connector);
  if (options.limit) params.set('limit', String(options.limit));

  // Use unified /quality endpoint (replaces /quality-rollup)
  const response = await mdlhFetch<{
    dimension: string;
    rollups: MdlhQualityRollup[];
  }>(`/quality?${params.toString()}`);

  if (response.error || !response.data) {
    logger.error('[MdlhClient] Quality rollup fetch failed:', response.error);
    return { dimension: options.dimension || 'connector', rollups: [] };
  }

  return response.data;
}

/**
 * Get lineage for an asset
 */
export async function getLineage(
  guid: string,
  options?: {
    direction?: 'UPSTREAM' | 'DOWNSTREAM' | 'BOTH';
    maxLevel?: number;
  }
): Promise<MdlhLineageResult> {
  const params = new URLSearchParams();
  if (options?.direction) params.set('direction', options.direction);
  if (options?.maxLevel) params.set('max_level', String(options.maxLevel));

  const response = await mdlhFetch<MdlhLineageResult>(
    `/lineage/${guid}?${params.toString()}`
  );

  if (response.error || !response.data) {
    logger.error('[MdlhClient] Lineage fetch failed:', response.error);
    return { start_guid: guid, upstream: [], downstream: [] };
  }

  return response.data;
}

/**
 * Get list of connectors
 */
export async function getConnectors(): Promise<
  Array<{ id: string; name: string; assetCount: number }>
> {
  const response = await mdlhFetch<{ connectors: MdlhConnector[] }>('/connectors');

  if (response.error || !response.data) {
    logger.error('[MdlhClient] Connectors fetch failed:', response.error);
    return [];
  }

  return response.data.connectors.map((c) => ({
    id: c.CONNECTOR_NAME,
    name: c.CONNECTOR_NAME,
    assetCount: c.ASSET_COUNT,
  }));
}

/**
 * Get pivot data for analytics
 */
export async function getPivotData(options: {
  rowDimension?: string;
  columnDimension?: string;
  metric?: string;
  assetType?: string;
}): Promise<MdlhPivotData> {
  const params = new URLSearchParams();
  if (options.rowDimension) params.set('row_dimension', options.rowDimension);
  if (options.columnDimension) params.set('column_dimension', options.columnDimension);
  if (options.metric) params.set('metric', options.metric);
  if (options.assetType && options.assetType !== 'all') {
    params.set('asset_type', options.assetType);
  }

  const response = await mdlhFetch<MdlhPivotData>(`/pivot?${params.toString()}`);

  if (response.error || !response.data) {
    logger.error('[MdlhClient] Pivot data fetch failed:', response.error);
    return {
      row_dimension: options.rowDimension || 'connector',
      column_dimension: options.columnDimension || 'asset_type',
      metric: options.metric || 'count',
      columns: [],
      data: {},
    };
  }

  return response.data;
}

/**
 * Check if MDLH is connected and available
 */
export async function checkConnection(): Promise<{
  connected: boolean;
  user?: string;
  error?: string;
}> {
  // Use absolute path since snowflake endpoints are under /api/snowflake, not /api/mdlh
  const response = await fetch('/api/snowflake/status');
  
  if (!response.ok) {
    return { connected: false, error: `Status check failed: ${response.statusText}` };
  }
  
  const data = await response.json() as {
    connected: boolean;
    user?: string;
    auth_method?: string;
  };

  return {
    connected: data.connected ?? false,
    user: data.user,
  };
}

// ============================================
// Bulk Loading Support
// ============================================

/**
 * Fetch all assets for quality scoring (bulk load)
 * Uses server-side pagination to handle large datasets
 */
export async function fetchAllAssetsForScoring(options: {
  assetType?: string;
  connector?: string;
  onProgress?: (loaded: number, total: number) => void;
}): Promise<AtlanAssetSummary[]> {
  const batchSize = 500;
  let offset = 0;
  const allAssets: AtlanAssetSummary[] = [];

  // Get initial batch to determine total count
  const firstBatch = await searchAssets({
    assetType: options.assetType,
    connector: options.connector,
    limit: batchSize,
    offset: 0,
  });

  allAssets.push(...firstBatch.assets);
  const totalCount = firstBatch.totalCount;

  options.onProgress?.(allAssets.length, totalCount);

  // Fetch remaining batches
  while (allAssets.length < totalCount) {
    offset += batchSize;

    const batch = await searchAssets({
      assetType: options.assetType,
      connector: options.connector,
      limit: batchSize,
      offset,
    });

    if (batch.assets.length === 0) break;

    allAssets.push(...batch.assets);
    options.onProgress?.(allAssets.length, totalCount);
  }

  return allAssets;
}

/**
 * Get aggregated quality metrics for all assets (no need to load all assets client-side)
 * This uses server-side aggregation for performance
 */
export async function getAggregatedQualityMetrics(options?: {
  dimension?: 'connector' | 'database' | 'schema' | 'asset_type';
  assetType?: string;
}): Promise<{
  totalAssets: number;
  averageScores: {
    completeness: number;
    accuracy: number;
    timeliness: number;
    consistency: number;
    usability: number;
    overall: number;
  };
  byDimension: MdlhQualityRollup[];
}> {
  const rollup = await getQualityRollup({
    dimension: options?.dimension || 'connector',
    assetType: options?.assetType,
  });

  // Calculate totals from rollups
  let totalAssets = 0;
  let sumCompleteness = 0;
  let sumAccuracy = 0;
  let sumTimeliness = 0;
  let sumConsistency = 0;
  let sumUsability = 0;

  for (const r of rollup.rollups) {
    totalAssets += r.TOTAL_ASSETS;
    sumCompleteness += r.AVG_COMPLETENESS * r.TOTAL_ASSETS;
    sumAccuracy += r.AVG_ACCURACY * r.TOTAL_ASSETS;
    sumTimeliness += r.AVG_TIMELINESS * r.TOTAL_ASSETS;
    sumConsistency += r.AVG_CONSISTENCY * r.TOTAL_ASSETS;
    sumUsability += r.AVG_USABILITY * r.TOTAL_ASSETS;
  }

  const avgCompleteness = totalAssets > 0 ? sumCompleteness / totalAssets : 0;
  const avgAccuracy = totalAssets > 0 ? sumAccuracy / totalAssets : 0;
  const avgTimeliness = totalAssets > 0 ? sumTimeliness / totalAssets : 0;
  const avgConsistency = totalAssets > 0 ? sumConsistency / totalAssets : 0;
  const avgUsability = totalAssets > 0 ? sumUsability / totalAssets : 0;

  const avgOverall =
    avgCompleteness * 0.25 +
    avgAccuracy * 0.2 +
    avgTimeliness * 0.2 +
    avgConsistency * 0.15 +
    avgUsability * 0.2;

  return {
    totalAssets,
    averageScores: {
      completeness: avgCompleteness,
      accuracy: avgAccuracy,
      timeliness: avgTimeliness,
      consistency: avgConsistency,
      usability: avgUsability,
      overall: avgOverall,
    },
    byDimension: rollup.rollups,
  };
}

// ============================================
// Hierarchy Navigation API
// ============================================

/**
 * Transform MDLH hierarchy item to ConnectorInfo format
 */
export function transformToConnectorInfo(item: MdlhHierarchyItem): ConnectorInfo {
  return {
    id: item.name,
    name: item.name,
    assetCount: item.asset_count,
    isActive: true,
  };
}

/**
 * Transform MDLH hierarchy item to HierarchyItem format (for databases/schemas)
 */
export function transformToHierarchyItem(
  item: MdlhHierarchyItem,
  typeName: string,
  connectorName?: string,
  databaseName?: string
): HierarchyItem {
  // Build a qualified name based on hierarchy level
  let qualifiedName = item.name;
  if (connectorName) {
    qualifiedName = `${connectorName}/${item.name}`;
  }
  if (databaseName) {
    qualifiedName = `${connectorName}/${databaseName}/${item.name}`;
  }

  return {
    guid: item.sample_guid || '',
    name: item.name,
    qualifiedName,
    typeName,
    childCount: item.asset_count,
  };
}

/**
 * Transform MDLH table item to HierarchyItem format
 */
export function transformTableToHierarchyItem(item: MdlhTableItem): HierarchyItem {
  return {
    guid: item.guid,
    name: item.name,
    qualifiedName: item.qualified_name,
    typeName: item.asset_type,
    popularityScore: item.popularity_score ?? undefined,
    fullEntity: {
      guid: item.guid,
      typeName: item.asset_type,
      attributes: {
        name: item.name,
        qualifiedName: item.qualified_name,
        description: item.description,
        certificateStatus: item.certificate_status,
        ownerUsers: item.owner_users,
        classificationNames: item.tags,
        updateTime: item.updated_at,
        __hasLineage: item.has_lineage,
        popularityScore: item.popularity_score,
      },
    },
  };
}

/**
 * Transform MDLH asset detail to AtlanAsset format
 */
export function transformAssetDetailToAtlanAsset(detail: MdlhAssetDetail): AtlanAsset {
  return {
    guid: detail.guid,
    typeName: detail.asset_type,
    attributes: {
      name: detail.name,
      qualifiedName: detail.qualified_name,
      description: detail.description ?? undefined,
      userDescription: detail.description ?? undefined,
      connectorName: detail.connector_name ?? undefined,
      connectionQualifiedName: detail.connector_qualified_name ?? undefined,
      certificateStatus: detail.certificate_status ?? undefined,
      ownerUsers: detail.owner_users ?? undefined,
      ownerGroups: detail.owner_groups ?? undefined,
      classificationNames: detail.tags ?? undefined,
      meanings: detail.term_guids?.map((guid) => ({ guid, displayText: '' })) ?? undefined,
      __hasLineage: detail.has_lineage ?? false,
      popularityScore: detail.popularity_score ?? undefined,
      updateTime: detail.updated_at ?? undefined,
      sourceUpdatedAt: detail.source_updated_at ?? undefined,
      createTime: detail.created_at ?? undefined,
      createdBy: detail.created_by ?? undefined,
      updatedBy: detail.updated_by ?? undefined,
      readme: detail.readme_guid ? { guid: detail.readme_guid } : undefined,
      // Relational details
      columnCount: detail.column_count ?? undefined,
      rowCount: detail.row_count ?? undefined,
      sizeBytes: detail.size_bytes ?? undefined,
      sourceReadCount: detail.read_count ?? undefined,
      queryCount: detail.query_count ?? undefined,
      databaseName: detail.database_name ?? undefined,
      schemaName: detail.schema_name ?? undefined,
    },
  };
}

/**
 * Get connectors for hierarchy navigation
 */
export async function getHierarchyConnectors(): Promise<ConnectorInfo[]> {
  const response = await mdlhFetch<{
    connectors: MdlhHierarchyItem[];
  }>('/hierarchy/connectors');

  if (response.error || !response.data) {
    logger.error('[MdlhClient] Hierarchy connectors fetch failed:', response.error);
    throw new Error(response.error || 'Failed to fetch connectors');
  }

  return response.data.connectors.map(transformToConnectorInfo);
}

/**
 * Get databases for a connector
 */
export async function getHierarchyDatabases(connector: string): Promise<HierarchyItem[]> {
  const params = new URLSearchParams({ connector });
  const response = await mdlhFetch<{
    databases: MdlhHierarchyItem[];
    connector: string;
  }>(`/hierarchy/databases?${params.toString()}`);

  if (response.error || !response.data) {
    logger.error('[MdlhClient] Hierarchy databases fetch failed:', response.error);
    throw new Error(response.error || 'Failed to fetch databases');
  }

  return response.data.databases.map((db) =>
    transformToHierarchyItem(db, 'Database', connector)
  );
}

/**
 * Get schemas for a database
 */
export async function getHierarchySchemas(
  connector: string,
  database: string
): Promise<HierarchyItem[]> {
  const params = new URLSearchParams({ connector, database });
  const response = await mdlhFetch<{
    schemas: MdlhHierarchyItem[];
    connector: string;
    database: string;
  }>(`/hierarchy/schemas?${params.toString()}`);

  if (response.error || !response.data) {
    logger.error('[MdlhClient] Hierarchy schemas fetch failed:', response.error);
    throw new Error(response.error || 'Failed to fetch schemas');
  }

  return response.data.schemas.map((schema) =>
    transformToHierarchyItem(schema, 'Schema', connector, database)
  );
}

/**
 * Get tables/views for a schema
 */
export async function getHierarchyTables(
  connector: string,
  database: string,
  schema: string,
  limit: number = 500
): Promise<HierarchyItem[]> {
  const params = new URLSearchParams({
    connector,
    database,
    schema,
    limit: String(limit),
  });
  const response = await mdlhFetch<{
    tables: MdlhTableItem[];
    connector: string;
    database: string;
    schema: string;
    count: number;
  }>(`/hierarchy/tables?${params.toString()}`);

  if (response.error || !response.data) {
    logger.error('[MdlhClient] Hierarchy tables fetch failed:', response.error);
    throw new Error(response.error || 'Failed to fetch tables');
  }

  return response.data.tables.map(transformTableToHierarchyItem);
}

/**
 * Get full details for a single asset by GUID
 */
export async function getAssetDetails(guid: string): Promise<AtlanAsset | null> {
  const response = await mdlhFetch<{
    asset: MdlhAssetDetail;
  }>(`/asset/${guid}`);

  if (response.error || !response.data) {
    if (response.status === 404) {
      return null;
    }
    logger.error('[MdlhClient] Asset detail fetch failed:', response.error);
    throw new Error(response.error || 'Failed to fetch asset details');
  }

  return transformAssetDetailToAtlanAsset(response.data.asset);
}

/**
 * Extended MDLH asset type with hierarchy fields (returned from /hierarchy/assets)
 * Supports both UPPERCASE (raw Snowflake) and lowercase field names
 */
interface MdlhHierarchyAsset {
  // UPPERCASE (raw Snowflake)
  GUID?: string;
  ASSET_NAME?: string;
  ASSET_TYPE?: string;
  ASSET_QUALIFIED_NAME?: string;
  DESCRIPTION?: string | null;
  CONNECTOR_NAME?: string | null;
  CERTIFICATE_STATUS?: string | null;
  HAS_LINEAGE?: boolean;
  POPULARITY_SCORE?: number | null;
  OWNER_USERS?: string[] | null;
  TAGS?: string[] | null;
  TERM_GUIDS?: string[] | null;
  README_GUID?: string | null;
  UPDATED_AT?: number | null;
  SOURCE_UPDATED_AT?: number | null;
  DATABASE_NAME?: string;
  SCHEMA_NAME?: string;
  // lowercase (transformed)
  guid?: string;
  asset_name?: string;
  asset_type?: string;
  qualified_name?: string;
  description?: string | null;
  connector_name?: string | null;
  certificate_status?: string | null;
  has_lineage?: boolean;
  popularity_score?: number | null;
  owner_users?: string[] | null;
  tags?: string[] | null;
  term_guids?: string[] | null;
  readme_guid?: string | null;
  updated_at?: number | null;
  source_updated_at?: number | null;
  database_name?: string;
  schema_name?: string;
}

/**
 * Transform MDLH hierarchy asset to AtlanAssetSummary with full hierarchy info
 * Handles both UPPERCASE (raw Snowflake) and lowercase field names
 */
function transformHierarchyAssetToSummary(asset: MdlhHierarchyAsset): AtlanAssetSummary {
  // Handle both UPPERCASE and lowercase field names
  const guid = asset.GUID || asset.guid || '';
  const assetType = asset.ASSET_TYPE || asset.asset_type || '';
  const assetName = asset.ASSET_NAME || asset.asset_name || '';
  const qualifiedName = asset.ASSET_QUALIFIED_NAME || asset.qualified_name || '';
  const connectorName = asset.CONNECTOR_NAME || asset.connector_name;
  const description = asset.DESCRIPTION || asset.description;
  const ownerUsers = asset.OWNER_USERS || asset.owner_users;
  const certificateStatus = asset.CERTIFICATE_STATUS || asset.certificate_status;
  const tags = asset.TAGS || asset.tags;
  const termGuids = asset.TERM_GUIDS || asset.term_guids;
  const hasLineage = asset.HAS_LINEAGE ?? asset.has_lineage ?? false;
  const updatedAt = asset.UPDATED_AT || asset.updated_at;
  const sourceUpdatedAt = asset.SOURCE_UPDATED_AT || asset.source_updated_at;
  const popularityScore = asset.POPULARITY_SCORE || asset.popularity_score;
  const readmeGuid = asset.README_GUID || asset.readme_guid;
  const databaseName = asset.DATABASE_NAME || asset.database_name;
  const schemaName = asset.SCHEMA_NAME || asset.schema_name;

  return {
    guid,
    typeName: assetType,
    name: assetName,
    qualifiedName,
    connectionName: connectorName || undefined,
    connectionQualifiedName: connectorName || undefined,
    description: description || undefined,
    userDescription: description || undefined,
    ownerUsers: ownerUsers || undefined,
    ownerGroups: undefined,
    certificateStatus: certificateStatus || undefined,
    classificationNames: tags || undefined,
    meanings: termGuids?.map((g) => ({ guid: g, displayText: '' })) || undefined,
    domainGUIDs: undefined,
    __hasLineage: hasLineage,
    updateTime: updatedAt || undefined,
    sourceUpdatedAt: sourceUpdatedAt || undefined,
    popularityScore: popularityScore || undefined,
    readme: readmeGuid ? { guid: readmeGuid } : undefined,
    isDiscoverable: true,
    // Use hierarchy fields from the extended query
    databaseQualifiedName: databaseName
      ? `${connectorName}/${databaseName}`
      : undefined,
    schemaQualifiedName: schemaName
      ? `${connectorName}/${databaseName}/${schemaName}`
      : undefined,
  };
}

/**
 * Get assets within a hierarchy context (for loading into context store)
 */
export async function getHierarchyAssets(options: {
  connector?: string;
  database?: string;
  schema?: string;
  limit?: number;
  offset?: number;
}): Promise<{
  assets: AtlanAssetSummary[];
  totalCount: number;
  hasMore: boolean;
}> {
  const params = new URLSearchParams();
  if (options.connector) params.set('connector', options.connector);
  if (options.database) params.set('database', options.database);
  if (options.schema) params.set('schema', options.schema);
  params.set('limit', String(options.limit || 1000));
  params.set('offset', String(options.offset || 0));

  const response = await mdlhFetch<{
    assets: MdlhHierarchyAsset[];
    total_count: number;
    limit: number;
    offset: number;
    filters: {
      connector?: string;
      database?: string;
      schema?: string;
    };
  }>(`/hierarchy/assets?${params.toString()}`);

  if (response.error || !response.data) {
    logger.error('[MdlhClient] Hierarchy assets fetch failed:', response.error);
    return { assets: [], totalCount: 0, hasMore: false };
  }

  const assets = response.data.assets.map(transformHierarchyAssetToSummary);
  const totalCount = response.data.total_count;
  const hasMore = totalCount > (options.offset || 0) + assets.length;

  return { assets, totalCount, hasMore };
}

// ============================================
// Lineage Metrics API (NEW)
// ============================================

export interface MdlhLineageMetric {
  guid: string;
  asset_name: string;
  asset_type: string;
  connector_name: string | null;
  has_upstream: number;
  has_downstream: number;
  has_lineage: number;
  full_lineage: number;
  orphaned: number;
  upstream_count: number;
  downstream_count: number;
}

export interface MdlhLineageRollup {
  dimension_value: string;
  total_assets: number;
  pct_has_upstream: number;
  pct_has_downstream: number;
  pct_with_lineage: number;
  pct_full_lineage: number;
  pct_orphaned: number;
  avg_upstream_count: number;
  avg_downstream_count: number;
}

/**
 * Get per-asset lineage metrics with upstream/downstream breakdown
 */
export async function getLineageMetrics(options?: {
  assetType?: string;
  connector?: string;
  limit?: number;
  offset?: number;
}): Promise<{
  assets: MdlhLineageMetric[];
  total_count: number;
  limit: number;
  offset: number;
}> {
  const params = new URLSearchParams();
  if (options?.assetType && options.assetType !== 'all') {
    params.set('asset_type', options.assetType);
  }
  if (options?.connector) params.set('connector', options.connector);
  params.set('limit', String(options?.limit || 1000));
  params.set('offset', String(options?.offset || 0));

  const response = await mdlhFetch<{
    assets: MdlhLineageMetric[];
    total_count: number;
    limit: number;
    offset: number;
  }>(`/lineage-metrics?${params.toString()}`);

  if (response.error || !response.data) {
    logger.error('[MdlhClient] Lineage metrics fetch failed:', response.error);
    return { assets: [], total_count: 0, limit: 1000, offset: 0 };
  }

  return response.data;
}

/**
 * Get aggregated lineage metrics by dimension
 */
export async function getLineageRollup(options?: {
  dimension?: 'connector' | 'database' | 'schema' | 'asset_type' | 'certificate_status';
  assetType?: string;
}): Promise<{
  dimension: string;
  rollups: MdlhLineageRollup[];
}> {
  const params = new URLSearchParams();
  if (options?.dimension) params.set('dimension', options.dimension);
  if (options?.assetType && options.assetType !== 'all') {
    params.set('asset_type', options.assetType);
  }

  const response = await mdlhFetch<{
    dimension: string;
    rollups: MdlhLineageRollup[];
  }>(`/lineage-rollup?${params.toString()}`);

  if (response.error || !response.data) {
    logger.error('[MdlhClient] Lineage rollup fetch failed:', response.error);
    return { dimension: options?.dimension || 'connector', rollups: [] };
  }

  return response.data;
}

// ============================================
// Owner Pivot API (NEW)
// ============================================

export interface MdlhOwnerInfo {
  owner: string;
  asset_count: number;
}

/**
 * Get list of all owners with asset counts
 */
export async function getOwners(options?: {
  assetType?: string;
  limit?: number;
}): Promise<{
  owners: MdlhOwnerInfo[];
  total_owners: number;
}> {
  const params = new URLSearchParams();
  if (options?.assetType && options.assetType !== 'all') {
    params.set('asset_type', options.assetType);
  }
  if (options?.limit) params.set('limit', String(options.limit));

  const response = await mdlhFetch<{
    owners: MdlhOwnerInfo[];
    total_owners: number;
  }>(`/owners?${params.toString()}`);

  if (response.error || !response.data) {
    logger.error('[MdlhClient] Owners fetch failed:', response.error);
    return { owners: [], total_owners: 0 };
  }

  return response.data;
}

/**
 * Get quality rollup aggregated by owner
 *
 * @deprecated Use getQualityRollup({ dimension: 'owner', ... }) instead.
 * This function is kept for backward compatibility.
 */
export async function getQualityRollupByOwner(options?: {
  assetType?: string;
}): Promise<{
  dimension: string;
  rollups: MdlhQualityRollup[];
}> {
  // Delegate to unified getQualityRollup with dimension='owner'
  return getQualityRollup({
    dimension: 'owner',
    assetType: options?.assetType,
  });
}

// ============================================
// Time Series / Snapshot API (NEW)
// ============================================

export interface MdlhSnapshot {
  snapshot_time: string;
  total_assets: number;
  // Coverage metrics
  pct_with_description: number;
  pct_with_owner: number;
  pct_with_tags: number;
  pct_certified: number;
  pct_with_lineage: number;
  // Quality scores
  avg_completeness: number;
  avg_accuracy: number;
  avg_timeliness: number;
  avg_consistency: number;
  avg_usability: number;
  avg_overall: number;
  // Breakdown by type
  assets_by_type: Record<string, number>;
  // Filter context
  filters: {
    asset_type?: string;
    connector?: string;
  };
}

export interface MdlhCoverageTrendPoint {
  date: string;
  assets_modified: number;
  pct_with_description: number;
  pct_with_owner: number;
  pct_with_tags: number;
  pct_certified: number;
  pct_with_lineage: number;
  avg_completeness: number;
}

/**
 * Get current-state quality snapshot for time series storage
 */
export async function getSnapshot(options?: {
  assetType?: string;
  connector?: string;
}): Promise<MdlhSnapshot> {
  const params = new URLSearchParams();
  if (options?.assetType && options.assetType !== 'all') {
    params.set('asset_type', options.assetType);
  }
  if (options?.connector) params.set('connector', options.connector);

  const response = await mdlhFetch<MdlhSnapshot>(`/snapshot?${params.toString()}`);

  if (response.error || !response.data) {
    logger.error('[MdlhClient] Snapshot fetch failed:', response.error);
    // Return empty snapshot with current time
    return {
      snapshot_time: new Date().toISOString(),
      total_assets: 0,
      pct_with_description: 0,
      pct_with_owner: 0,
      pct_with_tags: 0,
      pct_certified: 0,
      pct_with_lineage: 0,
      avg_completeness: 0,
      avg_accuracy: 0,
      avg_timeliness: 0,
      avg_consistency: 0,
      avg_usability: 0,
      avg_overall: 0,
      assets_by_type: {},
      filters: options || {},
    };
  }

  return response.data;
}

/**
 * Get coverage trends over time based on asset modification dates
 * This provides historical trend data by looking at when assets were last modified
 */
export async function getCoverageTrends(options?: {
  days?: number;
  assetType?: string;
  connector?: string;
}): Promise<{
  trend_points: MdlhCoverageTrendPoint[];
  period_days: number;
  filters: {
    asset_type?: string;
    connector?: string;
  };
}> {
  const params = new URLSearchParams();
  if (options?.days) params.set('days', String(options.days));
  if (options?.assetType && options.assetType !== 'all') {
    params.set('asset_type', options.assetType);
  }
  if (options?.connector) params.set('connector', options.connector);

  const response = await mdlhFetch<{
    trend_points: MdlhCoverageTrendPoint[];
    period_days: number;
    filters: {
      asset_type?: string;
      connector?: string;
    };
  }>(`/trends/coverage?${params.toString()}`);

  if (response.error || !response.data) {
    logger.error('[MdlhClient] Coverage trends fetch failed:', response.error);
    return {
      trend_points: [],
      period_days: options?.days || 30,
      filters: options || {},
    };
  }

  return response.data;
}

// ============================================
// Enhanced Search API (NEW)
// ============================================

export interface MdlhSearchResult {
  guid: string;
  asset_name: string;
  asset_type: string;
  connector_name: string | null;
  qualified_name: string;
  description: string | null;
  certificate_status: string | null;
  has_lineage: boolean;
  owner_users: string[] | null;
  tags: string[] | null;
  updated_at: number | null;
  relevance_score: number;
  match_fields: string[];
}

/**
 * Enhanced search with relevance scoring and field-specific matching
 *
 * Uses the unified /assets endpoint with query parameter.
 * Results are automatically ordered by relevance when a query is provided.
 */
export async function enhancedSearch(options: {
  query: string;
  assetType?: string;
  connector?: string;
  database?: string;
  schema?: string;
  fields?: ('name' | 'description' | 'qualified_name' | 'tags' | 'owners')[];
  limit?: number;
  offset?: number;
}): Promise<{
  results: MdlhSearchResult[];
  total_count: number;
  query: string;
  filters: {
    asset_type?: string;
    connector?: string;
    database?: string;
    schema?: string;
    fields?: string[];
  };
}> {
  const params = new URLSearchParams();
  params.set('query', options.query);
  if (options.assetType && options.assetType !== 'all') {
    params.set('asset_type', options.assetType);
  }
  if (options.connector) params.set('connector', options.connector);
  if (options.database) params.set('database', options.database);
  if (options.schema) params.set('schema', options.schema);
  if (options.fields && options.fields.length > 0) {
    params.set('fields', options.fields.join(','));
  }
  params.set('limit', String(options.limit || 100));
  params.set('offset', String(options.offset || 0));
  params.set('include_tags', 'true'); // Include tags for search results

  // Use unified /assets endpoint (replaces /search)
  // The backend returns relevance-ordered results when query is provided
  const response = await mdlhFetch<{
    assets: MdlhAsset[];
    total_count: number;
    limit: number;
    offset: number;
  }>(`/assets?${params.toString()}`);

  if (response.error || !response.data) {
    logger.error('[MdlhClient] Enhanced search failed:', response.error);
    return {
      results: [],
      total_count: 0,
      query: options.query,
      filters: {
        asset_type: options.assetType,
        connector: options.connector,
        database: options.database,
        schema: options.schema,
        fields: options.fields,
      },
    };
  }

  // Transform MdlhAsset to MdlhSearchResult format for compatibility
  const results: MdlhSearchResult[] = response.data.assets.map((asset) => ({
    guid: asset.GUID,
    asset_name: asset.ASSET_NAME,
    asset_type: asset.ASSET_TYPE,
    connector_name: asset.CONNECTOR_NAME,
    qualified_name: asset.ASSET_QUALIFIED_NAME,
    description: asset.DESCRIPTION,
    certificate_status: asset.CERTIFICATE_STATUS,
    has_lineage: asset.HAS_LINEAGE,
    owner_users: asset.OWNER_USERS,
    tags: asset.TAGS,
    updated_at: asset.UPDATED_AT,
    relevance_score: asset.POPULARITY_SCORE ?? 0, // Backend orders by relevance
    match_fields: [], // Unified endpoint doesn't return match fields
  }));

  return {
    results,
    total_count: response.data.total_count,
    query: options.query,
    filters: {
      asset_type: options.assetType,
      connector: options.connector,
      database: options.database,
      schema: options.schema,
      fields: options.fields,
    },
  };
}

/**
 * Transform enhanced search result to AtlanAssetSummary
 */
export function transformSearchResultToSummary(result: MdlhSearchResult): AtlanAssetSummary {
  const qualifiedParts = result.qualified_name?.split('/') || [];
  const databaseName = qualifiedParts[0] || undefined;
  const schemaName = qualifiedParts[1] || undefined;

  return {
    guid: result.guid,
    typeName: result.asset_type,
    name: result.asset_name,
    qualifiedName: result.qualified_name,
    connectionName: result.connector_name || undefined,
    connectionQualifiedName: result.connector_name || undefined,
    description: result.description || undefined,
    userDescription: result.description || undefined,
    ownerUsers: result.owner_users || undefined,
    ownerGroups: undefined,
    certificateStatus: result.certificate_status || undefined,
    classificationNames: result.tags || undefined,
    meanings: undefined,
    domainGUIDs: undefined,
    __hasLineage: result.has_lineage,
    updateTime: result.updated_at || undefined,
    sourceUpdatedAt: undefined,
    popularityScore: result.relevance_score, // Use relevance as a proxy for popularity in search
    readme: undefined,
    isDiscoverable: true,
    databaseQualifiedName: databaseName
      ? `${result.connector_name}/${databaseName}`
      : undefined,
    schemaQualifiedName: schemaName
      ? `${result.connector_name}/${databaseName}/${schemaName}`
      : undefined,
  };
}

// ============================================
// SCHEMA INTROSPECTION API
// ============================================

/**
 * MDLH schema column from Snowflake INFORMATION_SCHEMA
 */
export interface MdlhSchemaColumn {
  table_name: string;
  column_name: string;
  data_type: string;
  is_nullable: boolean;
  comment: string | null;
}

/**
 * Field reconciliation result
 */
export interface MdlhFieldReconciliation {
  field_id: string;
  field_name: string;
  category: string;
  expected_mdlh_column: string | null;
  expected_mdlh_table: string | null;
  actual_column: MdlhSchemaColumn | null;
  status: 'available' | 'missing' | 'type_mismatch' | 'no_mapping';
}

/**
 * Schema reconciliation summary
 */
export interface MdlhReconciliationSummary {
  total_expected: number;
  available: number;
  missing: number;
  type_mismatch: number;
  no_mapping: number;
  by_category: Record<string, { expected: number; available: number; missing: number }>;
  by_table: Record<string, { expected: number; available: number; missing: number }>;
}

/**
 * Get MDLH Gold Layer schema metadata
 *
 * Returns all columns from ATLAN_GOLD.PUBLIC tables/views with their
 * data types and nullability information.
 */
export async function getMdlhSchema(): Promise<{
  discovered_at: string;
  columns: MdlhSchemaColumn[];
  column_count: number;
  tables: string[];
  table_count: number;
  by_table: Record<string, MdlhSchemaColumn[]>;
}> {
  const response = await mdlhFetch<{
    discovered_at: string;
    columns: MdlhSchemaColumn[];
    column_count: number;
    tables: string[];
    table_count: number;
    by_table: Record<string, MdlhSchemaColumn[]>;
  }>('/schema');

  if (response.error || !response.data) {
    logger.error('[MdlhClient] Schema fetch failed:', response.error);
    throw new Error(response.error || 'Failed to fetch MDLH schema');
  }

  return response.data;
}

/**
 * Reconcile expected field mappings against actual MDLH schema
 *
 * Compares the fields defined in unified-fields.ts with their expected
 * MDLH column mappings against the actual schema.
 */
export async function reconcileMdlhSchema(): Promise<{
  discovered_at: string;
  reconciliation: MdlhFieldReconciliation[];
  summary: MdlhReconciliationSummary;
}> {
  const response = await mdlhFetch<{
    discovered_at: string;
    reconciliation: MdlhFieldReconciliation[];
    summary: MdlhReconciliationSummary;
  }>('/schema/reconcile');

  if (response.error || !response.data) {
    logger.error('[MdlhClient] Schema reconciliation failed:', response.error);
    throw new Error(response.error || 'Failed to reconcile MDLH schema');
  }

  return response.data;
}
