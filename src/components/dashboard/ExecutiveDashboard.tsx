import { AppHeader } from '../layout/AppHeader';
import { BreadcrumbNav } from '../layout/BreadcrumbNav';
import { Button } from '../shared';
import { useState, useEffect, useCallback } from 'react';
import { Edit3, LayoutTemplate, Save, RotateCcw, Camera, Clock } from 'lucide-react';
import { DashboardGrid } from './DashboardGrid';
import { WidgetPickerPanel } from './WidgetPickerPanel';
import { TemplateSelectorModal } from './TemplateSelectorModal';
import { RecentSnapshotsPanel } from './RecentSnapshotsPanel';
import { useDashboardLayoutStore } from '../../stores/dashboardLayoutStore';
import { useScoresStore } from '../../stores/scoresStore';
import { useQualitySnapshotStore } from '../../stores/qualitySnapshotStore';
import { useAssetContextStore } from '../../stores/assetContextStore';
import './ExecutiveDashboard.css';
import './widgets'; // Import to trigger widget registration

export function ExecutiveDashboard() {
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [showSnapshotsPanel, setShowSnapshotsPanel] = useState(false);
  const { assetsWithScores, stats } = useScoresStore();
  const { isEditMode, toggleEditMode, activeTemplateId, resetToTemplate, setActiveTemplate, currentLayouts } = useDashboardLayoutStore();
  const { captureSnapshot, snapshots } = useQualitySnapshotStore();
  const { context } = useAssetContextStore();

  // Initialize default template on first load
  useEffect(() => {
    if (currentLayouts.lg.length === 0) {
      setActiveTemplate('executive');
    }
  }, []);

  useEffect(() => {
    // Update last updated time when scores are calculated
    if (assetsWithScores.length > 0) {
      setLastUpdated(new Date());
    }
  }, [assetsWithScores]);

  const handleRefresh = () => {
    setLastUpdated(new Date());
    window.dispatchEvent(new CustomEvent('dashboard-refresh'));
  };

  const handleResetLayout = () => {
    if (activeTemplateId && confirm('Reset dashboard to template? This will discard all customizations.')) {
      resetToTemplate(activeTemplateId);
    }
  };

  const handleCaptureSnapshot = useCallback(() => {
    if (assetsWithScores.length === 0) return;

    const label = context?.label
      ? `${context.label} snapshot`
      : `All assets snapshot`;

    const queryParams = context?.filters
      ? {
          connectionFilter: context.filters.connectionName,
          domainFilter: context.filters.databaseName, // Using databaseName as domain proxy
          searchQuery: undefined,
        }
      : undefined;

    captureSnapshot(
      label,
      assetsWithScores.map(({ metadata, scores }) => ({ metadata, scores })),
      stats,
      queryParams
    );

    // Brief visual feedback
    setShowSnapshotsPanel(true);
  }, [assetsWithScores, stats, context, captureSnapshot]);

  const getTimeAgo = (date: Date) => {
    const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  return (
    <div className="executive-dashboard">
      <AppHeader
        title="Executive Overview"
        subtitle={`Last updated ${getTimeAgo(lastUpdated)}`}
      >
        {/* Edit mode controls */}
        {isEditMode && (
          <>
            <WidgetPickerPanel />
            <Button
              variant="secondary"
              onClick={handleResetLayout}
              className="reset-btn"
            >
              <RotateCcw size={14} />
              Reset
            </Button>
          </>
        )}

        {/* Snapshot controls */}
        <Button
          variant="secondary"
          onClick={handleCaptureSnapshot}
          disabled={assetsWithScores.length === 0}
          className="snapshot-btn"
          title="Capture current state as snapshot"
        >
          <Camera size={14} />
          Snapshot
        </Button>

        <Button
          variant={showSnapshotsPanel ? 'primary' : 'secondary'}
          onClick={() => setShowSnapshotsPanel(!showSnapshotsPanel)}
          className="history-btn"
          title="View recent snapshots"
        >
          <Clock size={14} />
          History
          {snapshots.length > 0 && (
            <span className="snapshot-count">{snapshots.length}</span>
          )}
        </Button>

        {/* Template selector */}
        <Button
          variant="secondary"
          onClick={() => setShowTemplateModal(true)}
          className="template-btn"
        >
          <LayoutTemplate size={14} />
          Template
        </Button>

        {/* Edit mode toggle */}
        <Button
          variant={isEditMode ? 'primary' : 'secondary'}
          onClick={toggleEditMode}
          className="edit-btn"
        >
          {isEditMode ? <Save size={14} /> : <Edit3 size={14} />}
          {isEditMode ? 'Done' : 'Edit'}
        </Button>

        {/* Refresh button */}
        <Button variant="primary" onClick={handleRefresh} className="refresh-btn">
          Refresh
        </Button>
      </AppHeader>

      {/* Breadcrumb navigation for context */}
      <BreadcrumbNav />

      {/* Edit mode banner */}
      {isEditMode && (
        <div className="edit-mode-banner">
          Edit mode active - Drag widgets to reposition, resize by dragging corners, or add new widgets
        </div>
      )}

      {/* Dashboard grid - uses react-grid-layout for consistent positioning */}
      <DashboardGrid />

      {/* Template selector modal */}
      <TemplateSelectorModal
        isOpen={showTemplateModal}
        onClose={() => setShowTemplateModal(false)}
      />

      {/* Recent snapshots panel */}
      <RecentSnapshotsPanel
        isOpen={showSnapshotsPanel}
        onClose={() => setShowSnapshotsPanel(false)}
        onCaptureSnapshot={handleCaptureSnapshot}
      />
    </div>
  );
}
