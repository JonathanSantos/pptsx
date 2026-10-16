import { type Server } from 'node:http';
import { type PreviewState } from './state.ts';
/**
 * M16-4: servidor HTTP do preview ao vivo (`node:http`, sem framework). Rotas: `/` (página),
 * `/state.json`, `/diagnostics.json`, `/svg/<tamanho>/<n>?debug=1`, `/events` (SSE: `update` a cada
 * rebuild). O único estado é o último resultado (`getState`).
 */
export interface PreviewServerOptions {
    readonly getState: () => PreviewState;
    readonly baseDir: string;
    readonly lang?: string;
    readonly widthPx: number;
}
export interface PreviewServer {
    readonly server: Server;
    /** Avisa as páginas abertas que há um build novo. */
    readonly notify: () => void;
    /** Fecha as conexões SSE (que nunca terminam sozinhas) e o servidor. */
    readonly close: () => Promise<void>;
}
export declare const createPreviewServer: (options: PreviewServerOptions) => PreviewServer;
