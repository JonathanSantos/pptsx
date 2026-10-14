import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import JSZip from 'jszip';
import { emitPptx, type EmbeddedFont } from '../../src/emit/index.ts';
import { reorderPresentationLists } from '../../src/emit/sanitize.ts';
import { eotOf } from '../../src/fonts/index.ts';
import { pDeck, pSlide, pText, rect } from '../helpers/nodes.ts';

/**
 * M8-E: embed de fontes por pós-processamento do zip — ppt/fonts/fontN.fntdata
 * (EOT), content type fntdata, relacionamento de fonte, <p:embeddedFontLst> na
 * posição do schema (depois de notesSz, antes de defaultTextStyle) e
 * embedTrueTypeFonts="1".
 */

const ttfOf = (name: string): Buffer =>
  readFileSync(fileURLToPath(new URL(`../../fonts/LiberationSans-${name}.ttf`, import.meta.url)));

const FAMILY = 'Liberation Sans';
const REGULAR_EOT = eotOf(ttfOf('Regular'), FAMILY);
const BOLD_EOT = eotOf(ttfOf('Bold'), FAMILY);

const FONT_REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/font';

const deck = () => pDeck([pSlide([pText(rect(10, 10, 300, 40), 'Olá', { font: FAMILY })])]);

const zipOf = async (embedFonts?: readonly EmbeddedFont[]): Promise<JSZip> => {
  const buffer = await emitPptx(deck(), { baseDir: tmpdir(), ...(embedFonts === undefined ? {} : { embedFonts }) });
  return JSZip.loadAsync(buffer);
};

const read = async (zip: JSZip, name: string): Promise<string> => {
  const file = zip.file(name);
  if (!file) throw new Error(`missing ${name}`);
  return file.async('string');
};

const fontFiles = (zip: JSZip): string[] => Object.keys(zip.files).filter((n) => n.endsWith('.fntdata')).sort();

interface Rel {
  readonly id: string;
  readonly type: string;
  readonly target: string;
}
const relsOf = (xml: string): Rel[] =>
  [...xml.matchAll(/<Relationship\b([^>]*)\/?>/g)].map((m) => {
    const attr = (name: string) => new RegExp(`\\b${name}="([^"]*)"`).exec(m[1] ?? '')?.[1] ?? '';
    return { id: attr('Id'), type: attr('Type'), target: attr('Target') };
  });

const FACES: readonly EmbeddedFont[] = [
  { family: FAMILY, weight: 'regular', italic: false, eot: REGULAR_EOT },
  { family: FAMILY, weight: 'bold', italic: false, eot: BOLD_EOT },
];

