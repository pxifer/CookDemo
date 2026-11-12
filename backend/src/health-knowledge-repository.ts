import { readFile } from 'node:fs/promises';
import type { Database } from './db';
import type { KnowledgeBundle, KnowledgeEvidence } from '../../shared/health-knowledge';
import { searchKnowledge, sha256, validateKnowledgeBundle, canonicalKnowledgeHash } from './health-knowledge';
import { effectiveKnowledgeRevocations } from './health-knowledge-policy';

/** Controlled dictionary tokens, not PG's default Chinese segmentation or BM25. */
export function evidenceTokens(bundle: KnowledgeBundle, evidence: KnowledgeEvidence): string {
  const text = evidence.retrievalText.toLowerCase();
  const tokens = new Set<string>();
  for (const entity of bundle.entities) {
    if ([entity.name,...entity.aliases].some(name => text.includes(name.toLowerCase()))) tokens.add(entity.id.replace(/[^a-z0-9]/gi,'_'));
  }
  for (const m of text.matchAll(/[a-z][a-z0-9_-]+/g)) tokens.add(m[0]);
  return [...tokens].sort().join(' ');
}
export class HealthKnowledgeRepository {
  private cache=new Map<string,{hash:string;bundle:KnowledgeBundle}>();
  constructor(private db: Database) {}
  async initializeResearchSchema() {
    await this.db.exec(await readFile(new URL('./health-knowledge/001-research.sql', import.meta.url),'utf8'));
    await this.db.exec(await readFile(new URL('./health-knowledge/002-integrity.sql', import.meta.url),'utf8'));
  }
  async importResearch(raw: unknown, manifest: Record<string,unknown>) {
    const bundle = validateKnowledgeBundle(raw), hash = sha256(JSON.stringify(bundle));
    const {sources:_s,entities:_e,evidence:_ev,facts:_f,ruleDrafts:_r,conflicts:_c,...metadata}=bundle;
    const integrityHash=canonicalKnowledgeHash(bundle);
    const saveSnapshot=async(db:Database)=>{
      const existing=await db.query<{canonical_hash:string}>('SELECT canonical_hash FROM health_kb.health_bundle_snapshots WHERE bundle_id=$1',[bundle.id]);
      if(existing.rows.length&&existing.rows[0].canonical_hash!==integrityHash)throw new Error('HEALTH_BUNDLE_INTEGRITY_MISMATCH');
      if(!existing.rows.length)await db.query('INSERT INTO health_kb.health_bundle_snapshots VALUES($1,$2::jsonb,$3)',[bundle.id,JSON.stringify(metadata),integrityHash]);
    };
    const work = async (db: Database) => {
      await db.exec('BEGIN');
      try {
        if (this.db.withSession) await db.query('SELECT pg_advisory_xact_lock(1936226167, 28)');
        // Existing releases also receive newly known withdrawals; immutable payloads are not rewritten.
        for (const id of effectiveKnowledgeRevocations(bundle)) await db.query('INSERT INTO health_kb.health_revocations(target_id,reason) VALUES($1,$2) ON CONFLICT DO NOTHING',[id,'bundle or source-recheck revocation']);
        const found = await db.query<{bundle_hash:string}>('SELECT bundle_hash FROM health_kb.health_releases WHERE id=$1',[bundle.id]);
        if (found.rows.length) {
          if (found.rows[0].bundle_hash !== hash) throw new Error('HEALTH_BUNDLE_IMMUTABLE');
          await saveSnapshot(db);
          await db.exec('COMMIT'); return {id:bundle.id,imported:false,hash};
        }
        await db.query('INSERT INTO health_kb.health_releases(id,bundle_hash,state,clinical_release,manifest) VALUES($1,$2,$3,NULL,$4::jsonb)',[bundle.id,hash,bundle.status,JSON.stringify(manifest)]);
        for (const s of bundle.sources) await db.query('INSERT INTO health_kb.health_documents VALUES($1,$2,$3,$4,$5,$6::jsonb)',[bundle.id,s.id,s.version,s.sourceHash,s.status,JSON.stringify(s)]);
        for (const e of bundle.entities) {
          await db.query('INSERT INTO health_kb.health_entities VALUES($1,$2,$3,$4,$5::jsonb)',[bundle.id,e.id,e.kind,e.name,JSON.stringify(e)]);
          for (const name of new Set([e.name,...e.aliases])) await db.query('INSERT INTO health_kb.health_aliases VALUES($1,$2,$3)',[bundle.id,e.id,name]);
        }
        for (const e of bundle.evidence) await db.query(`INSERT INTO health_kb.health_evidence_chunks VALUES($1,$2,$3,$4,$5,$6,$7::jsonb,to_tsvector('simple',$8))`,[bundle.id,e.id,e.sourceId,e.sourceVersion,e.sourceHash,e.status,JSON.stringify(e),evidenceTokens(bundle,e)]);
        for (const f of bundle.facts) {
          await db.query('INSERT INTO health_kb.health_facts VALUES($1,$2,$3,$4,$5,$6,$7,$8::jsonb)',[bundle.id,f.id,f.version,f.kind,f.subjectId,f.objectId,f.predicate,JSON.stringify(f)]);
          for (const [stance,ids] of [['support',f.evidenceIds],['qualify',f.qualifyingEvidenceIds]] as const) for (const id of ids)
            await db.query('INSERT INTO health_kb.health_fact_evidence VALUES($1,$2,$3,$4)',[bundle.id,f.id,id,stance]);
        }
        for (const r of bundle.ruleDrafts) await db.query('INSERT INTO health_kb.health_rule_versions VALUES($1,$2,$3,$4,$5,NULL)',[bundle.id,r.id,r.version,r.factId,r.status]);
        for (const c of bundle.conflicts) await db.query('INSERT INTO health_kb.health_conflicts VALUES($1,$2,$3::jsonb)',[bundle.id,c.id,JSON.stringify(c)]);
        await db.query('INSERT INTO health_kb.health_index_manifests VALUES($1,$2,$3,NULL,$4::jsonb)',[bundle.id,'structured_plus_controlled_keywords','lexical-v1',JSON.stringify(manifest.index ?? {})]);
        await saveSnapshot(db);
        await db.exec('COMMIT'); return {id:bundle.id,imported:true,hash};
      } catch(error) { await db.exec('ROLLBACK'); throw error; }
    };
    return this.db.withSession ? this.db.withSession(work) : work(this.db);
  }
  async load(id: string): Promise<KnowledgeBundle> {
    const release = await this.db.query<{metadata:Partial<KnowledgeBundle>;canonical_hash:string}>(`SELECT s.metadata,s.canonical_hash FROM health_kb.health_releases r JOIN health_kb.health_bundle_snapshots s ON s.bundle_id=r.id WHERE r.id=$1`,[id]);
    if (!release.rows.length) throw new Error('HEALTH_BUNDLE_NOT_FOUND');
    const snapshot=release.rows[0],cached=this.cache.get(id);
    if(cached?.hash===snapshot.canonical_hash)return cached.bundle;
    const rows = async <T>(table: string, field: string): Promise<T[]> => (await this.db.query<Record<string,T>>(`SELECT ${field} FROM health_kb.${table} WHERE bundle_id=$1 ORDER BY id`,[id])).rows.map(r=>r[field]);
    // All identifiers above are private constants; caller input is always parameter-bound.
    const [sources,entities,evidence,facts,conflicts] = await Promise.all([
      rows<KnowledgeBundle['sources'][number]>('health_documents','document'),rows<KnowledgeBundle['entities'][number]>('health_entities','entity'),
      rows<KnowledgeBundle['evidence'][number]>('health_evidence_chunks','chunk'),rows<KnowledgeBundle['facts'][number]>('health_facts','fact'),
      rows<KnowledgeBundle['conflicts'][number]>('health_conflicts','record'),
    ]);
    const rawRules = await this.db.query<{id:string;version:string;fact_id:string}>(`SELECT id,version,fact_id FROM health_kb.health_rule_versions WHERE bundle_id=$1 ORDER BY id`,[id]);
    const bundle=validateKnowledgeBundle({...snapshot.metadata,sources,entities,evidence,facts,conflicts,
      ruleDrafts:rawRules.rows.map(r=>({id:r.id,version:r.version,factId:r.fact_id,status:'draft',reviewer:null}))});
    if(canonicalKnowledgeHash(bundle)!==snapshot.canonical_hash)throw new Error('HEALTH_BUNDLE_INTEGRITY_MISMATCH');
    const freeze=(value:unknown):void=>{if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}};
    freeze(bundle);
    if(this.cache.size>=2)this.cache.delete(this.cache.keys().next().value!);
    this.cache.set(id,{hash:snapshot.canonical_hash,bundle});
    return bundle;
  }
  async search(id: string, query: string, options: Parameters<typeof searchKnowledge>[2] = {}) {
    const bundle = await this.load(id);
    // Read the current revocation watermark after loading content; cached bundles cannot revive sources.
    const rows = await this.db.query<{target_id:string}>('SELECT target_id FROM health_kb.health_revocations');
    let targets=rows.rows.map(r=>r.target_id).sort();
    let result=searchKnowledge(bundle,query,{...options,revoked:new Set([...targets,...options.revoked??[]])});
    const latest=(await this.db.query<{target_id:string}>('SELECT target_id FROM health_kb.health_revocations')).rows.map(r=>r.target_id).sort();
    if(latest.join('\0')!==targets.join('\0')){
      targets=latest;result=searchKnowledge(bundle,query,{...options,revoked:new Set([...targets,...options.revoked??[]])});
    }
    return {...result,revocationWatermark:sha256(JSON.stringify(targets))};
  }
  async withdraw(targetId: string, reason: string) {
    if (!targetId.trim() || !reason.trim()) throw new Error('HEALTH_REVOCATION_INVALID');
    await this.db.query('INSERT INTO health_kb.health_revocations(target_id,reason) VALUES($1,$2) ON CONFLICT DO NOTHING',[targetId,reason]);
  }
}
