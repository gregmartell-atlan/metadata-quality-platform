/**
 * PlanTimeline Component
 *
 * Displays remediation plan phases as a visual timeline.
 * Simplified version without external Gantt library.
 */

import { Clock, CheckCircle2, ArrowRight } from 'lucide-react';
import type { PlanPhase, PlanAction } from '../../services/v2Api';

interface PlanTimelineProps {
  phases: PlanPhase[];
}

const effortColors: Record<string, { bg: string; text: string; border: string }> = {
  'S': { bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200' },
  'M': { bg: 'bg-yellow-50', text: 'text-yellow-700', border: 'border-yellow-200' },
  'L': { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' }
};

const effortLabels: Record<string, string> = {
  'S': 'Small',
  'M': 'Medium',
  'L': 'Large'
};

export function PlanTimeline({ phases }: PlanTimelineProps) {
  if (phases.length === 0) {
    return (
      <div className="border border-gray-200 rounded-lg bg-white p-6">
        <div className="flex items-center gap-2 mb-2">
          <Clock className="text-gray-400" size={20} />
          <h3 className="font-semibold text-gray-900">Plan Timeline</h3>
        </div>
        <p className="text-sm text-gray-500">
          Generate a plan to see the remediation timeline.
        </p>
      </div>
    );
  }

  const totalActions = phases.reduce((sum, p) => sum + p.actions.length, 0);

  return (
    <div className="border border-gray-200 rounded-lg bg-white" data-testid="plan-timeline">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-gray-900">Plan Timeline</h3>
          <p className="text-xs text-gray-500">
            {phases.length} phases, {totalActions} total actions
          </p>
        </div>
        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-1">
            <span className="w-3 h-3 rounded bg-green-200"></span>
            <span className="text-gray-600">Small</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-3 h-3 rounded bg-yellow-200"></span>
            <span className="text-gray-600">Medium</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-3 h-3 rounded bg-red-200"></span>
            <span className="text-gray-600">Large</span>
          </div>
        </div>
      </div>

      {/* Timeline */}
      <div className="p-4">
        <div className="relative">
          {/* Connector line */}
          <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-gray-200" style={{ height: 'calc(100% - 24px)' }} />

          {/* Phases */}
          <div className="space-y-6">
            {phases.map((phase, phaseIndex) => (
              <div key={phase.name} className="relative">
                {/* Phase marker */}
                <div className="flex items-center gap-3 mb-3">
                  <div className={`relative z-10 w-12 h-12 rounded-full flex items-center justify-center text-white font-bold ${
                    phaseIndex === 0 ? 'bg-blue-600' :
                    phaseIndex === 1 ? 'bg-purple-600' :
                    'bg-gray-600'
                  }`}>
                    {phaseIndex + 1}
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900">{phase.name}</h4>
                    <p className="text-xs text-gray-500">{phase.actions.length} actions</p>
                  </div>
                </div>

                {/* Actions */}
                <div className="ml-16 space-y-2">
                  {phase.actions.map((action, actionIndex) => {
                    const colors = effortColors[action.effortBucket] || effortColors['M'];

                    return (
                      <div
                        key={`${action.workstream}-${actionIndex}`}
                        className={`flex items-center gap-3 p-3 rounded-lg border ${colors.bg} ${colors.border}`}
                      >
                        <div className={`px-2 py-1 rounded text-xs font-semibold ${colors.text} bg-white border ${colors.border}`}>
                          {action.effortBucket}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-gray-900 text-sm">
                            {action.workstream}
                          </div>
                          <div className="text-xs text-gray-600 truncate">
                            {action.scope}
                          </div>
                        </div>
                        {action.assetCount && (
                          <div className="text-xs text-gray-500">
                            {action.assetCount} assets
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Arrow to next phase */}
                {phaseIndex < phases.length - 1 && (
                  <div className="ml-6 mt-4 flex items-center text-gray-400">
                    <ArrowRight size={16} />
                  </div>
                )}
              </div>
            ))}

            {/* Completion marker */}
            <div className="flex items-center gap-3">
              <div className="relative z-10 w-12 h-12 rounded-full flex items-center justify-center bg-green-600 text-white">
                <CheckCircle2 size={24} />
              </div>
              <div>
                <h4 className="font-semibold text-green-700">Complete</h4>
                <p className="text-xs text-gray-500">All gaps remediated</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
