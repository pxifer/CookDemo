import { execFileSync, spawn } from 'node:child_process';
import { createWriteStream } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { once } from 'node:events';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { sourceHashes, sourceFingerprint } from './lib/source-fingerprint';
import { reviewVerdict, type ReviewPhase } from './lib/pr-management';
import { localTestEnvironment } from './local-test-guard.mjs';

const root = resolve('.');
function git(...args: string[]) {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}
function snapshot() {
  return { head: git('rev-parse', 'HEAD'), branch: git('branch', '--show-current'),
    clean: git('status', '--porcelain=v1', '--untracked-files=all').length === 0 };
}
const [command, ...args] = process.argv.slice(2);
if (command === 'status' && !args.length) {
  const state = snapshot();
  let upstream: string | null = null, divergence: string | null = null;
  try { upstream = git('rev-parse', '--abbrev-ref', '@{upstream}'); divergence = git('rev-list', '--left-right', '--count', 'HEAD...@{upstream}'); } catch {}
  console.log(JSON.stringify({ ...state, upstream, aheadBehind: divergence,
    note: 'Local refs only; fetch and verify remote main before review or merge. No background monitoring.' }, null, 2));
} else if (command === 'check') {
  if (Number(process.versions.node.split('.')[0]) !== 24) throw Error('NODE_24_REQUIRED');
  const options: Record<string, string> = {};
  for (let i = 0; i < args.length; i += 2) {
    if (!['--phase', '--base', '--head', '--browser'].includes(args[i]) || !args[i + 1] || options[args[i]]) throw Error('INVALID_REVIEW_ARGUMENTS');
    options[args[i]] = args[i + 1];
  }
  const phase = options['--phase'] as ReviewPhase;
  if (!['preflight', 'pre-merge', 'post-merge'].includes(phase)) throw Error('REVIEW_PHASE_REQUIRED');
  const before = snapshot(), expectedHead = options['--head'];
  if (!expectedHead || !/^[a-f0-9]{40}(?:[a-f0-9]{24})?$/.test(expectedHead)) throw Error('FULL_EXPECTED_HEAD_SHA_REQUIRED');
  if (before.head !== expectedHead) throw Error('EXPECTED_HEAD_MISMATCH');
  const baseRef = options['--base'];
  if (!baseRef || baseRef.startsWith('-')) throw Error('BASE_REF_REQUIRED');
  const baseSha = git('rev-parse', '--verify', `${baseRef}^{commit}`);
  let baseIsAncestor = true;
  try { git('merge-base', '--is-ancestor', baseSha, before.head); } catch { baseIsAncestor = false; }
  const browserConfigs: Record<string, string | null> = { core: null, health: 'playwright.health-chat.config.ts', registration: 'playwright.registration.config.ts', rag: 'playwright.food-guidance.config.ts' };
  const browsers = options['--browser']?.split(',') ?? [];
  if (new Set(browsers).size !== browsers.length || browsers.some(name => !(name in browserConfigs))) throw Error('INVALID_BROWSER_SUITE');
  const startedAt = new Date().toISOString();
  const out = resolve('.local-data', 'management', 'reviews', `${startedAt.replace(/[:.]/g, '-')}-${phase}-${expectedHead.slice(0, 12)}`);
  await mkdir(out, { recursive: true });
  const hashesBefore = await sourceHashes();
  const fingerprintBefore = sourceFingerprint(hashesBefore);
  const stages: { id: string; status: 'passed' | 'failed'; exitCode: number | null; log: string }[] = [];
  const allowed = phase === 'preflight' || (before.clean && baseIsAncestor && (phase !== 'post-merge' || before.branch === 'main'));
  const env = localTestEnvironment(process.env, pathToFileURL(resolve('scripts/local-test-guard.mjs')).href);
  const tsx = 'node_modules/tsx/dist/cli.mjs';
  const plan = [
    { id: 'build', args: [tsx, 'scripts/generate-validation.ts'] },
    { id: 'types', args: ['node_modules/typescript/bin/tsc', '--noEmit'] },
    { id: 'acceptance-types', args: ['node_modules/typescript/bin/tsc', '--noEmit', '-p', 'tsconfig.acceptance.json'] },
    { id: 'web-build', args: ['node_modules/vite/bin/vite.js', 'build'] },
    { id: 'unit', args: [tsx, 'scripts/run-local-tests.ts', 'unit'] },
    ...browsers.map(name => ({ id: `browser-${name}`, args: [tsx, 'scripts/run-local-tests.ts', name === 'core' ? 'browser' : `browser-${name === 'rag' ? 'food-guidance' : name}`] })),
  ];
  if (allowed) for (const stage of plan) {
    console.log(`REVIEW ${stage.id} ...`);
    const log = `${stage.id}.txt`, stream = createWriteStream(join(out, log), { flags: 'wx' });
    const exitCode = await new Promise<number | null>(done => {
      const child = spawn(process.execPath, stage.args, { cwd: root, env, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
      child.stdout.pipe(stream, { end: false }); child.stderr.pipe(stream, { end: false });
      child.on('error', () => done(null)); child.on('close', done);
    });
    stream.end(); await once(stream, 'finish');
    stages.push({ id: stage.id, status: exitCode === 0 ? 'passed' : 'failed', exitCode, log });
    console.log(`REVIEW ${stage.id}: ${stages.at(-1)!.status}`);
    if (exitCode !== 0) break;
  }
  const after = snapshot(), fingerprintAfter = sourceFingerprint(await sourceHashes());
  const result = reviewVerdict({ phase, expectedHead, actualHead: after.head, branch: after.branch,
    cleanBefore: before.clean, cleanAfter: after.clean, sourceStable: fingerprintBefore === fingerprintAfter, baseIsAncestor, stages });
  const report = { schemaVersion: 1, phase, result, startedAt, finishedAt: new Date().toISOString(),
    expectedHead, baseRef, baseSha, before, after, baseIsAncestor, fingerprintBefore, fingerprintAfter, stages,
    selectedBrowsers: browsers, boundary: 'Local synthetic tests only. Manual diff review, selected integration evidence and remote SHA verification are separate merge requirements. This report neither approves nor merges a PR.' };
  await writeFile(join(out, 'report.json'), JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
  console.log(`REVIEW ${result}: ${join(out, 'report.json')}`);
  process.exitCode = result === 'passed' ? 0 : result === 'failed' ? 1 : 2;
} else {
  throw Error('USAGE: pr-check.ts status | check --phase preflight|pre-merge|post-merge --base <ref> --head <full-sha> [--browser core,health,registration,rag]');
}
