import type { ComponentMeta, DeckContext, ResolvedNode, ResolvedSlide, Severity, Theme } from '../core/types.ts';
/**
 * M17: API pública de regra de lint — o gancho para um DS checar o que é dele (cores dos tokens, um
 * componente só no 1º slide…) sem o núcleo saber o nome do DS. Uma regra é uma função pura sobre a
 * árvore resolvida, chamada para cada slide e cada nó (`check`) e uma vez com o deck inteiro (`checkDeck`),
 * em cada tamanho do lint.
 */
export interface LintContext {
    /** O tamanho em que o deck foi resolvido (breakpoints, `ctx.pick`). */
    readonly size: DeckContext;
    /** O tema da config, se houver. */
    readonly theme?: Theme;
    /** Número do slide no <Deck> do autor (base 1). */
    readonly slide: number;
    readonly path: string;
    /** O componente que gerou o nó (`defineComponent` traz o meta inteiro). */
    readonly component?: ComponentMeta;
    /** O pai do nó (o Slide para os filhos diretos); ausente no próprio Slide. */
    readonly parent?: ResolvedNode | ResolvedSlide;
}
/**
 * `node.props` como a regra o recebe. Cada valor sai com o nome que o autor escreve no TSX e com o da
 * 0.x, que as regras antigas leem; os dois têm sempre o mesmo valor:
 *
 * | primitiva          | nome do autor (CSS) | alias da 0.x |
 * | ------------------ | ------------------- | ------------ |
 * | Text, SlideNumber  | `fontSize`          | `size`       |
 * | Text, SlideNumber  | `fontFamily`        | `font`       |
 * | Text, SlideNumber  | `fontWeight`        | `weight`     |
 * | Text, SlideNumber  | `fontStyle`         | `italic` (boolean) |
 * | Text, SlideNumber  | `textAlign`         | `align`      |
 * | Table              | `fontSize`, `fontFamily` | `size`, `font` |
 * | Chart              | `fontFamily`, `fontSize` (rótulos) | `font`, `size` |
 * | Shape, Path        | `backgroundColor`   | `fill`       |
 * | Image              | `objectFit`         | `fit`        |
 *
 * O estilo de texto já vem com a herança (o `fontSize` de um Box pai chega ao Text). Cores saem como
 * '#RRGGBB'. `color` e `lineHeight` têm um nome só.
 */
export interface LintProps {
    readonly fontSize?: number;
    readonly fontFamily?: string;
    readonly fontWeight?: string | number;
    readonly fontStyle?: 'normal' | 'italic';
    readonly textAlign?: string;
    readonly backgroundColor?: string;
    readonly objectFit?: string;
    /**
     * Corpo (pt) com que o Text, o SlideNumber ou a Table seria desenhado depois do fit: igual ao
     * `fontSize` quando nada encolheu, menor quando o `fit="shrink"` atuou. Medido no slide do autor
     * inteiro (o lint não pagina). Ausente em nó que não é texto nem tabela.
     */
    readonly fittedFontSize?: number;
    /** @deprecated nome da 0.x; leia `fontSize`. */
    readonly size?: unknown;
    /** @deprecated nome da 0.x; leia `fontFamily`. */
    readonly font?: unknown;
    /** @deprecated nome da 0.x; leia `fontWeight`. */
    readonly weight?: unknown;
    /** @deprecated nome da 0.x; leia `fontStyle`. */
    readonly italic?: unknown;
    /** @deprecated nome da 0.x; leia `textAlign`. */
    readonly align?: unknown;
    /** @deprecated nome da 0.x em Shape/Path; leia `backgroundColor`. */
    readonly fill?: unknown;
}
/** O que a regra devolve: a mensagem e, se quiser, outro path/severidade (o padrão é o do nó e o da regra). */
export interface RuleFinding {
    readonly message: string;
    readonly severity?: Severity;
    readonly path?: string;
}
/** Um slide do deck como `checkDeck` (e `check`) o recebe: o slide resolvido e de onde ele veio. */
export type LintSlide = ResolvedSlide & {
    /** Número do slide no <Deck> do autor (base 1). */
    readonly sourceSlide: number;
};
/** O deck inteiro num tamanho: todos os slides resolvidos, na ordem do autor. */
export interface LintDeck {
    readonly slides: readonly LintSlide[];
}
/** Contexto de `checkDeck`: não há nó nem slide corrente. */
export interface DeckLintContext {
    readonly size: DeckContext;
    readonly theme?: Theme;
}
/**
 * Achado de `checkDeck`. Com `slide` (base 1, o `sourceSlide`), aponta aquele slide e o path dele;
 * sem, é do deck inteiro (sai como `[deck] … em Deck`, `"slide": 0` no JSON).
 */
export interface DeckFinding {
    readonly message: string;
    readonly slide?: number;
    readonly path?: string;
    readonly severity?: Severity;
}
/** Uma regra tem `check`, `checkDeck` ou os dois; sem nenhum, ela é ignorada. */
export interface LintRule {
    /** Vira o `code` do achado; prefixe com o DS (`ds-base/kpi-row-max-4`). */
    readonly id: string;
    readonly severity: Severity;
    /** Por nó: chamada para cada slide e cada descendente. `node.props` segue `LintProps`. */
    readonly check?: (node: ResolvedNode | ResolvedSlide, ctx: LintContext) => readonly RuleFinding[];
    /**
     * Pelo deck: chamada uma vez por tamanho com todos os slides. É onde se cobra o que um nó sozinho
     * não mostra: ritmo (layouts repetidos em sequência), proporção (slides de fundo de marca), falta
     * de encerramento, títulos repetidos.
     */
    readonly checkDeck?: (deck: LintDeck, ctx: DeckLintContext) => readonly DeckFinding[];
}
