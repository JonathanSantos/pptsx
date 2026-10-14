import type { DeckDefinition } from '../../../src/core/types.ts';
import { countDeck, type Counts } from './count.ts';

/** H1: imprime a contagem antes (examples/) × depois (poc/css/examples/). uso: npx tsx --tsconfig poc/css/tsconfig.json poc/css/tools/h1.ts */
const PAIRS = [
  ['demo', '../../../examples/demo.tsx', '../examples/demo.tsx'],
  ['long-list', '../../../examples/long-list.tsx', '../examples/long-list.tsx'],
  ['charts', '../../../examples/charts.tsx', '../examples/charts.tsx'],
  ['m9-deck', '../../../examples/agent-test/m9-deck.tsx', '../examples/m9-deck.tsx'],
] as const;

const load = async (path: string): Promise<DeckDefinition> => ((await import(path)) as { default: DeckDefinition }).default;
const cut = (a: number, b: number): string => `${a} → ${b} (−${Math.round(((a - b) / a) * 100)}%)`;
const line = (name: string, a: Counts, b: Counts): string =>
  `| ${name} | ${cut(a.nodes, b.nodes)} | ${cut(a.props, b.props)} | ${cut(a.nodes + a.props, b.nodes + b.props)} | ${a.responsive} → ${b.responsive} | ${a.pushBoxes} → ${b.pushBoxes} |`;

console.log('| deck | nós | props | nós + props | responsivas | Box só p/ empurrar |\n|---|---|---|---|---|---|');
for (const [name, before, after] of PAIRS) console.log(line(name, countDeck(await load(before)), countDeck(await load(after))));
