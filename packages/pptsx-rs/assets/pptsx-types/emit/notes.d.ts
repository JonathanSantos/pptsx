import type { ResolvedNotes, TextRun } from '../core/types.ts';
/** Notas que precisam do caminho rico: algum trecho com estilo além do texto puro preto. */
export declare const isRichNotes: (notes: ResolvedNotes) => boolean;
/** Trechos de cada parágrafo ('\n' separa, como no Text); parágrafo vazio fica com zero trechos. */
export declare const notesParagraphsOf: (runs: readonly TextRun[]) => readonly (readonly TextRun[])[];
/** Relacionamento de link de um trecho: id já atribuído por URL. */
type LinkIds = ReadonlyMap<string, string>;
export declare const notesBodyXmlOf: (notes: ResolvedNotes, lang: string, links: LinkIds) => string;
/** URLs externas das notas, cada uma com um id novo (não colide com os do pptxgenjs, que usam rIdN). */
export declare const linkIdsOf: (notes: ResolvedNotes) => LinkIds;
export declare const withRichNotes: (xml: string, body: string) => string;
export declare const withLinkRelationships: (rels: string, links: LinkIds) => string;
/** Reescreve as notas ricas; `notes[i]` = notas do slide de saída i (o pptxgenjs numera notesSlide como o slide). */
export declare const applyRichNotes: (buffer: Buffer, notes: readonly (ResolvedNotes | undefined)[], lang: string) => Promise<Buffer>;
export {};
