import { describe, expect, it } from 'vitest';
import engineDemo from '../../../examples/demo.tsx';
import engineLongList from '../../../examples/long-list.tsx';
import engineCharts from '../../../examples/charts.tsx';
import engineM9 from '../../../examples/agent-test/m9-deck.tsx';
import cssDemo from '../examples/demo.tsx';
import cssLongList from '../examples/long-list.tsx';
import cssCharts from '../examples/charts.tsx';
import cssM9 from '../examples/m9-deck.tsx';
import { countDeck } from '../tools/count.ts';

/** H1: os 4 decks reescritos em CSS × os originais (meta: ≥ 25 % menos nós/props na demo). */

const PAIRS = [
  ['demo', engineDemo, cssDemo],
  ['long-list', engineLongList, cssLongList],
  ['charts', engineCharts, cssCharts],
  ['m9-deck', engineM9, cssM9],
] as const;

describe('H1 — contagem antes × depois (16x9)', () => {
  const rows = PAIRS.map(([name, before, after]) => ({ name, before: countDeck(before), after: countDeck(after) }));

  // Números no relatório (poc/css/tools/h1.ts imprime a tabela). Meta da spec: ≥ 25 %.
  it('demo: ≥ 25 % menos nós; props caem menos (−17 %, abaixo da meta, registrado no relatório)', () => {
    const demo = rows.find((row) => row.name === 'demo')!;
    expect((demo.before.nodes - demo.after.nodes) / demo.before.nodes).toBeGreaterThanOrEqual(0.25);
    expect(demo.after.props).toBeLessThan(demo.before.props);
  });

  it('Boxes só para empurrar caem em todos os decks com layout', () => {
    rows.filter((row) => row.name !== 'charts').forEach((row) => expect(row.after.pushBoxes).toBeLessThan(row.before.pushBoxes / 3));
  });
});
