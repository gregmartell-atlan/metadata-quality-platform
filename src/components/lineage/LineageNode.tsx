/**
 * Lineage Node Component
 * 
 * Custom React Flow node for displaying assets and processes in lineage graph
 */

import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import {
  Database,
  Table2,
  Layers,
  Eye,
  GitBranch,
  Code,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Clock,
  User,
  Tag,
  FileText,
} from 'lucide-react';
import type { NodeProps } from '@xyflow/react';
import type { LineageNode as LineageNodeData } from '../../types/lineage';
import './LineageNode.css';

interface LineageNodeProps extends Omit<NodeProps, 'data'> {
  data: LineageNodeData & Record<string, unknown>;
}

// Icon mapping for asset types
const ASSET_ICONS: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  Database: Database,
  Schema: Layers,
  Table: Table2,
  View: Eye,
  MaterializedView: Eye,
  Column: Layers,
  // Process types
  Process: Code,
  ColumnProcess: Code,
  BIProcess: Code,
  SparkJob: Code,
};

// Default icon
const DefaultIcon = Database;

function LineageNodeComponent({ data, selected }: LineageNodeProps) {
  const {
    label,
    type,
    entityType,
    isCenterNode,
    hasUpstream,
    hasDownstream,
    qualityScores,
    governance,
    freshness,
    isHighlighted,
    highlightReason,
  } = data;

  const Icon = ASSET_ICONS[type] || DefaultIcon;
  const isProcess = entityType === 'process';
  
  // Determine node color based on quality score or lineage
  const overallScore = qualityScores?.overall || 0;
  let nodeColorClass = 'node-default';
  if (isProcess) {
    nodeColorClass = 'node-process';
  } else if (isCenterNode) {
    nodeColorClass = 'node-center';
  } else if (overallScore > 0) {
    if (overallScore < 50) {
      nodeColorClass = 'node-quality-low';
    } else if (overallScore < 80) {
      nodeColorClass = 'node-quality-medium';
    } else {
      nodeColorClass = 'node-quality-high';
    }
  } else if (hasUpstream && hasDownstream) {
    nodeColorClass = 'node-lineage-full';
  } else if (hasUpstream || hasDownstream) {
    nodeColorClass = 'node-lineage-partial';
  } else {
    nodeColorClass = 'node-lineage-orphaned';
  }

  // Highlight classes
  if (isHighlighted) {
    if (highlightReason === 'impact') {
      nodeColorClass += ' node-highlight-impact';
    } else if (highlightReason === 'root-cause') {
      nodeColorClass += ' node-highlight-root-cause';
    } else if (highlightReason === 'quality-issue') {
      nodeColorClass += ' node-highlight-quality';
    }
  }

  // Staleness indicator
  const isStale = freshness?.isStale;
  const stalenessDays = freshness?.stalenessDays;

  return (
    <div className={`lineage-node ${nodeColorClass} ${selected ? 'selected' : ''} ${isCenterNode ? 'center' : ''}`}>
      {/* Input handle (target for incoming edges) - always render for edge connections */}
      <Handle
        type="target"
        position={Position.Left}
        className="lineage-handle lineage-handle-input"
      />

      {/* Node content */}
      <div className="lineage-node-content">
        {/* Header */}
        <div className="lineage-node-header">
          <div className="lineage-node-icon-wrapper">
            <Icon size={16} className="lineage-node-icon" />
            {isProcess && <span className="lineage-node-badge lineage-node-badge-process">Process</span>}
            {!isProcess && <span className="lineage-node-badge">{type}</span>}
          </div>
          
          {/* Quality score indicator */}
          {qualityScores?.overall !== undefined && (
            <div className={`lineage-node-quality ${overallScore < 50 ? 'low' : overallScore < 80 ? 'medium' : 'high'}`}>
              {overallScore}
            </div>
          )}
        </div>

        {/* Label */}
        <div className="lineage-node-label" title={label}>
          {label}
        </div>

        {/* Metadata badges */}
        <div className="lineage-node-badges">
          {data.hasCertificate && governance?.certificateStatus && (
            <span className="lineage-node-badge-small" title={`Certified: ${governance.certificateStatus}`}>
              {governance.certificateStatus === 'VERIFIED' && <CheckCircle2 size={10} />}
              {governance.certificateStatus === 'DRAFT' && <AlertCircle size={10} />}
              {governance.certificateStatus === 'DEPRECATED' && <XCircle size={10} />}
            </span>
          )}
          {data.hasOwner && (
            <span className="lineage-node-badge-small" title="Has owner">
              <User size={10} />
            </span>
          )}
          {data.hasTags && (
            <span className="lineage-node-badge-small" title="Has tags">
              <Tag size={10} />
            </span>
          )}
          {data.hasDescription && (
            <span className="lineage-node-badge-small" title="Has description">
              <FileText size={10} />
            </span>
          )}
          {isStale && (
            <span className="lineage-node-badge-small lineage-node-badge-stale" title={`Stale: ${stalenessDays} days`}>
              <Clock size={10} />
            </span>
          )}
        </div>

        {/* Lineage indicators */}
        <div className="lineage-node-lineage-info">
          {hasUpstream && (
            <span className="lineage-node-lineage-badge upstream" title={`${data.upstreamCount} upstream`}>
              ↑ {data.upstreamCount}
            </span>
          )}
          {hasDownstream && (
            <span className="lineage-node-lineage-badge downstream" title={`${data.downstreamCount} downstream`}>
              ↓ {data.downstreamCount}
            </span>
          )}
        </div>

        {/* Expandable indicator */}
        {data.isExpandable && !data.isExpanded && (
          <div className="lineage-node-expand">
            <GitBranch size={12} />
            <span>+</span>
          </div>
        )}
      </div>

      {/* Output handle (source for outgoing edges) - always render for edge connections */}
      <Handle
        type="source"
        position={Position.Right}
        className="lineage-handle lineage-handle-output"
      />
    </div>
  );
}

export default memo(LineageNodeComponent);

