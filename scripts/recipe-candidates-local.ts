import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { connectDatabase, type Database } from '../server/db';
import { curateCandidate, type CandidateCard } from './lib/candidate-curation';

const releaseCommit = '0e106eea348c734fe1586f781202994439cf98a5';
const batchId = `howtocook-${releaseCommit}`;
const repository = 'Anduin2017/HowToCook';
const licenseName = 'The Unlicense';
const licenseEvidence = [
  `https://github.com/${repository}/blob/${releaseCommit}/LICENSE`,
  'https://github.com/Anduin2017/HowToCook/issues/1468',
].join('\n');
const dataPath = resolve('docs/data/recipe-cards-v3.jsonl');
const supplementPath=resolve('docs/data/recipe-candidates-supplement-v1.jsonl');
const imagePath = resolve('docs/data/recipe-candidate-images.json');
const ddl = `
CREATE TABLE IF NOT EXISTS recipe_candidate_batches (
  id text PRIMARY KEY,
  source_repository text NOT NULL,
  source_commit text NOT NULL,
  license_name text NOT NULL,
  license_evidence text NOT NULL,
  expected_count integer NOT NULL CHECK (expected_count > 0),
  state text NOT NULL DEFAULT 'candidate_only' CHECK (state = 'candidate_only'),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS recipe_candidates (
  batch_id text NOT NULL REFERENCES recipe_candidate_batches(id),
  source_record_id text NOT NULL,
  dish_key text NOT NULL,
  flavor text NOT NULL,
  source_uri text NOT NULL,
  raw_sha256 text NOT NULL CHECK (raw_sha256 ~ '^[0-9a-f]{64}$'),
  raw_record jsonb NOT NULL CHECK (jsonb_typeof(raw_record) = 'object'),
  review_state text NOT NULL DEFAULT 'pending_review' CHECK (review_state IN ('pending_review','excluded')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (batch_id, source_record_id)
);
CREATE INDEX IF NOT EXISTS recipe_candidates_dish_flavor
  ON recipe_candidates (dish_key, flavor);
CREATE TABLE IF NOT EXISTS recipe_candidate_images (
  batch_id text NOT NULL REFERENCES recipe_candidate_batches(id),
  dish_key text NOT NULL,
  image_url text,
  reference_image_url text,
  source_uri text NOT NULL,
  license_name text NOT NULL,
  review_state text NOT NULL DEFAULT 'pending_review' CHECK (review_state IN ('pending_review','approved','excluded')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (batch_id, dish_key),
  CHECK (image_url IS NULL OR image_url LIKE '/assets/recipes/%'),
  CHECK (reference_image_url IS NULL OR reference_image_url LIKE 'https://raw.githubusercontent.com/Anduin2017/HowToCook/%')
);
CREATE TABLE IF NOT EXISTS recipe_candidate_reviews (
  batch_id text NOT NULL, source_record_id text NOT NULL,
  source_sha256 text NOT NULL CHECK (source_sha256 ~ '^[0-9a-f]{64}$'),
  curated_record jsonb NOT NULL CHECK (jsonb_typeof(curated_record)='object'),
  notes jsonb NOT NULL CHECK (jsonb_typeof(notes)='array'),
  state text NOT NULL DEFAULT 'pending_review' CHECK (state='pending_review'),
  PRIMARY KEY(batch_id,source_record_id),
  FOREIGN KEY(batch_id,source_record_id) REFERENCES recipe_candidates(batch_id,source_record_id)
);
GRANT SELECT ON recipe_candidate_reviews TO shiwei_app;
`;

type Card = {
  id: string; dish_key: string; flavor: string; url: string; source: string; completeness: string;
  commit?: string;
};
const stable = (value: unknown): string => JSON.stringify(value, (_key, item) => item && typeof item === 'object' && !Array.isArray(item)
  ? Object.fromEntries(Object.keys(item).sort().map(key => [key, item[key]])) : item);
const hash = (value: unknown) => createHash('sha256').update(stable(value)).digest('hex');
const required = (value: unknown): string => {
  if (typeof value !== 'string' || !value.trim()) throw new Error('CANDIDATE_SOURCE_INVALID');
  return value;
};

async function readCards() {
  const rows = (await readFile(dataPath, 'utf8')).split(/\r?\n/).filter(Boolean).map(line => JSON.parse(line) as Card);
  const selected = rows.filter(row => row.source === 'howtocook' && row.completeness === 'full_process');
  if (selected.length !== 139 || new Set(selected.map(row => row.id)).size !== selected.length) throw new Error('CANDIDATE_SOURCE_COUNT_MISMATCH');
  for (const row of selected) {
    if (!/^R\d{3}$/.test(required(row.id)) || !required(row.dish_key) || !required(row.flavor) ||
        !required(row.url).includes(`/blob/${releaseCommit}/`) || row.commit !== releaseCommit) throw new Error('CANDIDATE_SOURCE_INVALID');
  }
  return selected;
}

