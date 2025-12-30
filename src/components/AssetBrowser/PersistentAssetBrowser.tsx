import { useState, useEffect } from 'react';
import { FolderOpen, ChevronLeft, ChevronRight } from 'lucide-react';
import { AssetBrowser } from '../AssetBrowser';
import './PersistentAssetBrowser.css';

export function PersistentAssetBrowser() {
  const [isCollapsed, setIsCollapsed] = useState(() => {
    const saved = localStorage.getItem('assetBrowserCollapsed');
    return saved === 'true';
  });

  useEffect(() => {
    localStorage.setItem('assetBrowserCollapsed', String(isCollapsed));
  }, [isCollapsed]);

  const toggleCollapse = () => {
    setIsCollapsed(!isCollapsed);
  };

  return (
    <div className={`persistent-asset-browser ${isCollapsed ? 'collapsed' : ''}`}>
      <div className="asset-browser-header">
        <div className="asset-browser-title">
          <FolderOpen size={18} className="asset-browser-icon" />
          <span className="asset-browser-label">Asset Browser</span>
        </div>
        <button
          className="asset-browser-toggle"
          onClick={toggleCollapse}
          aria-label={isCollapsed ? 'Expand Asset Browser' : 'Collapse Asset Browser'}
          title={isCollapsed ? 'Expand' : 'Collapse'}
        >
          {isCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>
      {!isCollapsed && (
        <div className="asset-browser-content">
          <div className="asset-browser-wrapper">
            <AssetBrowser />
          </div>
        </div>
      )}
    </div>
  );
}

