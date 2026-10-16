import type { DocumentProperties } from '../core/types.ts';
import type { Presentation } from './pptx.ts';
/** M15: propriedades do documento. Título, autor, empresa e assunto o pptxgenjs grava; palavras-chave não. */
export declare const setDocumentProperties: (pptx: Presentation, document: DocumentProperties) => void;
export declare const keywordsOf: (keywords: DocumentProperties['keywords']) => string | undefined;
export declare const withKeywords: (coreXml: string, keywords: string) => string;
export declare const applyKeywords: (buffer: Buffer, document: DocumentProperties | undefined) => Promise<Buffer>;
