/**
 * Asset Preview Drawer
 *
 * Right-edge flyout that shows detailed asset information and metadata
 * when an asset is selected from anywhere in the application.
 */

import { useEffect } from 'react';
import { X, ExternalLink, Tag, User, Calendar, Database, Shield, FileText, Link2 } from 'lucide-react';
import type { AtlanAsset } from '../../services/atlan/types';
import './AssetPreviewDrawer.css';

interface AssetPreviewDrawerProps {
  asset: AtlanAsset | null;
  isOpen: boolean;
  onClose: () => void;
}

export function AssetPreviewDrawer({ asset, isOpen, onClose }: AssetPreviewDrawerProps) {
  // Close on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  if (!isOpen || !asset) return null;

  const getAssetTypeIcon = (typeName?: string) => {
    switch (typeName?.toLowerCase()) {
      case 'table':
        return <Database size={16} />;
      case 'column':
        return <FileText size={16} />;
      case 'view':
        return <Database size={16} />;
      default:
        return <Database size={16} />;
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Unknown';
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return dateString;
    }
  };

  // Extract metadata from asset attributes
  const description = asset.attributes?.description || asset.attributes?.userDescription || null;
  const owner = asset.attributes?.ownerUsers?.[0] || asset.attributes?.ownerGroups?.[0] || null;
  const certificateStatus = asset.attributes?.certificateStatus || null;
  const tags = asset.attributes?.tags || [];
  const classifications = asset.attributes?.classifications || [];
  const createdAt = asset.attributes?.createTime;
  const updatedAt = asset.attributes?.updateTime;
  const qualifiedName = asset.attributes?.qualifiedName || '';

  // Parse qualified name for hierarchy
  const qualifiedParts = qualifiedName.split('/').filter(Boolean);

  return (
    <>
      {/* Backdrop */}
      <div className="asset-preview-backdrop" onClick={onClose} />

      {/* Drawer */}
      <div className="asset-preview-drawer">
        {/* Header */}
        <div className="preview-header">
          <button className="preview-close-btn" onClick={onClose} title="Close preview">
            <X size={18} />
          </button>
          <div className="preview-title-section">
            <div className="preview-type-badge">
              {getAssetTypeIcon(asset.typeName)}
              <span>{asset.typeName || 'Asset'}</span>
            </div>
            <h2 className="preview-title">{asset.attributes?.name || 'Unnamed Asset'}</h2>
            {certificateStatus && (
              <span className={`preview-certification preview-certification-${certificateStatus.toLowerCase()}`}>
                <Shield size={12} />
                {certificateStatus}
              </span>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="preview-content">
          {/* Description */}
          <section className="preview-section">
            <h3 className="preview-section-title">
              <FileText size={14} />
              Description
            </h3>
            {description ? (
              <p className="preview-description">{description}</p>
            ) : (
              <p className="preview-empty">No description available</p>
            )}
          </section>

          {/* Ownership */}
          <section className="preview-section">
            <h3 className="preview-section-title">
              <User size={14} />
              Owner
            </h3>
            {owner ? (
              <div className="preview-owner">
                <span className="owner-avatar">{owner.charAt(0).toUpperCase()}</span>
                <span className="owner-name">{owner}</span>
              </div>
            ) : (
              <p className="preview-empty">No owner assigned</p>
            )}
          </section>

          {/* Tags */}
          {tags.length > 0 && (
            <section className="preview-section">
              <h3 className="preview-section-title">
                <Tag size={14} />
                Tags ({tags.length})
              </h3>
              <div className="preview-tags">
                {tags.map((tag: string, i: number) => (
                  <span key={i} className="preview-tag">{tag}</span>
                ))}
              </div>
            </section>
          )}

          {/* Classifications */}
          {classifications.length > 0 && (
            <section className="preview-section">
              <h3 className="preview-section-title">
                <Shield size={14} />
                Classifications ({classifications.length})
              </h3>
              <div className="preview-classifications">
                {classifications.map((cls: any, i: number) => (
                  <span key={i} className="preview-classification">
                    {typeof cls === 'string' ? cls : cls.typeName || cls.name || 'Unknown'}
                  </span>
                ))}
              </div>
            </section>
          )}

          {/* Hierarchy */}
          {qualifiedParts.length > 0 && (
            <section className="preview-section">
              <h3 className="preview-section-title">
                <Link2 size={14} />
                Location
              </h3>
              <div className="preview-hierarchy">
                {qualifiedParts.map((part, i) => (
                  <span key={i} className="hierarchy-item">
                    {i > 0 && <span className="hierarchy-separator">/</span>}
                    {part}
                  </span>
                ))}
              </div>
            </section>
          )}

          {/* Metadata */}
          <section className="preview-section">
            <h3 className="preview-section-title">
              <Calendar size={14} />
              Metadata
            </h3>
            <div className="preview-metadata-grid">
              <div className="metadata-item">
                <span className="metadata-label">Created</span>
                <span className="metadata-value">{formatDate(createdAt)}</span>
              </div>
              <div className="metadata-item">
                <span className="metadata-label">Updated</span>
                <span className="metadata-value">{formatDate(updatedAt)}</span>
              </div>
              <div className="metadata-item">
                <span className="metadata-label">Type</span>
                <span className="metadata-value">{asset.typeName || 'Unknown'}</span>
              </div>
              <div className="metadata-item">
                <span className="metadata-label">GUID</span>
                <span className="metadata-value metadata-mono">{asset.guid?.slice(0, 8)}...</span>
              </div>
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="preview-footer">
          <button className="preview-action-btn" title="Open in Atlan">
            <ExternalLink size={14} />
            Open in Atlan
          </button>
        </div>
      </div>
    </>
  );
}
