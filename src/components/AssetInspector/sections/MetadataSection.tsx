/**
 * Metadata Section
 *
 * Shows technical metadata and table properties
 */

import { Database } from 'lucide-react';
import type { AtlanAsset } from '../../../services/atlan/types';

interface MetadataSectionProps {
  asset: AtlanAsset;
}

export function MetadataSection({ asset }: MetadataSectionProps) {
  const formatDate = (timestamp: number | undefined): string => {
    if (!timestamp) return 'Not available';
    return new Date(timestamp).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const isConnection = asset.typeName === 'Connection';
  const isDatabase = asset.typeName === 'Database';
  const isSchema = asset.typeName === 'Schema';
  const isTable = ['Table', 'View', 'MaterializedView'].includes(asset.typeName);

  return (
    <div className="metadata-section">
      {/* Connection Properties */}
      {isConnection && (
        <div className="inspector-section">
          <div className="section-title">
            <Database size={14} />
            Connection Properties
          </div>
          <div className="section-content">
            <div className="metadata-list">
              <div className="metadata-item">
                <div className="metadata-item-label">Type</div>
                <div className="metadata-item-value">{asset.typeName}</div>
              </div>

              {asset.connectorName && (
                <div className="metadata-item">
                  <div className="metadata-item-label">Connector</div>
                  <div className="metadata-item-value">{asset.connectorName}</div>
                </div>
              )}

              {asset.allowQuery !== undefined && (
                <div className="metadata-item">
                  <div className="metadata-item-label">Allow Query</div>
                  <div className="metadata-item-value">{asset.allowQuery ? 'Yes' : 'No'}</div>
                </div>
              )}

              {asset.hasPopularityInsights !== undefined && (
                <div className="metadata-item">
                  <div className="metadata-item-label">Popularity Insights</div>
                  <div className="metadata-item-value">{asset.hasPopularityInsights ? 'Enabled' : 'Disabled'}</div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Database Properties */}
      {isDatabase && (
        <div className="inspector-section">
          <div className="section-title">
            <Database size={14} />
            Database Properties
          </div>
          <div className="section-content">
            <div className="metadata-list">
              <div className="metadata-item">
                <div className="metadata-item-label">Type</div>
                <div className="metadata-item-value">{asset.typeName}</div>
              </div>

              {asset.connectionName && (
                <div className="metadata-item">
                  <div className="metadata-item-label">Connection</div>
                  <div className="metadata-item-value">{asset.connectionName}</div>
                </div>
              )}

              {asset.schemaCount !== undefined && (
                <div className="metadata-item">
                  <div className="metadata-item-label">Schema Count</div>
                  <div className="metadata-item-value">{asset.schemaCount}</div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Schema Properties */}
      {isSchema && (
        <div className="inspector-section">
          <div className="section-title">
            <Database size={14} />
            Schema Properties
          </div>
          <div className="section-content">
            <div className="metadata-list">
              <div className="metadata-item">
                <div className="metadata-item-label">Type</div>
                <div className="metadata-item-value">{asset.typeName}</div>
              </div>

              {asset.databaseName && (
                <div className="metadata-item">
                  <div className="metadata-item-label">Database</div>
                  <div className="metadata-item-value">{asset.databaseName}</div>
                </div>
              )}

              {asset.tableCount !== undefined && (
                <div className="metadata-item">
                  <div className="metadata-item-label">Table Count</div>
                  <div className="metadata-item-value">{asset.tableCount}</div>
                </div>
              )}

              {asset.viewCount !== undefined && (
                <div className="metadata-item">
                  <div className="metadata-item-label">View Count</div>
                  <div className="metadata-item-value">{asset.viewCount}</div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Table Properties */}
      {isTable && (
        <div className="inspector-section">
          <div className="section-title">
            <Database size={14} />
            Table Properties
          </div>
          <div className="section-content">
            <div className="metadata-list">
            <div className="metadata-item">
              <div className="metadata-item-label">Type</div>
              <div className="metadata-item-value">{asset.typeName}</div>
            </div>

            {asset.tableType && (
              <div className="metadata-item">
                <div className="metadata-item-label">Table Type</div>
                <div className="metadata-item-value">{asset.tableType}</div>
              </div>
            )}

            {asset.columnCount !== undefined && (
              <div className="metadata-item">
                <div className="metadata-item-label">Columns</div>
                <div className="metadata-item-value">{asset.columnCount}</div>
              </div>
            )}

            {asset.rowCount !== undefined && (
              <div className="metadata-item">
                <div className="metadata-item-label">Rows</div>
                <div className="metadata-item-value">{asset.rowCount.toLocaleString()}</div>
              </div>
            )}

            {asset.sizeBytes !== undefined && (
              <div className="metadata-item">
                <div className="metadata-item-label">Size</div>
                <div className="metadata-item-value">{(asset.sizeBytes / 1024 / 1024).toFixed(2)} MB</div>
              </div>
            )}

            <div className="metadata-item">
              <div className="metadata-item-label">Partitioned</div>
              <div className="metadata-item-value">
                {asset.isPartitioned ? `Yes (${asset.partitionCount || 0} partitions)` : 'No'}
              </div>
            </div>

            {asset.partitionStrategy && (
              <div className="metadata-item">
                <div className="metadata-item-label">Partition Strategy</div>
                <div className="metadata-item-value">{asset.partitionStrategy}</div>
              </div>
            )}

            {asset.isProfiled !== undefined && (
              <div className="metadata-item">
                <div className="metadata-item-label">Profiled</div>
                <div className="metadata-item-value">{asset.isProfiled ? 'Yes' : 'No'}</div>
              </div>
            )}

            {asset.tableRetentionTime !== undefined && (
              <div className="metadata-item">
                <div className="metadata-item-label">Retention Time</div>
                <div className="metadata-item-value">{asset.tableRetentionTime} days</div>
              </div>
            )}
          </div>
        </div>
      </div>
      )}

      {/* Timestamps */}
      <div className="inspector-section">
        <div className="section-title">Timestamps</div>
        <div className="section-content">
          <div className="metadata-list">
            {asset.createTime && (
              <div className="metadata-item">
                <div className="metadata-item-label">Created</div>
                <div className="metadata-item-value">{formatDate(asset.createTime)}</div>
              </div>
            )}

            {asset.updateTime && (
              <div className="metadata-item">
                <div className="metadata-item-label">Updated</div>
                <div className="metadata-item-value">{formatDate(asset.updateTime)}</div>
              </div>
            )}

            {asset.sourceCreatedAt && (
              <div className="metadata-item">
                <div className="metadata-item-label">Source Created</div>
                <div className="metadata-item-value">{formatDate(asset.sourceCreatedAt)}</div>
              </div>
            )}

            {asset.sourceUpdatedAt && (
              <div className="metadata-item">
                <div className="metadata-item-label">Source Updated</div>
                <div className="metadata-item-value">{formatDate(asset.sourceUpdatedAt)}</div>
              </div>
            )}

            {asset.lastSyncRunAt && (
              <div className="metadata-item">
                <div className="metadata-item-label">Last Sync</div>
                <div className="metadata-item-value">{formatDate(asset.lastSyncRunAt)}</div>
              </div>
            )}

            {asset.lastProfiledAt && (
              <div className="metadata-item">
                <div className="metadata-item-label">Last Profiled</div>
                <div className="metadata-item-value">{formatDate(asset.lastProfiledAt)}</div>
              </div>
            )}

            {asset.lastRowChangedAt && asset.lastRowChangedAt > 0 && (
              <div className="metadata-item">
                <div className="metadata-item-label">Last Row Changed</div>
                <div className="metadata-item-value">{formatDate(asset.lastRowChangedAt)}</div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* User Audit */}
      {(asset.createdBy || asset.updatedBy) && (
        <div className="inspector-section">
          <div className="section-title">Audit Trail</div>
          <div className="section-content">
            <div className="metadata-list">
              {asset.createdBy && (
                <div className="metadata-item">
                  <div className="metadata-item-label">Created By</div>
                  <div className="metadata-item-value">{asset.createdBy}</div>
                </div>
              )}

              {asset.updatedBy && (
                <div className="metadata-item">
                  <div className="metadata-item-label">Updated By</div>
                  <div className="metadata-item-value">{asset.updatedBy}</div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
