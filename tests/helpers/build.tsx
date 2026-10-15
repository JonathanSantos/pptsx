/**
 * M12: render() de um deck JSX pequeno com a árvore posicionada, o XML de cada slide e o SVG do
 * preview (sem PNG): para testar resolve → fit → emit/preview de ponta a ponta.
 */
import JSZip from 'jszip';
import { render } from '../../src/render.ts';
import { slideToSvg } from '../../src/preview/index.ts';
import type { Diagnostic, PositionedDeck, RenderOptions, SlideElement } from '../../src/core/types.ts';

export interface Built {
  readonly xml: readonly string[];
  readonly svg: readonly string[];
  readonly diagnostics: readonly Diagnostic[];
  readonly positioned: PositionedDeck;
}

export const build = async (deck: SlideElement, options: RenderOptions = {}): Promise<Built> => {
  const [result] = await render(() => deck, { preview: false, includePositioned: true, ...options });
  const zip = await JSZip.loadAsync(result!.buffer);
  const positioned = result!.positioned!;
  const xml = await Promise.all(
    positioned.slides.map((_, index) => zip.file(`ppt/slides/slide${index + 1}.xml`)!.async('string')),
  );
  const svg = positioned.slides.map((slide) =>
    slideToSvg(slide, positioned.size, { widthPx: 720, baseDir: options.baseDir ?? process.cwd() }),
  );
  return { xml, svg, diagnostics: result!.diagnostics, positioned };
};

/** `<p:sp>` do XML, em ordem. */
export const shapesOf = (xml: string): readonly string[] => xml.match(/<p:sp>[\s\S]*?<\/p:sp>/g) ?? [];
