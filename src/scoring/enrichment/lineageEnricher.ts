import type { AtlanAsset } from "../contracts";
import { AtlanClient } from "../../api/atlanClient";

export class LineageEnricher {
  constructor(
    private client: AtlanClient,
    private opts: { batchSize: number; concurrency: number; depth: number } = { batchSize: 50, concurrency: 4, depth: 1 }
  ) {}

  async enrich(assets: AtlanAsset[]): Promise<Map<string, { upstreamEdges: number; downstreamEdges: number }>> {
    const out = new Map<string, { upstreamEdges: number; downstreamEdges: number }>();

    const eligible = assets.filter(a => a.typeName === "Table");
    const batches: AtlanAsset[][] = [];
    for (let i = 0; i < eligible.length; i += this.opts.batchSize) batches.push(eligible.slice(i, i + this.opts.batchSize));

    const queue = [...batches];
    const workers = Array.from({ length: this.opts.concurrency }, async () => {
      while (queue.length) {
        const batch = queue.pop();
        if (!batch) break;
        await Promise.all(batch.map(async a => {
          try {
            const res = await this.client.getLineage({ guid: a.guid, depth: this.opts.depth, direction: "BOTH" });
            const up = Array.isArray(res?.upstream?.edges) ? res.upstream.edges.length : 0;
            const down = Array.isArray(res?.downstream?.edges) ? res.downstream.edges.length : 0;
            out.set(a.guid, { upstreamEdges: up, downstreamEdges: down });
          } catch {
            out.set(a.guid, { upstreamEdges: a.__hasLineage ? 1 : 0, downstreamEdges: 0 });
          }
        }));
      }
    });

    await Promise.all(workers);
    return out;
  }
}

