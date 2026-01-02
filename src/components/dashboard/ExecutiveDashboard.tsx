import { AppHeader } from '../layout/AppHeader';
import { Button } from '../shared';
import { useState, useEffect } from 'react';
import { Edit3, LayoutTemplate, Save, RotateCcw } from 'lucide-react';
import { DashboardGrid } from './DashboardGrid';
import { WidgetPickerPanel } from './WidgetPickerPanel';
import { TemplateSelectorModal } from './TemplateSelectorModal';
import { useDashboardLayoutStore } from '../../stores/dashboardLayoutStore';
import { useScoresStore } from '../../stores/scoresStore';
import './ExecutiveDashboard.css';
import './widgets'; // Import to trigger widget registration

export function ExecutiveDashboard() {
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const { assetsWithScores } = useScoresStore();
  const { isEditMode, toggleEditMode, activeTemplateId, resetToTemplate, setActiveTemplate, currentLayouts } = useDashboardLayoutStore();

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

      {/* Edit mode banner */}
      {isEditMode && (
        <div className="edit-mode-banner">
          Edit mode active - Drag widgets to reposition, resize by dragging corners, or add new widgets
        </div>
      )}

      {/* Dashboard grid with react-grid-layout */}
      <DashboardGrid />

      {/* Template selector modal */}
      <TemplateSelectorModal
        isOpen={showTemplateModal}
        onClose={() => setShowTemplateModal(false)}
      />
    </div>
  );
}
