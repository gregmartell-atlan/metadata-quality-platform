/**
 * OwnerAccountability - Owner × Quality Dimension Matrix
 *
 * Shows quality scores broken down by owner and dimension.
 * Helps identify which data owners need to improve which aspects.
 */

import { useMemo, memo, useState } from 'react';
import { ChevronDown, ChevronUp, Users, AlertTriangle } from 'lucide-react';
import { InfoTooltip } from '../shared';
import { getScoreBand, getScoreClass } from '../../utils/scoreThresholds';
import type { AssetWithScores } from '../../stores/scoresStore';
import './OwnerAccountability.css';

interface OwnerAccountabilityProps {
  assets: AssetWithScores[];
  maxOwners?: number;
}

type SortField = 'owner' | 'assetCount' | 'overall' | 'completeness' | 'accuracy' | 'timeliness' | 'consistency' | 'coverage';
type SortDirection = 'asc' | 'desc';

interface OwnerRow {
  owner: string;
  assetCount: number;
  overall: number;
  completeness: number;
  accuracy: number;
  timeliness: number;
  consistency: number;
  coverage: number;
}

const DIMENSIONS = ['overall', 'completeness', 'accuracy', 'timeliness', 'consistency', 'coverage'] as const;

const DIMENSION_LABELS: Record<string, string> = {
  overall: 'Overall',
  completeness: 'Complete',
  accuracy: 'Accurate',
  timeliness: 'Timely',
  consistency: 'Consistent',
  coverage: 'Coverage',
};

export const OwnerAccountability = memo(function OwnerAccountability({
  assets,
  maxOwners = 10,
}: OwnerAccountabilityProps) {
  const [sortField, setSortField] = useState<SortField>('assetCount');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [expanded, setExpanded] = useState(false);

  const ownerData = useMemo(() => {
    const ownerMap = new Map<string, AssetWithScores[]>();

    assets.forEach((asset) => {
      const owner = asset.metadata.owner || asset.metadata.ownerGroup || 'Unassigned';
      if (!ownerMap.has(owner)) {
        ownerMap.set(owner, []);
      }
      ownerMap.get(owner)!.push(asset);
    });

    const rows: OwnerRow[] = [];
    ownerMap.forEach((ownerAssets, owner) => {
      const count = ownerAssets.length;
      const sum = {
        overall: 0,
        completeness: 0,
        accuracy: 0,
        timeliness: 0,
        consistency: 0,
        coverage: 0,
      };

      ownerAssets.forEach((a) => {
        sum.overall += a.scores.overall;
        sum.completeness += a.scores.completeness;
        sum.accuracy += a.scores.accuracy;
        sum.timeliness += a.scores.timeliness;
        sum.consistency += a.scores.consistency;
        sum.coverage += a.scores.coverage;
      });

      rows.push({
        owner,
        assetCount: count,
        overall: Math.round(sum.overall / count),
        completeness: Math.round(sum.completeness / count),
        accuracy: Math.round(sum.accuracy / count),
        timeliness: Math.round(sum.timeliness / count),
        consistency: Math.round(sum.consistency / count),
        coverage: Math.round(sum.coverage / count),
      });
    });

    // Sort
    rows.sort((a, b) => {
      const aVal = a[sortField];
      const bVal = b[sortField];
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortDirection === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      return sortDirection === 'asc' ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number);
    });

    return rows;
  }, [assets, sortField, sortDirection]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const displayedOwners = expanded ? ownerData : ownerData.slice(0, maxOwners);
  const hasMore = ownerData.length > maxOwners;

  // Find critical owners (overall < 40)
  const criticalOwners = ownerData.filter((o) => o.overall < 40);

  const SortIcon = ({ field }: { field: SortField }) =>
    sortField === field ? (
      sortDirection === 'asc' ? (
        <ChevronUp size={12} />
      ) : (
        <ChevronDown size={12} />
      )
    ) : null;

  return (
    <div className="owner-accountability">
      <div className="owner-acc-header">
        <h3 className="owner-acc-title">Owner Accountability</h3>
        <InfoTooltip
          content={
            <div className="owner-acc-info">
              <strong>Owner Quality Matrix</strong>
              <p>
                Shows average quality scores for each data owner across all dimensions.
                Click column headers to sort. Red cells indicate areas needing attention.
              </p>
            </div>
          }
          position="bottom"
        />
      </div>

      {criticalOwners.length > 0 && (
        <div className="owner-acc-alert">
          <AlertTriangle size={14} />
          <span>
            {criticalOwners.length} owner{criticalOwners.length > 1 ? 's' : ''} need{criticalOwners.length === 1 ? 's' : ''} urgent attention
          </span>
        </div>
      )}

      <div className="owner-acc-table-container">
        <table className="owner-acc-table">
          <thead>
            <tr>
              <th className="owner-col" onClick={() => handleSort('owner')}>
                <span>Owner</span>
                <SortIcon field="owner" />
              </th>
              <th className="count-col" onClick={() => handleSort('assetCount')}>
                <span>Assets</span>
                <SortIcon field="assetCount" />
              </th>
              {DIMENSIONS.map((dim) => (
                <th key={dim} className="score-col" onClick={() => handleSort(dim)}>
                  <span>{DIMENSION_LABELS[dim]}</span>
                  <SortIcon field={dim} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {displayedOwners.map((row) => (
              <tr key={row.owner}>
                <td className="owner-col">
                  <div className="owner-cell">
                    <Users size={14} />
                    <span className="owner-name" title={row.owner}>
                      {row.owner}
                    </span>
                  </div>
                </td>
                <td className="count-col">{row.assetCount}</td>
                {DIMENSIONS.map((dim) => (
                  <td key={dim} className={`score-col ${getScoreClass(row[dim])}`}>
                    {row[dim]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {hasMore && (
        <button className="owner-acc-expand" onClick={() => setExpanded(!expanded)}>
          {expanded ? (
            <>
              <ChevronUp size={14} /> Show less
            </>
          ) : (
            <>
              <ChevronDown size={14} /> Show {ownerData.length - maxOwners} more owners
            </>
          )}
        </button>
      )}

      <div className="owner-acc-summary">
        <span className="owner-acc-summary-item">
          <span className="owner-acc-summary-value">{ownerData.length}</span>
          <span className="owner-acc-summary-label">Total Owners</span>
        </span>
        <span className="owner-acc-summary-item">
          <span className="owner-acc-summary-value">{ownerData.filter((o) => o.owner === 'Unassigned').length > 0 ? ownerData.find((o) => o.owner === 'Unassigned')?.assetCount || 0 : 0}</span>
          <span className="owner-acc-summary-label">Unassigned Assets</span>
        </span>
      </div>
    </div>
  );
});
