import type { AtlanAsset } from "../contracts";
import { AtlanClient } from "../../api/atlanClient";

interface LineageResult {
  upstreamEdges: number;
  downstreamEdges: number;
}

interface CacheEntry {
  data: LineageResult;
  timestamp: number;
}

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const MAX_CACHE_SIZE = 500;

export class LineageEnricher {
  private cache = new Map<string, CacheEntry>();
  private inFlight = new Map<string, Promise<LineageResult>>();

  constructor(
    private client: AtlanClient,
    private opts: { batchSize: number; concurrency: number; depth: number } = { batchSize: 50, concurrency: 4, depth: 1 }
  ) {}

  private getCached(guid: string): LineageResult | null {
    const entry = this.cache.get(guid);
    if (entry && Date.now() - entry.timestamp < CACHE_TTL) {
      return entry.data;
    }
    this.cache.delete(guid);
    return null;
  }

  private setCache(guid: string, data: LineageResult): void {
    // Evict if cache is full
    if (this.cache.size >= MAX_CACHE_SIZE) {
      const now = Date.now();
      const toDelete: string[] = [];
      for (const [k, v] of this.cache) {
        if (now - v.timestamp >= CACHE_TTL) toDelete.push(k);
      }
      toDelete.forEach(k => this.cache.delete(k));

      if (this.cache.size >= MAX_CACHE_SIZE) {
        const oldest = this.cache.keys().next().value;
        if (oldest) this.cache.delete(oldest);
      }
    }
    this.cache.set(guid, { data, timestamp: Date.now() });
  }

  clearCache(): void {
    this.cache.clear();
    this.inFlight.clear();
  }

  async enrich(assets: AtlanAsset[]): Promise<Map<string, LineageResult>> {
    const out = new Map<string, LineageResult>();
    const eligible = assets.filter(a => a.typeName === "Table");

    // Separate cached vs uncached
    const uncached: AtlanAsset[] = [];
    for (const asset of eligible) {
      const cached = this.getCached(asset.guid);
      if (cached) {
        out.set(asset.guid, cached);
      } else {
        uncached.push(asset);
      }
    }

    if (uncached.length === 0) return out;

    // Batch fetch uncached
    const batches: AtlanAsset[][] = [];
    for (let i = 0; i < uncached.length; i += this.opts.batchSize) {
      batches.push(uncached.slice(i, i + this.opts.batchSize));
    }

    const queue = [...batches];
    const workers = Array.from({ length: this.opts.concurrency }, async () => {
      while (queue.length) {
        const batch = queue.pop();
        if (!batch) break;
        await Promise.all(batch.map(async a => {
          // Check for in-flight request
          const existing = this.inFlight.get(a.guid);
          if (existing) {
            const result = await existing;
            out.set(a.guid, result);
            return;
          }

          // Create new request
          const promise = (async (): Promise<LineageResult> => {
            try {
              const res = await this.client.getLineage({ guid: a.guid, depth: this.opts.depth, direction: "BOTH" });
              const up = Array.isArray(res?.upstream?.edges) ? res.upstream.edges.length : 0;
              const down = Array.isArray(res?.downstream?.edges) ? res.downstream.edges.length : 0;
              return { upstreamEdges: up, downstreamEdges: down };
            } catch {
              return { upstreamEdges: a.__hasLineage ? 1 : 0, downstreamEdges: 0 };
            }
          })();

          this.inFlight.set(a.guid, promise);
          try {
            const result = await promise;
            this.setCache(a.guid, result);
            out.set(a.guid, result);
          } finally {
            this.inFlight.delete(a.guid);
          }
        }));
      }
    });

    await Promise.all(workers);
    return out;
  }
}

