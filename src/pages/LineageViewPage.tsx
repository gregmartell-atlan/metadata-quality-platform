import { ReactFlowProvider } from '@xyflow/react';
import { LineageView } from '../components/lineage/LineageView';
import { HeaderToolbar, HeaderActionGroup, HeaderButton, HeaderDivider } from '../components/layout/HeaderActions';
import { Camera, Download, Settings2 } from 'lucide-react';
import { useRightSidebarStore } from '../stores/rightSidebarStore';
import './LineageViewPage.css';

export function LineageViewPage() {
  const { toggleTab, activeTab: sidebarTab, isOpen: isSidebarOpen } = useRightSidebarStore();

  return (
    <div className="lineage-view-page">
      {/* Page Toolbar */}
      <div className="page-toolbar">
        <HeaderToolbar>
          <HeaderActionGroup>
            <HeaderButton
              icon={<Settings2 />}
              onClick={() => toggleTab('config')}
              active={isSidebarOpen && sidebarTab === 'config'}
              title="Configure Lineage Graph"
            />
          </HeaderActionGroup>

          <HeaderDivider />

          <HeaderActionGroup>
            <HeaderButton icon={<Camera />} disabled title="Snapshot Graph State (Coming Soon)" />
            <HeaderButton icon={<Download />} title="Export Image" />
          </HeaderActionGroup>
        </HeaderToolbar>
      </div>
      <div className="lineage-view-container">
        <ReactFlowProvider>
          <LineageView />
        </ReactFlowProvider>
      </div>
    </div>
  );
}
