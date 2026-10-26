import completion from '../docs/data/recipe-image-completion-2026-10-25.json';

// Versioned presentation assets are independent of immutable ingredient releases.
const images = new Map(completion.map(item => [item.dish, item.image]));
export const RECIPE_IMAGE_VERSION = '20261025-complete-v1';
export function recipeImage(name: string, current?: string | null): string | undefined {
  return images.get(name) ?? current ?? undefined;
}
