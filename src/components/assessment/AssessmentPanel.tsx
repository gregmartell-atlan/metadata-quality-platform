/**
 * AssessmentPanel Component
 *
 * UI for running metadata quality assessments:
 * - CSV file upload
 * - Assessment execution
 * - Signal coverage display
 * - Gap analysis results
 * - Remediation plan generation
 */

import { useState, useCallback, useRef } from 'react';
import {
  Upload,
  Play,
  FileSpreadsheet,
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
  Target,
  Lightbulb,
  ChevronDown,
  ChevronRight,
  BarChart3,
  Shield,
  Users,
  GitBranch,
  Database,
  Clock,
  Activity,
  Sparkles,
  Award,
} from 'lucide-react';
import {
  transformCsvToEvidence,
  getEvidenceSummary,
} from '../../assessment/utils/csv-transformer';
import {
  mapEvidenceToSignals,
  ScoreEngine,
  GapEngine,
  PlanEngine,
  ExplanationGenerator,
  type AssetEvidence,
  type CanonicalSignals,
  type Gap,
  type RemediationPlan,
} from '../../assessment';
import {
  USE_CASE_PROFILES,
  type UseCaseProfile,
} from '../../assessment/catalog/use-case-profiles';
import './AssessmentPanel.css';

// Signal icons mapping
const SIGNAL_ICONS: Record<string, React.ReactNode> = {
  OWNERSHIP: <Users size={14} />,
  LINEAGE: <GitBranch size={14} />,
  SEMANTICS: <FileSpreadsheet size={14} />,
  SENSITIVITY: <Shield size={14} />,
  ACCESS: <Shield size={14} />,
  QUALITY: <Database size={14} />,
  FRESHNESS: <Clock size={14} />,
  USAGE: <Activity size={14} />,
  AI_READY: <Sparkles size={14} />,
  TRUST: <Award size={14} />,
};

interface AssessmentResults {
  evidence: AssetEvidence[];
  signalsByAsset: Map<string, CanonicalSignals>;
  gaps: Gap[];
  plan: RemediationPlan | null;
  summary: ReturnType<typeof getEvidenceSummary>;
}

