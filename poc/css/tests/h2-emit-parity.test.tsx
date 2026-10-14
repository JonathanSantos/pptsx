import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';
import calibration from '../../../examples/calibration.tsx';
import calibrationRich from '../../../examples/calibration-rich.tsx';
import demo from '../../../examples/demo.tsx';
import { render as engineRender } from '../../../src/render.ts';
import type { DeckDefinition } from '../../../src/core/types.ts';
import { render as pocRender } from '../render.ts';
import { EXAMPLES_DIR } from './helpers.ts';

/**
 * H2 (guarda sem Keynote): nos decks de calibração o XML de cada slide sai byte a byte igual
 * ao da engine — mesmo medidor, mesmas linhas forçadas, mesmo espaçamento. A calibração
 * medida no Keynote (34/34 e 30/30, poc/css/calibration/h2.ts) vale então para a PoC.
 * Na demo mudam a Table (colunas auto pelo conteúdo, P2) e a ordem da elipse decorativa
 * absoluta da capa e do encerramento (regra de pintura do browser, decisão em aberto da P0).
 */

const slidesOf = async (buffer: Buffer): Promise<readonly string[]> => {
  const zip = await JSZip.loadAsync(buffer);
  const names = Object.keys(zip.files).filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name)).sort((a, b) => Number(a.match(/\d+/)![0]) - Number(b.match(/\d+/)![0]));
  return Promise.all(names.map((name) => zip.file(name)!.async('string')));
};

const both = async (deck: DeckDefinition) => {
  const options = { sizes: ['16x9'] as const, preview: false as const, baseDir: EXAMPLES_DIR };
  const [[engine], [poc]] = await Promise.all([engineRender(deck, options), pocRender(deck, options)]);
  return { engine: await slidesOf(engine!.buffer), poc: await slidesOf(poc!.buffer) };
};

describe('H2 — XML dos slides igual ao da engine', () => {
  it.each([
    ['calibration', calibration],
    ['calibration-rich', calibrationRich],
  ] as const)('%s', async (_name, deck) => {
    const { engine, poc } = await both(deck);
    expect(poc).toEqual(engine);
  });

  // Formas do slide sem os ids/nomes que o pptxgenjs numera pela ordem de inserção.
  const shapesOf = (xml: string): readonly string[] =>
    (xml.match(/<p:sp>[\s\S]*?<\/p:sp>/g) ?? []).map((shape) => shape.replace(/ id="\d+"| name="[^"]*"/g, '')).sort();

  it('demo: muda a Table (slide 5) e só a ordem das formas na capa e no encerramento', async () => {
    const { engine, poc } = await both(demo);
    const changed = engine.map((xml, index) => (xml === poc[index] ? undefined : index + 1)).filter((n) => n !== undefined);
    expect(changed).toEqual([1, 5, 6]);
    expect(shapesOf(poc[0]!)).toEqual(shapesOf(engine[0]!));
    expect(shapesOf(poc[5]!)).toEqual(shapesOf(engine[5]!));
  });
});
