import { List, LayoutGrid, Table2 } from 'lucide-react';

export type ViewMode = 'spreadsheet' | 'linear' | 'kanban';

interface ViewSwitcherProps {
  currentView: ViewMode;
  onViewChange: (view: ViewMode) => void;
  availableViews?: ViewMode[];
  compact?: boolean;
}

const VIEW_CONFIG: Record<ViewMode, { label: string; icon: typeof Table2; description: string }> = {
  spreadsheet: {
    label: 'Table',
    icon: Table2,
    description: 'Table view with all fields',
  },
  linear: {
    label: 'Linear',
    icon: List,
    description: 'Sequential list view',
  },
  kanban: {
    label: 'Kanban',
    icon: LayoutGrid,
    description: 'Board view organized by status',
  },
};

export function ViewSwitcher({
  currentView,
  onViewChange,
  availableViews = ['spreadsheet', 'linear', 'kanban'],
  compact = false,
}: ViewSwitcherProps) {
  if (compact) {
    return (
      <div className="view-switcher-compact">
        {availableViews.map((view) => {
          const config = VIEW_CONFIG[view];
          const Icon = config.icon;
          const isActive = currentView === view;

          return (
            <button
              key={view}
              onClick={() => onViewChange(view)}
              className={`view-btn ${isActive ? 'active' : ''}`}
              title={`${config.label}: ${config.description}`}
            >
              <Icon size={16} />
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div className="view-switcher">
      {availableViews.map((view) => {
        const config = VIEW_CONFIG[view];
        const Icon = config.icon;
        const isActive = currentView === view;

        return (
          <button
            key={view}
            onClick={() => onViewChange(view)}
            className={`view-btn ${isActive ? 'active' : ''}`}
            title={config.description}
          >
            <Icon size={16} />
            <span>{config.label}</span>
          </button>
        );
      })}
      <style>{`
        .view-switcher {
          display: inline-flex;
          border-radius: 0.5rem;
          border: 1px solid var(--border-subtle);
          background: var(--bg-primary);
          padding: 0.25rem;
        }

        .view-switcher-compact {
          display: inline-flex;
          border-radius: 0.375rem;
          border: 1px solid var(--border-subtle);
          background: var(--bg-primary);
        }

        .view-switcher .view-btn {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.5rem 0.75rem;
          border-radius: 0.375rem;
          font-size: 0.875rem;
          font-weight: 500;
          color: var(--text-secondary);
          background: transparent;
          border: none;
          cursor: pointer;
          transition: all 0.15s;
        }

        .view-switcher-compact .view-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 0.5rem;
          color: var(--text-tertiary);
          background: transparent;
          border: none;
          cursor: pointer;
          transition: all 0.15s;
        }

        .view-switcher-compact .view-btn:not(:first-child) {
          border-left: 1px solid var(--border-subtle);
        }

        .view-switcher .view-btn:hover {
          color: var(--text-primary);
          background: var(--bg-secondary);
        }

        .view-switcher-compact .view-btn:hover {
          color: var(--text-primary);
          background: var(--bg-secondary);
        }

        .view-switcher .view-btn.active {
          background: var(--text-primary);
          color: white;
        }

        .view-switcher-compact .view-btn.active {
          background: var(--text-primary);
          color: white;
        }
      `}</style>
    </div>
  );
}

export default ViewSwitcher;
