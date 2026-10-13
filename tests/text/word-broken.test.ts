import { describe, expect, it } from 'vitest';
import { brokenWordsOf, createEstimateMeasurer, createFontRegistry, createFontkitMeasurer } from '../../src/text/index.ts';
import { DEFAULT_FONTS } from '../../src/fonts.ts';
import type { TextMeasurer, TextStyle } from '../../src/core/types.ts';

/**
 * CONTRACTS §text 9a (M5-F): `wordBroken` = alguma palavra (segmento sem ponto de
 * quebra) foi quebrada por caractere. Pontos de quebra legítimos: espaço e depois
 * de '-' e '/'. A linha com reticências encerra a busca.
 */

describe('brokenWordsOf', () => {
  it('returns nothing when every line ends at a space', () => {
    expect(brokenWordsOf('aaa bbb ccc', [['aaa bbb', 'ccc']])).toEqual([]);
  });

  it('collapses repeated whitespace like the line breaker does', () => {
    expect(brokenWordsOf('aaa   bbb\tccc', [['aaa bbb', 'ccc']])).toEqual([]);
  });

  it('a break right after "-" is legitimate', () => {
    expect(brokenWordsOf('anti-inflamatório', [['anti-', 'inflamatório']])).toEqual([]);
  });

  it('a break right after "/" is legitimate (URLs)', () => {
    expect(brokenWordsOf('https://ex.com/a/b', [['https://', 'ex.com/', 'a/b']])).toEqual([]);
  });

  it('a break by character is detected and the whole word is reported', () => {
    expect(brokenWordsOf('abcdefghij', [['abcd', 'efgh', 'ij']])).toEqual(['abcdefghij']);
  });

  it('reports the word between spaces, even when it also contains "-"', () => {
    expect(brokenWordsOf('x super-califragilistico y', [['x super-', 'califr', 'agilistico y']])).toEqual([
      'super-califragilistico',
    ]);
  });

  it('reports each broken word once, in order, across paragraphs', () => {
    const content = 'Desligamento ok\nDisponibilidade\nDesligamento';
    const paragraphs = [['Desligam', 'ento ok'], ['Disponibilidad', 'e'], ['Desligam', 'ento']];
    expect(brokenWordsOf(content, paragraphs)).toEqual(['Desligamento', 'Disponibilidade']);
  });

  it('mixes legit and broken boundaries in the same paragraph', () => {
    expect(brokenWordsOf('R$ 52,4 mi', [['R$', '52,', '4 mi']])).toEqual(['52,4']);
  });

  it('truncation with "…" does not count as a broken word', () => {
    expect(brokenWordsOf('abcdefghij', [['abcd…']])).toEqual([]);
    expect(brokenWordsOf('aaa bbbbbbbb', [['aaa', 'bbb…']])).toEqual([]);
  });

  it('a character break before the truncated line still counts', () => {
    expect(brokenWordsOf('abcdefghijkl', [['abcd', 'efg…']])).toEqual(['abcdefghijkl']);
  });

  it('empty content and empty paragraphs are fine', () => {
    expect(brokenWordsOf('', [['']])).toEqual([]);
    expect(brokenWordsOf('a\n\nb', [['a'], [''], ['b']])).toEqual([]);
  });
});

// ───────────── medidores ─────────────

const style = (size: number): TextStyle => ({ family: 'Arial', size, weight: 'regular', italic: false, lineHeight: 1 });

const MEASURERS: readonly (readonly [string, TextMeasurer])[] = [
  ['estimate', createEstimateMeasurer()],
  ['fontkit', createFontkitMeasurer(createFontRegistry(DEFAULT_FONTS), { safety: 1 })],
];

const URL = 'https://exemplo.com.br/relatorios/2026/financeiro-anual-consolidado';

describe.each(MEASURERS)('%s measurer — wordBroken', (_name, measure) => {
  const at = (content: string, maxWidth: number, maxLines?: number) =>
    measure({ content, style: style(20), maxWidth, ...(maxLines === undefined ? {} : { maxLines }) });

  it('is false when the text fits on one line', () => {
    expect(at('Receita anual', Infinity).wordBroken).toBe(false);
  });

  it('is false when wrapping happens only between words', () => {
    const r = at('Lorem ipsum dolor sit amet consectetur', 120);
    expect(r.lines.length).toBeGreaterThan(1);
    expect(r.wordBroken).toBe(false);
  });

  it('is false for a long URL that only breaks after "-" and "/"', () => {
    const r = at(URL, 200);
    expect(r.lines.length).toBeGreaterThan(2);
    expect(r.wordBroken).toBe(false);
  });

  it('is true for a word with no break point in a narrow width', () => {
    const r = at('Supercalifragilisticexpialidocious', 100);
    expect(r.lines.length).toBeGreaterThan(1);
    expect(r.wordBroken).toBe(true);
  });

  it('is true when a number is split by character', () => {
    const r = at('1.284.392', 40);
    expect(r.lines.length).toBeGreaterThan(1);
    expect(r.wordBroken).toBe(true);
  });

  it('agrees with brokenWordsOf on the returned paragraphs', () => {
    for (const [content, width] of [
      ['Supercalifragilisticexpialidocious e mais', 100],
      [URL, 200],
      ['Desligamento Disponibilidade', 90],
    ] as const) {
      const r = at(content, width);
      expect(r.wordBroken).toBe(brokenWordsOf(content, r.paragraphs).length > 0);
    }
  });

  it('is false when the broken part was cut away by maxLines (ellipsis line)', () => {
    // A 1ª linha já seria a palavra partida; com maxLines=1 ela vira "…" e nada partido aparece.
    const r = at('Supercalifragilisticexpialidocious', 100, 1);
    expect(r.truncated).toBe(true);
    expect(r.lines).toHaveLength(1);
    expect(r.lines[0]!.endsWith('…')).toBe(true);
    expect(r.wordBroken).toBe(false);
  });
});
