import { constructedContent, diseaseAliases } from './catalog';
import type { ContentContext } from './content';
import type { Extraction, Ingredient, Restriction } from './types';
import { pantryInputNames, resolvePantryFood } from './ingredient-matching';

const id = () => crypto.randomUUID();
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const quantity = '(?:\\d+(?:\\.\\d+)?\\s*(?:千克|公斤|kg|毫升|ml|克|斤|g|个|升|l)?|[一二三四五六七八九十半]+(?:把|个|根|块|斤)|大约一把|一小把)';

export function makeRestriction(name: string, kind: Restriction['kind'], scope: Restriction['scope'] = 'self', context: ContentContext = constructedContent): Restriction {
  const targets = context.restrictionTargets(name);
  return { id: id(), name, kind, targets, scope, status: targets.length ? 'pending' : 'unknown', original: name };
}

// Deterministic local convenience parser, explicitly not a substitute for admitted model recognition.
// Every extracted entity remains pending. Unparsed fragments are visible and never silently dropped.
export function extractText(original: string, context: ContentContext = constructedContent): Extraction {
  const { foods, categories } = context;
  const names = [...new Set([...foods.flatMap(f => [f.name, ...f.aliases]), ...pantryInputNames(context.foodById)])].sort((a, b) => b.length - a.length);
  const restrictionNames = [...names, ...categories.flatMap(c => [c.name, ...c.aliases])].sort((a, b) => b.length - a.length);
  const namePattern = new RegExp(restrictionNames.map(escape).join('|'), 'g');
  const make = (name: string, kind: Restriction['kind']) => makeRestriction(name, kind, 'self', context);
  const result: Extraction = { original, ingredients: [], restrictions: [], diseases: [], servings: null, unresolved: [], method: 'local-dictionary' };
  const singleIngredient = (text: string): Ingredient | undefined => {
    const trailing = text.match(new RegExp(`^(.+?)\\s*(${quantity})?$`, 'i'));
    const leading = text.match(new RegExp(`^(${quantity})\\s*(.+)$`, 'i'));
    for (const candidate of [trailing && { name: trailing[1], amount: trailing[2] ?? '' }, leading && { name: leading[2], amount: leading[1] }]) {
      if (!candidate) continue;
      const food = resolvePantryFood(candidate.name, context.foodById);
      if (food) return { id: id(), name: food.name, foodId: food.id, amount: candidate.amount.trim(),
        basis: 'unknown', form: food.form, status: 'pending', original: text };
    }
    return undefined;
  };
  const joinedNames = restrictionNames.map(escape).join('|');
  const restrictionClause = new RegExp(`(?:不对|对)?(?:${joinedNames})(?:[和及与](?:${joinedNames}))*过敏|(?:不能吃|不要吃|不吃|忌口)(?:${joinedNames})|(?:${joinedNames})(?:可以吃|不过敏)`);
  const chunks = original.split(/[，,。；;\n、]/).map(s => s.trim()).filter(Boolean).flatMap(chunk => {
    const clause = chunk.match(restrictionClause);
    if (!clause || !clause.index) return [chunk];
    const before = chunk.slice(0, clause.index);
    return names.some(n => before.includes(n)) ? [before, chunk.slice(clause.index)] : [chunk];
  });
  for (let chunk of chunks) {
    const people = chunk.match(/(\d+(?:\.\d+)?)\s*个?人(?:吃|份)?/);
    if (people) { result.servings = Number(people[1]); chunk = chunk.replace(people[0], ''); }
    const diseases = Object.keys(diseaseAliases).sort((a, b) => b.length - a.length);
    for (const n of diseases) if (chunk.includes(n)) {
      result.diseases.push(diseaseAliases[n]); chunk = chunk.replaceAll(n, '');
    }
    if (/(过敏|不吃|忌口|不能吃|不要吃|可以吃|不过敏|不对)/.test(chunk)) {
      // A permission or negation cannot remove an existing hard restriction.
      if (/(不对.*过敏|不过敏|可以吃)/.test(chunk)) {
        result.restrictions.push({ ...make(chunk, 'unclassified'), status: 'conflict', original: chunk });
      } else {
        const found = [...chunk.matchAll(namePattern)];
        const kind = /过敏/.test(chunk) ? 'allergy' : 'avoid';
        if (!found.length) result.restrictions.push(make(chunk, kind));
        else {
          const rest = chunk.replace(namePattern, '').replace(/过敏|不能吃|不要吃|不吃|忌口|对|有|我|和|及|与|都|的|但|只|于|了|是|不/g, '').trim();
          for (const m of found) result.restrictions.push(make(m[0], kind));
          if (rest) result.restrictions.push(make(rest, 'unclassified'));
        }
      }
      continue;
    }
    const single = singleIngredient(chunk);
    if (single) {
      result.ingredients.push(single);
      continue;
    }
    const pattern = new RegExp(`(${names.map(escape).join('|')})\\s*(${quantity})?`, 'gi');
    let cursor = 0;
    for (const match of chunk.matchAll(pattern)) {
      const prefix = chunk.slice(cursor, match.index);
      const prefixText = prefix.replace(/^(?:(?:家里|手头|冰箱|还有|我有|有|和|及|与)\s*)+/, '').replace(/(?:还有|和|及|与)\s*$/, '').trim();
      const prefixItem = prefixText ? singleIngredient(prefixText) : undefined;
      if (prefixItem) result.ingredients.push(prefixItem);
      const f = resolvePantryFood(match[1], context.foodById)!;
      const leading = prefixItem ? null : prefix.match(new RegExp(`(${quantity})$`, 'i'));
      const amount = match[2]?.trim() ?? leading?.[1] ?? '';
      let form = f.form;
      if (/熟/.test(prefix)) form = 'cooked';
      else if (/带骨/.test(prefix)) form = 'bone_in';
      else if (/带皮/.test(prefix)) form = 'skin_on';
      result.ingredients.push({ id: id(), name: f.name, foodId: f.id, amount, basis: 'unknown', form, status: 'pending', original: match[0] });
      const unused = prefixItem ? '' : prefix.replace(leading?.[0] ?? '', '').replace(/家里|手头|冰箱|还有|有|和|及|与|一些|我|带骨|去骨|带皮|去皮|熟|的|生|净|肉/g, '').trim();
      if (unused) result.unresolved.push(unused);
      cursor = match.index! + match[0].length;
    }
    const rest = chunk.slice(cursor).replace(/还有|有|和|及|与|我|的|病|患|吃|家里|手头|冰箱/g, '').trim();
    if (rest) {
      // Unknown non-restriction text is retained as a pending ingredient by the UI.
      result.unresolved.push(rest);
    }
  }
  result.diseases = [...new Set(result.diseases)];
  result.unresolved = [...new Set(result.unresolved)].filter(fragment => {
    const item = singleIngredient(fragment);
    if (!item) return true;
    result.ingredients.push(item);
    return false;
  });
  return result;
}

export function mergeIngredients(existing: Ingredient[], incoming: Ingredient[]): Ingredient[] {
  const next = existing.map(i => ({ ...i }));
  for (const item of incoming) {
    const old = next.find(i => item.foodId ? i.foodId === item.foodId : i.name === item.name);
    if (!old) { next.push({ ...item }); continue; }
    if (old.amount !== item.amount || old.basis !== item.basis || old.form !== item.form) {
      old.alternative = `${item.amount || '用量未填'} / ${item.form} / ${item.basis}`;
      old.status = 'conflict';
    }
  }
  return next;
}
