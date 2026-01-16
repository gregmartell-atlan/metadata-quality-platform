/**
 * Unified Field Catalog
 *
 * Single source of truth for all assessable metadata fields.
 * Each field defines:
 * - How to source its value from Atlan (native, CM, classification, derived)
 * - Which signals it contributes to
 * - Which use cases care about it
 * - Scoring weights for completeness calculation
 *
 * Ported from atlan-metadata-evaluation/assessment/packages/domain
 */

import type { UnifiedField } from './types';

// =============================================================================
// OWNERSHIP FIELDS
// =============================================================================

const ownershipFields: UnifiedField[] = [
  {
    id: 'owner_users',
    displayName: 'Owner Users',
    description: 'Individual users accountable for the asset.',
    category: 'ownership',
    source: { type: 'native', attribute: 'ownerUsers' },
    supportedAssetTypes: ['*'],
    contributesToSignals: [
      { signal: 'OWNERSHIP', weight: 1.0 },
    ],
    measureId: 'coverage.owner',
    completenessWeight: 20,
    useCases: ['*'],
    coreForUseCases: ['self_service_discovery', 'data_governance', 'ai_agents'],
    atlanDocsUrl: 'https://solutions.atlan.com/asset-export-basic/',
    atlanApiHint: 'IndexSearch includeAttributes ownerUsers',
    status: 'active',
  },
  {
    id: 'owner_groups',
    displayName: 'Owner Groups',
    description: 'Teams or groups accountable for the asset.',
    category: 'ownership',
    source: { type: 'native', attribute: 'ownerGroups' },
    supportedAssetTypes: ['*'],
    contributesToSignals: [
      { signal: 'OWNERSHIP', weight: 1.0 },
    ],
    measureId: 'coverage.owner',
    useCases: ['*'],
    coreForUseCases: ['data_governance'],
    atlanDocsUrl: 'https://solutions.atlan.com/asset-export-basic/',
    atlanApiHint: 'IndexSearch includeAttributes ownerGroups',
    status: 'active',
  },
  {
    id: 'steward_users',
    displayName: 'Steward Users',
    description: 'Stewards responsible for metadata quality for the asset.',
    category: 'ownership',
    source: { type: 'native', attribute: 'adminUsers' },
    supportedAssetTypes: ['Table', 'View', 'Column', 'AtlasGlossaryTerm'],
    contributesToSignals: [
      { signal: 'OWNERSHIP', weight: 0.5 },
    ],
    useCases: ['data_governance', 'dsar_retention'],
    coreForUseCases: [],
    status: 'active',
  },
  {
    id: 'steward_groups',
    displayName: 'Steward Groups',
    description: 'Groups responsible for metadata stewardship.',
    category: 'ownership',
    source: { type: 'native', attribute: 'adminGroups' },
    supportedAssetTypes: ['Table', 'View', 'Column', 'AtlasGlossaryTerm'],
    contributesToSignals: [
      { signal: 'OWNERSHIP', weight: 0.5 },
    ],
    useCases: ['data_governance'],
    coreForUseCases: [],
    status: 'active',
  },
];

// =============================================================================
// DOCUMENTATION / SEMANTICS FIELDS
// =============================================================================

const documentationFields: UnifiedField[] = [
  {
    id: 'description',
    displayName: 'Description',
    description: 'Short prose description of the asset\'s purpose.',
    category: 'documentation',
    source: { type: 'native_any', attributes: ['description', 'userDescription'] },
    supportedAssetTypes: ['*'],
    contributesToSignals: [
      { signal: 'SEMANTICS', weight: 1.0 },
    ],
    measureId: 'coverage.asset_description',
    completenessWeight: 15,
    useCases: ['*'],
    coreForUseCases: ['self_service_discovery', 'rag', 'text_to_sql', 'ai_agents'],
    atlanDocsUrl: 'https://solutions.atlan.com/asset-export-basic/',
    atlanApiHint: 'IndexSearch includeAttributes description, userDescription',
    status: 'active',
  },
  {
    id: 'readme',
    displayName: 'README / Documentation',
    description: 'Long-form documentation including examples and caveats.',
    category: 'documentation',
    source: { type: 'relationship', relation: 'readme' },
    supportedAssetTypes: ['Table', 'View', 'Database', 'Schema', 'Dashboard'],
    contributesToSignals: [
      { signal: 'SEMANTICS', weight: 0.8 },
    ],
    measureId: 'coverage.runbook',
    completenessWeight: 10,
    useCases: ['self_service_discovery', 'rag', 'ai_agents'],
    coreForUseCases: [],
    atlanDocsUrl: 'https://solutions.atlan.com/asset-import/',
    atlanApiHint: 'IndexSearch includeAttributes readme (Readme relationship)',
    status: 'active',
  },
  {
    id: 'glossary_terms',
    displayName: 'Linked Glossary Terms',
    description: 'Business glossary terms linked to the asset.',
    category: 'documentation',
    source: { type: 'relationship', relation: 'meanings' },
    supportedAssetTypes: ['Table', 'View', 'Column', 'Dashboard'],
    contributesToSignals: [
      { signal: 'SEMANTICS', weight: 0.6 },
    ],
    completenessWeight: 10,
    useCases: ['business_glossary', 'text_to_sql', 'self_service_discovery'],
    coreForUseCases: ['business_glossary'],
    atlanDocsUrl: 'https://solutions.atlan.com/enrichment_report/',
    atlanApiHint: 'IndexSearch include relationAttributes meanings',
    status: 'active',
  },
];

