import { AppHeader } from '../layout/AppHeader';
import { HeaderToolbar, HeaderActionGroup, HeaderButton, HeaderDivider } from '../layout/HeaderActions';
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
import { useRightSidebarStore } from '../../stores/rightSidebarStore';
import './ExecutiveDashboard.css';
import './widgets'; // Import to trigger widget registration

export function ExecutiveDashboard() {
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const { activeTab, isOpen: isSidebarOpen, toggleTab } = useRightSidebarStore();
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

    // Brief visual feedback - open the history tab
    if (activeTab !== 'history' || !isSidebarOpen) {
      toggleTab('history');
    }
  }, [assetsWithScores.length, stats, context, captureSnapshot, activeTab, isSidebarOpen, toggleTab]);

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
      <AppHeader title="Executive Overview">
        <HeaderToolbar>
          {/* Action Group: View & Edit */}
          <HeaderActionGroup>
            <HeaderButton
              icon={<LayoutTemplate />}
              onClick={() => setShowTemplateModal(true)}
              title="Switch Dashboard Template"
            />

            <HeaderButton
              icon={isEditMode ? <Save /> : <Edit3 />}
              active={isEditMode}
              onClick={toggleEditMode}
              title={isEditMode ? "Finish Editing" : "Edit Layout"}
            />

            {isEditMode && (
              <HeaderButton
                icon={<RotateCcw />}
                onClick={handleResetLayout}
                title="Reset Layout"
              />
            )}
          </HeaderActionGroup>

          {isEditMode && <WidgetPickerPanel />}

          <HeaderDivider />

          {/* Action Group: History & Snapshots */}
          <HeaderActionGroup>
            <HeaderButton
              icon={<Camera />}
              onClick={handleCaptureSnapshot}
              disabled={assetsWithScores.length === 0}
              title="Take Snapshot"
            />

            <HeaderButton
              icon={<Clock />}
              active={isSidebarOpen && activeTab === 'history'}
              badge={snapshots.length > 0}
              onClick={() => toggleTab('history')}
              title="View History"
            />
          </HeaderActionGroup>

          <HeaderDivider />

          {/* Primary Refresh */}
          <HeaderActionGroup>
            <HeaderButton
              icon={<RotateCcw />}
              onClick={handleRefresh}
              title="Refresh Data"
            />
          </HeaderActionGroup>
        </HeaderToolbar>
      </AppHeader>

      {/* Breadcrumb navigation removed - now in AppHeader */}

      {/* Last updated info move from header to body */}
      <div className="dashboard-last-updated">
        Last updated {getTimeAgo(lastUpdated)}
      </div>

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

      {/* Recent snapshots panel removed - now handled by RightInspectorSidebar */}
    </div>
  );
}
