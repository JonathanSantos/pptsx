import { describe, expect, it } from 'vitest';
import { Bullets, KpiCard, KpiRow, TwoColumn } from '../../examples/components/index.ts';
import { tokens } from '../../examples/tokens.ts';
import { Deck, Slide, Text } from '../../src/primitives/index.ts';
import { resolveDeck } from '../../src/resolve/index.ts';
import { createContext, resolveSize } from '../../src/sizes.ts';
import type { ResolvedBox, ResolvedNode, ResolvedText } from '../../src/core/types.ts';
import type { Child } from '../../src/core/types.ts';

/** M9: resolveDeck exige ctx; estes testes não usam props responsivas, então 16x9 basta. */
const RESOLVE_CTX = createContext(resolveSize('16x9'));

/** Componentes de exemplo isolados (contrato M5-B), via árvore resolvida. */

const resolveOne = (child: Child): readonly ResolvedNode[] =>
  resolveDeck(
    <Deck>
      <Slide>{child}</Slide>
    </Deck>,
    RESOLVE_CTX,
  ).slides[0]!.children;

const descendants = (nodes: readonly ResolvedNode[]): ResolvedNode[] =>
  nodes.flatMap((node) => [node, ...('children' in node ? descendants(node.children) : [])]);

const texts = (nodes: readonly ResolvedNode[]): ResolvedText[] =>
  descendants(nodes).filter((node): node is ResolvedText => node.kind === 'text');

describe('tokens', () => {
  it('matches the contract palette', () => {
    expect(tokens.color).toMatchObject({ accent: '#2F6FED', positive: '#1E9E6A', negative: '#D64545', surface: '#F4F6FA', muted: '#5B6680' });
    expect(tokens.font).toEqual({ display: 44, h1: 32, h2: 24, body: 20, small: 14, caption: 11 });
    expect(tokens.space).toEqual({ page: 40, gap: 20, tight: 10 });
  });
});

describe('Bullets', () => {
  const items = ['Um', 'Dois', 'Três'];
  const [root] = resolveOne(<Bullets items={items} />) as [ResolvedBox];

  it('is a column with one row per item', () => {
    expect(root.kind).toBe('box');
    expect(root.path.split(' > ').pop()).toBe('Bullets');
    expect(root.css.flexDirection).toBe('column');
    expect(root.children).toHaveLength(items.length);
    for (const row of root.children) {
      expect(row.kind).toBe('box');
      expect((row as ResolvedBox).css.flexDirection).toBe('row');
    }
  });

  it('each row has an 8×8 accent ellipse marker and a growing text with minSize 14', () => {
    root.children.forEach((row, index) => {
      const nodes = descendants([row]);
      const markers = nodes.filter((n) => n.kind === 'shape' && n.props.kind === 'ellipse');
      expect(markers).toHaveLength(1);
      expect(markers[0]!.props).toMatchObject({ fill: tokens.color.accent });
      expect(markers[0]!.css).toMatchObject({ width: 8, height: 8 });
      const [text] = texts([row]);
      expect(text!.content).toBe(items[index]);
      expect(text!.props).toMatchObject({ minSize: 14 });
      expect(text!.css.flexGrow).toBe(1);
      expect(text!.props.fit ?? 'shrink').toBe('shrink');
    });
  });

  it('size defaults to font.body and can be overridden', () => {
    expect(texts([root]).every((t) => t.props.size === tokens.font.body)).toBe(true);
    const small = resolveOne(<Bullets items={['a']} size={16} />);
    expect(texts(small)[0]!.props.size).toBe(16);
  });

  it('gap defaults to 0.7 × size and can be overridden', () => {
    expect((resolveOne(<Bullets items={['a', 'b']} size={20} />)[0] as ResolvedBox).css.rowGap).toBeCloseTo(14);
    expect((resolveOne(<Bullets items={['a', 'b']} size={20} gap={30} />)[0] as ResolvedBox).css.rowGap).toBe(30);
  });
});

describe('TwoColumn', () => {
  const left = <Text>Esquerda</Text>;
  const right = <Text>Direita</Text>;

  // M11-F: TwoColumn é um grid; `stacked` troca as duas colunas por uma coluna com duas linhas.
  it('is a two-column grid by default; stacked is a one-column grid', () => {
    const [side] = resolveOne(<TwoColumn left={left} right={right} />) as [ResolvedBox];
    const [stacked] = resolveOne(<TwoColumn left={left} right={right} stacked />) as [ResolvedBox];
    expect(side.css).toMatchObject({ display: 'grid', gridTemplateColumns: 'minmax(0, 0.5fr) minmax(0, 0.5fr)' });
    expect(stacked.css).toMatchObject({ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gridTemplateRows: 'auto minmax(0, 1fr)' });
    expect(side.css.columnGap).toBeGreaterThan(0);
  });

  it('ratio sets the column fractions', () => {
    const [root] = resolveOne(<TwoColumn left={left} right={right} ratio={0.4} />) as [ResolvedBox];
    expect(root.css.gridTemplateColumns).toBe(`minmax(0, 0.4fr) minmax(0, ${1 - 0.4}fr)`);
  });

  it('keeps left then right in order', () => {
    const [root] = resolveOne(<TwoColumn left={left} right={right} />) as [ResolvedBox];
    expect(texts([root]).map((t) => t.content)).toEqual(['Esquerda', 'Direita']);
  });
});