// =============================================================================
// LINEAGE FIELDS
// =============================================================================

const lineageFields: UnifiedField[] = [
  {
    id: 'has_lineage',
    displayName: 'Has Lineage',
    description: 'Asset has upstream or downstream lineage documented.',
    category: 'lineage',
    source: { type: 'native', attribute: '__hasLineage' },
    supportedAssetTypes: ['Table', 'View', 'Column', 'MaterialisedView'],
    contributesToSignals: [
      { signal: 'LINEAGE', weight: 1.0 },
    ],
    measureId: 'coverage.lineage',
    useCases: ['rag', 'ai_agents', 'impact_analysis', 'rca'],
    coreForUseCases: ['impact_analysis', 'rca'],
    atlanDocsUrl: 'https://developer.atlan.com/models/',
    atlanApiHint: 'IndexSearch includeAttributes __hasLineage',
    status: 'active',
  },
  {
    id: 'upstream_assets',
    displayName: 'Upstream Assets',
    description: 'Assets that feed data into this asset.',
    category: 'lineage',
    source: { type: 'relationship', relation: 'inputToProcesses', direction: 'upstream' },
    supportedAssetTypes: ['Table', 'View', 'Column', 'MaterialisedView'],
    contributesToSignals: [
      { signal: 'LINEAGE', weight: 0.7 },
    ],
    useCases: ['rca', 'impact_analysis'],
    coreForUseCases: [],
    status: 'active',
  },
  {
    id: 'downstream_assets',
    displayName: 'Downstream Assets',
    description: 'Assets that consume data from this asset.',
    category: 'lineage',
    source: { type: 'relationship', relation: 'outputFromProcesses', direction: 'downstream' },
    supportedAssetTypes: ['Table', 'View', 'Column', 'MaterialisedView'],
    contributesToSignals: [
      { signal: 'LINEAGE', weight: 0.7 },
    ],
    useCases: ['rca', 'impact_analysis'],
    coreForUseCases: [],
    status: 'active',
  },
  {
    id: 'is_primary_key',
    displayName: 'Is Primary Key',
    description: 'Column is part of the primary key.',
    category: 'lineage',
    source: { type: 'native', attribute: 'isPrimary' },
    supportedAssetTypes: ['Column'],
    contributesToSignals: [
      { signal: 'LINEAGE', weight: 0.5 },
    ],
    measureId: 'coverage.joinability',
    useCases: ['text_to_sql', 'data_modeling'],
    coreForUseCases: ['text_to_sql'],
    status: 'active',
  },
  {
    id: 'is_foreign_key',
    displayName: 'Is Foreign Key',
    description: 'Column participates in a foreign key relationship.',
    category: 'lineage',
    source: { type: 'native', attribute: 'isForeign' },
    supportedAssetTypes: ['Column'],
    contributesToSignals: [
      { signal: 'LINEAGE', weight: 0.5 },
    ],
    measureId: 'coverage.joinability',
    useCases: ['text_to_sql', 'data_modeling'],
    coreForUseCases: ['text_to_sql'],
    status: 'active',
  },
  {
    id: 'foreign_key_from',
    displayName: 'Foreign Key Reference',
    description: 'Column references another column via foreign key.',
    category: 'lineage',
    source: { type: 'relationship', relation: 'foreignKeyFrom' },
    supportedAssetTypes: ['Column'],
    contributesToSignals: [
      { signal: 'LINEAGE', weight: 0.5 },
    ],
    measureId: 'coverage.joinability',
    useCases: ['text_to_sql', 'data_modeling'],
    coreForUseCases: [],
    status: 'active',
  },
];

