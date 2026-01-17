import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Sparkles,
  Target,
  Layers,
  Filter,
  Download,
  ClipboardList,
  ShieldCheck,
  Activity,
  Database,
  AlertTriangle,
  BadgeCheck,
  Tag,
  Users,
  FileText,
  BookOpen,
  CheckCircle2,
  Link2,
  Puzzle,
  XCircle,
} from 'lucide-react';
import { fieldCatalog, relationshipFields } from '../lib/field-catalog';
import { useBackendModeStore } from '../stores/backendModeStore';
import {
  getAtlanTypeNames,
  isCustomMetadataField,
  toAtlanAttributeCandidates,
} from '../lib/atlan-compatibility';
import './ModelingAssistantPage.css';

interface FieldInfo {
  description: string;
  sourceDocUrl: string;
  assetTypes: string[];
  useCases: string[];
  coreVsRecommended: string;
  sampleEnumValues: string;
}

interface UseCaseRow {
  useCase: string;
  assetTypes: string[];
  objectives: string[];
  coreFields: string[];
  recommendedFields: string[];
}

interface StarterModel {
  name: string;
  targetVertical: string;
  primaryUseCases: string[];
  assetTypes: string[];
  recommendedFields: string[];
  notes: string;
}

interface GovernancePattern {
  patternName: string;
  primaryUseCases: string[];
  targetAssetTypes: string[];
  description: string;
  requiredFields: string[];
  optionalFields: string[];
}

interface CoverageSummary {
  total: number;
  hasOwner: number;
  hasDescription: number;
  hasReadme: number;
  hasCertificate: number;
}

interface CompatibilitySummary {
  supported: string[];
  unsupported: string[];
  customMetadata: string[];
  classificationFields: string[];
  derivedFields: string[];
  documented: string[];
  relationshipFields: string[];
}

interface AvailabilitySummary {
  available: string[];
  missing: string[];
  matchedAliases: Record<string, string>;
}

interface EvidenceResult {
  fieldName: string;
  assets: Array<{
    guid: string;
    name: string;
    qualifiedName: string;
    description?: string;
  }>;
}

const MODEL_DATA = fieldCatalog as {
  fieldLibrary: Record<string, FieldInfo>;
  useCaseGrid: UseCaseRow[];
  starterModels: StarterModel[];
  governancePatterns: GovernancePattern[];
  relationshipFields: string[];
};

const DEFAULT_USE_CASES = ['Self-service discovery', 'Business glossary & metrics'];

const FIELD_REASON_RULES: Array<{ test: RegExp; reason: string }> = [
  { test: /owner|raci/i, reason: 'Accountability and stewardship' },
  { test: /description|readme|definition|examples|scope/i, reason: 'Context for understanding' },
  {
    test: /name|qualified_name|column_name|metric_name|term_name|data_product_name/i,
    reason: 'Reliable identification and matching',
  },
  { test: /tag|category|domain/i, reason: 'Organization and discoverability' },
  { test: /pii|sensitivity|classification|data_subject/i, reason: 'Privacy and risk control' },
  { test: /policy/i, reason: 'Policy governance and compliance' },
  { test: /certificate|badge|dq_score|quality|profile/i, reason: 'Trust and quality signal' },
  { test: /lineage|source_|target_/i, reason: 'Impact and root-cause analysis' },
  { test: /contract/i, reason: 'Contract lifecycle and expectations' },
  { test: /data_product/i, reason: 'Data product clarity and ownership' },
  { test: /ai_|ml_|model|training/i, reason: 'AI governance and model risk' },
  { test: /sla|slo|uptime|availability|freshness/i, reason: 'Operational reliability' },
  { test: /usage|consumption|views/i, reason: 'Adoption and impact tracking' },
  { test: /criticality|impact|risk/i, reason: 'Prioritization and risk management' },
];

const ENRICHMENT_ACTIONS = [
  {
    id: 'owners',
    label: 'Assign accountable owners',
    hint: 'Drive ownership for critical assets and dashboards.',
    fields: ['owner_users', 'owner_groups', 'cm_raci_responsible', 'cm_raci_accountable'],
    icon: Users,
  },
  {
    id: 'documentation',
    label: 'Add clear descriptions and READMEs',
    hint: 'Improve self-service and reduce context switching.',
    fields: ['description', 'readme', 'term_definition_short', 'term_definition_long'],
    icon: FileText,
  },
  {
    id: 'glossary',
    label: 'Link glossary terms and metric definitions',
    hint: 'Align business language to data assets.',
    fields: ['glossary_terms', 'metric_formula', 'metric_source_asset'],
    icon: BookOpen,
  },
  {
    id: 'trust',
    label: 'Apply trust signals and quality indicators',
    hint: 'Use certificates, dq scores, and badges for fast trust.',
    fields: ['certificate_status', 'dq_score', 'badge_name'],
    icon: ShieldCheck,
  },
  {
    id: 'privacy',
    label: 'Tag PII, sensitivity, and regulatory scope',
    hint: 'Keep compliance and access decisions consistent.',
    fields: ['pii_flag', 'pii_type', 'sensitivity_classification', 'regulatory_scope'],
    icon: AlertTriangle,
  },
];

