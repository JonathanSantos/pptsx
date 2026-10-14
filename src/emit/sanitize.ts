import JSZip from 'jszip';
import { renumberCharts } from './renumber.ts';

const SLIDE_XML = /^ppt\/slides\/slide\d+\.xml$/;
const PARAGRAPH = /<a:p>([\s\S]*?)<\/a:p>/g;
const PARAGRAPH_PROPS = /<a:pPr\b[^>]*?(?:\/>|>[\s\S]*?<\/a:pPr>)/g;

/** Parágrafo `<a:p>…</a:p>` completo, como aparece no XML do slide. */
export type ParagraphXml = string;

/** Parágrafos `<a:p>` do XML, em ordem de documento (sem aninhamento: OOXML não aninha `<a:p>`). */
export const paragraphsOf = (xml: string): readonly ParagraphXml[] => xml.match(PARAGRAPH) ?? [];

/** Remove de um corpo de parágrafo todo `<a:pPr>` depois do primeiro; o resto fica intacto e na ordem. */
export const keepFirstPropsOfBody = (body: string): string => {
  const [first] = body.match(PARAGRAPH_PROPS) ?? [];
  if (first === undefined) return body;
  const [before, ...after] = body.split(PARAGRAPH_PROPS);
  return before + first + after.join('');
};

const sanitizeBody = (_paragraph: string, body: string): ParagraphXml => `<a:p>${keepFirstPropsOfBody(body)}</a:p>`;

/** Aplica `keepFirstPropsOfBody` a um único `<a:p>…</a:p>`. */
export const sanitizeParagraph = (paragraph: ParagraphXml): ParagraphXml => paragraph.replace(PARAGRAPH, sanitizeBody);

/**
 * O pptxgenjs repete <a:pPr> antes de cada run, inclusive depois de <a:br/>.
 * O schema OOXML só aceita pPr como primeiro filho de <a:p>; o Keynote tolera,
 * mas o PowerPoint pode exigir "reparar" o arquivo. Mantém só o primeiro.
 */
export const keepFirstParagraphProps = (xml: string): string => xml.replace(PARAGRAPH, sanitizeBody);

const NOTES_MASTER_LIST = /<p:notesMasterIdLst\b[^>]*?(?:\/>|>[\s\S]*?<\/p:notesMasterIdLst>)/;
const SLIDE_LIST_START = /<p:sldIdLst\b/;

/**
 * O pptxgenjs grava <p:sldIdLst> antes de <p:notesMasterIdLst>; o CT_Presentation
 * pede o contrário (sldMasterIdLst, notesMasterIdLst, handoutMasterIdLst, sldIdLst).
 * O Keynote ignora, mas o PowerPoint pode pedir "reparar". Já na ordem → intacto.
 */
export const reorderPresentationLists = (xml: string): string => {
  const notes = NOTES_MASTER_LIST.exec(xml);
  const slides = SLIDE_LIST_START.exec(xml);
  if (!notes || !slides || notes.index < slides.index) return xml;
  const without = xml.slice(0, notes.index) + xml.slice(notes.index + notes[0].length);
  return without.slice(0, slides.index) + notes[0] + without.slice(slides.index);
};

const PRESENTATION_XML = 'ppt/presentation.xml';

type XmlFix = (xml: string) => string;

/** Parte do pacote → correção a aplicar. */
const fixOf = (name: string): XmlFix | undefined => {
  if (SLIDE_XML.test(name)) return keepFirstParagraphProps;
  if (name === PRESENTATION_XML) return reorderPresentationLists;
  return undefined;
};

// ───────────── xlsx embutido dos gráficos (M10) ─────────────

const EMBEDDED_WORKBOOK = /^ppt\/embeddings\/[^/]+\.xlsx$/;
const WORKBOOK_TABLE = /^xl\/tables\/[^/]+\.xml$/;
const REF_WITH_TRAILING_QUOTE = /\bref="([^"]*?)'"/g;

/**
 * O pptxgenjs 4.0.1 grava `ref="A1:B4'"` (apóstrofo sobrando) na tabela do xlsx de
 * bar/line/pie; com isso o Keynote descarta o gráfico e o slide fica vazio (M10-spike).
 */
export const fixTableRef = (xml: string): string => xml.replace(REF_WITH_TRAILING_QUOTE, 'ref="$1"');

/** Aplica `fixTableRef` a cada xl/tables/*.xml de um xlsx (zip dentro do zip). */
export const fixEmbeddedWorkbook = async (workbook: Uint8Array): Promise<Uint8Array> => {
  const zip = await JSZip.loadAsync(workbook);
  await Promise.all(
    Object.keys(zip.files)
      .filter((name) => WORKBOOK_TABLE.test(name))
      .map(async (name) => zip.file(name, fixTableRef(await zip.file(name)!.async('string')))),
  );
  return zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
};

const fixPart = async (zip: JSZip, name: string): Promise<void> => {
  const file = zip.file(name);
  if (!file) return;
  if (EMBEDDED_WORKBOOK.test(name)) {
    zip.file(name, await fixEmbeddedWorkbook(await file.async('uint8array')));
    return;
  }
  const fix = fixOf(name);
  if (fix) zip.file(name, fix(await file.async('string')));
};

/** Pós-processa slides, presentation.xml, numeração dos gráficos e os xlsx embutidos do .pptx gerado. */
export const sanitizePptx = async (buffer: Buffer): Promise<Buffer> => {
  const zip = await JSZip.loadAsync(buffer);
  await renumberCharts(zip);
  await Promise.all(Object.keys(zip.files).map((name) => fixPart(zip, name)));
  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
};