// =============================================================================
// CLASSIFICATION / SENSITIVITY FIELDS
// =============================================================================

const classificationFields: UnifiedField[] = [
  {
    id: 'classifications',
    displayName: 'Classifications',
    description: 'Classification tags applied to the asset.',
    category: 'classification',
    source: { type: 'native', attribute: 'classificationNames' },
    supportedAssetTypes: ['*'],
    contributesToSignals: [
      { signal: 'SENSITIVITY', weight: 1.0 },
    ],
    completenessWeight: 5,
    useCases: ['dsar_retention', 'data_governance', 'ai_agents'],
    coreForUseCases: ['dsar_retention'],
    atlanDocsUrl: 'https://solutions.atlan.com/metadata_propagator/',
    atlanApiHint: 'IndexSearch includeAttributes classificationNames',
    status: 'active',
  },
  {
    id: 'has_pii',
    displayName: 'Has PII Classification',
    description: 'Asset has PII classification applied.',
    category: 'classification',
    source: { type: 'classification', pattern: '^PII' },
    supportedAssetTypes: ['Table', 'View', 'Column'],
    contributesToSignals: [
      { signal: 'SENSITIVITY', weight: 1.0 },
    ],
    useCases: ['dsar_retention', 'privacy_compliance'],
    coreForUseCases: ['dsar_retention'],
    status: 'active',
  },
  {
    id: 'has_phi',
    displayName: 'Has PHI Classification',
    description: 'Asset has PHI (Protected Health Information) classification.',
    category: 'classification',
    source: { type: 'classification', anyOf: ['PHI', 'ProtectedHealthInformation'] },
    supportedAssetTypes: ['Table', 'View', 'Column'],
    contributesToSignals: [
      { signal: 'SENSITIVITY', weight: 1.0 },
    ],
    useCases: ['dsar_retention', 'privacy_compliance'],
    coreForUseCases: [],
    status: 'active',
  },
];

// =============================================================================
// ACCESS / GOVERNANCE FIELDS
// =============================================================================

const accessFields: UnifiedField[] = [
  {
    id: 'policy_count',
    displayName: 'Policy Count',
    description: 'Number of access policies applied to the asset.',
    category: 'governance',
    source: { type: 'native', attribute: 'assetPoliciesCount' },
    supportedAssetTypes: ['Table', 'View', 'Column', 'MaterialisedView'],
    contributesToSignals: [
      { signal: 'ACCESS', weight: 1.0 },
    ],
    measureId: 'policy.protection',
    useCases: ['ai_agents', 'dsar_retention', 'data_governance'],
    coreForUseCases: ['dsar_retention'],
    atlanDocsUrl: 'https://developer.atlan.com/models/',
    atlanApiHint: 'IndexSearch includeAttributes assetPoliciesCount, assetPolicyGUIDs',
    status: 'active',
  },
  {
    id: 'policy_guids',
    displayName: 'Policy GUIDs',
    description: 'GUIDs of access policies applied to the asset.',
    category: 'governance',
    source: { type: 'native', attribute: 'assetPolicyGUIDs' },
    supportedAssetTypes: ['Table', 'View', 'Column', 'MaterialisedView'],
    contributesToSignals: [
      { signal: 'ACCESS', weight: 0.5 },
    ],
    measureId: 'policy.protection',
    useCases: ['ai_agents', 'dsar_retention'],
    coreForUseCases: [],
    status: 'active',
  },
  {
    id: 'non_compliant_policies',
    displayName: 'Non-Compliant Policy GUIDs',
    description: 'GUIDs of policies that are non-compliant.',
    category: 'governance',
    source: { type: 'native', attribute: 'nonCompliantAssetPolicyGUIDs' },
    supportedAssetTypes: ['Table', 'View', 'Column', 'MaterialisedView'],
    contributesToSignals: [
      { signal: 'ACCESS', weight: -0.5, negative: true },
    ],
    measureId: 'policy.protection',
    useCases: ['dsar_retention', 'data_governance'],
    coreForUseCases: [],
    status: 'active',
  },
];

