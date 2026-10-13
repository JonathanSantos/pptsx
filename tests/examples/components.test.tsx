import { describe, expect, it } from 'vitest';
import { Bullets, KpiCard, KpiRow, TwoColumn } from '../../examples/components/index.ts';
import { tokens } from '../../examples/tokens.ts';
import { Deck, Slide, Text } from '../../src/primitives/index.ts';
import { resolveDeck } from '../../src/resolve/index.ts';
import type { ResolvedBox, ResolvedNode, ResolvedText } from '../../src/core/types.ts';
import type { Child } from '../../src/core/types.ts';

/** Componentes de exemplo isolados (contrato M5-B), via árvore resolvida. */

const resolveOne = (child: Child): readonly ResolvedNode[] =>
  resolveDeck(
    <Deck>
      <Slide>{child}</Slide>
    </Deck>,
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
    expect(root.props.direction ?? 'column').toBe('column');
    expect(root.children).toHaveLength(items.length);
    for (const row of root.children) {
      expect(row.kind).toBe('box');
      expect((row as ResolvedBox).props.direction).toBe('row');
    }
  });

  it('each row has an 8×8 accent ellipse marker and a growing text with minSize 14', () => {
    root.children.forEach((row, index) => {
      const nodes = descendants([row]);
      const markers = nodes.filter((n) => n.kind === 'shape' && n.props.kind === 'ellipse');
      expect(markers).toHaveLength(1);
      expect(markers[0]!.props).toMatchObject({ width: 8, height: 8, fill: tokens.color.accent });
      const [text] = texts([row]);
      expect(text!.content).toBe(items[index]);
      expect(text!.props).toMatchObject({ grow: 1, minSize: 14 });
      expect(text!.props.fit ?? 'shrink').toBe('shrink');
    });
  });

  it('size defaults to font.body and can be overridden', () => {
    expect(texts([root]).every((t) => t.props.size === tokens.font.body)).toBe(true);
    const small = resolveOne(<Bullets items={['a']} size={16} />);
    expect(texts(small)[0]!.props.size).toBe(16);
  });
});

describe('TwoColumn', () => {
  const left = <Text>Esquerda</Text>;
  const right = <Text>Direita</Text>;

  it('row by default; stacked → column', () => {
    const [row] = resolveOne(<TwoColumn left={left} right={right} />) as [ResolvedBox];
    const [column] = resolveOne(<TwoColumn left={left} right={right} stacked />) as [ResolvedBox];
    expect(row.props.direction ?? 'column').toBe('row');
    expect(column.props.direction ?? 'column').toBe('column');
    expect(row.props.gap).toBeGreaterThan(0);
  });

  it('keeps left then right in order', () => {
    const [root] = resolveOne(<TwoColumn left={left} right={right} />) as [ResolvedBox];
    expect(texts([root]).map((t) => t.content)).toEqual(['Esquerda', 'Direita']);
  });
});

describe('KpiCard', () => {
  const cardTexts = (trend: 'up' | 'down' | undefined) =>
    texts(resolveOne(<KpiCard label="Receita" value="R$ 10 mi" delta="+5%" {...(trend ? { trend } : {})} />));

  it('surface box with radius 8 and padding', () => {
    const [root] = resolveOne(<KpiCard label="L" value="V" />) as [ResolvedBox];
    expect(root.path.split(' > ').pop()).toBe('KpiCard');
    expect(root.props).toMatchObject({ fill: tokens.color.surface, radius: 8 });
    expect(root.props.padding).toBeDefined();
  });

  it('value is bold and larger than the small muted label', () => {
    const all = cardTexts(undefined);
    const label = all.find((t) => t.content === 'Receita')!;
    const value = all.find((t) => t.content === 'R$ 10 mi')!;
    expect(label.props).toMatchObject({ size: tokens.font.small, color: tokens.color.muted });
    expect(value.props.weight).toBe('bold');
    expect(value.props.size!).toBeGreaterThan(label.props.size!);
  });

  it('trend down colors the delta with tokens.color.negative', () => {
    const delta = cardTexts('down').find((t) => t.content.includes('+5%'))!;
    expect(delta.props.color).toBe(tokens.color.negative);
  });

  it('trend up colors the delta with tokens.color.positive', () => {
    const delta = cardTexts('up').find((t) => t.content.includes('+5%'))!;
    expect(delta.props.color).toBe(tokens.color.positive);
  });

  it('no delta → no delta text', () => {
    expect(texts(resolveOne(<KpiCard label="L" value="V" />))).toHaveLength(2);
  });
});

describe('KpiRow', () => {
  it('row with one growing card per item', () => {
    const items = [
      { label: 'A', value: '1' },
      { label: 'B', value: '2' },
      { label: 'C', value: '3' },
    ];
    const [root] = resolveOne(<KpiRow items={items} />) as [ResolvedBox];
    expect(root.props.direction).toBe('row');
    expect(root.props.gap).toBeGreaterThan(0);
    expect(root.children).toHaveLength(3);
    for (const child of root.children) {
      const growing = descendants([child]).some((n) => n.kind === 'box' && n.props.grow === 1);
      expect(growing).toBe(true);
    }
    expect(descendants([root]).filter((n) => n.path.split(' > ').pop()?.replace(/\[\d+\]$/, '') === 'KpiCard')).toHaveLength(3);
  });
});
