/* eslint-disable @typescript-eslint/no-explicit-any */
import type { AssetType } from "../../scoring/contracts";

export type OverrideScope = { domain?: string; connection?: string; assetType?: AssetType };

function isObject(x: any): x is Record<string, any> {
  return x !== null && typeof x === "object" && !Array.isArray(x);
}

export function deepMerge(base: any, override: any): any {
  if (override === undefined) return base;
  if (!isObject(base) || !isObject(override)) return override; // arrays + primitives replaced
  const out: Record<string, any> = { ...base };
  for (const [k, v] of Object.entries(override)) out[k] = k in out ? deepMerge(out[k], v) : v;
  return out;
}

function slice(cfg: any, scopeKey: "domains"|"connections"|"assetTypes", id?: string): any | undefined {
  if (!id) return undefined;
  return cfg?.overrides?.[scopeKey]?.[id];
}

export function resolveQualityConfig(baseCfg: any, scope: OverrideScope): { config: any; applied: OverrideScope } {
  const domainSlice = slice(baseCfg, "domains", scope.domain);
  const connSlice = slice(baseCfg, "connections", scope.connection);
  const typeSlice = slice(baseCfg, "assetTypes", scope.assetType);

  // precedence: base → domain → connection → assetType
  let cfg = baseCfg;
  cfg = deepMerge(cfg, domainSlice);
  cfg = deepMerge(cfg, connSlice);
  cfg = deepMerge(cfg, typeSlice);

  return { config: cfg, applied: { ...scope } };
}

