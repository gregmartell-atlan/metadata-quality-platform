import { CheckCircle2, Clock, AlertCircle, Circle } from 'lucide-react';

export interface KanbanItem {
  id: string;
  title: string;
  description?: string;
  status: 'pending' | 'in_progress' | 'completed' | 'blocked';
  priority?: 'high' | 'medium' | 'low';
  assignee?: string;
  tags?: string[];
}

interface KanbanViewProps {
  items: KanbanItem[];
  onItemClick?: (item: KanbanItem) => void;
  onItemMove?: (itemId: string, newStatus: KanbanItem['status']) => void;
}

const COLUMNS: { status: KanbanItem['status']; label: string; icon: typeof Circle; color: string }[] = [
  { status: 'pending', label: 'Pending', icon: Circle, color: 'var(--text-tertiary)' },
  { status: 'in_progress', label: 'In Progress', icon: Clock, color: '#3b82f6' },
  { status: 'blocked', label: 'Blocked', icon: AlertCircle, color: '#ef4444' },
  { status: 'completed', label: 'Completed', icon: CheckCircle2, color: '#22c55e' },
];

const PRIORITY_COLORS = {
  high: '#ef4444',
  medium: '#f59e0b',
  low: '#6b7280',
};

export function KanbanView({ items, onItemClick, onItemMove }: KanbanViewProps) {
  const columnItems = COLUMNS.reduce((acc, col) => {
    acc[col.status] = items.filter((item) => item.status === col.status);
    return acc;
  }, {} as Record<string, KanbanItem[]>);

  return (
    <div className="kanban-view">
      {COLUMNS.map((column) => {
        const Icon = column.icon;
        const colItems = columnItems[column.status] || [];

        return (
          <div key={column.status} className="kanban-column">
            <div className="column-header">
              <div className="column-title">
                <Icon size={16} style={{ color: column.color }} />
                <span>{column.label}</span>
              </div>
              <span className="column-count">{colItems.length}</span>
            </div>
            <div className="column-content">
              {colItems.map((item) => (
                <div
                  key={item.id}
                  className="kanban-card"
                  onClick={() => onItemClick?.(item)}
                >
                  {item.priority && (
                    <div
                      className="priority-indicator"
                      style={{ backgroundColor: PRIORITY_COLORS[item.priority] }}
                    />
                  )}
                  <div className="card-title">{item.title}</div>
                  {item.description && (
                    <p className="card-description">{item.description}</p>
                  )}
                  <div className="card-footer">
                    {item.assignee && (
                      <span className="assignee">{item.assignee}</span>
                    )}
                    {item.tags && item.tags.length > 0 && (
                      <div className="card-tags">
                        {item.tags.slice(0, 2).map((tag) => (
                          <span key={tag} className="tag">{tag}</span>
                        ))}
                        {item.tags.length > 2 && (
                          <span className="tag more">+{item.tags.length - 2}</span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {colItems.length === 0 && (
                <div className="empty-column">No items</div>
              )}
            </div>
          </div>
        );
      })}
      <style>{`
        .kanban-view {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 1rem;
          min-height: 400px;
        }

        @media (max-width: 1024px) {
          .kanban-view {
            grid-template-columns: repeat(2, 1fr);
          }
        }

        @media (max-width: 640px) {
          .kanban-view {
            grid-template-columns: 1fr;
          }
        }

        .kanban-column {
          display: flex;
          flex-direction: column;
          background: var(--bg-secondary);
          border-radius: 0.5rem;
          overflow: hidden;
        }

        .column-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0.75rem 1rem;
          background: var(--bg-primary);
          border-bottom: 1px solid var(--border-subtle);
        }

        .column-title {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 0.875rem;
          font-weight: 600;
          color: var(--text-primary);
        }

        .column-count {
          font-size: 0.75rem;
          padding: 0.125rem 0.5rem;
          background: var(--bg-secondary);
          border-radius: 9999px;
          color: var(--text-tertiary);
        }

        .column-content {
          flex: 1;
          padding: 0.75rem;
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
          overflow-y: auto;
        }

        .kanban-card {
          position: relative;
          background: var(--bg-primary);
          border: 1px solid var(--border-subtle);
          border-radius: 0.5rem;
          padding: 0.75rem;
          cursor: pointer;
          transition: all 0.15s;
        }

        .kanban-card:hover {
          border-color: var(--border-default);
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
        }

        .priority-indicator {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 3px;
          border-radius: 0.5rem 0.5rem 0 0;
        }

        .card-title {
          font-size: 0.875rem;
          font-weight: 500;
          color: var(--text-primary);
          margin-bottom: 0.25rem;
        }

        .card-description {
          font-size: 0.75rem;
          color: var(--text-secondary);
          line-height: 1.4;
          margin-bottom: 0.5rem;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }

        .card-footer {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 0.5rem;
          font-size: 0.6875rem;
        }

        .assignee {
          color: var(--text-tertiary);
        }

        .card-tags {
          display: flex;
          gap: 0.25rem;
        }

        .tag {
          padding: 0.125rem 0.375rem;
          background: var(--bg-secondary);
          border-radius: 0.25rem;
          color: var(--text-tertiary);
        }

        .tag.more {
          background: var(--border-subtle);
        }

        .empty-column {
          display: flex;
          align-items: center;
          justify-content: center;
          height: 100px;
          color: var(--text-quaternary);
          font-size: 0.875rem;
        }
      `}</style>
    </div>
  );
}

export default KanbanView;
