import JSZip from 'jszip';

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

/** Pós-processa os slides do .pptx gerado. */
export const sanitizePptx = async (buffer: Buffer): Promise<Buffer> => {
  const zip = await JSZip.loadAsync(buffer);
  const slides = Object.keys(zip.files).filter((name) => SLIDE_XML.test(name));
  await Promise.all(
    slides.map(async (name) => zip.file(name, keepFirstParagraphProps(await zip.file(name)!.async('string')))),
  );
  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
};
