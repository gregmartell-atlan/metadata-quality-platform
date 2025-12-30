import type { AtlanAsset, ScoringContext, ScoringProfile, ProfileScoreResult, CheckResult } from "../contracts";
import { scoreBand } from "../helpers";

const hasAny = (arr?: string[] | null) => Array.isArray(arr) && arr.length > 0;
const hasDesc = (a: AtlanAsset) => ((a.userDescription || a.description || "").trim().length > 0);

export class StandardCompletenessProfile implements ScoringProfile {
  readonly id = "standardCompleteness";

  score(asset: AtlanAsset, ctx: ScoringContext): ProfileScoreResult {
    const cfg = ctx.config.profiles.standardCompleteness;
    const thresholds = ctx.config.bands;

    const rubric = cfg.assetTypeRubrics?.[asset.typeName];
    const checks: CheckResult[] = [];

    if (!rubric) {
      return { profileId: this.id, score: 0, band: "critical", checks, metadata: { configVersion: ctx.configVersion, appliedOverrides: { assetType: asset.typeName } } };
    }

    const ok = (id: string) => {
      switch (id) {
        case "hasDescription": return hasDesc(asset);
        case "hasOwner": return hasAny(asset.ownerUsers) || hasAny(asset.ownerGroups);
        case "hasCertification": return !!asset.certificateStatus;
        case "hasClassification": return hasAny(asset.classificationNames);
        case "hasGlossaryTerms": return hasAny(asset.meanings);
        case "hasReadme": return asset.readme?.hasReadme === true;
        case "hasLineage": return !!asset.__hasLineage || (((asset.lineage?.upstreamEdges ?? 0) + (asset.lineage?.downstreamEdges ?? 0)) > 0);
        default: return false;
      }
    };

    for (const c of rubric.checks as any[]) {
      checks.push({ id: c.id, points: c.points, score01: ok(c.id) ? 1 : 0 });
    }

    const score = checks.reduce((s, c) => s + (c.points ?? 0) * c.score01, 0);
    const band = scoreBand(score, thresholds);

    return { profileId: this.id, score, band, checks, metadata: { configVersion: ctx.configVersion, appliedOverrides: { assetType: asset.typeName } } };
  }
}

