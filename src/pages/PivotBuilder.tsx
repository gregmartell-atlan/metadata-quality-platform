import { useState } from 'react';
import { Button, ConfirmModal } from '../components/shared';
import { DemoPivots } from '../components/pivot/DemoPivots';
import { RealPivotBuilder } from '../components/pivot/RealPivotBuilder';
import { PreBuiltPivots } from '../components/pivot/PreBuiltPivots';
import { useAssetStore } from '../stores/assetStore';
import { usePivotStore } from '../stores/pivotStore';
import './PivotBuilder.css';

export function PivotBuilder() {
  const { selectedAssets, selectedCount } = useAssetStore();
  const { views, getCurrentView, setCurrentView, deleteView } = usePivotStore();
  const [showDemo, setShowDemo] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'accountability' | 'domain' | 'lineage' | 'custom'>('all');
  const [deleteViewId, setDeleteViewId] = useState<string | null>(null);
  const currentView = getCurrentView();

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
        <header className="header">
          <div>
            <h1>Pivot Builder</h1>
            {selectedCount > 0 && (
              <span style={{ marginLeft: '1rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                {selectedCount} asset{selectedCount !== 1 ? 's' : ''} selected
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

