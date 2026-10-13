import { describe, expect, it } from 'vitest';
import { fitSlide, type FitResult } from '../../src/fit/index.ts';
import type {
  Diagnostic,
  LayoutEnv,
  PositionedNode,
  PositionedSlide,
  PositionedText,
  ResolvedSlide,
  SlideElement,
  SlideSize,
} from '../../src/core/types.ts';
import { DEFAULTS, textStyleOf } from '../../src/core/defaults.ts';
import { Box, Deck, Slide, Text } from '../../src/primitives/index.ts';
import { resolveDeck } from '../../src/resolve/index.ts';
import { createFontRegistry, createFontkitMeasurer } from '../../src/text/index.ts';
import { DEFAULT_FONTS } from '../../src/fonts.ts';
import { KpiRow } from '../../examples/components/index.ts';
import { SIZE_16X9, SIZE_4X3 } from '../helpers/nodes.ts';
import { allMemberPaths, memberPaths } from '../helpers/diagnostics.ts';

/**
 * CONTRACTS §fit "Palavra partida conta como estouro (M5-F)" e a linha
 * `text-word-broken` (warning, data fromSize/toSize) da tabela de diagnósticos.
 */

const env: LayoutEnv = {
  measureText: createFontkitMeasurer(createFontRegistry(DEFAULT_FONTS)),
  imageSize: () => ({ width: 400, height: 200 }),
};

const resolveSlide = (slide: SlideElement): ResolvedSlide => {
  const first = resolveDeck(<Deck>{slide}</Deck>).slides[0];
  if (!first) throw new Error('no slide');
  return first;
};

const fit = (slide: SlideElement, size: SlideSize = SIZE_16X9): FitResult =>
  fitSlide({ slide: resolveSlide(slide), slideIndex: 0, size, env });

const texts = (slide: PositionedSlide): PositionedText[] => {
  const walk = (nodes: readonly PositionedNode[]): PositionedNode[] =>
    nodes.flatMap((n) => [n, ...(n.kind === 'box' ? walk(n.children) : [])]);
  return walk(slide.children).filter((n): n is PositionedText => n.kind === 'text');
};
const only = (r: FitResult): PositionedText => {
  const [t] = texts(r.slide);
  if (!t) throw new Error('no text');
  return t;
};
const byCode = (r: FitResult, code: Diagnostic['code']) => r.diagnostics.filter((d) => d.code === code);

/** Largura natural (uma linha) da palavra em `size`. */
const widthAt = (content: string, size: number): number =>
  env.measureText({ content, style: textStyleOf({ size }), maxWidth: Infinity }).width;
/** Largura de caixa em que a palavra cabe inteira exatamente até `size` (com a folga de segurança). */
const boxFitting = (content: string, size: number): number => widthAt(content, size) / DEFAULTS.textSafety + 0.3;

const WORD = 'Desligamento';

const oneText = (width: number, props: Parameters<typeof Text>[0]) => (
  <Slide>
    <Box width={width}>
      <Text {...props} />
    </Box>
  </Slide>
);

/** Propriedade geral: todo Text final com palavra partida tem um text-word-broken com o mesmo path. */
const expectEveryBrokenWordReported = (r: FitResult) => {
  const reported = new Set(allMemberPaths(byCode(r, 'text-word-broken')));
  const broken = texts(r.slide).filter((t) => t.text.wordBroken);
  for (const t of broken) expect(reported, `sem text-word-broken para ${t.path}`).toContain(t.path);
};

