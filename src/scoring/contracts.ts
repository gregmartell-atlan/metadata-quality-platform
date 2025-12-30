export type AssetType = "Connection" | "Database" | "Schema" | "Table";

export type QualityDimension =
  | "completeness"
  | "accuracy"
  | "timeliness"
  | "consistency"
  | "usability";

export type ScoreBand = "excellent" | "good" | "fair" | "poor" | "critical";

export interface AtlanAsset {
  guid: string;
  typeName: AssetType;
  name?: string;
  qualifiedName?: string;
  connectionName?: string;

  description?: string | null;
  userDescription?: string | null;

  ownerUsers?: string[] | null;
  ownerGroups?: string[] | null;

  certificateStatus?: string | null;
  certificateUpdatedAt?: number | null;

  classificationNames?: string[] | null;
  meanings?: string[] | null;
  domainGUIDs?: string[] | null;

  updateTime?: number | null;
  sourceUpdatedAt?: number | null;
  sourceLastReadAt?: number | null;
  lastRowChangedAt?: number | null;

  popularityScore?: number | null;
  viewScore?: number | null;
  starredCount?: number | null;

  __hasLineage?: boolean | null;
  lineage?: { upstreamEdges: number; downstreamEdges: number } | null;
  readme?: { hasReadme: boolean } | null;

  isDiscoverable?: boolean | null;
}

export interface CheckResult {
  id: string;
  score01: number;
  weight?: number;
  points?: number;
  details?: Record<string, unknown>;
}

export interface DimensionResult {
  dimension: QualityDimension;
  score01: number;
  checks: CheckResult[];
}

export interface ProfileScoreResult {
  profileId: string;
  score: number;
  band: ScoreBand;
  dimensions?: DimensionResult[];
  checks?: CheckResult[];
  metadata: {
    configVersion: string;
    appliedOverrides: {
      domain?: string;
      connection?: string;
      assetType?: AssetType;
    };
  };
}

export interface ScoringContext {
  nowMs: number;
  configVersion: string;
  config: any;
}

export interface ScoringProfile {
  readonly id: string;
  score(asset: AtlanAsset, ctx: ScoringContext): ProfileScoreResult;
}

