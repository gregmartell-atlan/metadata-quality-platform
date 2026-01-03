import { useMemo, useState } from 'react';
import { useAssetStore } from '../../stores/assetStore';
import { useAssetContextStore } from '../../stores/assetContextStore';
import { usePivotStore } from '../../stores/pivotStore';
import { useScoresStore } from '../../stores/scoresStore';
import type { AtlanAsset } from '../../services/atlan/types';
import { buildPivotHierarchy } from '../../utils/pivotBuilder';
import { buildDynamicPivot, pivotDataToTableRows } from '../../utils/dynamicPivotBuilder';
import { HierarchyFilter, type HierarchyFilter as HierarchyFilterType } from './HierarchyFilter';
import { PivotConfigurator } from './PivotConfigurator';
import { PivotSection } from './PivotSection';
import { PivotTable } from './PivotTable';
import { Button, showToast } from '../shared';
import type { RowDimension, Measure } from '../../types/pivot';
import { getDimensionLabel, getDimensionIcon } from '../../utils/pivotDimensions';
import { getMeasureLabel } from '../../utils/pivotMeasures';
import { getScoreClass, getHeatClass } from '../../utils/scoreThresholds';
import './DemoPivots.css';

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

interface RealPivotBuilderProps {
  onSave?: () => void;
}

