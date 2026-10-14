import { describe, expect, it } from 'vitest';
import overflow from '../../../examples/overflow.tsx';
import cause from '../../../examples/probe/cause.tsx';
import table from '../../../examples/probe/table.tsx';
import type { DeckDefinition, Diagnostic as EngineDiagnostic, SizePresetName } from '../../../src/core/types.ts';
import type { Diagnostic } from '../types.ts';
import { engineFit, pocFit } from './helpers.ts';

/**
 * H5: o fit da PoC (área de conteúdo com borda, margens na detecção e na causa, grid e wrap)
 * dá os mesmos códigos e severidades da engine nos decks de diagnóstico. Também o mesmo
 * path e slide, e o mesmo causedBy (a spec permitia simplificar; aqui não foi preciso).
 */

const DECKS: readonly (readonly [string, DeckDefinition])[] = [
  ['overflow', overflow],
  ['probe/cause', cause],
  ['probe/table', table],
];
const SIZES: readonly SizePresetName[] = ['16x9', '4x3', 'wide'];

const keyOf = (d: Diagnostic | EngineDiagnostic): string => `${d.severity} ${d.code} s${d.slide} ${d.path}`;
const causeOf = (d: Diagnostic | EngineDiagnostic): string => `${keyOf(d)} ← ${d.data?.causedBy ?? '-'}`;

describe('H5 — mesmos diagnósticos da engine', () => {
  it.each(DECKS.flatMap(([name, deck]) => SIZES.map((size) => [name, deck, size] as const)))('%s %s', (_name, deck, size) => {
    const poc = pocFit(deck, size).diagnostics;
    const engine = engineFit(deck, size).diagnostics;
    expect(poc.length).toBeGreaterThan(0);
    expect(poc.map(keyOf)).toEqual(engine.map(keyOf));
    expect(poc.map(causeOf)).toEqual(engine.map(causeOf));
    expect(poc.map((d) => d.message)).toEqual(engine.map((d) => d.message));
  });
});

/** Estouros que só o modelo CSS tem (poc/css/examples/probe-css.tsx), com o desfecho esperado à mão. */
describe('H5 — estouros novos: célula de grid, linha de wrap, margens e borda', () => {
  it('cada estouro sai no nó certo, com a área certa', async () => {
    const { default: probe } = await import('../examples/probe-css.tsx');
    const { diagnostics } = pocFit(probe, '16x9');
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
