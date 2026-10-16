export type ReadFile = (path: string) => Buffer;
export declare const mimeOf: (path: string) => string;
export declare const dataUriOf: (mime: string, data: Buffer) => string;
/** Única fronteira de IO do SVG; readFile injetável mantém slideToSvg testável. */
export declare const loadImageUri: (src: string, baseDir: string, readFile?: ReadFile) => string;
