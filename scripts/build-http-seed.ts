import { readFile, mkdir, writeFile, cp } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { galleryBundleHash, verifyGalleryBundle } from '../server/cloudbase-content';

async function main(){
  const directory=resolve('.local-data/cloudbase-http/release-20261023');
  const bundle=JSON.parse(await readFile(join(directory,'gallery-bundle.json'),'utf8'));
  const manifest=JSON.parse(await readFile(join(directory,'manifest.json'),'utf8'));
  if(galleryBundleHash(bundle)!==manifest.hash)throw Error('BUNDLE_HASH_MISMATCH');
  verifyGalleryBundle(bundle,manifest.hash);
  const migration=join(directory,'migration');await mkdir(migration,{recursive:false});
  await cp('cloudbase/migrations',join(migration,'cloudbase/migrations'),{recursive:true});
  const ddl=await readFile('deploy/db/gallery-http-release.sql','utf8');
  const text=JSON.stringify(bundle);if(text.includes('$shiwei_public_bundle$'))throw Error('BUNDLE_SQL_DELIMITER');
  const sql=`${ddl}\nINSERT INTO public.shiwei_gallery_releases(release_id,checksum,payload,published) VALUES ('${manifest.releaseId}','${manifest.hash}',$shiwei_public_bundle$${text}$shiwei_public_bundle$::jsonb,true);\nNOTIFY pgrst, 'reload schema';\n`;
  await writeFile(join(migration,'cloudbase/migrations/20261023103000_shiwei_public_gallery.sql'),sql,{flag:'wx'});
  console.log(JSON.stringify({releaseId:manifest.releaseId,hash:manifest.hash,sqlBytes:Buffer.byteLength(sql),personalTables:0,privateKeys:0,pendingMigration:'20261023103000_shiwei_public_gallery.sql'}));
}
main().catch(()=>{console.error('HTTP_SEED_BUILD_FAILED');process.exitCode=1;});
