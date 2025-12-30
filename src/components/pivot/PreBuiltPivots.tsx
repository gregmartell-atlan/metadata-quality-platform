/**
 * Pre-Built Pivot Views
 * 
 * Implements the 4 pivot views from the HTML spec:
 * 1. Completeness by Connection & Asset Type
 * 2. Quality Scorecard: Domain × Dimension
 * 3. Owner Accountability: Certification Coverage
 * 4. Lineage Coverage: Source Systems
 */

import React, { useMemo, useState } from 'react';
import { useAssetStore } from '../../stores/assetStore';
import { buildDynamicPivot, pivotDataToTableRows } from '../../utils/dynamicPivotBuilder';
import { PivotSection } from './PivotSection';
import { PivotTable } from './PivotTable';
import { PivotConfigurator } from './PivotConfigurator';
import { getDimensionLabel, getDimensionIcon } from '../../utils/pivotDimensions';
import { getMeasureLabel, formatMeasure, calculateMeasure } from '../../utils/pivotMeasures';
import { extractDimensionValue } from '../../utils/pivotDimensions';
import type { AtlanAsset } from '../../services/atlan/types';
import { scoreAssetQuality } from '../../services/qualityMetrics';
import type { AtlanAssetSummary } from '../../services/atlan/api';
import type { RowDimension, Measure } from '../../types/pivot';
import './PreBuiltPivots.css';

const getScoreClass = (score: number): string => {
  if (score >= 80) return 'excellent';
  if (score >= 60) return 'good';
  if (score >= 40) return 'fair';
  if (score >= 20) return 'poor';
  return 'critical';
};

const getHeatClass = (score: number): string => {
  if (score >= 90) return 'h-90';
  if (score >= 80) return 'h-80';
  if (score >= 70) return 'h-70';
  if (score >= 60) return 'h-60';
  if (score >= 50) return 'h-50';
  if (score >= 40) return 'h-40';
  if (score >= 30) return 'h-30';
  return 'h-20';
};

const getConnectionIcon = (connName: string): string => {
  const lower = connName.toLowerCase();
  if (lower.includes('snowflake')) return '❄️';
  if (lower.includes('bigquery') || lower.includes('big query')) return '🔷';
  if (lower.includes('postgres')) return '🐘';
  if (lower.includes('tableau')) return '📊';
  if (lower.includes('dbt')) return '🔶';
  if (lower.includes('databricks')) return '🔷';
  return '🔗';
};

function assetToSummary(asset: AtlanAsset): AtlanAssetSummary {
  return {
    guid: asset.guid,
    typeName: asset.typeName,
    name: asset.name || '',
    qualifiedName: asset.qualifiedName || '',
    connectionName: asset.connectionName,
    description: asset.description,
    userDescription: asset.userDescription,
    ownerUsers: Array.isArray(asset.ownerUsers)
      ? asset.ownerUsers.map((u) => (typeof u === 'string' ? u : (u as any).name || ''))
      : undefined,
    ownerGroups: Array.isArray(asset.ownerGroups)
      ? asset.ownerGroups.map((g) => (typeof g === 'string' ? g : (g as any).name || ''))
      : undefined,
    certificateStatus: asset.certificateStatus || undefined,
    certificateUpdatedAt: asset.certificateUpdatedAt,
    classificationNames: asset.classificationNames,
    meanings: asset.meanings?.map((m) => (typeof m === 'string' ? m : (m as any).displayText || '')),
    domainGUIDs: asset.domainGUIDs,
    updateTime: asset.updateTime,
    sourceUpdatedAt: asset.sourceUpdatedAt,
    sourceLastReadAt: asset.sourceLastReadAt,
    lastRowChangedAt: asset.lastRowChangedAt,
    popularityScore: asset.popularityScore,
    viewScore: asset.viewScore,
    starredCount: asset.starredCount,
    __hasLineage: asset.__hasLineage || false,
    isDiscoverable: asset.isDiscoverable !== false,
  };
}

