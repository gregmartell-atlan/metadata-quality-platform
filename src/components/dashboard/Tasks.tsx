import { Card } from '../shared';
import { mockTasks } from '../../services/mockData';
import './Tasks.css';

export function Tasks() {
  const formatDueDate = (dateStr: string, overdue: boolean) => {
    if (overdue) {
      const days = Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24));
      return `Overdue ${days}d`;
    }
    const today = new Date().toISOString().split('T')[0];
    if (dateStr === today) return 'Due Today';
    const days = Math.ceil((new Date(dateStr).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    return `Due in ${days}d`;
  };

  return (
    <Card className="tasks-card" title="Recent Tasks">
      <div className="card-body" style={{ padding: 0 }}>
        <div className="task-list">
        {mockTasks.map((task) => (
          <div key={task.id} className="task-item">
            <div className={`task-priority ${task.priority}`}></div>
            <div className="task-content">
              <div className="task-title">{task.title}</div>
              <div className="task-meta">
                <span className="task-asset">{task.asset}</span>
              </div>
            </div>
            <div className="task-assignee">
              <div className="task-avatar">{task.assignee}</div>
            </div>
            <div className={`task-due ${task.overdue ? 'overdue' : ''}`}>
              {formatDueDate(task.dueDate, task.overdue)}
            </div>
          </div>
        ))}
        </div>
      </div>
    </Card>
  );
}

