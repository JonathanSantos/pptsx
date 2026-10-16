/** TrueType de uma face só: o que cabe num EOT sem conversão (CFF/.otf e .ttc ficam de fora). */
export declare const isTrueTypeFont: (ttf: Buffer) => boolean;
export declare const fsTypeOf: (ttf: Buffer) => number;
export declare const isEmbeddable: (fsType: number) => boolean;
/**
 * `familyName` é o nome com que o deck usa a fonte (o `typeface` do `<p:embeddedFont>`);
 * estilo e versão vêm da tabela `name` do TTF. Função pura sobre o Buffer.
 */
export declare const eotOf: (ttf: Buffer, familyName: string) => Buffer;
