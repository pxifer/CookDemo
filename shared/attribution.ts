/** The public signature is one name.
 *
 * Source records keep the full provenance in `author` ("小鹿yoyo｜标题王刚版",
 * "好豆菜谱（MIRecipe公开存档）", "夏叔厨房／B站原视频简介"). Two names side by side read
 * badly, so the public label keeps only the first one. `《》` is not a separator: it is
 * part of a programme name ("央视网《天天饮食》"). The stored author is never rewritten.
 *
 * A generic prefix ("账号名：…") is not a name, so it is skipped rather than displayed.
 */
const separator = /[｜|／/：:（(【\[\]、·•]/;
const genericPrefix = /^(?:账号名|作者|来源|出处|署名|UP主|up主)$/;
const trailingNoise = /[\s·•—–\-,，:：]+$/;

export function publicAttributionLabel(author: string): string {
  const trimmed = author.trim();
  const segments = trimmed
    .replace(/\s*[·•]?\s*公开配方资料[；;]\s*保留原始出处\s*$/, '')
    .split(separator)
    .map(part => part.replace(trailingNoise, '').trim())
    .filter(Boolean);
  const named = segments.find(part => !genericPrefix.test(part));
  return named ?? segments[0] ?? '';
}