// =============================================================================
// QUALITY / FRESHNESS FIELDS
// =============================================================================

const qualityFields: UnifiedField[] = [
  {
    id: 'dq_soda_status',
    displayName: 'Soda DQ Status',
    description: 'Data quality status from Soda integration.',
    category: 'quality',
    source: { type: 'native', attribute: 'assetSodaDQStatus' },
    supportedAssetTypes: ['Table', 'View', 'MaterialisedView'],
    contributesToSignals: [
      { signal: 'QUALITY', weight: 1.0 },
      { signal: 'FRESHNESS', weight: 0.5 },
    ],
    measureId: 'coverage.dq_signals',
    useCases: ['rag', 'ai_agents', 'data_governance'],
    coreForUseCases: [],
    atlanDocsUrl: 'https://developer.atlan.com/models/',
    atlanApiHint: 'IndexSearch includeAttributes assetSodaDQStatus, assetSodaCheckCount',
    status: 'active',
  },
  {
    id: 'dq_soda_check_count',
    displayName: 'Soda Check Count',
    description: 'Number of Soda DQ checks configured.',
    category: 'quality',
    source: { type: 'native', attribute: 'assetSodaCheckCount' },
    supportedAssetTypes: ['Table', 'View', 'MaterialisedView'],
    contributesToSignals: [
      { signal: 'QUALITY', weight: 0.8 },
    ],
    measureId: 'coverage.dq_signals',
    useCases: ['data_governance'],
    coreForUseCases: [],
    status: 'active',
  },
  {
    id: 'dq_soda_last_scan',
    displayName: 'Soda Last Scan',
    description: 'Timestamp of last Soda scan.',
    category: 'quality',
    source: { type: 'native', attribute: 'assetSodaLastScanAt' },
    supportedAssetTypes: ['Table', 'View', 'MaterialisedView'],
    contributesToSignals: [
      { signal: 'FRESHNESS', weight: 1.0 },
    ],
    measureId: 'quality.freshness_sla',
    useCases: ['rag', 'ai_agents'],
    coreForUseCases: [],
    status: 'active',
  },
  {
    id: 'dq_anomalo_status',
    displayName: 'Anomalo DQ Status',
    description: 'Data quality status from Anomalo integration.',
    category: 'quality',
    source: { type: 'native', attribute: 'assetAnomaloDQStatus' },
    supportedAssetTypes: ['Table', 'View', 'MaterialisedView'],
    contributesToSignals: [
      { signal: 'QUALITY', weight: 1.0 },
    ],
    measureId: 'coverage.dq_signals',
    useCases: ['data_governance'],
    coreForUseCases: [],
    status: 'active',
  },
  {
    id: 'mc_is_monitored',
    displayName: 'Monte Carlo Monitored',
    description: 'Asset is monitored by Monte Carlo.',
    category: 'quality',
    source: { type: 'native', attribute: 'assetMcIsMonitored' },
    supportedAssetTypes: ['Table', 'View', 'MaterialisedView'],
    contributesToSignals: [
      { signal: 'QUALITY', weight: 1.0 },
      { signal: 'FRESHNESS', weight: 0.5 },
    ],
    measureId: 'coverage.dq_signals',
    useCases: ['data_governance'],
    coreForUseCases: [],
    status: 'active',
  },
  {
    id: 'mc_incident_count',
    displayName: 'Monte Carlo Incidents',
    description: 'Number of active Monte Carlo incidents.',
    category: 'quality',
    source: { type: 'derived', derivation: 'Length of assetMcIncidentQualifiedNames array' },
    supportedAssetTypes: ['Table', 'View', 'MaterialisedView'],
    contributesToSignals: [
      { signal: 'QUALITY', weight: -0.5, negative: true },
    ],
    measureId: 'quality.incident_free',
    useCases: ['data_governance', 'rca'],
    coreForUseCases: [],
    status: 'active',
  },
];

// =============================================================================
// USAGE FIELDS
// =============================================================================

