/**
 * Unified Field Catalog - Type Definitions
 *
 * This module defines the core types for the unified field catalog system.
 * All assessable properties map to Atlan attributes, custom metadata,
 * classifications, or derived computations.
 *
 * Ported from atlan-metadata-evaluation/assessment/packages/domain
 */

// =============================================================================
// SIGNAL TYPES
// =============================================================================

/**
 * Canonical signal types for metadata assessment
 * These represent the high-level dimensions of metadata health
 */
export type SignalType =
  | 'OWNERSHIP'       // Assets have assigned owners
  | 'SEMANTICS'       // Documentation and context present
  | 'LINEAGE'         // Data flow relationships documented
  | 'SENSITIVITY'     // Classification and sensitivity markers
  | 'ACCESS'          // Access policies defined
  | 'QUALITY'         // DQ monitoring configured
  | 'FRESHNESS'       // Timeliness monitoring configured
  | 'USAGE'           // Usage telemetry available
  | 'AI_READY'        // AI/ML use approved
  | 'TRUST';          // Certification and trust markers

/**
 * Tri-state value for signal/field presence
 */
export type TriState = true | false | 'UNKNOWN';

// =============================================================================
// FIELD SOURCE TYPES
// =============================================================================

/**
 * Native Atlan attribute source
 * Maps directly to a single attribute on an entity type
 */
export interface NativeSource {
  type: 'native';
  attribute: string;  // e.g., 'ownerUsers'
}

/**
 * Native Atlan attribute source with multiple candidates (ANY match)
 * Field is present if ANY of the attributes has a value
 */
export interface NativeAnySource {
  type: 'native_any';
  attributes: string[];  // e.g., ['description', 'userDescription']
}

/**
 * Custom metadata source
 * Maps to a business attribute in Atlan
 */
export interface CustomMetadataSource {
  type: 'custom_metadata';
  businessAttribute: string;  // e.g., 'Privacy'
  attribute: string;          // e.g., 'piiFlag'
}

/**
 * Classification source
 * Checks for presence of classification tags
 */
export interface ClassificationSource {
  type: 'classification';
  pattern?: string;     // Regex pattern, e.g., '^PII.*'
  anyOf?: string[];     // Exact matches, e.g., ['PII', 'PHI', 'PCI']
}

/**
 * Relationship source
 * Checks for presence of relationship links
 */
export interface RelationshipSource {
  type: 'relationship';
  relation: string;     // e.g., 'meanings', 'inputToProcesses'
  direction?: 'upstream' | 'downstream' | 'any';
  countThreshold?: number;  // Minimum count to be "present"
}

/**
 * Derived field source
 * Complex logic that requires computation
 */
export interface DerivedSource {
  type: 'derived';
  derivation: string;   // Human-readable derivation rule
  // Actual compute function is registered separately
}

/**
 * Union type for all field sources
 */
export type FieldSource =
  | NativeSource
  | NativeAnySource
  | CustomMetadataSource
  | ClassificationSource
  | RelationshipSource
  | DerivedSource;

// =============================================================================
// FIELD CATEGORIES
// =============================================================================

/**
 * Categories for organizing fields
 */
export type FieldCategory =
  | 'identity'          // Name, qualified name, type
  | 'ownership'         // Owners, stewards, accountable parties
  | 'documentation'     // Description, readme, glossary terms
  | 'lineage'           // Upstream/downstream, PK/FK
  | 'classification'    // Tags, classifications, sensitivity
  | 'quality'           // DQ signals, freshness, incidents
  | 'usage'             // Popularity, query counts
  | 'governance'        // Policies, access control
  | 'hierarchy'         // Connection, database, schema
  | 'lifecycle'         // Status, retirement, lifecycle stage
  | 'custom';           // Tenant-specific extensions

// =============================================================================
// UNIFIED FIELD DEFINITION
// =============================================================================

/**
 * Signal contribution definition
 * Specifies how a field contributes to a signal
 */
export interface SignalContribution {
  signal: SignalType;
  weight: number;         // 0-1, contribution weight
  required?: boolean;     // If true, signal requires this field
  negative?: boolean;     // If true, presence is a negative indicator
}

/**
 * MDLH availability status
 */
export type MdlhAvailability = 'available' | 'missing' | 'type_mismatch' | 'no_mapping';

/**
 * Unified field definition
 * The core building block of the field catalog
 */
