import { DEFAULTS } from './defaults.ts';
import type { Breakpoint, DeckContext, Responsive, ResponsiveValue, SizePresetName } from './types.ts';

/**
 * Regra única de resolução de valores responsivos (M9): usada pelo resolve (props das
 * primitivas) e por ctx.pick (código do autor). Fica em core para a precedência existir
 * num lugar só.
 */

/** O que a regra precisa de ctx (sem o próprio pick, para createContext poder montá-lo). */
export type ResponsiveContext = Pick<DeckContext, 'name' | 'aspect' | 'scale'>;

const PRESET_NAMES: readonly SizePresetName[] = ['16x9', '16x10', '4x3', 'wide'];

/** Chave que a engine reconhece como breakpoint (nome fixo, preset ou 'custom-<w>x<h>'). */
export const isBreakpointName = (key: string): key is Breakpoint =>
  key === 'tall' || key === 'wide' || (PRESET_NAMES as readonly string[]).includes(key) || key.startsWith('custom-');

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** Responsivo se e só se é um objeto com a chave `base` (padding/background não têm). */
export const isResponsive = <T>(value: Responsive<T>): value is ResponsiveValue<T> =>
  isRecord(value) && Object.hasOwn(value, 'base');

/**
 * Objeto que parece responsivo mas está malformado (JS sem tipos): só chaves de breakpoint e
 * sem `base`, ou com `base` e alguma chave que não é breakpoint. O resolve transforma em ResolveError.
 */
export const responsiveProblemOf = (value: unknown): string | undefined => {
  if (!isRecord(value)) return undefined;
  const keys = Object.keys(value);
  if (keys.length === 0) return undefined;
  const unknown = keys.filter((key) => key !== 'base' && !isBreakpointName(key));
  if (Object.hasOwn(value, 'base')) {
    return unknown.length === 0 ? undefined : `breakpoint desconhecido: ${unknown.map((k) => `"${k}"`).join(', ')}`;
  }
  return unknown.length === 0 ? 'objeto responsivo sem a chave "base"' : undefined;
};

/** Breakpoints ativos para um contexto, em ordem de precedência (o primeiro presente no objeto vence). */
export const activeBreakpointsOf = (ctx: ResponsiveContext): readonly Breakpoint[] => [
  ctx.name as Breakpoint,
  ...(ctx.scale > DEFAULTS.breakpoints.wideScale ? (['wide'] as const) : []),
  ...(ctx.aspect < DEFAULTS.breakpoints.tallAspect ? (['tall'] as const) : []),
];

/** Resolve um Responsive<T> para o contexto: nome exato do tamanho > wide > tall > base. */
export const pickResponsive = <T>(value: Responsive<T>, ctx: ResponsiveContext): T => {
  if (!isResponsive(value)) return value;
  const key = activeBreakpointsOf(ctx).find((name) => value[name] !== undefined);
  return key === undefined ? value.base : (value[key] as T);
};