export function PreBuiltPivots() {
  const { selectedAssets } = useAssetStore();
  
  // State for configurable pivot
  const [rowDimensions, setRowDimensions] = useState<RowDimension[]>(['connection', 'type']);
  const [measures, setMeasures] = useState<Measure[]>(['assetCount', 'descriptionCoverage', 'ownerCoverage', 'avgCompleteness']);

  if (selectedAssets.length === 0) {
    return (
      <div className="pre-built-pivots-empty">
        <h2>No Assets Selected</h2>
        <p>Please select assets from the Asset Browser to view pre-built pivot analyses.</p>
      </div>
    );
  }

  // Build dynamic pivot based on user selection
  const customPivot = useMemo(() => {
    if (rowDimensions.length === 0 || measures.length === 0) return null;
    return buildDynamicPivot(selectedAssets, rowDimensions, measures);
  }, [selectedAssets, rowDimensions, measures]);

  const customPivotRows = useMemo(() => {
    if (!customPivot) return [];
    return pivotDataToTableRows(customPivot, true);
  }, [customPivot]);

  // PIVOT 1: Completeness by Connection & Asset Type (pre-built example)
  const completenessPivot = useMemo(() => {
    return buildDynamicPivot(
      selectedAssets,
      ['connection', 'type'],
      ['assetCount', 'descriptionCoverage', 'ownerCoverage', 'avgCompleteness']
    );
  }, [selectedAssets]);

  const completenessRows = useMemo(() => {
    if (!completenessPivot) return [];
    return pivotDataToTableRows(completenessPivot, true);
  }, [completenessPivot]);

  // PIVOT 2: Domain Health Scorecard
  const domainPivot = useMemo(() => {
    return buildDynamicPivot(
      selectedAssets,
      ['domain'],
      ['completeness', 'accuracy', 'timeliness', 'consistency', 'usability', 'overall']
    );
  }, [selectedAssets]);

  const domainRows = useMemo(() => {
    if (!domainPivot) return [];
    const rows: (string | React.ReactNode)[][] = [];
    
    domainPivot.rows.forEach((row) => {
      const domainName = row.dimensionValues.domain || 'No Domain';
      const cells: (string | React.ReactNode)[] = [
        <span key="domain" className="dim-cell">
          <span className="dim-icon domain">🏢</span>
          {domainName}
        </span>,
        <span key="comp" className={`heat-cell ${getHeatClass(row.measures.completeness || 0)}`}>
          {row.measures.completeness || 0}
        </span>,
        <span key="acc" className={`heat-cell ${getHeatClass(row.measures.accuracy || 0)}`}>
          {row.measures.accuracy || 0}
        </span>,
        <span key="time" className={`heat-cell ${getHeatClass(row.measures.timeliness || 0)}`}>
          {row.measures.timeliness || 0}
        </span>,
        <span key="cons" className={`heat-cell ${getHeatClass(row.measures.consistency || 0)}`}>
          {row.measures.consistency || 0}
        </span>,
        <span key="use" className={`heat-cell ${getHeatClass(row.measures.usability || 0)}`}>
          {row.measures.usability || 0}
        </span>,
        <span key="overall" className={`score-cell ${getScoreClass(row.measures.overall || 0)}`}>
          {row.measures.overall || 0}
        </span>,
        <span key="trend" className="trend flat">→ 0%</span>,
      ];
      rows.push(cells);
    });

    return rows;
  }, [domainPivot]);

  // PIVOT 3: Owner Accountability - Certification Coverage
  const ownerPivot = useMemo(() => {
    return buildDynamicPivot(
      selectedAssets,
      ['ownerGroup'],
      ['assetCount']
    );
  }, [selectedAssets]);

  // Calculate certification breakdown per owner group
  const ownerCertRows = useMemo(() => {
    if (!ownerPivot) return [];
    
    const rows: (string | React.ReactNode)[][] = [];
    
    ownerPivot.rows.forEach((row) => {
      const ownerGroup = row.dimensionValues.ownerGroup || 'Unowned';
      const assetGuids = row.assetGuids;
      
      // Get assets for this owner group
      const groupAssets = selectedAssets.filter((a) => 
        assetGuids.includes(a.guid)
      );
      
      // Count by certification status
      const certified = groupAssets.filter((a) => a.certificateStatus === 'VERIFIED').length;
      const draft = groupAssets.filter((a) => a.certificateStatus === 'DRAFT').length;
      const deprecated = groupAssets.filter((a) => a.certificateStatus === 'DEPRECATED').length;
      const none = groupAssets.filter((a) => !a.certificateStatus || a.certificateStatus === null).length;
      const total = groupAssets.length;
      const certRate = total > 0 ? Math.round((certified / total) * 100) : 0;
      
      const cells: (string | React.ReactNode)[] = [
        <span key="owner" className="dim-cell">
          <span className="dim-icon owner">👤</span>
          {ownerGroup}
        </span>,
        <span key="cert" className="center numeric">{certified}</span>,
        <span key="draft" className="center numeric">{draft}</span>,
        <span key="dep" className="center numeric">{deprecated}</span>,
        <span key="none" className="center numeric">{none}</span>,
        <span key="total" className="numeric"><strong>{total}</strong></span>,
        <span key="rate" className={`score-cell ${getScoreClass(certRate)}`}>
          {certRate}%
        </span>,
      ];
      rows.push(cells);
    });

    // Add total row
    const totalCertified = selectedAssets.filter((a) => a.certificateStatus === 'VERIFIED').length;
    const totalDraft = selectedAssets.filter((a) => a.certificateStatus === 'DRAFT').length;
    const totalDeprecated = selectedAssets.filter((a) => a.certificateStatus === 'DEPRECATED').length;
    const totalNone = selectedAssets.filter((a) => !a.certificateStatus || a.certificateStatus === null).length;
    const totalAssets = selectedAssets.length;
    const overallCertRate = totalAssets > 0 ? Math.round((totalCertified / totalAssets) * 100) : 0;

    rows.push([
      <strong key="total-label">Total</strong>,
      <span key="total-cert" className="center numeric"><strong>{totalCertified}</strong></span>,
      <span key="total-draft" className="center numeric"><strong>{totalDraft}</strong></span>,
      <span key="total-dep" className="center numeric"><strong>{totalDeprecated}</strong></span>,
      <span key="total-none" className="center numeric"><strong>{totalNone}</strong></span>,
      <span key="total-assets" className="numeric"><strong>{totalAssets}</strong></span>,
      <span key="total-rate" className={`score-cell ${getScoreClass(overallCertRate)}`}>
        <strong>{overallCertRate}%</strong>
      </span>,
    ]);

    return rows;
  }, [ownerPivot, selectedAssets]);

  // PIVOT 4: Lineage Coverage
  const lineagePivot = useMemo(() => {
    return buildDynamicPivot(
      selectedAssets,
      ['connection'],
      ['assetCount', 'hasUpstream', 'hasDownstream', 'fullLineage', 'orphaned']
    );
  }, [selectedAssets]);

  const lineageRows = useMemo(() => {
    if (!lineagePivot) return [];
    const rows: (string | React.ReactNode)[][] = [];
    
    lineagePivot.rows.forEach((row) => {
      const connection = row.dimensionValues.connection || 'Unknown';
      const assetGuids = row.assetGuids;
      const groupAssets = selectedAssets.filter((a) => assetGuids.includes(a.guid));
      
      const hasUpstream = calculateMeasure('hasUpstream', groupAssets);
      const hasDownstream = calculateMeasure('hasDownstream', groupAssets);
      const fullLineage = calculateMeasure('fullLineage', groupAssets);
      const orphaned = calculateMeasure('orphaned', groupAssets);
      const total = groupAssets.length;
      const coverage = total > 0 ? Math.round(((total - orphaned) / total) * 100) : 0;
      
      const cells: (string | React.ReactNode)[] = [
        <span key="conn" className="dim-cell">
          <span className="dim-icon connection">{getConnectionIcon(connection)}</span>
          {connection}
        </span>,
        <span key="total" className="numeric">{total}</span>,
        <div key="upstream" className="bar-cell">
          <div className="bar-container">
            <div className={`bar-fill ${getScoreClass(hasUpstream)}`} style={{ width: `${hasUpstream}%` }}></div>
          </div>
          <span className="bar-value">{hasUpstream}%</span>
        </div>,
        <div key="downstream" className="bar-cell">
          <div className="bar-container">
            <div className={`bar-fill ${getScoreClass(hasDownstream)}`} style={{ width: `${hasDownstream}%` }}></div>
          </div>
          <span className="bar-value">{hasDownstream}%</span>
        </div>,
        <div key="full" className="bar-cell">
          <div className="bar-container">
            <div className={`bar-fill ${getScoreClass(fullLineage)}`} style={{ width: `${fullLineage}%` }}></div>
          </div>
          <span className="bar-value">{fullLineage}%</span>
        </div>,
        <span key="orphaned" className={`numeric ${orphaned > 0 ? 'text-danger' : ''}`}>
          {orphaned}
        </span>,
        <span key="coverage" className={`score-cell ${getScoreClass(coverage)}`}>
          {coverage}%
        </span>,
      ];
      rows.push(cells);
    });

    // Add total row
    const totalAssets = selectedAssets.length;
    const totalOrphaned = calculateMeasure('orphaned', selectedAssets);
    const overallCoverage = totalAssets > 0 ? Math.round(((totalAssets - totalOrphaned) / totalAssets) * 100) : 0;
    const avgUpstream = calculateMeasure('hasUpstream', selectedAssets);
    const avgDownstream = calculateMeasure('hasDownstream', selectedAssets);
    const avgFull = calculateMeasure('fullLineage', selectedAssets);

    rows.push([
      <strong key="total-label">Total</strong>,
      <span key="total-assets" className="numeric"><strong>{totalAssets}</strong></span>,
      <strong key="total-upstream">{avgUpstream}%</strong>,
      <strong key="total-downstream">{avgDownstream}%</strong>,
      <strong key="total-full">{avgFull}%</strong>,
      <span key="total-orphaned" className={`numeric ${totalOrphaned > 0 ? 'text-danger' : ''}`}>
        <strong>{totalOrphaned}</strong>
      </span>,
      <span key="total-coverage" className={`score-cell ${getScoreClass(overallCoverage)}`}>
        <strong>{overallCoverage}%</strong>
      </span>,
    ]);

    return rows;
  }, [lineagePivot, selectedAssets]);

  return (
    <div className="pre-built-pivots">
      {/* Pivot Configurator */}
      <PivotConfigurator
        rowDimensions={rowDimensions}
        measures={measures}
        onRowDimensionsChange={setRowDimensions}
        onMeasuresChange={setMeasures}
      />

      {/* Custom Pivot View */}
      {customPivot && customPivotRows.length > 0 && (
        <PivotSection
          title={`Custom Pivot: ${rowDimensions.map(getDimensionLabel).join(' × ')}`}
          subtitle={`Analyzing ${selectedAssets.length} assets by your selected dimensions and measures`}
          meta={[
            { label: '📊', value: `${selectedAssets.length} assets` },
            { label: '🕐', value: `Updated ${new Date().toLocaleTimeString()}` },
          ]}
          rows={
            <>
              {rowDimensions.map((dim) => (
                <span key={dim} className="chip">
                  <span className="chip-icon">{getDimensionIcon(dim)}</span>
                  {getDimensionLabel(dim)}
                </span>
              ))}
            </>
          }
          measures={
            <>
              {measures.map((measure) => (
                <span key={measure} className="chip">
                  {getMeasureLabel(measure)}
                </span>
              ))}
            </>
          }
          insights={[
            {
              type: 'info',
              message: `Grouping by <strong>${rowDimensions.map(getDimensionLabel).join('</strong> × <strong>')}</strong> with <strong>${measures.length} measure${measures.length !== 1 ? 's' : ''}</strong>`,
            },
          ]}
        >
          <PivotTable
            headers={customPivot.headers}
            rows={customPivotRows}
          />
        </PivotSection>
      )}

      {(!customPivot || customPivotRows.length === 0) && (
        <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
          {rowDimensions.length === 0 || measures.length === 0 ? (
            <p>Select row dimensions and measures above to build a custom pivot table.</p>
          ) : (
            <p>No data available for the selected dimensions and measures.</p>
          )}
        </div>
      )}

      <div className="section-divider">
        <span>Pre-Built Analysis Views</span>
      </div>

      {/* PIVOT 1: Completeness by Connection & Asset Type */}
      {completenessPivot && (
        <PivotSection
          title="Completeness by Connection & Asset Type"
          subtitle="Which source systems and asset types need the most documentation work?"
          meta={[
            { label: '📊', value: `${selectedAssets.length} assets` },
            { label: '🕐', value: `Updated ${new Date().toLocaleTimeString()}` },
          ]}
          rows={
            <>
              <span className="chip">
                <span className="chip-icon">🔗</span> Connection
              </span>
              <span className="chip">
                <span className="chip-icon">📦</span> Asset Type
              </span>
            </>
          }
          measures={
            <>
              <span className="chip"># Assets</span>
              <span className="chip">% with Description</span>
              <span className="chip">% with Owner</span>
              <span className="chip">Avg Completeness</span>
            </>
          }
          insights={[
            {
              type: 'info',
              message: `Analyzing completeness metrics across ${completenessPivot.rows.length} connection/type combinations`,
            },
          ]}
        >
          <PivotTable
            headers={['Connection / Asset Type', '# Assets', '% Described', '% Owned', 'Completeness']}
            rows={completenessRows}
          />
        </PivotSection>
      )}

      <div className="section-divider">
        <span>Domain Health Pivots</span>
      </div>

      {/* PIVOT 2: Domain Health Scorecard */}
      {domainPivot && domainRows.length > 0 && (
        <>
          <PivotSection
            title="Quality Scorecard: Domain × Dimension"
            subtitle="Heatmap showing quality scores across all five dimensions by business domain"
            meta={[
              { label: '📊', value: `${domainPivot.rows.length} domains` },
              { label: '🕐', value: `Updated ${new Date().toLocaleTimeString()}` },
            ]}
            rows={
              <span className="chip">
                <span className="chip-icon">🏢</span> Domain
              </span>
            }
            columns={<span className="chip">Quality Dimensions (5)</span>}
            insights={[
              {
                type: 'info',
                message: `Analyzing quality across ${domainPivot.rows.length} business domains`,
              },
            ]}
          >
            <PivotTable
              headers={['Domain', 'Completeness', 'Accuracy', 'Timeliness', 'Consistency', 'Usability', 'Overall', 'Δ 30d']}
              rows={domainRows}
            />
          </PivotSection>
          <div className="legend">
            <div className="legend-item">
              <div className="legend-color" style={{ background: 'var(--score-excellent)' }}></div>
              Excellent (80+)
            </div>
            <div className="legend-item">
              <div className="legend-color" style={{ background: 'var(--score-good)' }}></div>
              Good (60-79)
            </div>
            <div className="legend-item">
              <div className="legend-color" style={{ background: 'var(--score-fair)' }}></div>
              Fair (40-59)
            </div>
            <div className="legend-item">
              <div className="legend-color" style={{ background: 'var(--score-poor)' }}></div>
              Poor (20-39)
            </div>
            <div className="legend-item">
              <div className="legend-color" style={{ background: 'var(--score-critical)' }}></div>
              Critical (0-19)
            </div>
          </div>
        </>
      )}

      <div className="section-divider">
        <span>Accountability Pivots</span>
      </div>

      {/* PIVOT 3: Owner Accountability */}
      {ownerPivot && ownerCertRows.length > 0 && (
        <PivotSection
          title="Owner Accountability: Certification Coverage"
          subtitle="Who is certifying their assets vs. leaving them in draft or unverified state?"
          meta={[
            { label: '📊', value: `${selectedAssets.length} assets` },
            { label: '👥', value: `${ownerPivot.rows.length} owner groups` },
          ]}
          rows={
            <span className="chip">
              <span className="chip-icon">👤</span> Owner Group
            </span>
          }
          columns={<span className="chip">Certification Status</span>}
          insights={[
            {
              type: 'info',
              message: `Tracking certification status across ${ownerPivot.rows.length} owner groups`,
            },
          ]}
        >
          <PivotTable
            headers={[
              'Owner Group',
              <span key="cert" className="status-badge certified">✓ Certified</span>,
              <span key="draft" className="status-badge draft">◐ Draft</span>,
              <span key="dep" className="status-badge deprecated">✗ Deprecated</span>,
              <span key="none" className="status-badge none">○ None</span>,
              'Total',
              'Cert Rate',
            ]}
            rows={ownerCertRows}
          />
        </PivotSection>
      )}

      <div className="section-divider">
        <span>Lineage & Supply Chain</span>
      </div>

      {/* PIVOT 4: Lineage Coverage */}
      {lineagePivot && lineageRows.length > 0 && (
        <PivotSection
          title="Lineage Coverage: Source Systems"
          subtitle="Which connections have documented lineage vs. orphaned assets?"
          meta={[
            { label: '📊', value: `${selectedAssets.length} assets` },
            { label: '🔗', value: `${lineagePivot.rows.length} connections` },
          ]}
          rows={
            <span className="chip">
              <span className="chip-icon">🔗</span> Connection
            </span>
          }
          measures={
            <>
              <span className="chip">Has Upstream</span>
              <span className="chip">Has Downstream</span>
              <span className="chip">Full Lineage</span>
              <span className="chip">Orphaned</span>
            </>
          }
          insights={[
            {
              type: 'info',
              message: `Analyzing lineage coverage across ${lineagePivot.rows.length} source systems`,
            },
          ]}
        >
          <PivotTable
            headers={[
              'Connection',
              'Total',
              'Has Upstream',
              'Has Downstream',
              'Full Lineage',
              <span key="orphaned" style={{ color: 'var(--accent-danger)' }}>Orphaned ⚠</span>,
              'Coverage',
            ]}
            rows={lineageRows}
          />
        </PivotSection>
      )}
    </div>
  );
}

