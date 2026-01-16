/**
 * RunDashboard Component
 *
 * Main container for V2 assessment run with tabs:
 * - Assessment: Impact x Quality matrix and asset table
 * - Model: Requirements model builder (future)
 * - Plan: Gap remediation plan
 * - Export: Artifact generation and download
 */

import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, Outlet, useLocation, useOutletContext, useParams } from 'react-router-dom';
import { CheckCircle, Loader2, AlertTriangle, BarChart3, FileText, Download } from 'lucide-react';
import {
  getRun,
  getCatalog,
  getDomainScores,
  getDomainAssets,
  getGaps,
  recomputeGaps,
  generatePlan,
  getPlan,
  generateArtifacts,
  getArtifacts,
  getArtifactContent,
  type RunDetails,
  type AssetEvidence,
  type DomainScore,
  type Gap,
  type PlanPhase
} from '../../services/v2Api';
import { AssetsTable, type SignalStatus, type AssetRow } from './AssetsTable';
import { EvidenceDrawer } from './EvidenceDrawer';
import { PlanTimeline } from './PlanTimeline';

// Context type for child routes
interface RunContext {
  run: RunDetails;
}

export function RunDashboard() {
  const { id } = useParams<{ id: string }>();
  const [run, setRun] = useState<RunDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const location = useLocation();

  useEffect(() => {
    if (!id) return;

    const fetchRun = async () => {
      try {
        const data = await getRun(id);
        setRun(data);
      } catch (err) {
        console.error('Failed to fetch run:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchRun();

    // Poll for status updates if run is in progress
    const interval = setInterval(async () => {
      const data = await getRun(id);
      if (data) {
        setRun(data);
        if (data.status === 'COMPLETED' || data.status === 'FAILED') {
          clearInterval(interval);
        }
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [id]);

  if (loading) {
    return (
      <div className="p-8 flex items-center gap-2">
        <Loader2 className="animate-spin" />
        Loading Run...
      </div>
    );
  }

  if (!run) {
    return (
      <div className="p-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          Run not found
        </div>
      </div>
    );
  }

  const isRunning = ['CREATED', 'INGESTING', 'SCORING'].includes(run.status);
  const activeTab = location.pathname.split('/').pop() || 'assessment';

  return (
    <div className="min-h-full bg-gray-50 flex flex-col">
      {/* Header */}
      <div className="bg-white border-b px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Assessment Run</h1>
          <p className="text-sm text-gray-500">{run.id}</p>
        </div>
        <div className="flex items-center gap-4">
          {run.assetCount !== undefined && (
            <span className="text-sm text-gray-600">
              {run.assetCount} assets
            </span>
          )}
          {isRunning ? (
            <span className="flex items-center gap-2 text-blue-600 bg-blue-50 px-3 py-1 rounded-full text-sm font-medium">
              <Loader2 className="animate-spin" size={16} />
              {run.status}
            </span>
          ) : run.status === 'FAILED' ? (
            <span className="flex items-center gap-2 text-red-600 bg-red-50 px-3 py-1 rounded-full text-sm font-medium">
              <AlertTriangle size={16} />
              {run.status}
            </span>
          ) : (
            <span className="flex items-center gap-2 text-green-600 bg-green-50 px-3 py-1 rounded-full text-sm font-medium">
              <CheckCircle size={16} />
              {run.status}
            </span>
          )}
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="px-6 bg-white border-b">
        <nav className="flex gap-6" aria-label="Run tabs">
          {[
            { key: 'assessment', label: 'Assessment', icon: BarChart3 },
            { key: 'plan', label: 'Plan', icon: FileText },
            { key: 'export', label: 'Export', icon: Download }
          ].map((tab) => (
            <Link
              key={tab.key}
              to={`/assessment/run/${id}/${tab.key}`}
              className={`flex items-center gap-2 pb-3 pt-4 px-1 border-b-2 text-sm font-medium transition ${
                activeTab === tab.key
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <tab.icon size={16} />
              {tab.label}
            </Link>
          ))}
        </nav>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        <Outlet context={{ run }} />
      </div>
    </div>
  );
}

// Format quality score for display
const formatQuality = (score: number | null, unknown: boolean): string => {
  if (unknown || score === null) return 'UNKNOWN';
  return `${Math.round(score * 100)}%`;
};

/**
 * AssessmentView - Main assessment tab with matrix and table
 */
export function AssessmentView() {
  const { run } = useOutletContext<RunContext>();
  const [catalog, setCatalog] = useState<AssetEvidence[]>([]);
  const [domainScores, setDomainScores] = useState<DomainScore[]>([]);
  const [selectedDomain, setSelectedDomain] = useState<DomainScore | null>(null);
  const [domainAssets, setDomainAssets] = useState<AssetEvidence[]>([]);
  const [loadingAssets, setLoadingAssets] = useState(false);
  const [bucketFilter, setBucketFilter] = useState<string | null>(null);

  // Evidence drawer state
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<{ qualifiedName: string; name: string } | null>(null);

  useEffect(() => {
    if (!run?.id) return;

    const fetchData = async () => {
      try {
        const [catalogData, scoresData] = await Promise.all([
          getCatalog(run.id),
          getDomainScores(run.id)
        ]);
        setCatalog(catalogData);
        setDomainScores(scoresData);
      } catch (err) {
        console.error('Failed to fetch data:', err);
      }
    };

    fetchData();

    // Poll if run is still in progress
    if (!['COMPLETED', 'FAILED'].includes(run.status)) {
      const interval = setInterval(fetchData, 5000);
      return () => clearInterval(interval);
    }
  }, [run?.id, run?.status]);

  // Group domains by quadrant
  const grouped = useMemo(() => {
    const buckets: Record<string, DomainScore[]> = {};
    for (const s of domainScores) {
      const quad = s.quadrant || 'QUALITY_UNKNOWN';
      buckets[quad] = buckets[quad] ? [...buckets[quad], s] : [s];
    }
    return buckets;
  }, [domainScores]);

  const selectDomain = async (domain: DomainScore) => {
    if (!run?.id) return;
    setSelectedDomain(domain);
    setDomainAssets([]);
    setLoadingAssets(true);
    try {
      const assets = await getDomainAssets(run.id, domain.subjectId);
      setDomainAssets(assets);
    } catch (e) {
      console.error('Failed to fetch domain assets:', e);
    } finally {
      setLoadingAssets(false);
    }
  };

  const handleAssetClick = (asset: AssetRow) => {
    setSelectedAsset({
      qualifiedName: asset.assetQualifiedName,
      name: asset.assetName
    });
    setDrawerOpen(true);
  };

  // Convert evidence to table format
  const getSignalStatus = (asset: AssetEvidence, type: string): SignalStatus => {
    const signal = asset.signals.find((s) => s.signalType === type);
    return signal?.present ? 'OBSERVED' : 'UNKNOWN';
  };

  const assetsData: AssetRow[] = (selectedDomain ? domainAssets : catalog).map((asset) => ({
    assetQualifiedName: asset.assetQualifiedName,
    assetName: asset.assetName,
    assetTypeName: asset.assetTypeName,
    signals: {
      ownership: getSignalStatus(asset, 'OWNERSHIP'),
      semantics: getSignalStatus(asset, 'SEMANTICS'),
      lineage: getSignalStatus(asset, 'LINEAGE'),
      sensitivity: getSignalStatus(asset, 'SENSITIVITY')
    },
    impactScore: asset.impactScore,
    qualityScore: asset.qualityScore
  }));

  // Matrix cell component
  const MatrixCell = ({ bucket, label, color, count, isActive, onClick }: any) => (
    <button
      onClick={onClick}
      className={`text-left p-4 rounded-lg border transition h-28 flex flex-col justify-between
        ${color}
        ${isActive ? 'ring-2 ring-blue-500 border-blue-500' : ''}
      `}
    >
      <div className="text-sm font-semibold text-gray-800">{label}</div>
      <div className="text-3xl font-bold text-gray-900">{count}</div>
    </button>
  );

  // If a domain is selected, show drilldown view
  if (selectedDomain) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <button
            onClick={() => setSelectedDomain(null)}
            className="text-blue-600 hover:underline font-medium"
          >
            ← Back to Matrix
          </button>
          <div className="text-right">
            <h2 className="text-lg font-bold">{selectedDomain.subjectId}</h2>
            <p className="text-sm text-gray-500">
              {selectedDomain.assetCount} assets • Quality {formatQuality(selectedDomain.qualityScore, selectedDomain.qualityUnknown)}
            </p>
          </div>
        </div>

        {loadingAssets ? (
          <div className="text-center py-12 text-gray-500">Loading assets...</div>
        ) : (
          <div className="bg-white rounded-lg shadow-sm border">
            <AssetsTable assets={assetsData} onAssetClick={handleAssetClick} />
          </div>
        )}

        <EvidenceDrawer
          isOpen={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          assetQualifiedName={selectedAsset?.qualifiedName || ''}
          assetName={selectedAsset?.name || ''}
          runId={run.id}
        />
      </div>
    );
  }

  // Filter domains by selected bucket
  const filteredDomains = bucketFilter
    ? (grouped[bucketFilter] || [])
    : domainScores;

  return (
    <div className="p-6 space-y-6">
      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-lg shadow-sm border">
          <div className="text-sm text-gray-500">Assets Scanned</div>
          <div className="text-2xl font-bold">{catalog.length}</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm border">
          <div className="text-sm text-gray-500">Domains</div>
          <div className="text-2xl font-bold">{domainScores.length}</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm border">
          <div className="text-sm text-gray-500">High Impact / Low Quality</div>
          <div className="text-2xl font-bold text-amber-600">
            {grouped['HIGH_IMPACT_LOW_QUALITY']?.length || 0}
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm border">
          <div className="text-sm text-gray-500">Capabilities</div>
          <div className="text-2xl font-bold">{run.selectedCapabilities.length}</div>
        </div>
      </div>

      {/* Impact x Quality Matrix */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold">Impact × Quality Matrix</h2>
          {bucketFilter && (
            <button
              onClick={() => setBucketFilter(null)}
              className="text-sm text-blue-600 hover:underline"
            >
              Clear filter
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4 max-w-2xl">
          <MatrixCell
            bucket="HIGH_IMPACT_LOW_QUALITY"
            label="High Impact, Low Quality"
            color="bg-yellow-50 border-yellow-200 hover:border-yellow-400"
            count={grouped['HIGH_IMPACT_LOW_QUALITY']?.length || 0}
            isActive={bucketFilter === 'HIGH_IMPACT_LOW_QUALITY'}
            onClick={() => setBucketFilter('HIGH_IMPACT_LOW_QUALITY')}
          />
          <MatrixCell
            bucket="HIGH_IMPACT_HIGH_QUALITY"
            label="High Impact, High Quality"
            color="bg-green-50 border-green-200 hover:border-green-400"
            count={grouped['HIGH_IMPACT_HIGH_QUALITY']?.length || 0}
            isActive={bucketFilter === 'HIGH_IMPACT_HIGH_QUALITY'}
            onClick={() => setBucketFilter('HIGH_IMPACT_HIGH_QUALITY')}
          />
          <MatrixCell
            bucket="LOW_IMPACT_LOW_QUALITY"
            label="Low Impact, Low Quality"
            color="bg-red-50 border-red-200 hover:border-red-400"
            count={grouped['LOW_IMPACT_LOW_QUALITY']?.length || 0}
            isActive={bucketFilter === 'LOW_IMPACT_LOW_QUALITY'}
            onClick={() => setBucketFilter('LOW_IMPACT_LOW_QUALITY')}
          />
          <MatrixCell
            bucket="LOW_IMPACT_HIGH_QUALITY"
            label="Low Impact, High Quality"
            color="bg-blue-50 border-blue-200 hover:border-blue-400"
            count={grouped['LOW_IMPACT_HIGH_QUALITY']?.length || 0}
            isActive={bucketFilter === 'LOW_IMPACT_HIGH_QUALITY'}
            onClick={() => setBucketFilter('LOW_IMPACT_HIGH_QUALITY')}
          />
        </div>

        {/* Unknown bucket */}
        <button
          onClick={() => setBucketFilter('QUALITY_UNKNOWN')}
          className={`mt-4 w-full max-w-2xl text-left p-4 rounded-lg border transition ${
            bucketFilter === 'QUALITY_UNKNOWN'
              ? 'border-gray-800 bg-gray-100 ring-2 ring-gray-200'
              : 'border-gray-200 bg-gray-50 hover:border-gray-400'
          }`}
        >
          <div className="flex justify-between items-center">
            <div>
              <div className="font-semibold text-gray-700">UNKNOWN (Insufficient Data)</div>
              <div className="text-xs text-gray-500 mt-1">Impact or Quality cannot be determined</div>
            </div>
            <div className="text-2xl font-bold text-gray-700">
              {grouped['QUALITY_UNKNOWN']?.length || 0}
            </div>
          </div>
        </button>
      </div>

      {/* Domain/System Scores Table */}
      <div>
        <h2 className="text-lg font-bold mb-4">Domain Scores</h2>
        <div className="bg-white rounded-lg shadow-sm border overflow-x-auto">
          <table className="min-w-full text-left">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="p-4 font-medium text-gray-500">Domain</th>
                <th className="p-4 font-medium text-gray-500">Assets</th>
                <th className="p-4 font-medium text-gray-500">Impact</th>
                <th className="p-4 font-medium text-gray-500">Quality</th>
                <th className="p-4 font-medium text-gray-500">Quadrant</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filteredDomains.map((score) => (
                <tr
                  key={score.id}
                  className="hover:bg-gray-50 cursor-pointer"
                  onClick={() => selectDomain(score)}
                >
                  <td className="p-4 font-medium text-blue-600 hover:underline">
                    {score.subjectId}
                  </td>
                  <td className="p-4">
                    <div className="text-sm">{score.assetCount} total</div>
                    <div className="text-xs text-gray-500">{score.knownAssetCount} with evidence</div>
                  </td>
                  <td className="p-4">{Math.round(score.impactScore * 100)}%</td>
                  <td className="p-4">{formatQuality(score.qualityScore, score.qualityUnknown)}</td>
                  <td className="p-4">
                    <span className={`px-2 py-1 rounded text-xs font-bold ${
                      score.quadrant === 'HIGH_IMPACT_HIGH_QUALITY' ? 'bg-green-100 text-green-700' :
                      score.quadrant === 'HIGH_IMPACT_LOW_QUALITY' ? 'bg-yellow-100 text-yellow-700' :
                      score.quadrant === 'LOW_IMPACT_HIGH_QUALITY' ? 'bg-blue-100 text-blue-700' :
                      score.quadrant === 'LOW_IMPACT_LOW_QUALITY' ? 'bg-red-100 text-red-700' :
                      'bg-gray-100 text-gray-700'
                    }`}>
                      {score.quadrant?.replace(/_/g, ' ') || 'UNKNOWN'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <EvidenceDrawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        assetQualifiedName={selectedAsset?.qualifiedName || ''}
        assetName={selectedAsset?.name || ''}
        runId={run.id}
      />
    </div>
  );
}

/**
 * PlanView - Gap detection and remediation plan
 */
export function PlanView() {
  const { run } = useOutletContext<RunContext>();
  const [gaps, setGaps] = useState<Gap[]>([]);
  const [phases, setPhases] = useState<PlanPhase[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!run?.id) return;

    const fetchData = async () => {
      try {
        const [gapsData, planData] = await Promise.all([
          getGaps(run.id),
          getPlan(run.id)
        ]);
        setGaps(gapsData);
        if (planData) setPhases(planData);
      } catch (err) {
        console.error('Failed to fetch plan data:', err);
      }
    };

    fetchData();
  }, [run?.id]);

  const handleCompute = async () => {
    if (!run?.id) return;
    setLoading(true);
    setError(null);
    try {
      const result = await recomputeGaps(run.id);
      setGaps(result.gaps);

      const plan = await generatePlan(run.id);
      setPhases(plan);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">Remediation Plan</h2>
        <button
          onClick={handleCompute}
          disabled={loading}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition"
        >
          {loading ? 'Computing...' : 'Compute Gaps & Generate Plan'}
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          {error}
        </div>
      )}

      {/* Gaps Summary */}
      {gaps.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <h3 className="font-semibold mb-4">Gaps Detected ({gaps.length})</h3>
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div className="text-center p-3 bg-red-50 rounded-lg">
              <div className="text-2xl font-bold text-red-600">
                {gaps.filter((g) => g.severity === 'HIGH').length}
              </div>
              <div className="text-xs text-red-600">High Severity</div>
            </div>
            <div className="text-center p-3 bg-yellow-50 rounded-lg">
              <div className="text-2xl font-bold text-yellow-600">
                {gaps.filter((g) => g.severity === 'MED').length}
              </div>
              <div className="text-xs text-yellow-600">Medium</div>
            </div>
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <div className="text-2xl font-bold text-gray-600">
                {gaps.filter((g) => g.severity === 'LOW').length}
              </div>
              <div className="text-xs text-gray-600">Low</div>
            </div>
          </div>

          <div className="space-y-2 max-h-64 overflow-y-auto">
            {gaps.slice(0, 20).map((gap) => (
              <div
                key={gap.id}
                className={`p-3 rounded-lg border-l-4 ${
                  gap.severity === 'HIGH' ? 'border-red-500 bg-red-50' :
                  gap.severity === 'MED' ? 'border-yellow-500 bg-yellow-50' :
                  'border-gray-300 bg-gray-50'
                }`}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <div className="font-medium text-sm">{gap.gapType}</div>
                    <div className="text-xs text-gray-600">{gap.subjectName || gap.subjectId}</div>
                  </div>
                  <span className={`text-xs font-bold px-2 py-1 rounded ${
                    gap.severity === 'HIGH' ? 'bg-red-100 text-red-700' :
                    gap.severity === 'MED' ? 'bg-yellow-100 text-yellow-700' :
                    'bg-gray-100 text-gray-700'
                  }`}>
                    {gap.severity}
                  </span>
                </div>
                <div className="text-xs text-gray-500 mt-1">{gap.explanation}</div>
              </div>
            ))}
            {gaps.length > 20 && (
              <div className="text-center text-sm text-gray-500 py-2">
                + {gaps.length - 20} more gaps
              </div>
            )}
          </div>
        </div>
      )}

      {/* Plan Timeline */}
      <PlanTimeline phases={phases} />
    </div>
  );
}

/**
 * ExportView - Generate and download artifacts
 */
export function ExportView() {
  const { run } = useOutletContext<RunContext>();
  const [artifacts, setArtifacts] = useState<{ type: string; format: string; content?: string }[]>([]);
  const [generating, setGenerating] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!run?.id) return;
    const fetchArtifacts = async () => {
      setLoading(true);
      try {
        const data = await getArtifacts(run.id);
        setArtifacts(data);
      } catch (err) {
        console.error('Failed to fetch artifacts:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchArtifacts();
  }, [run?.id]);

  const handleGenerate = async () => {
    if (!run?.id) return;
    setGenerating(true);
    try {
      const data = await generateArtifacts(run.id);
      setArtifacts(data);
    } catch (err) {
      console.error('Failed to generate artifacts:', err);
    } finally {
      setGenerating(false);
    }
  };

  const handleLoadContent = async (type: string) => {
    if (!run?.id) return;
    try {
      const content = await getArtifactContent(run.id, type);
      setArtifacts((prev) =>
        prev.map((a) => (a.type === type ? { ...a, content } : a))
      );
    } catch (err) {
      console.error('Failed to load content:', err);
    }
  };

  const handleDownload = async (type: string) => {
    if (!run?.id) return;
    try {
      const content = await getArtifactContent(run.id, type);
      const blob = new Blob([content], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${type.toLowerCase()}_${run.id}.md`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to download:', err);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">Export Artifacts</h2>
        <button
          onClick={handleGenerate}
          disabled={generating}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition"
        >
          {generating ? 'Generating...' : 'Generate All Artifacts'}
        </button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-500">Loading artifacts...</div>
      ) : artifacts.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          Click "Generate All Artifacts" to create exports
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {artifacts.map((artifact) => (
            <div key={artifact.type} className="bg-white rounded-lg shadow-sm border">
              <div className="flex justify-between items-center p-4 border-b">
                <h3 className="font-bold text-lg">{artifact.type}</h3>
                <div className="flex gap-2">
                  {!artifact.content && (
                    <button
                      onClick={() => handleLoadContent(artifact.type)}
                      className="text-sm bg-gray-100 hover:bg-gray-200 px-3 py-1 rounded"
                    >
                      Load
                    </button>
                  )}
                  <button
                    onClick={() => handleDownload(artifact.type)}
                    className="text-sm bg-blue-100 hover:bg-blue-200 px-3 py-1 rounded text-blue-700"
                  >
                    Download
                  </button>
                </div>
              </div>
              {artifact.content ? (
                <div className="h-80 overflow-auto p-4">
                  <pre className="text-xs whitespace-pre-wrap font-mono bg-gray-50 p-4 rounded">
                    {artifact.content}
                  </pre>
                </div>
              ) : (
                <div className="p-4 text-sm text-gray-500">
                  Click "Load" to preview content
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Fallback redirect
 */
export function RunRoutesFallback() {
  return <Navigate to="assessment" replace />;
}
