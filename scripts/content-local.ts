import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { open, readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { connectDatabase, migrate } from '../backend/src/db';
import { ContentRepository } from '../backend/src/content-repository';
import { BUSINESS_RELEASE, businessFixture } from '../tests/content-fixture';
import { UI_RELEASE, localUiContent } from './lib/local-ui-content';
import { REVIEWED_RELEASE, reviewedContent } from './lib/reviewed-content';

// Local content workflow; reviewed-community is an explicit release. No cloud/arbitrary database target.
async function main() {
  const action = process.argv[2] ?? 'prepare';
  const release = process.argv.find(a => a.startsWith('--release='))?.slice(10) ?? BUSINESS_RELEASE;
  const fixture = async () => release === REVIEWED_RELEASE ? reviewedContent(release) : release === UI_RELEASE ? localUiContent(release) : businessFixture(release);
  if (!['prepare','import','publish','withdraw','inspect'].includes(action) || !/^local-business-[a-z0-9-]{1,60}$/.test(release)) throw new Error('LOCAL_CONTENT_ARGUMENT_INVALID');
  const base = new URL((await readFile('.local-data/deployment/db-owner-url','utf8')).trim());
  if (base.hostname !== '127.0.0.1' || base.port !== '5432' || base.username !== 'shiwei_owner') throw new Error('LOCAL_CONTENT_TARGET_REJECTED');
  const target = 'shiwei_business_local'; base.pathname = `/${target}`;
  const docker = [process.env.DOCKER_EXE,join(process.env.LOCALAPPDATA ?? '','Programs/DockerDesktop/resources/bin/docker.exe'),
    'C:/Program Files/Docker/Docker/resources/bin/docker.exe'].find(p => p && existsSync(p));
  if (!docker) throw new Error('LOCAL_CONTENT_DOCKER_UNAVAILABLE');
  function run(args: string[]) {
    const result = spawnSync(docker!,args,{encoding:'utf8',timeout:30000,windowsHide:true});
    if (result.status !== 0) throw new Error('LOCAL_CONTENT_DOCKER_FAILED'); return result.stdout.trim();
  }
  const context = run(['context','show']);
  if (!/^(npipe|unix):\/\//.test(run(['context','inspect',context,'--format','{{.Endpoints.docker.Host}}'])) ||
    run(['inspect','shiwei-local-db-1','--format','{{index .Config.Labels "com.docker.compose.project"}}']) !== 'shiwei-local') throw new Error('LOCAL_CONTENT_DOCKER_TARGET_REJECTED');
  if (action === 'prepare') {
    const exists = run(['exec','shiwei-local-db-1','psql','-X','-U','postgres','-d','postgres','-A','-t','-c',`SELECT 1 FROM pg_database WHERE datname='${target}'`]);
    if (!exists) run(['exec','shiwei-local-db-1','createdb','-U','postgres','-O','shiwei_owner','-T','template0',target]);
  }
  const db = await connectDatabase(base.toString(),{max:2});
  try {
    const repo = new ContentRepository(db);
    if (action === 'prepare') {
      await migrate(db); // Reuses unchanged 001/002 in the isolated fixture DB, no new migration.
      const installed = (await db.query('SELECT 1 FROM catalog_releases WHERE id=$1',[release])).rows.length;
      if (!installed) await repo.importDraft(await fixture());
      await repo.publish(release);
      await db.exec('GRANT USAGE ON SCHEMA public TO shiwei_app; GRANT SELECT ON ALL TABLES IN SCHEMA public TO shiwei_app;');
      const appUrl = new URL((await readFile('.local-data/deployment/db-app-url','utf8')).trim());
      if (appUrl.hostname !== '127.0.0.1' || appUrl.username !== 'shiwei_app') throw new Error('LOCAL_CONTENT_APP_TARGET_REJECTED');
      appUrl.pathname = `/${target}`;
      async function keep(name: string, value: string) {
        try { const file = await open(resolve('.local-data/deployment',name),'wx',0o600); try { await file.writeFile(value); } finally { await file.close(); } }
        catch (error) { if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error; }
      }
      await keep('business-app-url',appUrl.toString());
      await keep('business-local.env',`APP_ENV=local\nHOST=127.0.0.1\nPORT=4180\nAPP_ORIGIN=http://127.0.0.1:4180\nCONTENT_SOURCE=database\nCONTENT_RELEASE_ID=${BUSINESS_RELEASE}\nLOCAL_TEST_FEATURES=0\nDATABASE_URL_FILE=.local-data/deployment/business-app-url\nSESSION_SECRET_B64_FILE=.local-data/deployment/session-secret\nCSRF_SECRET_B64_FILE=.local-data/deployment/csrf-secret\n`);
    } else if (action === 'import') await repo.importDraft(await fixture());
    else if (action === 'publish') await repo.publish(release);
    else if (action === 'withdraw') { await repo.withdraw(release); console.log(JSON.stringify({database:target,release,state:'withdrawn'})); return; }
    const state = (await db.query<{state:string}>('SELECT state FROM catalog_releases WHERE id=$1',[release])).rows[0]?.state;
    const snapshot = state === 'published' ? await repo.load(release) : undefined;
    console.log(JSON.stringify({database:target,release,state,foods:snapshot?.foods.length,recipes:snapshot?.recipes.length,
      variants:snapshot?.recipes.reduce((sum,r) => sum+r.variants.length,0),dataClass:snapshot?(snapshot.contentState==='database-reviewed'?'reviewed-community':'constructed'):'not_loaded',
      sourceAndStructureReviewed:snapshot?.contentState==='database-reviewed',professionalReview:false,modelsEnabled:false},null,2));
  } finally { await db.close(); }
}
main().catch(error => { console.error(typeof error?.code === 'string' && error.code.startsWith('CONTENT_') ? error.code : /^LOCAL_CONTENT_[A-Z_]+$/.test(error?.message) ? error.message : 'LOCAL_CONTENT_FAILED'); process.exitCode=1; });
