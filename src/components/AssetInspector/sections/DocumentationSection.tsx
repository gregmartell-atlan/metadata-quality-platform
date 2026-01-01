/**
 * Documentation Section
 *
 * Shows readme, links, and attached files
 */

import { FileText, Link as LinkIcon, File } from 'lucide-react';
import type { AtlanAsset } from '../../../services/atlan/types';

interface DocumentationSectionProps {
  asset: AtlanAsset;
}

export function DocumentationSection({ asset }: DocumentationSectionProps) {
  const hasAnyDocumentation =
    asset.readme?.content ||
    (asset.links && asset.links.length > 0) ||
    (asset.files && asset.files.length > 0);

  if (!hasAnyDocumentation) {
    return (
      <div className="documentation-section">
        <div className="empty-message">
          <FileText size={48} style={{ opacity: 0.3, marginBottom: '16px' }} />
          <p>No documentation available for this asset</p>
        </div>
      </div>
    );
  }

  return (
    <div className="documentation-section">
      {/* Readme */}
      {asset.readme?.content && (
        <div className="inspector-section">
          <div className="section-title">
            <FileText size={14} />
            README
          </div>
          <div className="section-content">
            <div className="readme-content">
              {asset.readme.content}
            </div>
          </div>
        </div>
      )}

      {/* Links */}
      {asset.links && asset.links.length > 0 && (
        <div className="inspector-section">
          <div className="section-title">
            <LinkIcon size={14} />
            External Links
          </div>
          <div className="section-content">
            <div className="links-list">
              {asset.links.map((link, i) => (
                <a
                  key={i}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="link-item"
                >
                  <LinkIcon size={14} />
                  <span>{link.url}</span>
                </a>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Files */}
      {asset.files && asset.files.length > 0 && (
        <div className="inspector-section">
          <div className="section-title">
            <File size={14} />
            Attached Files
          </div>
          <div className="section-content">
            <div className="files-list">
              {asset.files.map((file, i) => (
                <div key={i} className="file-item">
                  <File size={14} />
                  <span>{file.name || file.guid}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
