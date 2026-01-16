/**
 * AssessmentPage - Full page for metadata quality assessment
 *
 * Provides a dedicated page for:
 * - V2 MDLH-based assessment runs (recommended)
 * - CSV file upload from Atlan exports (legacy)
 * - Signal-based metadata assessment
 * - Gap analysis and remediation planning
 * - Use case readiness evaluation
 */

import { Link } from 'react-router-dom';
import { Play, Upload, Database, ArrowRight } from 'lucide-react';
import { AssessmentPanel } from '../components/assessment';
import { useBackendModeStore } from '../stores/backendModeStore';
import './AssessmentPage.css';

export function AssessmentPage() {
  const snowflakeConnected = useBackendModeStore((state) => state.snowflakeStatus.connected);

  return (
    <div className="assessment-page">
      <div className="assessment-page-header">
        <h1>Metadata Assessment</h1>
        <p>
          Analyze metadata quality using signal-based assessment.
          Identify gaps, get remediation recommendations, and evaluate use case readiness.
        </p>
      </div>

      {/* V2 Assessment Call-to-Action */}
      <div className="assessment-v2-cta">
        <div className="v2-cta-content">
          <div className="v2-cta-icon">
            <Database size={32} />
          </div>
          <div className="v2-cta-text">
            <h2>New: MDLH-Powered Assessment</h2>
            <p>
              Run assessments directly from your Snowflake metadata lakehouse.
              Get the Impact × Quality Matrix, gap detection, and remediation plans.
            </p>
            {!snowflakeConnected && (
              <p className="v2-cta-warning">
                Connect to Snowflake in Settings to enable MDLH data source.
              </p>
            )}
          </div>
          <Link to="/assessment/new" className="v2-cta-button">
            <Play size={18} />
            Start New Assessment
            <ArrowRight size={18} />
          </Link>
        </div>
      </div>

      {/* Legacy CSV Upload */}
      <div className="assessment-section-divider">
        <span>Or use CSV upload</span>
      </div>

      <div className="assessment-page-content">
        <AssessmentPanel />
      </div>
    </div>
  );
}
