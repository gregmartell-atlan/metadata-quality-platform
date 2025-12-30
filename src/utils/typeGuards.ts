/**
 * Type guards for runtime type checking
 */

import type { AtlanAsset as ScoringAtlanAsset } from '../scoring/contracts';

export type ScoringAssetType = "Connection" | "Database" | "Schema" | "Table";

/**
 * Check if a type name is a valid scoring asset type
 */
export function isValidScoringType(typeName: string | undefined | null): typeName is ScoringAssetType {
  if (!typeName) return false;
  const validTypes: ScoringAssetType[] = ["Connection", "Database", "Schema", "Table"];
  return validTypes.includes(typeName as ScoringAssetType);
}

/**
 * Type guard for scoring asset
 */
export function isValidScoringAsset(asset: { typeName?: string | null }): asset is { typeName: ScoringAssetType } {
  return isValidScoringType(asset.typeName);
}


