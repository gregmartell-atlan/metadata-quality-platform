/**
 * Pivot Builder Utilities
 * 
 * Functions to build pivot hierarchies from real asset data
 */

import type { AtlanAsset } from '../services/atlan/types';
import type { PivotHierarchyNode } from '../stores/pivotStore';
import { scoreAssetQuality } from '../services/qualityMetrics';
import type { AtlanAssetSummary } from '../services/atlan/api';

type QualityScores = ReturnType<typeof scoreAssetQuality>;

/**
 * Convert AtlanAsset to AtlanAssetSummary for scoring
 */
function assetToSummary(asset: AtlanAsset): AtlanAssetSummary {
  return {
    guid: asset.guid,
    typeName: asset.typeName,
    name: asset.name || '',
    qualifiedName: asset.qualifiedName || '',
    connectionName: asset.connectionName,
    connectionQualifiedName: asset.connectionQualifiedName,
    description: asset.description,
    userDescription: asset.userDescription,
    ownerUsers: asset.ownerUsers,
    ownerGroups: asset.ownerGroups,
    certificateStatus: asset.certificateStatus || undefined,
    certificateUpdatedAt: asset.certificateUpdatedAt,
    classificationNames: asset.classificationNames,
    meanings: asset.meanings,
    domainGUIDs: asset.domainGUIDs,
    updateTime: asset.updateTime,
    sourceUpdatedAt: asset.sourceUpdatedAt,
    sourceLastReadAt: asset.sourceLastReadAt,
    lastRowChangedAt: asset.lastRowChangedAt,
    lastProfiledAt: (asset as any).lastProfiledAt,
    popularityScore: asset.popularityScore,
    viewScore: asset.viewScore,
    starredCount: asset.starredCount,
    __hasLineage: asset.__hasLineage || false,
    isDiscoverable: asset.isDiscoverable !== false,
    isAIGenerated: asset.isAIGenerated,
    readme: asset.readme,
    databaseQualifiedName: (asset as any).databaseQualifiedName,
    schemaQualifiedName: (asset as any).schemaQualifiedName,
    queryCount: (asset as any).queryCount,
    queryUserCount: (asset as any).queryUserCount,
    sourceReadCount: (asset as any).sourceReadCount,
    sourceReadUserCount: (asset as any).sourceReadUserCount,
  };
}

/**
 * Extract connection name from asset
 */
function getConnectionName(asset: AtlanAsset): string {
  // Try connectionName first, then connectorName, then fallback
  return asset.connectionName || (asset as any).connectorName || 'Unknown Connection';
}

/**
 * Extract database name from asset
 */
function getDatabaseName(asset: AtlanAsset): string | null {
  if (asset.typeName === 'Database') {
    return asset.name || null;
  }
  if ((asset as any).databaseName) {
    return (asset as any).databaseName as string;
  }
  if ('databaseQualifiedName' in asset && asset.databaseQualifiedName) {
    // Extract database name from qualified name
    const parts = asset.databaseQualifiedName.split('/');
    return parts[parts.length - 1] || null;
  }
  return null;
}

/**
 * Extract schema name from asset
 */
function getSchemaName(asset: AtlanAsset): string | null {
  if (asset.typeName === 'Schema') {
    return asset.name || null;
  }
  if ((asset as any).schemaName) {
    return (asset as any).schemaName as string;
  }
  if ('schemaQualifiedName' in asset && asset.schemaQualifiedName) {
    const parts = asset.schemaQualifiedName.split('/');
    return parts[parts.length - 1] || null;
  }
  return null;
}

function avgScoresForAssets(
  assets: AtlanAsset[],
  scoreByGuid: Map<string, QualityScores>
): QualityScores & { overall: number } {
  if (assets.length === 0) {
    return { completeness: 0, accuracy: 0, timeliness: 0, consistency: 0, usability: 0, overall: 0 };
  }

  let completeness = 0;
  let accuracy = 0;
  let timeliness = 0;
  let consistency = 0;
  let usability = 0;

  for (const a of assets) {
    const s = scoreByGuid.get(a.guid);
    if (!s) continue;
    completeness += s.completeness;
    accuracy += s.accuracy;
    timeliness += s.timeliness;
    consistency += s.consistency;
    usability += s.usability;
  }

  const n = assets.length;
  const avgCompleteness = Math.round(completeness / n);
  const avgAccuracy = Math.round(accuracy / n);
  const avgTimeliness = Math.round(timeliness / n);
  const avgConsistency = Math.round(consistency / n);
  const avgUsability = Math.round(usability / n);
  const overall = Math.round((avgCompleteness + avgAccuracy + avgTimeliness + avgConsistency + avgUsability) / 5);

  return {
    completeness: avgCompleteness,
    accuracy: avgAccuracy,
    timeliness: avgTimeliness,
    consistency: avgConsistency,
    usability: avgUsability,
    overall,
  };
}

