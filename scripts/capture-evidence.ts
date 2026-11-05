import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createApp } from '../backend/src/app';
const root = new URL('..', import.meta.url);
async function files(folder: string): Promise<string[]> {
  const entries = await readdir(new URL(folder, root), { withFileTypes: true });
  const nested = await Promise.all(entries.map(e => e.isDirectory() ? files(`${folder}${e.name}/`) : [`${folder}${e.name}`]));
  return nested.flat();
}
const paths = ['package.json', 'package-lock.json', 'tsconfig.json', 'vite.config.ts', 'playwright.config.ts', 'docs/product/PRD.md',
  'Dockerfile', '.dockerignore', '.gitattributes', '.env.example', 'docs/README.md', 'docs/development/README.md',
  'docs/architecture/overview.md', 'docs/operations/DEPLOYMENT-RUNBOOK.md', 'docs/operations/DEPLOYMENT-CLOUDBASE-HTTP.md', 'agent-design/generation/health-model-api.md',
  'playwright.business.config.ts',
  ...await files('deployment/'), ...await files('deployment/cloudbase/migrations/'), ...await files('datasets/'), ...await files('frontend/src/'), ...await files('shared/'), ...await files('backend/src/'), ...await files('tests/'), ...await files('scripts/'), ...['index.html', 'styles.css', 'data.js', 'engine.js', 'app.js'].map(f => `legacy/prototype/${f}`)];
const hashes: Record<string, string> = {};
for (const path of paths.sort()) hashes[path] = createHash('sha256').update(await readFile(new URL(path, root))).digest('hex');
const evidenceRoot = new URL(`${process.env.ACCEPTANCE_DIR ?? 'artifacts/acceptance'}/`, root);
await mkdir(evidenceRoot, { recursive: true });
await writeFile(new URL('source-manifest.json', evidenceRoot), JSON.stringify({ capturedAt: new Date().toISOString(), runtime: process.version, hashes }, null, 2));
const app = await createApp();
try { await app.ready(); await writeFile(new URL('openapi.json', evidenceRoot), JSON.stringify(app.swagger(), null, 2)); }
finally { await app.close(); }
console.log(`Captured ${paths.length} source hashes and OpenAPI snapshot (no personal data).`);
