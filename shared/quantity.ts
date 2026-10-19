import { foodById } from './catalog';
import type { Ingredient, Line, Meal, QuantityCheck } from './types';

const ratios: Record<string, [string, number]> = { g: ['g', 1], 克: ['g', 1], kg: ['g', 1000], 千克: ['g', 1000], 公斤: ['g', 1000], 斤: ['g', 500], 个: ['个', 1], ml: ['ml', 1], 毫升: ['ml', 1], l: ['ml', 1000], 升: ['ml', 1000] };
// Millibase integers avoid binary floating-point subtraction (0.3 - 0.1).
export const milli = (n: number) => Math.round(n * 1000);
export const decimal = (n: number) => n / 1000;
export function parseQuantity(raw: string): { amount: number; unit: string } | null {
  const m = raw.trim().match(/^(\d+(?:\.\d{1,3})?)\s*(kg|g|ml|l|千克|公斤|克|斤|个|毫升|升)$/i);
  if (!m) return null;
  const [unit, ratio] = ratios[m[2].toLowerCase()];
  const n = Number(m[1]);
  return Number.isFinite(n) && n > 0 && n <= 1_000_000 ? { amount: decimal(Math.round(n * ratio * 1000)), unit } : null;
}
export function quantityCheck(line: Line, amount: number, item?: Ingredient): QuantityCheck {
  const f = foodById.get(line.foodId)!;
  const base = { foodId: f.id, name: f.name, needed: amount, unit: line.unit, basis: line.basis };
  if (!item) return { ...base, state: 'missing', available: 0, shortage: amount, reason: '清单中没有此食材' };
  const parsed = parseQuantity(item.amount);
  let reason = '';
  if (!parsed) reason = '未填写精确用量或单位，数量未核实';
  else if (parsed.unit !== line.unit) reason = '单位无法比较，数量未核实';
  else if (item.form !== line.form) reason = '生熟或形态不一致，数量未核实';
  else if (item.basis === 'unknown' || item.basis !== line.basis) reason = '毛重与可食净量基准未匹配，数量未核实';
  if (reason) return { ...base, state: 'unverified', available: parsed?.amount ?? null, shortage: null, reason };
  const gap = decimal(Math.max(0, milli(amount) - milli(parsed!.amount)));
  return { ...base, state: gap > 0 ? 'shortage' : 'enough', available: parsed!.amount, shortage: gap, reason: gap > 0 ? '已知库存不足，差额按可食净量计算' : '相同形态、相同计量基准下足量' };
}
export function inventoryChecks(lines: Line[], servingsFactor: number, meal: Meal): QuantityCheck[] {
  const sums = new Map<string, { line: Line; amount: number }>();
  for (const l of lines) {
    if (l.role === 'seasoning') {
      if (!meal.checkSeasonings || meal.seasonings.includes(l.foodId) || l.optional) continue;
      sums.set(l.foodId, { line: l, amount: 0 });
      continue;
    }
    const old = sums.get(l.foodId);
    if (old && (old.line.unit !== l.unit || old.line.basis !== l.basis || old.line.form !== l.form)) {
      // A content contract failure must never be interpreted as sufficient stock.
      throw new Error('Inconsistent recipe quantity basis');
    }
    sums.set(l.foodId, { line: l, amount: (old?.amount ?? 0) + milli(l.amount * servingsFactor) });
  }
  return [...sums.values()].map(({ line, amount }) => line.role === 'seasoning'
    ? { foodId: line.foodId, name: foodById.get(line.foodId)!.name, needed: 0, available: null, shortage: null, unit: '有无', basis: line.basis, state: 'missing', reason: '缺少必需调味料' }
    : quantityCheck(line, decimal(amount), meal.ingredients.find(i => i.foodId === line.foodId && i.status === 'confirmed')));
}
export function nutrition(lines: Line[], factor: number) {
  const result = { kcal: null, protein: null, sodium: null } as Record<'kcal' | 'protein' | 'sodium', number | null>;
  for (const key of ['kcal', 'protein', 'sodium'] as const) {
    let sum = 0, complete = true;
    for (const l of lines) {
      const f = foodById.get(l.foodId)!;
      const grams = l.unit === 'g' ? l.amount : l.edibleGrams;
      const n = f.nutrition[key];
      if (grams === undefined || n === undefined || l.basis !== 'edible') { complete = false; break; }
      sum += grams * factor * n / 100;
    }
    if (complete) result[key] = Math.round(sum * 100) / 100;
  }
  return result;
}
