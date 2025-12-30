import { Card } from '../shared';
import { mockCampaigns } from '../../services/mockData';
import './Campaigns.css';

export function Campaigns() {
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <Card className="campaign-card" title="Active Campaigns">
      <div className="campaign-list">
        {mockCampaigns.map((campaign) => (
          <div key={campaign.id} className="campaign-item">
            <div className="campaign-header">
              <div>
                <div className="campaign-name">{campaign.name}</div>
                <div className="campaign-type">
                  {campaign.type} • {campaign.stewardCount} stewards
                </div>
              </div>
              <span className={`campaign-status ${campaign.status === 'active' ? 'active' : 'at-risk'}`}>
                {campaign.status === 'active' ? 'On Track' : 'At Risk'}
              </span>
            </div>
            <div className="campaign-progress-bar">
              <div
                className="campaign-progress-fill"
                style={{ width: `${campaign.progress}%` }}
              ></div>
            </div>
            <div className="campaign-stats">
              <span className="campaign-stat">
                <span>{campaign.completedTasks}</span> / {campaign.totalTasks} tasks
              </span>
              <span className="campaign-stat">
                Due <span>{formatDate(campaign.dueDate)}</span>
              </span>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

