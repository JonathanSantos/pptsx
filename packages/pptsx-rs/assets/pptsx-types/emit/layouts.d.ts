import type { PlaceholderName, PositionedDeck, Pt, Rect, TextAlign } from '../core/types.ts';
import type * as Pptx from './pptx.ts';
export declare const PLACEHOLDER_PREFIX = "ph:";
export interface PlaceholderText {
    readonly family: string;
    readonly size: Pt;
    readonly color: string;
    readonly bold: boolean;
    readonly italic: boolean;
    readonly align: TextAlign;
}
export interface PlaceholderSpec {
    readonly name: PlaceholderName;
    readonly type: string;
    /** Ausente no título (o PowerPoint casa o título pelo tipo). */
    readonly idx?: number;
    readonly frame: Rect;
    readonly text?: PlaceholderText;
}
export interface LayoutPlan {
    readonly name: string;
    readonly background?: string | {
        readonly image: string;
    };
    /** Índice (base 0) do slide de saída de onde saem as posições e o conteúdo fixo. */
    readonly first: number;
    /** Índices de todos os slides de saída do layout. */
    readonly slides: readonly number[];
    readonly placeholders: readonly PlaceholderSpec[];
}
/** Um plano por layout, na ordem em que aparecem no deck de saída. */
export declare const layoutPlansOf: (deck: PositionedDeck) => readonly LayoutPlan[];
/** Opções do `defineSlideMaster`: fundo do layout (o conteúdo fixo e os placeholders entram no pós-processamento). */
export declare const slideMasterPropsOf: (plan: LayoutPlan, baseDir: string, resolvePath: (baseDir: string, src: string) => string) => Pptx.SlideMasterProps;
export declare const phXmlOf: (spec: Pick<PlaceholderSpec, 'type' | 'idx'>) => string;
/**
 * Num placeholder, atributo ausente no run herda do estilo do placeholder (o Keynote põe o subtítulo
 * em negrito, por exemplo): negrito e itálico ficam explícitos em cada run.
 */
export declare const explicitRunStyle: (element: string) => string;
/** O 1º `<p:sp>`/`<p:pic>` com o nome `ph:<nome>` recebe o `<p:ph>`; xfrm e estilo do slide ficam. */
export declare const linkPlaceholder: (xml: string, spec: PlaceholderSpec) => string;
export declare const layoutPlaceholderXmlOf: (spec: PlaceholderSpec, id: number, lang: string) => string;
/** Separa os `count` últimos elementos de desenho do spTree (o conteúdo fixo emitido por último). */
export declare const takeLastDrawings: (xml: string, count: number) => {
    readonly rest: string;
    readonly taken: readonly string[];
};
/**
 * Elementos movidos do slide para o layout: ids de shape novos (únicos no layout) e cada `r:embed`/`r:id`
 * apontando para uma cópia do relacionamento no `.rels` do layout.
 */
export declare const movedDrawingsOf: (drawings: readonly string[], slideRels: string, layoutRels: string, firstId: number) => {
    readonly xml: string;
    readonly rels: string;
};
/** `fixedCounts[i]` = elementos fixos emitidos por último no slide de saída i (só no 1º de cada layout). */
export declare const applyLayouts: (buffer: Buffer, plans: readonly LayoutPlan[], fixedCounts: ReadonlyMap<number, number>, lang: string) => Promise<Buffer>;
