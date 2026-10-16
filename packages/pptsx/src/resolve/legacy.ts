import type { PrimitiveKind, PrimitivePropsMap } from '../core/types.ts';
import type { Normalized } from './normalize.ts';

/**
 * Props do nó resolvido (M16: "visão única"). A geometria (tamanho, posição, flex, padding, raio, fundo
 * do slide) fica só em `css`; aqui vão o estilo de texto resolvido com herança (o fit troca o `size`) e
 * as props que não são CSS (`fit`, `src`, `data`, `paginate`, `href`, `id`…), que chegam em `own`.
 */

const compact = (record: Readonly<Record<string, unknown>>): Readonly<Record<string, unknown>> =>
  Object.fromEntries(Object.entries(record).filter(([, value]) => value !== undefined));

type PropsBuilder = (normalized: Normalized) => Readonly<Record<string, unknown>>;

const textOf: PropsBuilder = ({ text, own }) => ({
  font: text.fontFamily,
  size: text.fontSize,
  weight: text.weight,
  italic: text.italic,
  color: text.color,
  lineHeight: text.lineHeight,
  align: text.textAlign,
  ...own,
});

const ownOnly: PropsBuilder = ({ own }) => own;

const BUILDERS: Readonly<Record<PrimitiveKind, PropsBuilder>> = {
  deck: () => ({}),
  span: () => ({}),
  slide: ownOnly,
  box: ownOnly,
  text: textOf,
  image: ownOnly,
  shape: ownOnly,
  // Gráfico herda família e cor dos rótulos; o size dos rótulos é próprio (padrão do gráfico), não o do texto.
  chart: ({ text, own }) => ({ font: text.fontFamily, color: text.color, ...own }),
  table: ({ text, own }) => ({ font: text.fontFamily, size: text.fontSize, color: text.color, lineHeight: text.lineHeight, ...own }),
  path: ownOnly,
  // Ícone herda a cor do texto (currentColor do CSS).
  icon: ({ text, own }) => ({ color: text.color, ...own }),
  connector: ownOnly,
  slideNumber: textOf,
  container: ownOnly,
};

export type LegacyProps<K extends PrimitiveKind> = Omit<PrimitivePropsMap[K], 'children'>;

// O único cast das props: os builders acima montam as chaves de PrimitivePropsMap[K] sem a geometria.
export const legacyPropsOf = <K extends PrimitiveKind>(kind: K, normalized: Normalized): LegacyProps<K> =>
  compact(BUILDERS[kind](normalized)) as unknown as LegacyProps<K>;
