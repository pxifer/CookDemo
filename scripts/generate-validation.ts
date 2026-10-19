import Ajv from 'ajv';
import standaloneCode from 'ajv/dist/standalone/index.js';
import { writeFile } from 'node:fs/promises';
import { mealSchema } from '../shared/schema';
const ajv = new Ajv({ strict: false, code: { source: true, esm: true } });
ajv.addSchema({ ...mealSchema, $id: 'Meal' });
await writeFile(new URL('../src/meal-validator.js', import.meta.url), standaloneCode(ajv, { validateMeal: 'Meal' }));
