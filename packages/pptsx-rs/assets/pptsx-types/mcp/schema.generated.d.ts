export interface PropSchema {
    readonly type: string;
    readonly description?: string;
}
export interface PrimitiveSchema {
    readonly type: 'object';
    readonly properties: Readonly<Record<string, PropSchema>>;
    readonly required: readonly string[];
}
export declare const PROPS_SCHEMA: Readonly<Record<string, PrimitiveSchema>>;