/**
 * Filter assets based on hierarchy filter
 */
function filterAssetsByHierarchy(
  assets: AtlanAsset[],
  filter: { connectionName?: string; databaseName?: string; schemaName?: string }
): AtlanAsset[] {
  return assets.filter((asset) => {
    if (filter.connectionName && asset.connectionName !== filter.connectionName) {
      return false;
    }
    if (filter.databaseName) {
      const dbName = getDatabaseName(asset);
      if (dbName !== filter.databaseName) {
        return false;
      }
    }
    if (filter.schemaName) {
      const schemaName = getSchemaName(asset);
      if (schemaName !== filter.schemaName) {
        return false;
      }
    }
    return true;
  });
}

/**
 * Build hierarchy: Connection → Database → Schema → Type → Assets
 * @param assets - Assets to build hierarchy from
 * @param startLevel - Level to start building from ('connection', 'database', or 'schema')
 * @param filter - Optional filter to apply before building hierarchy
 */
export function buildPivotHierarchy(
  assets: AtlanAsset[],
  startLevel: 'connection' | 'database' | 'schema' = 'connection',
  filter?: { connectionName?: string; databaseName?: string; schemaName?: string }
): PivotHierarchyNode {
  // Apply filter if provided
  const filteredAssets = filter ? filterAssetsByHierarchy(assets, filter) : assets;

  // Precompute scores once per asset (avoids repeated scoring in each grouping level)
  const scoreByGuid = new Map<string, QualityScores>();
  for (const asset of filteredAssets) {
    scoreByGuid.set(asset.guid, scoreAssetQuality(assetToSummary(asset)));
  }

  // Handle different start levels
  if (startLevel === 'schema' && filter?.connectionName && filter?.databaseName && filter?.schemaName) {
    // Start from schema level - show only types under the selected schema
    const schemaAssets = filteredAssets.filter(
      (asset) => getSchemaName(asset) === filter.schemaName
    );

    const byType = new Map<string, AtlanAsset[]>();
    schemaAssets.forEach((asset) => {
      const typeName = asset.typeName || 'Unknown';
      if (!byType.has(typeName)) {
        byType.set(typeName, []);
      }
      byType.get(typeName)!.push(asset);
    });

    const typeChildren: PivotHierarchyNode[] = [];
    byType.forEach((typeAssets, typeName) => {
      const avg = avgScoresForAssets(typeAssets, scoreByGuid);
      typeChildren.push({
        id: `${filter.connectionName}-${filter.databaseName}-${filter.schemaName}-${typeName}`,
        label: typeName,
        level: 'type',
        type: typeName,
        connectionName: filter.connectionName,
        databaseName: filter.databaseName,
        schemaName: filter.schemaName,
        children: [],
        assetGuids: typeAssets.map((a) => a.guid),
        assetCount: typeAssets.length,
        metadata: avg,
      });
    });

    const schemaAvg = avgScoresForAssets(schemaAssets, scoreByGuid);
    return {
      id: `${filter.connectionName}-${filter.databaseName}-${filter.schemaName}`,
      label: filter.schemaName || 'No Schema',
      level: 'schema',
      connectionName: filter.connectionName,
      databaseName: filter.databaseName,
      schemaName: filter.schemaName,
      children: typeChildren,
      assetGuids: schemaAssets.map((a) => a.guid),
      assetCount: schemaAssets.length,
      metadata: schemaAvg,
    };
  }

  if (startLevel === 'database' && filter?.connectionName && filter?.databaseName) {
    // Start from database level - show schemas and types under the selected database
    const dbAssets = filteredAssets.filter((asset) => getDatabaseName(asset) === filter.databaseName);

    const bySchema = new Map<string, AtlanAsset[]>();
    dbAssets.forEach((asset) => {
      const schemaName = getSchemaName(asset);
      const key = schemaName || '_no_schema';
      if (!bySchema.has(key)) {
        bySchema.set(key, []);
      }
      bySchema.get(key)!.push(asset);
    });

    const schemaChildren: PivotHierarchyNode[] = [];
    bySchema.forEach((schemaAssets, schemaKey) => {
      const schemaName = schemaKey === '_no_schema' ? null : schemaKey;

      const byType = new Map<string, AtlanAsset[]>();
      schemaAssets.forEach((asset) => {
        const typeName = asset.typeName || 'Unknown';
        if (!byType.has(typeName)) {
          byType.set(typeName, []);
        }
        byType.get(typeName)!.push(asset);
      });

      const typeChildren: PivotHierarchyNode[] = [];
      byType.forEach((typeAssets, typeName) => {
        const avg = avgScoresForAssets(typeAssets, scoreByGuid);
        typeChildren.push({
          id: `${filter.connectionName}-${filter.databaseName}-${schemaName || 'none'}-${typeName}`,
          label: typeName,
          level: 'type',
          type: typeName,
          connectionName: filter.connectionName,
          databaseName: filter.databaseName,
          schemaName: schemaName || undefined,
          children: [],
          assetGuids: typeAssets.map((a) => a.guid),
          assetCount: typeAssets.length,
          metadata: avg,
        });
      });

      const schemaAvg = avgScoresForAssets(schemaAssets, scoreByGuid);
      schemaChildren.push({
        id: `${filter.connectionName}-${filter.databaseName}-${schemaName || 'none'}`,
        label: schemaName || 'No Schema',
        level: 'schema',
        connectionName: filter.connectionName,
        databaseName: filter.databaseName,
        schemaName: schemaName || undefined,
        children: typeChildren,
        assetGuids: schemaAssets.map((a) => a.guid),
        assetCount: schemaAssets.length,
        metadata: schemaAvg,
      });
    });

    const dbAvg = avgScoresForAssets(dbAssets, scoreByGuid);
    return {
      id: `${filter.connectionName}-${filter.databaseName}`,
      label: filter.databaseName || 'No Database',
      level: 'database',
      connectionName: filter.connectionName,
      databaseName: filter.databaseName,
      children: schemaChildren,
      assetGuids: dbAssets.map((a) => a.guid),
      assetCount: dbAssets.length,
      metadata: dbAvg,
    };
  }

  // Default: start from connection level
  // Group assets by connection
  const byConnection = new Map<string, AtlanAsset[]>();
  
  filteredAssets.forEach((asset) => {
    const connName = getConnectionName(asset);
    if (!byConnection.has(connName)) {
      byConnection.set(connName, []);
    }
    byConnection.get(connName)!.push(asset);
  });

  const rootChildren: PivotHierarchyNode[] = [];

  // Process each connection
  byConnection.forEach((connAssets, connName) => {
    // Group by database
    const byDatabase = new Map<string, AtlanAsset[]>();
    connAssets.forEach((asset) => {
      const dbName = getDatabaseName(asset);
      const key = dbName || '_no_database';
      if (!byDatabase.has(key)) {
        byDatabase.set(key, []);
      }
      byDatabase.get(key)!.push(asset);
    });

    const dbChildren: PivotHierarchyNode[] = [];

    // Process each database
    byDatabase.forEach((dbAssets, dbKey) => {
      const dbName = dbKey === '_no_database' ? null : dbKey;
      
      // Group by schema
      const bySchema = new Map<string, AtlanAsset[]>();
      dbAssets.forEach((asset) => {
        const schemaName = getSchemaName(asset);
        const key = schemaName || '_no_schema';
        if (!bySchema.has(key)) {
          bySchema.set(key, []);
        }
        bySchema.get(key)!.push(asset);
      });

      const schemaChildren: PivotHierarchyNode[] = [];

      // Process each schema
      bySchema.forEach((schemaAssets, schemaKey) => {
        const schemaName = schemaKey === '_no_schema' ? null : schemaKey;
        
        // Group by asset type
        const byType = new Map<string, AtlanAsset[]>();
        schemaAssets.forEach((asset) => {
          const typeName = asset.typeName || 'Unknown';
          if (!byType.has(typeName)) {
            byType.set(typeName, []);
          }
          byType.get(typeName)!.push(asset);
        });

        const typeChildren: PivotHierarchyNode[] = [];

        // Process each type
        byType.forEach((typeAssets, typeName) => {
          const avg = avgScoresForAssets(typeAssets, scoreByGuid);

          typeChildren.push({
            id: `${connName}-${dbName || 'none'}-${schemaName || 'none'}-${typeName}`,
            label: typeName,
            level: 'type',
            type: typeName,
            connectionName: connName,
            databaseName: dbName || undefined,
            schemaName: schemaName || undefined,
            children: [],
            assetGuids: typeAssets.map((a) => a.guid),
            assetCount: typeAssets.length,
            metadata: {
              completeness: avg.completeness,
              accuracy: avg.accuracy,
              timeliness: avg.timeliness,
              consistency: avg.consistency,
              usability: avg.usability,
              overall: avg.overall,
            },
          });
        });

        // Calculate schema-level aggregates
        const allSchemaAssets = schemaAssets;
        const schemaAvg = avgScoresForAssets(allSchemaAssets, scoreByGuid);

        schemaChildren.push({
          id: `${connName}-${dbName || 'none'}-${schemaName || 'none'}`,
          label: schemaName || 'No Schema',
          level: 'schema',
          connectionName: connName,
          databaseName: dbName || undefined,
          schemaName: schemaName || undefined,
          children: typeChildren,
          assetGuids: allSchemaAssets.map((a) => a.guid),
          assetCount: allSchemaAssets.length,
          metadata: {
            completeness: schemaAvg.completeness,
            accuracy: schemaAvg.accuracy,
            timeliness: schemaAvg.timeliness,
            consistency: schemaAvg.consistency,
            usability: schemaAvg.usability,
            overall: schemaAvg.overall,
          },
        });
      });

      // Calculate database-level aggregates
      const allDbAssets = dbAssets;
      const dbAvg = avgScoresForAssets(allDbAssets, scoreByGuid);

      dbChildren.push({
        id: `${connName}-${dbName || 'none'}`,
        label: dbName || 'No Database',
        level: 'database',
        connectionName: connName,
        databaseName: dbName || undefined,
        children: schemaChildren,
        assetGuids: allDbAssets.map((a) => a.guid),
        assetCount: allDbAssets.length,
        metadata: {
          completeness: dbAvg.completeness,
          accuracy: dbAvg.accuracy,
          timeliness: dbAvg.timeliness,
          consistency: dbAvg.consistency,
          usability: dbAvg.usability,
          overall: dbAvg.overall,
        },
      });
    });

    // Calculate connection-level aggregates
    const connAvg = avgScoresForAssets(connAssets, scoreByGuid);

    rootChildren.push({
      id: connName,
      label: connName,
      level: 'connection',
      connectionName: connName,
      children: dbChildren,
      assetGuids: connAssets.map((a) => a.guid),
      assetCount: connAssets.length,
      metadata: {
        completeness: connAvg.completeness,
        accuracy: connAvg.accuracy,
        timeliness: connAvg.timeliness,
        consistency: connAvg.consistency,
        usability: connAvg.usability,
        overall: connAvg.overall,
      },
    });
  });

  // Calculate root-level aggregates
  const rootAvg = avgScoresForAssets(assets, scoreByGuid);

  return {
    id: 'root',
    label: 'All Assets',
    level: 'connection',
    children: rootChildren,
    assetGuids: assets.map((a) => a.guid),
    assetCount: assets.length,
    metadata: {
      completeness: rootAvg.completeness,
      accuracy: rootAvg.accuracy,
      timeliness: rootAvg.timeliness,
      consistency: rootAvg.consistency,
      usability: rootAvg.usability,
      overall: rootAvg.overall,
    },
  };
}

/**
 * Flatten hierarchy for table display
 */
export function flattenHierarchyForTable(
  node: PivotHierarchyNode,
  depth: number = 0,
  parentPath: string[] = []
): Array<{
  path: string[];
  node: PivotHierarchyNode;
  depth: number;
}> {
  const result: Array<{
    path: string[];
    node: PivotHierarchyNode;
    depth: number;
  }> = [];

  const currentPath = [...parentPath, node.label];
  
  // Add current node
  result.push({
    path: currentPath,
    node,
    depth,
  });

  // Add children recursively
  node.children.forEach((child) => {
    result.push(...flattenHierarchyForTable(child, depth + 1, currentPath));
  });

  return result;
}