export interface UnifiedField {
  // Identity
  id: string;                           // Canonical field ID, e.g., 'owner_users'
  displayName: string;                  // Human-readable name
  description: string;                  // Field description
  category: FieldCategory;              // Organization category

  // Source mapping
  source: FieldSource;                  // How to get this field's value

  // Applicability
  supportedAssetTypes: string[];        // ['Table', 'View', 'Column', '*']

  // Signal contribution
  contributesToSignals: SignalContribution[];

  // Measure mapping (from binding matrix)
  measureId?: string;                   // e.g., 'coverage.owner'

  // Completeness scoring
  completenessWeight?: number;          // Weight in completeness formula

  // Use case metadata
  useCases: string[];                   // Which use cases care about this
  coreForUseCases: string[];            // Which use cases consider it "core"

  // Atlan documentation
  atlanDocsUrl?: string;
  atlanApiHint?: string;                // API hint for fetching

  // MDLH Gold Layer mapping
  mdlhColumn?: string;                  // MDLH column name, e.g., 'OWNER_USERS'
  mdlhTable?: string;                   // MDLH table/view, e.g., 'ASSETS', 'RELATIONAL_ASSET_DETAILS'
  mdlhAvailable?: MdlhAvailability;     // Availability status in MDLH schema

  // Status
  status: 'active' | 'deprecated' | 'experimental';
}

// =============================================================================
// SIGNAL DEFINITION
// =============================================================================

/**
 * Signal aggregation method
 */
export type SignalAggregation =
  | { method: 'any' }                           // Present if ANY field has value
  | { method: 'all' }                           // Present only if ALL fields have value
  | { method: 'weighted_threshold'; threshold: number };  // Weighted sum >= threshold

/**
 * Signal definition
 * Defines how fields compose into signals
 */
export interface SignalDefinition {
  id: SignalType;
  displayName: string;
  description: string;

  // Aggregation rule
  aggregation: SignalAggregation;

  // Workstream for remediation
  workstream: string;

  // Severity for gap analysis
  severity: 'HIGH' | 'MED' | 'LOW';

  // Documentation
  guidanceUrl?: string;
}

// =============================================================================
// USE CASE PROFILE
// =============================================================================

/**
 * Methodology types for scoring
 */
export type MethodologyType =
  | 'WEIGHTED_MEASURES'
  | 'WEIGHTED_DIMENSIONS'
  | 'CHECKLIST'
  | 'QTRIPLET'
  | 'MATURITY';

/**
 * Signal weight in a use case
 */
export interface UseCaseSignalWeight {
  signal: SignalType;
  weight: number;           // 0-1
  required?: boolean;       // Must pass for use case readiness
}

/**
 * Use case profile
 * Defines assessment criteria for a specific use case
 */
export interface UseCaseProfile {
  id: string;
  displayName: string;
  description: string;

  // Signal weights
  signals: UseCaseSignalWeight[];

  // Applicable asset types
  relevantAssetTypes: string[];

  // Scoring thresholds
  thresholds: {
    ready: number;          // Score >= this = "Ready"
    partial: number;        // Score >= this = "Partially Ready"
  };

  // Default methodology
  defaultMethodology: MethodologyType;

  // Documentation
  guidanceUrl?: string;
}

// =============================================================================
// WORKSTREAM DEFINITION
// =============================================================================

export interface WorkstreamDefinition {
  id: string;
  displayName: string;
  description: string;
  signals: SignalType[];
  priority: number;
}

// =============================================================================
// GAP TYPES
// =============================================================================

export type GapType = 'MISSING' | 'UNKNOWN' | 'QUALITY';
export type GapSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export interface AssessmentGap {
  signal: SignalType;
  field: string;
  gapType: GapType;
  severity: GapSeverity;
  assetCount: number;
  scope?: string;
  recommendation?: string;
}

// =============================================================================
// ASSESSMENT SCOPE & ROLLUP
// =============================================================================

/**
 * Assessment scope specification
 */
export interface AssessmentScope {
  level: 'tenant' | 'connection' | 'database' | 'schema' | 'domain' | 'asset_list';
  identifier?: string;        // qualifiedName for specific scope
  assetGuids?: string[];      // For asset_list type
}

/**
 * Rollup configuration
 */
export interface RollupConfig {
  groupBy: 'connection' | 'database' | 'schema' | 'domain' | 'owner' | 'type' | 'none';
  thenBy?: 'database' | 'schema' | 'type' | 'none';
  includeAssetDetails: boolean;
  includeGaps: boolean;
}

