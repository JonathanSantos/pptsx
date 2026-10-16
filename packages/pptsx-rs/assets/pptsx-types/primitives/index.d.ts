import type { AuthorPropsMap, Child, Component, ComponentMetaFor, LayoutComponent, LayoutOptions, Primitive, PrimitiveKind, SlideElement } from '../core/types.ts';
/** Factory: função marcada com o kind; chamá-la direto equivale a usar a tag. */
export declare const definePrimitive: <K extends PrimitiveKind>(kind: K) => Primitive<K>;
export declare const isPrimitive: (type: unknown) => type is Primitive<PrimitiveKind>;
export declare const primitiveName: (kind: PrimitiveKind) => string;
export declare const Deck: Primitive<"deck">;
export declare const Slide: Primitive<"slide">;
export declare const Box: Primitive<"box">;
export declare const Text: Primitive<"text">;
export declare const Image: Primitive<"image">;
export declare const Shape: Primitive<"shape">;
export declare const Span: Primitive<"span">;
export declare const Chart: Primitive<"chart">;
export declare const Table: Primitive<"table">;
export declare const Path: Primitive<"path">;
export declare const Icon: Primitive<"icon">;
export declare const Connector: Primitive<"connector">;
export declare const SlideNumber: Primitive<"slideNumber">;
/** M19: Box cujo conteúdo é uma função do espaço medido (`{(box) => …}`); ver CONTRACTS, Container. */
export declare const Container: Primitive<"container">;
export declare function B(props: AuthorPropsMap['span']): SlideElement;
export declare function I(props: AuthorPropsMap['span']): SlideElement;
/** M13: sobrescrito (m², nota¹). */
export declare function Sup(props: AuthorPropsMap['span']): SlideElement;
/** M13: subscrito (H₂O). */
export declare function Sub(props: AuthorPropsMap['span']): SlideElement;
/**
 * M15: marca um componente que devolve um <Slide> como layout do arquivo: os slides que ele gera
 * usam um slide layout próprio no master (nome = `name`), com os placeholders nas posições do
 * primeiro uso e o conteúdo `fixed` no master. O componente continua sendo chamado como antes.
 */
export declare const defineLayout: <P>(name: string, options: LayoutOptions, component: Component<P>) => LayoutComponent<P>;
/**
 * M17: componente com identidade. O nome (`displayName ?? name`) vai no path mesmo quando a função é
 * anônima ou embrulhada; `defaults` preenche as props ausentes; o `meta` (livre: `ds`, `tags`, `catalog`…)
 * chega ao nó resolvido em `component`, onde regras de lint e o catálogo o leem. Sem variantes nem estilo:
 * isso é do DS. Função comum continua valendo como componente.
 */
export declare function defineComponent<P extends object>(meta: string | ComponentMetaFor<NoInfer<P>>, fn: (props: P) => Child, defaults?: Partial<NoInfer<P>>): Component<P>;
