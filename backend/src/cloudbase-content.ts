import { createHash } from 'node:crypto';
import type { ContentSnapshot } from '../../shared/content';
import { GALLERY_RELEASE, galleryContent, type CandidateRow } from './gallery-content';
import { DomainError } from './recommendation';
import { applyCompositionRelease, COMPOSITION_BASE_HASH, compositionHash, type CompositionRelease } from './composition-review';
import legacySnapshot from '../../datasets/recipes/legacy-composition-snapshot.json';
import legacyManifest from '../../datasets/recipes/legacy-composition-manifest.json';
import { recipeImage } from '../../shared/recipe-images';

export interface GalleryBundle { base: ContentSnapshot; rows: CandidateRow[];
  listedFoodSnapshot?:ContentSnapshot;
  foodLevelReview?:{version:'listed-foods-v1';recipes:number;variants:number;ingredientRows:number;checkedAt:string};
}
export const recipeAssetOrigin='https://shiwei-d2gmiun66b7dc6a4f-1512010497.tcloudbaseapp.com';
const assetUrl=(url:string|null|undefined)=>url?.startsWith('/assets/recipes/')?`${recipeAssetOrigin}${url}`:url;
const canonical = (value: unknown) => JSON.stringify(value, (_key,item) => item && typeof item === 'object' && !Array.isArray(item)
  ? Object.fromEntries(Object.keys(item).sort().map(key=>[key,item[key]])) : item);
export const galleryBundleHash = (bundle: GalleryBundle) => createHash('sha256').update(canonical(bundle)).digest('hex');
export function verifyGalleryBundle(bundle: GalleryBundle, expectedHash: string) {
  if (!/^[a-f0-9]{64}$/.test(expectedHash) || galleryBundleHash(bundle)!==expectedHash)throw new Error('GALLERY_BUNDLE_INVALID');
  // Historical approvals bind the historical parser's output. Re-parsing that
  // immutable release with today's dictionary silently changes its identity.
  // Modern listed-food releases continue through their own validation below.
  if(expectedHash===COMPOSITION_BASE_HASH){
    if(legacyManifest.baseHash!==expectedHash||compositionHash(legacySnapshot)!==legacyManifest.snapshotHash)throw new Error('LEGACY_SNAPSHOT_INVALID');
    return structuredClone(legacySnapshot) as ContentSnapshot;
  }
  if(bundle.listedFoodSnapshot){
    const snapshot=bundle.listedFoodSnapshot,review=bundle.foodLevelReview;
    const ids=new Set(snapshot.foods.map(food=>food.id)),variants=snapshot.recipes.flatMap(recipe=>recipe.variants);
    if(!review||review.version!=='listed-foods-v1'||snapshot.restrictionScope!=='listed-foods'
      ||review.recipes!==snapshot.recipes.length||review.variants!==variants.length
      ||review.ingredientRows!==variants.reduce((count,variant)=>count+variant.lines.length,0)
      ||snapshot.recipes.length<145||ids.size!==snapshot.foods.length||new Set(snapshot.recipes.map(recipe=>recipe.id)).size!==snapshot.recipes.length
      ||variants.some(variant=>!variant.steps.length||!variant.lines.some(line=>line.role==='main'&&!line.optional)||variant.lines.some(line=>!ids.has(line.foodId)||!line.sourceText))
      ||snapshot.compositionApprovals||snapshot.unresolvedComponents||snapshot.uncertainComponents)throw new Error('LISTED_FOOD_BUNDLE_INVALID');
    return structuredClone(snapshot);
  }
  if (bundle.base.contentState!=='database-reviewed' || bundle.base.recipes.some(r=>r.source.kind!=='community')
    || bundle.rows.length!==147 || new Set(bundle.rows.map(r=>r.dish_key)).size!==145) throw new Error('GALLERY_BUNDLE_INVALID');
  return galleryContent(bundle.base,bundle.rows);
}

/** Read-only public recipe release in the existing CloudBase PostgreSQL.
 * The publishable key has anon permissions, with SELECT on this one table only.
 * Requests, dietary restrictions, credentials and accounts never enter it.
 */
