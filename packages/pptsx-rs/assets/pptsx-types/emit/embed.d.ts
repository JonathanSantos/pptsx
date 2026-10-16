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
/** Uma face já com destino no pacote. */
export interface FontPart {
    readonly family: string;
    readonly style: EmbeddedFontStyle;
    readonly relId: string;
    /** Relativo a ppt/ (como no Target do relacionamento). */
    readonly target: string;
    readonly eot: Buffer;
}
export declare const FONT_RELATIONSHIP = "http://schemas.openxmlformats.org/officeDocument/2006/relationships/font";
export declare const FNTDATA_CONTENT_TYPE = "application/x-fontdata";
export declare const styleOf: (weight: FontWeight, italic: boolean) => EmbeddedFontStyle;
/** `count` ids rIdFontN livres, em ordem crescente de N. */
export declare const freeRelIdsOf: (rels: string, count: number) => readonly string[];
/** Faces → partes do pacote: ppt/fonts/fontN.fntdata e ids de relacionamento que não colidem com `rels`. */
export declare const fontPartsOf: (fonts: readonly EmbeddedFont[], rels: string) => readonly FontPart[];
/** Um <Default Extension="fntdata"> (só se ainda não houver). */
export declare const withFntdataContentType: (contentTypes: string) => string;
export declare const withFontRelationships: (rels: string, parts: readonly FontPart[]) => string;
export interface EmbeddedFontEntry {
    readonly family: string;
    readonly faces: readonly {
        readonly style: EmbeddedFontStyle;
        readonly relId: string;
    }[];
}
/** Uma entrada por família, na ordem da primeira aparição; faces na ordem do schema. */
export declare const fontEntriesOf: (parts: readonly FontPart[]) => readonly EmbeddedFontEntry[];
/** <p:embeddedFontLst> na posição do schema (depois de notesSz) + embedTrueTypeFonts="1". */
export declare const withEmbeddedFontList: (presentation: string, entries: readonly EmbeddedFontEntry[]) => string;
/** Embute as faces no .pptx. Lista vazia → buffer intacto. */
export declare const embedFonts: (buffer: Buffer, fonts: readonly EmbeddedFont[]) => Promise<Buffer>;
