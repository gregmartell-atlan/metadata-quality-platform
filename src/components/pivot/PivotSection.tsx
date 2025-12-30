import type { ReactNode } from 'react';
import { AlertTriangle, Clock, CheckCircle2, Info } from 'lucide-react';
import './PivotSection.css';

interface PivotSectionProps {
  title: string;
  subtitle: string;
  meta: { label: string; value: string }[];
  rows: ReactNode;
  columns?: ReactNode;
  measures?: ReactNode;
  measureControls?: ReactNode;
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
  measureControls,
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
        {measureControls && (
          <div className="config-group measure-controls">
            {measureControls}
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
                  {insight.type === 'danger' && <AlertTriangle size={14} />}
                  {insight.type === 'warning' && <Clock size={14} />}
                  {insight.type === 'success' && <CheckCircle2 size={14} />}
                  {insight.type === 'info' && <Info size={14} />}
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

