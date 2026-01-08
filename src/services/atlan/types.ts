/**
 * Atlan Asset Type Definitions
 *
 * Based on Atlan's Connections → Databases → Schemas → Tables hierarchy
 * and the attributes available via Atlan APIs
 */

/**
 * Atlan Tag with full propagation settings
 * Reference: https://developer.atlan.com/models/entities/tag/
 */
export interface AtlanTag {
  typeName: string;                          // Tag type name (e.g., "PII", "Sensitive")
  guid?: string;                             // Tag instance GUID
  entityGuid?: string;                       // GUID of the asset the tag is on
  entityStatus?: string;                     // Status of the tagged entity
  propagate?: boolean;                       // Whether tag propagates to children/downstream
  removePropagationsOnEntityDelete?: boolean; // Remove propagations when entity deleted
  restrictPropagationThroughLineage?: boolean; // Only propagate in hierarchy, not lineage
  restrictPropagationThroughHierarchy?: boolean; // Only propagate through lineage, not hierarchy
  // Source tag attachment (for source-synced tags)
  tagAttachments?: Array<{
    typeName?: string;
    guid?: string;
    tagQualifiedName?: string;
    tagAttachmentKey?: string;
    tagAttachmentValue?: string;
  }>;
  // Attributes from the tag definition
  attributes?: {
    tagId?: string;
    tagName?: string;
    tagQualifiedName?: string;
  };
}

/**
 * Glossary Term reference (linked terms)
 */
export interface GlossaryTermRef {
  guid: string;
  displayText?: string;
  qualifiedName?: string;
  typeName?: string;
}

/**
 * Data Product reference
 */
export interface DataProductRef {
  guid: string;
  name?: string;
  displayName?: string;
  qualifiedName?: string;
  typeName?: string;
}

/**
 * Data Domain reference
 */
export interface DataDomainRef {
  guid: string;
  name?: string;
  displayName?: string;
  qualifiedName?: string;
  typeName?: string;
}

/**
 * README asset reference
 */
export interface ReadmeRef {
  guid: string;
  content?: string;
  description?: string;
}

/**
 * Link/Resource reference
 */
export interface LinkRef {
  guid: string;
  url?: string;
  name?: string;
  link?: string;
  reference?: string;
}

/**
 * User reference (for starred by, read by, etc.)
 */
export interface UserRef {
  username?: string;
  displayName?: string;
  email?: string;
}

/**
 * Quality summary (from Soda, Monte Carlo, etc.)
 */
export interface DataQualitySummary {
  total?: number;
  passed?: number;
  failed?: number;
  warning?: number;
  score?: number;
  lastRunAt?: number;
}

/**
 * Custom metadata (business attributes) structure
 */
export type BusinessAttributes = Record<string, Record<string, any>>;

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
  connectorName?: string;
  connectorType?: string;

  // Governance + stewardship (Completeness / Accuracy / Consistency)
  description?: string;
  userDescription?: string; // User-provided wins in UI
  ownerUsers?: string[] | Array<{ guid: string; name: string }>;
  ownerGroups?: string[] | Array<{ guid: string; name: string }>;
  adminUsers?: string[];
  adminGroups?: string[];
  adminRoles?: string[];
  viewerUsers?: string[];
  viewerGroups?: string[];
  certificateStatus?: 'VERIFIED' | 'DRAFT' | 'DEPRECATED' | null;
  certificateStatusMessage?: string;
  certificateUpdatedAt?: number; // Unix timestamp
  certificateUpdatedBy?: string;

  // Classifications & Tags
  classifications?: string[] | AtlanTag[];
  classificationNames?: string[];
  assetTags?: string[];
  atlanTags?: AtlanTag[];  // Full tag objects with propagation settings
  tags?: string[];

  // Glossary Terms
  meanings?: GlossaryTermRef[]; // Glossary term links
  assignedTerms?: GlossaryTermRef[];

  // Data Products & Domains
  dataProducts?: DataProductRef[];
  dataProductGuids?: string[];
  dataDomain?: DataDomainRef;
  dataDomainGuid?: string;
  outputPortDataProducts?: DataProductRef[];
  inputPortDataProducts?: DataProductRef[];
  domainGUIDs?: string[];

  // Discoverability
  isDiscoverable?: boolean;
  isEditable?: boolean;
  isAIGenerated?: boolean;

  // Announcements
  announcementTitle?: string;
  announcementMessage?: string;
  announcementType?: 'information' | 'warning' | 'issue' | null;
  announcementUpdatedAt?: number;
  announcementUpdatedBy?: string;

  // Freshness + activity (Timeliness / Usability)
  createTime?: number; // Unix timestamp
  updateTime?: number; // Unix timestamp
  createdBy?: string;
  updatedBy?: string;
  sourceCreatedAt?: number; // Unix timestamp
  sourceUpdatedAt?: number; // Unix timestamp
  sourceCreatedBy?: string;
  sourceUpdatedBy?: string;
  sourceLastReadAt?: number; // Unix timestamp
  lastRowChangedAt?: number; // Unix timestamp
  lastSyncRunAt?: number; // Unix timestamp
  lastSyncWorkflowName?: string;

  // Usage & Popularity metrics
  popularityScore?: number;
  viewScore?: number;
  starredCount?: number;
  starredBy?: string[] | UserRef[];
  sourceReadCount?: number;
  sourceReadUserCount?: number;
  sourceReadQueryCost?: number;
  sourceReadCostUnit?: string;
  sourceTotalCost?: number;
  sourceReadRecentUserList?: UserRef[];
  sourceReadTopUserList?: UserRef[];

  // Lineage + documentation (Completeness / Consistency)
  __hasLineage?: boolean; // Presence flag
  hasLineage?: boolean;
  readme?: ReadmeRef; // Relationship
  links?: LinkRef[]; // Relationships
  resources?: LinkRef[];
  files?: Array<{ guid: string; name: string }>; // Relationships

  // Quality & Health metrics
  dataQualityScore?: number;
  dataQualitySummary?: DataQualitySummary;
  assetDbtJobLastRun?: string;
  assetDbtJobLastRunStatus?: string;
  assetDbtJobLastRunGeneratedAt?: number;
  assetMcIncidentCount?: number;
  assetMcMonitorCount?: number;
  assetSodaCheckCount?: number;
  assetSodaLastSyncRunAt?: number;
  assetSodaLastScanAt?: number;

  // Custom Metadata (business attributes)
  businessAttributes?: BusinessAttributes;

  // Extended attributes container (for any additional fields)
  attributes?: Record<string, any>;
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
 * Raw Atlan Lineage API Response (actual format from /api/meta/lineage/list)
 */
export interface AtlanLineageRawResponse {
  entities: Array<AtlanAsset & {
    depth: number;
    immediateUpstream?: Array<{ qualifiedName: string; name: string; guid: string }>;
    immediateDownstream?: Array<{ qualifiedName: string; name: string; guid: string }>;
  }>;
  hasMore: boolean;
  entityCount: number;
}

/**
 * Atlan Lineage Response (transformed format for internal use)
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
