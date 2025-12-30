import defaultConfig from "./defaults/quality-config.default.json";
import { resolveQualityConfig, type OverrideScope } from "./resolver";

let cachedConfig: any = null;

/**
 * Load the default quality configuration
 */
export function loadQualityConfig(): any {
  if (cachedConfig) return cachedConfig;
  cachedConfig = defaultConfig;
  return cachedConfig;
}

/**
 * Get quality config with overrides applied
 */
export function getQualityConfig(scope?: OverrideScope): { config: any; applied: OverrideScope } {
  const base = loadQualityConfig();
  if (!scope) {
    return { config: base, applied: {} };
  }
  return resolveQualityConfig(base, scope);
}

/**
 * Clear cached config (useful for testing or hot-reload)
 */
export function clearQualityConfigCache(): void {
  cachedConfig = null;
}

export type { OverrideScope } from "./resolver";
export { resolveQualityConfig } from "./resolver";






