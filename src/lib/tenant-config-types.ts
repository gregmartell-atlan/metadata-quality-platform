// Tenant Configuration Types

export type MappingStatus = 'auto' | 'confirmed' | 'rejected' | 'pending';

export type ReconciliationStatus =
  | 'MATCHED'
  | 'ALIAS_MATCHED'
  | 'CM_MATCHED'
  | 'CM_SUGGESTED'
  | 'CLASSIFICATION'
  | 'NOT_FOUND'
  | 'AMBIGUOUS';

export interface FieldSource {
  type: 'native' | 'native_any' | 'custom_metadata' | 'classification' | 'relationship' | 'derived';
  [key: string]: unknown;
}

export interface TenantFieldMapping {
  canonicalFieldId: string;
  canonicalFieldName: string;
  tenantSource?: FieldSource;
  status: MappingStatus;
  reconciliationStatus?: ReconciliationStatus;
  confidence?: number;
  confirmedAt?: string;
  confirmedBy?: string;
  notes?: string;
}

export interface TenantCustomField {
  id: string;
  displayName: string;
  description?: string;
  tenantSource: FieldSource;
  contributesToSignals: Array<{ signal: string; weight: number }>;
  createdAt: string;
  createdBy?: string;
}

export interface ClassificationMapping {
  pattern: string;
  signal: string;
  indicatorType: 'positive' | 'negative';
  confirmedAt?: string;
}

export interface TenantConfig {
  tenantId: string;
  baseUrl: string;
  version: number;
  createdAt: string;
  updatedAt: string;
  fieldMappings: TenantFieldMapping[];
  customFields: TenantCustomField[];
  classificationMappings: ClassificationMapping[];
  excludedFields: string[];
  lastSnapshotAt?: string;
}

export interface ClassificationNameMap {
  hashToDisplay: Record<string, string>;
  displayToHash: Record<string, string>;
}

export interface SchemaSnapshot {
  tenantId: string;
  discoveredAt: string;
  entityTypes: Array<{
    name: string;
    description?: string;
    superTypes: string[];
    attributes: Array<{
      name: string;
      typeName: string;
      description?: string;
      isOptional: boolean;
      cardinality: string;
    }>;
  }>;
  nativeAttributes: string[];
  customMetadata: Array<{
    name: string;
    displayName: string;
    attributes: Array<{
      name: string;
      displayName: string;
      type: string;
    }>;
  }>;
  classifications: Array<{
    name: string;
    displayName: string;
    description?: string;
  }>;
  classificationNameMap?: ClassificationNameMap;
  domains: Array<{
    guid: string;
    name: string;
  }>;
}

export interface DiscoveryProgress {
  phase: 'idle' | 'discovering' | 'reconciling' | 'complete' | 'error';
  message?: string;
}

export interface ConfigCompleteness {
  score: number;
  confirmed: number;
  auto: number;
  pending: number;
  rejected: number;
  excluded: number;
}

// Storage key for localStorage
export const TENANT_CONFIG_STORAGE_KEY = 'tenant_config';
export const SCHEMA_SNAPSHOT_STORAGE_KEY = 'schema_snapshot';

