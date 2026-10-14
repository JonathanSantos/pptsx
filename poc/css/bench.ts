import { fileURLToPath } from 'node:url';
import { render as engineRender } from '../../src/render.ts';
import type { DeckDefinition, RenderOptions } from '../../src/core/types.ts';
import { render as pocRender } from './render.ts';

/**
 * H7: tempo de build da engine × PoC (mesmo deck, 3 tamanhos, com preview), mediana de N
 * rodadas depois de um aquecimento. uso: tsx poc/css/bench.ts [rodadas]
 */
const EXAMPLES = fileURLToPath(new URL('../../examples/', import.meta.url));
const ROUNDS = Number(process.argv[2] ?? 5);
const OPTIONS: RenderOptions = { sizes: ['16x9', '4x3', 'wide'], baseDir: EXAMPLES };

const median = (values: readonly number[]): number => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)] ?? 0;

const timeOf = async (run: () => Promise<unknown>): Promise<number> => {
  const started = performance.now();
  await run();
  return performance.now() - started;
};

const bench = async (label: string, run: () => Promise<unknown>): Promise<number> => {
  await run();
  const times: number[] = [];
  for (let i = 0; i < ROUNDS; i += 1) times.push(await timeOf(run));
  const value = median(times);
  console.log(`${label}: ${value.toFixed(0)} ms (mediana de ${ROUNDS})`);
  return value;
};

const decks = process.argv.slice(3);
const names = decks.length > 0 ? decks : ['demo'];
for (const name of names) {
  const deck = ((await import(`../../examples/${name}.tsx`)) as { default: DeckDefinition }).default;
  const engine = await bench(`${name} engine`, () => engineRender(deck, OPTIONS));
  const poc = await bench(`${name} PoC`, () => pocRender(deck, OPTIONS));
  console.log(`${name}: PoC/engine = ${(poc / engine).toFixed(2)}×`);
}
