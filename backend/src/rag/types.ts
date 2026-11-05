import type { KnowledgeBundle, KnowledgeEvidence, KnowledgeFact } from '../../../shared/health-knowledge';

export interface EmbeddingIdentity {
  modelId: string;
  revision: string;
  dimensions: number;
  normalization: 'l2';
  pooling: string;
  queryInstruction: string;
  documentInstruction: string;
  representationVersion: string;
  runtimeVersion: string;
}
export interface EmbeddingBatch {
  identity: EmbeddingIdentity;
  vectors: number[][];
  tokenCounts: number[];
}
export interface EmbeddingProvider {
  describe(signal?: AbortSignal): Promise<EmbeddingIdentity>;
  embed(texts: string[], role: 'query' | 'document', signal?: AbortSignal): Promise<EmbeddingBatch>;
}
export interface RagIndexManifest {
  id: string;
  bundleId: string;
  bundleHash: string;
  identity: EmbeddingIdentity;
  chunks: number;
  state: 'ready';
  createdAt: string;
}
export interface EvidenceVector { evidenceId: string; textHash: string; vector: number[] }
export interface DenseHit { evidenceId: string; distance: number }
export interface RagVectorStore {
  putIndex(indexId: string, bundle: KnowledgeBundle, identity: EmbeddingIdentity, rows: EvidenceVector[]): Promise<RagIndexManifest>;
  manifest(indexId: string): Promise<RagIndexManifest>;
  search(indexId: string, vector: number[], limit: number): Promise<DenseHit[]>;
  revocations(): Promise<Set<string>>;
}
export interface RagQuestion {
  question: string;
  context?: Record<string, string | undefined>;
  diseaseId?: string;
  mode?: 'a1' | 'dense' | 'hybrid';
  requiredEvidenceIds?: string[];
}
export interface RagFactHit {
  fact: KnowledgeFact;
  score: number;
  applicability: string;
  lexicalRank?: number;
  denseRank?: number;
}
export interface RagEvidenceItem {
  evidence: KnowledgeEvidence;
  source: { id: string; title: string; url: string; hash: string; version: string };
}
export interface RagContext {
  question: string;
  bundleId: string;
  indexId: string;
  context: Record<string, string | undefined>;
  facts: RagFactHit[];
  evidence: RagEvidenceItem[];
  conflicts: KnowledgeBundle['conflicts'];
  missingConditions: string[];
  estimatedTokens: number;
  revocationWatermark: string;
}
export interface RagClaim { text: string; factIds: string[]; evidenceIds: string[] }
export interface RagGenerated {
  answer: string;
  claims: RagClaim[];
  limitations: string[];
}
export interface RagInvocation {
  provider: 'DeepSeek'; requestId: string; model: string;
  promptTokens: number; completionTokens: number; totalTokens: number; calledAt: string;
}
export interface RagGenerator {
  generate(context: RagContext, signal?: AbortSignal): Promise<{ output: unknown; invocation?: RagInvocation }>;
}
export type RagStatus = 'answered' | 'needs_confirmation' | 'insufficient_evidence' | 'unavailable';
export interface RagResult {
  status: RagStatus;
  executionAllowed: false;
  clinicalRelease: null;
  context?: RagContext;
  answer?: RagGenerated;
  invocation?: RagInvocation;
  reason?: string;
  missingConditions?: string[];
}
