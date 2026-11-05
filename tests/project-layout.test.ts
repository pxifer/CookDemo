import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { build } from 'esbuild';
import { createApp } from '../backend/src/app';

test('云函数新入口可离线打包，运行JSON进入包且静态根目录仍使用发布包布局', async () => {
  const result = await build({
    entryPoints: ['deployment/cloudbase/http-main.ts'], bundle: true, write: false,
    platform: 'node', target: 'node24', format: 'cjs', packages: 'external',
    metafile: true, logLevel: 'silent',
  });
  const inputs = Object.keys(result.metafile!.inputs).map(path => path.replaceAll('\\', '/'));
  assert(inputs.includes('backend/src/app.ts'));
  for (const dependency of ['recipe-step-review-v28.json', 'recipe-image-completion-2026-10-25.json', 'legacy-composition-snapshot.json']) {
    assert(inputs.some(path => path.startsWith('datasets/') && path.endsWith(dependency)), dependency);
  }
  assert(result.outputFiles[0].text.includes('build/web'));
  const entry = await readFile('deployment/cloudbase/http-main.ts', 'utf8');
  assert.match(entry, /STATIC_ROOT\s*\?\?\s*['"]build\/web['"]/);
});

test('本地构建后首页、脚本、样式和真实图片仍通过原URL访问', async () => {
  const app = await createApp({ origin: 'http://127.0.0.1:4175', localTestFeatures: true, staticRoot: resolve('artifacts/build/web') });
  try {
    const page = await app.inject({ method: 'GET', url: '/' });
    assert.equal(page.statusCode, 200);
    const assets = [...page.body.matchAll(/(?:src|href)="(\/assets\/[^"?#]+\.(?:js|css))"/g)].map(match => match[1]);
    assert(assets.some(path => path.endsWith('.js')));
    assert(assets.some(path => path.endsWith('.css')));
    for (const url of assets) assert.equal((await app.inject({ method: 'GET', url })).statusCode, 200, url);
    const image = (await readdir('frontend/public/assets/recipes')).find(path => path.endsWith('.webp'));
    assert(image);
    const source = await readFile(`frontend/public/assets/recipes/${image}`);
    const served = await app.inject({ method: 'GET', url: `/assets/recipes/${image}` });
    assert.equal(served.statusCode, 200);
    const hash = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
    assert.equal(hash(served.rawPayload), hash(source));
  } finally {
    await app.close();
  }
});
