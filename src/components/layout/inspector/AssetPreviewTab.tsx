/**
 * Asset Preview Tab Content
 * 
 * Extracted from AssetPreviewDrawer.tsx to be used in the Inspector Sidebar.
 */

import { useState, useEffect, useCallback } from 'react';
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
    Hash
} from 'lucide-react';
import type { AtlanAsset } from '../../../services/atlan/types';
import { getClassificationTypeDefs, getBusinessMetadataTypeDefs } from '../../../services/atlan/api';
import './AssetPreviewTab.css';

interface AssetPreviewTabProps {
    asset: AtlanAsset | null;
    isLoading?: boolean;
}

export function AssetPreviewTab({ asset, isLoading = false }: AssetPreviewTabProps) {
    const [copiedField, setCopiedField] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'overview' | 'lineage' | 'activity'>('overview');

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

                <nav className="drawer-tabs">
                    <button className={`drawer-tab ${activeTab === 'overview' ? 'active' : ''}`} onClick={() => setActiveTab('overview')}>Overview</button>
                    <button className={`drawer-tab ${activeTab === 'lineage' ? 'active' : ''}`} onClick={() => setActiveTab('lineage')}>Lineage</button>
                    <button className={`drawer-tab ${activeTab === 'activity' ? 'active' : ''}`} onClick={() => setActiveTab('activity')}>Activity</button>
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
                                    {allTerms.map((term: any, i: number) => (
                                        <span key={i} className="drawer-term">{term.name || term.displayText}</span>
                                    ))}
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

                {!isLoading && asset && activeTab === 'lineage' && (
                    <div className="tab-placeholder">
                        <Layers size={32} />
                        <p>Lineage Preview Coming Soon</p>
                    </div>
                )}

                {!isLoading && asset && activeTab === 'activity' && (
                    <div className="tab-placeholder">
                        <Clock size={32} />
                        <p>Recent Activity Coming Soon</p>
                    </div>
                )}
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
