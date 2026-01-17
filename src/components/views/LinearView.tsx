import { CheckCircle2, Circle, AlertCircle } from 'lucide-react';

export interface LinearItem {
  id: string;
  title: string;
  description?: string;
  status: 'pending' | 'in_progress' | 'completed' | 'blocked';
  priority?: 'high' | 'medium' | 'low';
  phase?: string;
  assignee?: string;
  dueDate?: string;
  tags?: string[];
}

interface LinearViewProps {
  items: LinearItem[];
  onItemClick?: (item: LinearItem) => void;
  groupBy?: 'phase' | 'status' | 'priority' | 'none';
}

const STATUS_CONFIG = {
  pending: { icon: Circle, color: 'text-gray-400', bgColor: 'bg-gray-50', label: 'Pending' },
  in_progress: { icon: Circle, color: 'text-blue-500', bgColor: 'bg-blue-50', label: 'In Progress' },
  completed: { icon: CheckCircle2, color: 'text-green-500', bgColor: 'bg-green-50', label: 'Completed' },
  blocked: { icon: AlertCircle, color: 'text-red-500', bgColor: 'bg-red-50', label: 'Blocked' },
};

const PRIORITY_CONFIG = {
  high: { color: 'text-red-600', bgColor: 'bg-red-100', label: 'High' },
  medium: { color: 'text-yellow-600', bgColor: 'bg-yellow-100', label: 'Medium' },
  low: { color: 'text-gray-600', bgColor: 'bg-gray-100', label: 'Low' },
};

export function LinearView({ items, onItemClick, groupBy = 'none' }: LinearViewProps) {
  const groupedItems = groupBy !== 'none'
    ? items.reduce((acc, item) => {
        const key = item[groupBy] || 'Ungrouped';
        if (!acc[key]) acc[key] = [];
        acc[key].push(item);
        return acc;
      }, {} as Record<string, LinearItem[]>)
    : { 'All Items': items };

  return (
    <div className="linear-view">
      {Object.entries(groupedItems).map(([group, groupItems]) => (
        <div key={group} className="linear-group">
          {groupBy !== 'none' && (
            <div className="group-header">
              <h3>{group}</h3>
              <span className="group-count">{groupItems.length}</span>
            </div>
          )}
          <div className="items-list">
            {groupItems.map((item) => {
              const statusConfig = STATUS_CONFIG[item.status];
              const StatusIcon = statusConfig.icon;
              const priorityConfig = item.priority ? PRIORITY_CONFIG[item.priority] : null;

              return (
                <div
                  key={item.id}
                  className={`linear-item ${statusConfig.bgColor}`}
                  onClick={() => onItemClick?.(item)}
                >
                  <div className="item-status">
                    <StatusIcon className={`w-5 h-5 ${statusConfig.color}`} />
                  </div>
                  <div className="item-content">
                    <div className="item-header">
                      <span className="item-title">{item.title}</span>
                      {priorityConfig && (
                        <span className={`priority-badge ${priorityConfig.bgColor} ${priorityConfig.color}`}>
                          {priorityConfig.label}
                        </span>
                      )}
                    </div>
                    {item.description && (
                      <p className="item-description">{item.description}</p>
                    )}
                    <div className="item-meta">
                      {item.assignee && <span className="meta-item">Assignee: {item.assignee}</span>}
                      {item.dueDate && <span className="meta-item">Due: {item.dueDate}</span>}
                      {item.tags && item.tags.length > 0 && (
                        <div className="item-tags">
                          {item.tags.map((tag) => (
                            <span key={tag} className="tag">{tag}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
      <style>{`
        .linear-view {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }

        .linear-group {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .group-header {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.5rem 0;
          border-bottom: 1px solid var(--border-subtle);
        }

        .group-header h3 {
          font-size: 0.875rem;
          font-weight: 600;
          color: var(--text-primary);
          text-transform: capitalize;
        }

        .group-count {
          font-size: 0.75rem;
          padding: 0.125rem 0.5rem;
          background: var(--bg-secondary);
          border-radius: 9999px;
          color: var(--text-tertiary);
        }

        .items-list {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .linear-item {
          display: flex;
          gap: 0.75rem;
          padding: 0.75rem;
          border-radius: 0.5rem;
          border: 1px solid var(--border-subtle);
          cursor: pointer;
          transition: all 0.15s;
        }

        .linear-item:hover {
          border-color: var(--border-default);
        }

        .item-status {
          flex-shrink: 0;
          padding-top: 0.125rem;
        }

        .item-content {
          flex: 1;
          min-width: 0;
        }

        .item-header {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .item-title {
          font-size: 0.875rem;
          font-weight: 500;
          color: var(--text-primary);
        }

        .priority-badge {
          font-size: 0.6875rem;
          padding: 0.125rem 0.5rem;
          border-radius: 9999px;
          font-weight: 500;
        }

        .item-description {
          font-size: 0.8125rem;
          color: var(--text-secondary);
          margin-top: 0.25rem;
          line-height: 1.5;
        }

        .item-meta {
          display: flex;
          flex-wrap: wrap;
          gap: 0.75rem;
          margin-top: 0.5rem;
          font-size: 0.75rem;
          color: var(--text-tertiary);
        }

        .meta-item {
          display: inline-flex;
          align-items: center;
        }

        .item-tags {
          display: flex;
          gap: 0.25rem;
        }

        .tag {
          padding: 0.125rem 0.375rem;
          background: var(--bg-secondary);
          border-radius: 0.25rem;
          font-size: 0.6875rem;
        }
      `}</style>
    </div>
  );
}

export default LinearView;
