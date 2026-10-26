import type { Recipe } from './types';

export function availableFlavors(recipes: Recipe[]): string[] {
  return [...new Set(recipes.filter(r => r.state === 'published').flatMap(r => r.variants.map(v => v.flavor)))].sort((a, b) => a.localeCompare(b, 'zh-CN'));
}
