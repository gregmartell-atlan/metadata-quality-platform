/**
 * Sidebar - Main navigation sidebar with collapse functionality
 */

import { useState } from 'react';
import { LayoutGrid, BarChart3, Target, Users, RefreshCw, Zap, GitBranch, ChevronLeft, ChevronRight, Radar } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import './Sidebar.css';

export function Sidebar() {
  const location = useLocation();
  const [isCollapsed, setIsCollapsed] = useState(false);

  const isActive = (path: string) => location.pathname === path;

  return (
    <aside className={`sidebar ${isCollapsed ? 'collapsed' : ''}`}>
      <div className="logo">
        <div className="logo-icon">MQ</div>
        {!isCollapsed && <span className="logo-text">Metadata Quality</span>}
      </div>

      <button
        className="sidebar-toggle"
        onClick={() => setIsCollapsed(!isCollapsed)}
        title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        {isCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
      </button>

      <nav>
        <div className="nav-section">
          {!isCollapsed && <div className="nav-label">Dashboards</div>}
          <Link
            to="/"
            className={`nav-item ${isActive('/') ? 'active' : ''}`}
            title="Executive Overview"
          >
            <LayoutGrid size={18} />
            {!isCollapsed && <span>Executive Overview</span>}
          </Link>
          <Link
            to="/stewardship"
            className={`nav-item ${isActive('/stewardship') ? 'active' : ''}`}
            title="Stewardship Ops"
          >
            <BarChart3 size={18} />
            {!isCollapsed && <span>Stewardship Ops</span>}
          </Link>
          <Link
            to="/campaigns"
            className={`nav-item ${isActive('/campaigns') ? 'active' : ''}`}
            title="Campaign Tracking"
          >
            <Target size={18} />
            {!isCollapsed && <span>Campaign Tracking</span>}
          </Link>
        </div>

        <div className="nav-section">
          {!isCollapsed && <div className="nav-label">Analysis</div>}
          <Link
            to="/pivot"
            className={`nav-item ${isActive('/pivot') ? 'active' : ''}`}
            title="Pivot Builder"
          >
            <LayoutGrid size={18} />
            {!isCollapsed && <span>Pivot Builder</span>}
          </Link>
          <Link
            to="/lineage"
            className={`nav-item ${isActive('/lineage') ? 'active' : ''}`}
            title="Lineage Explorer"
          >
            <GitBranch size={18} />
            {!isCollapsed && <span>Lineage Explorer</span>}
          </Link>
          <Link
            to="/analytics"
            className={`nav-item ${isActive('/analytics') ? 'active' : ''}`}
            title="DaaP Analytics"
          >
            <Radar size={18} />
            {!isCollapsed && <span>DaaP Analytics</span>}
          </Link>
          <Link
            to="/trends"
            className={`nav-item ${isActive('/trends') ? 'active' : ''}`}
            title="Quality Trends"
          >
            <RefreshCw size={18} />
            {!isCollapsed && <span>Quality Trends</span>}
          </Link>
          <Link
            to="/accountability"
            className={`nav-item ${isActive('/accountability') ? 'active' : ''}`}
            title="Accountability"
          >
            <Users size={18} />
            {!isCollapsed && <span>Accountability</span>}
          </Link>
        </div>

        <div className="nav-section">
          {!isCollapsed && <div className="nav-label">Actions</div>}
          <button className="nav-item" title="Campaigns">
            <Target size={18} />
            {!isCollapsed && <span>Campaigns</span>}
          </button>
          <button className="nav-item" title="Automation Rules">
            <Zap size={18} />
            {!isCollapsed && <span>Automation Rules</span>}
          </button>
        </div>
      </nav>
    </aside>
  );
}