const usageFields: UnifiedField[] = [
  {
    id: 'popularity_score',
    displayName: 'Popularity Score',
    description: 'Popularity score based on query frequency.',
    category: 'usage',
    source: { type: 'native', attribute: 'popularityScore' },
    supportedAssetTypes: ['Table', 'View', 'Column', 'MaterialisedView'],
    contributesToSignals: [
      { signal: 'USAGE', weight: 1.0 },
    ],
    measureId: 'coverage.usage_telemetry',
    useCases: ['self_service_discovery', 'cost_optimization'],
    coreForUseCases: [],
    atlanDocsUrl: 'https://developer.atlan.com/models/',
    atlanApiHint: 'IndexSearch includeAttributes popularityScore, queryCount, queryUserCount',
    status: 'active',
  },
  {
    id: 'query_count',
    displayName: 'Query Count',
    description: 'Number of queries accessing this asset.',
    category: 'usage',
    source: { type: 'native', attribute: 'queryCount' },
    supportedAssetTypes: ['Table', 'View', 'Column', 'MaterialisedView'],
    contributesToSignals: [
      { signal: 'USAGE', weight: 0.8 },
    ],
    measureId: 'coverage.usage_telemetry',
    useCases: ['cost_optimization'],
    coreForUseCases: [],
    status: 'active',
  },
  {
    id: 'query_user_count',
    displayName: 'Query User Count',
    description: 'Number of unique users querying this asset.',
    category: 'usage',
    source: { type: 'native', attribute: 'queryUserCount' },
    supportedAssetTypes: ['Table', 'View', 'Column', 'MaterialisedView'],
    contributesToSignals: [
      { signal: 'USAGE', weight: 0.6 },
    ],
    measureId: 'coverage.usage_telemetry',
    useCases: ['cost_optimization'],
    coreForUseCases: [],
    status: 'active',
  },
];

// =============================================================================
// TRUST / CERTIFICATION FIELDS
// =============================================================================

const trustFields: UnifiedField[] = [
  {
    id: 'certificate_status',
    displayName: 'Certificate Status',
    description: 'Governance certificate status of the asset.',
    category: 'governance',
    source: { type: 'native', attribute: 'certificateStatus' },
    supportedAssetTypes: ['*'],
    contributesToSignals: [
      { signal: 'TRUST', weight: 1.0 },
    ],
    measureId: 'coverage.certified',
    completenessWeight: 25,
    useCases: ['*'],
    coreForUseCases: ['data_governance'],
    atlanDocsUrl: 'https://solutions.atlan.com/asset-export-basic/',
    atlanApiHint: 'IndexSearch includeAttributes certificateStatus',
    status: 'active',
  },
  {
    id: 'certificate_status_message',
    displayName: 'Certificate Message',
    description: 'Message explaining the certificate status.',
    category: 'governance',
    source: { type: 'native', attribute: 'certificateStatusMessage' },
    supportedAssetTypes: ['*'],
    contributesToSignals: [],
    useCases: ['data_governance'],
    coreForUseCases: [],
    status: 'active',
  },
];

// =============================================================================
// HIERARCHY FIELDS
// =============================================================================

const hierarchyFields: UnifiedField[] = [
  {
    id: 'connection_name',
    displayName: 'Connection Name',
    description: 'Logical Atlan connection name for the source system.',
    category: 'hierarchy',
    source: { type: 'native', attribute: 'connectionName' },
    supportedAssetTypes: ['Database', 'Schema', 'Table', 'View', 'Column'],
    contributesToSignals: [],
    useCases: ['*'],
    coreForUseCases: [],
    atlanDocsUrl: 'https://developer.atlan.com/models/',
    status: 'active',
  },
  {
    id: 'database_name',
    displayName: 'Database Name',
    description: 'Physical database or catalog name.',
    category: 'hierarchy',
    source: { type: 'native', attribute: 'databaseName' },
    supportedAssetTypes: ['Schema', 'Table', 'View', 'Column'],
    contributesToSignals: [],
    useCases: ['*'],
    coreForUseCases: [],
    atlanDocsUrl: 'https://developer.atlan.com/models/entities/catalog/',
    status: 'active',
  },
  {
    id: 'schema_name',
    displayName: 'Schema Name',
    description: 'Schema name in the database.',
    category: 'hierarchy',
    source: { type: 'native', attribute: 'schemaName' },
    supportedAssetTypes: ['Table', 'View', 'Column'],
    contributesToSignals: [],
    useCases: ['*'],
    coreForUseCases: [],
    atlanDocsUrl: 'https://solutions.atlan.com/relational-assets-builder/',
    status: 'active',
  },
  {
    id: 'domain_guids',
    displayName: 'Domain GUIDs',
    description: 'Business domains this asset belongs to.',
    category: 'hierarchy',
    source: { type: 'native_any', attributes: ['domainGUIDs', '__domainGUIDs'] },
    supportedAssetTypes: ['*'],
    contributesToSignals: [],
    useCases: ['data_products', 'data_governance'],
    coreForUseCases: ['data_products'],
    status: 'active',
  },
];

