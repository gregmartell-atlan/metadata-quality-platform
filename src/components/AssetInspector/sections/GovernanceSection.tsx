/**
 * Governance Section
 *
 * Shows governance metadata: description, owners, certifications, tags, terms
 */

import { Shield, Users, Tag, BookOpen, Award, FileText, Globe } from 'lucide-react';
import type { AtlanAsset } from '../../../services/atlan/types';

interface GovernanceSectionProps {
  asset: AtlanAsset;
}

export function GovernanceSection({ asset }: GovernanceSectionProps) {
  const formatDate = (timestamp: number | undefined): string => {
    if (!timestamp) return 'Not set';
    return new Date(timestamp).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <div className="governance-section">
      {/* Description */}
      <div className="inspector-section">
        <div className="section-title">
          <FileText size={14} />
          Description
        </div>
        <div className="section-content">
          {asset.userDescription || asset.description ? (
            <p className="description-text">
              {asset.userDescription || asset.description}
            </p>
          ) : (
            <p className="empty-message">No description available</p>
          )}
        </div>
      </div>

      {/* Owners */}
      <div className="inspector-section">
        <div className="section-title">
          <Users size={14} />
          Owners
        </div>
        <div className="section-content">
          {asset.ownerUsers && asset.ownerUsers.length > 0 && (
            <div className="owner-group">
              <div className="owner-group-label">Users</div>
              <div className="owner-list">
                {asset.ownerUsers.map((owner, i) => (
                  <span key={i} className="owner-badge">
                    {typeof owner === 'string' ? owner : owner.name || owner.guid}
                  </span>
                ))}
              </div>
            </div>
          )}

          {asset.ownerGroups && asset.ownerGroups.length > 0 && (
            <div className="owner-group">
              <div className="owner-group-label">Groups</div>
              <div className="owner-list">
                {asset.ownerGroups.map((group, i) => (
                  <span key={i} className="owner-badge group">
                    {typeof group === 'string' ? group : group.name || group.guid}
                  </span>
                ))}
              </div>
            </div>
          )}

          {(!asset.ownerUsers || asset.ownerUsers.length === 0) &&
           (!asset.ownerGroups || asset.ownerGroups.length === 0) && (
            <p className="empty-message">No owners assigned</p>
          )}
        </div>
      </div>

      {/* Certificate */}
      {asset.certificateStatus && (
        <div className="inspector-section">
          <div className="section-title">
            <Award size={14} />
            Certification
          </div>
          <div className="section-content">
            <div className="metadata-list">
              <div className="metadata-item">
                <div className="metadata-item-label">Status</div>
                <div className="metadata-item-value">
                  <span className={`inspector-badge ${asset.certificateStatus.toLowerCase()}`}>
                    {asset.certificateStatus}
                  </span>
                </div>
              </div>

              {asset.certificateStatusMessage && (
                <div className="metadata-item">
                  <div className="metadata-item-label">Message</div>
                  <div className="metadata-item-value">{asset.certificateStatusMessage}</div>
                </div>
              )}

              {asset.certificateUpdatedBy && (
                <div className="metadata-item">
                  <div className="metadata-item-label">Certified By</div>
                  <div className="metadata-item-value">{asset.certificateUpdatedBy}</div>
                </div>
              )}

              {asset.certificateUpdatedAt && (
                <div className="metadata-item">
                  <div className="metadata-item-label">Certified On</div>
                  <div className="metadata-item-value">{formatDate(asset.certificateUpdatedAt)}</div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Domains */}
      {asset.domainGUIDs && asset.domainGUIDs.length > 0 && (
        <div className="inspector-section">
          <div className="section-title">
            <Globe size={14} />
            Domains
          </div>
          <div className="section-content">
            <div className="domain-list">
              {asset.domainGUIDs.map((guid, i) => (
                <span key={i} className="domain-badge">
                  {guid}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tags with Propagation Details */}
      {asset.atlanTags && asset.atlanTags.length > 0 && (
        <div className="inspector-section">
          <div className="section-title">
            <Tag size={14} />
            Tags
          </div>
          <div className="section-content">
            <div className="tags-detailed">
              {asset.atlanTags.map((tag, i) => (
                <div key={i} className="tag-detail-card">
                  <div className="tag-name">
                    {tag.typeName || tag.displayName || 'Unknown Tag'}
                  </div>
                  <div className="tag-props">
                    {tag.propagate !== undefined && (
                      <span className={`tag-prop ${tag.propagate ? 'enabled' : 'disabled'}`}>
                        {tag.propagate ? '✓' : '✗'} Propagate
                      </span>
                    )}
                    {tag.restrictPropagationThroughLineage && (
                      <span className="tag-prop restricted">
                        Lineage Restricted
                      </span>
                    )}
                    {tag.restrictPropagationThroughHierarchy && (
                      <span className="tag-prop restricted">
                        Hierarchy Restricted
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Glossary Terms with Confidence */}
      {asset.meanings && asset.meanings.length > 0 && (
        <div className="inspector-section">
          <div className="section-title">
            <BookOpen size={14} />
            Glossary Terms
          </div>
          <div className="section-content">
            <div className="terms-detailed">
              {asset.meanings.map((term, i) => (
                <div key={i} className="term-detail-card">
                  <span className="term-badge">
                    {term.displayText || term.termGuid}
                  </span>
                  {term.confidence !== undefined && (
                    <span className="term-confidence">
                      Confidence: {term.confidence}%
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Classifications */}
      {asset.classificationNames && asset.classificationNames.length > 0 && (
        <div className="inspector-section">
          <div className="section-title">
            <Shield size={14} />
            Classifications
          </div>
          <div className="section-content">
            <div className="classification-list">
              {asset.classificationNames.map((name, i) => (
                <span key={i} className="classification-badge">
                  {name}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
