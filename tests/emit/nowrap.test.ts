import { describe, expect, it } from 'vitest';
import { tmpdir } from 'node:os';
import JSZip from 'jszip';
import { emitPptx } from '../../src/emit/index.ts';
import { pDeck, pSlide, pText, rect } from '../helpers/nodes.ts';

/**
 * nowrap (M8-H, R20): a linha calculada não pode ser requebrada pelo renderizador, então
 * a caixa sai com wrap="none" no <a:bodyPr>; sem nowrap continua wrap="square".
 */
const bodyPrOf = async (nowrap: boolean | undefined): Promise<string> => {
  const props = nowrap === undefined ? {} : { nowrap };
  const node = pText(rect(10, 10, 200, 40), 'R$ 52,4 mi', props);
  const buffer = await emitPptx(pDeck([pSlide([node])]), { baseDir: tmpdir() });
  const zip = await JSZip.loadAsync(buffer);
  const xml = await zip.file('ppt/slides/slide1.xml')!.async('string');
  return xml.match(/<a:bodyPr\b[^>]*>/)?.[0] ?? '';
};

describe('emit nowrap', () => {
  it('nowrap emits wrap="none"', async () => {
    expect(await bodyPrOf(true)).toContain('wrap="none"');
  });

  it('default and nowrap={false} keep wrap="square"', async () => {
    expect(await bodyPrOf(undefined)).toContain('wrap="square"');
    expect(await bodyPrOf(false)).toContain('wrap="square"');
  });
});
