import type { ComponentMeta, DeckContext, ResolvedNode, ResolvedSlide, Severity, Theme } from '../core/types.ts';

/**
 * M17: API pública de regra de lint — o gancho para um DS checar o que é dele (cores dos tokens, um
 * componente só no 1º slide…) sem o núcleo saber o nome do DS. Uma regra é uma função pura sobre a
 * árvore resolvida, chamada para cada slide e cada nó, em cada tamanho do lint.
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

/** O que a regra devolve: a mensagem e, se quiser, outro path/severidade (o padrão é o do nó e o da regra). */
export interface RuleFinding {
  readonly message: string;
  readonly severity?: Severity;
  readonly path?: string;
}

export interface LintRule {
  /** Vira o `code` do achado; prefixe com o DS (`ds-base/kpi-row-max-4`). */
  readonly id: string;
  readonly severity: Severity;
  readonly check: (node: ResolvedNode | ResolvedSlide, ctx: LintContext) => readonly RuleFinding[];
}
