import type { AtlanAsset, ProfileScoreResult } from "../scoring/contracts";
import { OrchestratedScoringEngine } from "../scoring/engine";
import { AtlanClient } from "../api/atlanClient";
import { loadQualityConfig } from "../config/quality";
import { scoreAssetQuality } from "./qualityMetrics";
import { getOwnerNames, getMeaningTexts } from "../utils/typeGuards";

// Type adapter for legacy scoring
interface AtlanAssetSummary {
  guid: string;
  typeName: string;
  name: string;
  qualifiedName: string;
  connectionName?: string;
  description?: string;
  userDescription?: string;
  ownerUsers?: string[];
  ownerGroups?: string[];
  certificateStatus?: string;
  certificateUpdatedAt?: number;
  classificationNames?: string[];
  meanings?: string[];
  domainGUIDs?: string[];
  updateTime?: number;
  sourceUpdatedAt?: number;
  sourceLastReadAt?: number;
  lastRowChangedAt?: number;
  popularityScore?: number;
  viewScore?: number;
  starredCount?: number;
  __hasLineage?: boolean;
  isDiscoverable?: boolean;
  readme?: any;
}

let engineInstance: OrchestratedScoringEngine | null = null;
let clientInstance: AtlanClient | null = null;
let configVersionCallback: ((version: string) => void) | null = null;
let scoringModeGetter: (() => "legacy" | "config-driven") | null = null;

/**
 * Set callback for updating config version (called from React component)
 */
export function setConfigVersionCallback(callback: (version: string) => void): void {
  configVersionCallback = callback;
}

/**
 * Set callback for getting scoring mode (called from React component)
 */
export function setScoringModeGetter(getter: () => "legacy" | "config-driven"): void {
  scoringModeGetter = getter;
}

/**
 * Initialize the scoring service with Atlan credentials
 */
export function initializeScoringService(baseUrl: string, apiKey: string): void {
  clientInstance = new AtlanClient(baseUrl, apiKey);
  const config = loadQualityConfig();
  engineInstance = new OrchestratedScoringEngine(config, clientInstance);
  
  // Update config version via callback if available
  if (configVersionCallback) {
    configVersionCallback(config.version);
  }
}

/**
 * Score assets using the appropriate engine based on settings
 */
export async function scoreAssets(assets: AtlanAsset[]): Promise<Map<string, ProfileScoreResult[]>> {
  const scoringMode = scoringModeGetter ? scoringModeGetter() : "legacy";
  
  if (scoringMode === "legacy") {
    // Use legacy scoring - convert to ProfileScoreResult format for compatibility
    const results = new Map<string, ProfileScoreResult[]>();
    
    for (const asset of assets) {
      // Transform to legacy format
      const summary = transformAtlanAssetToSummary(asset);
      // Use scoreAssetQuality directly with summary
      const scores = scoreAssetQuality(summary);
      
      // Calculate overall score as average
      const overall = (scores.completeness + scores.accuracy + scores.timeliness + scores.consistency + scores.usability) / 5;
      
      // Convert to ProfileScoreResult format
      const result: ProfileScoreResult = {
        profileId: "legacy",
        score: overall,
        band: getBandFromScore(overall),
        dimensions: [
          { dimension: "completeness", score01: scores.completeness / 100, checks: [] },
          { dimension: "accuracy", score01: scores.accuracy / 100, checks: [] },
          { dimension: "timeliness", score01: scores.timeliness / 100, checks: [] },
          { dimension: "consistency", score01: scores.consistency / 100, checks: [] },
          { dimension: "usability", score01: scores.usability / 100, checks: [] },
        ],
        metadata: {
          configVersion: "legacy",
          appliedOverrides: {},
        },
      };
      
      results.set(asset.guid, [result]);
    }
    
    return results;
  }
  
  // Use config-driven scoring
  if (!engineInstance) {
    throw new Error("Scoring service not initialized. Call initializeScoringService first.");
  }
  
  return engineInstance.scoreAssets(assets, Date.now());
}

/**
 * Helper to transform AtlanAsset to AtlanAssetSummary for legacy scoring
 */
function transformAtlanAssetToSummary(asset: AtlanAsset): AtlanAssetSummary {
  const ownerUsers = getOwnerNames(asset.ownerUsers);
  const ownerGroups = getOwnerNames(asset.ownerGroups);
  const meanings = getMeaningTexts(asset.meanings);

  return {
    guid: asset.guid,
    typeName: asset.typeName,
    name: asset.name || "",
    qualifiedName: asset.qualifiedName || "",
    connectionName: asset.connectionName,
    description: asset.description || undefined,
    userDescription: asset.userDescription || undefined,
    ownerUsers: ownerUsers.length > 0 ? ownerUsers : undefined,
    ownerGroups: ownerGroups.length > 0 ? ownerGroups : undefined,
    certificateStatus: asset.certificateStatus || undefined,
    certificateUpdatedAt: asset.certificateUpdatedAt || undefined,
    classificationNames: asset.classificationNames || undefined,
    meanings: meanings.length > 0 ? meanings : undefined,
    domainGUIDs: asset.domainGUIDs || undefined,
    updateTime: asset.updateTime || undefined,
    sourceUpdatedAt: asset.sourceUpdatedAt || undefined,
    sourceLastReadAt: asset.sourceLastReadAt || undefined,
    lastRowChangedAt: asset.lastRowChangedAt || undefined,
    popularityScore: asset.popularityScore || undefined,
    viewScore: asset.viewScore || undefined,
    starredCount: asset.starredCount || undefined,
    __hasLineage: asset.__hasLineage || false,
    isDiscoverable: asset.isDiscoverable !== false,
    readme: asset.readme,
  };
}

/**
 * Get band from score
 */
function getBandFromScore(score: number): "excellent" | "good" | "fair" | "poor" | "critical" {
  if (score >= 80) return "excellent";
  if (score >= 60) return "good";
  if (score >= 40) return "fair";
  if (score >= 20) return "poor";
  return "critical";
}