export function RealPivotBuilder(props: RealPivotBuilderProps = {}) {
  const { onSave } = props;
  const { selectedAssets } = useAssetStore();
  // Subscribe directly to store state to get reactive updates
  const contextAssets = useAssetContextStore((state) => state.contextAssets);
  const { addView, setCurrentView } = usePivotStore();
  const { assetsWithScores } = useScoresStore();
  const [saving, setSaving] = useState(false);
  const [hierarchyFilter, setHierarchyFilter] = useState<HierarchyFilterType>({
    level: 'connection',
  });
  const [rowDimensions, setRowDimensions] = useState<RowDimension[]>(['connection', 'type']);
  const [measures, setMeasures] = useState<Measure[]>(['assetCount', 'completeness', 'accuracy', 'overall']);

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

  // Filter assets based on hierarchy filter
  const filteredAssets = useMemo(() => {
    if (sourceAssets.length === 0) return [];
    
    return sourceAssets.filter((asset) => {
      if (hierarchyFilter.connectionName && asset.connectionName !== hierarchyFilter.connectionName) {
        return false;
      }
      if (hierarchyFilter.databaseName) {
        const dbName = asset.typeName === 'Database' 
          ? asset.name 
          : ('databaseQualifiedName' in asset && asset.databaseQualifiedName)
          ? asset.databaseQualifiedName.split('/').pop() || null
          : null;
        if (dbName !== hierarchyFilter.databaseName) return false;
      }
      if (hierarchyFilter.schemaName) {
        const schemaName = asset.typeName === 'Schema'
          ? asset.name
          : ('schemaQualifiedName' in asset && asset.schemaQualifiedName)
          ? asset.schemaQualifiedName.split('/').pop() || null
          : null;
        if (schemaName !== hierarchyFilter.schemaName) return false;
      }
      return true;
    });
  }, [sourceAssets, hierarchyFilter]);

  // Build dynamic pivot table
  const pivotData = useMemo(() => {
    if (filteredAssets.length === 0 || rowDimensions.length === 0 || measures.length === 0) {
      return null;
    }
    return buildDynamicPivot(filteredAssets, rowDimensions, measures, undefined, scoresMap);
  }, [filteredAssets, rowDimensions, measures, scoresMap]);

  // Convert to table rows
  const dynamicTableRows = useMemo(() => {
    if (!pivotData) return [];
    return pivotDataToTableRows(pivotData, true);
  }, [pivotData]);

  // Build hierarchy from real assets with filter (for legacy views)
  const hierarchy = useMemo(() => {
    if (filteredAssets.length === 0) {
      return null;
    }
    return buildPivotHierarchy(filteredAssets, hierarchyFilter.level, {
      connectionName: hierarchyFilter.connectionName,
      databaseName: hierarchyFilter.databaseName,
      schemaName: hierarchyFilter.schemaName,
    });
  }, [filteredAssets, hierarchyFilter]);

  // Flatten hierarchy for table display (commented out - not currently used)
  // const tableRows = useMemo(() => {
  //   if (!hierarchy) return [];
  //   return flattenHierarchyForTable(hierarchy);
  // }, [hierarchy]);

  const handleSaveView = () => {
    if (!pivotData || rowDimensions.length === 0 || measures.length === 0) return;
    
    setSaving(true);
    const viewId = addView({
      name: `Pivot View ${new Date().toLocaleDateString()}`,
      description: `Pivot view with ${filteredAssets.length} asset${filteredAssets.length !== 1 ? 's' : ''}, grouped by ${rowDimensions.map(getDimensionLabel).join(' × ')}`,
      hierarchy: hierarchy || {
        id: 'root',
        label: 'All Assets',
        level: 'connection',
        children: [],
        assetGuids: filteredAssets.map((a: AtlanAsset) => a.guid),
        assetCount: filteredAssets.length,
      },
      config: {
        rowDimensions: rowDimensions as any,
        measures: measures as any,
      },
    });
    
    setCurrentView(viewId);
    setSaving(false);
    
    // Call parent callback if provided
    if (onSave) {
      onSave();
    }
    
    // Show success message
    showToast('Pivot view saved successfully!', 'success');
  };

  if (sourceAssets.length === 0) {
    return (
      <div className="demo-pivots" style={{ padding: '2rem', textAlign: 'center' }}>
        <h2>No Assets in Context</h2>
        <p>Please set an asset context by dragging a connection, database, or schema into the context header above, or select assets from the Asset Browser.</p>
      </div>
    );
  }


  return (
    <div className="demo-pivots">
      {/* Hierarchy Filter */}
      <HierarchyFilter
        assets={sourceAssets}
        filter={hierarchyFilter}
        onChange={setHierarchyFilter}
      />

      {/* Pivot Configurator */}
      <PivotConfigurator
        rowDimensions={rowDimensions}
        measures={measures}
        onRowDimensionsChange={setRowDimensions}
        onMeasuresChange={setMeasures}
      />

      <div style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ margin: 0 }}>Pivot Analysis</h2>
          <p style={{ margin: '0.5rem 0 0 0', color: 'var(--text-muted)' }}>
            Analyzing {filteredAssets.length} asset{filteredAssets.length !== 1 ? 's' : ''}
            {hierarchyFilter.level === 'connection' && hierarchyFilter.connectionName && ` in ${hierarchyFilter.connectionName}`}
            {hierarchyFilter.level === 'database' && ` in database ${hierarchyFilter.databaseName}`}
            {hierarchyFilter.level === 'schema' && ` in schema ${hierarchyFilter.schemaName}`}
          </p>
        </div>
        <Button variant="primary" onClick={handleSaveView} disabled={saving || !pivotData}>
          {saving ? 'Saving...' : 'Save View'}
        </Button>
      </div>

      {/* Dynamic Pivot Table */}
      {pivotData && (
        <PivotSection
          title={`Pivot: ${rowDimensions.map(getDimensionLabel).join(' × ')}`}
          subtitle={`Analyzing ${filteredAssets.length} assets by selected dimensions and measures`}
          meta={[
            { label: '📊', value: `${filteredAssets.length} assets` },
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
            headers={pivotData.headers}
            rows={dynamicTableRows}
          />
        </PivotSection>
      )}

      {!pivotData && (
        <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
          {filteredAssets.length === 0 ? (
            <p>No assets match the current filter. Adjust the hierarchy filter above.</p>
          ) : (
            <p>Select row dimensions and measures to build a pivot table.</p>
          )}
        </div>
      )}

      {/* Quality Scorecard */}
      {hierarchy && (
        <PivotSection
          title={`Quality Scorecard: ${hierarchyFilter.level === 'connection' ? 'Connection' : hierarchyFilter.level === 'database' ? 'Database' : 'Schema'} × Dimension`}
          subtitle="Heatmap showing quality scores across all five dimensions"
          meta={[
            { label: '📊', value: `${hierarchy.level === 'connection' ? hierarchy.children.length : 1} ${hierarchyFilter.level}${hierarchy.level === 'connection' ? 's' : ''}` },
            { label: '🕐', value: `Updated ${new Date().toLocaleTimeString()}` },
          ]}
          rows={
            <span className="chip">
              <span className="chip-icon">🔗</span> {hierarchyFilter.level === 'connection' ? 'Connection' : hierarchyFilter.level === 'database' ? 'Database' : 'Schema'}
            </span>
          }
          columns={<span className="chip">Quality Dimensions (5)</span>}
        >
          <PivotTable
            headers={[hierarchyFilter.level === 'connection' ? 'Connection' : hierarchyFilter.level === 'database' ? 'Database' : 'Schema', 'Completeness', 'Accuracy', 'Timeliness', 'Consistency', 'Usability', 'Overall']}
            rows={(hierarchy.level === 'connection' ? hierarchy.children : [hierarchy]).map((node) => [
              <span key={`node-${node.id}`}>
                <span className="dim-icon connection">
                  {node.level === 'connection' 
                    ? getConnectionIcon(node.label)
                    : node.level === 'database'
                    ? '🗄️'
                    : '📁'}
                </span>
                {node.label}
              </span>,
              <span key={`comp-${node.id}`} className={`heat-cell ${getHeatClass(node.metadata?.completeness || 0)}`}>
                {node.metadata?.completeness || 0}
              </span>,
              <span key={`acc-${node.id}`} className={`heat-cell ${getHeatClass(node.metadata?.accuracy || 0)}`}>
                {node.metadata?.accuracy || 0}
              </span>,
              <span key={`time-${node.id}`} className={`heat-cell ${getHeatClass(node.metadata?.timeliness || 0)}`}>
                {node.metadata?.timeliness || 0}
              </span>,
              <span key={`cons-${node.id}`} className={`heat-cell ${getHeatClass(node.metadata?.consistency || 0)}`}>
                {node.metadata?.consistency || 0}
              </span>,
              <span key={`use-${node.id}`} className={`heat-cell ${getHeatClass(node.metadata?.usability || 0)}`}>
                {node.metadata?.usability || 0}
              </span>,
              <span key={`overall-${node.id}`} className={`score-cell ${getScoreClass(node.metadata?.overall || 0)}`}>
                {node.metadata?.overall || 0}
              </span>,
            ])}
          />
        </PivotSection>
      )}
    </div>
  );
}

