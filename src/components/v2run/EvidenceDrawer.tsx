/**
 * EvidenceDrawer Component
 *
 * Slide-out panel showing detailed signal evidence for an asset.
 */

import { X, Check, AlertTriangle, HelpCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import { getCatalog, type AssetEvidence, type SignalEvidence } from '../../services/v2Api';

interface EvidenceDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  assetQualifiedName: string;
  assetName: string;
  runId: string;
}

export function EvidenceDrawer({ isOpen, onClose, assetQualifiedName, assetName, runId }: EvidenceDrawerProps) {
  const [signals, setSignals] = useState<SignalEvidence[]>([]);
  const [loading, setLoading] = useState(false);
  const [asset, setAsset] = useState<AssetEvidence | null>(null);

  useEffect(() => {
    if (!isOpen || !runId || !assetQualifiedName) return;

    const fetchSignals = async () => {
      setLoading(true);
      try {
        const catalogData = await getCatalog(runId);
        const foundAsset = catalogData.find((a) => a.assetQualifiedName === assetQualifiedName);
        if (foundAsset) {
          setAsset(foundAsset);
          setSignals(foundAsset.signals);
        }
      } catch (err) {
        console.error('Failed to fetch signals:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchSignals();
  }, [isOpen, runId, assetQualifiedName]);

  if (!isOpen) return null;

  const getSignalTypeColor = (type: string) => {
    switch (type) {
      case 'OWNERSHIP': return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'SEMANTICS': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'LINEAGE': return 'bg-green-100 text-green-800 border-green-200';
      case 'SENSITIVITY': return 'bg-red-100 text-red-800 border-red-200';
      case 'FRESHNESS': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'QUALITY': return 'bg-teal-100 text-teal-800 border-teal-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const renderSignalStatus = (signal: SignalEvidence) => {
    if (signal.present) {
      return (
        <span className="inline-flex items-center gap-1 text-green-600">
          <Check size={16} /> Present
        </span>
      );
    }
    if (signal.signalSource === 'NOT_OBSERVED') {
      return (
        <span className="inline-flex items-center gap-1 text-gray-500">
          <HelpCircle size={16} /> Not Observed
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 text-amber-600">
        <AlertTriangle size={16} /> Missing
      </span>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black bg-opacity-50"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer */}
      <div className="relative bg-white w-full max-w-2xl shadow-xl overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex justify-between items-center z-10">
          <div>
            <h2 className="text-xl font-bold text-gray-900">{assetName}</h2>
            <p className="text-sm text-gray-500 truncate max-w-md">{assetQualifiedName}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition"
            aria-label="Close drawer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Scores Summary */}
          {asset && (
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="bg-gray-50 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-gray-900">
                  {asset.impactScore?.toFixed(0) ?? '-'}
                </div>
                <div className="text-sm text-gray-500">Impact Score</div>
              </div>
              <div className="bg-gray-50 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-gray-900">
                  {asset.qualityScore?.toFixed(0) ?? '-'}%
                </div>
                <div className="text-sm text-gray-500">Quality Score</div>
              </div>
              <div className="bg-gray-50 rounded-lg p-4 text-center">
                <div className={`text-sm font-semibold px-2 py-1 rounded ${
                  asset.quadrant === 'HIGH_IMPACT_HIGH_QUALITY' ? 'bg-green-100 text-green-700' :
                  asset.quadrant === 'HIGH_IMPACT_LOW_QUALITY' ? 'bg-yellow-100 text-yellow-700' :
                  asset.quadrant === 'LOW_IMPACT_HIGH_QUALITY' ? 'bg-blue-100 text-blue-700' :
                  asset.quadrant === 'LOW_IMPACT_LOW_QUALITY' ? 'bg-red-100 text-red-700' :
                  'bg-gray-100 text-gray-700'
                }`}>
                  {asset.quadrant?.replace(/_/g, ' ') || 'UNKNOWN'}
                </div>
                <div className="text-sm text-gray-500 mt-2">Quadrant</div>
              </div>
            </div>
          )}

          {/* Signals */}
          <h3 className="text-lg font-semibold mb-4">Signal Evidence</h3>

          {loading ? (
            <div className="text-center py-12 text-gray-500">Loading evidence...</div>
          ) : signals.length === 0 ? (
            <div className="text-center py-12 text-gray-500">No evidence signals found</div>
          ) : (
            <div className="space-y-4">
              {signals.map((signal, idx) => (
                <div
                  key={`${signal.signalType}-${idx}`}
                  className="bg-gray-50 rounded-lg p-4 border border-gray-200"
                >
                  <div className="flex items-start justify-between mb-2">
                    <span className={`px-2 py-1 rounded text-xs font-semibold border ${getSignalTypeColor(signal.signalType)}`}>
                      {signal.signalType}
                    </span>
                    {renderSignalStatus(signal)}
                  </div>

                  <div className="mt-3">
                    <div className="text-sm font-medium text-gray-700 mb-1">Source</div>
                    <div className="text-sm text-gray-600">{signal.signalSource}</div>
                  </div>

                  {signal.present && signal.signalValue && (
                    <div className="mt-3">
                      <div className="text-sm font-medium text-gray-700 mb-1">Value</div>
                      <pre className="text-xs bg-white p-2 rounded border border-gray-200 overflow-x-auto">
                        {JSON.stringify(signal.signalValue, null, 2)}
                      </pre>
                    </div>
                  )}

                  {signal.observedAt && (
                    <div className="mt-2 text-xs text-gray-400">
                      Observed: {new Date(signal.observedAt).toLocaleString()}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
