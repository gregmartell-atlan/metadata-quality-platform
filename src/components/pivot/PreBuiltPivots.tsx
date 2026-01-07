/**
 * Pre-Built Pivot Views
 * 
 * Implements the 4 pivot views from the HTML spec:
 * 1. Completeness by Connection & Asset Type
 * 2. Quality Scorecard: Domain × Dimension
 * 3. Owner Accountability: Certification Coverage
 * 4. Lineage Coverage: Source Systems
 */

import React, { useMemo, useState, useEffect } from 'react';
import { Snowflake, Database, Table, BarChart3, Workflow, Building2, Users, Link2, Package, ArrowRight, BarChart, Clock } from 'lucide-react';
import { useAssetStore } from '../../stores/assetStore';
import { useAssetContextStore } from '../../stores/assetContextStore';
import { useScoresStore } from '../../stores/scoresStore';
import { buildDynamicPivot, pivotDataToTableRows } from '../../utils/dynamicPivotBuilder';
import { PivotSection } from './PivotSection';
import { PivotTable } from './PivotTable';
import { HierarchicalPivotTable } from './HierarchicalPivotTable';
import { PivotConfiguratorFlyout } from './PivotConfiguratorFlyout';
import { getDimensionLabel, getDimensionIcon } from '../../utils/pivotDimensions';
import { getMeasureLabel, formatMeasure, calculateMeasure } from '../../utils/pivotMeasures';
import { extractDimensionValue } from '../../utils/pivotDimensions';
import type { AtlanAsset } from '../../services/atlan/types';
import { scoreAssetQuality } from '../../services/qualityMetrics';
import type { AtlanAssetSummary } from '../../services/atlan/api';
import type { RowDimension, Measure, MeasureDisplayMode } from '../../types/pivot';
import { logger } from '../../utils/logger';
import { getScoreClass, getHeatClass } from '../../utils/scoreThresholds';
import './PreBuiltPivots.css';

