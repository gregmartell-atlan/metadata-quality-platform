import { useState, useEffect, useCallback } from 'react';
import { Edit3, LayoutTemplate, Save, RotateCcw, Camera, Clock } from 'lucide-react';
import { DashboardGrid } from './DashboardGrid';
import { WidgetPickerPanel } from './WidgetPickerPanel';
import { TemplateSelectorModal } from './TemplateSelectorModal';
import { useDashboardLayoutStore } from '../../stores/dashboardLayoutStore';
import { useScoresStore } from '../../stores/scoresStore';
import { useQualitySnapshotStore } from '../../stores/qualitySnapshotStore';
import { useAssetContextStore } from '../../stores/assetContextStore';
import { useRightSidebarStore } from '../../stores/rightSidebarStore';
import { usePageActionsStore, type PageAction } from '../../stores/pageActionsStore';
import './ExecutiveDashboard.css';
import './widgets'; // Import to trigger widget registration

export function ExecutiveDashboard() {
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const { activeTab, isOpen: isSidebarOpen, toggleTab } = useRightSidebarStore();
  const { assetsWithScores, stats } = useScoresStore();
  const { isEditMode, toggleEditMode, activeTemplateId, resetToTemplate, setActiveTemplate, currentLayouts } = useDashboardLayoutStore();
  const { captureSnapshot, snapshots } = useQualitySnapshotStore();
  const { context } = useAssetContextStore();

  // Page actions store
  const { setActions, setLastUpdated, clearActions } = usePageActionsStore();

  // Track last updated time
  const [lastUpdatedTime, setLastUpdatedTime] = useState<Date>(new Date());

  // Initialize default template on first load
  useEffect(() => {
    if (currentLayouts.lg.length === 0) {
      setActiveTemplate('executive');
    }
  }, []);

  useEffect(() => {
    // Update last updated time when scores are calculated
    if (assetsWithScores.length > 0) {
      const now = new Date();
      setLastUpdatedTime(now);
      setLastUpdated(now);
    }
  }, [assetsWithScores, setLastUpdated]);

  const handleRefresh = useCallback(() => {
    const now = new Date();
    setLastUpdatedTime(now);
    setLastUpdated(now);
    window.dispatchEvent(new CustomEvent('dashboard-refresh'));
  }, [setLastUpdated]);

  const handleResetLayout = useCallback(() => {
    if (activeTemplateId && confirm('Reset dashboard to template? This will discard all customizations.')) {
      resetToTemplate(activeTemplateId);
    }
  }, [activeTemplateId, resetToTemplate]);

  const handleCaptureSnapshot = useCallback(() => {
    if (assetsWithScores.length === 0) return;

    const label = context?.label
      ? `${context.label} snapshot`
      : `All assets snapshot`;

    const queryParams = context?.filters
      ? {
        connectionFilter: context.filters.connectionName,
        domainFilter: context.filters.databaseName,
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
  }, [assetsWithScores, stats, context, captureSnapshot, activeTab, isSidebarOpen, toggleTab]);

  // Register page actions with the header
  useEffect(() => {
    const actions: PageAction[] = [
      // View group - template and edit
      {
        id: 'template',
        icon: <LayoutTemplate size={16} />,
        title: 'Switch Dashboard Template',
        onClick: () => setShowTemplateModal(true),
        group: 'view',
      },
      {
        id: 'edit',
        icon: isEditMode ? <Save size={16} /> : <Edit3 size={16} />,
        title: isEditMode ? 'Finish Editing' : 'Edit Layout',
        onClick: toggleEditMode,
        active: isEditMode,
        group: 'view',
      },
      // Capture group - snapshot and history
      {
        id: 'snapshot',
        icon: <Camera size={16} />,
        title: 'Take Snapshot',
        onClick: handleCaptureSnapshot,
        disabled: assetsWithScores.length === 0,
        group: 'capture',
      },
      {
        id: 'history',
        icon: <Clock size={16} />,
        title: 'View History',
        onClick: () => toggleTab('history'),
        active: isSidebarOpen && activeTab === 'history',
        badge: snapshots.length > 0,
        group: 'capture',
      },
      // Settings group - refresh
      {
        id: 'refresh',
        icon: <RotateCcw size={16} />,
        title: 'Refresh Data',
        onClick: handleRefresh,
        group: 'settings',
      },
    ];

    // Add reset button when in edit mode
    if (isEditMode) {
      actions.splice(2, 0, {
        id: 'reset',
        icon: <RotateCcw size={16} />,
        title: 'Reset Layout',
        onClick: handleResetLayout,
        group: 'view',
      });
    }

    setActions(actions);

    return () => {
      clearActions();
    };
  }, [
    isEditMode,
    toggleEditMode,
    handleCaptureSnapshot,
    handleRefresh,
    handleResetLayout,
    assetsWithScores.length,
    snapshots.length,
    isSidebarOpen,
    activeTab,
    toggleTab,
    setActions,
    clearActions,
  ]);

  return (
    <div className="executive-dashboard">
      {/* Edit mode - show widget picker inline */}
      {isEditMode && (
        <div className="dashboard-edit-bar">
          <WidgetPickerPanel />
          <span className="edit-mode-hint">
            Drag widgets to reposition, resize by dragging corners
          </span>
        </div>
      )}

      {/* Dashboard grid - uses react-grid-layout for consistent positioning */}
      <DashboardGrid />

      {/* Template selector modal */}
      <TemplateSelectorModal
        isOpen={showTemplateModal}
        onClose={() => setShowTemplateModal(false)}
      />
    </div>
  );
}
