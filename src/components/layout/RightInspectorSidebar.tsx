/**
 * Right Inspector Sidebar
 * 
 * Unified side panel for asset preview, configuration, and history.
 */

import { Info, Sliders, Clock, X, HelpCircle, Zap } from 'lucide-react';
import { useRightSidebarStore, RightSidebarTab } from '../../stores/rightSidebarStore';
import { useAssetPreviewStore } from '../../stores/assetPreviewStore';
import { useEffect } from 'react';
import './RightInspectorSidebar.css';

// Content Components
import { AssetPreviewTab } from './inspector/AssetPreviewTab';
import { ConfigTab } from './inspector/ConfigTab';
import { HistoryTab } from './inspector/HistoryTab';
import { RemediationTab } from './inspector/RemediationTab';

export function RightInspectorSidebar() {
    const { activeTab, isOpen, toggleTab, close } = useRightSidebarStore();
    const { selectedAsset, selectedAssets, isOpen: isAssetOpen, isLoading: isAssetLoading, closePreview, openPreview } = useAssetPreviewStore();

    // Sync with Asset Preview Store
    useEffect(() => {
        if (isAssetOpen) {
            // Force the sidebar to open and show the asset tab
            if (activeTab !== 'asset' || !isOpen) {
                useRightSidebarStore.getState().setActiveTab('asset');
            }
        }
    }, [isAssetOpen]);

    const handleClose = () => {
        close();
        if (isAssetOpen) closePreview();
    };

    const getTitle = () => {
        switch (activeTab) {
            case 'asset': return 'Asset Preview';
            case 'config': return 'View Configuration';
            case 'history': return 'Snapshot History';
            case 'remediation': return 'Remediation Plan';
            default: return 'Inspector';
        }
    };

    const getIcon = (tab: RightSidebarTab) => {
        switch (tab) {
            case 'asset': return <Info size={18} />;
            case 'config': return <Sliders size={18} />;
            case 'history': return <Clock size={18} />;
            case 'remediation': return <Zap size={18} />;
            default: return null;
        }
    };

    return (
        <div className="right-inspector-sidebar">
            {/* Expandable Panel */}
            <div className={`inspector-panel ${!isOpen ? 'collapsed' : ''}`}>
                <div className="inspector-header">
                    <h2>
                        {activeTab && getIcon(activeTab)}
                        {getTitle()}
                    </h2>
                    <button className="inspector-close-btn" onClick={handleClose}>
                        <X size={18} />
                    </button>
                </div>

                <div className="inspector-body">
                    {activeTab === 'asset' && (
                        <AssetPreviewTab
                            asset={selectedAsset}
                            assets={selectedAssets}
                            isLoading={isAssetLoading}
                            onAssetSelect={openPreview}
                        />
                    )}

                    {activeTab === 'config' && (
                        <ConfigTab />
                    )}

                    {activeTab === 'history' && (
                        <HistoryTab />
                    )}

                    {activeTab === 'remediation' && (
                        <RemediationTab />
                    )}
                </div>
            </div>

            {/* Persistent Rail */}
            <div className="inspector-rail">
                <button
                    className={`rail-button ${activeTab === 'asset' && isOpen ? 'active' : ''}`}
                    onClick={() => toggleTab('asset')}
                    title="Asset Details"
                >
                    <Info size={18} />
                </button>

                <button
                    className={`rail-button ${activeTab === 'config' && isOpen ? 'active' : ''}`}
                    onClick={() => toggleTab('config')}
                    title="View Configuration"
                >
                    <Sliders size={18} />
                </button>

                <button
                    className={`rail-button ${activeTab === 'history' && isOpen ? 'active' : ''}`}
                    onClick={() => toggleTab('history')}
                    title="Recent History"
                >
                    <Clock size={18} />
                </button>

                <button
                    className={`rail-button ${activeTab === 'remediation' && isOpen ? 'active' : ''}`}
                    onClick={() => toggleTab('remediation')}
                    title="Remediation Plan"
                >
                    <Zap size={18} />
                </button>

                <button
                    className="rail-button rail-button-bottom"
                    onClick={() => { }} // Could be for global search or help
                    title="User Guide & Help"
                >
                    <HelpCircle size={18} />
                </button>
            </div>
        </div>
    );
}
