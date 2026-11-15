import type { Category, Meal, RecommendationResult } from '../../shared/types';
import type { DishCounts } from '../../shared/meal-planning';

export const shortfallLabels: Record<Category, string> = { meat: '荤菜', veg: '素菜', soup: '汤' };
const targetLabels: Record<Category, string> = { meat: '荤', veg: '素', soup: '汤' };
const categoryOrder: Category[] = ['meat', 'veg', 'soup'];

/** Options for one 荤/素/汤 select: never let the three totals exceed 20. */
export function countOptions(counts: DishCounts, category: Category): number[] {
  const others = categoryOrder
    .filter(key => key !== category)
    .reduce((sum, key) => sum + counts[key], 0);
  return Array.from({ length: Math.max(0, 20 - others) + 1 }, (_, index) => index);
}

export function shortfallText(shortfall: DishCounts | undefined): string {
  if (!shortfall) return '';
  const parts = categoryOrder.filter(key => shortfall[key] > 0).map(key => `${shortfallLabels[key]} ${shortfall[key]} 道`);
  return parts.length ? `还缺：${parts.join(' · ')}` : '';
}

export function resultHeadline(
  meal: Pick<Meal, 'composition' | 'counts'>,
  result: Pick<RecommendationResult, 'status' | 'dishes' | 'targetMet'>,
): string {
  if (result.status === 'needs_confirmation') return '还有信息需要核对';
  if (result.status === 'no_results') return '暂时没有合适的搭配';
  if (result.status !== 'completed') return '本次推荐未完成';
  if (meal.composition === 'custom' && result.targetMet) return '已按目标配齐';
  return `为你找到 ${result.dishes.length} 道`;
}

/** Result subtitle: state, not implementation detail. Zero categories are omitted. */
export function modeSummary(meal: Pick<Meal, 'composition' | 'counts'>, total?: number): string {
  if (meal.composition === 'custom') {
    const parts = categoryOrder.filter(key => meal.counts[key] > 0).map(key => `${meal.counts[key]} ${targetLabels[key]}`);
    return parts.length ? `目标 ${parts.join(' · ')}` : '未设置数量';
  }
  return total === undefined ? '按现有食材匹配菜谱' : `按食材匹配 · 共 ${total} 道`;
}
