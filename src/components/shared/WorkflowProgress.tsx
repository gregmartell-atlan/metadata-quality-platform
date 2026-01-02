/**
 * WorkflowProgress Component
 * Displays real-time progress for running Temporal workflows
 */

import { useEffect, useState } from 'react';
import type { WorkflowStatus, AuditWorkflowResult } from '../../types/workflow';
import { pollWorkflowUntilComplete } from '../../services/atlan/api';
import './WorkflowProgress.css';

interface WorkflowProgressProps {
  workflowId: string;
  onComplete: (result: AuditWorkflowResult) => void;
  onError: (error: Error) => void;
}

export function WorkflowProgress({ workflowId, onComplete, onError }: WorkflowProgressProps) {
  const [status, setStatus] = useState<WorkflowStatus | null>(null);

  useEffect(() => {
    let cancelled = false;

    const runWorkflow = async () => {
      try {
        const result = await pollWorkflowUntilComplete(
          workflowId,
          (newStatus) => {
            if (!cancelled) {
              setStatus(newStatus);
            }
          }
        );

        if (!cancelled) {
          onComplete(result);
        }
      } catch (error) {
        if (!cancelled) {
          onError(error as Error);
        }
      }
    };

    runWorkflow();

    return () => {
      cancelled = true;
    };
  }, [workflowId, onComplete, onError]);

  if (!status) {
    return (
      <div className="workflow-progress">
        <div className="workflow-progress-spinner">
          <div className="spinner"></div>
          <div className="workflow-progress-text">Starting workflow...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="workflow-progress">
      <div className="workflow-progress-header">
        <div className="workflow-progress-title">
          {status.status === 'running' ? '⚙️ Processing' : '✓ Complete'}
        </div>
        <div className="workflow-progress-percent">{status.progress}%</div>
      </div>

      <div className="workflow-progress-bar-container">
        <div
          className="workflow-progress-bar"
          style={{ width: `${status.progress}%` }}
        />
      </div>

      <div className="workflow-progress-step">
        {status.currentStep || 'Initializing...'}
      </div>

      {status.error && (
        <div className="workflow-progress-error">
          Error: {status.error}
        </div>
      )}
    </div>
  );
}