async function readSupplementCards(){
  const cards=(await readFile(supplementPath,'utf8')).split(/\r?\n/).filter(Boolean).map(s=>JSON.parse(s) as Card&{source_blob_sha:string});
  if(cards.length!==8||new Set(cards.map(c=>c.id)).size!==8||cards.some(c=>!/^R41[1-8]$/.test(c.id)||c.source!=='howtocook'||
    c.commit!==releaseCommit||c.completeness!=='source_text_pending_review'||!c.url.includes(`/blob/${releaseCommit}/`)||!/^[a-f0-9]{40}$/.test(c.source_blob_sha)))throw Error('CANDIDATE_SUPPLEMENT_INVALID');
  return cards;
}

async function readImages() {
  const data = JSON.parse(await readFile(imagePath, 'utf8')) as {
    source: string; commit: string; license: string; total: number;
    images: { id: string; image: string }[]; missing: string[];
    generated?: { id: string; image: string; style: string; status: string }[];
  };
  if (data.source !== repository || data.commit !== releaseCommit || data.license !== licenseName ||
      data.total !== 139 || data.images.length + data.missing.length !== data.total) throw new Error('CANDIDATE_IMAGE_MAP_INVALID');
  const allowed = new Set(data.images.map(item => item.id));
  if (allowed.size !== data.images.length || data.images.some(item => !/^R\d{3}$/.test(item.id) ||
      !item.image.startsWith(`https://raw.githubusercontent.com/${repository}/${releaseCommit}/dishes/`)) ||
      (data.generated ?? []).some(item => !/^R\d{3}$/.test(item.id) || !item.image.startsWith('/assets/recipes/') || item.style !== 'fine-dining-editorial')) throw new Error('CANDIDATE_IMAGE_MAP_INVALID');
  return data;
}

async function openLocalDatabase() {
  const ownerUrlPath = resolve('.local-data/deployment/db-owner-url');
  const base = new URL((await readFile(ownerUrlPath, 'utf8')).trim());
  if (base.hostname !== '127.0.0.1' || base.port !== '5432' || base.username !== 'shiwei_owner') throw new Error('CANDIDATE_DB_TARGET_REJECTED');
  base.pathname = '/shiwei_business_local';
  const db = await connectDatabase(base.toString(), { max: 1, connectTimeoutMs: 3000, queryTimeoutMs: 10000 });
  const target = await db.query<{ database: string; role: string }>('SELECT current_database() AS database, current_user AS role');
  if (target.rows[0]?.database !== 'shiwei_business_local' || target.rows[0]?.role !== 'shiwei_owner') {
    await db.close(); throw new Error('CANDIDATE_DB_TARGET_REJECTED');
  }
  return db;
}

async function transaction<T>(db: Database, work: (session: Database) => Promise<T>): Promise<T> {
  if (!db.withSession) throw new Error('CANDIDATE_DB_SESSION_REQUIRED');
  return db.withSession(async session => {
    await session.exec('BEGIN');
    try { const result = await work(session); await session.exec('COMMIT'); return result; }
    catch (error) { try { await session.exec('ROLLBACK'); } catch {} throw error; }
  });
}

