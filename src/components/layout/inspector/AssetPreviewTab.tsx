/**
 * Asset Preview Tab Content
 * 
 * Extracted from AssetPreviewDrawer.tsx to be used in the Inspector Sidebar.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
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
    Hash,
    Award,
    GitBranch,
    Target,
    Scale,
    Flame,
    Star,
    BarChart3,
    Info,
    FolderOpen
} from 'lucide-react';
import { useScoresStore } from '../../../stores/scoresStore';
import type { AtlanAsset } from '../../../services/atlan/types';
import { getClassificationTypeDefs, getBusinessMetadataTypeDefs } from '../../../services/atlan/api';
import './AssetPreviewTab.css';

interface AssetPreviewTabProps {
    asset: AtlanAsset | null;
    assets?: AtlanAsset[]; // For multi-asset group preview
    isLoading?: boolean;
    onAssetSelect?: (asset: AtlanAsset) => void; // Callback when user selects an asset from group
}

export function AssetPreviewTab({ asset, assets = [], isLoading = false, onAssetSelect }: AssetPreviewTabProps) {
    const [copiedField, setCopiedField] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'overview' | 'governance' | 'activity' | 'quality' | 'lineage' | 'docs' | 'metadata'>('overview');
    const [typeFilter, setTypeFilter] = useState<string | null>(null); // For filtering assets in group view

    // Reset type filter when assets change
    useEffect(() => {
        setTypeFilter(null);
    }, [assets]);

    // Get quality scores from store
    const { scoresByGuid } = useScoresStore();

    // Type definition maps for resolving hashed names to display names
    const [classificationNameMap, setClassificationNameMap] = useState<Map<string, string>>(new Map());
    const [businessMetadataMap, setBusinessMetadataMap] = useState<{
        setNames: Map<string, string>;
        attributeNames: Map<string, Map<string, string>>;
    }>({ setNames: new Map(), attributeNames: new Map() });

    // Fetch type definitions on mount
    useEffect(() => {
        getClassificationTypeDefs().then(setClassificationNameMap).catch(console.error);
        getBusinessMetadataTypeDefs().then(setBusinessMetadataMap).catch(console.error);
    }, []);

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

    const copyToClipboard = useCallback(async (text: string, field: string) => {
        try {
            await navigator.clipboard.writeText(text);
            setCopiedField(field);
            setTimeout(() => setCopiedField(null), 2000);
        } catch (err) {
            console.error('Failed to copy:', err);
        }
    }, []);

    const getAssetTypeIcon = (typeName?: string) => {
        const iconProps = { size: 18, strokeWidth: 1.5 };
        switch (typeName?.toLowerCase()) {
            case 'table': return <Table2 {...iconProps} />;
            case 'column': return <Columns3 {...iconProps} />;
            case 'view': return <Eye {...iconProps} />;
            case 'database': return <Database {...iconProps} />;
            case 'schema': return <Layers {...iconProps} />;
            default: return <Database {...iconProps} />;
        }
    };

    const getAssetTypeColor = (typeName?: string) => {
        switch (typeName?.toLowerCase()) {
            case 'table': return 'asset-type-table';
            case 'column': return 'asset-type-column';
            case 'view': return 'asset-type-view';
            case 'database': return 'asset-type-database';
            default: return 'asset-type-default';
        }
    };

    const formatDate = (timestamp?: number | string) => {
        if (!timestamp) return null;
        try {
            const date = typeof timestamp === 'number' ? new Date(timestamp) : new Date(timestamp);
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
        } catch { return null; }
    };

    const formatFullDate = (timestamp?: number | string) => {
        if (!timestamp) return 'Unknown';
        try {
            const date = typeof timestamp === 'number' ? new Date(timestamp) : new Date(timestamp);
            if (isNaN(date.getTime())) return 'Unknown';
            return date.toLocaleDateString('en-US', {
                year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit',
            });
        } catch { return 'Unknown'; }
    };

    const formatNumber = (num?: number) => {
        if (num === undefined || num === null) return null;
        if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
        if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
        return num.toLocaleString();
    };

    // Calculate group statistics for multi-asset view
    const groupStats = useMemo(() => {
        if (assets.length === 0) return null;

        const typeCount = new Map<string, number>();
        const certCount = { verified: 0, draft: 0, deprecated: 0, none: 0 };
        let withOwners = 0;
        let withDescription = 0;

        assets.forEach(a => {
            // Count by type
            const typeName = a.typeName || 'Unknown';
            typeCount.set(typeName, (typeCount.get(typeName) || 0) + 1);

            // Count certifications
            const cert = a.attributes?.certificateStatus || a.certificateStatus;
            if (cert === 'VERIFIED') certCount.verified++;
            else if (cert === 'DRAFT') certCount.draft++;
            else if (cert === 'DEPRECATED') certCount.deprecated++;
            else certCount.none++;

            // Count ownership
            const owners = a.attributes?.ownerUsers || a.ownerUsers || [];
            const groups = a.attributes?.ownerGroups || a.ownerGroups || [];
            if (owners.length > 0 || groups.length > 0) withOwners++;

            // Count descriptions
            const desc = a.attributes?.description || a.attributes?.userDescription || a.description;
            if (desc) withDescription++;
        });

        // Get quality scores for all assets
        const qualityScores: number[] = [];
        if (scoresByGuid) {
            assets.forEach(a => {
                const scores = scoresByGuid.get(a.guid);
                if (scores?.overall !== undefined) qualityScores.push(scores.overall);
            });
        }
        const avgQuality = qualityScores.length > 0
            ? Math.round(qualityScores.reduce((a, b) => a + b, 0) / qualityScores.length)
            : null;

        return {
            total: assets.length,
            typeCount,
            certCount,
            withOwners,
            withDescription,
            ownerCoverage: Math.round((withOwners / assets.length) * 100),
            descCoverage: Math.round((withDescription / assets.length) * 100),
            avgQuality,
        };
    }, [assets, scoresByGuid]);

    // Multi-asset group view
    if (!asset && assets.length > 0 && groupStats) {
        return (
            <div className="asset-preview-tab">
                <div className="tab-header-mini">
                    <div className="drawer-header-rich">
                        <div className="drawer-header-top">
                            <div className="drawer-asset-type asset-type-group">
                                <FolderOpen size={18} strokeWidth={1.5} />
                                Asset Group
                            </div>
                        </div>
                        <h2 className="drawer-title">{groupStats.total} Assets Selected</h2>
                    </div>
                    <div className="drawer-header-meta">
                        {groupStats.avgQuality !== null && (
                            <span className="drawer-score-badge" data-score={groupStats.avgQuality >= 80 ? 'high' : groupStats.avgQuality >= 60 ? 'medium' : 'low'}>
                                <Sparkles size={12} strokeWidth={2} />
                                {groupStats.avgQuality}% Avg Quality
                            </span>
                        )}
                    </div>
                </div>

                <div className="tab-scroll-body">
                    <div className="tab-content-inner">
                        <section className="drawer-section">
                            <div className="drawer-section-header"><Layers size={14} /><h3>Asset Types</h3><span className="section-hint">Click to filter</span></div>
                            <div className="group-type-breakdown">
                                {Array.from(groupStats.typeCount.entries()).map(([type, count]) => (
                                    <div
                                        key={type}
                                        className={`group-type-item ${typeFilter === type ? 'active' : ''}`}
                                        onClick={() => setTypeFilter(typeFilter === type ? null : type)}
                                    >
                                        <span className="group-type-label">{type}</span>
                                        <span className="group-type-count">{count}</span>
                                    </div>
                                ))}
                            </div>
                        </section>

                        <section className="drawer-section">
                            <div className="drawer-section-header"><Shield size={14} /><h3>Certification Status</h3></div>
                            <div className="group-cert-breakdown">
                                {groupStats.certCount.verified > 0 && (
                                    <div className="group-cert-item cert-verified">
                                        <CheckCircle2 size={14} />
                                        <span>{groupStats.certCount.verified} Verified</span>
                                    </div>
                                )}
                                {groupStats.certCount.draft > 0 && (
                                    <div className="group-cert-item cert-draft">
                                        <FileText size={14} />
                                        <span>{groupStats.certCount.draft} Draft</span>
                                    </div>
                                )}
                                {groupStats.certCount.deprecated > 0 && (
                                    <div className="group-cert-item cert-deprecated">
                                        <AlertCircle size={14} />
                                        <span>{groupStats.certCount.deprecated} Deprecated</span>
                                    </div>
                                )}
                                {groupStats.certCount.none > 0 && (
                                    <div className="group-cert-item cert-none">
                                        <Clock size={14} />
                                        <span>{groupStats.certCount.none} Uncertified</span>
                                    </div>
                                )}
                            </div>
                        </section>

                        <section className="drawer-section">
                            <div className="drawer-section-header"><BarChart3 size={14} /><h3>Coverage Metrics</h3></div>
                            <div className="quality-dimensions">
                                <div className="quality-dim-row">
                                    <div className="quality-dim-header">
                                        <User size={14} />
                                        <span className="quality-dim-label">Owner Coverage</span>
                                        <span className="quality-dim-score" data-score={groupStats.ownerCoverage >= 80 ? 'high' : groupStats.ownerCoverage >= 60 ? 'medium' : 'low'}>
                                            {groupStats.ownerCoverage}%
                                        </span>
                                    </div>
                                    <div className="quality-dim-bar">
                                        <div className="quality-dim-fill" style={{ width: `${groupStats.ownerCoverage}%` }} data-score={groupStats.ownerCoverage >= 80 ? 'high' : groupStats.ownerCoverage >= 60 ? 'medium' : 'low'}></div>
                                    </div>
                                </div>
                                <div className="quality-dim-row">
                                    <div className="quality-dim-header">
                                        <FileText size={14} />
                                        <span className="quality-dim-label">Description Coverage</span>
                                        <span className="quality-dim-score" data-score={groupStats.descCoverage >= 80 ? 'high' : groupStats.descCoverage >= 60 ? 'medium' : 'low'}>
                                            {groupStats.descCoverage}%
                                        </span>
                                    </div>
                                    <div className="quality-dim-bar">
                                        <div className="quality-dim-fill" style={{ width: `${groupStats.descCoverage}%` }} data-score={groupStats.descCoverage >= 80 ? 'high' : groupStats.descCoverage >= 60 ? 'medium' : 'low'}></div>
                                    </div>
                                </div>
                            </div>
                        </section>

                        <section className="drawer-section">
                            <div className="drawer-section-header">
                                <Database size={14} />
                                <h3>{typeFilter ? `${typeFilter}s` : 'Assets in Group'}</h3>
                                {typeFilter && (
                                    <button className="filter-clear-btn" onClick={() => setTypeFilter(null)}>Clear</button>
                                )}
                            </div>
                            <div className="group-asset-list">
                                {(() => {
                                    const filteredAssets = typeFilter
                                        ? assets.filter(a => a.typeName === typeFilter)
                                        : assets;
                                    const displayAssets = filteredAssets.slice(0, 15);
                                    const remaining = filteredAssets.length - displayAssets.length;
                                    return (
                                        <>
                                            {displayAssets.map((a, i) => (
                                                <div
                                                    key={a.guid || i}
                                                    className="group-asset-item"
                                                    onClick={() => onAssetSelect?.(a)}
                                                >
                                                    <div className="group-asset-icon">
                                                        {a.typeName === 'Table' ? <Table2 size={14} /> :
                                                         a.typeName === 'Column' ? <Columns3 size={14} /> :
                                                         a.typeName === 'View' ? <Eye size={14} /> :
                                                         <Database size={14} />}
                                                    </div>
                                                    <span className="group-asset-name">{a.name || a.attributes?.name || 'Unnamed'}</span>
                                                    <ChevronRight size={14} className="group-asset-arrow" />
                                                </div>
                                            ))}
                                            {remaining > 0 && (
                                                <div className="group-asset-more">
                                                    + {remaining} more {typeFilter ? `${typeFilter.toLowerCase()}s` : 'assets'}
                                                </div>
                                            )}
                                        </>
                                    );
                                })()}
                            </div>
                        </section>
                    </div>
                </div>
            </div>
        );
    }

    if (!asset && !isLoading) {
        return (
            <div className="tab-placeholder">
                <AlertCircle size={32} />
                <p>No asset selected.</p>
                <p>Select an asset from the browser or dashboard to view its details.</p>
            </div>
        );
    }

    const attrs = asset?.attributes || {};
    const description = attrs.description || attrs.userDescription || asset?.description || asset?.userDescription || null;
    const qualifiedName = attrs.qualifiedName || asset?.qualifiedName || '';
    const guid = asset?.guid || '';

    const ownerUsers = attrs.ownerUsers || asset?.ownerUsers || [];
    const ownerGroups = attrs.ownerGroups || asset?.ownerGroups || [];
    const getOwnerName = (owner: any): string => {
        if (typeof owner === 'string') return owner;
        return owner?.name || owner?.displayName || owner?.username || 'Unknown';
    };
    const primaryOwner = ownerUsers[0] ? getOwnerName(ownerUsers[0]) : (ownerGroups[0] ? getOwnerName(ownerGroups[0]) : null);
    const allOwners = [...ownerUsers.map(getOwnerName), ...ownerGroups.map(getOwnerName)];

    const certificateStatus = attrs.certificateStatus || asset?.certificateStatus || null;
    const tags = attrs.tags || asset?.tags || [];
    const classifications = attrs.classifications || asset?.classifications || [];
    const meanings = attrs.meanings || asset?.meanings || [];
    const assignedTerms = attrs.assignedTerms || asset?.assignedTerms || [];
    const allTerms = [...meanings, ...assignedTerms];

    const dataProducts = attrs.dataProducts || asset?.dataProducts || [];
    const dataDomain = attrs.dataDomain || asset?.dataDomain || null;
    const updatedAt = attrs.updateTime || asset?.updateTime;
    const popularityScore = attrs.popularityScore || asset?.popularityScore;
    const sourceReadCount = attrs.sourceReadCount || asset?.sourceReadCount;
    const starredCount = attrs.starredCount || asset?.starredCount;
    const dataQualityScore = attrs.dataQualityScore;
    const rowCount = attrs.rowCount;
    const qualityScore = dataQualityScore || (popularityScore !== undefined ? Math.round(popularityScore * 100) : null);

    const getCertificationConfig = (status: string | null) => {
        switch (status?.toLowerCase()) {
            case 'verified': return { label: 'Verified', className: 'cert-verified', icon: <Shield size={12} strokeWidth={2} /> };
            case 'draft': return { label: 'Draft', className: 'cert-draft', icon: <FileText size={12} strokeWidth={2} /> };
            case 'deprecated': return { label: 'Deprecated', className: 'cert-deprecated', icon: <Clock size={12} strokeWidth={2} /> };
            default: return null;
        }
    };

    const certConfig = getCertificationConfig(certificateStatus);

    return (
        <div className="asset-preview-tab">
            <div className="tab-header-mini">
                {asset && (
                    <div className="drawer-header-rich">
                        <div className="drawer-header-top">
                            <div className={`drawer-asset-type ${getAssetTypeColor(asset.typeName)}`}>
                                {getAssetTypeIcon(asset.typeName)}
                                {asset.typeName}
                            </div>
                        </div>
                        <h2 className="drawer-title" title={asset.name}>
                            {asset.name}
                        </h2>
                    </div>
                )}

                <div className="drawer-header-meta">
                    {certConfig && (
                        <span className={`drawer-cert-badge ${certConfig.className}`}>
                            {certConfig.icon}
                            {certConfig.label}
                        </span>
                    )}
                    {qualityScore !== null && (
                        <span className="drawer-score-badge" data-score={qualityScore >= 80 ? 'high' : qualityScore >= 60 ? 'medium' : 'low'}>
                            <Sparkles size={12} strokeWidth={2} />
                            {qualityScore}% Quality
                        </span>
                    )}
                </div>

                <nav className="drawer-tabs drawer-tabs-compact">
                    <button className={`drawer-tab ${activeTab === 'overview' ? 'active' : ''}`} onClick={() => setActiveTab('overview')} title="Overview"><Info size={14} /></button>
                    <button className={`drawer-tab ${activeTab === 'governance' ? 'active' : ''}`} onClick={() => setActiveTab('governance')} title="Governance"><Shield size={14} /></button>
                    <button className={`drawer-tab ${activeTab === 'activity' ? 'active' : ''}`} onClick={() => setActiveTab('activity')} title="Activity"><Activity size={14} /></button>
                    <button className={`drawer-tab ${activeTab === 'quality' ? 'active' : ''}`} onClick={() => setActiveTab('quality')} title="Quality"><Award size={14} /></button>
                    <button className={`drawer-tab ${activeTab === 'lineage' ? 'active' : ''}`} onClick={() => setActiveTab('lineage')} title="Lineage"><GitBranch size={14} /></button>
                    <button className={`drawer-tab ${activeTab === 'docs' ? 'active' : ''}`} onClick={() => setActiveTab('docs')} title="Documentation"><FileText size={14} /></button>
                    <button className={`drawer-tab ${activeTab === 'metadata' ? 'active' : ''}`} onClick={() => setActiveTab('metadata')} title="Metadata"><Database size={14} /></button>
                </nav>
            </div>

            <div className="tab-scroll-body">
                {isLoading && (
                    <div className="drawer-loading">
                        <Loader2 size={20} className="drawer-loading-spinner" />
                        <span>Loading asset details...</span>
                    </div>
                )}

                {!isLoading && asset && activeTab === 'overview' && (
                    <div className="tab-content-inner">
                        <section className="drawer-section">
                            <div className="drawer-section-header"><FileText size={14} /><h3>Description</h3></div>
                            {description ? <p className="drawer-description">{description}</p> : <div className="drawer-empty-state"><p>No description</p></div>}
                        </section>

                        <section className="drawer-section">
                            <div className="drawer-section-header"><User size={14} /><h3>Owners</h3></div>
                            {primaryOwner ? (
                                <div className="drawer-owners-list">
                                    {allOwners.slice(0, 3).map((name, i) => (
                                        <div key={i} className="drawer-owner-card">
                                            <div className="drawer-owner-avatar">{name.charAt(0)}</div>
                                            <div className="drawer-owner-info"><span className="drawer-owner-name">{name}</span></div>
                                        </div>
                                    ))}
                                </div>
                            ) : <div className="drawer-empty-state"><p>No owners assigned</p></div>}
                        </section>

                        {allTerms.length > 0 && (
                            <section className="drawer-section">
                                <div className="drawer-section-header"><BookOpen size={14} /><h3>Terms</h3></div>
                                <div className="drawer-terms">
                                    {allTerms.map((term: any, i: number) => {
                                        const termName = typeof term === 'string' ? term :
                                            (typeof term.name === 'string' ? term.name :
                                             typeof term.displayText === 'string' ? term.displayText :
                                             term.guid || 'Unknown');
                                        return <span key={i} className="drawer-term">{termName}</span>;
                                    })}
                                </div>
                            </section>
                        )}

                        {(sourceReadCount !== undefined || starredCount !== undefined) && (
                            <section className="drawer-section">
                                <div className="drawer-section-header"><TrendingUp size={14} /><h3>Usage</h3></div>
                                <div className="drawer-metrics-grid">
                                    {sourceReadCount !== undefined && <div className="drawer-metric"><span className="drawer-metric-value">{formatNumber(sourceReadCount)}</span> <span className="drawer-metric-label">Reads</span></div>}
                                    {starredCount !== undefined && <div className="drawer-metric"><span className="drawer-metric-value">{starredCount}</span> <span className="drawer-metric-label">Stars</span></div>}
                                </div>
                            </section>
                        )}

                        <section className="drawer-section">
                            <div className="drawer-section-header"><Hash size={14} /><h3>Technical Properties</h3></div>
                            <div className="drawer-metadata-grid">
                                <div className="drawer-metadata-item">
                                    <div className="drawer-meta-icon"><Calendar size={14} /></div>
                                    <div className="drawer-meta-content">
                                        <span className="drawer-metadata-label">Last Updated</span>
                                        <span className="drawer-metadata-value">{formatFullDate(updatedAt)}</span>
                                    </div>
                                </div>
                                <div className="drawer-metadata-item">
                                    <div className="drawer-meta-icon"><Database size={14} /></div>
                                    <div className="drawer-meta-content">
                                        <span className="drawer-metadata-label">System Type</span>
                                        <span className="drawer-metadata-value">{asset.typeName}</span>
                                    </div>
                                </div>
                                {rowCount !== undefined && (
                                    <div className="drawer-metadata-item">
                                        <div className="drawer-meta-icon"><Table2 size={14} /></div>
                                        <div className="drawer-meta-content">
                                            <span className="drawer-metadata-label">Row Count</span>
                                            <span className="drawer-metadata-value">{formatNumber(rowCount)}</span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </section>
                    </div>
                )}

                {/* Governance Tab */}
                {!isLoading && asset && activeTab === 'governance' && (
                    <div className="tab-content-inner">
                        <section className="drawer-section">
                            <div className="drawer-section-header"><FileText size={14} /><h3>Description</h3></div>
                            {description ? <p className="drawer-description">{description}</p> : <div className="drawer-empty-state"><p>No description</p></div>}
                        </section>

                        <section className="drawer-section">
                            <div className="drawer-section-header"><User size={14} /><h3>Owners</h3></div>
                            {primaryOwner ? (
                                <div className="drawer-owners-list">
                                    {allOwners.slice(0, 3).map((name, i) => (
                                        <div key={i} className="drawer-owner-card">
                                            <div className="drawer-owner-avatar">{name.charAt(0)}</div>
                                            <div className="drawer-owner-info"><span className="drawer-owner-name">{name}</span></div>
                                        </div>
                                    ))}
                                </div>
                            ) : <div className="drawer-empty-state"><p>No owners assigned</p></div>}
                        </section>

                        {certConfig && (
                            <section className="drawer-section">
                                <div className="drawer-section-header"><Shield size={14} /><h3>Certification</h3></div>
                                <div className="drawer-cert-detail">
                                    <span className={`drawer-cert-badge ${certConfig.className}`}>
                                        {certConfig.icon}
                                        {certConfig.label}
                                    </span>
                                </div>
                            </section>
                        )}

                        {classifications.length > 0 && (
                            <section className="drawer-section">
                                <div className="drawer-section-header"><Tag size={14} /><h3>Classifications</h3></div>
                                <div className="drawer-terms">
                                    {classifications.map((cls: any, i: number) => (
                                        <span key={i} className="drawer-classification">{getClassificationDisplayName(cls)}</span>
                                    ))}
                                </div>
                            </section>
                        )}

                        {allTerms.length > 0 && (
                            <section className="drawer-section">
                                <div className="drawer-section-header"><BookOpen size={14} /><h3>Glossary Terms</h3></div>
                                <div className="drawer-terms">
                                    {allTerms.map((term: any, i: number) => {
                                        const termName = typeof term === 'string' ? term :
                                            (typeof term.name === 'string' ? term.name :
                                             typeof term.displayText === 'string' ? term.displayText :
                                             term.guid || 'Unknown');
                                        return <span key={i} className="drawer-term">{termName}</span>;
                                    })}
                                </div>
                            </section>
                        )}
                    </div>
                )}

                {/* Activity Tab */}
                {!isLoading && asset && activeTab === 'activity' && (
                    <div className="tab-content-inner">
                        <section className="drawer-section">
                            <div className="drawer-section-header"><TrendingUp size={14} /><h3>Popularity</h3></div>
                            <div className="drawer-popularity-score">
                                {popularityScore !== undefined ? (
                                    <div className="popularity-badge" data-level={popularityScore >= 0.8 ? 'hot' : popularityScore >= 0.5 ? 'warm' : 'normal'}>
                                        {popularityScore >= 0.8 ? <Flame size={16} /> : popularityScore >= 0.5 ? <Star size={16} /> : <BarChart3 size={16} />}
                                        <span className="popularity-value">{(popularityScore * 10).toFixed(1)}</span>
                                        <span className="popularity-label">{popularityScore >= 0.8 ? 'Hot Asset' : popularityScore >= 0.5 ? 'Popular' : 'Normal'}</span>
                                    </div>
                                ) : (
                                    <div className="drawer-empty-state"><p>No popularity data</p></div>
                                )}
                            </div>
                        </section>

                        {(sourceReadCount !== undefined || starredCount !== undefined) && (
                            <section className="drawer-section">
                                <div className="drawer-section-header"><Activity size={14} /><h3>Usage Metrics</h3></div>
                                <div className="drawer-metrics-grid">
                                    {sourceReadCount !== undefined && <div className="drawer-metric"><span className="drawer-metric-value">{formatNumber(sourceReadCount)}</span> <span className="drawer-metric-label">Queries</span></div>}
                                    {starredCount !== undefined && <div className="drawer-metric"><span className="drawer-metric-value">{starredCount}</span> <span className="drawer-metric-label">Stars</span></div>}
                                </div>
                            </section>
                        )}

                        <section className="drawer-section">
                            <div className="drawer-section-header"><Calendar size={14} /><h3>Timeline</h3></div>
                            <div className="drawer-metadata-grid">
                                <div className="drawer-metadata-item">
                                    <div className="drawer-meta-icon"><Clock size={14} /></div>
                                    <div className="drawer-meta-content">
                                        <span className="drawer-metadata-label">Last Updated</span>
                                        <span className="drawer-metadata-value">{formatFullDate(updatedAt)}</span>
                                    </div>
                                </div>
                            </div>
                        </section>
                    </div>
                )}

                {/* Quality Tab */}
                {!isLoading && asset && activeTab === 'quality' && (() => {
                    const scores = scoresByGuid?.get(asset.guid);
                    const dimensions = [
                        { key: 'completeness', label: 'Completeness', icon: <Target size={14} />, desc: 'Field coverage' },
                        { key: 'accuracy', label: 'Accuracy', icon: <CheckCircle2 size={14} />, desc: 'Data validity' },
                        { key: 'timeliness', label: 'Timeliness', icon: <Clock size={14} />, desc: 'Data freshness' },
                        { key: 'consistency', label: 'Consistency', icon: <Scale size={14} />, desc: 'Policy compliance' },
                        { key: 'usability', label: 'Usability', icon: <Users size={14} />, desc: 'User engagement' },
                    ];
                    return (
                        <div className="tab-content-inner">
                            <section className="drawer-section">
                                <div className="drawer-section-header"><Award size={14} /><h3>Overall Score</h3></div>
                                {scores?.overall !== undefined ? (
                                    <div className="quality-overall-badge" data-score={scores.overall >= 80 ? 'high' : scores.overall >= 60 ? 'medium' : 'low'}>
                                        <span className="quality-overall-value">{scores.overall}</span>
                                        <span className="quality-overall-label">Quality Score</span>
                                    </div>
                                ) : (
                                    <div className="drawer-empty-state"><p>No quality score available</p></div>
                                )}
                            </section>

                            {scores && (
                                <section className="drawer-section">
                                    <div className="drawer-section-header"><BarChart3 size={14} /><h3>Dimensions</h3></div>
                                    <div className="quality-dimensions">
                                        {dimensions.map((dim) => {
                                            const score = scores[dim.key as keyof typeof scores] as number | undefined;
                                            return (
                                                <div key={dim.key} className="quality-dim-row">
                                                    <div className="quality-dim-header">
                                                        {dim.icon}
                                                        <span className="quality-dim-label">{dim.label}</span>
                                                        <span className="quality-dim-score" data-score={score !== undefined ? (score >= 80 ? 'high' : score >= 60 ? 'medium' : 'low') : 'none'}>
                                                            {score !== undefined ? `${score}%` : '—'}
                                                        </span>
                                                    </div>
                                                    {score !== undefined && (
                                                        <div className="quality-dim-bar">
                                                            <div className="quality-dim-fill" style={{ width: `${score}%` }} data-score={score >= 80 ? 'high' : score >= 60 ? 'medium' : 'low'}></div>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </section>
                            )}
                        </div>
                    );
                })()}

                {/* Lineage Tab */}
                {!isLoading && asset && activeTab === 'lineage' && (
                    <div className="tab-content-inner">
                        <section className="drawer-section">
                            <div className="drawer-section-header"><GitBranch size={14} /><h3>Lineage Status</h3></div>
                            {(asset as any).__hasLineage ? (
                                <div className="lineage-status lineage-available">
                                    <div className="lineage-icon"><GitBranch size={24} /></div>
                                    <div className="lineage-info">
                                        <span className="lineage-title">Lineage Available</span>
                                        <span className="lineage-desc">This asset has upstream and/or downstream connections</span>
                                    </div>
                                </div>
                            ) : (
                                <div className="lineage-status lineage-none">
                                    <div className="lineage-icon"><GitBranch size={24} /></div>
                                    <div className="lineage-info">
                                        <span className="lineage-title">No Lineage Data</span>
                                        <span className="lineage-desc">Lineage has not been captured for this asset yet</span>
                                    </div>
                                </div>
                            )}
                        </section>
                    </div>
                )}

                {/* Docs Tab */}
                {!isLoading && asset && activeTab === 'docs' && (() => {
                    const readme = attrs.readme || (asset as any).readme;
                    const links = attrs.links || (asset as any).links || [];
                    const files = attrs.files || (asset as any).files || [];
                    return (
                        <div className="tab-content-inner">
                            <section className="drawer-section">
                                <div className="drawer-section-header"><BookOpen size={14} /><h3>README</h3></div>
                                {readme ? (
                                    <div className="drawer-readme">{readme}</div>
                                ) : (
                                    <div className="drawer-empty-state"><p>No README available</p></div>
                                )}
                            </section>

                            {links.length > 0 && (
                                <section className="drawer-section">
                                    <div className="drawer-section-header"><Link2 size={14} /><h3>External Links</h3></div>
                                    <div className="drawer-links-list">
                                        {links.map((link: any, i: number) => (
                                            <a key={i} href={typeof link === 'string' ? link : link.url} target="_blank" rel="noopener noreferrer" className="drawer-link-item">
                                                <ExternalLink size={12} />
                                                <span>{typeof link === 'string' ? link : link.name || link.url}</span>
                                            </a>
                                        ))}
                                    </div>
                                </section>
                            )}

                            {files.length > 0 && (
                                <section className="drawer-section">
                                    <div className="drawer-section-header"><FileText size={14} /><h3>Attached Files</h3></div>
                                    <div className="drawer-files-list">
                                        {files.map((file: any, i: number) => {
                                            const fileName = typeof file === 'string' ? file :
                                                (typeof file.name === 'string' ? file.name :
                                                 typeof file.guid === 'string' ? file.guid : 'File');
                                            return (
                                                <div key={i} className="drawer-file-item">
                                                    <FileText size={12} />
                                                    <span>{fileName}</span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </section>
                            )}
                        </div>
                    );
                })()}

                {/* Metadata Tab */}
                {!isLoading && asset && activeTab === 'metadata' && (() => {
                    const typeName = asset.typeName?.toLowerCase() || '';
                    const columnCount = attrs.columnCount || (asset as any).columnCount;
                    const schemaCount = attrs.schemaCount || (asset as any).schemaCount;
                    const tableCount = attrs.tableCount || (asset as any).tableCount;
                    const viewCount = attrs.viewCount || (asset as any).viewCount;
                    const sizeBytes = attrs.sizeBytes || (asset as any).sizeBytes;
                    const isPartitioned = attrs.isPartitioned || (asset as any).isPartitioned;
                    const partitionCount = attrs.partitionCount || (asset as any).partitionCount;
                    const connectionName = attrs.connectionName || (asset as any).connectionName;
                    const databaseName = attrs.databaseName || (asset as any).databaseName;
                    const schemaName = attrs.schemaName || (asset as any).schemaName;

                    return (
                        <div className="tab-content-inner">
                            <section className="drawer-section">
                                <div className="drawer-section-header"><Database size={14} /><h3>Type Information</h3></div>
                                <div className="drawer-metadata-grid">
                                    <div className="drawer-metadata-item">
                                        <div className="drawer-meta-icon">{getAssetTypeIcon(asset.typeName)}</div>
                                        <div className="drawer-meta-content">
                                            <span className="drawer-metadata-label">Asset Type</span>
                                            <span className="drawer-metadata-value">{asset.typeName}</span>
                                        </div>
                                    </div>
                                    {connectionName && (
                                        <div className="drawer-metadata-item">
                                            <div className="drawer-meta-icon"><Globe size={14} /></div>
                                            <div className="drawer-meta-content">
                                                <span className="drawer-metadata-label">Connection</span>
                                                <span className="drawer-metadata-value">{connectionName}</span>
                                            </div>
                                        </div>
                                    )}
                                    {databaseName && (
                                        <div className="drawer-metadata-item">
                                            <div className="drawer-meta-icon"><Database size={14} /></div>
                                            <div className="drawer-meta-content">
                                                <span className="drawer-metadata-label">Database</span>
                                                <span className="drawer-metadata-value">{databaseName}</span>
                                            </div>
                                        </div>
                                    )}
                                    {schemaName && (
                                        <div className="drawer-metadata-item">
                                            <div className="drawer-meta-icon"><Layers size={14} /></div>
                                            <div className="drawer-meta-content">
                                                <span className="drawer-metadata-label">Schema</span>
                                                <span className="drawer-metadata-value">{schemaName}</span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </section>

                            {(columnCount !== undefined || rowCount !== undefined || sizeBytes !== undefined) && (
                                <section className="drawer-section">
                                    <div className="drawer-section-header"><Table2 size={14} /><h3>Statistics</h3></div>
                                    <div className="drawer-metrics-grid">
                                        {columnCount !== undefined && <div className="drawer-metric"><span className="drawer-metric-value">{formatNumber(columnCount)}</span> <span className="drawer-metric-label">Columns</span></div>}
                                        {rowCount !== undefined && <div className="drawer-metric"><span className="drawer-metric-value">{formatNumber(rowCount)}</span> <span className="drawer-metric-label">Rows</span></div>}
                                        {sizeBytes !== undefined && <div className="drawer-metric"><span className="drawer-metric-value">{(sizeBytes / 1024 / 1024).toFixed(1)}</span> <span className="drawer-metric-label">MB</span></div>}
                                    </div>
                                </section>
                            )}

                            {(schemaCount !== undefined || tableCount !== undefined || viewCount !== undefined) && (
                                <section className="drawer-section">
                                    <div className="drawer-section-header"><Layers size={14} /><h3>Contents</h3></div>
                                    <div className="drawer-metrics-grid">
                                        {schemaCount !== undefined && <div className="drawer-metric"><span className="drawer-metric-value">{formatNumber(schemaCount)}</span> <span className="drawer-metric-label">Schemas</span></div>}
                                        {tableCount !== undefined && <div className="drawer-metric"><span className="drawer-metric-value">{formatNumber(tableCount)}</span> <span className="drawer-metric-label">Tables</span></div>}
                                        {viewCount !== undefined && <div className="drawer-metric"><span className="drawer-metric-value">{formatNumber(viewCount)}</span> <span className="drawer-metric-label">Views</span></div>}
                                    </div>
                                </section>
                            )}

                            {isPartitioned && (
                                <section className="drawer-section">
                                    <div className="drawer-section-header"><Settings2 size={14} /><h3>Partitioning</h3></div>
                                    <div className="drawer-metadata-grid">
                                        <div className="drawer-metadata-item">
                                            <div className="drawer-meta-icon"><CheckCircle2 size={14} /></div>
                                            <div className="drawer-meta-content">
                                                <span className="drawer-metadata-label">Partitioned</span>
                                                <span className="drawer-metadata-value">Yes{partitionCount ? ` (${formatNumber(partitionCount)} partitions)` : ''}</span>
                                            </div>
                                        </div>
                                    </div>
                                </section>
                            )}

                            <section className="drawer-section">
                                <div className="drawer-section-header"><Calendar size={14} /><h3>Timestamps</h3></div>
                                <div className="drawer-metadata-grid">
                                    <div className="drawer-metadata-item">
                                        <div className="drawer-meta-icon"><Clock size={14} /></div>
                                        <div className="drawer-meta-content">
                                            <span className="drawer-metadata-label">Last Updated</span>
                                            <span className="drawer-metadata-value">{formatFullDate(updatedAt)}</span>
                                        </div>
                                    </div>
                                </div>
                            </section>
                        </div>
                    );
                })()}
            </div>

            <footer className="tab-footer">
                <button className="drawer-action-primary">
                    <ExternalLink size={14} />
                    Open in Atlan
                </button>
            </footer>
        </div>
    );
}
