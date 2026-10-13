import JSZip from 'jszip';

const SLIDE_XML = /^ppt\/slides\/slide\d+\.xml$/;
const PARAGRAPH = /<a:p>([\s\S]*?)<\/a:p>/g;
const PARAGRAPH_PROPS = /<a:pPr\b[^>]*?(?:\/>|>[\s\S]*?<\/a:pPr>)/g;

/**
 * O pptxgenjs repete <a:pPr> antes de cada run, inclusive depois de <a:br/>.
 * O schema OOXML só aceita pPr como primeiro filho de <a:p>; o Keynote tolera,
 * mas o PowerPoint pode exigir "reparar" o arquivo. Mantém só o primeiro.
 */
export const keepFirstParagraphProps = (xml: string): string =>
  xml.replace(PARAGRAPH, (_paragraph, body: string) => {
    let seen = false;
    const cleaned = body.replace(PARAGRAPH_PROPS, (props) => {
      if (seen) return '';
      seen = true;
      return props;
    });
    return `<a:p>${cleaned}</a:p>`;
  });

/** Pós-processa os slides do .pptx gerado. */
export const sanitizePptx = async (buffer: Buffer): Promise<Buffer> => {
  const zip = await JSZip.loadAsync(buffer);
  const slides = Object.keys(zip.files).filter((name) => SLIDE_XML.test(name));
  await Promise.all(
    slides.map(async (name) => zip.file(name, keepFirstParagraphProps(await zip.file(name)!.async('string')))),
  );
  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
};
