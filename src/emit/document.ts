import JSZip from 'jszip';
import type { DocumentProperties } from '../core/types.ts';
import type { Presentation } from './pptx.ts';

/** M15: propriedades do documento. Título, autor, empresa e assunto o pptxgenjs grava; palavras-chave não. */

export const setDocumentProperties = (pptx: Presentation, document: DocumentProperties): void => {
  if (document.title !== undefined) pptx.title = document.title;
  if (document.author !== undefined) pptx.author = document.author;
  if (document.company !== undefined) pptx.company = document.company;
  if (document.subject !== undefined) pptx.subject = document.subject;
};

const escapeXml = (value: string): string => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export const keywordsOf = (keywords: DocumentProperties['keywords']): string | undefined => {
  if (keywords === undefined) return undefined;
  const list = typeof keywords === 'string' ? [keywords] : keywords;
  const joined = list.map((keyword) => keyword.trim()).filter((keyword) => keyword !== '').join(', ');
  return joined === '' ? undefined : joined;
};

export const withKeywords = (coreXml: string, keywords: string): string =>
  coreXml.replace('</cp:coreProperties>', `<cp:keywords>${escapeXml(keywords)}</cp:keywords></cp:coreProperties>`);

export const applyKeywords = async (buffer: Buffer, document: DocumentProperties | undefined): Promise<Buffer> => {
  const keywords = keywordsOf(document?.keywords);
  if (keywords === undefined) return buffer;
  const zip = await JSZip.loadAsync(buffer);
  const core = await zip.file('docProps/core.xml')?.async('string');
  if (core === undefined) return buffer;
  zip.file('docProps/core.xml', withKeywords(core, keywords));
  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
};