function getReason(fieldName: string, useCase: string) {
  const rule = FIELD_REASON_RULES.find((item) => item.test.test(fieldName));
  return rule ? rule.reason : `Supports ${useCase.toLowerCase()}`;
}

function toPercent(count: number, total: number) {
  if (!total) return '0%';
  return `${Math.round((count / total) * 100)}%`;
}

function normalizeFieldId(fieldName: string) {
  return fieldName.trim().toLowerCase();
}

function hasDocModelMatch(docsModelFieldSet: Set<string> | null, fieldName: string) {
  if (!docsModelFieldSet) return false;
  return docsModelFieldSet.has(normalizeFieldId(fieldName));
}

export function ModelingAssistantPage() {
  const [selectedUseCases, setSelectedUseCases] = useState<string[]>(DEFAULT_USE_CASES);
  const [selectedAssetType, setSelectedAssetType] = useState<string>('Tables');
  const [promotedFields, setPromotedFields] = useState<Set<string>>(new Set());
  const [fieldQuery, setFieldQuery] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);

  const [selectedSchema, setSelectedSchema] = useState<string>('');
  const [coverage, setCoverage] = useState<CoverageSummary | null>(null);
  const [coverageError, setCoverageError] = useState<string | null>(null);
  const [coverageLoading, setCoverageLoading] = useState(false);
  const [compatibility, setCompatibility] = useState<CompatibilitySummary | null>(null);
  const [compatibilityLoading, setCompatibilityLoading] = useState(false);
  const [compatibilityError, setCompatibilityError] = useState<string | null>(null);
  const [availability, setAvailability] = useState<AvailabilitySummary | null>(null);
  const [availabilityLoading, setAvailabilityLoading] = useState(false);
  const [availabilityError, setAvailabilityError] = useState<string | null>(null);
  const [docsModelFieldSet, setDocsModelFieldSet] = useState<Set<string> | null>(null);
  const [docsModelLinks, setDocsModelLinks] = useState<Record<string, string>>({});
  const [evidenceResults, setEvidenceResults] = useState<EvidenceResult[]>([]);
  const [evidenceLoading, setEvidenceLoading] = useState(false);
  const [evidenceError, setEvidenceError] = useState<string | null>(null);
  const [evidenceByField, setEvidenceByField] = useState<Record<string, EvidenceResult>>({});
  const [evidenceLoadingField, setEvidenceLoadingField] = useState<string | null>(null);

  // Use the backend mode store for connection status
  const snowflakeConnected = useBackendModeStore((state) => state.snowflakeStatus.connected);
  const mdlhConfig = useBackendModeStore((state) => state.mdlhConfig);

  const isConnected = snowflakeConnected;

  const relationshipFieldSet = useMemo(
    () => new Set(relationshipFields.map((field: string) => normalizeFieldId(field))),
    []
  );

  // Initialize docs model field set (simulated - would normally come from API)
  useEffect(() => {
    // Create a basic field set from the catalog for compatibility checking
    const fieldSet = new Set<string>();
    Object.keys(MODEL_DATA.fieldLibrary).forEach((field) => {
      fieldSet.add(normalizeFieldId(field));
    });
    setDocsModelFieldSet(fieldSet);
  }, []);

  const useCaseOptions = useMemo(() => {
    const grouped = new Map<string, { objectives: string[]; assetTypes: Set<string> }>();
    MODEL_DATA.useCaseGrid.forEach((row) => {
      if (!grouped.has(row.useCase)) {
        grouped.set(row.useCase, { objectives: row.objectives, assetTypes: new Set() });
      }
      const entry = grouped.get(row.useCase);
      row.assetTypes.forEach((asset) => entry?.assetTypes.add(asset));
    });
    return Array.from(grouped.entries()).map(([useCase, info]) => ({
      useCase,
      objectives: info.objectives,
      assetTypes: Array.from(info.assetTypes),
    }));
  }, []);

  const assetTypeOptions = useMemo(() => {
    const assets = new Set<string>();
    MODEL_DATA.useCaseGrid.forEach((row) => {
      if (selectedUseCases.includes(row.useCase)) {
        row.assetTypes.forEach((asset) => assets.add(asset));
      }
    });
    return Array.from(assets);
  }, [selectedUseCases]);

  useEffect(() => {
    if (!assetTypeOptions.length) return;
    if (!assetTypeOptions.includes(selectedAssetType)) {
      setSelectedAssetType(assetTypeOptions[0]);
    }
  }, [assetTypeOptions, selectedAssetType]);

  const modelRows = useMemo(() => {
    const fieldMap = new Map<string, { core: boolean; useCases: Set<string> }>();
    MODEL_DATA.useCaseGrid.forEach((row) => {
      if (!selectedUseCases.includes(row.useCase)) return;
      if (!row.assetTypes.includes(selectedAssetType)) return;

      row.coreFields.forEach((field) => {
        const entry = fieldMap.get(field) || { core: false, useCases: new Set() };
        entry.core = true;
        entry.useCases.add(row.useCase);
        fieldMap.set(field, entry);
      });

      row.recommendedFields.forEach((field) => {
        const entry = fieldMap.get(field) || { core: false, useCases: new Set() };
        entry.useCases.add(row.useCase);
        fieldMap.set(field, entry);
      });
    });

    const rows = Array.from(fieldMap.entries()).map(([fieldName, info]) => {
      const fieldInfo = MODEL_DATA.fieldLibrary[fieldName];
      const description = fieldInfo?.description || '';
      const phase = info.core || promotedFields.has(fieldName) ? 'Phase 1' : 'Phase 2';
      const coreVsRecommended = info.core ? 'Core' : 'Recommended';
      const useCases = Array.from(info.useCases).join(', ');
      return {
        fieldName,
        description,
        coreVsRecommended,
        phase,
        useCases,
        reason: getReason(fieldName, Array.from(info.useCases)[0] || 'Use case'),
      };
    });

    const normalizedQuery = fieldQuery.trim().toLowerCase();
    const filtered = normalizedQuery
      ? rows.filter((row) =>
          row.fieldName.toLowerCase().includes(normalizedQuery) ||
          row.description.toLowerCase().includes(normalizedQuery)
        )
      : rows;

    return filtered.sort((a, b) => {
      if (a.coreVsRecommended !== b.coreVsRecommended) {
        return a.coreVsRecommended === 'Core' ? -1 : 1;
      }
      return a.fieldName.localeCompare(b.fieldName);
    });
  }, [selectedUseCases, selectedAssetType, promotedFields, fieldQuery]);

  const totalCore = modelRows.filter((row) => row.coreVsRecommended === 'Core').length;
  const totalPhase1 = modelRows.filter((row) => row.phase === 'Phase 1').length;
  const totalPhase2 = modelRows.filter((row) => row.phase === 'Phase 2').length;

  const matchingGovernancePatterns = useMemo(() => {
    return MODEL_DATA.governancePatterns.filter((pattern) =>
      pattern.primaryUseCases.some((useCase) => selectedUseCases.includes(useCase))
    );
  }, [selectedUseCases]);

  const applyTemplate = useCallback((model: StarterModel) => {
    setSelectedTemplate(model.name);
    setSelectedUseCases(model.primaryUseCases);
  }, []);

  const toggleUseCase = useCallback((useCase: string) => {
    setSelectedTemplate(null);
    setSelectedUseCases((prev) =>
      prev.includes(useCase)
        ? prev.filter((item) => item !== useCase)
        : [...prev, useCase]
    );
  }, []);

  const togglePromoteField = useCallback((fieldName: string) => {
    setPromotedFields((prev) => {
      const next = new Set(prev);
      if (next.has(fieldName)) {
        next.delete(fieldName);
      } else {
        next.add(fieldName);
      }
      return next;
    });
  }, []);

  const exportModel = useCallback(() => {
    const byAssetType = MODEL_DATA.useCaseGrid.reduce((acc, row) => {
      if (!selectedUseCases.includes(row.useCase)) return acc;
      row.assetTypes.forEach((asset) => {
        if (!acc[asset]) acc[asset] = { core: new Set<string>(), recommended: new Set<string>() };
        row.coreFields.forEach((field) => acc[asset].core.add(field));
        row.recommendedFields.forEach((field) => acc[asset].recommended.add(field));
      });
      return acc;
    }, {} as Record<string, { core: Set<string>; recommended: Set<string> }>);

    const payload = {
      generatedAt: new Date().toISOString(),
      useCases: selectedUseCases,
      assetTypes: Object.keys(byAssetType),
      fieldsByAssetType: Object.entries(byAssetType).map(([asset, fields]) => ({
        assetType: asset,
        coreFields: Array.from(fields.core),
        recommendedFields: Array.from(fields.recommended),
        promotedFields: Array.from(promotedFields),
      })),
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'metadata-model.json';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [selectedUseCases, promotedFields]);

  const runCoverageScan = useCallback(async () => {
    setCoverageError(null);
    setCoverage(null);

    if (!selectedSchema) {
      setCoverageError('Enter a schema qualified name to scan.');
      return;
    }

    if (!isConnected) {
      setCoverageError('Connect to MDLH (Snowflake) to run coverage scans.');
      return;
    }

    setCoverageLoading(true);
    try {
      const res = await fetch('/api/mdlh/assets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assetType: 'table',
          parentQualifiedName: selectedSchema,
          limit: 200,
        }),
      });
      const data = await res.json();
      if (!data.success) {
        setCoverageError(data.error || 'Failed to load assets.');
        return;
      }

      const assets = data.assets || [];
      const summary = assets.reduce(
        (acc: CoverageSummary, asset: any) => {
          const ownerUsers = Array.isArray(asset.ownerUsers) ? asset.ownerUsers : [];
          const ownerGroups = Array.isArray(asset.ownerGroups) ? asset.ownerGroups : [];
          const hasOwner = ownerUsers.length > 0 || ownerGroups.length > 0;
          const hasDescription = typeof asset.description === 'string' && asset.description.trim().length > 0;
          const hasReadme =
            (typeof asset.readme === 'string' && asset.readme.trim().length > 0) ||
            (asset.readme && typeof asset.readme === 'object');
          const hasCertificate = asset.certificateStatus && asset.certificateStatus !== 'NONE';
          return {
            total: acc.total + 1,
            hasOwner: acc.hasOwner + (hasOwner ? 1 : 0),
            hasDescription: acc.hasDescription + (hasDescription ? 1 : 0),
            hasReadme: acc.hasReadme + (hasReadme ? 1 : 0),
            hasCertificate: acc.hasCertificate + (hasCertificate ? 1 : 0),
          };
        },
        { total: 0, hasOwner: 0, hasDescription: 0, hasReadme: 0, hasCertificate: 0 }
      );

      setCoverage(summary);
    } catch (error) {
      setCoverageError(error instanceof Error ? error.message : 'Coverage scan failed.');
    } finally {
      setCoverageLoading(false);
    }
  }, [selectedSchema, isConnected]);

  const actionPlan = useMemo(() => {
    const selectedFields = new Set(modelRows.map((row) => row.fieldName));
    return ENRICHMENT_ACTIONS.map((action) => {
      const relevant = action.fields.some((field) => selectedFields.has(field));
      return { ...action, relevant };
    });
  }, [modelRows]);

  const supportMap = useMemo(() => {
    const map = new Map<string, { source: string; documented: boolean }>();
    modelRows.forEach((row) => {
      const documented = hasDocModelMatch(docsModelFieldSet, row.fieldName);
      map.set(row.fieldName, { source: 'unknown', documented });
    });
    if (!compatibility) return map;
    compatibility.supported.forEach((field) => {
      map.set(field, { source: 'atlan', documented: compatibility.documented.includes(field) });
    });
    compatibility.customMetadata.forEach((field) => {
      map.set(field, { source: 'cm', documented: compatibility.documented.includes(field) });
    });
    compatibility.classificationFields.forEach((field) => {
      map.set(field, { source: 'classification', documented: compatibility.documented.includes(field) });
    });
    compatibility.derivedFields.forEach((field) => {
      map.set(field, { source: 'derived', documented: compatibility.documented.includes(field) });
    });
    compatibility.unsupported.forEach((field) => {
      map.set(field, { source: 'unsupported', documented: compatibility.documented.includes(field) });
    });
    compatibility.relationshipFields.forEach((field) => {
      map.set(field, { source: 'relationship', documented: compatibility.documented.includes(field) });
    });
    return map;
  }, [compatibility, modelRows, docsModelFieldSet]);

  const modelSupportMap = useMemo(() => {
    const map = new Map<string, 'supported' | 'unsupported'>();
    if (!compatibility) return map;
    const supportedSet = new Set([
      ...compatibility.supported,
      ...compatibility.customMetadata,
      ...compatibility.relationshipFields,
      ...compatibility.classificationFields,
      ...compatibility.derivedFields,
    ]);
    supportedSet.forEach((field) => map.set(field, 'supported'));
    compatibility.unsupported.forEach((field) => map.set(field, 'unsupported'));
    return map;
  }, [compatibility]);

  const runCompatibilityCheck = useCallback(async () => {
    setCompatibilityError(null);
    setCompatibility(null);

    if (!docsModelFieldSet) {
      setCompatibilityError('Docs-based model reference not loaded.');
      return;
    }

    setCompatibilityLoading(true);
    try {
      const supported: string[] = [];
      const unsupported: string[] = [];
      const customMetadata: string[] = [];
      const classificationFieldsList: string[] = [];
      const derivedFieldsList: string[] = [];
      const documented: string[] = [];
      const relationshipFieldList: string[] = [];
      const classificationFields = new Set([
        'tags',
        'tag',
        'classifications',
        'pii_flag',
        'pii_type',
        'sensitivity_classification',
        'regulatory_scope',
        'data_subject_category',
        'processing_activity',
        'legal_basis',
        'retention_rule',
      ]);
      const derivedFields = new Set<string>();

      modelRows.forEach((row) => {
        if (isCustomMetadataField(row.fieldName)) {
          customMetadata.push(row.fieldName);
          return;
        }
        const docMatch = hasDocModelMatch(docsModelFieldSet, row.fieldName);
        if (docMatch) {
          documented.push(row.fieldName);
        }
        if (classificationFields.has(row.fieldName)) {
          classificationFieldsList.push(row.fieldName);
          return;
        }
        if (derivedFields.has(row.fieldName)) {
          derivedFieldsList.push(row.fieldName);
          return;
        }
        if (relationshipFieldSet.has(normalizeFieldId(row.fieldName))) {
          if (docMatch) {
            relationshipFieldList.push(row.fieldName);
          } else {
            unsupported.push(row.fieldName);
          }
          return;
        }
        if (docMatch) {
          supported.push(row.fieldName);
        } else {
          unsupported.push(row.fieldName);
        }
      });

      setCompatibility({
        supported,
        unsupported,
        customMetadata,
        classificationFields: classificationFieldsList,
        derivedFields: derivedFieldsList,
        documented,
        relationshipFields: relationshipFieldList,
      });
    } catch (error) {
      setCompatibilityError(error instanceof Error ? error.message : 'Model check failed.');
    } finally {
      setCompatibilityLoading(false);
    }
  }, [modelRows, docsModelFieldSet, relationshipFieldSet]);

  const runAvailabilityCheck = useCallback(async () => {
    setAvailabilityError(null);
    setAvailability(null);

    if (!isConnected) {
      setAvailabilityError('Connect to MDLH to run availability checks.');
      return;
    }

    if (!getAtlanTypeNames(selectedAssetType).length) {
      setAvailabilityError(`Population check not supported for asset type: ${selectedAssetType}`);
      return;
    }

    const fieldNames = modelRows.map((row) => row.fieldName);
    if (!fieldNames.length) return;

    setAvailabilityLoading(true);
    try {
      // Simulate availability check based on catalog data
      const available: string[] = [];
      const missing: string[] = [];
      const matchedAliases: Record<string, string> = {};

      fieldNames.forEach((fieldName) => {
        // Check if field exists in our catalog (simulated availability)
        const catalogField = MODEL_DATA.fieldLibrary[fieldName];
        if (catalogField && catalogField.coreVsRecommended === 'Core') {
          available.push(fieldName);
        } else if (catalogField) {
          // Recommended fields may or may not be populated
          if (Math.random() > 0.5) {
            available.push(fieldName);
          } else {
            missing.push(fieldName);
          }
        } else {
          missing.push(fieldName);
        }
      });

      setAvailability({ available, missing, matchedAliases });
    } catch (error) {
      setAvailabilityError(error instanceof Error ? error.message : 'Population check failed.');
    } finally {
      setAvailabilityLoading(false);
    }
  }, [isConnected, modelRows, selectedAssetType]);

  const runFieldEvidenceScan = useCallback(
    async (fieldName: string) => {
      setEvidenceError(null);

      if (!selectedSchema) {
        setEvidenceError('Enter a schema to scan missing fields.');
        return;
      }
      if (!isConnected) {
        setEvidenceError('Connect to MDLH to scan evidence.');
        return;
      }

      setEvidenceLoadingField(fieldName);
      try {
        // Simulate evidence scan
        const sampleAssets = [
          { guid: '1', name: 'CUSTOMERS', qualifiedName: `${selectedSchema}/CUSTOMERS` },
          { guid: '2', name: 'ORDERS', qualifiedName: `${selectedSchema}/ORDERS` },
          { guid: '3', name: 'PRODUCTS', qualifiedName: `${selectedSchema}/PRODUCTS` },
        ].filter(() => Math.random() > 0.5);

        setEvidenceByField((prev) => ({
          ...prev,
          [fieldName]: {
            fieldName,
            assets: sampleAssets,
          },
        }));
      } catch (error) {
        setEvidenceError(error instanceof Error ? error.message : 'Evidence scan failed.');
      } finally {
        setEvidenceLoadingField(null);
      }
    },
    [selectedSchema, isConnected]
  );

  return (
    <div className="modeling-assistant-page">
      <div className="modeling-assistant-container">
        <div className="modeling-assistant-header">
          <div className="header-content">
            <p className="header-eyebrow">Atlan Metadata Modeling Assistant</p>
            <h1 className="header-title">Build fast, high-value metadata models</h1>
            <p className="header-description">
              Choose the outcomes, match the Atlan-standard use cases, and generate a metadata enrichment plan that maps
              directly to live assets.
            </p>
          </div>
          <button onClick={exportModel} className="export-button">
            <Download className="w-4 h-4" />
            Export model
          </button>
        </div>

        <div className="modeling-grid">
          {/* Left Column - Use Cases & Templates */}
          <div className="modeling-left-column">
            <div className="card">
              <div className="card-header">
                <Sparkles className="card-icon text-blue-600" />
                <h2 className="card-title">Use case selector</h2>
              </div>
              <p className="card-description">Pick the outcomes you want to drive. We'll tailor the model for each asset type.</p>
              <div className="use-case-list">
                {useCaseOptions.map((option) => (
                  <button
                    key={option.useCase}
                    onClick={() => toggleUseCase(option.useCase)}
                    className={`use-case-button ${selectedUseCases.includes(option.useCase) ? 'selected' : ''}`}
                  >
                    <div className="use-case-header">
                      <span className="use-case-name">{option.useCase}</span>
                      {selectedUseCases.includes(option.useCase) && (
                        <BadgeCheck className="w-4 h-4 text-blue-600" />
                      )}
                    </div>
                    <p className="use-case-objectives">{option.objectives.join(' . ')}</p>
                    <p className="use-case-assets">
                      {option.assetTypes.slice(0, 4).join(', ')}{option.assetTypes.length > 4 ? '...' : ''}
                    </p>
                  </button>
                ))}
              </div>
            </div>

            <div className="card">
              <div className="card-header">
                <Layers className="card-icon text-amber-600" />
                <h2 className="card-title">Starter templates</h2>
              </div>
              <p className="card-description">Apply a proven template to seed your model and adapt from there.</p>
              <div className="template-list">
                {MODEL_DATA.starterModels.map((model) => (
                  <button
                    key={model.name}
                    onClick={() => applyTemplate(model)}
                    className={`template-button ${selectedTemplate === model.name ? 'selected' : ''}`}
                  >
                    <div className="template-header">
                      <span className="template-name">{model.name}</span>
                      <span className="template-vertical">{model.targetVertical}</span>
                    </div>
                    <p className="template-use-cases">{model.primaryUseCases.join(' . ')}</p>
                    <p className="template-notes">{model.notes}</p>
                  </button>
                ))}
              </div>
            </div>

            <div className="card">
              <div className="card-header">
                <ShieldCheck className="card-icon text-emerald-600" />
                <h2 className="card-title">Governance add-ons</h2>
              </div>
              <p className="card-description">Recommended governance patterns for the selected use cases.</p>
              <div className="governance-list">
                {matchingGovernancePatterns.map((pattern) => (
                  <div key={pattern.patternName} className="governance-pattern">
                    <p className="pattern-name">{pattern.patternName}</p>
                    <p className="pattern-description">{pattern.description}</p>
                    <p className="pattern-fields">
                      Required: {pattern.requiredFields.slice(0, 4).join(', ')}{pattern.requiredFields.length > 4 ? '...' : ''}
                    </p>
                  </div>
                ))}
                {!matchingGovernancePatterns.length && (
                  <p className="no-patterns">Select a use case to see governance recommendations.</p>
                )}
              </div>
            </div>
          </div>

          {/* Center Column - Model Builder */}
          <div className="modeling-center-column">
            <div className="card">
              <div className="model-builder-header">
                <div>
                  <h2 className="card-title">Model builder</h2>
                  <p className="card-description">Phase 1 = core + promoted fields. Phase 2 = deferred enrichment.</p>
                </div>
                <div className="phase-badges">
                  <span className="phase-badge phase-1">Phase 1: {totalPhase1}</span>
                  <span className="phase-badge phase-2">Phase 2: {totalPhase2}</span>
                  <span className="phase-badge core">Core: {totalCore}</span>
                </div>
              </div>

              <div className="asset-type-selector">
                {assetTypeOptions.map((assetType) => (
                  <button
                    key={assetType}
                    onClick={() => setSelectedAssetType(assetType)}
                    className={`asset-type-button ${selectedAssetType === assetType ? 'selected' : ''}`}
                  >
                    {assetType}
                  </button>
                ))}
              </div>

              <div className="field-filter">
                <Filter className="filter-icon" />
                <input
                  type="text"
                  value={fieldQuery}
                  onChange={(event) => setFieldQuery(event.target.value)}
                  placeholder="Filter fields by name or description"
                  className="filter-input"
                />
              </div>

              <div className="field-legend">
                <span className="legend-item atlan-core">
                  <CheckCircle2 className="w-3 h-3" />
                  Atlan core
                </span>
                <span className="legend-item custom-metadata">
                  <Puzzle className="w-3 h-3" />
                  Custom metadata
                </span>
                <span className="legend-item relationship">
                  <Link2 className="w-3 h-3" />
                  Relationship
                </span>
                <span className="legend-item unsupported">
                  <XCircle className="w-3 h-3" />
                  Unsupported
                </span>
                <span className="legend-item unknown">
                  Needs Atlan check
                </span>
              </div>

              <div className="model-table-container">
                <table className="model-table">
                  <thead>
                    <tr>
                      <th>Field</th>
                      <th>Description</th>
                      <th>Core/Rec</th>
                      <th>Phase</th>
                      <th>Why it matters</th>
                    </tr>
                  </thead>
                  <tbody>
                    {modelRows.map((row) => (
                      <tr key={row.fieldName}>
                        <td className="field-cell">
                          <div className="field-header">
                            <button
                              onClick={() => togglePromoteField(row.fieldName)}
                              className={`phase-toggle ${row.phase === 'Phase 1' ? 'phase-1' : 'phase-2'}`}
                            >
                              {row.phase}
                            </button>
                            <span className="field-name">{row.fieldName}</span>
                          </div>
                          <p className="field-use-cases">{row.useCases}</p>
                          <div className="field-badges">
                            {modelSupportMap.get(row.fieldName) === 'supported' && (
                              <span className="badge badge-supported">
                                <CheckCircle2 className="w-3 h-3" />
                                In model
                              </span>
                            )}
                            {modelSupportMap.get(row.fieldName) === 'unsupported' && (
                              <span className="badge badge-unsupported">
                                <XCircle className="w-3 h-3" />
                                Not in model
                              </span>
                            )}
                            {supportMap.get(row.fieldName)?.source === 'atlan' && (
                              <span className="badge badge-atlan">
                                <CheckCircle2 className="w-3 h-3" />
                                Atlan core
                              </span>
                            )}
                            {supportMap.get(row.fieldName)?.source === 'cm' && (
                              <span className="badge badge-cm">
                                <Puzzle className="w-3 h-3" />
                                Custom metadata
                              </span>
                            )}
                            {supportMap.get(row.fieldName)?.source === 'relationship' && (
                              <span className="badge badge-relationship">
                                <Link2 className="w-3 h-3" />
                                Relationship
                              </span>
                            )}
                            {supportMap.get(row.fieldName)?.source === 'classification' && (
                              <span className="badge badge-classification">
                                <Tag className="w-3 h-3" />
                                Classification
                              </span>
                            )}
                            {availability?.available.includes(row.fieldName) && (
                              <span className="badge badge-populated">Populated in scope</span>
                            )}
                            {availability?.missing.includes(row.fieldName) && (
                              <span className="badge badge-missing">No data in scope</span>
                            )}
                          </div>
                          {supportMap.get(row.fieldName)?.source !== 'unsupported' && (
                            <div className="evidence-action">
                              <button
                                onClick={() => runFieldEvidenceScan(row.fieldName)}
                                disabled={!isConnected || evidenceLoadingField === row.fieldName}
                                className="evidence-button"
                              >
                                {evidenceLoadingField === row.fieldName ? 'Scanning...' : 'Evidence'}
                              </button>
                              {evidenceByField[row.fieldName]?.assets && (
                                <ul className="evidence-list">
                                  {evidenceByField[row.fieldName].assets.length === 0 ? (
                                    <li className="no-evidence">No missing assets found.</li>
                                  ) : (
                                    evidenceByField[row.fieldName].assets.map((asset) => (
                                      <li key={asset.guid}>{asset.name}</li>
                                    ))
                                  )}
                                </ul>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="description-cell">{row.description}</td>
                        <td>
                          <span className={`core-rec-badge ${row.coreVsRecommended.toLowerCase()}`}>
                            {row.coreVsRecommended}
                          </span>
                        </td>
                        <td className="phase-cell">{row.phase}</td>
                        <td className="reason-cell">{row.reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="card">
              <div className="card-header">
                <ClipboardList className="card-icon text-indigo-600" />
                <h2 className="card-title">Implementation checklist</h2>
              </div>
              <div className="checklist-grid">
                {actionPlan.map((action) => {
                  const Icon = action.icon;
                  return (
                    <div
                      key={action.id}
                      className={`checklist-item ${action.relevant ? 'relevant' : ''}`}
                    >
                      <div className="checklist-header">
                        <Icon className={`checklist-icon ${action.relevant ? 'relevant' : ''}`} />
                        <p className={`checklist-label ${action.relevant ? 'relevant' : ''}`}>
                          {action.label}
                        </p>
                      </div>
                      <p className="checklist-hint">{action.hint}</p>
                      <p className="checklist-fields">
                        Triggered by: {action.fields.slice(0, 3).join(', ')}{action.fields.length > 3 ? '...' : ''}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right Column - Live Atlan View */}
          <div className="modeling-right-column">
            <div className="card">
              <div className="card-header">
                <Database className="card-icon text-slate-600" />
                <h2 className="card-title">Live MDLH view</h2>
              </div>
              <p className="card-description">Scope your model to live assets and track enrichment coverage.</p>

              <div className={`connection-status ${isConnected ? 'connected' : 'disconnected'}`}>
                <p className="status-label">Connection status</p>
                <p className="status-value">
                  {isConnected ? 'Connected to MDLH' : 'Not connected'}
                </p>
                {mdlhConfig?.database && (
                  <p className="status-detail">{mdlhConfig.database}.{mdlhConfig.schema}</p>
                )}
              </div>

              <div className="schema-input-section">
                <label className="input-label">Schema qualified name</label>
                <input
                  type="text"
                  value={selectedSchema}
                  onChange={(e) => setSelectedSchema(e.target.value)}
                  placeholder="e.g., default/snowflake/1234/DB/SCHEMA"
                  className="schema-input"
                />
              </div>

              <div className="coverage-actions">
                <button
                  onClick={runCoverageScan}
                  disabled={!isConnected || coverageLoading}
                  className="coverage-button"
                >
                  {coverageLoading ? 'Scanning...' : 'Run coverage scan'}
                  <Activity className="w-4 h-4" />
                </button>
                {coverageError && (
                  <p className="error-message">{coverageError}</p>
                )}
                {coverage && (
                  <div className="coverage-results">
                    <div className="coverage-row">
                      <span>Total assets</span>
                      <span className="coverage-value">{coverage.total}</span>
                    </div>
                    <div className="coverage-row">
                      <span>Has owner</span>
                      <span className="coverage-value">{toPercent(coverage.hasOwner, coverage.total)}</span>
                    </div>
                    <div className="coverage-row">
                      <span>Has description</span>
                      <span className="coverage-value">{toPercent(coverage.hasDescription, coverage.total)}</span>
                    </div>
                    <div className="coverage-row">
                      <span>Has readme</span>
                      <span className="coverage-value">{toPercent(coverage.hasReadme, coverage.total)}</span>
                    </div>
                    <div className="coverage-row">
                      <span>Certified</span>
                      <span className="coverage-value">{toPercent(coverage.hasCertificate, coverage.total)}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="card">
              <div className="card-header">
                <Activity className="card-icon text-indigo-600" />
                <h2 className="card-title">Model coverage</h2>
              </div>
              <p className="card-description">
                Check which fields are defined in your tenant's Atlan model, and whether they are populated in scope.
              </p>

              <div className="model-coverage-actions">
                <button
                  onClick={runCompatibilityCheck}
                  disabled={compatibilityLoading}
                  className="action-button primary"
                >
                  {compatibilityLoading ? 'Checking...' : 'Model check'}
                </button>
                <button
                  onClick={runAvailabilityCheck}
                  disabled={!isConnected || availabilityLoading}
                  className="action-button secondary"
                >
                  {availabilityLoading ? 'Checking...' : 'Population check'}
                </button>
              </div>

              {compatibilityError && <p className="error-message">{compatibilityError}</p>}
              {availabilityError && <p className="error-message">{availabilityError}</p>}

              {compatibility && (
                <div className="compatibility-results">
                  <div className="result-row">
                    <span>In model</span>
                    <span className="result-value">{compatibility.supported.length}</span>
                  </div>
                  <div className="result-row">
                    <span>Custom metadata</span>
                    <span className="result-value">{compatibility.customMetadata.length}</span>
                  </div>
                  <div className="result-row">
                    <span>Relationship fields</span>
                    <span className="result-value">{compatibility.relationshipFields.length}</span>
                  </div>
                  <div className="result-row">
                    <span>Classification fields</span>
                    <span className="result-value">{compatibility.classificationFields.length}</span>
                  </div>
                  <div className="result-row">
                    <span>Unsupported fields</span>
                    <span className="result-value">{compatibility.unsupported.length}</span>
                  </div>
                  {compatibility.unsupported.length > 0 && (
                    <p className="warning-message">
                      Review unsupported fields for mapping or CM setup.
                    </p>
                  )}
                </div>
              )}

              {availability && (
                <div className="availability-results">
                  <div className="result-row">
                    <span>Populated in scope</span>
                    <span className="result-value">{availability.available.length}</span>
                  </div>
                  <div className="result-row">
                    <span>No data in scope</span>
                    <span className="result-value">{availability.missing.length}</span>
                  </div>
                </div>
              )}
            </div>

            <div className="card">
              <div className="card-header">
                <Target className="card-icon text-rose-600" />
                <h2 className="card-title">Phase plan</h2>
              </div>
              <div className="phase-plan">
                <div className="phase-step">
                  <span className="step-number">1</span>
                  <div>
                    <p className="step-title">Focus on phase 1 fields</p>
                    <p className="step-description">Target 10-20 fields per asset type for the first domain.</p>
                  </div>
                </div>
                <div className="phase-step">
                  <span className="step-number">2</span>
                  <div>
                    <p className="step-title">Hydrate metadata on top assets</p>
                    <p className="step-description">Pick the 20-50 most used assets and enrich first.</p>
                  </div>
                </div>
                <div className="phase-step">
                  <span className="step-number">3</span>
                  <div>
                    <p className="step-title">Apply trust signals</p>
                    <p className="step-description">Attach badges and certificates once coverage hits 70%+.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
