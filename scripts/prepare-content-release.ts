import { build } from 'esbuild';
import { readFile, writeFile, mkdir, copyFile, cp } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve, join, sep } from 'node:path';
import { galleryBundleHash, verifyGalleryBundle, type GalleryBundle } from '../backend/src/cloudbase-content';

/** Package a content release for the existing CloudBase HTTP function.
 *
 * The previous releases were assembled by ad-hoc scripts, which is why the publish
 * path could not be reproduced. This one takes an already-verified content pack and a
 * previous release directory, and writes: the function bundle, the web build, the
 * cloudbaserc with the new content id/hash (all other settings and secrets preserved),
 * and a migration that publishes the new content row.
 *
 * It never contacts the cloud, never prints secrets, and refuses to overwrite.
 */
const args = new Map<string, string>();
for (let index = 2; index < process.argv.length; index += 2) args.set(process.argv[index]!.replace(/^--/, ''), process.argv[index + 1] ?? '');
const from = args.get('from');
const name = args.get('release');
const content = args.get('content') ?? 'datasets/recipes/expansion-1000';
if (!from || !name || !/^main-v\d+-[0-9]{8}$/.test(name)) throw new Error('USAGE: --from <prevReleaseDir> --release main-vNN-YYYYMMDD [--content <dir>]');

const contentRoot = resolve(content);
const previous = resolve(from);
// Existing packages are named release-<YYYYMMDD>-main-vNN; keep that order.
const match = /^main-v(\d+)-(\d{8})$/.exec(name);
if (!match) throw new Error('RELEASE_NAME_INVALID');
const target = resolve(`.local-data/cloudbase-http/release-${match[2]}-main-v${match[1]}`);
for (const path of [contentRoot, previous]) if (!path.startsWith(resolve('.local-data/cloudbase-http')) && path !== resolve('datasets/recipes/expansion-1000')) throw new Error('PATH_REJECTED');

const manifest = JSON.parse(await readFile(join(contentRoot, 'manifest.json'), 'utf8'));
const bundle: GalleryBundle = JSON.parse(await readFile(join(contentRoot, 'gallery-bundle.json'), 'utf8'));
if (galleryBundleHash(bundle) !== manifest.hash) throw new Error('BUNDLE_HASH_MISMATCH');
verifyGalleryBundle(bundle, manifest.hash);

const previousConfig = JSON.parse(await readFile(join(previous, 'cloudbaserc.json'), 'utf8'));
const functions = previousConfig.functions;
if (!Array.isArray(functions) || functions.length !== 1 || functions[0].name !== 'shiwei-http-preview') throw new Error('PREVIOUS_FUNCTION_CONFIGURATION');
const settings = functions[0].envVariables;
for (const key of ['SESSION_SECRET_B64', 'CSRF_SECRET_B64', 'PROFILE_ENCRYPTION_KEY_B64', 'CLOUDBASE_ENV_ID', 'CLOUDBASE_PUBLISHABLE_KEY']) {
  if (!settings?.[key]) throw new Error('PREVIOUS_SECRET_MISSING');
}

await mkdir(target, { recursive: false });
const fn = join(target, 'function');
await mkdir(fn);
await build({ entryPoints: ['deployment/cloudbase/http-main.ts'], outfile: join(fn, 'http-main.cjs'), bundle: true, platform: 'node', target: 'node24', format: 'cjs', packages: 'external' });
for (const file of ['package.json', 'package-lock.json', 'index.js', 'scf_bootstrap']) await copyFile(join(previous, 'function', file), join(fn, file));
await cp(join(previous, 'function', 'node_modules'), join(fn, 'node_modules'), { recursive: true });

// The UI travels with the function so the page and API share one origin and build.
const excluded = resolve('artifacts/build/web/assets/recipes');
await cp('artifacts/build/web', join(fn, 'build', 'web'), {
  recursive: true, filter: path => resolve(path) !== excluded && !resolve(path).startsWith(excluded + sep),
});

settings.CONTENT_BUNDLE_ID = manifest.releaseId;
settings.CONTENT_BUNDLE_SHA256 = manifest.hash;
delete settings.COMPOSITION_RELEASE_ID;
delete settings.COMPOSITION_RELEASE_SHA256;
functions[0].timeout = 60;
await writeFile(join(target, 'cloudbaserc.json'), JSON.stringify(previousConfig, null, 2), { mode: 0o600 });

// `tcb db pg migration up` reads `<cwd>/cloudbase/migrations`, so the package carries
// that exact layout and is applied with the working directory set to `migration/`.
const migration = join(target, 'migration', 'cloudbase', 'migrations');
await mkdir(migration, { recursive: true });
const text = JSON.stringify(bundle);
if (text.includes('$shiwei_public_bundle$')) throw new Error('BUNDLE_SQL_DELIMITER');
const stamp = args.get('stamp') ?? '20261114000000';
const sql = `-- Publish immutable public content ${manifest.releaseId}. Existing releases are untouched.
INSERT INTO public.shiwei_gallery_releases(release_id,checksum,payload,published)
  VALUES('${manifest.releaseId}','${manifest.hash}',$shiwei_public_bundle$${text}$shiwei_public_bundle$::jsonb,true)
  ON CONFLICT(release_id) DO NOTHING;
NOTIFY pgrst, 'reload schema';
`;
await writeFile(join(migration, `${stamp}_shiwei_content.sql`), sql, { flag: 'wx' });

const entry = await readFile(join(fn, 'http-main.cjs'));
const entrySha = createHash('sha256').update(entry).digest('hex');
await writeFile(join(target, 'manifest.json'), JSON.stringify({
  release: name, commit: args.get('commit') ?? null, timeout: 60, compiledEntrySha256: entrySha,
  contentReleased: manifest.releaseId, contentHash: manifest.hash, contentBytes: Buffer.byteLength(text),
  prepared: true, deployed: false, environmentId: settings.CLOUDBASE_ENV_ID,
}, null, 2));
await copyFile(join(contentRoot, 'manifest.json'), join(target, 'content-manifest.json'));

console.log(JSON.stringify({ prepared: true, directory: target, release: name, content: manifest.releaseId, contentHash: manifest.hash,
  compiledEntrySha256: entrySha, migration: `${stamp}_shiwei_content.sql`, secretsPreserved: true }));
