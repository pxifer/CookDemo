import { readFile } from 'node:fs/promises';
import catalog from '../../datasets/health/catalog.json';
import { sha256, validateKnowledgeBundle } from './health-knowledge';

/** Shared current-bundle entry: archived versions remain explicitly selectable. */
export async function readKnowledgeAssets(version: string = catalog.defaultBundle) {
  if (!/^\d{4}-\d{2}-\d{2}-v\d+$/.test(version) || !catalog.versions.includes(version)) throw Error('HEALTH_BUNDLE_VERSION_UNKNOWN');
  const base = new URL(`../../datasets/health/${version}/`, import.meta.url);
  const manifest = JSON.parse(await readFile(new URL('manifest.json', base), 'utf8'));
  if (!manifest.files || typeof manifest.files['knowledge-bundle.json'] !== 'string') throw Error('HEALTH_BUNDLE_MANIFEST_INVALID');
  for (const [file, hash] of Object.entries(manifest.files)) {
    if (!/^[\w.-]+$/.test(file) || sha256(await readFile(new URL(file, base))) !== hash) throw Error('HEALTH_BUNDLE_HASH_MISMATCH');
  }
  const bundle = validateKnowledgeBundle(JSON.parse(await readFile(new URL('knowledge-bundle.json', base), 'utf8')));
  if (bundle.id !== `health-kb-${version}` || manifest.id !== bundle.id || manifest.clinicalRelease !== null
    || ['sources','entities','evidence','facts','ruleDrafts','conflicts','recipeBindings'].some(key => manifest.counts?.[key] !== (bundle[key as keyof typeof bundle] as unknown[]).length)) throw Error('HEALTH_BUNDLE_MANIFEST_INVALID');
  return { bundle, manifest };
}
