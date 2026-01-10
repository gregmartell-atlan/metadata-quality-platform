import { useEffect, useCallback } from 'react';
import { ReactFlowProvider } from '@xyflow/react';
import { LineageView } from '../components/lineage/LineageView';
import { Camera, Download, Settings2 } from 'lucide-react';
import { useRightSidebarStore } from '../stores/rightSidebarStore';
import { usePageActionsStore, type PageAction } from '../stores/pageActionsStore';
import './LineageViewPage.css';

export function LineageViewPage() {
  const { toggleTab, activeTab: sidebarTab, isOpen: isSidebarOpen } = useRightSidebarStore();
  const { setActions, clearActions } = usePageActionsStore();

  const handleExportImage = useCallback(() => {
    // Dispatch event for lineage view to export
    window.dispatchEvent(new CustomEvent('lineage-export-image'));
  }, []);

  // Register page actions with the header
  useEffect(() => {
    const actions: PageAction[] = [
      // View group - config
      {
        id: 'config',
        icon: <Settings2 size={16} />,
        title: 'Configure Lineage Graph',
        onClick: () => toggleTab('config'),
        active: isSidebarOpen && sidebarTab === 'config',
        group: 'view',
      },
      // Export group
      {
        id: 'snapshot',
        icon: <Camera size={16} />,
        title: 'Snapshot Graph State (Coming Soon)',
        onClick: () => {},
        disabled: true,
        group: 'export',
      },
      {
        id: 'export-image',
        icon: <Download size={16} />,
        title: 'Export Image',
        onClick: handleExportImage,
        group: 'export',
      },
    ];

    setActions(actions);

    return () => {
      clearActions();
    };
  }, [toggleTab, sidebarTab, isSidebarOpen, handleExportImage, setActions, clearActions]);

  return (
    <div className="lineage-view-page">
      <div className="lineage-view-container">
        <ReactFlowProvider>
          <LineageView />
        </ReactFlowProvider>
      </div>
    </div>
  );
}