async function main() {
  const action = process.argv[2] ?? 'plan';
  if (!['plan', 'import', 'inspect'].includes(action)) throw new Error('CANDIDATE_ACTION_INVALID');
  const baseCards = await readCards(),supplement=await readSupplementCards();
  const batches=[{id:batchId,cards:baseCards},{id:`${batchId}-supplement-v1`,cards:supplement}];
  const allCards=batches.flatMap(b=>b.cards);
  if(new Set(allCards.map(c=>c.id)).size!==allCards.length)throw Error('CANDIDATE_SUPPLEMENT_ID_CONFLICT');
  const images = await readImages();
  if (action === 'plan') {
    console.log(JSON.stringify({ batch: batchId, source: repository, commit: releaseCommit, license: licenseName,
      selected: allCards.length, dishes: new Set(allCards.map(row => row.dish_key)).size, batches:batches.map(b=>({id:b.id,count:b.cards.length})),state: 'candidate_only', databaseWrites: 0 }, null, 2));
    return;
  }
  const db = await openLocalDatabase();
  const outcomes:{count:number;pendingReview:number;excluded:number;curations:number;checksumMismatches:number;catalog:{recipes:number;variants:number}}[]=[];
  try {
    for(const batch of batches){
      const batchId=batch.id,cards=batch.cards;
    const result = await transaction(db, async session => {
      if (action === 'import') await session.exec(ddl);
      const table = await session.query<{ present: boolean }>(`SELECT to_regclass('public.recipe_candidate_batches') IS NOT NULL AS present`);
      if (!table.rows[0]?.present) throw new Error('CANDIDATE_TABLES_NOT_INSTALLED');
      if (action === 'import') {
        await session.query(`INSERT INTO recipe_candidate_batches
          (id,source_repository,source_commit,license_name,license_evidence,expected_count)
          VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(id) DO NOTHING`,
          [batchId, repository, releaseCommit, licenseName, licenseEvidence, cards.length]);
        const batch = await session.query<{ source_repository: string; source_commit: string; license_name: string; license_evidence: string; expected_count: number; state: string }>(
          `SELECT source_repository,source_commit,license_name,license_evidence,expected_count,state FROM recipe_candidate_batches WHERE id=$1`, [batchId]);
        const meta = batch.rows[0];
        if (!meta || meta.source_repository !== repository || meta.source_commit !== releaseCommit || meta.license_name !== licenseName ||
            meta.license_evidence !== licenseEvidence || Number(meta.expected_count) !== cards.length || meta.state !== 'candidate_only') {
          throw new Error('CANDIDATE_BATCH_CONFLICT');
        }
        for (const card of cards) {
          await session.query(`INSERT INTO recipe_candidates
            (batch_id,source_record_id,dish_key,flavor,source_uri,raw_sha256,raw_record)
            VALUES($1,$2,$3,$4,$5,$6,$7::jsonb) ON CONFLICT(batch_id,source_record_id) DO NOTHING`,
            [batchId, card.id, card.dish_key, card.flavor, card.url, hash(card), JSON.stringify(card)]);
          const curated=curateCandidate(card as CandidateCard);
          if(curated)await session.query(`INSERT INTO recipe_candidate_reviews(batch_id,source_record_id,source_sha256,curated_record,notes)
            VALUES($1,$2,$3,$4::jsonb,$5::jsonb) ON CONFLICT(batch_id,source_record_id) DO UPDATE SET
            curated_record=EXCLUDED.curated_record,notes=EXCLUDED.notes
            WHERE recipe_candidate_reviews.source_sha256=EXCLUDED.source_sha256`,
            [batchId,card.id,curated.sourceSha256,JSON.stringify(curated.record),JSON.stringify(curated.notes)]);
        }
        const cardById = new Map(cards.map(card => [card.id, card]));
        const imageByDish = new Map((images.generated ?? []).filter(item=>cardById.has(item.id)).map(item => [cardById.get(item.id)!.dish_key, item.image]));
        const referenceByDish = new Map(images.images.filter(item=>cardById.has(item.id)).map(item => [cardById.get(item.id)!.dish_key, item.image]));
        const seenDishes = new Set<string>();
        for (const card of cards) {
          if (seenDishes.has(card.dish_key)) continue;
          seenDishes.add(card.dish_key);
          const imageUrl = imageByDish.get(card.dish_key) ?? null;
          await session.query(`INSERT INTO recipe_candidate_images
            (batch_id,dish_key,image_url,reference_image_url,source_uri,license_name,review_state)
            VALUES($1,$2,$3,$4,$5,$6,'pending_review') ON CONFLICT(batch_id,dish_key) DO UPDATE SET
              image_url=COALESCE(recipe_candidate_images.image_url,EXCLUDED.image_url),
              reference_image_url=COALESCE(recipe_candidate_images.reference_image_url,EXCLUDED.reference_image_url)
            WHERE recipe_candidate_images.review_state='pending_review'`,
            [batchId, card.dish_key, imageUrl, referenceByDish.get(card.dish_key) ?? null, card.url, licenseName]);
        }
      }
      const check = await session.query<{ count: number; mismatches: number; pending: number; excluded: number; dishes: number }>(
        `SELECT count(*)::int AS count,
          count(*) FILTER (WHERE c.raw_sha256 <> v.raw_sha256)::int AS mismatches,
          count(*) FILTER (WHERE c.review_state='pending_review')::int AS pending,
          count(*) FILTER (WHERE c.review_state='excluded')::int AS excluded,
          count(DISTINCT c.dish_key)::int AS dishes
        FROM recipe_candidates c
        LEFT JOIN (VALUES ${cards.map((_, i) => `($${i * 2 + 2}::text,$${i * 2 + 3}::text)`).join(',')}) AS v(source_record_id,raw_sha256)
          ON v.source_record_id=c.source_record_id
        WHERE c.batch_id=$1`, [batchId, ...cards.flatMap(card => [card.id, hash(card)])]);
      const stats = check.rows[0];
      if (!stats || Number(stats.count) !== cards.length || Number(stats.mismatches) !== 0 ||
          Number(stats.pending) + Number(stats.excluded) !== cards.length) {
        throw new Error('CANDIDATE_BATCH_INTEGRITY_FAILED');
      }
      const imageStats = await session.query<{ total: number; found: number; approved: number }>(`SELECT
        count(*)::int AS total,
        count(*) FILTER (WHERE image_url IS NOT NULL)::int AS found,
        count(*) FILTER (WHERE review_state='approved')::int AS approved
        FROM recipe_candidate_images WHERE batch_id=$1`, [batchId]);
      const curatedExpected=new Map(cards.flatMap(card=>{const c=curateCandidate(card as CandidateCard);return c?[[card.id,c] as const]:[];}));
      const reviews=await session.query<{source_record_id:string;source_sha256:string;curated_record:unknown;notes:unknown;state:string}>(
        'SELECT source_record_id,source_sha256,curated_record,notes,state FROM recipe_candidate_reviews WHERE batch_id=$1',[batchId]);
      if(reviews.rows.length!==curatedExpected.size||reviews.rows.some(row=>{
        const expected=curatedExpected.get(row.source_record_id);
        return !expected||row.source_sha256!==expected.sourceSha256||hash(row.curated_record)!==hash(expected.record)||
          hash(row.notes)!==hash(expected.notes)||row.state!=='pending_review';
      }))throw new Error('CANDIDATE_CURATION_INTEGRITY_FAILED');
      const catalog = await session.query<{ recipes: number; variants: number }>(`SELECT
        (SELECT count(*)::int FROM catalog_recipes WHERE release_id='local-business-v1' AND state='published') AS recipes,
        (SELECT count(*)::int FROM catalog_variants WHERE release_id='local-business-v1' AND state='published') AS variants`);
      return { database: 'shiwei_business_local', batch: batchId, state: 'candidate_only', count: Number(stats.count),
        dishes: Number(stats.dishes), pendingReview: Number(stats.pending), excluded: Number(stats.excluded),
        images: imageStats.rows[0], curations:reviews.rows.length, publishedFromBatch: 0, catalog: catalog.rows[0], checksumMismatches: Number(stats.mismatches) };
    });
    outcomes.push(result);
    }
    const imageTotals=await db.query<{total:number;found:number;approved:number}>(`SELECT count(DISTINCT dish_key)::int AS total,
      count(DISTINCT dish_key) FILTER(WHERE image_url IS NOT NULL)::int AS found,
      count(DISTINCT dish_key) FILTER(WHERE review_state='approved')::int AS approved
      FROM recipe_candidate_images WHERE batch_id=ANY($1::text[])`,[batches.map(b=>b.id)]);
    console.log(JSON.stringify({database:'shiwei_business_local',state:'candidate_only',batches:batches.map(b=>({id:b.id,count:b.cards.length})),
      count:outcomes.reduce((n,r)=>n+r.count,0),dishes:new Set(allCards.map(c=>c.dish_key)).size,
      pendingReview:outcomes.reduce((n,r)=>n+r.pendingReview,0),excluded:outcomes.reduce((n,r)=>n+r.excluded,0),
      images:imageTotals.rows[0],curations:outcomes.reduce((n,r)=>n+r.curations,0),publishedFromBatch:0,
      catalog:{releaseId:'local-business-v1',...outcomes[0].catalog},checksumMismatches:outcomes.reduce((n,r)=>n+r.checksumMismatches,0)},null,2));
  } finally { await db.close(); }
}

main().catch(error => {
  const networkCodes = ['ECONNREFUSED', 'ETIMEDOUT', 'EHOSTUNREACH', 'ENOTFOUND'];
  const nestedCodes = Array.isArray(error?.errors) ? error.errors.map((item: { code?: string }) => item?.code) : [];
  const safeCode = typeof error?.code === 'string' && /^[A-Z0-9_]+$/.test(error.code) ? error.code
    : nestedCodes.find((item: unknown) => typeof item === 'string' && /^[A-Z0-9_]+$/.test(item));
  const code = typeof error?.message === 'string' && /^CANDIDATE_[A-Z_]+$/.test(error.message) ? error.message
    : networkCodes.includes(safeCode ?? '') ? 'CANDIDATE_DB_UNAVAILABLE'
    : safeCode ? `CANDIDATE_LOCAL_FAILED_${safeCode}` : 'CANDIDATE_LOCAL_FAILED';
  console.error(code); process.exitCode = 1;
});