// Helper functions
export function loadTenantConfig(): TenantConfig | null {
  try {
    const saved = localStorage.getItem(TENANT_CONFIG_STORAGE_KEY);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (e) {
    console.error('Failed to load tenant config:', e);
  }
  return null;
}

export function saveTenantConfig(config: TenantConfig): void {
  try {
    localStorage.setItem(TENANT_CONFIG_STORAGE_KEY, JSON.stringify(config));
  } catch (e) {
    console.error('Failed to save tenant config:', e);
  }
}

export function loadSchemaSnapshot(): SchemaSnapshot | null {
  try {
    const saved = localStorage.getItem(SCHEMA_SNAPSHOT_STORAGE_KEY);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (e) {
    console.error('Failed to load schema snapshot:', e);
  }
  return null;
}

export function saveSchemaSnapshot(snapshot: SchemaSnapshot): void {
  try {
    localStorage.setItem(SCHEMA_SNAPSHOT_STORAGE_KEY, JSON.stringify(snapshot));
  } catch (e) {
    console.error('Failed to save schema snapshot:', e);
  }
}

export function calculateCompleteness(config: TenantConfig): ConfigCompleteness {
  const mappings = config.fieldMappings;
  const total = mappings.length;

  if (total === 0) {
    return {
      score: 0,
      confirmed: 0,
      auto: 0,
      pending: 0,
      rejected: 0,
      excluded: config.excludedFields.length,
    };
  }

  const confirmed = mappings.filter(m => m.status === 'confirmed').length;
  const auto = mappings.filter(m => m.status === 'auto').length;
  const pending = mappings.filter(m => m.status === 'pending').length;
  const rejected = mappings.filter(m => m.status === 'rejected').length;

  const resolvedCount = confirmed + auto;
  const score = resolvedCount / total;

  return {
    score,
    confirmed,
    auto,
    pending,
    rejected,
    excluded: config.excludedFields.length,
  };
}

export function createDefaultConfig(tenantId: string, baseUrl: string): TenantConfig {
  return {
    tenantId,
    baseUrl,
    version: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    fieldMappings: [],
    customFields: [],
    classificationMappings: [],
    excludedFields: [],
  };
}

// =============================================================================
// MDLH SCHEMA RECONCILIATION TYPES
// =============================================================================

/**
 * MDLH schema column from Snowflake INFORMATION_SCHEMA
 */
export interface MdlhSchemaColumn {
  tableName: string;        // e.g., 'ASSETS', 'RELATIONAL_ASSET_DETAILS'
  columnName: string;       // e.g., 'OWNER_USERS', 'DESCRIPTION'
  dataType: string;         // e.g., 'VARCHAR', 'ARRAY', 'NUMBER(19,0)'
  isNullable: boolean;
  comment: string | null;
}

/**
 * Field reconciliation status
 */
export type MdlhReconciliationStatus = 'available' | 'missing' | 'type_mismatch' | 'no_mapping';

/**
 * Single field reconciliation result
 */
export interface FieldReconciliation {
  fieldId: string;                       // Canonical field ID (e.g., 'owner_users')
  fieldName: string;                     // Display name (e.g., 'Owner Users')
  category: string;                      // Field category (e.g., 'ownership')
  expectedMdlhColumn: string | null;     // Expected MDLH column (e.g., 'OWNER_USERS')
  expectedMdlhTable: string | null;      // Expected MDLH table (e.g., 'ASSETS')
  actualMdlhColumn: MdlhSchemaColumn | null;  // Actual column from schema introspection
  status: MdlhReconciliationStatus;      // Reconciliation status
}

/**
 * Summary of reconciliation results
 */
export interface ReconciliationSummary {
  totalExpected: number;                 // Total fields with MDLH mapping defined
  available: number;                     // Fields found in MDLH schema
  missing: number;                       // Fields not found in MDLH schema
  typeMismatch: number;                  // Fields with type mismatches
  noMapping: number;                     // Fields without MDLH mapping defined
  byCategory: Record<string, {
    expected: number;
    available: number;
    missing: number;
  }>;
  byTable: Record<string, {
    expected: number;
    available: number;
    missing: number;
  }>;
}

/**
 * Complete MDLH schema introspection result
 */
export interface MdlhSchemaResult {
  discoveredAt: string;
  columns: MdlhSchemaColumn[];
  reconciliation: FieldReconciliation[];
  summary: ReconciliationSummary;
}

/**
 * MDLH Gold Layer table/view metadata
 */
export interface MdlhTableInfo {
  name: string;                          // Table/view name
  type: 'TABLE' | 'VIEW';
  description: string | null;
  columnCount: number;
  usedByCode: boolean;                   // Whether the codebase uses this table
}

/**
 * Storage key for MDLH schema cache
 */
export const MDLH_SCHEMA_STORAGE_KEY = 'mdlh_schema_cache';

/**
 * Load cached MDLH schema from localStorage
 */
export function loadMdlhSchemaCache(): MdlhSchemaResult | null {
  try {
    const saved = localStorage.getItem(MDLH_SCHEMA_STORAGE_KEY);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (e) {
    console.error('Failed to load MDLH schema cache:', e);
  }
  return null;
}

/**
 * Save MDLH schema to localStorage cache
 */
export function saveMdlhSchemaCache(schema: MdlhSchemaResult): void {
  try {
    localStorage.setItem(MDLH_SCHEMA_STORAGE_KEY, JSON.stringify(schema));
  } catch (e) {
    console.error('Failed to save MDLH schema cache:', e);
  }
}
