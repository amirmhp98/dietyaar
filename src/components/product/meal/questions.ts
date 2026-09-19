import { normalizeDigits } from '@/lib/text/normalize';
import { UNITS, unitByKey } from '@/lib/units';
import type { DraftFoodItem } from '@/lib/validations/meal';

/**
 * Turn a chosen quick answer into a quantity (improvement plan B2): "2 slices"
 * or "a medium bowl" become a number and a unit-table key so the totals move
 * before the refine call returns. Anything not clearly a count of a known
 * unit is `null` and left to the model.
 */

const NUMBER_WORDS: Record<string, number> = {
  a: 1,
  an: 1,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  half: 0.5,
  quarter: 0.25,
};

const SIZE_WORDS = ['small', 'medium', 'large', 'big', 'little'];

/** Unit phrases beyond the table's own keys and labels. */
const ALIASES: Record<string, string> = {
  gram: 'g',
  grams: 'g',
  gr: 'g',
  millilitre: 'ml',
  milliliter: 'ml',
  millilitres: 'ml',
  milliliters: 'ml',
  tablespoon: 'tbsp',
  tablespoons: 'tbsp',
  tbsps: 'tbsp',
  teaspoon: 'tsp',
  teaspoons: 'tsp',
  tsps: 'tsp',
};

function singularForms(word: string): string[] {
  const forms = [word];
  if (word.endsWith('es')) forms.push(word.slice(0, -2));
  if (word.endsWith('s')) forms.push(word.slice(0, -1));
  return forms;
}

/** A unit-table key for a phrase such as "bowls", "slice of sangak" or "tbsp", or null. */
function unitKeyFor(phrase: string, item: DraftFoodItem): string | null {
  const words = phrase.split(' ');
  const head = words[0] ?? '';
  const candidates = [phrase, ...singularForms(head).map((h) => [h, ...words.slice(1)].join(' '))];
  for (const candidate of candidates) {
    const alias = ALIASES[candidate];
    if (alias && unitByKey(alias)) return alias;
    const unit = UNITS.find((u) => u.key === candidate || u.label.toLowerCase() === candidate);
    if (unit) return unit.key;
  }
  // "slices" alone means the item's own slice unit; without one the bread is unknown.
  if (singularForms(head).includes('slice') && words.length === 1) {
    return item.unit?.startsWith('slice_') ? item.unit : null;
  }
  return null;
}

export function quantityFromChoice(
  choice: string,
  item: DraftFoodItem,
): { quantity: number; unit: string } | null {
  const text = normalizeDigits(choice)
    .toLowerCase()
    .replace(/[,،]/g, '.')
    .replace(/\s+/g, ' ')
    .trim();
  const match =
    /^(?:about |around |roughly )?(\d+(?:\.\d+)?|a half|a quarter|[a-z]+)(?: of)?(?: an?)? (.+)$/.exec(
      text,
    );
  if (!match) return null;
  const [, amount, rest] = match;
  const quantity = /^\d/.test(amount) ? Number(amount) : NUMBER_WORDS[amount.replace(/^a /, '')];
  if (quantity === undefined || !Number.isFinite(quantity) || quantity <= 0) return null;
  const words = rest.split(' ').filter((w) => !SIZE_WORDS.includes(w));
  if (words.length === 0) return null;
  const unit = unitKeyFor(words.join(' '), item);
  return unit ? { quantity, unit } : null;
}
