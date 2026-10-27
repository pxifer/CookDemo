import completion from '../docs/data/recipe-image-completion-2026-10-25.json';
import additions from '../docs/data/recipe-image-additions-2026-10-27.json';

// Versioned presentation assets are independent of immutable ingredient releases.
const images = new Map([...completion, ...additions].map(item => [item.dish, item.image]));
export const RECIPE_IMAGE_VERSION = '20261027-all-341-v2';
export function recipeImage(name: string, current?: string | null): string | undefined {
  return images.get(name) ?? current ?? undefined;
}
