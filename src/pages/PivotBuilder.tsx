import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, ConfirmModal } from '../components/shared';
import { AppHeader } from '../components/layout/AppHeader';
import { RealPivotBuilder } from '../components/pivot/RealPivotBuilder';
import { PreBuiltPivots } from '../components/pivot/PreBuiltPivots';
import { useAssetStore } from '../stores/assetStore';
import { useAssetContextStore } from '../stores/assetContextStore';
import { usePivotStore } from '../stores/pivotStore';
import { useRightSidebarStore } from '../stores/rightSidebarStore';
import { GitBranch, Sliders, Camera, Download, LayoutTemplate, Settings2 } from 'lucide-react';
import { HeaderToolbar, HeaderActionGroup, HeaderButton, HeaderDivider } from '../components/layout/HeaderActions';
import './PivotBuilder.css';

export function PivotBuilder() {
  const navigate = useNavigate();
  const { selectedAssets, selectedCount, addAsset } = useAssetStore();
  const contextAssets = useAssetContextStore((state) => state.contextAssets);
  const getAssetCount = useAssetContextStore((state) => state.getAssetCount);
  const { views, getCurrentView, setCurrentView, deleteView } = usePivotStore();
  const [activeTab, setActiveTab] = useState<'all' | 'accountability' | 'domain' | 'lineage' | 'custom'>('all');
  const [deleteViewId, setDeleteViewId] = useState<string | null>(null);
  const { toggleTab, activeTab: sidebarTab, isOpen: isSidebarOpen } = useRightSidebarStore();
  const currentView = getCurrentView();

  const effectiveAssets = contextAssets.length > 0 ? contextAssets : selectedAssets;
  const effectiveCount = contextAssets.length > 0 ? getAssetCount() : selectedCount;

  const handleViewLineage = () => {
    if (effectiveAssets.length > 0) {
      const firstAsset = effectiveAssets[0];
      addAsset(firstAsset);
      navigate(`/lineage?guid=${firstAsset.guid}`);
    }
  };

  const handleLoadView = (viewId: string) => {
    setCurrentView(viewId);
  };

  const handleDeleteConfirm = () => {
    if (deleteViewId) {
      deleteView(deleteViewId);
      setDeleteViewId(null);
    }
  };

  return (
    <div className="pivot-builder-page">
      <AppHeader title="Pivot Builder">
        <HeaderToolbar>
          <HeaderActionGroup>
            {/* View Selector mocked as a button for now, or keep the select if essential. 
                For cleanliness, let's keep the select but wrap it nicely or leave it as is 
                next to the toolbar. For now I will leave it outside the toolbar groups 
                but inside the toolbar container. */}
            {views.length > 0 && (
              <div className="header-select-wrapper">
                <select
                  value={currentView?.id || ''}
                  onChange={(e) => {
                    if (e.target.value) handleLoadView(e.target.value);
                    else setCurrentView(null);
                  }}
                  className="view-select-minimal"
                  title="Load Saved View"
                >
                  <option value="">Select View...</option>
                  {views.map((view) => (
                    <option key={view.id} value={view.id}>{view.name}</option>
                  ))}
                </select>
              </div>
            )}

            <HeaderButton
              icon={<LayoutTemplate />}
              onClick={() => setActiveTab('custom')}
              active={activeTab === 'custom'}
              title="Custom Builder"
            />
          </HeaderActionGroup>

          <HeaderDivider />

          {/* Navigation & Context Actions */}
          <HeaderActionGroup>
            {effectiveAssets.length > 0 && (
              <HeaderButton
                icon={<GitBranch />}
                onClick={handleViewLineage}
                title="View Lineage for Context"
              />
            )}
            <HeaderButton
              icon={<Settings2 />}
              onClick={() => toggleTab('config')}
              active={isSidebarOpen && sidebarTab === 'config'}
              title="Configure Pivot"
            />
          </HeaderActionGroup>

          <HeaderDivider />

          {/* Global Actions (Snapshot/Export) */}
          <HeaderActionGroup>
            <HeaderButton icon={<Camera />} disabled title="Snapshot (Coming Soon)" />
            <HeaderButton icon={<Download />} title="Export to CSV" />
          </HeaderActionGroup>

          {/* Demo Toggle */}


        </HeaderToolbar>
      </AppHeader>



      <div className="pivot-content">
        <div className="tabs">
          <button
            className={`tab ${activeTab === 'all' ? 'active' : ''}`}
            onClick={() => setActiveTab('all')}
          >
            All Pivots
          </button>
          <button
            className={`tab ${activeTab === 'accountability' ? 'active' : ''}`}
            onClick={() => setActiveTab('accountability')}
          >
            Accountability
          </button>
          <button
            className={`tab ${activeTab === 'domain' ? 'active' : ''}`}
            onClick={() => setActiveTab('domain')}
          >
            Domain Health
          </button>
          <button
            className={`tab ${activeTab === 'lineage' ? 'active' : ''}`}
            onClick={() => setActiveTab('lineage')}
          >
            Lineage Coverage
          </button>
          <button
            className={`tab ${activeTab === 'custom' ? 'active' : ''}`}
            onClick={() => setActiveTab('custom')}
          >
            Custom Builder
          </button>
        </div>

        {activeTab === 'custom' ? (
          <RealPivotBuilder />
        ) : (
          <PreBuiltPivots />
        )}
      </div>

      <ConfirmModal
        isOpen={deleteViewId !== null}
        onClose={() => setDeleteViewId(null)}
        onConfirm={handleDeleteConfirm}
        title="Delete Pivot View"
        message="Are you sure you want to delete this pivot view? This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        variant="danger"
      />
    </div>
  );
}
