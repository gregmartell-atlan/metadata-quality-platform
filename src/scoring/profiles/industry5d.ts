import type { AtlanAsset, ScoringContext, ScoringProfile, ProfileScoreResult, DimensionResult, CheckResult } from "../contracts";
import { bandScore, clamp01, containsBlacklist, daysSince, saturatingLengthScore, scoreBand, weightedAverage01 } from "../helpers";

const hasAny = (arr?: string[] | null) => Array.isArray(arr) && arr.length > 0;
const descText = (a: AtlanAsset) => (a.userDescription || a.description || "").trim();

function namingCompliance(name: string, rules: { requiredRegex: string[]; minLength?: number }): number {
  const n = (name || "").trim();
  if (!n) return 0;
  if (rules.minLength && n.length < rules.minLength) return 0;
  const req = rules.requiredRegex || [];
  if (req.length === 0) return 1;
  const hits = req.map(r => {
    try { return new RegExp(r).test(n) ? 1 : 0; } catch { return 0; }
  });
  return hits.reduce((s, x) => s + x, 0) / hits.length;
}

export class Industry5DProfile implements ScoringProfile {
  readonly id = "industry5d";

  score(asset: AtlanAsset, ctx: ScoringContext): ProfileScoreResult {
    const cfg = ctx.config.profiles.industry5d;
    const thresholds = ctx.config.bands;

    const rules = cfg.namingRules?.[asset.typeName] ?? cfg.namingRules?.default ?? { requiredRegex: [] };

    // Completeness checks
    const d = descText(asset);
    const checksComp: Record<string, CheckResult> = {
      hasDescription: { id: "hasDescription", score01: d.length > 0 ? 1 : 0 },
      hasOwner: { id: "hasOwner", score01: (hasAny(asset.ownerUsers) || hasAny(asset.ownerGroups)) ? 1 : 0 },
      hasCertification: { id: "hasCertification", score01: asset.certificateStatus ? 1 : 0 },
      hasClassification: { id: "hasClassification", score01: hasAny(asset.classificationNames) ? 1 : 0 },
      hasGlossaryTerms: { id: "hasGlossaryTerms", score01: hasAny(asset.meanings) ? 1 : 0 },
      hasLineage: { id: "hasLineage", score01: asset.typeName !== "Table" ? 1 : ((asset.__hasLineage || ((asset.lineage?.upstreamEdges ?? 0)+(asset.lineage?.downstreamEdges ?? 0)>0)) ? 1 : 0) },
      hasReadme: { id: "hasReadme", score01: asset.readme?.hasReadme ? 1 : 0 },
      descriptionQuality: { id: "descriptionQuality", score01: saturatingLengthScore(d, cfg.usability.descriptionTargetChars) }
    };

    // Accuracy checks
    const status = (asset.certificateStatus || "").toUpperCase();
    const certStrengthMap: Record<string, number> = { VERIFIED: 1.0, DRAFT: 0.6, DEPRECATED: 0.0 };
    const checksAcc: Record<string, CheckResult> = {
      certificationStrength: { id: "certificationStrength", score01: certStrengthMap[status] ?? 0.0 },
      namingCompliance: { id: "namingCompliance", score01: namingCompliance(asset.name || "", rules), details: { rules } },
      ownerPlausible: { id: "ownerPlausible", score01: (hasAny(asset.ownerUsers) || hasAny(asset.ownerGroups)) ? 1 : 0 },
      classificationPolicy: { id: "classificationPolicy", score01: hasAny(asset.classificationNames) ? 1 : 0 }
    };

    // Timeliness checks
    const bands = cfg.timeliness.bands;
    const md = daysSince(ctx.nowMs, asset.updateTime);
    const cd = daysSince(ctx.nowMs, asset.certificateUpdatedAt);
    const ud = daysSince(ctx.nowMs, asset.sourceLastReadAt);

    const checksTime: Record<string, CheckResult> = {
      metadataFreshness: { id: "metadataFreshness", score01: md == null ? 0 : bandScore(md, bands) },
      certificationAge: { id: "certificationAge", score01: cd == null ? 0 : bandScore(cd, bands) },
      usageRecency: { id: "usageRecency", score01: asset.typeName !== "Table" ? 1 : (ud == null ? 0 : bandScore(ud, bands)) }
    };

    // Consistency checks (v1 proxies)
    const checksCons: Record<string, CheckResult> = {
      taxonomyAllowlist: { id: "taxonomyAllowlist", score01: hasAny(asset.classificationNames) ? 1 : 0 },
      domainGlossaryAlignment: { id: "domainGlossaryAlignment", score01: hasAny(asset.domainGUIDs) ? (hasAny(asset.meanings) ? 1 : 0) : 1 },
      hierarchyIntegrity: { id: "hierarchyIntegrity", score01: asset.qualifiedName ? 1 : 0 }
    };

    // Usability checks
    const bad = containsBlacklist(d, cfg.usability.blacklistPhrases);
    const p = asset.popularityScore ?? 0, v = asset.viewScore ?? 0, k = asset.starredCount ?? 0;
    const pn = cfg.usability.engagementNorm?.pMax ?? 1000;
    const vn = cfg.usability.engagementNorm?.vMax ?? 10000;
    const kn = cfg.usability.engagementNorm?.kMax ?? 500;
    const logNorm = (x: number, m: number) => clamp01(Math.log(1 + Math.max(0, x)) / Math.log(1 + m));

    let usabilityCap = 1;
    if (asset.isDiscoverable === false) usabilityCap = cfg.usability.discoverabilityCap ?? 0.3;

    const checksUse: Record<string, CheckResult> = {
      descriptionUsability: { id: "descriptionUsability", score01: clamp01(saturatingLengthScore(d, cfg.usability.descriptionTargetChars) * (bad ? 0 : 1)) },
      searchabilityProxy: { id: "searchabilityProxy", score01: clamp01(((d.length>0?1:0)+(hasAny(asset.meanings)?1:0)+(hasAny(asset.classificationNames)?1:0))/3) },
      engagement: { id: "engagement", score01: clamp01((logNorm(p,pn)+logNorm(v,vn)+logNorm(k,kn))/3) }
    };

    const dim = cfg.dimensions;

    const dimScore = (dimChecks: any, computed: Record<string, CheckResult>) => {
      const relevant = (dimChecks.checks as any[])
        .filter(c => (c.appliesTo as string[]).includes(asset.typeName))
        .map(c => ({ score01: computed[c.id]?.score01 ?? 0, weight: c.weight as number }));
      return weightedAverage01(relevant);
    };

    let sComp = dimScore(dim.completeness, checksComp);
    let sAcc = dimScore(dim.accuracy, checksAcc);
    let sTime = dimScore(dim.timeliness, checksTime);
    let sCons = dimScore(dim.consistency, checksCons);
    let sUse = dimScore(dim.usability, checksUse);
    sUse = Math.min(sUse, usabilityCap);

    const overall01 = weightedAverage01([
      { score01: sComp, weight: cfg.dimensionWeights.completeness },
      { score01: sAcc, weight: cfg.dimensionWeights.accuracy },
      { score01: sTime, weight: cfg.dimensionWeights.timeliness },
      { score01: sCons, weight: cfg.dimensionWeights.consistency },
      { score01: sUse, weight: cfg.dimensionWeights.usability }
    ]);

    const score100 = Math.round(overall01 * 1000) / 10;
    const band = scoreBand(score100, thresholds);

    const dims: DimensionResult[] = [
      { dimension: "completeness", score01: sComp, checks: Object.values(checksComp) },
      { dimension: "accuracy", score01: sAcc, checks: Object.values(checksAcc) },
      { dimension: "timeliness", score01: sTime, checks: Object.values(checksTime) },
      { dimension: "consistency", score01: sCons, checks: Object.values(checksCons) },
      { dimension: "usability", score01: sUse, checks: Object.values(checksUse) }
    ];

    return {
      profileId: this.id,
      score: score100,
      band,
      dimensions: dims,
      metadata: { configVersion: ctx.configVersion, appliedOverrides: { connection: asset.connectionName, assetType: asset.typeName } }
    };
  }
}

