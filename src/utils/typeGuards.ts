/**
 * Type guards for runtime type checking
 */

export type ScoringAssetType = 'Connection' | 'Database' | 'Schema' | 'Table';

/**
 * Check if a type name is a valid scoring asset type
 */
export function isValidScoringType(typeName: string | undefined | null): typeName is ScoringAssetType {
  if (!typeName) return false;
  const validTypes: ScoringAssetType[] = ['Connection', 'Database', 'Schema', 'Table'];
  return validTypes.includes(typeName as ScoringAssetType);
}

/**
 * Type guard for scoring asset
 */
export function isValidScoringAsset(asset: { typeName?: string | null }): asset is { typeName: ScoringAssetType } {
  return isValidScoringType(asset.typeName);
}

// ============================================
// Owner/Group Type Helpers
// ============================================

/**
 * Owner/Group object shape from Atlan API
 */
export interface OwnerObject {
  guid: string;
  name: string;
  groupName?: string;
}

/**
 * Owner/Group can be either a string or an object
 */
export type OwnerEntry = string | OwnerObject;

/**
 * Type guard to check if an owner entry is an object
 */
export function isOwnerObject(entry: OwnerEntry): entry is OwnerObject {
  return typeof entry === 'object' && entry !== null && 'name' in entry;
}

/**
 * Extract name from owner/group entry (handles both string and object formats)
 */
export function getOwnerName(entry: OwnerEntry | undefined | null): string {
  if (!entry) return '';
  if (typeof entry === 'string') return entry;
  return entry.name || entry.guid || '';
}

/**
 * Extract group name from owner entry if available
 */
export function getOwnerGroupName(entry: OwnerEntry | undefined | null): string | undefined {
  if (!entry || typeof entry === 'string') return undefined;
  return entry.groupName;
}

/**
 * Extract names from an array of owner/group entries
 */
export function getOwnerNames(entries: OwnerEntry[] | undefined | null): string[] {
  if (!entries || !Array.isArray(entries)) return [];
  return entries.map(getOwnerName).filter(Boolean);
}

/**
 * Get the first owner name from an array
 */
export function getFirstOwnerName(entries: OwnerEntry[] | undefined | null, fallback = 'Unknown'): string {
  const names = getOwnerNames(entries);
  return names[0] || fallback;
}

// ============================================
// Meaning/Term Type Helpers
// ============================================

/**
 * Meaning/Term object shape from Atlan API
 */
export interface MeaningObject {
  guid: string;
  displayText: string;
}

/**
 * Meaning can be either a string or an object
 */
export type MeaningEntry = string | MeaningObject;

/**
 * Type guard to check if a meaning entry is an object
 */
export function isMeaningObject(entry: MeaningEntry): entry is MeaningObject {
  return typeof entry === 'object' && entry !== null && 'displayText' in entry;
}

/**
 * Extract display text from meaning entry
 */
export function getMeaningText(entry: MeaningEntry | undefined | null): string {
  if (!entry) return '';
  if (typeof entry === 'string') return entry;
  return entry.displayText || '';
}

/**
 * Extract display texts from an array of meaning entries
 */
export function getMeaningTexts(entries: MeaningEntry[] | undefined | null): string[] {
  if (!entries || !Array.isArray(entries)) return [];
  return entries.map(getMeaningText).filter(Boolean);
}