export class CloudBaseGalleryRepository {
  private validatedSnapshot?: ContentSnapshot;
  private snapshotPromise?: Promise<ContentSnapshot>;
  constructor(private options: {envId:string; publishableKey:string; releaseId:string; hash:string; compositionReleaseId?:string; compositionHash?:string; fetch?:typeof fetch}) {
    if (!/^shiwei-[a-z0-9-]+$/.test(options.envId) || !/^[a-z0-9-]{1,80}$/.test(options.releaseId) || !/^[a-f0-9]{64}$/.test(options.hash) || !options.publishableKey) throw new Error('CLOUDBASE_CONTENT_CONFIGURATION');
    if ((options.compositionReleaseId || options.compositionHash) && (!/^[a-z0-9-]{1,80}$/.test(options.compositionReleaseId??'') || !/^[a-f0-9]{64}$/.test(options.compositionHash??''))) throw new Error('COMPOSITION_CONTENT_CONFIGURATION');
  }
  private async payload(releaseId:string): Promise<unknown> {
    try {
      const url=`https://${this.options.envId}.api.tcloudbasegateway.com/v1/rdb/rest/shiwei_gallery_releases?release_id=eq.${releaseId}&published=eq.true&select=payload`;
      const response=await (this.options.fetch??fetch)(url,{headers:{Authorization:`Bearer ${this.options.publishableKey}`},signal:AbortSignal.timeout(8000),redirect:'error'});
      if(!response.ok)throw new Error('CONTENT_READ_FAILED');
      const text=await response.text();
      if(Buffer.byteLength(text)>12*1024*1024)throw new Error('CONTENT_TOO_LARGE');
      const rows=JSON.parse(text);
      if(!Array.isArray(rows)||rows.length!==1)throw new Error('CONTENT_WITHDRAWN');
      return rows[0].payload;
    }catch {throw new DomainError('CONTENT_NOT_READY',503,'菜谱暂不可用，请保留输入后重试');}
  }
  private async assertPublished(releaseId:string):Promise<void> {
    try {
      const url=`https://${this.options.envId}.api.tcloudbasegateway.com/v1/rdb/rest/shiwei_gallery_releases?release_id=eq.${releaseId}&published=eq.true&select=release_id`;
      const response=await (this.options.fetch??fetch)(url,{headers:{Authorization:`Bearer ${this.options.publishableKey}`},signal:AbortSignal.timeout(8000),redirect:'error'});
      if(!response.ok)throw new Error('CONTENT_READ_FAILED');
      const rows=await response.json();
      if(!Array.isArray(rows)||rows.length!==1||rows[0]?.release_id!==releaseId)throw new Error('CONTENT_WITHDRAWN');
    }catch {throw new DomainError('CONTENT_NOT_READY',503,'菜谱暂不可用，请保留输入后重试');}
  }
  private async bundle(): Promise<GalleryBundle> {
    const bundle = await this.payload(this.options.releaseId) as GalleryBundle;
    try { verifyGalleryBundle(bundle,this.options.hash); return bundle; }
    catch { throw new DomainError('CONTENT_NOT_READY',503,'菜谱暂不可用，请保留输入后重试'); }
  }
  async load(release:string) {
    if(release!==GALLERY_RELEASE)throw new DomainError('CONTENT_NOT_READY',503,'菜谱暂不可用，请保留输入后重试');
    if(this.validatedSnapshot) {
      await Promise.all([this.assertPublished(this.options.releaseId), ...(this.options.compositionReleaseId?[this.assertPublished(this.options.compositionReleaseId)]:[])]);
      return this.validatedSnapshot;
    }
    this.snapshotPromise ??= (async()=>{
      const [bundle, review] = await Promise.all([this.bundle(), this.options.compositionReleaseId ? this.payload(this.options.compositionReleaseId) : undefined]);
      let snapshot=verifyGalleryBundle(bundle,this.options.hash);
      if(this.options.compositionReleaseId&&snapshot.restrictionScope!=='listed-foods') {
        try { snapshot=applyCompositionRelease(snapshot,review as CompositionRelease,this.options.compositionHash!); }
        catch { throw new DomainError('CONTENT_NOT_READY',503,'菜谱暂不可用，请保留输入后重试'); }
      }
      for(const recipe of snapshot.recipes)recipe.imageUrl=assetUrl(recipeImage(recipe.name,recipe.imageUrl))??undefined;
      this.validatedSnapshot=snapshot;
      return snapshot;
    })();
    try {
      const snapshot=await this.snapshotPromise;
      await Promise.all([this.assertPublished(this.options.releaseId), ...(this.options.compositionReleaseId?[this.assertPublished(this.options.compositionReleaseId)]:[])]);
      return snapshot;
    } catch(error) {
      this.snapshotPromise=undefined;
      throw error;
    }
  }
  async candidates() {return (await this.bundle()).rows.map(row=>({...row,image_url:assetUrl(recipeImage(row.dish_key,row.image_url))??null}));}
}
