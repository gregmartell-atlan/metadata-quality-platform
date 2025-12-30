/**
 * Sidebar - Main navigation sidebar
 * Based on dashboard.html mockup
 */

import { LayoutGrid, BarChart3, Target, Users, RefreshCw, Zap } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import './Sidebar.css';

export function Sidebar() {
  const location = useLocation();

  const isActive = (path: string) => location.pathname === path;

  return (
    <aside className="sidebar">
      <div className="logo">
        <div className="logo-icon">MQ</div>
        <span className="logo-text">Metadata Quality</span>
      </div>

      <nav>
        <div className="nav-section">
          <div className="nav-label">Dashboards</div>
          <Link
            to="/"
            className={`nav-item ${isActive('/') ? 'active' : ''}`}
          >
            <LayoutGrid size={18} />
            Executive Overview
          </Link>
          <Link
            to="/stewardship"
            className={`nav-item ${isActive('/stewardship') ? 'active' : ''}`}
          >
            <BarChart3 size={18} />
            Stewardship Ops
          </Link>
          <Link
            to="/campaigns"
            className={`nav-item ${isActive('/campaigns') ? 'active' : ''}`}
          >
            <Target size={18} />
            Campaign Tracking
          </Link>
        </div>

        <div className="nav-section">
          <div className="nav-label">Analysis</div>
          <Link
            to="/pivot"
            className={`nav-item ${isActive('/pivot') ? 'active' : ''}`}
          >
            <LayoutGrid size={18} />
            Pivot Builder
          </Link>
          <Link
            to="/trends"
            className={`nav-item ${isActive('/trends') ? 'active' : ''}`}
          >
            <RefreshCw size={18} />
            Quality Trends
          </Link>
          <Link
            to="/accountability"
            className={`nav-item ${isActive('/accountability') ? 'active' : ''}`}
          >
            <Users size={18} />
            Accountability
          </Link>
        </div>

        <div className="nav-section">
          <div className="nav-label">Actions</div>
          <button className="nav-item">
            <Target size={18} />
            Campaigns
          </button>
          <button className="nav-item">
            <Zap size={18} />
            Automation Rules
          </button>
        </div>
      </nav>
    </aside>
  );
}
