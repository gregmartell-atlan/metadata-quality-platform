/**
 * Asset Preview Drawer
 *
 * A sophisticated right-edge panel that displays rich asset information
 * with fluid animations and refined visual hierarchy.
 *
 * Design: Linear/Stripe-inspired with:
 * - Spring-based slide animations
 * - Glass morphism header
 * - Rich metadata sections with icons
 * - Refined micro-interactions
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import {
  X,
  ExternalLink,
  Tag,
  User,
  Users,
  Calendar,
  Database,
  Shield,
  FileText,
  Link2,
  Copy,
  Check,
  ChevronRight,
  Clock,
  Layers,
  BarChart3,
  Sparkles,
  Table2,
  Columns3,
  Eye,
  Loader2,
  BookOpen,
  Package,
  Globe,
  TrendingUp,
  AlertCircle,
  CheckCircle2,
  Activity,
  Settings2,
  Hash
} from 'lucide-react';
import type { AtlanAsset } from '../../services/atlan/types';
import { getClassificationTypeDefs, getBusinessMetadataTypeDefs } from '../../services/atlan/api';
import './AssetPreviewDrawer.css';

interface AssetPreviewDrawerProps {
  asset: AtlanAsset | null;
  isOpen: boolean;
  isLoading?: boolean;
  onClose: () => void;
}

export function AssetPreviewDrawer({ asset, isOpen, isLoading = false, onClose }: AssetPreviewDrawerProps) {
  const drawerRef = useRef<HTMLDivElement>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'lineage' | 'activity'>('overview');

  // Type definition maps for resolving hashed names to display names
  const [classificationNameMap, setClassificationNameMap] = useState<Map<string, string>>(new Map());
  const [businessMetadataMap, setBusinessMetadataMap] = useState<{
    setNames: Map<string, string>;
    attributeNames: Map<string, Map<string, string>>;
  }>({ setNames: new Map(), attributeNames: new Map() });

  // Fetch type definitions when drawer opens (cached in API layer)
  useEffect(() => {
    if (isOpen) {
      // Fetch classification type definitions
      getClassificationTypeDefs().then(setClassificationNameMap).catch(console.error);
      // Fetch business metadata type definitions
      getBusinessMetadataTypeDefs().then(setBusinessMetadataMap).catch(console.error);
    }
  }, [isOpen]);

  // Helper to resolve classification hashed name to display name
  const getClassificationDisplayName = useCallback((cls: any): string => {
    if (typeof cls === 'string') {
      return classificationNameMap.get(cls) || cls;
    }
    const typeName = cls.typeName || cls.name;
    if (typeName) {
      return classificationNameMap.get(typeName) || cls.displayName || typeName;
    }
    return cls.displayName || 'Unknown';
  }, [classificationNameMap]);

  // Helper to resolve business metadata hashed names to display names
  const getBusinessMetadataDisplayNames = useCallback((
    setName: string,
    fields: Record<string, any>
  ): { setDisplayName: string; resolvedFields: Array<{ label: string; value: any }> } => {
    const setDisplayName = businessMetadataMap.setNames.get(setName) || setName;
    const attrMap = businessMetadataMap.attributeNames.get(setName) || new Map();

    const resolvedFields = Object.entries(fields || {}).map(([key, value]) => ({
      label: attrMap.get(key) || key,
      value
    }));

    return { setDisplayName, resolvedFields };
  }, [businessMetadataMap]);

  // Close on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  // Focus trap and body scroll lock
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      drawerRef.current?.focus();
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const copyToClipboard = useCallback(async (text: string, field: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  }, []);

  if (!isOpen || !asset) return null;

  const getAssetTypeIcon = (typeName?: string) => {
    const iconProps = { size: 18, strokeWidth: 1.5 };
    switch (typeName?.toLowerCase()) {
      case 'table':
        return <Table2 {...iconProps} />;
      case 'column':
        return <Columns3 {...iconProps} />;
      case 'view':
        return <Eye {...iconProps} />;
      case 'database':
        return <Database {...iconProps} />;
      case 'schema':
        return <Layers {...iconProps} />;
      default:
        return <Database {...iconProps} />;
    }
  };

  const getAssetTypeColor = (typeName?: string) => {
    switch (typeName?.toLowerCase()) {
      case 'table':
        return 'asset-type-table';
      case 'column':
        return 'asset-type-column';
      case 'view':
        return 'asset-type-view';
      case 'database':
        return 'asset-type-database';
      default:
        return 'asset-type-default';
    }
  };

  // Format timestamps - handles both Unix milliseconds and ISO strings
  const formatDate = (timestamp?: number | string) => {
    if (!timestamp) return null;
    try {
      // Handle Unix timestamp (number) or ISO string
      const date = typeof timestamp === 'number'
        ? new Date(timestamp)
        : new Date(timestamp);

      if (isNaN(date.getTime())) return null;

      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

      if (diffDays === 0) return 'Today';
      if (diffDays === 1) return 'Yesterday';
      if (diffDays < 7) return `${diffDays} days ago`;
      if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
      if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;

      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
      });
    } catch {
      return null;
    }
  };

  const formatFullDate = (timestamp?: number | string) => {
    if (!timestamp) return 'Unknown';
    try {
      const date = typeof timestamp === 'number'
        ? new Date(timestamp)
        : new Date(timestamp);

      if (isNaN(date.getTime())) return 'Unknown';

      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return 'Unknown';
    }
  };

  // Format large numbers with abbreviations
  const formatNumber = (num?: number) => {
    if (num === undefined || num === null) return null;
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toLocaleString();
  };

  // Extract metadata from asset attributes
  const attrs = asset.attributes || {};

  // Core fields
  const description = attrs.description || attrs.userDescription || asset.description || asset.userDescription || null;
  const qualifiedName = attrs.qualifiedName || asset.qualifiedName || '';
  const guid = asset.guid || '';

  // Ownership - extract first owner name
  const ownerUsers = attrs.ownerUsers || asset.ownerUsers || [];
  const ownerGroups = attrs.ownerGroups || asset.ownerGroups || [];
  const getOwnerName = (owner: any): string => {
    if (typeof owner === 'string') return owner;
    return owner?.name || owner?.displayName || owner?.username || 'Unknown';
  };
  const primaryOwner = ownerUsers[0] ? getOwnerName(ownerUsers[0]) : (ownerGroups[0] ? getOwnerName(ownerGroups[0]) : null);
  const allOwners = [...ownerUsers.map(getOwnerName), ...ownerGroups.map(getOwnerName)];

  // Governance
  const certificateStatus = attrs.certificateStatus || asset.certificateStatus || null;
  const certificateMessage = attrs.certificateStatusMessage || null;

  // Tags & Classifications
  const tags = attrs.tags || asset.tags || [];
  const atlanTags = attrs.atlanTags || asset.atlanTags || [];
  const classifications = attrs.classifications || asset.classifications || [];
  const classificationNames = attrs.classificationNames || asset.classificationNames || [];

  // Glossary Terms
  const meanings = attrs.meanings || asset.meanings || [];
  const assignedTerms = attrs.assignedTerms || asset.assignedTerms || [];
  const allTerms = [...meanings, ...assignedTerms];

  // Data Products & Domains
  const dataProducts = attrs.dataProducts || asset.dataProducts || [];
  const dataDomain = attrs.dataDomain || asset.dataDomain || null;

  // README
  const readme = attrs.readme || asset.readme || null;
  const readmeContent = typeof readme === 'object' ? readme?.content : null;

  // Timestamps
  const createdAt = attrs.createTime || asset.createTime;
  const updatedAt = attrs.updateTime || asset.updateTime;
  const sourceCreatedAt = attrs.sourceCreatedAt;
  const sourceUpdatedAt = attrs.sourceUpdatedAt;
  const lastSyncRunAt = attrs.lastSyncRunAt;

  // Usage Metrics
  const popularityScore = attrs.popularityScore || asset.popularityScore;
  const sourceReadCount = attrs.sourceReadCount || asset.sourceReadCount;
  const sourceReadUserCount = attrs.sourceReadUserCount || asset.sourceReadUserCount;
  const starredCount = attrs.starredCount || asset.starredCount;
  const queryCount = attrs.queryCount;

  // Quality Metrics
  const dataQualityScore = attrs.dataQualityScore;
  const mcIncidentCount = attrs.assetMcIncidentCount;
  const mcMonitorCount = attrs.assetMcMonitorCount;
  const sodaCheckCount = attrs.assetSodaCheckCount;

  // Technical Metadata
  const rowCount = attrs.rowCount;
  const columnCount = attrs.columnCount;
  const sizeBytes = attrs.sizeBytes;
  const hasLineage = attrs.__hasLineage || attrs.hasLineage || asset.__hasLineage;

  // Custom Metadata (business attributes)
  const businessAttributes = attrs.businessAttributes || {};
  const hasCustomMetadata = Object.keys(businessAttributes).length > 0;

  // Parse qualified name for hierarchy breadcrumb
  const qualifiedParts = qualifiedName.split('/').filter(Boolean);

  // Calculate quality score from real data or use a reasonable default
  const qualityScore = dataQualityScore || (
    popularityScore !== undefined ? Math.round(popularityScore * 100) : null
  );

  const getCertificationConfig = (status: string | null) => {
    switch (status?.toLowerCase()) {
      case 'verified':
        return {
          label: 'Verified',
          className: 'cert-verified',
          icon: <Shield size={12} strokeWidth={2} />
        };
      case 'draft':
        return {
          label: 'Draft',
          className: 'cert-draft',
          icon: <FileText size={12} strokeWidth={2} />
        };
      case 'deprecated':
        return {
          label: 'Deprecated',
          className: 'cert-deprecated',
          icon: <Clock size={12} strokeWidth={2} />
        };
      default:
        return null;
    }
  };

  const certConfig = getCertificationConfig(certificateStatus);

  return (
    <>
      {/* Backdrop with blur */}
      <div
        className="drawer-backdrop"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer Panel */}
      <aside
        ref={drawerRef}
        className="drawer-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="drawer-title"
        tabIndex={-1}
      >
        {/* Sticky Header with Glass Effect */}
        <header className="drawer-header">
          <div className="drawer-header-top">
            <div className={`drawer-asset-type ${getAssetTypeColor(asset.typeName)}`}>
              {getAssetTypeIcon(asset.typeName)}
              <span>{asset.typeName || 'Asset'}</span>
            </div>
            <button
              className="drawer-close"
              onClick={onClose}
              aria-label="Close drawer"
            >
              <X size={18} strokeWidth={1.5} />
            </button>
          </div>

          <h2 id="drawer-title" className="drawer-title">
            {asset.name || asset.attributes?.name || 'Unnamed Asset'}
          </h2>

          <div className="drawer-header-meta">
            {certConfig && (
              <span className={`drawer-cert-badge ${certConfig.className}`}>
                {certConfig.icon}
                {certConfig.label}
              </span>
            )}
            {qualityScore && (
              <span className="drawer-score-badge" data-score={qualityScore >= 80 ? 'high' : qualityScore >= 60 ? 'medium' : 'low'}>
                <Sparkles size={12} strokeWidth={2} />
                {qualityScore}% Quality
              </span>
            )}
          </div>

          {/* Navigation Tabs */}
          <nav className="drawer-tabs" role="tablist">
            <button
              className={`drawer-tab ${activeTab === 'overview' ? 'active' : ''}`}
              onClick={() => setActiveTab('overview')}
              role="tab"
              aria-selected={activeTab === 'overview'}
            >
              Overview
            </button>
            <button
              className={`drawer-tab ${activeTab === 'lineage' ? 'active' : ''}`}
              onClick={() => setActiveTab('lineage')}
              role="tab"
              aria-selected={activeTab === 'lineage'}
            >
              Lineage
            </button>
            <button
              className={`drawer-tab ${activeTab === 'activity' ? 'active' : ''}`}
              onClick={() => setActiveTab('activity')}
              role="tab"
              aria-selected={activeTab === 'activity'}
            >
              Activity
            </button>
          </nav>
        </header>

        {/* Scrollable Content */}
        <div className="drawer-content" role="tabpanel">
          {/* Loading Indicator */}
          {isLoading && (
            <div className="drawer-loading">
              <Loader2 size={20} className="drawer-loading-spinner" />
              <span>Loading asset details...</span>
            </div>
          )}

          {activeTab === 'overview' && (
            <>
              {/* Description Section */}
              <section className="drawer-section">
                <div className="drawer-section-header">
                  <FileText size={14} strokeWidth={1.5} />
                  <h3>Description</h3>
                </div>
                {description ? (
                  <p className="drawer-description">{description}</p>
                ) : (
                  <div className="drawer-empty-state">
                    <p>No description available</p>
                    <button className="drawer-add-btn">
                      <span>Add description</span>
                      <ChevronRight size={14} />
                    </button>
                  </div>
                )}
              </section>

              {/* Owner Section */}
              <section className="drawer-section">
                <div className="drawer-section-header">
                  {allOwners.length > 1 ? <Users size={14} strokeWidth={1.5} /> : <User size={14} strokeWidth={1.5} />}
                  <h3>Owners</h3>
                  {allOwners.length > 1 && <span className="drawer-section-count">{allOwners.length}</span>}
                </div>
                {primaryOwner ? (
                  <div className="drawer-owners-list">
                    {allOwners.slice(0, 3).map((ownerName, i) => (
                      <div key={i} className="drawer-owner-card">
                        <div className="drawer-owner-avatar">
                          {ownerName.charAt(0).toUpperCase()}
                        </div>
                        <div className="drawer-owner-info">
                          <span className="drawer-owner-name">{ownerName}</span>
                          <span className="drawer-owner-role">{i === 0 ? 'Primary Owner' : 'Co-owner'}</span>
                        </div>
                      </div>
                    ))}
                    {allOwners.length > 3 && (
                      <div className="drawer-more-owners">+{allOwners.length - 3} more</div>
                    )}
                  </div>
                ) : (
                  <div className="drawer-empty-state">
                    <p>No owner assigned</p>
                    <button className="drawer-add-btn">
                      <span>Assign owner</span>
                      <ChevronRight size={14} />
                    </button>
                  </div>
                )}
              </section>

              {/* Glossary Terms Section */}
              {allTerms.length > 0 && (
                <section className="drawer-section">
                  <div className="drawer-section-header">
                    <BookOpen size={14} strokeWidth={1.5} />
                    <h3>Glossary Terms</h3>
                    <span className="drawer-section-count">{allTerms.length}</span>
                  </div>
                  <div className="drawer-terms">
                    {allTerms.map((term: any, i: number) => (
                      <span key={i} className="drawer-term">
                        <BookOpen size={10} />
                        {term.displayText || term.name || term.qualifiedName || 'Unknown Term'}
                      </span>
                    ))}
                  </div>
                </section>
              )}

              {/* Data Products Section */}
              {(dataProducts.length > 0 || dataDomain) && (
                <section className="drawer-section">
                  <div className="drawer-section-header">
                    <Package size={14} strokeWidth={1.5} />
                    <h3>Data Products & Domains</h3>
                  </div>
                  <div className="drawer-products">
                    {dataDomain && (
                      <div className="drawer-domain-card">
                        <Globe size={14} />
                        <span>{dataDomain.name || dataDomain.displayName || 'Unknown Domain'}</span>
                      </div>
                    )}
                    {dataProducts.map((product: any, i: number) => (
                      <div key={i} className="drawer-product-card">
                        <Package size={14} />
                        <span>{product.name || product.displayName || 'Unknown Product'}</span>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Usage Metrics Section */}
              {(sourceReadCount !== undefined || starredCount !== undefined || queryCount !== undefined) && (
                <section className="drawer-section">
                  <div className="drawer-section-header">
                    <TrendingUp size={14} strokeWidth={1.5} />
                    <h3>Usage Metrics</h3>
                  </div>
                  <div className="drawer-metrics-grid">
                    {sourceReadCount !== undefined && (
                      <div className="drawer-metric">
                        <span className="drawer-metric-value">{formatNumber(sourceReadCount)}</span>
                        <span className="drawer-metric-label">Total Reads</span>
                      </div>
                    )}
                    {sourceReadUserCount !== undefined && (
                      <div className="drawer-metric">
                        <span className="drawer-metric-value">{formatNumber(sourceReadUserCount)}</span>
                        <span className="drawer-metric-label">Unique Users</span>
                      </div>
                    )}
                    {queryCount !== undefined && (
                      <div className="drawer-metric">
                        <span className="drawer-metric-value">{formatNumber(queryCount)}</span>
                        <span className="drawer-metric-label">Queries</span>
                      </div>
                    )}
                    {starredCount !== undefined && (
                      <div className="drawer-metric">
                        <span className="drawer-metric-value">{starredCount}</span>
                        <span className="drawer-metric-label">Stars</span>
                      </div>
                    )}
                  </div>
                </section>
              )}

              {/* Quality Health Section */}
              {(mcIncidentCount !== undefined || mcMonitorCount !== undefined || sodaCheckCount !== undefined) && (
                <section className="drawer-section">
                  <div className="drawer-section-header">
                    <Activity size={14} strokeWidth={1.5} />
                    <h3>Quality Health</h3>
                  </div>
                  <div className="drawer-health-grid">
                    {mcMonitorCount !== undefined && (
                      <div className="drawer-health-item">
                        <CheckCircle2 size={14} className="health-icon-monitors" />
                        <span className="drawer-health-value">{mcMonitorCount}</span>
                        <span className="drawer-health-label">Monitors</span>
                      </div>
                    )}
                    {mcIncidentCount !== undefined && (
                      <div className="drawer-health-item">
                        <AlertCircle size={14} className={`health-icon-incidents ${mcIncidentCount > 0 ? 'has-incidents' : ''}`} />
                        <span className="drawer-health-value">{mcIncidentCount}</span>
                        <span className="drawer-health-label">Incidents</span>
                      </div>
                    )}
                    {sodaCheckCount !== undefined && (
                      <div className="drawer-health-item">
                        <Shield size={14} className="health-icon-checks" />
                        <span className="drawer-health-value">{sodaCheckCount}</span>
                        <span className="drawer-health-label">Soda Checks</span>
                      </div>
                    )}
                  </div>
                </section>
              )}

              {/* Custom Metadata Section */}
              {hasCustomMetadata && (
                <section className="drawer-section">
                  <div className="drawer-section-header">
                    <Settings2 size={14} strokeWidth={1.5} />
                    <h3>Custom Metadata</h3>
                  </div>
                  <div className="drawer-custom-metadata">
                    {Object.entries(businessAttributes).map(([category, fields]: [string, any]) => {
                      // Resolve hashed names to display names
                      const { setDisplayName, resolvedFields } = getBusinessMetadataDisplayNames(category, fields);
                      return (
                        <div key={category} className="drawer-custom-category">
                          <div className="drawer-custom-category-header">{setDisplayName}</div>
                          <div className="drawer-custom-fields">
                            {resolvedFields.map(({ label, value }) => (
                              <div key={label} className="drawer-custom-field">
                                <span className="drawer-custom-field-label">{label}</span>
                                <span className="drawer-custom-field-value">
                                  {typeof value === 'boolean' ? (value ? 'Yes' : 'No') : String(value || '-')}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              )}

              {/* Tags Section */}
              {tags.length > 0 && (
                <section className="drawer-section">
                  <div className="drawer-section-header">
                    <Tag size={14} strokeWidth={1.5} />
                    <h3>Tags</h3>
                    <span className="drawer-section-count">{tags.length}</span>
                  </div>
                  <div className="drawer-tags">
                    {tags.map((tag: string, i: number) => (
                      <span key={i} className="drawer-tag">{tag}</span>
                    ))}
                  </div>
                </section>
              )}

              {/* Classifications Section */}
              {classifications.length > 0 && (
                <section className="drawer-section">
                  <div className="drawer-section-header">
                    <Shield size={14} strokeWidth={1.5} />
                    <h3>Classifications</h3>
                    <span className="drawer-section-count">{classifications.length}</span>
                  </div>
                  <div className="drawer-classifications">
                    {classifications.map((cls: any, i: number) => (
                      <span key={i} className="drawer-classification">
                        {getClassificationDisplayName(cls)}
                      </span>
                    ))}
                  </div>
                </section>
              )}

              {/* Location Breadcrumb */}
              {qualifiedParts.length > 0 && (
                <section className="drawer-section">
                  <div className="drawer-section-header">
                    <Link2 size={14} strokeWidth={1.5} />
                    <h3>Location</h3>
                  </div>
                  <div className="drawer-breadcrumb">
                    {qualifiedParts.slice(0, 5).map((part, i) => (
                      <span key={i} className="drawer-breadcrumb-item">
                        {i > 0 && <ChevronRight size={12} className="drawer-breadcrumb-sep" />}
                        <span className="drawer-breadcrumb-text">{part}</span>
                      </span>
                    ))}
                    {qualifiedParts.length > 5 && (
                      <span className="drawer-breadcrumb-more">+{qualifiedParts.length - 5} more</span>
                    )}
                  </div>
                </section>
              )}

              {/* Technical Metadata Grid */}
              <section className="drawer-section">
                <div className="drawer-section-header">
                  <Hash size={14} strokeWidth={1.5} />
                  <h3>Technical Details</h3>
                </div>
                <div className="drawer-metadata-grid">
                  <div className="drawer-metadata-item">
                    <span className="drawer-metadata-label">Created</span>
                    <span className="drawer-metadata-value" title={formatFullDate(createdAt)}>
                      {formatDate(createdAt) || 'Unknown'}
                    </span>
                  </div>
                  <div className="drawer-metadata-item">
                    <span className="drawer-metadata-label">Updated</span>
                    <span className="drawer-metadata-value" title={formatFullDate(updatedAt)}>
                      {formatDate(updatedAt) || 'Unknown'}
                    </span>
                  </div>
                  {rowCount !== undefined && (
                    <div className="drawer-metadata-item">
                      <span className="drawer-metadata-label">Rows</span>
                      <span className="drawer-metadata-value">{formatNumber(rowCount)}</span>
                    </div>
                  )}
                  {columnCount !== undefined && (
                    <div className="drawer-metadata-item">
                      <span className="drawer-metadata-label">Columns</span>
                      <span className="drawer-metadata-value">{columnCount}</span>
                    </div>
                  )}
                  {sizeBytes !== undefined && (
                    <div className="drawer-metadata-item">
                      <span className="drawer-metadata-label">Size</span>
                      <span className="drawer-metadata-value">
                        {sizeBytes >= 1073741824 ? `${(sizeBytes / 1073741824).toFixed(1)} GB` :
                         sizeBytes >= 1048576 ? `${(sizeBytes / 1048576).toFixed(1)} MB` :
                         sizeBytes >= 1024 ? `${(sizeBytes / 1024).toFixed(1)} KB` :
                         `${sizeBytes} B`}
                      </span>
                    </div>
                  )}
                  {hasLineage !== undefined && (
                    <div className="drawer-metadata-item">
                      <span className="drawer-metadata-label">Lineage</span>
                      <span className="drawer-metadata-value">{hasLineage ? 'Yes' : 'No'}</span>
                    </div>
                  )}
                  <div className="drawer-metadata-item">
                    <span className="drawer-metadata-label">Type</span>
                    <span className="drawer-metadata-value">{asset.typeName || 'Unknown'}</span>
                  </div>
                  <div className="drawer-metadata-item drawer-metadata-copyable">
                    <span className="drawer-metadata-label">GUID</span>
                    <button
                      className="drawer-metadata-copy"
                      onClick={() => copyToClipboard(guid, 'guid')}
                      title="Copy GUID"
                    >
                      <code className="drawer-metadata-mono">{guid.slice(0, 12)}...</code>
                      {copiedField === 'guid' ? (
                        <Check size={12} className="copy-success" />
                      ) : (
                        <Copy size={12} />
                      )}
                    </button>
                  </div>
                </div>
              </section>
            </>
          )}

          {activeTab === 'lineage' && (
            <section className="drawer-section drawer-section-full">
              <div className="drawer-lineage-placeholder">
                <Layers size={32} strokeWidth={1} />
                <h4>Lineage Preview</h4>
                <p>View upstream and downstream dependencies</p>
                <button className="drawer-action-secondary">
                  Open Full Lineage
                  <ExternalLink size={14} />
                </button>
              </div>
            </section>
          )}

          {activeTab === 'activity' && (
            <section className="drawer-section drawer-section-full">
              <div className="drawer-activity-placeholder">
                <Clock size={32} strokeWidth={1} />
                <h4>Recent Activity</h4>
                <p>No recent activity to display</p>
              </div>
            </section>
          )}
        </div>

        {/* Sticky Footer */}
        <footer className="drawer-footer">
          <button className="drawer-action-primary">
            <ExternalLink size={14} strokeWidth={1.5} />
            Open in Atlan
          </button>
        </footer>
      </aside>
    </>
  );
}
