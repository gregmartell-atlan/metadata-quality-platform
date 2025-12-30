import type { AtlanAsset, ProfileScoreResult, ScoringContext } from "./contracts";
import { ScoringEngine as CoreScoringEngine } from "./scoringEngineCore";
import { resolveQualityConfig } from "../config/quality/resolver";
import { LineageEnricher } from "./enrichment/lineageEnricher";
import { ReadmeEnricher } from "./enrichment/readmeEnricher";
import { AtlanClient } from "../api/atlanClient";

export class OrchestratedScoringEngine {
  private core = new CoreScoringEngine();
  private lineage: LineageEnricher;
  private readme: ReadmeEnricher;

  constructor(private baseConfig: any, client: AtlanClient) {
    this.lineage = new LineageEnricher(client, { batchSize: 50, concurrency: 4, depth: 1 });
    this.readme = new ReadmeEnricher(client, { concurrency: 8 });
  }

  async scoreAssets(assets: AtlanAsset[], nowMs: number): Promise<Map<string, ProfileScoreResult[]>> {
    const lineageMap = await this.lineage.enrich(assets);

    const readmeCandidates = assets.filter(a => ((a.userDescription || a.description || "").trim().length === 0));
    const readmeMap = await this.readme.enrich(readmeCandidates);

    const enriched = assets.map(a => ({
      ...a,
      lineage: lineageMap.get(a.guid) ?? a.lineage ?? null,
      readme: readmeMap.get(a.guid) ? { hasReadme: readmeMap.get(a.guid)!.hasReadme } : (a.readme ?? null)
    }));

    const out = new Map<string, ProfileScoreResult[]>();

    for (const a of enriched) {
      const domain = (a.domainGUIDs && a.domainGUIDs.length > 0) ? a.domainGUIDs[0] : undefined;
      const { config, applied } = resolveQualityConfig(this.baseConfig, { domain, connection: a.connectionName, assetType: a.typeName });

      const ctx: ScoringContext = { nowMs, configVersion: config.version ?? "unknown", config };
      const results = this.core.scoreAll(a, ctx).map(r => ({ ...r, metadata: { ...r.metadata, appliedOverrides: applied } }));
      out.set(a.guid, results);
    }

    return out;
  }
}