const getConnectionIcon = (connName: string): React.ReactNode => {
  const lower = connName.toLowerCase();
  if (lower.includes('snowflake')) return <Snowflake size={16} />;
  if (lower.includes('bigquery') || lower.includes('big query')) return <Database size={16} />;
  if (lower.includes('postgres')) return <Database size={16} />;
  if (lower.includes('tableau')) return <BarChart3 size={16} />;
  if (lower.includes('dbt')) return <Workflow size={16} />;
  if (lower.includes('databricks')) return <Database size={16} />;
  return <Link2 size={16} />;
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
  // Subscribe directly to store state to get reactive updates
  const contextAssets = useAssetContextStore((state) => state.contextAssets);
  const context = useAssetContextStore((state) => state.context);
  const getAssetCount = useAssetContextStore((state) => state.getAssetCount);
  const { assetsWithScores } = useScoresStore();
  
  // Use context assets if available, fallback to selectedAssets for backward compatibility
  const sourceAssets = contextAssets.length > 0 ? contextAssets : selectedAssets;
  
  // Build scores map from scoresStore for efficient pivot calculations
  const scoresMap = useMemo(() => {
    if (assetsWithScores.length === 0) return undefined;
    const map = new Map<string, { completeness: number; accuracy: number; timeliness: number; consistency: number; usability: number; overall: number }>();
    assetsWithScores.forEach(({ asset, scores }) => {
      map.set(asset.guid, scores);
    });
    return map;
  }, [assetsWithScores]);
  
  // Log asset sources for debugging
  useEffect(() => {
    logger.info('PreBuiltPivots: Asset source check', {
      contextAssetsCount: contextAssets.length,
      selectedAssetsCount: selectedAssets.length,
      sourceAssetsCount: sourceAssets.length,
      hasContext: !!context,
      contextType: context?.type,
      contextLabel: context?.label,
      assetCount: getAssetCount()
    });
  }, [contextAssets, selectedAssets, sourceAssets, context, getAssetCount]);
  
  // State for configurable pivot - include full hierarchy: connection → database → schema → type
  const [rowDimensions, setRowDimensions] = useState<RowDimension[]>(['connection', 'database', 'schema', 'type']);
  const [measures, setMeasures] = useState<Measure[]>(['assetCount', 'descriptionCoverage', 'ownerCoverage', 'avgCompleteness']);
  const [measureDisplayModes, setMeasureDisplayModes] = useState<Map<Measure, MeasureDisplayMode>>(new Map());

  // Build dynamic pivot based on user selection
  const customPivot = useMemo(() => {
    // Skip building pivot until scores are ready to avoid wasteful double-build
    if (sourceAssets.length > 0 && !scoresMap) {
      logger.debug('PreBuiltPivots: Waiting for scores before building custom pivot');
      return null;
    }

    const startTime = performance.now();
    logger.info('PreBuiltPivots: Building custom pivot', {
      assetCount: sourceAssets.length,
      rowDimensions: rowDimensions.length,
      measures: measures.length
    });

    if (sourceAssets.length === 0 || rowDimensions.length === 0 || measures.length === 0) {
      logger.debug('PreBuiltPivots: Skipping custom pivot (empty input)');
      return null;
    }

    const pivot = buildDynamicPivot(sourceAssets, rowDimensions, measures, undefined, scoresMap);
    pivot.measureDisplayModes = measureDisplayModes;

    const duration = performance.now() - startTime;
    logger.info('PreBuiltPivots: Custom pivot built', {
      rowCount: pivot.rows.length,
      duration: `${duration.toFixed(2)}ms`
    });

    return pivot;
  }, [sourceAssets, rowDimensions, measures, measureDisplayModes, scoresMap]);

  const customPivotRows = useMemo(() => {
    if (!customPivot) return [];
    return pivotDataToTableRows(customPivot, true);
  }, [customPivot]);

  // PIVOT 1: Completeness by Connection & Asset Type (pre-built example)
  const completenessPivot = useMemo(() => {
    // Skip building pivot until scores are ready to avoid wasteful double-build
    if (sourceAssets.length > 0 && !scoresMap) {
      logger.debug('PreBuiltPivots: Waiting for scores before building completeness pivot');
      return null;
    }

    const startTime = performance.now();
    logger.info('PreBuiltPivots: Building completeness pivot', { assetCount: sourceAssets.length });

    if (sourceAssets.length === 0) {
      logger.debug('PreBuiltPivots: Skipping completeness pivot (no assets)');
      return null;
    }

    const pivot = buildDynamicPivot(
      sourceAssets,
      ['connection', 'type'],
      ['assetCount', 'descriptionCoverage', 'ownerCoverage', 'avgCompleteness'],
      undefined,
      scoresMap
    );

    const duration = performance.now() - startTime;
    logger.info('PreBuiltPivots: Completeness pivot built', {
      rowCount: pivot.rows.length,
      duration: `${duration.toFixed(2)}ms`
    });

    return pivot;
  }, [sourceAssets, scoresMap]);

  const completenessRows = useMemo(() => {
    if (!completenessPivot) return [];
    return pivotDataToTableRows(completenessPivot, true);
  }, [completenessPivot]);

  // PIVOT 2: Domain Health Scorecard
  const domainPivot = useMemo(() => {
    // Skip building pivot until scores are ready to avoid wasteful double-build
    if (sourceAssets.length > 0 && !scoresMap) {
      logger.debug('PreBuiltPivots: Waiting for scores before building domain pivot');
      return null;
    }

    const startTime = performance.now();
    logger.info('PreBuiltPivots: Building domain pivot', { assetCount: sourceAssets.length });

    if (sourceAssets.length === 0) {
      logger.debug('PreBuiltPivots: Skipping domain pivot (no assets)');
      return null;
    }

    const pivot = buildDynamicPivot(
      sourceAssets,
      ['domain'],
      ['completeness', 'accuracy', 'timeliness', 'consistency', 'usability', 'overall'],
      undefined,
      scoresMap
    );

    const duration = performance.now() - startTime;
    logger.info('PreBuiltPivots: Domain pivot built', {
      rowCount: pivot.rows.length,
      duration: `${duration.toFixed(2)}ms`
    });

    return pivot;
  }, [sourceAssets, scoresMap]);

  const domainRows = useMemo(() => {
    if (!domainPivot) return [];
    const rows: (string | React.ReactNode)[][] = [];
    
    domainPivot.rows.forEach((row) => {
      const domainName = row.dimensionValues.domain || 'No Domain';
      const cells: (string | React.ReactNode)[] = [
        <span key="domain" className="dim-cell">
          <Building2 size={16} className="dim-icon domain" />
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
        <span key="trend" className="trend flat">
          <ArrowRight size={12} style={{ display: 'inline', verticalAlign: 'middle' }} /> 0%
        </span>,
      ];
      rows.push(cells);
    });

    return rows;
  }, [domainPivot]);

  // PIVOT 3: Owner Accountability - Certification Coverage
  const ownerPivot = useMemo(() => {
    // Skip building pivot until scores are ready to avoid wasteful double-build
    if (sourceAssets.length > 0 && !scoresMap) {
      logger.debug('PreBuiltPivots: Waiting for scores before building owner pivot');
      return null;
    }

    if (sourceAssets.length === 0) return null;
    return buildDynamicPivot(
      sourceAssets,
      ['ownerGroup'],
      ['assetCount'],
      undefined,
      scoresMap
    );
  }, [sourceAssets, scoresMap]);

  // Calculate certification breakdown per owner group
  const ownerCertRows = useMemo(() => {
    if (!ownerPivot) return [];
    
    const rows: (string | React.ReactNode)[][] = [];
    
    ownerPivot.rows.forEach((row) => {
      const ownerGroup = row.dimensionValues.ownerGroup || 'Unowned';
      const assetGuids = row.assetGuids;
      
      // Get assets for this owner group
      const groupAssets = sourceAssets.filter((a) => 
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
          <Users size={16} className="dim-icon owner" />
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
    const totalCertified = sourceAssets.filter((a) => a.certificateStatus === 'VERIFIED').length;
    const totalDraft = sourceAssets.filter((a) => a.certificateStatus === 'DRAFT').length;
    const totalDeprecated = sourceAssets.filter((a) => a.certificateStatus === 'DEPRECATED').length;
    const totalNone = sourceAssets.filter((a) => !a.certificateStatus || a.certificateStatus === null).length;
    const totalAssets = sourceAssets.length;
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
  }, [ownerPivot, sourceAssets]);

  // PIVOT 4: Lineage Coverage
  const lineagePivot = useMemo(() => {
    // Skip building pivot until scores are ready to avoid wasteful double-build
    if (sourceAssets.length > 0 && !scoresMap) {
      logger.debug('PreBuiltPivots: Waiting for scores before building lineage pivot');
      return null;
    }

    const startTime = performance.now();
    logger.info('PreBuiltPivots: Building lineage pivot', { assetCount: sourceAssets.length });

    if (sourceAssets.length === 0) {
      logger.debug('PreBuiltPivots: Skipping lineage pivot (no assets)');
      return null;
    }

    const pivot = buildDynamicPivot(
      sourceAssets,
      ['connection', 'database', 'schema'],
      ['assetCount', 'hasUpstream', 'hasDownstream', 'fullLineage', 'orphaned'],
      undefined,
      scoresMap
    );

    const duration = performance.now() - startTime;
    logger.info('PreBuiltPivots: Lineage pivot built', {
      rowCount: pivot.rows.length,
      duration: `${duration.toFixed(2)}ms`
    });

    return pivot;
  }, [sourceAssets, scoresMap]);

  const lineageRows = useMemo(() => {
    if (!lineagePivot) return [];
    const rows: (string | React.ReactNode)[][] = [];

    lineagePivot.rows.forEach((row) => {
      const connection = row.dimensionValues.connection || 'Unknown';
      const database = row.dimensionValues.database || '—';
      const schema = row.dimensionValues.schema || '—';
      const assetGuids = row.assetGuids;
      const groupAssets = sourceAssets.filter((a) => assetGuids.includes(a.guid));

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
        <span key="db" className="dim-cell">
          <Database size={14} style={{ opacity: 0.6, marginRight: 4 }} />
          {database}
        </span>,
        <span key="schema" className="dim-cell">
          <Table size={14} style={{ opacity: 0.6, marginRight: 4 }} />
          {schema}
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
    const totalAssets = sourceAssets.length;
    const totalOrphaned = calculateMeasure('orphaned', sourceAssets);
    const overallCoverage = totalAssets > 0 ? Math.round(((totalAssets - totalOrphaned) / totalAssets) * 100) : 0;
    const avgUpstream = calculateMeasure('hasUpstream', sourceAssets);
    const avgDownstream = calculateMeasure('hasDownstream', sourceAssets);
    const avgFull = calculateMeasure('fullLineage', sourceAssets);

    rows.push([
      <strong key="total-label">Total</strong>,
      <span key="total-db"></span>,
      <span key="total-schema"></span>,
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
  }, [lineagePivot, sourceAssets]);

  // Early return after all hooks are called
  // Check both sourceAssets and context to provide better messaging
  const hasContext = !!context && context.type !== null;
  const hasAssets = sourceAssets.length > 0;
  
  logger.debug('PreBuiltPivots: Rendering check', {
    hasContext,
    hasAssets,
    sourceAssetsCount: sourceAssets.length,
    contextType: context?.type,
    contextLabel: context?.label
  });
  
  if (!hasAssets) {
    return (
      <div className="pre-built-pivots-empty">
        <h2>No Assets in Context</h2>
        <p>
          {hasContext 
            ? `Context is set (${context?.label}) but no assets were loaded. Please try refreshing or selecting a different context.`
            : 'Please set an asset context by dragging a connection, database, or schema into the context header, or select assets from the Asset Browser.'}
        </p>
        {hasContext && (
          <div style={{ marginTop: '1rem', padding: '0.75rem', background: 'var(--bg-secondary)', borderRadius: '6px', fontSize: '0.875rem' }}>
            <strong>Debug Info:</strong>
            <ul style={{ marginTop: '0.5rem', paddingLeft: '1.5rem' }}>
              <li>Context Type: {context?.type}</li>
              <li>Context Label: {context?.label}</li>
              <li>Asset Count: {getAssetCount()}</li>
              <li>Context Assets: {contextAssets.length}</li>
              <li>Selected Assets: {selectedAssets.length}</li>
            </ul>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="pre-built-pivots">
      {/* Pivot Configurator Flyout */}
      <PivotConfiguratorFlyout
        rowDimensions={rowDimensions}
        measures={measures}
        onRowDimensionsChange={setRowDimensions}
        onMeasuresChange={setMeasures}
        measureDisplayModes={measureDisplayModes}
        onMeasureDisplayModesChange={setMeasureDisplayModes}
      />

      {/* Custom Pivot View */}
      {customPivot && customPivotRows.length > 0 && (
        <PivotSection
          title={`Custom Pivot: ${rowDimensions.map(getDimensionLabel).join(' × ')}`}
          subtitle={`Analyzing ${sourceAssets.length} assets by your selected dimensions and measures`}
          meta={[
            { label: '📊', value: `${sourceAssets.length} assets` },
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
          {rowDimensions.length >= 2 ? (
            <HierarchicalPivotTable
              data={customPivot}
              assets={sourceAssets}
            />
          ) : (
            <PivotTable
              headers={customPivot.headers}
              rows={customPivotRows}
            />
          )}
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
            { label: '📊', value: `${sourceAssets.length} assets` },
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
          <HierarchicalPivotTable
            data={completenessPivot}
            assets={sourceAssets}
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
              { label: <BarChart size={14} />, value: `${domainPivot.rows.length} domains` },
              { label: <Clock size={14} />, value: `Updated ${new Date().toLocaleTimeString()}` },
            ]}
            rows={
            <span className="chip">
              <Building2 size={14} className="chip-icon" /> Domain
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
            { label: '📊', value: `${sourceAssets.length} assets` },
            { label: '👥', value: `${ownerPivot.rows.length} owner groups` },
          ]}
          rows={
            <span className="chip">
              <Users size={14} className="chip-icon" /> Owner Group
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
            { label: <BarChart size={14} />, value: `${sourceAssets.length} assets` },
            { label: <Link2 size={14} />, value: `${lineagePivot.rows.length} connections` },
          ]}
          rows={
            <span className="chip">
              <Link2 size={14} className="chip-icon" /> Connection
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
              'Database',
              'Schema',
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

