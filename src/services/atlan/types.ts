/**
 * Atlan Asset Type Definitions
 * 
 * Based on Atlan's Connections → Databases → Schemas → Tables hierarchy
 * and the attributes available via Atlan APIs
 */

/**
 * Shared asset attributes (applies to Connection / Database / Schema / Table)
 */
export interface AtlanAssetBase {
  // Core identification
  guid: string;
  typeName: string;
  name: string;
  qualifiedName: string;
  connectionName?: string;
  connectionQualifiedName?: string;

  // Governance + stewardship (Completeness / Accuracy / Consistency)
  description?: string;
  userDescription?: string; // User-provided wins in UI
  ownerUsers?: string[] | Array<{ guid: string; name: string }>;
  ownerGroups?: string[] | Array<{ guid: string; name: string }>;
  certificateStatus?: 'VERIFIED' | 'DRAFT' | 'DEPRECATED' | null;
  certificateStatusMessage?: string;
  certificateUpdatedAt?: number; // Unix timestamp
  certificateUpdatedBy?: string;
  classifications?: string[];
  classificationNames?: string[];
  assetTags?: string[];
  meanings?: Array<{ guid: string; displayText: string }>; // Glossary term links
  assignedTerms?: Array<{ guid: string; displayText: string }>;
  domainGUIDs?: string[];
  isDiscoverable?: boolean;
  isEditable?: boolean;
  isAIGenerated?: boolean;

  // Freshness + activity (Timeliness / Usability)
  createTime?: number; // Unix timestamp
  updateTime?: number; // Unix timestamp
  createdBy?: string;
  updatedBy?: string;
  sourceCreatedAt?: number; // Unix timestamp
  sourceUpdatedAt?: number; // Unix timestamp
  sourceLastReadAt?: number; // Unix timestamp
  lastRowChangedAt?: number; // Unix timestamp
  lastSyncRunAt?: number; // Unix timestamp
  popularityScore?: number;
  viewScore?: number;
  starredCount?: number;
  starredBy?: string[];
  sourceReadCount?: number;
  sourceReadUserCount?: number;

  // Lineage + documentation (Completeness / Consistency)
  __hasLineage?: boolean; // Presence flag
  readme?: { guid: string; content?: string }; // Relationship
  links?: Array<{ guid: string; url: string }>; // Relationships
  files?: Array<{ guid: string; name: string }>; // Relationships
}

/**
 * Connection (top of hierarchy)
 * Represents source system config (warehouse, RDBMS, etc.)
 */
export interface AtlanConnection extends AtlanAssetBase {
  typeName: 'Connection';
  allowQuery?: boolean;
  allowQueryPreview?: boolean;
  category?: string;
  subCategory?: string;
  host?: string;
  port?: number;
  hasPopularityInsights?: boolean;
  popularityInsightsTimeframe?: string;
  rowLimit?: number;
  queryTimeout?: number;
  queryConfig?: Record<string, any>;
  queryPreviewConfig?: Record<string, any>;
  credentialStrategy?: string;
}

/**
 * Database
 */
export interface AtlanDatabase extends AtlanAssetBase {
  typeName: 'Database';
  schemaCount?: number;
  // Relationships
  schemas?: Array<{ guid: string; qualifiedName: string }>;
}

/**
 * Schema
 */
export interface AtlanSchema extends AtlanAssetBase {
  typeName: 'Schema';
  tableCount?: number;
  viewsCount?: number;
  linkedSchemaQualifiedName?: string; // BigQuery Analytics Hub / linked datasets
  // Relationships
  database?: { guid: string; qualifiedName: string };
  tables?: Array<{ guid: string; qualifiedName: string }>;
  views?: Array<{ guid: string; qualifiedName: string }>;
}

/**
 * Table (and SQL-asset) locator properties
 */
export interface AtlanTable extends AtlanAssetBase {
  typeName: 'Table' | 'View' | 'MaterializedView';
  // Locator properties
  databaseName?: string;
  databaseQualifiedName?: string;
  schemaName?: string;
  schemaQualifiedName?: string;
  tableName?: string;
  tableQualifiedName?: string;

  // Operational / profiling properties (Usability + Timeliness)
  isProfiled?: boolean;
  lastProfiledAt?: number; // Unix timestamp
  queryCount?: number;
  queryUserCount?: number;
  queryCountUpdatedAt?: number; // Unix timestamp
  queryUserMap?: Record<string, number>;
  rowCount?: number;
  sizeBytes?: number;
  isPartitioned?: boolean;
  partitionCount?: number;
  partitionStrategy?: string;
  tableType?: string;
  tableRetentionTime?: number;
}

/**
 * Union type for all Atlan assets
 */
export type AtlanAsset = AtlanConnection | AtlanDatabase | AtlanSchema | AtlanTable;

/**
 * Atlan Search API Response
 */
export interface AtlanSearchResponse {
  entities: AtlanAsset[];
  approximateCount?: number;
  hasMore?: boolean;
}

/**
 * Atlan Lineage Response
 */
export interface AtlanLineageResponse {
  guidEntityMap: Record<string, AtlanAsset>;
  relations: Array<{
    fromEntityId: string;
    toEntityId: string;
    relationshipId: string;
    relationshipType: string;
  }>;
}

/**
 * Atlan API Configuration
 */
export interface AtlanConfig {
  baseUrl: string;
  apiKey: string;
  apiToken: string;
}






