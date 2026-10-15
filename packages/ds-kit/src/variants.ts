import { isResponsive, mapResponsive, type Responsive } from 'pptsx';

/**
 * Variantes: escolhas nomeadas (`tone: 'positive'`, `size: 'sm'`) que viram props CSS. A escolha pode ser
 * responsiva (`size={{ base: 'md', tall: 'lg' }}`): cada prop CSS sai responsiva com os mesmos breakpoints.
 * Ordem: `base` < variantes na ordem declarada (quem chama espalha as próprias props por cima).
 */

type Props = Readonly<Record<string, unknown>>;
export type VariantDefs = Readonly<Record<string, Readonly<Record<string, Props>>>>;

export type VariantSelection<V extends VariantDefs> = { readonly [K in keyof V]?: Responsive<keyof V[K] & string> };

export interface VariantConfig<V extends VariantDefs> {
  readonly base?: Props;
  readonly variants: V;
  readonly defaults?: { readonly [K in keyof V]?: keyof V[K] & string };
}

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

export const createVariants = <V extends VariantDefs>(config: VariantConfig<V>) => {
  const base = config.base ?? {};
  return (selection: VariantSelection<V> = {}): Props =>
    Object.keys(config.variants).reduce<Props>((props, name) => {
      const choice = (selection as Readonly<Record<string, Responsive<string> | undefined>>)[name] ?? (config.defaults as Readonly<Record<string, string>> | undefined)?.[name];
      return choice === undefined ? props : { ...props, ...propsOfChoice(config.variants, name, choice, base) };
    }, base);
};
