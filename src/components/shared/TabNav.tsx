/**
 * Tab Navigation Component
 *
 * Reusable tab switcher for multi-section interfaces
 */

import './TabNav.css';

export interface Tab {
  id: string;
  label: string;
  icon?: React.ReactNode;
  badge?: string | number;
}

interface TabNavProps {
  tabs: Tab[];
  activeTab: string;
  onChange: (tabId: string) => void;
  className?: string;
}

export function TabNav({ tabs, activeTab, onChange, className = '' }: TabNavProps) {
  return (
    <div className={`tab-nav ${className}`}>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          className={`tab-nav-item ${activeTab === tab.id ? 'active' : ''}`}
          onClick={() => onChange(tab.id)}
          type="button"
        >
          {tab.icon && <span className="tab-icon">{tab.icon}</span>}
          <span className="tab-label">{tab.label}</span>
          {tab.badge !== undefined && (
            <span className="tab-badge">{tab.badge}</span>
          )}
        </button>
      ))}
    </div>
  );
}
