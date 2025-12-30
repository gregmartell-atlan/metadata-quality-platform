import type { AtlanAsset } from "../contracts";
import { AtlanClient } from "../../api/atlanClient";

export class ReadmeEnricher {
  constructor(private client: AtlanClient, private opts: { concurrency: number } = { concurrency: 8 }) {}

  async enrich(assets: AtlanAsset[]): Promise<Map<string, { hasReadme: boolean }>> {
    const out = new Map<string, { hasReadme: boolean }>();
    const queue = [...assets];

    const workers = Array.from({ length: this.opts.concurrency }, async () => {
      while (queue.length) {
        const a = queue.pop();
        if (!a) break;
        try {
          const entity = await this.client.getEntityByGuid(a.guid);
          const hasReadme = !!(entity?.entity?.attributes?.readme || entity?.entity?.relationshipAttributes?.readme);
          out.set(a.guid, { hasReadme });
        } catch {
          out.set(a.guid, { hasReadme: false });
        }
      }
    });

    await Promise.all(workers);
    return out;
  }
}

