import type { Category, Meal, RecommendationResult } from '../../shared/types';
import type { DishCounts } from '../../shared/meal-planning';

export const shortfallLabels: Record<Category, string> = { meat: '荤菜', veg: '素菜', soup: '汤' };

/** Options for one 荤/素/汤 select: never let the three totals exceed 20. */
export function countOptions(counts: DishCounts, category: Category): number[] {
  const others = (['meat', 'veg', 'soup'] as const)
    .filter(key => key !== category)
    .reduce((sum, key) => sum + counts[key], 0);
  return Array.from({ length: Math.max(0, 20 - others) + 1 }, (_, index) => index);
}

export function shortfallText(shortfall: DishCounts | undefined): string {
  if (!shortfall) return '';
  const total = shortfall.meat + shortfall.veg + shortfall.soup;
  if (total === 0) return '';
  return `还缺：荤菜 ${shortfall.meat} 道 · 素菜 ${shortfall.veg} 道 · 汤 ${shortfall.soup} 道`;
}

export function resultHeadline(
  meal: Pick<Meal, 'composition' | 'counts'>,
  result: Pick<RecommendationResult, 'status' | 'dishes' | 'targetMet'>,
): string {
  if (result.status === 'needs_confirmation') return '还有信息需要核对';
  if (result.status === 'no_results') return '暂时没有合适的搭配';
  if (result.status !== 'completed') return '本次推荐未完成';
  if (meal.composition === 'custom' && result.targetMet) {
    return `已按 ${meal.counts.meat} 荤 ${meal.counts.veg} 素 ${meal.counts.soup} 汤配齐`;
  }
  return `为你找到 ${result.dishes.length} 道`;
}

/** Result subtitle: state, not implementation detail. */
export function modeSummary(meal: Pick<Meal, 'composition' | 'counts'>, total?: number): string {
  if (meal.composition === 'custom') {
    return `目标 ${meal.counts.meat} 荤 · ${meal.counts.veg} 素 · ${meal.counts.soup} 汤`;
  }
  return total === undefined ? '按现有食材匹配菜谱' : `按食材匹配 · 共 ${total} 道`;
}
