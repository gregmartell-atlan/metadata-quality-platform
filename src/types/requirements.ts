/**
 * Requirements Matrix Types
 *
 * Defines the structure for Data as a Product (DaaP) requirements
 */

export type RequirementField =
  | 'description'
  | 'ownerUsers'
  | 'ownerGroups'
  | 'tags'
  | 'assignedTerms'
  | 'lineage'
  | 'certificateStatus'
  | 'readme'
  | 'columns'
  | 'classifications'
  | 'qualifiedName'
  | 'connection'
  | 'database'
  | 'schema';

export type RequirementLevel = 'required' | 'recommended' | 'optional';

export interface Requirement {
  field: RequirementField;
  level: RequirementLevel;
  description?: string;
}

export interface AssetTypeRequirement {
  assetType: string;
  requirements: Requirement[];
}

export interface RequirementsMatrix {
  name: string;
  description?: string;
  assetTypeRequirements: AssetTypeRequirement[];
  createdAt?: string;
  updatedAt?: string;
}

export type DaaPDimension =
  | 'Discoverable'
  | 'Addressable'
  | 'Trustworthy'
  | 'Self-describing'
  | 'Interoperable'
  | 'Secure'
  | 'Reusable';

export interface DaaPScore {
  dimension: DaaPDimension;
  score: number;
  maxScore: number;
}