// =============================================================================
// IDENTITY FIELDS
// =============================================================================

const identityFields: UnifiedField[] = [
  {
    id: 'name',
    displayName: 'Name',
    description: 'Human-readable display name of the asset.',
    category: 'identity',
    source: { type: 'native', attribute: 'name' },
    supportedAssetTypes: ['*'],
    contributesToSignals: [],
    useCases: ['*'],
    coreForUseCases: ['*'],
    atlanDocsUrl: 'https://solutions.atlan.com/asset-export-basic/',
    status: 'active',
  },
  {
    id: 'qualified_name',
    displayName: 'Qualified Name',
    description: 'Globally-unique technical identifier for the asset.',
    category: 'identity',
    source: { type: 'native', attribute: 'qualifiedName' },
    supportedAssetTypes: ['*'],
    contributesToSignals: [],
    useCases: ['*'],
    coreForUseCases: ['*'],
    atlanDocsUrl: 'https://developer.atlan.com/models/',
    status: 'active',
  },
  {
    id: 'type_name',
    displayName: 'Type Name',
    description: 'Atlan entity type name.',
    category: 'identity',
    source: { type: 'native', attribute: 'typeName' },
    supportedAssetTypes: ['*'],
    contributesToSignals: [],
    useCases: ['*'],
    coreForUseCases: [],
    status: 'active',
  },
  {
    id: 'guid',
    displayName: 'GUID',
    description: 'Globally unique identifier.',
    category: 'identity',
    source: { type: 'native', attribute: 'guid' },
    supportedAssetTypes: ['*'],
    contributesToSignals: [],
    useCases: ['*'],
    coreForUseCases: [],
    status: 'active',
  },
];

// =============================================================================
// LIFECYCLE FIELDS
// =============================================================================

const lifecycleFields: UnifiedField[] = [
  {
    id: 'created_at',
    displayName: 'Created At',
    description: 'Timestamp when the asset was created in Atlan.',
    category: 'lifecycle',
    source: { type: 'native', attribute: '__timestamp' },
    supportedAssetTypes: ['*'],
    contributesToSignals: [],
    useCases: ['auditing', 'lifecycle'],
    coreForUseCases: [],
    atlanDocsUrl: 'https://solutions.atlan.com/asset-export-basic/',
    status: 'active',
  },
  {
    id: 'updated_at',
    displayName: 'Updated At',
    description: 'Timestamp when the asset was last updated.',
    category: 'lifecycle',
    source: { type: 'native', attribute: '__modificationTimestamp' },
    supportedAssetTypes: ['*'],
    contributesToSignals: [],
    useCases: ['auditing', 'rca'],
    coreForUseCases: [],
    status: 'active',
  },
  {
    id: 'created_by',
    displayName: 'Created By',
    description: 'User who created the asset in Atlan.',
    category: 'lifecycle',
    source: { type: 'native', attribute: '__createdBy' },
    supportedAssetTypes: ['*'],
    contributesToSignals: [],
    useCases: ['auditing', 'data_governance'],
    coreForUseCases: [],
    status: 'active',
  },
  {
    id: 'updated_by',
    displayName: 'Updated By',
    description: 'User who last updated the asset\'s metadata.',
    category: 'lifecycle',
    source: { type: 'native', attribute: '__modifiedBy' },
    supportedAssetTypes: ['*'],
    contributesToSignals: [],
    useCases: ['auditing', 'data_governance'],
    coreForUseCases: [],
    status: 'active',
  },
];

// =============================================================================
// AI READINESS FIELDS (Custom Metadata - Tenant Configurable)
// =============================================================================