describe('KpiCard', () => {
  type CardProps = Parameters<typeof KpiCard>[0];
  const cardTexts = (props: Partial<CardProps> = {}) =>
    texts(resolveOne(<KpiCard label="Receita" value="R$ 10 mi" delta="+5%" {...props} />));
  const deltaOf = (props: Partial<CardProps> = {}) => cardTexts(props).find((t) => t.content.includes('+5%'))!;
  const valueOf = (props: Partial<CardProps> = {}) => cardTexts(props).find((t) => t.content === 'R$ 10 mi')!;
  const labelOf = (props: Partial<CardProps> = {}) => cardTexts(props).find((t) => t.content === 'Receita')!;
  const rootOf = (props: Partial<CardProps> = {}) => resolveOne(<KpiCard label="L" value="V" {...props} />)[0] as ResolvedBox;

  /** M16: o padding fica no css, nos 4 lados. */
  const sides = (n: number) => ({ top: n, right: n, bottom: n, left: n });

  it('surface box with radius 8 and padding', () => {
    const root = rootOf();
    expect(root.path.split(' > ').pop()).toBe('KpiCard');
    // M11: fill/radius do Box são alias de backgroundColor/borderRadius (ficam no css).
    expect(root.css).toMatchObject({ backgroundColor: tokens.color.surface, borderRadius: 8 });
    expect(root.css.padding).toBeDefined();
  });

  it('value is bold and larger than the muted label', () => {
    expect(labelOf().props.color).toBe(tokens.color.muted);
    expect(valueOf().props.weight).toBe('bold');
    expect(valueOf().props.size!).toBeGreaterThan(labelOf().props.size!);
  });

  describe('trend → arrow, sentiment → color', () => {
    it('trend up → ▲ and (default) positive color', () => {
      const delta = deltaOf({ trend: 'up' });
      expect(delta.content).toBe('▲ +5%');
      expect(delta.props.color).toBe(tokens.color.positive);
    });

    it('trend down → ▼ and (default) negative color', () => {
      const delta = deltaOf({ trend: 'down' });
      expect(delta.content).toBe('▼ +5%');
      expect(delta.props.color).toBe(tokens.color.negative);
    });

    it('no trend → no arrow and neutral (muted) color', () => {
      const delta = deltaOf();
      expect(delta.content).toBe('+5%');
      expect(delta.props.color).toBe(tokens.color.muted);
    });

    it('sentiment overrides the color but not the arrow', () => {
      expect(deltaOf({ trend: 'up', sentiment: 'negative' })).toMatchObject({ content: '▲ +5%', props: { color: tokens.color.negative } });
      expect(deltaOf({ trend: 'down', sentiment: 'positive' })).toMatchObject({ content: '▼ +5%', props: { color: tokens.color.positive } });
      expect(deltaOf({ trend: 'up', sentiment: 'neutral' }).props.color).toBe(tokens.color.muted);
    });

    it('sentiment without trend colors the delta with no arrow', () => {
      expect(deltaOf({ sentiment: 'positive' })).toMatchObject({ content: '+5%', props: { color: tokens.color.positive } });
    });
  });

  describe('size', () => {
    // Contrato M5: padding / label / valor (pt).
    const SPEC = { sm: [14, 12, 32], md: [20, 14, 44], lg: [20, 16, 56] } as const;

    it.each(Object.entries(SPEC))('%s → padding %s, label/value sizes', (size, [padding, label, value]) => {
      const props = { size: size as CardProps['size'] };
      expect(rootOf(props).css.padding).toEqual(sides(padding));
      expect(labelOf(props).props.size).toBe(label);
      expect(valueOf(props).props.size).toBe(value);
    });

    it("defaults to 'md'", () => {
      expect(rootOf().css.padding).toEqual(sides(SPEC.md[0]));
      expect(labelOf().props.size).toBe(SPEC.md[1]);
      expect(valueOf().props.size).toBe(SPEC.md[2]);
    });

    it('value grows sm < md < lg', () => {
      const v = (size: CardProps['size']) => valueOf({ size }).props.size!;
      expect(v('sm')).toBeLessThan(v('md'));
      expect(v('md')).toBeLessThan(v('lg'));
    });
  });

  it('no delta → no delta text', () => {
    expect(texts(resolveOne(<KpiCard label="L" value="V" />))).toHaveLength(2);
  });
});

describe('KpiRow', () => {
  // M11-F: KpiRow é um grid de uma linha com colunas iguais (minmax(0, 1fr)).
  it('is a grid with one equal column per card', () => {
    const items = [
      { label: 'A', value: '1' },
      { label: 'B', value: '2' },
      { label: 'C', value: '3' },
    ];
    const [root] = resolveOne(<KpiRow items={items} />) as [ResolvedBox];
    expect(root.css).toMatchObject({ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' });
    expect(root.css.columnGap).toBeGreaterThan(0);
    expect(root.children).toHaveLength(3);
    expect(descendants([root]).filter((n) => n.path.split(' > ').pop()?.replace(/\[\d+\]$/, '') === 'KpiCard')).toHaveLength(3);
  });

  const valueSizes = (node: Child) =>
    texts(resolveOne(node))
      .filter((t) => t.props.weight === 'bold' && /^\d$/.test(t.content))
      .map((t) => t.props.size);

  it("cards default to size 'md'", () => {
    expect(valueSizes(<KpiRow items={[{ label: 'A', value: '1' }, { label: 'B', value: '2' }]} />)).toEqual([44, 44]);
  });

  it('size is passed to every card; an item size wins', () => {
    const items = [{ label: 'A', value: '1' }, { label: 'B', value: '2', size: 'lg' as const }];
    expect(valueSizes(<KpiRow items={items} size="sm" />)).toEqual([32, 56]);
  });
});
