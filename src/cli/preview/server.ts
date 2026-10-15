import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { PREVIEW_PAGE } from './page.ts';
import { slideSvgOf, stateJsonOf, type PreviewState } from './state.ts';

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

const send = (response: ServerResponse, status: number, type: string, body: string): void => {
  response.writeHead(status, { 'content-type': type, 'cache-control': 'no-store' });
  response.end(body);
};

const SVG_ROUTE = /^\/svg\/([^/]+)\/(\d+)$/;

export const createPreviewServer = (options: PreviewServerOptions): PreviewServer => {
  const clients = new Set<ServerResponse>();
  const handle = (request: IncomingMessage, response: ServerResponse): void => {
    const url = new URL(request.url ?? '/', 'http://localhost');
    if (url.pathname === '/') return send(response, 200, 'text/html; charset=utf-8', PREVIEW_PAGE);
    if (url.pathname === '/state.json') return send(response, 200, 'application/json', JSON.stringify(stateJsonOf(options.getState())));
    if (url.pathname === '/diagnostics.json') {
      return send(response, 200, 'application/json', JSON.stringify(options.getState().sizes.flatMap((size) => size.diagnostics), null, 2));
    }
    if (url.pathname === '/events') {
      response.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-store', connection: 'keep-alive' });
      response.write(': conectado\n\n');
      clients.add(response);
      request.on('close', () => clients.delete(response));
      return;
    }
    const svg = SVG_ROUTE.exec(url.pathname);
    if (svg !== null) {
      const body = slideSvgOf(options.getState(), { size: decodeURIComponent(svg[1]!), slide: Number(svg[2]), debug: url.searchParams.get('debug') === '1' }, options);
      return body === undefined ? send(response, 404, 'text/plain; charset=utf-8', 'slide não encontrado') : send(response, 200, 'image/svg+xml', body);
    }
    send(response, 404, 'text/plain; charset=utf-8', 'não encontrado');
  };
  const notify = (): void => {
    const version = options.getState().version;
    clients.forEach((client) => client.write(`event: update\ndata: ${version}\n\n`));
  };
  const server = createServer(handle);
  const close = (): Promise<void> =>
    new Promise((done) => {
      clients.forEach((client) => client.end());
      clients.clear();
      server.close(() => done());
      server.closeAllConnections();
    });
  return { server, notify, close };
};
