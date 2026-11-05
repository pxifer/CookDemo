import { createHash } from 'node:crypto';
import { contentContext, type ContentSnapshot } from '../../shared/content';
import type { Food, Line, Recipe } from '../../shared/types';
import type { Database } from './db';
import { DomainError } from './recommendation';

const title = '拾味本地构造测试内容';
const license = '仅项目本地构造测试；非正式食谱或营养资料';
const nutrientUnits = { kcal: 'kcal', protein: 'g', sodium: 'mg' } as const;
export class ContentError extends DomainError {
  constructor(code: string, status = 503) { super(code, status, '内容暂不可用，请保留输入后重试'); }
}
const canonical = (value: unknown): string => JSON.stringify(value, (_key, item) => item && typeof item === 'object' && !Array.isArray(item)
  ? Object.fromEntries(Object.keys(item).sort().map(key => [key, item[key]])) : item);
export const contentHash = (snapshot: ContentSnapshot) => createHash('sha256').update(canonical(snapshot)).digest('hex');
const ordered = <T extends { id: string }>(items: T[]) => [...items].sort((a,b) => a.id.localeCompare(b.id));
function normalize(snapshot: ContentSnapshot): ContentSnapshot {
  return { contentVersion: snapshot.contentVersion, contentState: 'database-constructed',
    ...(snapshot.contentState === 'database-reviewed' ? { contentState: 'database-reviewed' as const, sourceEvidence: snapshot.sourceEvidence } : {}),
    categories: [...snapshot.categories].sort((a,b) => a.name.localeCompare(b.name)).map(c => ({ ...c, aliases: [...c.aliases].sort(), targets: [...c.targets].sort() })),
    relations: [...(snapshot.relations ?? [])].sort((a,b) => canonical(a).localeCompare(canonical(b))),
    foods: ordered(snapshot.foods).map(f => ({ ...f, aliases: [...f.aliases].sort() })),
    recipes: ordered(snapshot.recipes).map(r => ({ ...r, variants: ordered(r.variants).map(v => ({ ...v,
      lines: v.lines.map(l => ({ ...l, optional: l.optional === true })), steps: [...v.steps] })) })) };
}
function validate(snapshot: ContentSnapshot) {
  const invalid = () => { throw new ContentError('CONTENT_INVALID', 422); };
  const text = (v: unknown, max = 1000) => typeof v === 'string' && v.trim().length > 0 && v.length <= max;
  const number = (n: unknown) => typeof n === 'number' && Number.isFinite(n) && n > 0 && n <= 1_000_000;
  const unique = (values: string[]) => new Set(values).size === values.length;
  const reviewed=snapshot.contentState==='database-reviewed';
  // Candidate runtime views cannot be passed off as a reviewed/constructed published package.
  if(snapshot.contentState==='database-candidate') invalid();
  if(reviewed) {
    for(const kind of ['recipe','food','nutrition'] as const){
      const s=snapshot.sourceEvidence?.[kind];
      if(!s || !text(s.title) || !text(s.license) || !text(s.evidence,5000) || !/^(https:\/\/|urn:shiwei:)/.test(s.uri) || !/^\d{4}-\d\d-\d\dT/.test(s.checkedAt) || !Number.isFinite(Date.parse(s.checkedAt))) invalid();
    }
  } else if(snapshot.sourceEvidence) invalid();
  if (!text(snapshot.contentVersion,100) || !Array.isArray(snapshot.foods) || !snapshot.foods.length || snapshot.foods.length > 1000 ||
      !Array.isArray(snapshot.recipes) || !snapshot.recipes.length || snapshot.recipes.length > 500 || !Array.isArray(snapshot.categories)) invalid();
  if (!unique(snapshot.foods.map(f => f.id)) || !unique(snapshot.recipes.map(r => r.id))) invalid();
  const index = new Map(snapshot.foods.map(f => [f.id, f]));
  for (const f of snapshot.foods) {
    if (!text(f.id,80) || !text(f.name,100) || !['g','个','ml'].includes(f.unit) || !['raw','cooked','bone_in','skin_on'].includes(f.form) ||
        typeof f.componentsComplete !== 'boolean' || !Array.isArray(f.aliases) || f.aliases.some(a => !text(a,100)) ||
        !Array.isArray(f.allergens) || f.allergens.some(a => !text(a,100)) || !f.nutrition) invalid();
    for (const [key,value] of Object.entries(f.nutrition)) if (!Object.hasOwn(nutrientUnits,key) || typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1_000_000 || Number(value.toFixed(6)) !== value) invalid();
  }
  for (const c of snapshot.categories) if (!text(c.name,100) || !text(c.note) || !Array.isArray(c.aliases) || c.aliases.some(a => !text(a,100)) ||
    !Array.isArray(c.targets) || !c.targets.length || !unique(c.targets) || c.targets.some(id => !index.has(id))) invalid();
  if (!unique(snapshot.categories.flatMap(c => [c.name,...c.aliases]))) invalid();
  const names = snapshot.foods.flatMap(f => [f.name,...f.aliases]);
  // Ambiguous alias adjudication is a later content workflow; reject this local package.
  if (!unique(names) || snapshot.categories.some(c => [c.name,...c.aliases].some(n => names.includes(n)))) invalid();
  const variants = new Set<string>();
  const quantityBasis = new Map<string,string>();
  for (const r of snapshot.recipes) {
    if (r.imageUrl !== undefined && !/^\/assets\/recipes\/[a-z0-9-]+\.png$/.test(r.imageUrl)) invalid();
    if (!text(r.id,80) || !/^[a-z0-9-]+$/.test(r.id) || !text(r.name,150) || !['meat','veg','soup'].includes(r.category) || typeof r.homeStyle !== 'boolean' ||
        r.minutes === null || !Number.isInteger(r.minutes) || r.minutes < 1 || r.minutes > 1440 || !number(r.servings) || !['meat','veg','meal'].includes(r.image) ||
        !Array.isArray(r.variants) || !r.variants.length) invalid();
    if(reviewed ? r.source?.kind!=='community' || r.source.reviewed!==true || r.source.reviewBasis!=='source-and-structure' || !/^https:\/\//.test(r.source.uri??'') || !text(r.source.author) || r.source.license!==snapshot.sourceEvidence!.recipe.license
      : r.source?.kind!=='constructed' || r.source.reviewed!==false) invalid();
    let mains: string | undefined;
    for (const v of r.variants) {
      if (!text(v.id,100) || variants.has(v.id) || !text(v.flavor,100) || !Array.isArray(v.lines) || !v.lines.length || v.lines.length > 100 ||
          !Array.isArray(v.steps) || !v.steps.length || v.steps.length > 100 || v.steps.some(s => !text(s,5000))) invalid();
      variants.add(v.id);
      const main = v.lines.filter(l => l.role === 'main').map(l => l.foodId).sort().join(',');
      if (!main || (mains !== undefined && main !== mains)) invalid(); mains = main;
      for (const l of v.lines) {
        if (!index.has(l.foodId) || l.amount === null || !number(l.amount) || Number(l.amount.toFixed(3)) !== l.amount ||
          !['g','个','ml'].includes(l.unit) || !['main','auxiliary','seasoning'].includes(l.role) || !['edible','as_purchased','unknown'].includes(l.basis) ||
          l.form !== index.get(l.foodId)?.form || (l.optional !== undefined && typeof l.optional !== 'boolean') ||
          (l.edibleGrams !== undefined && (!number(l.edibleGrams) || Number(l.edibleGrams.toFixed(3)) !== l.edibleGrams))) invalid();
        if (l.role !== 'seasoning') {
          const basis = `${l.unit}:${l.basis}:${l.form}`;
          if (quantityBasis.has(l.foodId) && quantityBasis.get(l.foodId) !== basis) invalid();
          quantityBasis.set(l.foodId,basis);
        }
      }
    }
  }
  for (const r of snapshot.relations ?? []) if (r.kind !== 'contains' || !index.has(r.foodId) || !index.has(r.relatedFoodId)) invalid();
  const context = contentContext(snapshot);
  try { for (const f of snapshot.foods) context.components(f.id); } catch { invalid(); }
}
function forImport(input: ContentSnapshot): ContentSnapshot {
  validate(input);
  const release = input.contentVersion;
  return normalize({ ...input, foods: input.foods.map(f => ({ ...f,
    nutritionSources: Object.fromEntries(Object.keys(f.nutrition).map(key => [key, { sourceId: `${release}:nutrition`, sourceVersion: '1',
      recordId: `${f.id}:${key}`, unit: nutrientUnits[key as keyof typeof nutrientUnits], basisGrams: 100 }])) })),
    recipes: input.recipes.map(r => ({ ...r, version: release, state: 'published', source: input.contentState==='database-reviewed' ? r.source : { kind: 'constructed', author: title, license, reviewed: false } })) });
}
async function transaction<T>(db: Database, readOnly: boolean, work: (session: Database) => Promise<T>): Promise<T> {
  const run = async (session: Database) => {
    await session.exec(`BEGIN ISOLATION LEVEL REPEATABLE READ ${readOnly ? 'READ ONLY' : 'READ WRITE'}`);
    try { const result = await work(session); await session.exec('COMMIT'); return result; }
    catch (error) { await session.exec('ROLLBACK').catch(() => {}); throw error; }
  };
  return db.withSession ? db.withSession(run) : run(db);
}
export class ContentRepository {
  constructor(private db: Database) {}
  private async protect<T>(work: () => Promise<T>): Promise<T> {
    try { return await work(); } catch (error) { if (error instanceof DomainError) throw error; throw new ContentError('CONTENT_DATABASE_UNAVAILABLE'); }
  }
  private async available(db: Database, release: string, draft = false) {
    const { rows } = await db.query<{ state: string; content_hash: string; manifest: any }>(
      'SELECT r.state,p.content_hash,p.manifest FROM catalog_releases r JOIN public_releases p ON p.id=r.id WHERE r.id=$1', [release]);
    const row = rows[0];
    if (!row) throw new ContentError('CONTENT_NOT_READY');
    if (row.state === 'withdrawn') throw new ContentError('CONTENT_WITHDRAWN');
    if (!draft && row.state !== 'published') throw new ContentError('CONTENT_NOT_READY');
    if (!['shiwei-local-constructed-v1','shiwei-local-reviewed-v1'].includes(row.manifest?.format)) throw new ContentError('CONTENT_FORMAT_UNSUPPORTED');
    const { rows: sources } = await db.query<{ id: string; version: string; title: string; license_name: string; state: string; kind:string; source_uri:string|null; license_evidence:string|null; checked_at:Date|null }>(
      `SELECT s.* FROM catalog_release_sources rs JOIN content_sources s ON s.id=rs.source_id AND s.version=rs.source_version WHERE rs.release_id=$1`, [release]);
    if (sources.length !== 3 || new Set(sources.map(s => s.kind)).size !== 3 || sources.some(s => s.state !== 'approved' || !['recipe','food','nutrition'].includes(s.kind))) throw new ContentError('CONTENT_SOURCE_UNAVAILABLE');
    if(row.manifest.format==='shiwei-local-reviewed-v1') {
      for(const source of sources){
        const expected=row.manifest.sourceEvidence?.[source.kind];
        if(!expected || source.title!==expected.title || source.license_name!==expected.license || source.source_uri!==expected.uri || source.license_evidence!==expected.evidence || !source.checked_at || new Date(source.checked_at).toISOString()!==new Date(expected.checkedAt).toISOString()) throw new ContentError('CONTENT_SOURCE_UNAVAILABLE');
      }
    }
    const objects = [`catalog-release:${release}`, ...sources.map(s => `catalog-source:${s.id}:${s.version}`)];
    if ((await db.query('SELECT 1 FROM revocations WHERE object_id=ANY($1::text[]) LIMIT 1',[objects])).rows.length) throw new ContentError('CONTENT_WITHDRAWN');
    const expected = draft && row.state === 'draft' ? 'draft' : 'published';
    const states = await db.query(`SELECT 1 FROM (
      SELECT state FROM catalog_foods WHERE release_id=$1 UNION ALL SELECT state FROM catalog_recipes WHERE release_id=$1
      UNION ALL SELECT state FROM catalog_variants WHERE release_id=$1) objects WHERE state<>$2 LIMIT 1`,[release,expected]);
    if (states.rows.length) throw new ContentError('CONTENT_INTEGRITY_INVALID');
    return { ...row, sources };
  }
  async assertAvailable(release: string) { return this.protect(async () => { await transaction(this.db,true,db => this.available(db,release)); }); }
  async load(release: string): Promise<ContentSnapshot> { return this.protect(() => transaction(this.db,true,db => this.read(db,release))); }
  private async read(db: Database, release: string, draft = false): Promise<ContentSnapshot> {
    const meta = await this.available(db,release,draft);
    const foodRows = (await db.query<any>('SELECT * FROM catalog_foods WHERE release_id=$1 ORDER BY id',[release])).rows;
    const aliases = (await db.query<any>('SELECT food_id,alias FROM catalog_food_aliases WHERE release_id=$1',[release])).rows;
    const nutrients = (await db.query<any>('SELECT * FROM catalog_nutrition WHERE release_id=$1',[release])).rows;
    const recipeRows = (await db.query<any>('SELECT * FROM catalog_recipes WHERE release_id=$1 ORDER BY id',[release])).rows;
    const variants = (await db.query<any>('SELECT * FROM catalog_variants WHERE release_id=$1 ORDER BY id',[release])).rows;
    const lines = (await db.query<any>('SELECT * FROM catalog_variant_lines WHERE release_id=$1 ORDER BY variant_id,position',[release])).rows;
    const steps = (await db.query<any>('SELECT * FROM catalog_variant_steps WHERE release_id=$1 ORDER BY variant_id,position',[release])).rows;
    const relations = (await db.query<any>('SELECT * FROM catalog_food_relations WHERE release_id=$1',[release])).rows;
    if (!foodRows.length || !recipeRows.length) throw new ContentError('CONTENT_EMPTY');
    if ([...foodRows,...recipeRows,...variants].some(row => row.state !== (draft && meta.state === 'draft' ? 'draft' : 'published'))) throw new ContentError('CONTENT_INTEGRITY_INVALID');
    const foods: Food[] = foodRows.map(row => {
      const nutrition: Food['nutrition'] = {}, nutritionSources: NonNullable<Food['nutritionSources']> = {};
      for (const n of nutrients.filter(n => n.food_id === row.id)) {
        const key = n.nutrient as keyof typeof nutrientUnits;
        if (!Object.hasOwn(nutrientUnits,key) || n.unit !== nutrientUnits[key] || Number(n.edible_basis_grams) !== 100 || key in nutrition) throw new ContentError('CONTENT_NUTRITION_AMBIGUOUS');
        if (!meta.sources.some(s => s.id === n.source_id && s.version === n.source_version && s.kind === 'nutrition')) throw new ContentError('CONTENT_SOURCE_UNAVAILABLE');
        nutrition[key] = Number(n.value);
        nutritionSources[key] = { sourceId: n.source_id, sourceVersion: n.source_version, recordId: n.source_record_id, unit: n.unit, basisGrams: 100 };
      }
      return { id: row.id, name: row.name, unit: row.default_unit, form: row.form, allergens: row.allergens, componentsComplete: row.components_complete,
        aliases: aliases.filter(a => a.food_id === row.id).map(a => a.alias), nutrition, nutritionSources };
    });
    const recipes: Recipe[] = recipeRows.map(row => {
      const source = meta.sources.find(s => s.id === row.source_id && s.version === row.source_version && s.kind === 'recipe');
      if (!source) throw new ContentError('CONTENT_SOURCE_UNAVAILABLE');
      return { id: row.id, name: row.name, category: row.category, homeStyle: row.home_style, minutes: row.minutes,
        servings: meta.manifest.recipeMetadata?.[row.id]?.servings, image: meta.manifest.recipeMetadata?.[row.id]?.image,
        ...(meta.manifest.recipeMetadata?.[row.id]?.imageUrl ? { imageUrl: meta.manifest.recipeMetadata[row.id].imageUrl } : {}),
        version: release, state: 'published', source: meta.manifest.format==='shiwei-local-reviewed-v1' ? meta.manifest.recipeMetadata?.[row.id]?.source : { kind: 'constructed', author: source.title, license: source.license_name, reviewed: false },
        variants: variants.filter(v => v.recipe_id === row.id).map(v => ({ id: v.id, flavor: v.flavor,
          lines: lines.filter(l => l.variant_id === v.id).map((l): Line => ({ foodId: l.food_id, amount: Number(l.amount), unit: l.unit, role: l.role,
            basis: l.basis, form: l.form, optional: l.optional, ...(l.edible_grams === null ? {} : { edibleGrams: Number(l.edible_grams) }) })),
          steps: steps.filter(s => s.variant_id === v.id).map(s => s.instruction) })) };
    });
    if (relations.some(r => r.kind !== 'contains')) throw new ContentError('CONTENT_RELATION_UNSUPPORTED');
    const snapshot = normalize({ contentVersion: release, contentState: meta.manifest.format==='shiwei-local-reviewed-v1' ? 'database-reviewed' : 'database-constructed',
      ...(meta.manifest.sourceEvidence ? {sourceEvidence:meta.manifest.sourceEvidence} : {}), foods, recipes, categories: meta.manifest.categories,
      relations: relations.map(r => ({ foodId: r.food_id, relatedFoodId: r.related_food_id, kind: r.kind })) });
    try { validate(snapshot); } catch { throw new ContentError('CONTENT_INTEGRITY_INVALID'); }
    if (contentHash(snapshot) !== meta.content_hash) throw new ContentError('CONTENT_INTEGRITY_INVALID');
    return snapshot;
  }
  async importDraft(input: ContentSnapshot) {
    return this.protect(async () => {
      const snapshot = forImport(input), id = snapshot.contentVersion;
      await transaction(this.db,false,async db => {
        if ((await db.query('SELECT 1 FROM public_releases WHERE id=$1',[id])).rows.length) throw new ContentError('CONTENT_VERSION_EXISTS',409);
        const reviewed=snapshot.contentState==='database-reviewed';
        const manifest = { format: reviewed ? 'shiwei-local-reviewed-v1' : 'shiwei-local-constructed-v1', categories: snapshot.categories,
          ...(snapshot.sourceEvidence ? {sourceEvidence:snapshot.sourceEvidence} : {}),
          recipeMetadata: Object.fromEntries(snapshot.recipes.map(r => [r.id,{ servings:r.servings, image:r.image, ...(reviewed?{source:r.source}:{}), ...(r.imageUrl ? { imageUrl: r.imageUrl } : {}) }])) };
        await db.query('INSERT INTO public_releases(id,content_hash,manifest) VALUES($1,$2,$3)',[id,contentHash(snapshot),JSON.stringify(manifest)]);
        await db.query('INSERT INTO catalog_releases(id) VALUES($1)',[id]);
        for (const kind of ['recipe','food','nutrition']) {
          if(reviewed) {
            const s=snapshot.sourceEvidence![kind as 'recipe'|'food'|'nutrition'];
            await db.query(`INSERT INTO content_sources(id,version,kind,title,source_uri,license_name,license_evidence,state,checked_at)
              VALUES($1,'1',$2,$3,$4,$5,$6,'approved',$7)`,[`${id}:${kind}`,kind,s.title,s.uri,s.license,s.evidence,s.checkedAt]);
          } else {
          await db.query(`INSERT INTO content_sources(id,version,kind,title,license_name,license_evidence,state,checked_at)
            VALUES($1,'1',$2,$3,$4,'本地自建构造测试，不引用外部资料','approved',now())`,[`${id}:${kind}`,kind,title,license]);
          }
          await db.query("INSERT INTO catalog_release_sources VALUES($1,$2,'1')",[id,`${id}:${kind}`]);
        }
        for (const f of snapshot.foods) {
          await db.query(`INSERT INTO catalog_foods(release_id,id,name,default_unit,form,components_complete,allergens)
            VALUES($1,$2,$3,$4,$5,$6,$7)`,[id,f.id,f.name,f.unit,f.form,f.componentsComplete,f.allergens]);
          for (const alias of f.aliases) await db.query('INSERT INTO catalog_food_aliases VALUES($1,$2,$3)',[id,f.id,alias]);
          for (const [key,value] of Object.entries(f.nutrition)) await db.query(`INSERT INTO catalog_nutrition
            (release_id,food_id,nutrient,value,unit,source_id,source_version,source_record_id) VALUES($1,$2,$3,$4,$5,$6,'1',$7)`,
            [id,f.id,key,value,nutrientUnits[key as keyof typeof nutrientUnits],`${id}:nutrition`,`${f.id}:${key}`]);
        }
        for (const relation of snapshot.relations ?? []) await db.query('INSERT INTO catalog_food_relations VALUES($1,$2,$3,$4)',[id,relation.foodId,relation.relatedFoodId,relation.kind]);
        for (const r of snapshot.recipes) {
          await db.query(`INSERT INTO catalog_recipes(release_id,id,name,category,home_style,minutes,source_id,source_version)
            VALUES($1,$2,$3,$4,$5,$6,$7,'1')`,[id,r.id,r.name,r.category,r.homeStyle,r.minutes,`${id}:recipe`]);
          for (const v of r.variants) {
            await db.query('INSERT INTO catalog_variants(release_id,id,recipe_id,flavor) VALUES($1,$2,$3,$4)',[id,v.id,r.id,v.flavor]);
            for (const [position,l] of v.lines.entries()) await db.query(`INSERT INTO catalog_variant_lines
              (release_id,variant_id,position,food_id,amount,unit,role,basis,form,optional,edible_grams) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
              [id,v.id,position,l.foodId,l.amount,l.unit,l.role,l.basis,l.form,l.optional ?? false,l.edibleGrams ?? null]);
            for (const [position,step] of v.steps.entries()) await db.query('INSERT INTO catalog_variant_steps VALUES($1,$2,$3,$4)',[id,v.id,position,step]);
          }
        }
        // Round-trip and hash validation happen before the import transaction commits.
        await this.read(db,id,true);
      });
      return { releaseId:id, state:'draft' as const, foods:snapshot.foods.length, recipes:snapshot.recipes.length };
    });
  }
  async publish(release: string) {
    return this.protect(() => transaction(this.db,false,async db => {
      await db.query('SELECT id FROM catalog_releases WHERE id=$1 FOR UPDATE',[release]);
      await this.read(db,release,true);
      for (const table of ['catalog_foods','catalog_recipes','catalog_variants']) await db.query(`UPDATE ${table} SET state='published' WHERE release_id=$1`,[release]);
      await db.query("UPDATE catalog_releases SET state='published',published_at=COALESCE(published_at,now()) WHERE id=$1",[release]);
      return { releaseId:release, state:'published' as const };
    }));
  }
  async withdraw(release: string) {
    return this.protect(() => transaction(this.db,false,async db => {
      const { rowCount } = await db.query("UPDATE catalog_releases SET state='withdrawn' WHERE id=$1",[release]);
      if (!rowCount) throw new ContentError('CONTENT_NOT_READY');
      await db.query('INSERT INTO revocations(object_id) VALUES($1) ON CONFLICT(object_id) DO NOTHING',[`catalog-release:${release}`]);
    }));
  }
}
