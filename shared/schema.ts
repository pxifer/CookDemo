const string = (maxLength = 200) => ({ type: 'string', maxLength });
const enumOf = (...values: string[]) => ({ type: 'string', enum: values });
const array = (items: object, maxItems = 100) => ({ type: 'array', items, maxItems });
const object = (properties: Record<string, object>, optional: string[] = []) => ({ type: 'object', properties, required: Object.keys(properties).filter(k => !optional.includes(k)), additionalProperties: false });
const integer = (minimum: number, maximum: number) => ({ type: 'integer', minimum, maximum });
const boolean = { type: 'boolean' };
export const ingredientSchema = object({
  id: string(80), foodId: { anyOf: [string(80), { type: 'null' }] }, name: string(100), amount: string(100),
  basis: enumOf('edible', 'as_purchased', 'unknown'), form: enumOf('raw', 'cooked', 'bone_in', 'skin_on', 'unspecified'),
  status: enumOf('pending', 'confirmed', 'conflict'), alternative: string(200), original: string(1000),
  quantityUnit: enumOf('g', 'kg', '斤', '个', 'ml', 'l', '把', '根', '块'),
}, ['alternative', 'quantityUnit']);
export const restrictionSchema = object({
  id: string(80), kind: enumOf('allergy', 'avoid', 'unclassified'), name: string(200), targets: array(string(80), 50),
  status: enumOf('pending', 'confirmed', 'unknown', 'conflict'), scope: enumOf('self', 'additional'), original: string(1000),
});
export const mealSchema = object({
  version: integer(0, 2_147_483_647), raw: string(5000), ingredients: array(ingredientSchema), restrictions: array(restrictionSchema, 50),
  servings: integer(1, 12), mode: enumOf('meal', 'candidates'), health: boolean, diseases: array(string(100), 20),
  flavor: { type: 'string', minLength: 1, maxLength: 100 }, overrides: { type: 'object', maxProperties: 100, additionalProperties: string(100), propertyNames: { pattern: '^[a-z0-9-]+$' } },
  includeAdditional: boolean, checkSeasonings: boolean, seasonings: array(string(80), 50), allowBuy: boolean,
  composition: enumOf('auto', 'custom'), counts: object({ meat: integer(0, 20), veg: integer(0, 20), soup: integer(0, 20) }),
  aiFoodChoices: object({preferred:array({...string(40),minLength:1},20),limited:array({...string(40),minLength:1},20),excluded:array({...string(40),minLength:1},20)}),
  aiExcludedFoods: array({...string(40),minLength:1},20),
}, ['aiFoodChoices','aiExcludedFoods']);
export const selectedSchema = array(object({ recipeId: string(80), variantId: string(100) }), 20);
export const personalSettingsSchema = object({flavor:mealSchema.properties.flavor,restrictions:array(restrictionSchema,50),checkSeasonings:boolean,seasonings:array(string(80),50),aiExcludedFoods:array({...string(40),minLength:1},20)},['aiExcludedFoods']);
export const recommendationSchema = object({
  operationId: { type: 'string', minLength: 8, maxLength: 80, pattern: '^[a-zA-Z0-9-]+$' }, meal: mealSchema,
  action: enumOf('generate', 'reroll', 'replace', 'page', 'variant'), selected: selectedSchema, replaceId: string(80),
  page: integer(0, 10000), cursor: string(100), previous: array(string(80), 20), contentVersion: string(100),
}, ['replaceId', 'cursor', 'contentVersion']);
export const extractionSchema = object({ text: { type: 'string', minLength: 1, maxLength: 5000 }, contentVersion: string(100) }, ['contentVersion']);
