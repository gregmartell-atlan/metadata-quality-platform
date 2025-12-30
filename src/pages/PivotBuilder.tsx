import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, ConfirmModal } from '../components/shared';
import { AssetContext } from '../components/AssetContext';
import { DemoPivots } from '../components/pivot/DemoPivots';
import { RealPivotBuilder } from '../components/pivot/RealPivotBuilder';
import { PreBuiltPivots } from '../components/pivot/PreBuiltPivots';
import { useAssetStore } from '../stores/assetStore';
import { useAssetContextStore } from '../stores/assetContextStore';
import { usePivotStore } from '../stores/pivotStore';
import { GitBranch } from 'lucide-react';
import './PivotBuilder.css';

export function PivotBuilder() {
  const navigate = useNavigate();
  const { selectedAssets, selectedCount, addAsset } = useAssetStore();
  // Subscribe directly to store state to get reactive updates
  const contextAssets = useAssetContextStore((state) => state.contextAssets);
  const getAssetCount = useAssetContextStore((state) => state.getAssetCount);
  const { views, getCurrentView, setCurrentView, deleteView } = usePivotStore();
  const [showDemo, setShowDemo] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'accountability' | 'domain' | 'lineage' | 'custom'>('all');
  const [deleteViewId, setDeleteViewId] = useState<string | null>(null);
  const currentView = getCurrentView();
  
  // Use context assets if available, fallback to selectedAssets for backward compatibility
  const effectiveAssets = contextAssets.length > 0 ? contextAssets : selectedAssets;
  const effectiveCount = contextAssets.length > 0 ? getAssetCount() : selectedCount;
  
  const handleViewLineage = () => {
    if (effectiveAssets.length > 0) {
      const firstAsset = effectiveAssets[0];
      addAsset(firstAsset);
      navigate(`/lineage?guid=${firstAsset.guid}`);
    }
  };

  const handleSaveView = () => {
    // This will be triggered from RealPivotBuilder
  };

  const handleLoadView = (viewId: string) => {
    setCurrentView(viewId);
  };

  const handleDeleteClick = (viewId: string) => {
    setDeleteViewId(viewId);
  };

  const handleDeleteConfirm = () => {
    if (deleteViewId) {
      deleteView(deleteViewId);
      setDeleteViewId(null);
    }
  };

  return (
    <div className="pivot-builder-page">
      <div className="container">
        {/* Asset Context Header */}
        <AssetContext />
        
        <header className="header">
          <div>
            <h1>Pivot Builder</h1>
            {effectiveCount > 0 && (
              <span style={{ marginLeft: '1rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                {effectiveCount} asset{effectiveCount !== 1 ? 's' : ''} in context
              </span>
            )}
          </div>
          <div className="header-actions">
            {views.length > 0 && (
              <select
                value={currentView?.id || ''}
                onChange={(e) => {
                  if (e.target.value) {
                    handleLoadView(e.target.value);
                  } else {
                    setCurrentView(null);
                  }
                }}
                style={{
                  padding: '0.5rem 1rem',
                  borderRadius: '4px',
                  border: '1px solid var(--border-color)',
                  background: 'var(--bg-primary)',
                  color: 'var(--text-primary)',
                  marginRight: '0.5rem',
                }}
              >
                <option value="">No view loaded</option>
                {views.map((view) => (
                  <option key={view.id} value={view.id}>
                    {view.name}
                  </option>
                ))}
              </select>
            )}
            {effectiveAssets.length > 0 && (
              <Button
                variant="secondary"
                onClick={handleViewLineage}
                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <GitBranch size={16} />
                View Lineage
              </Button>
            )}
            <Button variant="secondary" onClick={() => setShowDemo(!showDemo)}>
              {showDemo ? 'Show Real Data' : 'Show Demo'}
            </Button>
            <Button variant="secondary">Export CSV</Button>
          </div>
        </header>

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

        {showDemo ? (
          <DemoPivots />
        ) : activeTab === 'custom' ? (
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