export function AssessmentPanel() {
  const [csvContent, setCsvContent] = useState<string>('');
  const [fileName, setFileName] = useState<string>('');
  const [results, setResults] = useState<AssessmentResults | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedUseCase, setSelectedUseCase] = useState<string>('analytics');
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(['summary', 'signals', 'gaps'])
  );

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Handle file upload
  const handleFileUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setError(null);
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      setCsvContent(content);
      setResults(null);
    };
    reader.onerror = () => {
      setError('Failed to read file');
    };
    reader.readAsText(file);
  }, []);

  // Run assessment
  const runAssessment = useCallback(() => {
    if (!csvContent) {
      setError('No CSV content loaded');
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      // Transform CSV to evidence
      const evidence = transformCsvToEvidence(csvContent);

      if (evidence.length === 0) {
        setError('No valid assets found in CSV');
        setIsProcessing(false);
        return;
      }

      // Get summary
      const summary = getEvidenceSummary(evidence);

      // Map evidence to signals
      const signalsByAsset = new Map<string, CanonicalSignals>();
      for (const ev of evidence) {
        signalsByAsset.set(ev.assetId, mapEvidenceToSignals(ev));
      }

      // Get use case profile
      const useCase = USE_CASE_PROFILES.find(p => p.id === selectedUseCase) || USE_CASE_PROFILES[0];

      // Detect gaps
      const gapEngine = new GapEngine();
      const gaps: Gap[] = [];
      for (const ev of evidence) {
        const signals = signalsByAsset.get(ev.assetId)!;
        const assetGaps = gapEngine.detectGaps(ev, signals, useCase.requiredSignals);
        gaps.push(...assetGaps);
      }

      // Sort gaps by severity
      const severityOrder = { HIGH: 0, MED: 1, LOW: 2 };
      gaps.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

      // Generate remediation plan
      let plan: RemediationPlan | null = null;
      if (gaps.length > 0) {
        const planEngine = new PlanEngine();
        plan = planEngine.generatePlan(
          selectedUseCase,
          'csv-upload',
          gaps.slice(0, 50) // Limit for performance
        );
      }

      setResults({
        evidence,
        signalsByAsset,
        gaps,
        plan,
        summary,
      });
    } catch (err) {
      setError(`Assessment failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsProcessing(false);
    }
  }, [csvContent, selectedUseCase]);

  // Toggle section expansion
  const toggleSection = (section: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(section)) {
        next.delete(section);
      } else {
        next.add(section);
      }
      return next;
    });
  };

  // Render signal badge
  const renderSignalBadge = (value: boolean | 'UNKNOWN') => {
    if (value === true) {
      return <span className="signal-badge present"><CheckCircle2 size={12} /> Present</span>;
    } else if (value === false) {
      return <span className="signal-badge absent"><AlertTriangle size={12} /> Missing</span>;
    }
    return <span className="signal-badge unknown"><HelpCircle size={12} /> Unknown</span>;
  };

  return (
    <div className="assessment-panel">
      <div className="assessment-header">
        <h3><Target size={18} /> Metadata Assessment</h3>
        <p className="assessment-description">
          Upload a CSV export to analyze metadata quality using signal-based assessment
        </p>
      </div>

      {/* Upload Section */}
      <div className="upload-section">
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv"
          onChange={handleFileUpload}
          style={{ display: 'none' }}
        />
        <button
          className="upload-button"
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload size={16} />
          {fileName || 'Choose CSV File'}
        </button>

        <select
          className="use-case-select"
          value={selectedUseCase}
          onChange={(e) => setSelectedUseCase(e.target.value)}
        >
          {USE_CASE_PROFILES.map(uc => (
            <option key={uc.id} value={uc.id}>{uc.name}</option>
          ))}
        </select>

        <button
          className="run-button"
          onClick={runAssessment}
          disabled={!csvContent || isProcessing}
        >
          <Play size={16} />
          {isProcessing ? 'Processing...' : 'Run Assessment'}
        </button>
      </div>

      {/* Error Display */}
      {error && (
        <div className="error-message">
          <AlertTriangle size={16} />
          {error}
        </div>
      )}

      {/* Results */}
      {results && (
        <div className="results-container">
          {/* Summary Section */}
          <div className="result-section">
            <button
              className="section-header"
              onClick={() => toggleSection('summary')}
            >
              {expandedSections.has('summary') ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              <BarChart3 size={16} />
              <span>Summary</span>
              <span className="section-badge">{results.evidence.length} assets</span>
            </button>
            {expandedSections.has('summary') && (
              <div className="section-content">
                <div className="summary-grid">
                  <div className="summary-stat">
                    <span className="stat-value">{results.evidence.length}</span>
                    <span className="stat-label">Total Assets</span>
                  </div>
                  <div className="summary-stat">
                    <span className="stat-value">{Object.keys(results.summary.byType).length}</span>
                    <span className="stat-label">Asset Types</span>
                  </div>
                  <div className="summary-stat">
                    <span className="stat-value severity-high">{results.gaps.filter(g => g.severity === 'HIGH').length}</span>
                    <span className="stat-label">High Gaps</span>
                  </div>
                  <div className="summary-stat">
                    <span className="stat-value severity-med">{results.gaps.filter(g => g.severity === 'MED').length}</span>
                    <span className="stat-label">Medium Gaps</span>
                  </div>
                </div>

                <div className="type-breakdown">
                  <h4>Assets by Type</h4>
                  <div className="type-list">
                    {Object.entries(results.summary.byType)
                      .sort((a, b) => b[1] - a[1])
                      .map(([type, count]) => (
                        <div key={type} className="type-item">
                          <span className="type-name">{type}</span>
                          <span className="type-count">{count}</span>
                        </div>
                      ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Signal Coverage Section */}
          <div className="result-section">
            <button
              className="section-header"
              onClick={() => toggleSection('signals')}
            >
              {expandedSections.has('signals') ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              <Activity size={16} />
              <span>Signal Coverage</span>
            </button>
            {expandedSections.has('signals') && (
              <div className="section-content">
                <div className="signal-coverage-grid">
                  {Object.entries(results.summary.signalCounts).map(([signal, counts]) => {
                    const total = counts.present + counts.absent + counts.unknown;
                    const presentPct = total > 0 ? Math.round((counts.present / total) * 100) : 0;

                    return (
                      <div key={signal} className="signal-coverage-item">
                        <div className="signal-header">
                          {SIGNAL_ICONS[signal.toUpperCase()] || <Database size={14} />}
                          <span className="signal-name">{signal}</span>
                          <span className="signal-pct">{presentPct}%</span>
                        </div>
                        <div className="signal-bar">
                          <div
                            className="signal-bar-fill present"
                            style={{ width: `${(counts.present / total) * 100}%` }}
                          />
                          <div
                            className="signal-bar-fill unknown"
                            style={{ width: `${(counts.unknown / total) * 100}%` }}
                          />
                        </div>
                        <div className="signal-counts">
                          <span className="count-present">{counts.present} present</span>
                          <span className="count-absent">{counts.absent} missing</span>
                          <span className="count-unknown">{counts.unknown} unknown</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Gaps Section */}
          <div className="result-section">
            <button
              className="section-header"
              onClick={() => toggleSection('gaps')}
            >
              {expandedSections.has('gaps') ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              <AlertTriangle size={16} />
              <span>Gaps Detected</span>
              <span className="section-badge">{results.gaps.length}</span>
            </button>
            {expandedSections.has('gaps') && (
              <div className="section-content">
                {results.gaps.length === 0 ? (
                  <div className="no-gaps">
                    <CheckCircle2 size={24} />
                    <span>No gaps detected for selected use case</span>
                  </div>
                ) : (
                  <div className="gaps-list">
                    {results.gaps.slice(0, 20).map((gap, idx) => (
                      <div key={gap.id || idx} className={`gap-item severity-${gap.severity.toLowerCase()}`}>
                        <div className="gap-header">
                          {SIGNAL_ICONS[gap.signalType] || <AlertTriangle size={14} />}
                          <span className="gap-signal">{gap.signalType}</span>
                          <span className={`gap-severity ${gap.severity.toLowerCase()}`}>
                            {gap.severity}
                          </span>
                        </div>
                        <div className="gap-subject">
                          {gap.subjectName || gap.subjectId}
                        </div>
                        <div className="gap-explanation">
                          {gap.explanation}
                        </div>
                      </div>
                    ))}
                    {results.gaps.length > 20 && (
                      <div className="gaps-more">
                        + {results.gaps.length - 20} more gaps
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Remediation Plan Section */}
          {results.plan && (
            <div className="result-section">
              <button
                className="section-header"
                onClick={() => toggleSection('plan')}
              >
                {expandedSections.has('plan') ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                <Lightbulb size={16} />
                <span>Remediation Plan</span>
                <span className="section-badge">{results.plan.phases.length} phases</span>
              </button>
              {expandedSections.has('plan') && (
                <div className="section-content">
                  <div className="plan-summary">
                    <div className="plan-stat">
                      <span className="stat-value">{results.plan.summary.totalActions}</span>
                      <span className="stat-label">Total Actions</span>
                    </div>
                    <div className="plan-stat">
                      <span className="stat-value">{results.plan.summary.totalAssets}</span>
                      <span className="stat-label">Assets Affected</span>
                    </div>
                  </div>

                  <div className="phases-list">
                    {results.plan.phases.map((phase, idx) => (
                      <div key={phase.name} className="phase-item">
                        <div className="phase-header">
                          <span className="phase-number">Phase {idx + 1}</span>
                          <span className="phase-name">{phase.name}</span>
                          <span className="phase-actions">{phase.totalActions} actions</span>
                        </div>
                        <div className="phase-workstreams">
                          {phase.workstreams.map(ws => (
                            <div key={ws.workstream} className="workstream-item">
                              <span className="workstream-name">{ws.name}</span>
                              <div className="workstream-actions">
                                {ws.actions.slice(0, 3).map((action, aidx) => (
                                  <div key={action.id || aidx} className="action-item">
                                    <span className={`action-effort ${action.effortBucket.toLowerCase()}`}>
                                      {action.effortBucket}
                                    </span>
                                    <span className="action-description">{action.description}</span>
                                  </div>
                                ))}
                                {ws.actions.length > 3 && (
                                  <div className="actions-more">
                                    + {ws.actions.length - 3} more
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