describe('fit — word broken by character (M5-F)', () => {
  it('sanity: at the original size the word breaks in the chosen box', () => {
    const r = fitSlide({
      slide: resolveSlide(oneText(boxFitting(WORD, 34), { size: 40, fit: 'error', children: WORD })),
      slideIndex: 0,
      size: SIZE_16X9,
      env,
    });
    expect(only(r).text.wordBroken).toBe(true);
  });

  it('fit="shrink": shrinks until the word no longer breaks and reports text-shrunk (info)', () => {
    const r = fit(oneText(boxFitting(WORD, 34), { size: 40, children: WORD }));
    const t = only(r);
    expect(t.text.wordBroken).toBe(false);
    expect(t.text.lines).toEqual([WORD]);
    const size = textStyleOf(t.props).size;
    expect(size).toBeLessThan(40);
    // Para no primeiro tamanho em que a palavra cabe: 1 pt acima ela ainda partiria.
    const above = env.measureText({ content: WORD, style: textStyleOf({ size: size + 1 }), maxWidth: t.frame.width });
    expect(above.wordBroken).toBe(true);
    expect(byCode(r, 'text-word-broken')).toEqual([]);
    const [shrunk] = byCode(r, 'text-shrunk');
    expect(shrunk).toMatchObject({ severity: 'info', path: t.path, data: { fromSize: 40, toSize: size } });
    expectEveryBrokenWordReported(r);
  });

  it('fit="shrink": a word that never fits down to minSize → text-word-broken warning with fromSize/toSize', () => {
    // mínimo padrão de 40 = 30; a palavra só cabe em ~24 pt.
    const r = fit(oneText(boxFitting(WORD, 24), { size: 40, children: WORD }));
    const t = only(r);
    expect(t.text.wordBroken).toBe(true);
    expect(textStyleOf(t.props).size).toBe(30);
    const warnings = byCode(r, 'text-word-broken');
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatchObject({ severity: 'warning', path: t.path, size: '16x9', slide: 1, data: { fromSize: 40, toSize: 30 } });
    expect(warnings[0]!.message).toContain(`"${WORD}"`);
    expectEveryBrokenWordReported(r);
  });

  it('cites every broken word in the message', () => {
    const content = `${WORD} Disponibilidade`;
    const r = fit(oneText(boxFitting('Disponibilidade', 20), { size: 40, children: content }));
    const [w] = byCode(r, 'text-word-broken');
    expect(w).toBeDefined();
    expect(w!.message).toContain('"Disponibilidade"');
    expect(w!.message).toContain(`"${WORD}"`);
  });

  it.each(['error', 'truncate'] as const)('fit="%s": word broken → warning without changing the size', (policy) => {
    const r = fit(oneText(boxFitting(WORD, 30), { size: 40, fit: policy, children: WORD }));
    const t = only(r);
    expect(textStyleOf(t.props).size).toBe(40);
    expect(t.text.wordBroken).toBe(true);
    expect(byCode(r, 'text-shrunk')).toEqual([]);
    const [w] = byCode(r, 'text-word-broken');
    expect(w).toMatchObject({ severity: 'warning', path: t.path, data: { fromSize: 40, toSize: 40 } });
    expect(w!.message).toContain(`"${WORD}"`);
  });

  it('a broken word in a fit="error" text does not make shrink siblings shrink', () => {
    const r = fit(
      <Slide>
        <Box width={boxFitting(WORD, 30)}>
          <Text size={40} fit="error">{WORD}</Text>
          <Text size={20}>ok</Text>
        </Box>
      </Slide>,
    );
    const [, sibling] = texts(r.slide);
    expect(textStyleOf(sibling!.props).size).toBe(20);
    expect(byCode(r, 'text-shrunk')).toEqual([]);
  });

  it('wrapping only between words is not reported', () => {
    const r = fit(oneText(200, { size: 24, children: 'Lorem ipsum dolor sit amet consectetur adipiscing elit' }));
    expect(only(r).text.lines.length).toBeGreaterThan(1);
    expect(byCode(r, 'text-word-broken')).toEqual([]);
    expect(byCode(r, 'text-shrunk')).toEqual([]);
  });
});

describe('fit — KpiRow with 5 long values never ships broken words silently', () => {
  const items = [
    { label: 'Receita recorrente', value: 'R$ 52.384.920,00', delta: '+12%', trend: 'up' as const },
    { label: 'Usuários ativos', value: '1.284.392', delta: '+4%', trend: 'up' as const },
    { label: 'Disponibilidade', value: '99,95%', delta: '0,01 p.p.' },
    { label: 'Desligamento', value: 'Desligamento', delta: '−3%', trend: 'down' as const },
    { label: 'Chamados', value: '12.345.678', delta: '+22%', trend: 'up' as const },
  ];

  it.each([SIZE_16X9, SIZE_4X3])('every Text with wordBroken has a matching text-word-broken ($name)', (size) => {
    const r = fit(
      <Slide padding={40}>
        <KpiRow items={items} />
      </Slide>,
      size,
    );
    expectEveryBrokenWordReported(r);
    // Com esses valores alguma palavra ainda parte: a propriedade não é vazia.
    expect(texts(r.slide).some((t) => t.text.wordBroken)).toBe(true);
    for (const d of byCode(r, 'text-word-broken')) {
      expect(d.severity).toBe('warning');
      expect(d.data).toMatchObject({ fromSize: expect.any(Number), toSize: expect.any(Number) });
    }
  });

  it('a shrink-able value whose word breaks is shrunk before warning (toSize < fromSize or at its minSize)', () => {
    const r = fit(
      <Slide padding={40}>
        <KpiRow items={items} />
      </Slide>,
      SIZE_4X3,
    );
    for (const d of byCode(r, 'text-word-broken')) {
      // Agrupado (M6): todos os membros têm de ser shrink para a regra valer ao grupo.
      const members = memberPaths(d).map((path) => texts(r.slide).find((n) => n.path === path)!);
      if (members.some((t) => (t.props.fit ?? 'shrink') !== 'shrink')) continue;
      expect(d.data!.toSize).toBeLessThan(d.data!.fromSize!);
    }
  });
});

describe('fit — float32 frame width does not break a centered short text (regression)', () => {
  it('"Perguntas?" centered with maxWidth 80% → 0 diagnostics and 1 line each', () => {
    const r = fit(
      <Slide justify="center" padding={40}>
        <Text size={40} weight="bold" alignSelf="center" maxWidth="80%" fit="truncate" maxLines={1}>
          Perguntas?
        </Text>
        <Text size={20} alignSelf="center" maxWidth="80%">
          Perguntas?
        </Text>
      </Slide>,
    );
    expect(r.diagnostics).toEqual([]);
    const all = texts(r.slide);
    expect(all).toHaveLength(2);
    for (const t of all) {
      expect(t.text.lines).toEqual(['Perguntas?']);
      expect(t.text.truncated).toBe(false);
    }
  });

  it.each([SIZE_16X9, SIZE_4X3])('same in $name', (size) => {
    const r = fit(
      <Slide justify="center" padding={40}>
        <Text size={40} weight="bold" alignSelf="center" maxWidth="80%" fit="truncate" maxLines={1}>
          Perguntas?
        </Text>
      </Slide>,
      size,
    );
    expect(r.diagnostics).toEqual([]);
    expect(only(r).text.lines).toEqual(['Perguntas?']);
  });
});