/**
 * Rollup node in results
 */
export interface RollupNode {
  dimension: string;
  name: string;
  qualifiedName?: string;
  metrics: {
    score: number;
    assetCount: number;
    signalScores: Partial<Record<SignalType, number>>;
  };
  children?: RollupNode[];
}

// =============================================================================
// SCORE TYPES
// =============================================================================

export interface SignalScore {
  signal: SignalType;
  score: number;          // 0-1
  state: TriState;        // true/false/UNKNOWN
  contributingFields: string[];
  missingFields: string[];
}

export interface AssetScore {
  assetGuid: string;
  assetName: string;
  assetType: string;
  overallScore: number;   // 0-100
  signalScores: SignalScore[];
  gaps: AssessmentGap[];
  quadrant: 'HIGH_IMPACT_HIGH_QUALITY' | 'HIGH_IMPACT_LOW_QUALITY' | 'LOW_IMPACT_HIGH_QUALITY' | 'LOW_IMPACT_LOW_QUALITY';
}

// =============================================================================
// HIERARCHY LEVELS
// =============================================================================

/**
 * Hierarchy levels in Atlan's data model
 */
export type HierarchyLevel =
  | 'tenant'
  | 'connection'
  | 'database'
  | 'schema'
  | 'table'
  | 'column'
  | 'domain'
  | 'glossary';

/**
 * Rollup dimension - how to aggregate results
 */
export type RollupDimension =
  | 'connection'      // Group by source connection
  | 'database'        // Group by database
  | 'schema'          // Group by schema
  | 'domain'          // Group by data domain
  | 'owner'           // Group by owner
  | 'certification'   // Group by certification status
  | 'asset_type'      // Group by asset type (Table, View, etc.)
  | 'classification'; // Group by classification tags

// =============================================================================
// EXTENDED ASSESSMENT SCOPE
// =============================================================================

/**
 * Filter criteria for scope refinement
 */
export interface ScopeFilter {
  field: string;
  operator: 'equals' | 'contains' | 'startsWith' | 'in' | 'notIn' | 'exists' | 'notExists';
  value?: string | string[] | boolean;
}

/**
 * Extended assessment scope specification for modeling tools
 */
export interface ExtendedAssessmentScope {
  /** Level of hierarchy to assess */
  level: HierarchyLevel;

  /** Identifier for the scope (qualified name, domain ID, etc.) */
  scopeId: string;

  /** Human-readable name */
  displayName?: string;

  /** Filter criteria within scope */
  filters?: ScopeFilter[];

  /** Asset types to include (default: all) */
  assetTypes?: string[];

  /** Maximum assets to sample (for large scopes) */
  sampleSize?: number;
}

// =============================================================================
// ASSET DATA
// =============================================================================

/**
 * Asset data from Atlan
 */
export interface AssetRecord {
  /** Unique asset GUID */
  guid: string;

  /** Asset type (Table, Column, etc.) */
  typeName: string;

  /** Qualified name for hierarchy */
  qualifiedName: string;

  /** Display name */
  displayName?: string;

  /** Native attributes */
  attributes: Record<string, unknown>;

  /** Custom metadata */
  customMetadata?: Record<string, Record<string, unknown>>;

  /** Classification tags */
  classifications?: string[];

  /** Hierarchy path */
  hierarchy?: HierarchyPath;
}

/**
 * Hierarchy path for an asset
 */
export interface HierarchyPath {
  connectionQualifiedName?: string;
  connectionName?: string;
  databaseQualifiedName?: string;
  databaseName?: string;
  schemaQualifiedName?: string;
  schemaName?: string;
  domainGuid?: string;
  domainName?: string;
}

// =============================================================================
// FIELD EVALUATION RESULTS
// =============================================================================

/**
 * Result of evaluating a single field on an asset
 */
export interface FieldResult {
  fieldId: string;
  fieldName: string;
  present: TriState;
  value?: unknown;
  source?: string;
  error?: string;
}

/**
 * Result of evaluating all fields on an asset
 */
export interface AssetFieldResults {
  assetGuid: string;
  assetType: string;
  qualifiedName: string;
  fields: FieldResult[];
  evaluatedAt: string;
}

// =============================================================================
// SIGNAL RESULTS
// =============================================================================

/**
 * Result of composing a signal from field results
 */
export interface SignalResult {
  signal: SignalType;
  present: TriState;
  score: number;           // 0.0 - 1.0
  confidence: number;      // 0.0 - 1.0
  contributingFields: Array<{
    fieldId: string;
    present: TriState;
    weight: number;
  }>;
}

