import { describe, expect, it } from 'vitest';
import overflow from '../../examples/overflow.tsx';
import cause from '../../examples/probe/cause.tsx';
import table from '../../examples/probe/table.tsx';
import type { DeckDefinition, Diagnostic, SizePresetName } from '../../src/core/types.ts';
import { cssFit } from '../helpers/css-fit.tsx';
import probe from './__fixtures__/probe-css.tsx';
import engineBaseline from '../examples/__fixtures__/engine-positioned.json' with { type: 'json' };

/**
 * M11 (H5, de poc/css/tests/h5-diagnostics.test.tsx): o fit sobre o box model (área de conteúdo
 * com borda, margens na detecção e na causa, grid e wrap) dá os mesmos códigos, severidades,
 * paths, causedBy e mensagens do motor pré-M11 nos decks de diagnóstico
 * (tests/examples/__fixtures__/engine-positioned.json, gravado do commit 05c1e5e).
 */

interface BaselineDiagnostic {
  readonly severity: string;
  readonly code: string;
  readonly slide: number;
  readonly path: string;
  readonly causedBy: string | null;
  readonly message: string;
}

const ENGINE = (
  engineBaseline as unknown as {
    readonly decks: Readonly<Record<string, Readonly<Record<string, { readonly diagnostics: readonly BaselineDiagnostic[] }>>>>;
  }
).decks;

const DECKS: readonly (readonly [string, DeckDefinition])[] = [
  ['overflow', overflow],
  ['probe/cause', cause],
  ['probe/table', table],
];
const SIZES: readonly SizePresetName[] = ['16x9', '4x3', 'wide'];

type Comparable = Pick<BaselineDiagnostic, 'severity' | 'code' | 'slide' | 'path'>;
const keyOf = (d: Comparable): string => `${d.severity} ${d.code} s${d.slide} ${d.path}`;
const causeOf = (d: Diagnostic): string => `${keyOf(d)} ← ${d.data?.causedBy ?? '-'}`;
const baselineCauseOf = (d: BaselineDiagnostic): string => `${keyOf(d)} ← ${d.causedBy ?? '-'}`;

describe('fit diagnostics × pre-M11 engine', () => {
  it.each(DECKS.flatMap(([name, deck]) => SIZES.map((size) => [name, size, deck] as const)))('%s %s', (name, size, deck) => {
    const expected = ENGINE[name]![size]!.diagnostics;
    const { diagnostics } = cssFit(deck, size);
    expect(diagnostics.length).toBeGreaterThan(0);
    expect(diagnostics.map(keyOf)).toEqual(expected.map(keyOf));
    expect(diagnostics.map(causeOf)).toEqual(expected.map(baselineCauseOf));
    expect(diagnostics.map((d) => d.message)).toEqual(expected.map((d) => d.message));
  });
});

/**
 * Estouros que só o modelo CSS tem (__fixtures__/probe-css.tsx, cópia de poc/css/examples/probe-css.tsx;
 * TODO M11-F: importar de examples/probe/css.tsx), com o desfecho esperado à mão.
 */
describe('CSS-only overflows: grid cell, wrap line, margins and border', () => {
  it('reports each overflow on the right node with the right area', () => {
    const { diagnostics } = cssFit(probe, '16x9');
    expect(diagnostics.map(keyOf)).toEqual([
      'info text-shrunk s1 Slide > Box > Text[0,2]',
      'error text-overflow s1 Slide > Box > Text[1]',
      'info text-shrunk s1 Slide > Box > Box > Text',
      'error box-overflow s1 Slide > Box > Box',
      'error box-overflow s2 Slide > Box',
      'error text-overflow s3 Slide > Box[1] > Text',
      'error box-overflow s3 Slide > Box[0]',
    ]);
    const messages = diagnostics.map((d) => d.message).join('\n');
    expect(messages).toContain('a célula do grid tem 212 × 60 pt');
    expect(messages).toContain('As linhas do wrap ocupam 64.2 pt na vertical');
    expect(messages).toContain('Os filhos em fluxo somam 120 pt na vertical (column), mas a área de conteúdo tem 100 pt');
  });
});
