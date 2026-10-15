import { isResponsive, mapResponsive, type CssBoxPropsAuthor, type CssImagePropsAuthor, type CssShapePropsAuthor, type CssTextPropsAuthor, type Responsive } from 'pptsx';

/**
 * Variantes: escolhas nomeadas (`tone: 'positive'`, `size: 'sm'`) que viram props CSS. A escolha pode ser
 * responsiva (`size={{ base: 'md', tall: 'lg' }}`): cada prop CSS sai responsiva com os mesmos breakpoints.
 * Ordem: `base` < variantes na ordem declarada (quem chama espalha as próprias props por cima).
 *
 * Tipos (M18): `base` e cada opção são props CSS da primitiva-alvo (`for`, padrão `'box'`): nome errado ou
 * valor do tipo errado não compila; o retorno é só o que foi definido (`Pick` das props da primitiva).
 */

export type VariantTarget = 'box' | 'text' | 'image' | 'shape';

/** As props de autor (CSS) da primitiva-alvo, sem `children`. */
export type PropsFor<T extends VariantTarget> = Omit<
  T extends 'text' ? CssTextPropsAuthor : T extends 'image' ? CssImagePropsAuthor : T extends 'shape' ? CssShapePropsAuthor : CssBoxPropsAuthor,
  'children'
>;

type Props = Readonly<Record<string, unknown>>;
export type VariantDefs = Readonly<Record<string, Readonly<Record<string, Props>>>>;

/** Recusa chave que não é prop da primitiva (vira `never`, e o objeto literal não compila). */
type Exact<O, P> = { readonly [K in keyof O]: K extends keyof P ? P[K] : never };

type ValidVariants<V extends VariantDefs, P> = { readonly [N in keyof V]: { readonly [O in keyof V[N]]: Exact<V[N][O], P> } };

/** Todas as chaves definidas na base ou em alguma opção. */
type DefinedKeys<B, V extends VariantDefs> = keyof B | { [N in keyof V]: { [O in keyof V[N]]: keyof V[N][O] }[keyof V[N]] }[keyof V];

export type VariantSelection<V extends VariantDefs> = { readonly [N in keyof V]?: Responsive<keyof V[N] & string> };

export interface VariantConfig<T extends VariantTarget, B extends Props, V extends VariantDefs> {
  /** A primitiva que recebe as props (decide quais nomes CSS valem). Padrão `'box'`. */
  readonly for?: T;
  readonly base?: B & Exact<B, PropsFor<T>>;
  readonly variants: V & ValidVariants<V, PropsFor<T>>;
  readonly defaults?: { readonly [N in keyof V]?: keyof V[N] & string };
}

/** O que a função de variantes devolve: as props definidas, com o tipo da primitiva (aceita responsivo). */
export type VariantProps<T extends VariantTarget, B, V extends VariantDefs> = Pick<PropsFor<T>, Extract<DefinedKeys<B, V>, keyof PropsFor<T>>>;

const optionOf = (variants: VariantDefs, name: string, option: string): Props => {
  const props = variants[name]?.[option];
  if (props === undefined) throw new Error(`variante ${name}="${option}" não existe; use ${Object.keys(variants[name] ?? {}).join(', ')}`);
  return props;
};

const propsOfChoice = (variants: VariantDefs, name: string, choice: Responsive<string>, base: Props): Props => {
  if (!isResponsive(choice)) return optionOf(variants, name, choice as string);
  // Responsiva: cada prop que alguma opção define vira um valor responsivo; quem não define herda a base.
  const options = Object.values(choice as Readonly<Record<string, string>>).map((option) => optionOf(variants, name, option));
  const keys = [...new Set(options.flatMap((props) => Object.keys(props)))];
  return Object.fromEntries(keys.map((key) => [key, mapResponsive(choice, (option: string) => optionOf(variants, name, option)[key] ?? base[key])]));
};

export const createVariants = <const V extends VariantDefs, const B extends Props = {}, T extends VariantTarget = 'box'>(config: VariantConfig<T, B, V>) => {
  const base: Props = config.base ?? {};
  return (selection: VariantSelection<V> = {}): VariantProps<T, B, V> =>
    Object.keys(config.variants).reduce<Props>((props, name) => {
      const choice = (selection as Readonly<Record<string, Responsive<string> | undefined>>)[name] ?? (config.defaults as Readonly<Record<string, string>> | undefined)?.[name];
      return choice === undefined ? props : { ...props, ...propsOfChoice(config.variants, name, choice, base) };
    }, base) as VariantProps<T, B, V>;
};