/**
 * Complete signal profile for an asset
 */
export interface AssetSignalResults {
  assetGuid: string;
  assetType: string;
  qualifiedName: string;
  signals: SignalResult[];
  overallScore: number;
  evaluatedAt: string;
}

// =============================================================================
// USE CASE ASSESSMENT
// =============================================================================

/**
 * Assessment result for a single use case
 */
export interface UseCaseResult {
  useCaseId: string;
  useCaseName: string;
  readinessScore: number;    // 0.0 - 1.0
  readinessLevel: 'NOT_READY' | 'PARTIAL' | 'READY' | 'EXCELLENT';
  requiredSignalsMet: number;
  requiredSignalsTotal: number;
  signalScores: Array<{
    signal: SignalType;
    weight: number;
    required: boolean;
    score: number;
    met: boolean;
  }>;
  gaps: UseCaseGap[];
}

/**
 * Gap identified in use case readiness
 */
export interface UseCaseGap {
  signal: SignalType;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  description: string;
  remediation: string;
  affectedFields: string[];
  estimatedEffort?: 'LOW' | 'MEDIUM' | 'HIGH';
}

/**
 * Complete use case assessment for an asset
 */
export interface AssetUseCaseResults {
  assetGuid: string;
  assetType: string;
  qualifiedName: string;
  useCases: UseCaseResult[];
  bestReadyUseCase?: string;
  worstGapUseCase?: string;
  evaluatedAt: string;
}

// =============================================================================
// EXTENDED ROLLUP RESULTS
// =============================================================================

/**
 * Extended rollup node with full aggregation data
 */
export interface ExtendedRollupNode {
  /** Node identifier */
  id: string;

  /** Node display name */
  name: string;

  /** Dimension this node belongs to */
  dimension: RollupDimension;

  /** Value for this dimension */
  dimensionValue: string;

  /** Number of assets in this node */
  assetCount: number;

  /** Aggregated signal scores */
  signals: Record<SignalType, SignalAggregationResult>;

  /** Aggregated use case scores */
  useCases: Record<string, UseCaseAggregation>;

  /** Overall completeness score */
  completenessScore: number;

  /** Child nodes (for nested rollups) */
  children?: ExtendedRollupNode[];
}

/**
 * Aggregated signal statistics
 */
export interface SignalAggregationResult {
  signal: SignalType;
  presentCount: number;
  absentCount: number;
  unknownCount: number;
  presenceRate: number;      // 0.0 - 1.0
  averageScore: number;      // 0.0 - 1.0
  distribution: {
    excellent: number;       // score >= 0.9
    good: number;            // score >= 0.7
    fair: number;            // score >= 0.5
    poor: number;            // score < 0.5
  };
}

/**
 * Aggregated use case statistics
 */
export interface UseCaseAggregation {
  useCaseId: string;
  useCaseName: string;
  readyCount: number;
  partialCount: number;
  notReadyCount: number;
  readinessRate: number;     // 0.0 - 1.0
  averageScore: number;      // 0.0 - 1.0
  topGaps: Array<{
    signal: SignalType;
    affectedCount: number;
    percentAffected: number;
  }>;
}

// =============================================================================
// TENANT CONFIGURATION
// =============================================================================

/**
 * Mapping status
 */
export type MappingStatus = 'auto' | 'confirmed' | 'rejected' | 'pending';

/**
 * Tenant-specific field mapping
 */
export interface TenantFieldMapping {
  canonicalFieldId: string;
  tenantSource: FieldSource;
  status: MappingStatus;
  confidence?: number;
  confirmedAt?: string;
  confirmedBy?: string;
  notes?: string;
}

/**
 * Tenant-defined custom field
 */
export interface TenantCustomField {
  id: string;
  displayName: string;
  description?: string;
  tenantSource: FieldSource;
  contributesToSignals: SignalContribution[];
  completenessWeight?: number;
  createdAt: string;
  createdBy?: string;
}

/**
 * Classification to signal mapping
 */
export interface TenantClassificationMapping {
  pattern: string;
  signal: SignalType;
  indicatorType: 'positive' | 'negative';
  confirmedAt?: string;
}

/**
 * Complete tenant configuration
 */
export interface TenantConfiguration {
  tenantId: string;
  baseUrl: string;
  version: number;
  createdAt: string;
  updatedAt: string;
  updatedBy?: string;

