/**
 * Sidebar - Main navigation sidebar (logo now in UnifiedHeader)
 */

import { Home, LayoutGrid, RefreshCw, GitBranch, Radar, Settings, Target, Sparkles, Bug, Wrench } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import './Sidebar.css';

interface SidebarProps {
  isCollapsed: boolean;
}

export function Sidebar({ isCollapsed }: SidebarProps) {
  const location = useLocation();

  const isActive = (path: string) => location.pathname === path;

  return (
    <aside className={`sidebar ${isCollapsed ? 'collapsed' : ''}`}>
      <nav>
        <div className="nav-section">
          <Link
            to="/"
            className={`nav-item ${isActive('/') ? 'active' : ''}`}
            title="Home"
          >
            <Home size={18} />
            <span>Home</span>
          </Link>
        </div>

        <div className="nav-section">
          <div className="nav-label">Dashboards</div>
          <Link
            to="/dashboard"
            className={`nav-item ${isActive('/dashboard') ? 'active' : ''}`}
            title="Executive Overview"
          >
            <LayoutGrid size={18} />
            <span>Executive Overview</span>
          </Link>

        </div>

        <div className="nav-section">
          <div className="nav-label">Analysis</div>
          <Link
            to="/pivot"
            className={`nav-item ${isActive('/pivot') ? 'active' : ''}`}
            title="Pivot Builder"
          >
            <LayoutGrid size={18} />
            <span>Pivot Builder</span>
          </Link>
          <Link
            to="/lineage"
            className={`nav-item ${isActive('/lineage') ? 'active' : ''}`}
            title="Lineage Explorer"
          >
            <GitBranch size={18} />
            <span>Lineage Explorer</span>
          </Link>
          <Link
            to="/analytics"
            className={`nav-item ${isActive('/analytics') ? 'active' : ''}`}
            title="DaaP Analytics"
          >
            <Radar size={18} />
            <span>DaaP Analytics</span>
          </Link>
          <Link
            to="/assessment"
            className={`nav-item ${isActive('/assessment') ? 'active' : ''}`}
            title="Metadata Assessment"
          >
            <Target size={18} />
            <span>Assessment</span>
          </Link>
          <Link
            to="/trends"
            className={`nav-item ${isActive('/trends') ? 'active' : ''}`}
            title="Quality Trends"
          >
            <RefreshCw size={18} />
            <span>Quality Trends</span>
          </Link>

        </div>

        <div className="nav-section">
          <div className="nav-label">Tools</div>
          <Link
            to="/modeling-assistant"
            className={`nav-item ${isActive('/modeling-assistant') ? 'active' : ''}`}
            title="Modeling Assistant"
          >
            <Sparkles size={18} />
            <span>Modeling Assistant</span>
          </Link>
          <Link
            to="/debug"
            className={`nav-item ${isActive('/debug') ? 'active' : ''}`}
            title="Debug Tools"
          >
            <Bug size={18} />
            <span>Debug Tools</span>
          </Link>
          <Link
            to="/tenant-config"
            className={`nav-item ${isActive('/tenant-config') ? 'active' : ''}`}
            title="Tenant Config"
          >
            <Wrench size={18} />
            <span>Tenant Config</span>
          </Link>
        </div>



        <div className="nav-section nav-section-bottom">
          <Link
            to="/settings"
            className={`nav-item ${isActive('/settings') ? 'active' : ''}`}
            title="Settings"
          >
            <Settings size={18} />
            <span>Settings</span>
          </Link>
        </div>
      </nav>
    </aside>
  );
}
