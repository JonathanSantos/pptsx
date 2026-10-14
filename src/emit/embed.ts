import JSZip from 'jszip';
import type { FontWeight } from '../core/types.ts';

/**
 * Embed de fontes no .pptx (M8), como pós-processamento do zip. Método do spike
 * M8-S (docs/work/reports/M8-spike-fonts.md): o PowerPoint só aceita o .fntdata
 * em EOT; TTF cru ou ofuscado faz o arquivo ser recusado. O Keynote ignora o embed.
 */

/** Uma face a embutir. O EOT já vem pronto (src/fonts/eot.ts): o emissor não lê arquivo. */
export interface EmbeddedFont {
  readonly family: string;
  readonly weight: FontWeight;
  readonly italic: boolean;
  readonly eot: Buffer;
}

/** Elemento de estilo dentro de <p:embeddedFont>, na ordem do CT_EmbeddedFontListEntry. */
export type EmbeddedFontStyle = 'regular' | 'bold' | 'italic' | 'boldItalic';

const STYLE_ORDER: readonly EmbeddedFontStyle[] = ['regular', 'bold', 'italic', 'boldItalic'];

/** Uma face já com destino no pacote. */
export interface FontPart {
  readonly family: string;
  readonly style: EmbeddedFontStyle;
  readonly relId: string;
  /** Relativo a ppt/ (como no Target do relacionamento). */
  readonly target: string;
  readonly eot: Buffer;
}

export const FONT_RELATIONSHIP = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/font';
export const FNTDATA_CONTENT_TYPE = 'application/x-fontdata';

const PRESENTATION = 'ppt/presentation.xml';
const PRESENTATION_RELS = 'ppt/_rels/presentation.xml.rels';
const CONTENT_TYPES = '[Content_Types].xml';

export const styleOf = (weight: FontWeight, italic: boolean): EmbeddedFontStyle => {
  if (weight === 'bold') return italic ? 'boldItalic' : 'bold';
  return italic ? 'italic' : 'regular';
};

const faceKey = (font: EmbeddedFont): string => `${font.family}\u0000${styleOf(font.weight, font.italic)}`;

/** A mesma face pedida duas vezes entra uma vez só (a primeira). */
const uniqueFaces = (fonts: readonly EmbeddedFont[]): readonly EmbeddedFont[] =>
  fonts.filter((font, index) => fonts.findIndex((other) => faceKey(other) === faceKey(font)) === index);

