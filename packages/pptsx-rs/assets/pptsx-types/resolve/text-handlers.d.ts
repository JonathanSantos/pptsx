import type { Handler } from './draft.ts';
/** Handlers das propriedades de texto (as herdadas descem pelo `draft.text`). */
/** Primeira família de uma lista CSS, sem aspas ('"Inter", Arial' → 'Inter'). */
export declare const parseFontFamily: (value: unknown) => string | undefined;
export declare const fontWeight: Handler;
export declare const whiteSpace: Handler;
export declare const TEXT_HANDLERS: Readonly<Record<string, Handler>>;
