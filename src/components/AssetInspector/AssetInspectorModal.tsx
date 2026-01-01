/**
 * Asset Inspector Modal
 *
 * Comprehensive asset detail viewer with tabbed interface.
 * Shows all metadata, quality scores, and provides actions.
 */

import { Modal } from '../shared/Modal';
import { TabNav, type Tab } from '../shared/TabNav';
import { useAssetInspectorStore, type InspectorTab } from '../../stores/assetInspectorStore';
import { AssetInspectorActions } from './AssetInspectorActions';
import { OverviewSection } from './sections/OverviewSection';
import { GovernanceSection } from './sections/GovernanceSection';
import { ActivitySection } from './sections/ActivitySection';
import { QualitySection } from './sections/QualitySection';
import { LineageSection } from './sections/LineageSection';
import { DocumentationSection } from './sections/DocumentationSection';
import { MetadataSection } from './sections/MetadataSection';
import {
  Info,
  Shield,
  TrendingUp,
  Award,
  GitBranch,
  FileText,
  Database,
} from 'lucide-react';
import './AssetInspectorModal.css';

const TABS: Tab[] = [
  { id: 'overview', label: 'Overview', icon: <Info size={14} /> },
  { id: 'governance', label: 'Governance', icon: <Shield size={14} /> },
  { id: 'activity', label: 'Activity', icon: <TrendingUp size={14} /> },
  { id: 'quality', label: 'Quality', icon: <Award size={14} /> },
  { id: 'lineage', label: 'Lineage', icon: <GitBranch size={14} /> },
  { id: 'documentation', label: 'Docs', icon: <FileText size={14} /> },
  { id: 'metadata', label: 'Metadata', icon: <Database size={14} /> },
];

export function AssetInspectorModal() {
  const { isOpen, currentAsset, currentTab, closeInspector, setTab } =
    useAssetInspectorStore();

  if (!currentAsset) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={closeInspector}
      title={currentAsset.name}
      size="large"
      footer={<AssetInspectorActions asset={currentAsset} />}
    >
      <div className="asset-inspector-container">
        <TabNav
          tabs={TABS}
          activeTab={currentTab}
          onChange={(id) => setTab(id as InspectorTab)}
          className="asset-inspector-tabs"
        />

        <div className="asset-inspector-content">
          {currentTab === 'overview' && <OverviewSection asset={currentAsset} />}
          {currentTab === 'governance' && <GovernanceSection asset={currentAsset} />}
          {currentTab === 'activity' && <ActivitySection asset={currentAsset} />}
          {currentTab === 'quality' && <QualitySection asset={currentAsset} />}
          {currentTab === 'lineage' && <LineageSection asset={currentAsset} />}
          {currentTab === 'documentation' && <DocumentationSection asset={currentAsset} />}
          {currentTab === 'metadata' && <MetadataSection asset={currentAsset} />}
        </div>
      </div>
    </Modal>
  );
}
