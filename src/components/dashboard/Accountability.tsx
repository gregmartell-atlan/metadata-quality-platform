import { Card } from '../shared';
import { ScoreBadge } from '../shared';
import { mockStewards } from '../../services/mockData';
import './Accountability.css';

export function Accountability() {
  return (
    <Card className="accountability-card" title="Steward Performance">
      <div className="card-body" style={{ padding: 0 }}>
        <table className="accountability-table">
          <thead>
            <tr>
              <th>Steward</th>
              <th>Assets</th>
              <th>Avg Score</th>
              <th>Tasks Done</th>
              <th>Trend</th>
            </tr>
          </thead>
          <tbody>
            {mockStewards.map((steward) => (
              <tr key={steward.id}>
                <td>
                  <div className="owner-cell">
                    <div className="owner-avatar">{steward.initials}</div>
                    <span className="owner-name">{steward.name}</span>
                  </div>
                </td>
                <td className="assets-cell">{steward.assetCount}</td>
                <td>
                  <ScoreBadge score={steward.avgScore} />
                </td>
                <td className="assets-cell">
                  {steward.tasksDone}/{steward.tasksTotal}
                </td>
                <td style={{ color: steward.trend >= 0 ? 'var(--accent-primary)' : 'var(--accent-danger)' }}>
                  {steward.trend >= 0 ? '↑' : '↓'} {Math.abs(steward.trend)}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