const relIdsOf = (rels: string): ReadonlySet<string> => new Set([...rels.matchAll(/\bId="([^"]*)"/g)].map((m) => m[1] ?? ''));

/** `count` ids rIdFontN livres, em ordem crescente de N. */
export const freeRelIdsOf = (rels: string, count: number): readonly string[] => {
  const taken = relIdsOf(rels);
  const next = (ids: readonly string[], n: number): readonly string[] => {
    if (ids.length === count) return ids;
    const id = `rIdFont${n}`;
    return next(taken.has(id) ? ids : [...ids, id], n + 1);
  };
  return next([], 1);
};

/** Faces → partes do pacote: ppt/fonts/fontN.fntdata e ids de relacionamento que não colidem com `rels`. */
export const fontPartsOf = (fonts: readonly EmbeddedFont[], rels: string): readonly FontPart[] => {
  const faces = uniqueFaces(fonts);
  const ids = freeRelIdsOf(rels, faces.length);
  return faces.map((font, index) => ({
    family: font.family,
    style: styleOf(font.weight, font.italic),
    relId: ids[index] ?? '',
    target: `fonts/font${index + 1}.fntdata`,
    eot: font.eot,
  }));
};

// ───────────── [Content_Types].xml ─────────────

/** Um <Default Extension="fntdata"> (só se ainda não houver). */
export const withFntdataContentType = (contentTypes: string): string => {
  if (/<Default\b[^>]*\bExtension="fntdata"/i.test(contentTypes)) return contentTypes;
  return contentTypes.replace(
    /<Types\b[^>]*>/,
    (open) => `${open}<Default Extension="fntdata" ContentType="${FNTDATA_CONTENT_TYPE}"/>`,
  );
};

// ───────────── ppt/_rels/presentation.xml.rels ─────────────

export const withFontRelationships = (rels: string, parts: readonly FontPart[]): string => {
  if (parts.length === 0) return rels;
  const xml = parts
    .map((part) => `<Relationship Id="${part.relId}" Type="${FONT_RELATIONSHIP}" Target="${part.target}"/>`)
    .join('');
  return rels.replace('</Relationships>', `${xml}</Relationships>`);
};

// ───────────── ppt/presentation.xml ─────────────

export interface EmbeddedFontEntry {
  readonly family: string;
  readonly faces: readonly { readonly style: EmbeddedFontStyle; readonly relId: string }[];
}

/** Uma entrada por família, na ordem da primeira aparição; faces na ordem do schema. */
export const fontEntriesOf = (parts: readonly FontPart[]): readonly EmbeddedFontEntry[] =>
  [...new Set(parts.map((part) => part.family))].map((family) => ({
    family,
    faces: parts
      .filter((part) => part.family === family)
      .map(({ style, relId }) => ({ style, relId }))
      .sort((a, b) => STYLE_ORDER.indexOf(a.style) - STYLE_ORDER.indexOf(b.style)),
  }));

const escapeAttr = (value: string): string =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// pitchFamily 34 = variable pitch + swiss, charset 0 = ANSI: o que o spike gravou e o PowerPoint aceitou.
const entryXml = (entry: EmbeddedFontEntry): string =>
  `<p:embeddedFont><p:font typeface="${escapeAttr(entry.family)}" pitchFamily="34" charset="0"/>` +
  entry.faces.map((face) => `<p:${face.style} r:id="${face.relId}"/>`).join('') +
  '</p:embeddedFont>';

/**
 * Irmãos que o CT_Presentation põe depois de <p:embeddedFontLst>. Inserir antes do
 * primeiro que existir mantém a ordem do schema mesmo com smartTags/custShowLst.
 */
const AFTER_EMBEDDED_FONTS = ['custShowLst', 'photoAlbum', 'custDataLst', 'kinsoku', 'defaultTextStyle', 'modifyVerifier', 'extLst'];

const FOLLOWING_SIBLING = new RegExp(`<p:(?:${AFTER_EMBEDDED_FONTS.join('|')})\\b`);

const insertBeforeFollowing = (xml: string, insert: string): string => {
  const match = FOLLOWING_SIBLING.exec(xml);
  if (match) return xml.slice(0, match.index) + insert + xml.slice(match.index);
  return xml.replace('</p:presentation>', `${insert}</p:presentation>`);
};

const withEmbedFlag = (xml: string): string =>
  xml.replace(/<p:presentation\b[^>]*>/, (open) => {
    if (/\bembedTrueTypeFonts="/.test(open)) return open.replace(/\bembedTrueTypeFonts="[^"]*"/, 'embedTrueTypeFonts="1"');
    return open.replace(/\s*(\/?)>$/, ' embedTrueTypeFonts="1"$1>');
  });

/** <p:embeddedFontLst> na posição do schema (depois de notesSz) + embedTrueTypeFonts="1". */
export const withEmbeddedFontList = (presentation: string, entries: readonly EmbeddedFontEntry[]): string => {
  if (entries.length === 0) return presentation;
  const items = entries.map(entryXml).join('');
  const listed = presentation.includes('</p:embeddedFontLst>')
    ? presentation.replace('</p:embeddedFontLst>', `${items}</p:embeddedFontLst>`)
    : insertBeforeFollowing(presentation, `<p:embeddedFontLst>${items}</p:embeddedFontLst>`);
  return withEmbedFlag(listed);
};

// ───────────── casca (IO do zip) ─────────────

const readText = async (zip: JSZip, name: string): Promise<string> => {
  const file = zip.file(name);
  if (!file) throw new Error(`pptx sem ${name}`);
  return file.async('string');
};

/** Embute as faces no .pptx. Lista vazia → buffer intacto. */
export const embedFonts = async (buffer: Buffer, fonts: readonly EmbeddedFont[]): Promise<Buffer> => {
  if (fonts.length === 0) return buffer;
  const zip = await JSZip.loadAsync(buffer);
  const rels = await readText(zip, PRESENTATION_RELS);
  const parts = fontPartsOf(fonts, rels);
  parts.forEach((part) => zip.file(`ppt/${part.target}`, part.eot));
  zip.file(PRESENTATION_RELS, withFontRelationships(rels, parts));
  zip.file(CONTENT_TYPES, withFntdataContentType(await readText(zip, CONTENT_TYPES)));
  zip.file(PRESENTATION, withEmbeddedFontList(await readText(zip, PRESENTATION), fontEntriesOf(parts)));
  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
};
