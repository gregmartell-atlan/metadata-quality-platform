/**
 * Temporal Workflow Types
 * Type definitions for workflow execution and status tracking
 */

export interface WorkflowStatus {
  workflowId: string;
  status: 'running' | 'completed' | 'failed' | 'cancelled' | 'paused';
  progress: number;  // 0-100
  currentStep: string;
  error?: string;
  startedAt?: string;
  completedAt?: string;
}

export interface AuditWorkflowRequest {
  connector?: string;
  assetTypes?: string[];
  includeOrphans?: boolean;
  includeLowCompleteness?: boolean;
  orphanLimit?: number;
  lowCompletenessLimit?: number;
}

export interface AuditWorkflowResult {
  workflowId: string;
  status: 'completed' | 'failed';
  objectStoreUrl: string;
  summary: {
    totalAssets: number;
    completenessScore: number;
  };
  error?: string;
}

export interface StartWorkflowResponse {
  workflowId: string;
  status: string;
  statusUrl: string;
}
