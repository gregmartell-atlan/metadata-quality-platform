import type { ReactNode } from 'react';
import './PivotSection.css';

interface PivotSectionProps {
  title: string;
  subtitle: string;
  meta: { label: string; value: string }[];
  rows: ReactNode;
  columns?: ReactNode;
  measures?: ReactNode;
  children: ReactNode;
  insights?: { type: 'danger' | 'warning' | 'success' | 'info'; message: string }[];
}

export function PivotSection({
  title,
  subtitle,
  meta,
  rows,
  columns,
  measures,
  children,
  insights,
}: PivotSectionProps) {
  return (
    <div className="pivot-section">
      <div className="pivot-header">
        <div>
          <div className="pivot-title">{title}</div>
          <div className="pivot-subtitle">{subtitle}</div>
        </div>
        <div className="pivot-meta">
          {meta.map((item, idx) => (
            <span key={idx}>
              {item.label} {item.value}
            </span>
          ))}
        </div>
      </div>
      <div className="pivot-config">
        <div className="config-group">
          <div className="config-label">Rows</div>
          <div className="config-chips">{rows}</div>
        </div>
        {columns && (
          <div className="config-group">
            <div className="config-label">Columns</div>
            <div className="config-chips">{columns}</div>
          </div>
        )}
        {measures && (
          <div className="config-group">
            <div className="config-label">Measures</div>
            <div className="config-chips">{measures}</div>
          </div>
        )}
      </div>
      <div className="pivot-body">{children}</div>
      {insights && insights.length > 0 && (
        <div className="insights-panel">
          <div className="insights-title">Key Insights</div>
          <div className="insights-list">
            {insights.map((insight, idx) => (
              <div key={idx} className="insight-item">
                <span className={`insight-icon ${insight.type}`}>
                  {insight.type === 'danger' && '⚠'}
                  {insight.type === 'warning' && '⏰'}
                  {insight.type === 'success' && '✓'}
                  {insight.type === 'info' && '📊'}
                </span>
                <span dangerouslySetInnerHTML={{ __html: insight.message }} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

