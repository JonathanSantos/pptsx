/**
 * M18-8: `references/props.md` da skill, gerado do mesmo schema do `schema()` do MCP (nunca à mão):
 * uma tabela por primitiva (ou componente de DS) com a prop, o tipo e a descrição.
 */
interface RawProp {
    readonly type?: string;
    readonly description?: string;
    readonly examples?: readonly unknown[];
}
interface RawObject {
    readonly properties?: Readonly<Record<string, RawProp>>;
    readonly required?: readonly string[];
}
export declare const propsSectionOf: (title: string, schema: RawObject) => string;
/** Toda prop aceita também `{ base, tall, wide }` (responsivo); `*` = obrigatória. */
export declare const propsMarkdown: (heading: string, schema: Readonly<Record<string, RawObject>>, names?: Readonly<Record<string, string>>) => string;
export {};
