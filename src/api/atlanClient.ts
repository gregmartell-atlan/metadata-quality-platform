import { configureAtlanApi, getAtlanConfig } from "../services/atlan/api";

// Internal wrapper to use the existing proxy-based API
// We'll need to access the internal atlanFetch function
// For now, we'll create a simple wrapper that uses fetch directly through the proxy
const PROXY_URL = import.meta.env.VITE_PROXY_URL || 'http://localhost:3002';

async function atlanFetchWrapper<T>(endpoint: string, init: RequestInit): Promise<{ data?: T; error?: string; status: number }> {
  const config = getAtlanConfig();
  if (!config) {
    return { error: "Atlan API not configured", status: 0 };
  }

  const proxyPath = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint;
  const url = `${PROXY_URL}/proxy/${proxyPath}`;

  try {
    const response = await fetch(url, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        'X-Atlan-URL': config.baseUrl,
        'X-Atlan-API-Key': config.apiKey,
        ...(init.headers ?? {}),
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      return { error: errorText || `API error: ${response.status}`, status: response.status };
    }

    const data = await response.json();
    return { data, status: response.status };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'Request failed',
      status: 0,
    };
  }
}

export type LineageRequest = { guid: string; depth: number; direction: "UPSTREAM"|"DOWNSTREAM"|"BOTH" };

/**
 * AtlanClient wrapper that uses the existing proxy-based API service
 */
export class AtlanClient {
  constructor(baseUrl: string, token: string) {
    // Initialize the existing API service
    configureAtlanApi({ baseUrl, apiKey: token });
  }

  private async request(path: string, init: RequestInit): Promise<any> {
    const response = await atlanFetchWrapper(path, init);

    if (response.error) {
      throw new Error(response.error);
    }

    return response.data;
  }

  async search(body: any): Promise<any> {
    return this.request("/api/meta/search/indexsearch", { method: "POST", body: JSON.stringify(body) });
  }

  async getLineage(req: LineageRequest): Promise<any> {
    return this.request("/api/meta/lineage/getlineage", { method: "POST", body: JSON.stringify(req) });
  }

  async getEntityByGuid(guid: string): Promise<any> {
    return this.request(`/api/meta/entity/guid/${encodeURIComponent(guid)}`, { method: "GET" });
  }
}

