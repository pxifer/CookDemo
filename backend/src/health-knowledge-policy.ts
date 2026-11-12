import quarantine from '../../datasets/health/evidence-quarantine-v1.json';
import type { KnowledgeBundle } from '../../shared/health-knowledge';

/** Frozen snapshots remain readable, but known defective support cannot revive via old indexes. */
export const knownEvidenceWithdrawalIds: readonly string[] = Object.freeze(quarantine.entries.map(row => row.evidenceId));
if (new Set(knownEvidenceWithdrawalIds).size !== knownEvidenceWithdrawalIds.length
  || knownEvidenceWithdrawalIds.some(id => !/^ev:[a-f0-9]{64}$/.test(id))) throw Error('HEALTH_QUARANTINE_INVALID');

export function effectiveKnowledgeRevocations(bundle: Pick<KnowledgeBundle, 'revocations'>, extra: Iterable<string> = []) {
  return new Set([...bundle.revocations, ...knownEvidenceWithdrawalIds, ...extra]);
}
