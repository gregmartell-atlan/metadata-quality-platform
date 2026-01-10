import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ConfirmModal } from '../components/shared';
import { RealPivotBuilder } from '../components/pivot/RealPivotBuilder';
import { PreBuiltPivots } from '../components/pivot/PreBuiltPivots';
import { useAssetStore } from '../stores/assetStore';
import { useAssetContextStore } from '../stores/assetContextStore';
import { usePivotStore } from '../stores/pivotStore';
import { useRightSidebarStore } from '../stores/rightSidebarStore';
import { usePageActionsStore, type PageAction } from '../stores/pageActionsStore';
import { GitBranch, Camera, Download, LayoutTemplate, Settings2 } from 'lucide-react';
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

  // Page actions store
  const { setActions, clearActions, setPageSubtitle } = usePageActionsStore();

  const effectiveAssets = contextAssets.length > 0 ? contextAssets : selectedAssets;
  const effectiveCount = contextAssets.length > 0 ? getAssetCount() : selectedCount;

  const handleViewLineage = useCallback(() => {
    if (effectiveAssets.length > 0) {
      const firstAsset = effectiveAssets[0];
      addAsset(firstAsset);
      navigate(`/lineage?guid=${firstAsset.guid}`);
    }
  }, [effectiveAssets, addAsset, navigate]);

  const handleLoadView = (viewId: string) => {
    setCurrentView(viewId);
  };

  const handleDeleteConfirm = () => {
    if (deleteViewId) {
      deleteView(deleteViewId);
      setDeleteViewId(null);
    }
  };

  const handleExportCSV = useCallback(() => {
    // Dispatch event for pivot table to export
    window.dispatchEvent(new CustomEvent('pivot-export-csv'));
  }, []);

  // Update page subtitle based on context
  useEffect(() => {
    if (effectiveCount > 0) {
      setPageSubtitle(`${effectiveCount.toLocaleString()} assets`);
    } else {
      setPageSubtitle(null);
    }
  }, [effectiveCount, setPageSubtitle]);

  // Register page actions with the header
  useEffect(() => {
    const actions: PageAction[] = [
      // View group - custom builder and config
      {
        id: 'custom-builder',
        icon: <LayoutTemplate size={16} />,
        title: 'Custom Builder',
        onClick: () => setActiveTab('custom'),
        active: activeTab === 'custom',
        group: 'view',
      },
      {
        id: 'config',
        icon: <Settings2 size={16} />,
        title: 'Configure Pivot',
        onClick: () => toggleTab('config'),
        active: isSidebarOpen && sidebarTab === 'config',
        group: 'view',
      },
    ];

    // Add lineage button if we have assets
    if (effectiveAssets.length > 0) {
      actions.push({
        id: 'lineage',
        icon: <GitBranch size={16} />,
        title: 'View Lineage for Context',
        onClick: handleViewLineage,
        group: 'view',
      });
    }

    // Export group
    actions.push(
      {
        id: 'snapshot',
        icon: <Camera size={16} />,
        title: 'Snapshot (Coming Soon)',
        onClick: () => {},
        disabled: true,
        group: 'export',
      },
      {
        id: 'export-csv',
        icon: <Download size={16} />,
        title: 'Export to CSV',
        onClick: handleExportCSV,
        group: 'export',
      }
    );

    setActions(actions);

    return () => {
      clearActions();
    };
  }, [
    activeTab,
    setActiveTab,
    effectiveAssets.length,
    handleViewLineage,
    handleExportCSV,
    toggleTab,
    sidebarTab,
    isSidebarOpen,
    setActions,
    clearActions,
  ]);

  return (
    <div className="pivot-builder-page">
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
