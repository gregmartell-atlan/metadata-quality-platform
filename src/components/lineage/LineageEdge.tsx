/**
 * Lineage Edge Component
 * 
 * Custom React Flow edge for displaying relationships in lineage graph
 */

import { memo } from 'react';
import { BaseEdge, getBezierPath, Position } from '@xyflow/react';
import type { LineageEdge as LineageEdgeData } from '../../types/lineage';
import './LineageEdge.css';

interface LineageEdgeProps {
  id: string;
  sourceX: number;
  sourceY: number;
  targetX: number;
  targetY: number;
  sourcePosition?: Position;
  targetPosition?: Position;
  style?: React.CSSProperties;
  markerEnd?: string;
  data?: LineageEdgeData;
  selected?: boolean;
}

function LineageEdgeComponent({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition = Position.Right,
  targetPosition = Position.Left,
  style = {},
  markerEnd,
  data,
  selected,
}: LineageEdgeProps) {
  const [edgePath] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const isUpstream = data?.isUpstream || false;
  const relationshipType = data?.relationshipType || 'unknown';
  
  // Determine edge color based on direction and relationship type
  let edgeClass = 'lineage-edge';
  if (isUpstream) {
    edgeClass += ' lineage-edge-upstream';
  } else {
    edgeClass += ' lineage-edge-downstream';
  }
  
  // Process relationships get different styling
  if (relationshipType.includes('Process') || data?.sourceType?.includes('Process') || data?.targetType?.includes('Process')) {
    edgeClass += ' lineage-edge-process';
  }
  
  if (selected) {
    edgeClass += ' selected';
  }

  // Animate downstream edges (data flow direction)
  const isAnimated = !isUpstream;

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          ...style,
          strokeWidth: selected ? 3 : 2,
        }}
        className={edgeClass}
      />
      {isAnimated && (
        <path
          d={edgePath}
          fill="none"
          stroke="url(#lineage-gradient)"
          strokeWidth={1}
          className="lineage-edge-animated"
        />
      )}
    </>
  );
}

export default memo(LineageEdgeComponent);