describe('emitPptx — embedFonts', () => {
  it('writes ppt/fonts/fontN.fntdata with the EOT bytes', async () => {
    const zip = await zipOf([FACES[0]!]);
    expect(fontFiles(zip)).toEqual(['ppt/fonts/font1.fntdata']);
    const data = await zip.file('ppt/fonts/font1.fntdata')!.async('nodebuffer');
    expect(data.equals(REGULAR_EOT)).toBe(true);
  });

  it('declares the fntdata content type', async () => {
    const types = await read(await zipOf(FACES), '[Content_Types].xml');
    expect(types).toMatch(/<Default Extension="fntdata" ContentType="application\/x-fontdata"\/>/);
    expect(types.match(/Extension="fntdata"/g)).toHaveLength(1);
  });

  it('adds one font relationship per face, pointing to its fntdata', async () => {
    const zip = await zipOf(FACES);
    const rels = relsOf(await read(zip, 'ppt/_rels/presentation.xml.rels')).filter((r) => r.type === FONT_REL);
    expect(rels.map((r) => r.target).sort()).toEqual(['fonts/font1.fntdata', 'fonts/font2.fntdata']);
    const allIds = relsOf(await read(zip, 'ppt/_rels/presentation.xml.rels')).map((r) => r.id);
    expect(new Set(allIds).size).toBe(allIds.length);
  });

  it('<p:embeddedFontLst> sits after notesSz and before defaultTextStyle', async () => {
    const xml = await read(await zipOf(FACES), 'ppt/presentation.xml');
    const list = xml.indexOf('<p:embeddedFontLst>');
    expect(list).toBeGreaterThan(-1);
    expect(list).toBeGreaterThan(xml.indexOf('<p:notesSz'));
    expect(list).toBeLessThan(xml.indexOf('<p:defaultTextStyle'));
  });

  it('one <p:embeddedFont> per family, with regular/bold refs resolving to the right EOT', async () => {
    const zip = await zipOf(FACES);
    const xml = await read(zip, 'ppt/presentation.xml');
    const fonts = xml.match(/<p:embeddedFont>[\s\S]*?<\/p:embeddedFont>/g) ?? [];
    expect(fonts).toHaveLength(1);
    expect(fonts[0]).toMatch(new RegExp(`<p:font\\b[^>]*typeface="${FAMILY}"`));
    const rels = relsOf(await read(zip, 'ppt/_rels/presentation.xml.rels'));
    const targetOf = (style: string): string => {
      const id = new RegExp(`<p:${style}\\b[^>]*r:id="([^"]+)"`).exec(fonts[0]!)?.[1];
      const rel = rels.find((r) => r.id === id);
      if (!rel) throw new Error(`no rel for ${style}`);
      return `ppt/${rel.target}`;
    };
    const regular = await zip.file(targetOf('regular'))!.async('nodebuffer');
    const bold = await zip.file(targetOf('bold'))!.async('nodebuffer');
    expect(regular.equals(REGULAR_EOT)).toBe(true);
    expect(bold.equals(BOLD_EOT)).toBe(true);
    expect(fonts[0]).not.toMatch(/<p:italic\b|<p:boldItalic\b/);
  });

  it('two families → two <p:embeddedFont>', async () => {
    const xml = await read(
      await zipOf([...FACES, { family: 'Outra', weight: 'regular', italic: true, eot: eotOf(ttfOf('Italic'), 'Outra') }]),
      'ppt/presentation.xml',
    );
    const fonts = xml.match(/<p:embeddedFont>[\s\S]*?<\/p:embeddedFont>/g) ?? [];
    expect(fonts).toHaveLength(2);
    const outra = fonts.find((f) => f.includes('typeface="Outra"'));
    expect(outra).toMatch(/<p:italic\b/);
  });

  it('sets embedTrueTypeFonts="1" on <p:presentation>', async () => {
    const xml = await read(await zipOf(FACES), 'ppt/presentation.xml');
    expect(/<p:presentation\b[^>]*>/.exec(xml)?.[0]).toMatch(/embedTrueTypeFonts="1"/);
  });

  it.each([
    { name: 'empty list', list: [] as readonly EmbeddedFont[] },
    { name: 'no option', list: undefined },
  ])('$name: nothing of the embed is written', async ({ list }) => {
    const zip = await zipOf(list);
    expect(fontFiles(zip)).toEqual([]);
    expect(await read(zip, '[Content_Types].xml')).not.toMatch(/fntdata/);
    expect(relsOf(await read(zip, 'ppt/_rels/presentation.xml.rels')).filter((r) => r.type === FONT_REL)).toEqual([]);
    const xml = await read(zip, 'ppt/presentation.xml');
    expect(xml).not.toMatch(/embeddedFontLst|embedTrueTypeFonts/);
  });
});

describe('reorderPresentationLists', () => {
  const head =
    '<p:presentation xmlns:p="p" xmlns:r="r"><p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst>';
  const notes = '<p:notesMasterIdLst><p:notesMasterId r:id="rId3"/></p:notesMasterIdLst>';
  const slides = '<p:sldIdLst><p:sldId id="256" r:id="rId2"/></p:sldIdLst>';
  const tail = '<p:sldSz cx="9144000" cy="5143500"/><p:notesSz cx="5143500" cy="9144000"/></p:presentation>';

  it('moves notesMasterIdLst before sldIdLst', () => {
    expect(reorderPresentationLists(head + slides + notes + tail)).toBe(head + notes + slides + tail);
  });

  it('is idempotent', () => {
    const once = reorderPresentationLists(head + slides + notes + tail);
    expect(reorderPresentationLists(once)).toBe(once);
  });

  it('leaves an already ordered document untouched', () => {
    expect(reorderPresentationLists(head + notes + slides + tail)).toBe(head + notes + slides + tail);
  });

  it('leaves a document without notesMasterIdLst untouched', () => {
    expect(reorderPresentationLists(head + slides + tail)).toBe(head + slides + tail);
  });

  it('the emitted presentation.xml has notesMasterIdLst before sldIdLst', async () => {
    const xml = await read(await zipOf(), 'ppt/presentation.xml');
    const notesAt = xml.indexOf('<p:notesMasterIdLst>');
    expect(notesAt).toBeGreaterThan(-1);
    expect(notesAt).toBeLessThan(xml.indexOf('<p:sldIdLst>'));
  });
});