  // Field mappings from canonical fields to tenant sources
  fieldMappings: TenantFieldMapping[];

  // Tenant-defined extensions
  customFields: TenantCustomField[];

  // Classification mappings
  classificationMappings: TenantClassificationMapping[];

  // Fields explicitly excluded from assessment
  excludedFields: string[];

  // Snapshot reference
  lastSnapshotAt?: string;
}

// =============================================================================
// ASSESSMENT REQUEST & OPTIONS
// =============================================================================

/**
 * Complete assessment request
 */
export interface AssessmentRequest {
  /** Unique request ID */
  requestId: string;

  /** Tenant configuration to use */
  tenantConfig: TenantConfiguration;

  /** Scope to assess */
  scope: ExtendedAssessmentScope;

  /** Use cases to evaluate (default: all applicable) */
  useCases?: string[];

  /** Rollup dimensions for aggregation */
  rollupDimensions?: RollupDimension[];

  /** Scoring methodology to use */
  methodology?: MethodologyType;

  /** Include evidence in results */
  includeEvidence?: boolean;

  /** Include recommendations */
  includeRecommendations?: boolean;
}

/**
 * Options for assessment execution
 */
export interface AssessmentOptions {
  /** Parallel asset evaluation batch size */
  batchSize?: number;

  /** Timeout per batch in ms */
  batchTimeoutMs?: number;

  /** Progress callback */
  onProgress?: (progress: AssessmentProgress) => void;

  /** Error handling strategy */
  onError?: 'fail' | 'skip' | 'warn';
}

/**
 * Assessment progress update
 */
export interface AssessmentProgress {
  phase: 'FETCHING' | 'EVALUATING' | 'COMPOSING' | 'ROLLING_UP' | 'COMPLETE';
  assetsProcessed: number;
  assetsTotal: number;
  percentComplete: number;
  currentBatch?: number;
  totalBatches?: number;
  elapsedMs: number;
  estimatedRemainingMs?: number;
}

// =============================================================================
// ASSESSMENT RESULT
// =============================================================================

/**
 * Assessment recommendation
 */
export interface AssessmentRecommendation {
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  category: 'SIGNAL_GAP' | 'USE_CASE_GAP' | 'COVERAGE_GAP' | 'CONFIGURATION';
  title: string;
  description: string;
  affectedSignals?: SignalType[];
  affectedUseCases?: string[];
  estimatedImpact: {
    assetsAffected: number;
    scoreImprovement: number;
  };
  remediation: {
    steps: string[];
    effort: 'LOW' | 'MEDIUM' | 'HIGH';
    owner?: string;
  };
}

/**
 * Complete assessment result
 */
export interface AssessmentResult {
  /** Request that generated this result */
  request: AssessmentRequest;

  /** Assessment metadata */
  metadata: {
    assessedAt: string;
    durationMs: number;
    totalAssets: number;
    sampledAssets: number;
    scope: ExtendedAssessmentScope;
  };

  /** Summary statistics */
  summary: {
    overallScore: number;
    signalCoverage: Record<SignalType, number>;
    useCaseReadiness: Record<string, number>;
    topGaps: UseCaseGap[];
    adoptionPhase: 'FOUNDATION' | 'EXPANSION' | 'OPTIMIZATION' | 'EXCELLENCE';
  };

  /** Rollup results by dimension */
  rollups: Record<RollupDimension, ExtendedRollupNode[]>;

  /** Detailed asset results (if requested) */
  assetDetails?: AssetUseCaseResults[];

  /** Recommendations (if requested) */
  recommendations?: AssessmentRecommendation[];
}

// =============================================================================
// ASSET FETCHER INTERFACE
// =============================================================================

/**
 * Interface for fetching assets from Atlan
 * Implementations can use different strategies (API, cache, mock)
 */
export interface AssetFetcher {
  /**
   * Fetch assets within a scope
   */
  fetchAssets(
    scope: ExtendedAssessmentScope,
    tenantConfig: TenantConfiguration
  ): Promise<AssetRecord[]>;

  /**
   * Fetch a single asset by GUID
   */
  fetchAsset(
    guid: string,
    tenantConfig: TenantConfiguration
  ): Promise<AssetRecord | null>;

  /**
   * Get total count of assets in scope (for sampling decisions)
   */
  countAssets(
    scope: ExtendedAssessmentScope,
    tenantConfig: TenantConfiguration
  ): Promise<number>;
}
