export interface KnowledgeSource {
  id: string; title: string; version: string; kind: string; publisher: string;
  publicationDate: string; doi: string | null; url: string; retrievedDate: string;
  sourceHash: string; pageCount: number; status: 'active' | 'withdrawn';
  reuseScope: string; license: string; verification: string;
  mediaType?: string; archiveMember?: string;
}
export interface KnowledgeEntity {
  id: string; name: string; kind: 'disease' | 'component' | 'food' | 'food_group' | 'process';
  aliases: string[]; form: string | null; version: string;
}
export interface KnowledgeEvidence {
  id: string; key: string; sourceId: string; sourceVersion: string; sourceHash: string;
  locator: { kind: string; pdfPage: number | null; printedPage: number | null; section: string;
    start: number | null; end: number | null; normalization: string; verifiedPageImageHash?: string; assetUrl?:string; imageRegion?:number[] };
  originalSpan: string; spanHash: string; summary: string; retrievalText: string;
  chunkerVersion: string; verification: string; status: 'active' | 'withdrawn';
}
export interface KnowledgeCondition { key: string; values: string[] }
export interface KnowledgeFact {
  id: string; version: string; kind: 'disease_component' | 'food_component' | 'food_guidance' | 'cooking_effect';
  subjectId: string; objectId: string; predicate: string; statement: string;
  conditions: KnowledgeCondition[];
  quantity: null | { kind: 'classification_range' | 'reported_measurement'; value: number | null;
    lower: number | null; upper: number | null; upperExclusive: boolean; unit: string;
    basisAmount: number; basisUnit: string; category: string | null; method: string; sourceFoodLabel?: string };
  doseDependent: boolean; evidenceIds: string[]; qualifyingEvidenceIds: string[];
  sourceVersions: Record<string, string>; reviewState: string; clinicalReview: 'pending';
  validFrom: string; withdrawnAt: string | null; scope: string;
  directness: 'project_interpretation' | 'sample_measurement' | 'guideline_classification' | 'source_statement';
}
export interface KnowledgeBundle {
  schemaVersion: string; id: string; status: 'research_ready'; clinicalRelease: null; createdDate: string;
  sources: KnowledgeSource[]; entities: KnowledgeEntity[]; evidence: KnowledgeEvidence[]; facts: KnowledgeFact[];
  ruleDrafts: { id: string; version: string; factId: string; status: 'draft'; reviewer: null }[];
  conflicts: { id: string; kind: string; resolution: string; note: string; factIds?: string[]; evidenceIds?: string[]; sourceId?: string }[];
  revocations: string[]; recipeBindings: never[];
  boundaries: { personalDataIncluded: false; embeddingBuilt: false; onlineEnabled: false; fullTextRedistribution: false; [key: string]: unknown };
}
