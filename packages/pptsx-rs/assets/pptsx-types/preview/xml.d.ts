/** Escape de texto e valores de atributo; aspas incluídas para servir aos dois. */
export declare const escapeXml: (value: string) => string;
export type AttrValue = string | number | undefined;
export type Attrs = Readonly<Record<string, AttrValue>>;
/** Atributos undefined são omitidos, o que simplifica props opcionais nos builders. */
export declare const attrs: (record: Attrs) => string;
/** children é XML já montado (não é escapado de novo). */
export declare const element: (tag: string, record: Attrs, children?: string) => string;
