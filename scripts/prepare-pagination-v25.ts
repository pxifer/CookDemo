import { readFile, mkdir, copyFile, cp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { build } from 'esbuild';

const revision = 'v25';
const source = '.local-data/cloudbase-http/release-20261025-pagination-v24';
const destination = `.local-data/cloudbase-http/release-20261025-pagination-${revision}`;

async function main() {
  await mkdir(destination, { recursive: false });
  const config = JSON.parse(await readFile(join(source, 'cloudbaserc.json'), 'utf8'));
  const env = config.functions?.[0]?.envVariables;
  if (config.envId !== 'shiwei-d2gmiun66b7dc6a4f' || config.functions.length !== 1
    || config.functions[0].name !== 'shiwei-http-preview' || env?.CONTENT_BUNDLE_ID !== 'gallery-preview-20261023'
    || !env?.COMPOSITION_RELEASE_ID || !env?.CLOUDBASE_PUBLISHABLE_KEY || !env?.SESSION_SECRET_B64
    || !env?.CSRF_SECRET_B64 || !env?.PROFILE_ENCRYPTION_KEY_B64 || env?.ACCOUNT_SYNC_ENABLED !== '1') throw new Error('PREVIOUS_RELEASE_CONFIGURATION');
  const fn = join(destination, 'function');
  await mkdir(fn);
  await build({ entryPoints: ['deployment/cloudbase/http-main.ts'], outfile: join(fn, 'http-main.cjs'), bundle: true, platform: 'node', target: 'node24', format: 'cjs', packages: 'external' });
  for (const name of ['package.json', 'package-lock.json', 'scf_bootstrap', 'index.js']) await copyFile(join(source, 'function', name), join(fn, name));
  await cp(join(source, 'function/node_modules'), join(fn, 'node_modules'), { recursive: true });
  await mkdir(join(fn, 'build'));
  await cp('artifacts/build/web', join(fn, 'build/web'), { recursive: true });
  await rm(join(fn, 'build/web/assets/recipes'), { recursive: true, force: true });
  await writeFile(join(destination, 'cloudbaserc.json'), JSON.stringify(config, null, 2), { flag: 'wx', mode: 0o600 });
  console.log(JSON.stringify({ prepared: true, functionName: config.functions[0].name, revision, existingKeysAndReleasesPreserved: true, secretsPrinted: false }));
}

main().catch(() => { console.error('PAGINATION_V25_PREPARE_FAILED'); process.exitCode = 1; });

