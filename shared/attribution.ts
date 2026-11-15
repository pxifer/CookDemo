/** The public signature is one name.
 *
 * Source records keep the full provenance in `author` ("小鹿yoyo｜标题王刚版",
 * "好豆菜谱（MIRecipe公开存档）", "夏叔厨房／B站原视频简介"). The part after the first
 * separator or bracket is an annotation about the source, not the source's name, so the
 * public label keeps only what comes before it. `《》` stays: it is part of a programme name.
 * The stored author is never rewritten.
 */
const annotation = /[｜|／/（(【\[]/;
const trailingNoise = /[\s·•—–\-,，:：]+$/;

export function publicAttributionLabel(author: string): string {
  const trimmed = author.trim();
  const opened = trimmed
    .replace(/\s*[·•]?\s*公开配方资料[；;]\s*保留原始出处\s*$/, '')
    .split(annotation)[0]!
    .replace(trailingNoise, '')
    .trim();
  if (opened) return opened;
  // The annotation came first ("｜注明…"): fall back to the raw name without its separator.
  const fallback = trimmed.replace(/^[｜|／/（(【\[\s]+/, '').replace(trailingNoise, '').trim();
  return fallback || trimmed;
}
