/**
 * Template Selector Modal
 * Choose from built-in or custom dashboard templates
 */

import { useState } from 'react';
import { Modal } from '../shared/Modal';
import { Button } from '../shared/Button';
import { useDashboardLayoutStore } from '../../stores/dashboardLayoutStore';
import { builtInTemplates } from '../../config/dashboards/templates';

interface TemplateSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function TemplateSelectorModal({ isOpen, onClose }: TemplateSelectorModalProps) {
  const { activeTemplateId, setActiveTemplate, customTemplates } = useDashboardLayoutStore();
  const [selectedId, setSelectedId] = useState(activeTemplateId);

  const allTemplates = [...builtInTemplates, ...customTemplates];

  const handleApply = () => {
    if (selectedId) {
      setActiveTemplate(selectedId);
    }
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Choose Dashboard Template"
    >
      <div className="template-selector">
        <div
          className="template-grid"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: '16px',
            padding: '16px 0',
            maxHeight: '60vh',
            overflowY: 'auto'
          }}
        >
          {allTemplates.map((template) => (
            <div
              key={template.id}
              className={`template-card ${selectedId === template.id ? 'selected' : ''}`}
              onClick={() => setSelectedId(template.id)}
              style={{
                padding: '16px',
                border: selectedId === template.id
                  ? '2px solid var(--accent-primary)'
                  : '1px solid var(--border-color)',
                borderRadius: '8px',
                cursor: 'pointer',
                background: 'var(--bg-secondary)',
                transition: 'all 0.2s'
              }}
            >
              <div
                style={{
                  width: '100%',
                  height: '120px',
                  background: 'var(--bg-tertiary)',
                  borderRadius: '6px',
                  marginBottom: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '11px',
                  color: 'var(--text-muted)',
                  flexDirection: 'column',
                  gap: '4px'
                }}
              >
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: 'var(--accent-primary)' }}>
                  {template.layouts.lg.length}
                </div>
                <div>widgets</div>
              </div>

              <div style={{ fontWeight: '600', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                {template.name}
                {template.isBuiltIn && (
                  <span
                    style={{
                      fontSize: '10px',
                      padding: '2px 6px',
                      background: 'var(--accent-primary)',
                      color: 'var(--bg-primary)',
                      borderRadius: '4px'
                    }}
                  >
                    Built-in
                  </span>
                )}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                {template.description}
              </div>
            </div>
          ))}
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '8px',
            paddingTop: '16px',
            borderTop: '1px solid var(--border-color)'
          }}
        >
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleApply}>
            Apply Template
          </Button>
        </div>
      </div>
    </Modal>
  );
}
