/**
 * Message lookup for the single active locale.
 *
 * `locale` is a build-time constant (NEXT_PUBLIC_LOCALE), so this module has
 * no hooks, no context and no 'use client' — it works identically in server
 * components, client components and server actions.
 *
 *   t('home.welcome', { name: user.fullName })   // "خوش آمدید، سارا"
 *   tp('ui.itemCount', 3)                        // "۳ مورد" / "3 items"
 *
 * Keys come from the dictionary in `src/messages`; `{param}` names are
 * inferred from the text, so a missing or misspelled param is a type error.
 * A key that is somehow missing at runtime renders as the key itself (with a
 * console warning outside production) rather than breaking the page.
 */
import { messages } from '@/messages';
import { intlTag, locale } from '@/lib/locale';

type Dictionary = typeof messages;

/** Every message key. */
export type MessageKey = keyof Dictionary;

/** Base of a `<base>.one` / `<base>.other` plural pair. */
export type PluralKey = PluralBaseOf<MessageKey>;

type PluralBaseOf<K> = K extends `${infer Base}.one`
  ? `${Base}.other` extends MessageKey
    ? Base
    : never
  : never;

/** `'a {x} b {y}'` → `'x' | 'y'` */
type ParamNames<S extends string> = S extends `${string}{${infer Name}}${infer Rest}`
  ? Name | ParamNames<Rest>
  : never;

type ParamValue = string | number;

type ParamsOf<K extends MessageKey> = ParamNames<Dictionary[K]>;

/** No params → no second argument allowed; otherwise it is required. */
type ParamsArg<Names extends string> = [Names] extends [never]
  ? []
  : [params: Record<Names, ParamValue>];

type PluralParamsOf<B extends PluralKey> = Exclude<
  ParamsOf<`${B}.one`> | ParamsOf<`${B}.other`>,
  'count'
>;

const pluralRules = new Intl.PluralRules(locale.tag);

/** Numbers are rendered in the locale's numbering system (۱۲۳ for fa). */
const numberFormat = new Intl.NumberFormat(intlTag(), { useGrouping: false });

function lookup(key: string): string {
  const value = (messages as Record<string, string | undefined>)[key];
  if (value !== undefined) return value;
  if (process.env.NODE_ENV !== 'production') {
    console.warn(`[t] missing message key "${key}"`);
  }
  return key;
}

function interpolate(template: string, params?: Record<string, ParamValue>): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) => {
    const value = params[name];
    if (value === undefined) return match;
    return typeof value === 'number' ? numberFormat.format(value) : value;
  });
}

/**
 * Translate a message key, filling `{name}` placeholders from `params`.
 */
export function t<K extends MessageKey>(key: K, ...args: ParamsArg<ParamsOf<K>>): string {
  const params: Record<string, ParamValue> | undefined = args[0];
  return interpolate(lookup(key), params);
}

/**
 * Translate a plural pair (`<base>.one` / `<base>.other`) for `count`.
 * The form is chosen with `Intl.PluralRules` for the active locale; `count` is
 * also injected as `{count}`.
 */
export function tp<B extends PluralKey>(
  base: B,
  count: number,
  ...args: ParamsArg<PluralParamsOf<B>>
): string {
  const form = pluralRules.select(count) === 'one' ? 'one' : 'other';
  const key = `${base}.${form}` as MessageKey;
  const params: Record<string, ParamValue> = { ...args[0], count };
  return interpolate(lookup(key), params);
}