const aiReadinessFields: UnifiedField[] = [
  {
    id: 'ai_training_approved',
    displayName: 'AI Training Approved',
    description: 'Asset approved for AI/ML training use.',
    category: 'custom',
    source: {
      type: 'custom_metadata',
      businessAttribute: 'AIGovernance',
      attribute: 'trainingApproved',
    },
    supportedAssetTypes: ['Table', 'View', 'Column'],
    contributesToSignals: [
      { signal: 'AI_READY', weight: 1.0, required: true },
    ],
    useCases: ['rag', 'ai_agents'],
    coreForUseCases: ['rag', 'ai_agents'],
    status: 'experimental',
  },
  {
    id: 'ai_license_cleared',
    displayName: 'AI License Cleared',
    description: 'Data license permits AI/ML use.',
    category: 'custom',
    source: {
      type: 'custom_metadata',
      businessAttribute: 'AIGovernance',
      attribute: 'licenseClear',
    },
    supportedAssetTypes: ['Table', 'View'],
    contributesToSignals: [
      { signal: 'AI_READY', weight: 0.5 },
    ],
    useCases: ['rag', 'ai_agents'],
    coreForUseCases: [],
    status: 'experimental',
  },
  {
    id: 'ai_excluded',
    displayName: 'AI Training Excluded',
    description: 'Asset explicitly excluded from AI/ML training.',
    category: 'custom',
    source: { type: 'classification', anyOf: ['MLTrainingExclude', 'AIExcluded'] },
    supportedAssetTypes: ['Table', 'View', 'Column'],
    contributesToSignals: [
      { signal: 'AI_READY', weight: -1.0, negative: true },
    ],
    useCases: ['rag', 'ai_agents'],
    coreForUseCases: [],
    status: 'experimental',
  },
];

// =============================================================================
// EXPORT: UNIFIED FIELD CATALOG
// =============================================================================

/**
 * Complete unified field catalog
 * Combines all field categories into a single searchable collection
 */
export const UNIFIED_FIELD_CATALOG: UnifiedField[] = [
  ...identityFields,
  ...ownershipFields,
  ...documentationFields,
  ...lineageFields,
  ...classificationFields,
  ...accessFields,
  ...qualityFields,
  ...usageFields,
  ...trustFields,
  ...hierarchyFields,
  ...lifecycleFields,
  ...aiReadinessFields,
];

// =============================================================================
// CATALOG LOOKUP UTILITIES
// =============================================================================

/**
 * Get a field by ID
 */
export function getFieldById(id: string): UnifiedField | undefined {
  return UNIFIED_FIELD_CATALOG.find(f => f.id === id);
}

/**
 * Get fields by category
 */
export function getFieldsByCategory(category: UnifiedField['category']): UnifiedField[] {
  return UNIFIED_FIELD_CATALOG.filter(f => f.category === category);
}

/**
 * Get fields that contribute to a specific signal
 */
export function getFieldsForSignal(signal: string): UnifiedField[] {
  return UNIFIED_FIELD_CATALOG.filter(f =>
    f.contributesToSignals.some(c => c.signal === signal)
  );
}

/**
 * Get fields for a specific use case
 */
export function getFieldsForUseCase(useCaseId: string): UnifiedField[] {
  return UNIFIED_FIELD_CATALOG.filter(f =>
    f.useCases.includes('*') || f.useCases.includes(useCaseId)
  );
}

/**
 * Get core fields for a specific use case
 */
export function getCoreFieldsForUseCase(useCaseId: string): UnifiedField[] {
  return UNIFIED_FIELD_CATALOG.filter(f =>
    f.coreForUseCases.includes('*') || f.coreForUseCases.includes(useCaseId)
  );
}

/**
 * Get fields supported by an asset type
 */
export function getFieldsForAssetType(assetType: string): UnifiedField[] {
  return UNIFIED_FIELD_CATALOG.filter(f =>
    f.supportedAssetTypes.includes('*') || f.supportedAssetTypes.includes(assetType)
  );
}

/**
 * Get fields with completeness weights (for completeness scoring)
 */
export function getCompletenessFields(): UnifiedField[] {
  return UNIFIED_FIELD_CATALOG.filter(f => f.completenessWeight !== undefined && f.completenessWeight > 0);
}

/**
 * Get fields with measure IDs (for binding matrix integration)
 */
export function getMeasureFields(): UnifiedField[] {
  return UNIFIED_FIELD_CATALOG.filter(f => f.measureId !== undefined);
}

/**
 * Get active fields only
 */
export function getActiveFields(): UnifiedField[] {
  return UNIFIED_FIELD_CATALOG.filter(f => f.status === 'active');
}

/**
 * Create a field ID -> field map for efficient lookup
 */
export function createFieldMap(): Map<string, UnifiedField> {
  return new Map(UNIFIED_FIELD_CATALOG.map(f => [f.id, f]));
}
